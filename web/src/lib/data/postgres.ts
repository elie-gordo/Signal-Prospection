import postgres from "postgres";
import {
  HOT_SCORE,
  PAGE_SIZE,
  type Company,
  type DashboardStats,
  type Lead,
  type LeadDetail,
  type LeadFilters,
  type LeadRepository,
  type LeadStatus,
  type SiteAudit,
  type Source,
} from "../types";

type Row = Record<string, unknown>;

let client: postgres.Sql | null = null;

function db(): postgres.Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (or use DATA_SOURCE=demo)");
  client = postgres(url, { max: 5, idle_timeout: 20 });
  return client;
}

const iso = (v: unknown): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v);

function toCompany(r: Row): Company | null {
  if (r.c_id == null) return null;
  return {
    id: Number(r.c_id),
    siren: (r.siren as string) ?? null,
    name: r.c_name as string,
    nafCode: (r.naf_code as string) ?? null,
    nafLabel: (r.naf_label as string) ?? null,
    activity: (r.activity as string) ?? null,
    address: (r.address as string) ?? null,
    postalCode: (r.postal_code as string) ?? null,
    city: (r.city as string) ?? null,
    foundedOn: iso(r.founded_on)?.slice(0, 10) ?? null,
    employeeRange: (r.employee_range as string) ?? null,
    directorName: (r.director_name as string) ?? null,
    website: (r.website as string) ?? null,
    websiteSource: (r.website_source as string) ?? null,
    email: (r.email as string) ?? null,
    phone: (r.phone as string) ?? null,
  };
}

function toLead(r: Row): Lead {
  return {
    id: Number(r.id),
    source: r.source as Source,
    signal: r.signal as Lead["signal"],
    title: r.title as string,
    description: (r.description as string) ?? null,
    url: (r.url as string) ?? null,
    budgetMin: (r.budget_min as number) ?? null,
    budgetMax: (r.budget_max as number) ?? null,
    score: Number(r.score),
    scoreReasons: (r.score_reasons as Lead["scoreReasons"]) ?? [],
    status: r.status as LeadStatus,
    notes: (r.notes as string) ?? null,
    publishedAt: iso(r.published_at),
    collectedAt: iso(r.collected_at) as string,
    company: toCompany(r),
  };
}

const LEAD_SELECT = `
  l.*, c.id AS c_id, c.name AS c_name, c.siren, c.naf_code, c.naf_label, c.activity, c.address,
  c.postal_code, c.city, c.founded_on, c.employee_range, c.director_name, c.website, c.website_source,
  c.email, c.phone
  FROM leads l LEFT JOIN companies c ON c.id = l.company_id`;

function buildWhere(f: LeadFilters): { sql: string; params: (string | number)[] } {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  const param = (value: string | number) => {
    params.push(value);
    return `$${params.length}`;
  };
  if (f.source) clauses.push(`l.source = ${param(f.source)}`);
  if (f.signal) clauses.push(`l.signal = ${param(f.signal)}`);
  if (f.status) clauses.push(`l.status = ${param(f.status)}`);
  else clauses.push("l.status <> 'ignored'");
  if (f.minScore) clauses.push(`l.score >= ${param(f.minScore)}`);
  if (f.q) {
    const p = param(`%${f.q}%`);
    clauses.push(`(l.title ILIKE ${p} OR l.description ILIKE ${p} OR c.name ILIKE ${p} OR c.city ILIKE ${p})`);
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

export const postgresRepo: LeadRepository = {
  readOnly: false,

  async listLeads(f) {
    const { sql, params } = buildWhere(f);
    const offset = ((f.page ?? 1) - 1) * PAGE_SIZE;
    const [rows, [{ count }]] = await Promise.all([
      db().unsafe(
        `SELECT ${LEAD_SELECT} ${sql} ORDER BY l.score DESC, l.published_at DESC NULLS LAST LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
        params,
      ),
      db().unsafe(`SELECT count(*)::int AS count FROM leads l LEFT JOIN companies c ON c.id = l.company_id ${sql}`, params),
    ]);
    return { leads: rows.map(toLead), total: Number(count) };
  },

  async getLead(id) {
    const rows = await db().unsafe(`SELECT ${LEAD_SELECT} WHERE l.id = $1`, [id]);
    if (!rows.length) return null;
    const lead = toLead(rows[0]);
    let audit: SiteAudit | null = null;
    if (lead.company) {
      const [a] = await db()`
        SELECT * FROM site_audits WHERE company_id = ${lead.company.id} ORDER BY checked_at DESC LIMIT 1`;
      if (a) {
        audit = {
          url: a.url,
          reachable: a.reachable,
          statusCode: a.status_code,
          https: a.https,
          loadMs: a.load_ms,
          pageWeightKb: a.page_weight_kb,
          hasViewport: a.has_viewport,
          cms: a.cms,
          copyrightYear: a.copyright_year,
          score: a.score,
          issues: a.issues ?? [],
          checkedAt: iso(a.checked_at) as string,
        };
      }
    }
    return { ...lead, audit } satisfies LeadDetail;
  },

  async topLeads(limit) {
    const rows = await db().unsafe(
      `SELECT ${LEAD_SELECT} WHERE l.status IN ('new','qualified') ORDER BY l.score DESC, l.published_at DESC NULLS LAST LIMIT $1`,
      [limit],
    );
    return rows.map(toLead);
  },

  async stats(): Promise<DashboardStats> {
    const sql = db();
    const [[totals], bySource, byDay, buckets, runs] = await Promise.all([
      sql`
        SELECT count(*)::int AS total,
          count(*) FILTER (WHERE coalesce(published_at, collected_at) > now() - interval '7 days')::int AS last7,
          count(*) FILTER (WHERE score >= ${HOT_SCORE} AND status IN ('new','qualified'))::int AS hot,
          count(*) FILTER (WHERE status IN ('contacted','replied'))::int AS contacted,
          count(*) FILTER (WHERE status = 'won')::int AS won
        FROM leads`,
      sql`SELECT source, count(*)::int AS count FROM leads GROUP BY source ORDER BY count DESC`,
      sql`
        SELECT to_char(d, 'YYYY-MM-DD') AS day, count(l.id)::int AS count
        FROM generate_series(current_date - 13, current_date, interval '1 day') d
        LEFT JOIN leads l ON date_trunc('day', coalesce(l.published_at, l.collected_at)) = d
        GROUP BY d ORDER BY d`,
      sql`SELECT least(score / 10, 9) * 10 AS bucket, count(*)::int AS count FROM leads GROUP BY 1 ORDER BY 1`,
      sql`
        SELECT DISTINCT ON (source) source, finished_at, inserted, error
        FROM collector_runs ORDER BY source, started_at DESC`,
    ]);
    const bucketMap = new Map(buckets.map((b) => [Number(b.bucket), Number(b.count)]));
    return {
      total: totals.total,
      last7Days: totals.last7,
      hot: totals.hot,
      contacted: totals.contacted,
      won: totals.won,
      bySource: bySource.map((r) => ({ source: r.source as Source, count: r.count })),
      byDay: byDay.map((r) => ({ day: r.day, count: r.count })),
      scoreBuckets: Array.from({ length: 10 }, (_, i) => ({ bucket: i * 10, count: bucketMap.get(i * 10) ?? 0 })),
      lastRuns: runs.map((r) => ({
        source: r.source as Source,
        finishedAt: iso(r.finished_at),
        inserted: r.inserted,
        error: r.error,
      })),
    };
  },

  async updateLead(id, patch) {
    await db()`
      UPDATE leads SET
        status = coalesce(${patch.status ?? null}, status),
        notes = coalesce(${patch.notes ?? null}, notes),
        updated_at = now()
      WHERE id = ${id}`;
  },
};

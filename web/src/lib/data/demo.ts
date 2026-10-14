import { HOT_SCORE, PAGE_SIZE, SOURCES, type DashboardStats, type LeadDetail, type LeadFilters, type LeadRepository } from "../types";
import { DEMO_LEADS, DEMO_NOW } from "./fixtures";

const DAY = 86_400_000;

const byScore = (a: LeadDetail, b: LeadDetail) =>
  b.score - a.score || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");

export function filterLeads(leads: readonly LeadDetail[], f: LeadFilters): LeadDetail[] {
  const q = f.q?.toLowerCase();
  return leads
    .filter((l) => (f.status ? l.status === f.status : l.status !== "ignored"))
    .filter((l) => !f.source || l.source === f.source)
    .filter((l) => !f.signal || l.signal === f.signal)
    .filter((l) => !f.minScore || l.score >= f.minScore)
    .filter(
      (l) =>
        !q ||
        [l.title, l.description, l.company?.name, l.company?.city].some((v) => v?.toLowerCase().includes(q)),
    )
    .sort(byScore);
}

export function computeStats(leads: readonly LeadDetail[], now: number): DashboardStats {
  const days = Array.from({ length: 14 }, (_, i) => new Date(now - (13 - i) * DAY).toISOString().slice(0, 10));
  const dayCount = new Map(days.map((d) => [d, 0]));
  for (const l of leads) {
    const d = (l.publishedAt ?? l.collectedAt).slice(0, 10);
    if (dayCount.has(d)) dayCount.set(d, (dayCount.get(d) ?? 0) + 1);
  }
  const buckets = Array.from({ length: 10 }, (_, i) => ({ bucket: i * 10, count: 0 }));
  for (const l of leads) buckets[Math.min(9, Math.floor(l.score / 10))].count++;
  return {
    total: leads.length,
    last7Days: leads.filter((l) => now - Date.parse(l.publishedAt ?? l.collectedAt) < 7 * DAY).length,
    hot: leads.filter((l) => l.score >= HOT_SCORE && (l.status === "new" || l.status === "qualified")).length,
    contacted: leads.filter((l) => l.status === "contacted" || l.status === "replied").length,
    won: leads.filter((l) => l.status === "won").length,
    bySource: SOURCES.map((source) => ({ source, count: leads.filter((l) => l.source === source).length }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count),
    byDay: days.map((day) => ({ day, count: dayCount.get(day) ?? 0 })),
    scoreBuckets: buckets,
    lastRuns: SOURCES.filter((s) => s !== "malt").map((source, i) => ({
      source,
      finishedAt: new Date(now - (i + 1) * 3_600_000).toISOString(),
      inserted: [12, 7, 4, 9][i] ?? 0,
      error: null,
    })),
  };
}

export const demoRepo: LeadRepository = {
  readOnly: true,
  async listLeads(f) {
    const all = filterLeads(DEMO_LEADS, f);
    const start = ((f.page ?? 1) - 1) * PAGE_SIZE;
    return { leads: all.slice(start, start + PAGE_SIZE), total: all.length };
  },
  async getLead(id) {
    return DEMO_LEADS.find((l) => l.id === id) ?? null;
  },
  async topLeads(limit) {
    return DEMO_LEADS.filter((l) => l.status === "new" || l.status === "qualified").sort(byScore).slice(0, limit);
  },
  async stats() {
    return computeStats(DEMO_LEADS, DEMO_NOW);
  },
  async updateLead() {
    throw new Error("Démo en lecture seule");
  },
};

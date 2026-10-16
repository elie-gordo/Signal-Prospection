import Link from "next/link";
import { ScoreBadge, SourceTag, StatusPill } from "@/components/LeadBits";
import { referenceNow, repo } from "@/lib/data";
import { filtersToQuery, parseFilters } from "@/lib/filters";
import { formatBudget, SIGNAL_LABEL, SOURCE_LABEL, STATUS_LABEL, timeAgo } from "@/lib/labels";
import { HOT_SCORE, PAGE_SIZE, SIGNALS, SOURCES, STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const selectClass =
  "h-9 rounded-md border border-line bg-surface px-2.5 text-sm text-ink focus-visible:border-ink focus-visible:outline-none";
const labelClass = "text-xs text-muted";
const chipClass = "rounded-md border border-line bg-surface px-2.5 py-1 transition-colors";

export default async function LeadsPage({ searchParams }: Props) {
  const filters = parseFilters(await searchParams);
  const { leads, total } = await repo.listLeads(filters);
  const now = referenceNow();
  const page = filters.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(filters.source || filters.signal || filters.status || filters.minScore || filters.q);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6 pt-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="tabular text-ink">{total}</span> résultat{total > 1 ? "s" : ""}, triés par score
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href={`/leads?min=${HOT_SCORE}`} className={`${chipClass} text-signal hover:border-signal`}>
            Chauds ≥ {HOT_SCORE}
          </Link>
          <Link href="/leads?status=qualified" className={`${chipClass} text-ink-soft hover:border-line-strong hover:text-ink`}>
            Qualifiés
          </Link>
        </div>
      </header>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4" role="search">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1">
          <span className={labelClass}>Recherche</span>
          <input name="q" defaultValue={filters.q} placeholder="Nom, ville, mot-clé…" className={`${selectClass} placeholder:text-muted`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Source</span>
          <select name="source" defaultValue={filters.source ?? ""} className={selectClass}>
            <option value="">Toutes</option>
            {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Signal</span>
          <select name="signal" defaultValue={filters.signal ?? ""} className={selectClass}>
            <option value="">Tous</option>
            {SIGNALS.map((s) => <option key={s} value={s}>{SIGNAL_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Statut</span>
          <select name="status" defaultValue={filters.status ?? ""} className={selectClass}>
            <option value="">Actifs</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="flex w-24 flex-col gap-1">
          <span className={labelClass}>Score min</span>
          <input name="min" type="number" min={1} max={100} defaultValue={filters.minScore} className={`${selectClass} tabular`} />
        </label>
        <button type="submit" className="h-9 rounded-md bg-ink px-4 text-sm font-medium text-paper transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          Filtrer
        </button>
        {hasFilters && (
          <Link href="/leads" className="h-9 px-2 text-sm leading-9 text-muted hover:text-ink">
            Réinitialiser
          </Link>
        )}
      </form>

      {leads.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface py-16 text-center text-sm text-muted">Rien ne correspond à ces filtres.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Lead</th>
                <th className="py-2.5 pr-4 font-medium">Source</th>
                <th className="py-2.5 pr-4 font-medium">Lieu / budget</th>
                <th className="py-2.5 pr-4 font-medium">Statut</th>
                <th className="py-2.5 pr-4 font-medium">Publié</th>
                <th className="py-2.5 pr-4 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="group border-b border-line transition-colors last:border-b-0 hover:bg-paper">
                  <td className="max-w-[380px] px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="block truncate font-medium text-ink underline-offset-4 group-hover:underline focus-visible:underline focus-visible:outline-none">
                      {lead.title}
                    </Link>
                    <span className="text-xs text-muted">{SIGNAL_LABEL[lead.signal]}</span>
                  </td>
                  <td className="py-3 pr-4"><SourceTag source={lead.source} isCompact /></td>
                  <td className="py-3 pr-4 text-ink-soft">
                    {formatBudget(lead.budgetMin, lead.budgetMax) ?? lead.company?.city ?? "—"}
                  </td>
                  <td className="py-3 pr-4"><StatusPill status={lead.status} /></td>
                  <td className="whitespace-nowrap py-3 pr-4 text-xs text-muted">{timeAgo(lead.publishedAt ?? lead.collectedAt, now)}</td>
                  <td className="py-3 pr-4 text-right"><ScoreBadge score={lead.score} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between pt-4 text-sm">
          {page > 1 ? (
            <Link href={`/leads${filtersToQuery(filters, { page: page - 1 })}`} className="text-ink-soft hover:text-ink">← Précédent</Link>
          ) : <span />}
          <span className="text-muted tabular">Page {page} / {pages}</span>
          {page < pages ? (
            <Link href={`/leads${filtersToQuery(filters, { page: page + 1 })}`} className="text-ink-soft hover:text-ink">Suivant →</Link>
          ) : <span />}
        </nav>
      )}
    </>
  );
}

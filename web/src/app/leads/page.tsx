import Link from "next/link";
import { ScoreBadge, SourceTag, StatusPill } from "@/components/LeadBits";
import { referenceNow, repo } from "@/lib/data";
import { filtersToQuery, parseFilters } from "@/lib/filters";
import { formatBudget, SIGNAL_LABEL, SOURCE_LABEL, STATUS_LABEL, timeAgo } from "@/lib/labels";
import { HOT_SCORE, PAGE_SIZE, SIGNALS, SOURCES, STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const selectClass =
  "h-10 rounded-md border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal";

export default async function LeadsPage({ searchParams }: Props) {
  const filters = parseFilters(await searchParams);
  const { leads, total } = await repo.listLeads(filters);
  const now = referenceNow();
  const page = filters.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(filters.source || filters.signal || filters.status || filters.minScore || filters.q);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6 pt-12">
        <div>
          <h1 className="font-display text-5xl tracking-tight">Leads</h1>
          <p className="mt-2 text-sm text-muted">
            <span className="font-mono tabular text-ink">{total}</span> résultat{total > 1 ? "s" : ""}, triés par score
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href={`/leads?min=${HOT_SCORE}`} className="rounded-full border border-signal px-3 py-1.5 text-signal transition-colors hover:bg-signal hover:text-paper">
            Chauds ≥ {HOT_SCORE}
          </Link>
          <Link href="/leads?status=qualified" className="rounded-full border border-line-strong px-3 py-1.5 text-ink-soft transition-colors hover:border-ink hover:text-ink">
            Qualifiés
          </Link>
        </div>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3 border-b border-line py-5" role="search">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Recherche</span>
          <input name="q" defaultValue={filters.q} placeholder="nom, ville, mot-clé…" className={`${selectClass} placeholder:text-muted`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Source</span>
          <select name="source" defaultValue={filters.source ?? ""} className={selectClass}>
            <option value="">Toutes</option>
            {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Signal</span>
          <select name="signal" defaultValue={filters.signal ?? ""} className={selectClass}>
            <option value="">Tous</option>
            {SIGNALS.map((s) => <option key={s} value={s}>{SIGNAL_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Statut</span>
          <select name="status" defaultValue={filters.status ?? ""} className={selectClass}>
            <option value="">Actifs</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="flex w-24 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Score min</span>
          <input name="min" type="number" min={1} max={100} defaultValue={filters.minScore} className={`${selectClass} font-mono`} />
        </label>
        <button type="submit" className="h-10 rounded-md bg-ink px-5 text-sm font-medium text-paper transition-transform hover:-translate-y-px active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
          Filtrer
        </button>
        {hasFilters && (
          <Link href="/leads" className="h-10 px-2 text-sm leading-10 text-muted underline-offset-4 hover:text-ink hover:underline">
            Réinitialiser
          </Link>
        )}
      </form>

      {leads.length === 0 ? (
        <p className="py-20 text-center font-display text-2xl italic text-muted">Rien ne correspond à ces filtres.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line-strong text-left font-mono text-[10px] uppercase tracking-wider text-muted">
                <th className="py-3 pr-4 font-normal">Lead</th>
                <th className="py-3 pr-4 font-normal">Source</th>
                <th className="py-3 pr-4 font-normal">Lieu / budget</th>
                <th className="py-3 pr-4 font-normal">Statut</th>
                <th className="py-3 pr-4 font-normal">Publié</th>
                <th className="py-3 text-right font-normal">Score</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="group border-b border-line transition-colors hover:bg-surface">
                  <td className="max-w-[380px] py-3 pr-4">
                    <Link href={`/leads/${lead.id}`} className="block truncate font-medium text-ink underline-offset-4 group-hover:underline focus-visible:underline focus-visible:outline-none">
                      {lead.title}
                    </Link>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{SIGNAL_LABEL[lead.signal]}</span>
                  </td>
                  <td className="py-3 pr-4"><SourceTag source={lead.source} isCompact /></td>
                  <td className="py-3 pr-4 text-ink-soft">
                    {formatBudget(lead.budgetMin, lead.budgetMax) ?? lead.company?.city ?? "—"}
                  </td>
                  <td className="py-3 pr-4"><StatusPill status={lead.status} /></td>
                  <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs text-muted">{timeAgo(lead.publishedAt ?? lead.collectedAt, now)}</td>
                  <td className="py-3 text-right"><ScoreBadge score={lead.score} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between pt-6 font-mono text-sm">
          {page > 1 ? (
            <Link href={`/leads${filtersToQuery(filters, { page: page - 1 })}`} className="hover:text-signal">← Précédent</Link>
          ) : <span />}
          <span className="text-muted tabular">{page} / {pages}</span>
          {page < pages ? (
            <Link href={`/leads${filtersToQuery(filters, { page: page + 1 })}`} className="hover:text-signal">Suivant →</Link>
          ) : <span />}
        </nav>
      )}
    </>
  );
}

import Link from "next/link";
import { ActivityChart, ScoreHistogram } from "@/components/Charts";
import { LeadRow } from "@/components/LeadRow";
import { SourceTag } from "@/components/LeadBits";
import { referenceNow, repo } from "@/lib/data";
import { timeAgo } from "@/lib/labels";
import { HOT_SCORE } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [stats, top] = await Promise.all([repo.stats(), repo.topLeads(8)]);
  const now = referenceNow();
  const today = new Date(now).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const sourceMax = Math.max(1, ...stats.bySource.map((s) => s.count));

  const kpis = [
    { label: "Leads chauds", value: stats.hot, tone: "text-signal", href: `/leads?min=${HOT_SCORE}` },
    { label: "Signaux · 7 j", value: stats.last7Days },
    { label: "Au total", value: stats.total },
    { label: "Contactés", value: stats.contacted },
    { label: "Gagnés", value: stats.won, tone: "text-cool" },
  ];

  return (
    <>
      <header className="pb-6 pt-10">
        <p className="text-sm first-letter:uppercase text-muted">{today}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tableau de bord</h1>
      </header>

      <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-5">
        {kpis.map((k) => {
          const value = <span className={`mt-1 block text-2xl font-semibold tabular ${k.tone ?? ""}`}>{k.value}</span>;
          return (
            <div key={k.label} className="border-b border-r border-line p-4 sm:border-b-0 sm:last:border-r-0">
              <dt className="text-xs text-muted">{k.label}</dt>
              <dd>
                {k.href ? (
                  <Link href={k.href} className="block rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-ink">
                    {value}
                  </Link>
                ) : (
                  value
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="grid gap-6 pt-6 lg:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="priority" className="overflow-hidden rounded-lg border border-line bg-surface lg:self-start">
          <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
            <h2 id="priority" className="text-sm font-semibold">À traiter en priorité</h2>
            <Link href="/leads" className="text-sm text-muted hover:text-ink">
              Tous les leads →
            </Link>
          </div>
          {top.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">
              Aucun lead pour l&apos;instant. Lance <code className="font-mono text-ink">uv run prospect run</code>.
            </p>
          ) : (
            <ol>
              {top.map((lead) => (
                <LeadRow key={lead.id} lead={lead} now={now} />
              ))}
            </ol>
          )}
        </section>

        <aside className="space-y-6">
          <section aria-labelledby="activity" className="rounded-lg border border-line bg-surface p-4">
            <h2 id="activity" className="mb-4 text-sm font-semibold">Signaux sur 14 jours</h2>
            <ActivityChart data={stats.byDay} />
          </section>

          <section aria-labelledby="scores" className="rounded-lg border border-line bg-surface p-4">
            <h2 id="scores" className="mb-4 text-sm font-semibold">Distribution des scores</h2>
            <ScoreHistogram data={stats.scoreBuckets} />
          </section>

          <section aria-labelledby="sources" className="rounded-lg border border-line bg-surface p-4">
            <h2 id="sources" className="mb-3 text-sm font-semibold">Sources</h2>
            <ul className="space-y-3">
              {stats.bySource.map((s) => {
                const run = stats.lastRuns.find((r) => r.source === s.source);
                const runInfo = run?.error ? <span className="text-signal">erreur</span> : run ? timeAgo(run.finishedAt, now) : "";
                return (
                  <li key={s.source}>
                    <Link href={`/leads?source=${s.source}`} className="group block">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <SourceTag source={s.source} />
                        <span className="text-xs tabular text-muted">
                          {runInfo}
                          <span className="ml-3 font-medium text-ink">{s.count}</span>
                        </span>
                      </div>
                      <span className="block h-1 overflow-hidden rounded-full bg-line">
                        <span
                          className="block h-full rounded-full opacity-70 transition-opacity group-hover:opacity-100"
                          style={{ width: `${(s.count / sourceMax) * 100}%`, background: `var(--src-${s.source})` }}
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}

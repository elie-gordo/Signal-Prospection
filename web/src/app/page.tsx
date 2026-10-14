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
    { label: "Signaux · 7 j", value: stats.last7Days },
    { label: "Au total", value: stats.total },
    { label: "Contactés", value: stats.contacted },
    { label: "Gagnés", value: stats.won, tone: "text-cool" },
  ];

  return (
    <>
      <section className="grid gap-8 border-b border-line pb-10 pt-12 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div className="rise">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-muted">{today}</p>
          <h1 className="font-display text-[clamp(2.75rem,1.6rem+4.6vw,5.5rem)] leading-[0.95] tracking-tight">
            <Link href={`/leads?min=${HOT_SCORE}`} className="text-signal decoration-2 underline-offset-8 hover:underline">
              {stats.hot} leads chauds
            </Link>
            <br />
            <span className="italic text-ink-soft">attendent une réponse.</span>
          </h1>
        </div>
        <dl className="rise grid grid-cols-2 border-t border-line" style={{ animationDelay: "80ms" }}>
          {kpis.map((k, i) => (
            <div key={k.label} className={`border-b border-line py-4 ${i % 2 === 0 ? "border-r pr-4" : "pl-4"}`}>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-muted">{k.label}</dt>
              <dd className={`mt-1 font-mono text-3xl font-semibold tabular ${k.tone ?? ""}`}>{k.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-12 pt-10 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="priority">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="priority" className="font-display text-3xl">À traiter en priorité</h2>
            <Link href="/leads" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
              Tous les leads →
            </Link>
          </div>
          {top.length === 0 ? (
            <p className="border-y border-dashed border-line py-10 text-center text-muted">
              Aucun lead pour l&apos;instant. Lance <code className="font-mono text-ink">uv run prospect run</code>.
            </p>
          ) : (
            <ol>
              {top.map((lead, i) => (
                <LeadRow key={lead.id} lead={lead} now={now} index={i} />
              ))}
            </ol>
          )}
        </section>

        <aside className="space-y-10">
          <section aria-labelledby="activity">
            <h2 id="activity" className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Signaux · 14 jours</h2>
            <ActivityChart data={stats.byDay} />
          </section>

          <section aria-labelledby="scores">
            <h2 id="scores" className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Distribution des scores</h2>
            <ScoreHistogram data={stats.scoreBuckets} />
          </section>

          <section aria-labelledby="sources">
            <h2 id="sources" className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Sources</h2>
            <ul className="space-y-2.5">
              {stats.bySource.map((s) => {
                const run = stats.lastRuns.find((r) => r.source === s.source);
                const runInfo = run?.error ? <span className="text-signal">erreur</span> : run ? timeAgo(run.finishedAt, now) : "";
                return (
                  <li key={s.source}>
                    <Link href={`/leads?source=${s.source}`} className="group block">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <SourceTag source={s.source} />
                        <span className="font-mono text-xs tabular text-muted">
                          {runInfo}
                          <span className="ml-3 text-ink">{s.count}</span>
                        </span>
                      </div>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-line">
                        <span
                          className="block h-full rounded-full opacity-80 transition-opacity group-hover:opacity-100"
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

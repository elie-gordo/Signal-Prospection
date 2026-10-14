import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreBadge, SourceTag, StatusPill } from "@/components/LeadBits";
import { referenceNow, repo } from "@/lib/data";
import { formatBudget, formatDate, formatEmployeeRange, SIGNAL_LABEL, timeAgo } from "@/lib/labels";
import type { LeadDetail, SiteAudit } from "@/lib/types";
import { safeUrl } from "@/lib/url";
import { StatusForm } from "./StatusForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function LeadPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const lead = await repo.getLead(id);
  if (!lead) notFound();
  const now = referenceNow();
  const externalUrl = safeUrl(lead.url);
  const budget = formatBudget(lead.budgetMin, lead.budgetMax);

  return (
    <article className="pt-10">
      <Link href="/leads" className="font-mono text-xs uppercase tracking-wider text-muted hover:text-ink">← Leads</Link>

      <header className="rise mt-6 grid gap-6 border-b border-line pb-8 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <SourceTag source={lead.source} />
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">{SIGNAL_LABEL[lead.signal]}</span>
            <StatusPill status={lead.status} />
          </div>
          <h1 className="font-display text-[clamp(2.25rem,1.5rem+3vw,4rem)] leading-[1] tracking-tight">{lead.title}</h1>
          <p className="mt-3 text-sm text-muted">
            Publié {timeAgo(lead.publishedAt, now)} · collecté {timeAgo(lead.collectedAt, now)}
            {budget && <> · <span className="font-mono text-ink">{budget}</span></>}
          </p>
        </div>
        <ScoreBadge score={lead.score} size="lg" />
      </header>

      <div className="grid gap-12 pt-10 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-12">
          <ScoreBreakdown lead={lead} />

          {lead.description && (
            <section aria-labelledby="desc">
              <h2 id="desc" className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Description</h2>
              <p className="max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{lead.description}</p>
              {externalUrl && (
                <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-signal underline-offset-4 hover:underline">
                  Voir l&apos;annonce d&apos;origine ↗
                </a>
              )}
            </section>
          )}

          {lead.company && <CompanyFacts company={lead.company} />}
          {lead.audit && <AuditPanel audit={lead.audit} />}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg border border-line bg-surface p-6 shadow-[0_1px_0_var(--line),0_12px_32px_-18px_rgb(0_0_0/0.25)]">
            <StatusForm id={lead.id} status={lead.status} notes={lead.notes} isReadOnly={repo.readOnly} />
          </div>
        </aside>
      </div>
    </article>
  );
}

function ScoreBreakdown({ lead }: { lead: LeadDetail }) {
  const positive = lead.scoreReasons.filter((r) => r.points > 0);
  const total = Math.max(1, positive.reduce((s, r) => s + r.points, 0));
  return (
    <section aria-labelledby="why">
      <h2 id="why" className="mb-4 font-display text-3xl">Pourquoi ce score</h2>
      <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-line" aria-hidden>
        {positive.map((r, i) => (
          <span
            key={r.label}
            className="h-full border-r-2 border-paper last:border-r-0"
            style={{
              width: `${(r.points / total) * 100}%`,
              background: `color-mix(in oklab, var(--signal) ${Math.max(25, 100 - i * 20)}%, var(--paper))`,
            }}
          />
        ))}
      </div>
      <ul className="divide-y divide-line border-y border-line">
        {lead.scoreReasons.map((r) => (
          <li key={r.label} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
            <span className="text-ink-soft">{r.label}</span>
            <span className={`font-mono tabular ${r.points < 0 ? "text-muted" : "text-ink"}`}>
              {r.points > 0 ? "+" : ""}{r.points}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// scraped value: only build a mailto: link from something that looks like a plain address
const isEmail = (v: string | null): v is string => !!v && /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(v);

function CompanyFacts({ company }: { company: NonNullable<LeadDetail["company"]> }) {
  const website = safeUrl(company.website);
  const websiteNode = website ? (
    <a href={website} target="_blank" rel="noopener noreferrer" className="text-signal underline-offset-4 hover:underline">
      {new URL(website).hostname}
      {company.websiteSource === "guessed" && <span className="ml-2 text-xs text-muted">(deviné)</span>}
    </a>
  ) : (
    <span className="text-signal">Aucun site trouvé</span>
  );
  const facts: [string, React.ReactNode][] = [
    ["Raison sociale", company.name],
    ["SIREN", company.siren && <span className="font-mono">{company.siren}</span>],
    ["Activité", company.nafLabel ?? company.activity],
    ["Code NAF", company.nafCode && <span className="font-mono">{company.nafCode}</span>],
    ["Dirigeant", company.directorName],
    ["Création", company.foundedOn && formatDate(company.foundedOn)],
    ["Effectif", formatEmployeeRange(company.employeeRange)],
    ["Adresse", company.address ?? [company.postalCode, company.city].filter(Boolean).join(" ")],
    ["Site web", websiteNode],
    ["Email", isEmail(company.email) && (
      <a href={`mailto:${company.email}`} className="font-mono text-signal underline-offset-4 hover:underline">{company.email}</a>
    )],
    ["Téléphone", company.phone && (
      <a href={`tel:${company.phone.replace(/[^\d+]/g, "")}`} className="font-mono text-signal underline-offset-4 hover:underline">
        {company.phone}
      </a>
    )],
  ];
  return (
    <section aria-labelledby="company">
      <h2 id="company" className="mb-4 font-display text-3xl">Entreprise</h2>
      <dl className="grid grid-cols-1 border-t border-line sm:grid-cols-2">
        {facts.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="border-b border-line py-3 sm:odd:pr-6">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">{k}</dt>
            <dd className="mt-0.5 text-sm">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AuditPanel({ audit }: { audit: SiteAudit }) {
  const metrics: [string, string, boolean][] = [
    ["HTTPS", audit.https ? "oui" : "non", audit.https === false],
    ["Chargement", audit.loadMs != null ? `${(audit.loadMs / 1000).toFixed(1)} s` : "—", (audit.loadMs ?? 0) > 3000],
    ["Poids", audit.pageWeightKb != null ? `${audit.pageWeightKb} ko` : "—", (audit.pageWeightKb ?? 0) > 3000],
    ["Mobile", audit.hasViewport ? "oui" : "non", audit.hasViewport === false],
    ["CMS", audit.cms ?? "inconnu", false],
    ["Copyright", audit.copyrightYear ? String(audit.copyrightYear) : "—", (audit.copyrightYear ?? 9999) < 2023],
  ];
  const scoreTone = audit.score < 50 ? "text-signal" : audit.score < 75 ? "text-warm" : "text-cool";
  return (
    <section aria-labelledby="audit">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 id="audit" className="font-display text-3xl">Audit du site</h2>
        <span className="font-mono text-sm tabular">
          <span className={scoreTone}>{audit.score}</span>
          <span className="text-muted">/100</span>
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-6">
        {metrics.map(([k, v, isBad]) => (
          <div key={k} className="bg-surface p-3">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">{k}</dt>
            <dd className={`mt-1 font-mono text-sm ${isBad ? "text-signal" : ""}`}>{v}</dd>
          </div>
        ))}
      </dl>
      {audit.issues.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {audit.issues.map((issue) => (
            <li key={issue.code} className="flex items-baseline gap-3 text-sm">
              <span className="font-mono text-xs text-signal tabular">−{issue.penalty}</span>
              <span className="text-ink-soft">{issue.label}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">Ces points font une accroche concrète pour le premier message.</p>
    </section>
  );
}

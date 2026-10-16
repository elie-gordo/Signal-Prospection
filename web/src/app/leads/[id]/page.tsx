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

const panelClass = "rounded-lg border border-line bg-surface p-5";
const headingClass = "text-base font-semibold";
const linkClass = "text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";

export default async function LeadPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const lead = await repo.getLead(id);
  if (!lead) notFound();
  const now = referenceNow();
  const externalUrl = safeUrl(lead.url);
  const budget = formatBudget(lead.budgetMin, lead.budgetMax);

  return (
    <article className="pt-8">
      <Link href="/leads" className="text-sm text-muted hover:text-ink">← Leads</Link>

      <header className="mt-4 grid gap-6 border-b border-line pb-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2.5">
            <SourceTag source={lead.source} />
            <span className="text-xs text-muted">{SIGNAL_LABEL[lead.signal]}</span>
            <StatusPill status={lead.status} />
          </div>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{lead.title}</h1>
          <p className="mt-2 text-sm text-muted">
            Publié {timeAgo(lead.publishedAt, now)} · collecté {timeAgo(lead.collectedAt, now)}
            {budget && <> · <span className="tabular text-ink">{budget}</span></>}
          </p>
        </div>
        <ScoreBadge score={lead.score} size="lg" />
      </header>

      <div className="grid gap-6 pt-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <ScoreBreakdown lead={lead} />

          {lead.description && (
            <section aria-labelledby="desc" className={panelClass}>
              <h2 id="desc" className={`mb-3 ${headingClass}`}>Description</h2>
              <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink-soft">{lead.description}</p>
              {externalUrl && (
                <a href={externalUrl} target="_blank" rel="noopener noreferrer" className={`mt-4 inline-block text-sm ${linkClass}`}>
                  Voir l&apos;annonce d&apos;origine ↗
                </a>
              )}
            </section>
          )}

          {lead.company && <CompanyFacts company={lead.company} />}
          {lead.audit && <AuditPanel audit={lead.audit} />}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className={panelClass}>
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
    <section aria-labelledby="why" className={panelClass}>
      <h2 id="why" className={`mb-4 ${headingClass}`}>Pourquoi ce score</h2>
      <div className="mb-4 flex h-2 overflow-hidden rounded-full bg-line" aria-hidden>
        {positive.map((r, i) => (
          <span
            key={r.label}
            className="h-full border-r-2 border-surface last:border-r-0"
            style={{
              width: `${(r.points / total) * 100}%`,
              background: `color-mix(in oklab, var(--ink) ${Math.max(20, 85 - i * 18)}%, var(--surface))`,
            }}
          />
        ))}
      </div>
      <ul className="divide-y divide-line">
        {lead.scoreReasons.map((r) => (
          <li key={r.label} className="flex items-baseline justify-between gap-4 py-2 text-sm">
            <span className="text-ink-soft">{r.label}</span>
            <span className={`font-medium tabular ${r.points < 0 ? "text-muted" : "text-ink"}`}>
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
    <a href={website} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {new URL(website).hostname}
      {company.websiteSource === "guessed" && <span className="ml-2 text-xs text-muted">(deviné)</span>}
    </a>
  ) : (
    <span className="text-signal">Aucun site trouvé</span>
  );
  const facts: [string, React.ReactNode][] = [
    ["Raison sociale", company.name],
    ["SIREN", company.siren && <span className="tabular">{company.siren}</span>],
    ["Activité", company.nafLabel ?? company.activity],
    ["Code NAF", company.nafCode],
    ["Dirigeant", company.directorName],
    ["Création", company.foundedOn && formatDate(company.foundedOn)],
    ["Effectif", formatEmployeeRange(company.employeeRange)],
    ["Adresse", company.address ?? [company.postalCode, company.city].filter(Boolean).join(" ")],
    ["Site web", websiteNode],
    ["Email", isEmail(company.email) && (
      <a href={`mailto:${company.email}`} className={linkClass}>{company.email}</a>
    )],
    ["Téléphone", company.phone && (
      <a href={`tel:${company.phone.replace(/[^\d+]/g, "")}`} className={`tabular ${linkClass}`}>
        {company.phone}
      </a>
    )],
  ];
  return (
    <section aria-labelledby="company" className={panelClass}>
      <h2 id="company" className={`mb-2 ${headingClass}`}>Entreprise</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6">
        {facts.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="border-b border-line py-2.5">
            <dt className="text-xs text-muted">{k}</dt>
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
    <section aria-labelledby="audit" className={panelClass}>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 id="audit" className={headingClass}>Audit du site</h2>
        <span className="text-sm font-medium tabular">
          <span className={scoreTone}>{audit.score}</span>
          <span className="text-muted">/100</span>
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-6">
        {metrics.map(([k, v, isBad]) => (
          <div key={k} className="bg-surface p-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className={`mt-1 text-sm font-medium tabular ${isBad ? "text-signal" : ""}`}>{v}</dd>
          </div>
        ))}
      </dl>
      {audit.issues.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {audit.issues.map((issue) => (
            <li key={issue.code} className="flex items-baseline gap-3 text-sm">
              <span className="w-8 shrink-0 text-right text-xs font-medium text-signal tabular">−{issue.penalty}</span>
              <span className="text-ink-soft">{issue.label}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted">Ces points font une accroche concrète pour le premier message.</p>
    </section>
  );
}

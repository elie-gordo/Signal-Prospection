import { SourceTag } from "@/components/LeadBits";
import type { Source } from "@/lib/types";

const PIPELINE = [
  { step: "01", title: "Collecter", body: "Chaque matin, des workers Python interrogent des sources publiques et dédupliquent par (source, id)." },
  { step: "02", title: "Enrichir", body: "Chaque SIREN est complété via l'API Recherche d'entreprises. Le site est cherché via un SearXNG local et retenu seulement s'il affiche le SIREN ou l'adresse." },
  { step: "03", title: "Auditer", body: "Le site est noté sur 100 (HTTPS, vitesse, poids, responsive, CMS, copyright figé) et ses contacts publics extraits." },
  { step: "04", title: "Scorer", body: "Un barème transparent additionne des raisons lisibles. Chaque point du score est justifié dans la fiche lead." },
  { step: "05", title: "Agir", body: "Les leads chauds remontent en tête ; le pipeline (qualifié, contacté, gagné) et les notes vivent dans le dashboard." },
];

const SOURCES_INFO: { source: Source; signal: string; how: string }[] = [
  { source: "bodacc", signal: "Entreprise créée cette semaine", how: "API open data BODACC (immatriculations)" },
  { source: "codeur", signal: "Projet web / IA publié", how: "Flux RSS public, filtré par mots-clés" },
];

const STACK = [
  ["Collecte", "Python 3.11, httpx, selectolax, SearXNG, Docker, pytest"],
  ["Données", "PostgreSQL 16, schéma partagé, upserts idempotents"],
  ["Interface", "Next.js 15 (App Router, Server Actions), TypeScript, Tailwind v4"],
];

export default function MethodPage() {
  return (
    <article className="pt-12">
      <header className="rise max-w-3xl border-b border-line pb-10">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-muted">Méthode</p>
        <h1 className="font-display text-[clamp(2.5rem,1.6rem+3.6vw,4.75rem)] leading-[0.98] tracking-tight">
          Prospecter au bon moment, <span className="italic text-signal">pas au hasard.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Signal détecte les entreprises qui ont un besoin <em>maintenant</em> : elles viennent d&apos;être créées, publient un
          projet ou ont un site qui les dessert. Chaque lead arrive avec la raison pour laquelle il mérite un message.
        </p>
      </header>

      <section aria-labelledby="pipeline" className="py-12">
        <h2 id="pipeline" className="mb-8 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Pipeline</h2>
        <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          {PIPELINE.map((p, i) => (
            <li key={p.step} className="rise bg-surface p-6" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="font-mono text-xs text-signal">{p.step}</span>
              <h3 className="mt-2 font-display text-2xl">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{p.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="sources" className="grid gap-10 border-t border-line py-12 lg:grid-cols-[1fr_2fr]">
        <div>
          <h2 id="sources" className="font-display text-3xl">Sources de signaux</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Uniquement des données publiques et ouvertes : open data et flux publiés par les plateformes.
          </p>
        </div>
        <ul className="divide-y divide-line border-y border-line">
          {SOURCES_INFO.map((s) => (
            <li key={s.source} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr_1fr] sm:gap-6">
              <SourceTag source={s.source} />
              <span className="text-sm">{s.signal}</span>
              <span className="font-mono text-xs text-muted">{s.how}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="stack" className="grid gap-10 border-t border-line py-12 lg:grid-cols-[1fr_2fr]">
        <h2 id="stack" className="font-display text-3xl">Stack</h2>
        <dl className="grid gap-6 sm:grid-cols-3">
          {STACK.map(([k, v]) => (
            <div key={k}>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-muted">{k}</dt>
              <dd className="mt-1 text-sm leading-relaxed">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}

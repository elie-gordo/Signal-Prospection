// Fictional demo dataset for the public portfolio build. Every name, SIREN and URL is invented.
import type { Company, LeadDetail, LeadStatus, ScoreReason, SiteAudit, Source } from "../types";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(1337);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const CITIES = [
  ["75011", "Paris"], ["75018", "Paris"], ["92100", "Boulogne-Billancourt"], ["93100", "Montreuil"],
  ["94300", "Vincennes"], ["69003", "Lyon"], ["13006", "Marseille"], ["33000", "Bordeaux"], ["44000", "Nantes"],
] as const;

const BUSINESSES = [
  ["Atelier", "47.78C", "Commerce de détail d'articles de décoration"],
  ["Boulangerie", "10.71C", "Boulangerie et pâtisserie artisanale"],
  ["Bistrot", "56.10A", "Restauration traditionnelle"],
  ["Salon", "96.02A", "Coiffure"],
  ["Institut", "96.02B", "Soins de beauté"],
  ["Cave", "47.25Z", "Commerce de détail de boissons"],
  ["Studio", "93.13Z", "Activités des centres de culture physique"],
  ["Plomberie", "43.22A", "Travaux d'installation d'eau et de gaz"],
  ["Fleuriste", "47.76Z", "Commerce de détail de fleurs"],
  ["Épicerie fine", "47.29Z", "Autres commerces de détail alimentaires"],
  ["Cabinet", "86.90E", "Activités des professionnels de la rééducation"],
] as const;

const NAMES = ["Lumen", "Verveine", "Calypso", "Les Tilleuls", "Mistral", "Opaline", "Basalte", "Sauge", "Ocre",
  "Le Comptoir", "Nacre", "Ardoise", "Figue", "Rivage", "Cèdre", "Sirocco", "Alma", "Pivoine", "Gravier", "Hublot"];
const FIRST = ["Camille", "Inès", "Hugo", "Nora", "Léo", "Yasmine", "Théo", "Clara", "Malik", "Jeanne", "Sacha", "Lina"];
const LAST = ["Moreau", "Benali", "Lefèvre", "Garnier", "Diallo", "Roux", "Fontaine", "Marchand", "Perrin", "Laurent"];

const PROJECTS = [
  ["Refonte site vitrine WordPress pour cabinet d'architectes", "site", 1000, 10000],
  ["Boutique Shopify pour marque de cosmétiques bio", "ecommerce", 1000, 10000],
  ["Automatiser la relance de devis avec n8n", "automation", 500, 1000],
  ["Chatbot IA pour répondre aux clients d'une agence immobilière", "ai", 1000, 10000],
  ["Landing page pour lancement d'application mobile", "site", 500, 1000],
  ["Connecter notre CRM HubSpot à notre outil de facturation via API", "automation", 1000, 10000],
  ["Scraping de fiches produits fournisseurs + import catalogue", "automation", 500, 1000],
  ["Site e-commerce Next.js headless avec paiement Stripe", "ecommerce", 10000, 30000],
  ["Dashboard interne de suivi commercial", "site", 1000, 10000],
  ["Génération automatique de fiches produits avec l'IA", "ai", 500, 1000],
  ["Migration Wix vers WordPress + SEO", "site", 500, 1000],
] as const;

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);

let companySeq = 1;
let leadSeq = 1;

function company(overrides: Partial<Company> = {}): Company {
  const [kind, naf, label] = pick(BUSINESSES);
  const [cp, city] = pick(CITIES);
  const name = `${kind} ${pick(NAMES)}`;
  return {
    id: companySeq++,
    siren: String(900_000_000 + int(0, 99_999_999)),
    name,
    nafCode: naf,
    nafLabel: label,
    activity: label,
    address: `${int(1, 120)} rue ${pick(["des Lilas", "Oberkampf", "de la Paix", "Victor Hugo", "du Marché", "Jean Jaurès"])} ${cp} ${city}`,
    postalCode: cp,
    city,
    foundedOn: new Date(NOW - int(3, 900) * DAY).toISOString().slice(0, 10),
    employeeRange: pick(["0 salarié", "1 ou 2 salariés", "3 à 5 salariés", "6 à 9 salariés"]),
    directorName: `${pick(FIRST)} ${pick(LAST)}`,
    website: null,
    websiteSource: null,
    email: null,
    phone: null,
    ...overrides,
  };
}

function audit(url: string): SiteAudit {
  const issues: SiteAudit["issues"] = [];
  const https = rand() > 0.35;
  const loadMs = int(600, 7200);
  const hasViewport = rand() > 0.4;
  const copyrightYear = rand() > 0.5 ? int(2014, 2021) : 2026;
  if (!https) issues.push({ code: "no_https", label: "Pas de HTTPS", penalty: 25 });
  if (loadMs > 3000) issues.push({ code: "slow", label: `Chargement lent (${(loadMs / 1000).toFixed(1)} s)`, penalty: loadMs > 5000 ? 25 : 15 });
  if (!hasViewport) issues.push({ code: "no_viewport", label: "Pas responsive (meta viewport absente)", penalty: 25 });
  if (copyrightYear < 2023) issues.push({ code: "stale", label: `Copyright figé en ${copyrightYear}`, penalty: 10 });
  const score = Math.max(0, 100 - issues.reduce((s, i) => s + i.penalty, 0));
  return {
    url, reachable: true, statusCode: 200, https, loadMs, pageWeightKb: int(300, 6500), hasViewport,
    cms: pick(["WordPress", "Wix", "Joomla", null, "Shopify"]), copyrightYear, score, issues,
    checkedAt: new Date(NOW - int(0, 5) * DAY).toISOString(),
  };
}

const STATUS_POOL: LeadStatus[] = ["new", "new", "new", "new", "new", "qualified", "qualified", "contacted", "replied", "won", "lost", "ignored"];

function finalize(reasons: ScoreReason[]): { score: number; scoreReasons: ScoreReason[] } {
  const score = Math.max(0, Math.min(100, reasons.reduce((s, r) => s + r.points, 0)));
  return { score, scoreReasons: reasons };
}

function bodaccLead(): LeadDetail {
  const c = company({ foundedOn: new Date(NOW - int(1, 25) * DAY).toISOString().slice(0, 10), employeeRange: "0 salarié" });
  const hasSite = rand() > 0.7;
  const site = hasSite ? `https://${c.name.toLowerCase().normalize("NFD").replace(/[^a-z]+/g, "-")}.example` : null;
  const a = site ? audit(site) : null;
  const contacts = site
    ? { email: `contact@${new URL(site).hostname}`, phone: `01 99 00 ${int(10, 99)} ${int(10, 99)}` } // ARCEP fiction range
    : { email: null, phone: null };
  const reasons: ScoreReason[] = [
    { label: "Nouvelle activité immatriculée", points: 25 },
    { label: `Secteur cible (NAF ${c.nafCode})`, points: 20 },
  ];
  if (!site) reasons.push({ label: "Aucun site web trouvé", points: 25 });
  else if (a && a.score < 50) reasons.push({ label: `Site faible (audit ${a.score}/100)`, points: 20 });
  else if (a && a.score < 75) reasons.push({ label: `Site perfectible (audit ${a.score}/100)`, points: 10 });
  if (site) reasons.push({ label: "Contactable (email ou téléphone)", points: 10 });
  reasons.push({ label: "Créée il y a moins de 30 jours", points: 10 });
  const published = NOW - int(0, 13) * DAY - int(0, 20) * 3_600_000;
  return {
    id: leadSeq++, source: "bodacc", signal: "new_company", title: c.name, description: c.activity,
    url: null, budgetMin: null, budgetMax: null, ...finalize(reasons), status: pick(STATUS_POOL), notes: null,
    publishedAt: new Date(published).toISOString(), collectedAt: new Date(published + 3_600_000).toISOString(),
    company: { ...c, website: site, websiteSource: site ? "search" : null, ...contacts }, audit: a,
  };
}

function codeurLead(): LeadDetail {
  const [title, kind, min, max] = pick(PROJECTS);
  const hours = int(1, 24 * 10);
  const reasons: ScoreReason[] = [{ label: "Projet publié", points: 40 }];
  reasons.push(kind === "automation" || kind === "ai" ? { label: "Automatisation / IA", points: 20 } : { label: "Site / e-commerce", points: 15 });
  if (max >= 5000) reasons.push({ label: `Budget jusqu'à ${max.toLocaleString("fr-FR")} €`, points: 20 });
  else if (max >= 1000) reasons.push({ label: `Budget jusqu'à ${max.toLocaleString("fr-FR")} €`, points: 10 });
  if (hours < 24) reasons.push({ label: "Publié il y a moins de 24 h", points: 10 });
  if (hours > 24 * 7) reasons.push({ label: "Publié il y a plus de 7 jours", points: -15 });
  const published = NOW - hours * 3_600_000;
  return {
    id: leadSeq++, source: "codeur", signal: "project_posted", title,
    description: `Nous cherchons un prestataire pour : ${title.toLowerCase()}. Démarrage rapide souhaité, échanges en visio.`,
    url: `https://example.com/projects/${400000 + leadSeq}`, budgetMin: min, budgetMax: max, ...finalize(reasons),
    status: pick(STATUS_POOL), notes: null, publishedAt: new Date(published).toISOString(),
    collectedAt: new Date(published + 1_800_000).toISOString(), company: null, audit: null,
  };
}

const BUILDERS: [Source, () => LeadDetail, number][] = [
  ["bodacc", bodaccLead, 70], ["codeur", codeurLead, 40],
];

export const DEMO_NOW = NOW;
export const DEMO_LEADS: LeadDetail[] = BUILDERS.flatMap(([, build, n]) => Array.from({ length: n }, build));

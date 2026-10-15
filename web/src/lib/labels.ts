import type { LeadStatus, Signal, Source } from "./types";

export const SOURCE_LABEL: Record<Source, string> = {
  bodacc: "BODACC",
  codeur: "Codeur",
};

export const SIGNAL_LABEL: Record<Signal, string> = {
  new_company: "Nouvelle entreprise",
  project_posted: "Projet publié",
};

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Nouveau",
  qualified: "Qualifié",
  contacted: "Contacté",
  replied: "A répondu",
  won: "Gagné",
  lost: "Perdu",
  ignored: "Ignoré",
};

// INSEE "tranche d'effectif salarié" codes
const EMPLOYEE_RANGE: Record<string, string> = {
  NN: "Non renseigné", "00": "0 salarié", "01": "1 ou 2 salariés", "02": "3 à 5 salariés", "03": "6 à 9 salariés",
  "11": "10 à 19 salariés", "12": "20 à 49 salariés", "21": "50 à 99 salariés", "22": "100 à 199 salariés",
  "31": "200 à 249 salariés", "32": "250 à 499 salariés", "41": "500 à 999 salariés", "42": "1 000 à 1 999 salariés",
  "51": "2 000 à 4 999 salariés", "52": "5 000 à 9 999 salariés", "53": "10 000 salariés et plus",
};

export const formatEmployeeRange = (v: string | null): string | null => (v ? (EMPLOYEE_RANGE[v] ?? v) : null);

const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return "—";
  const minutes = Math.round((Date.parse(iso) - now) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

const eur = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function formatBudget(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${eur.format(min)} – ${eur.format(max)} €`;
  if (max != null) return `< ${eur.format(max)} €`;
  return `> ${eur.format(min as number)} €`;
}

import { SIGNALS, SOURCES, STATUSES, type LeadFilters } from "./types";

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

function oneOf<T extends string>(allowed: readonly T[], v: string | undefined): T | undefined {
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

function boundedInt(v: string | undefined, min: number, max: number): number | undefined {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}

export function parseFilters(params: Params): LeadFilters {
  return {
    source: oneOf(SOURCES, one(params.source)),
    signal: oneOf(SIGNALS, one(params.signal)),
    status: oneOf(STATUSES, one(params.status)),
    minScore: boundedInt(one(params.min), 1, 100),
    q: one(params.q)?.slice(0, 100),
    page: boundedInt(one(params.page), 1, 10_000) ?? 1,
  };
}

export function filtersToQuery(f: LeadFilters, overrides: Partial<LeadFilters> = {}): string {
  const merged = { ...f, ...overrides };
  const qs = new URLSearchParams();
  if (merged.source) qs.set("source", merged.source);
  if (merged.signal) qs.set("signal", merged.signal);
  if (merged.status) qs.set("status", merged.status);
  if (merged.minScore) qs.set("min", String(merged.minScore));
  if (merged.q) qs.set("q", merged.q);
  if (merged.page && merged.page > 1) qs.set("page", String(merged.page));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

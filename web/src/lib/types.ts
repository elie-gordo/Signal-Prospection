export const SOURCES = ["bodacc", "codeur"] as const;
export type Source = (typeof SOURCES)[number];

export const SIGNALS = ["new_company", "project_posted"] as const;
export type Signal = (typeof SIGNALS)[number];

export const STATUSES = ["new", "qualified", "contacted", "replied", "won", "lost", "ignored"] as const;
export type LeadStatus = (typeof STATUSES)[number];

export type ScoreReason = { label: string; points: number };
export type AuditIssue = { code: string; label: string; penalty: number };

export type Company = {
  id: number;
  siren: string | null;
  name: string;
  nafCode: string | null;
  nafLabel: string | null;
  activity: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  foundedOn: string | null;
  employeeRange: string | null;
  directorName: string | null;
  website: string | null;
  websiteSource: string | null;
  email: string | null;
  phone: string | null;
};

export type SiteAudit = {
  url: string;
  reachable: boolean;
  statusCode: number | null;
  https: boolean | null;
  loadMs: number | null;
  pageWeightKb: number | null;
  hasViewport: boolean | null;
  cms: string | null;
  copyrightYear: number | null;
  score: number;
  issues: AuditIssue[];
  checkedAt: string;
};

export type Lead = {
  id: number;
  source: Source;
  signal: Signal;
  title: string;
  description: string | null;
  url: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  score: number;
  scoreReasons: ScoreReason[];
  status: LeadStatus;
  notes: string | null;
  publishedAt: string | null;
  collectedAt: string;
  company: Company | null;
};

export type LeadDetail = Lead & { audit: SiteAudit | null };

export type LeadFilters = {
  source?: Source;
  signal?: Signal;
  status?: LeadStatus;
  minScore?: number;
  q?: string;
  page?: number;
};

export type DashboardStats = {
  total: number;
  last7Days: number;
  hot: number; // score >= 70
  contacted: number;
  won: number;
  bySource: { source: Source; count: number }[];
  byDay: { day: string; count: number }[]; // last 14 days, ISO date
  scoreBuckets: { bucket: number; count: number }[]; // 0,10,..,90
  lastRuns: { source: Source; finishedAt: string | null; inserted: number; error: string | null }[];
};

export interface LeadRepository {
  readonly readOnly: boolean;
  listLeads(filters: LeadFilters): Promise<{ leads: Lead[]; total: number }>;
  getLead(id: number): Promise<LeadDetail | null>;
  topLeads(limit: number): Promise<Lead[]>;
  stats(): Promise<DashboardStats>;
  updateLead(id: number, patch: { status?: LeadStatus; notes?: string }): Promise<void>;
}

export const PAGE_SIZE = 25;
export const HOT_SCORE = 70;

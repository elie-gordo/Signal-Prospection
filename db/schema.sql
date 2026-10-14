-- Signal-based prospecting schema. Shared by workers (Python) and web (Next.js).

CREATE TABLE IF NOT EXISTS companies (
  id              BIGSERIAL PRIMARY KEY,
  siren           TEXT UNIQUE,
  name            TEXT NOT NULL,
  naf_code        TEXT,
  naf_label       TEXT,
  activity        TEXT,
  address         TEXT,
  postal_code     TEXT,
  city            TEXT,
  department      TEXT,
  founded_on      DATE,
  employee_range  TEXT,
  director_name   TEXT,
  website         TEXT,
  website_source  TEXT,              -- 'source' | 'guessed' | 'manual'
  phone           TEXT,
  email           TEXT,
  enriched_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_audits (
  id              BIGSERIAL PRIMARY KEY,
  company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  reachable       BOOLEAN NOT NULL,
  status_code     INT,
  https           BOOLEAN,
  load_ms         INT,
  page_weight_kb  INT,
  has_viewport    BOOLEAN,
  cms             TEXT,
  copyright_year  INT,
  title           TEXT,
  score           INT NOT NULL,      -- 0 (terrible) .. 100 (great)
  issues          JSONB NOT NULL DEFAULT '[]',
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_audits_company_idx ON site_audits (company_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS leads (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL,     -- 'bodacc' | 'codeur' | 'wttj' | 'pagesjaunes' | 'malt'
  external_id     TEXT NOT NULL,
  signal          TEXT NOT NULL,     -- 'new_company' | 'project_posted' | 'hiring' | 'weak_website'
  title           TEXT NOT NULL,
  description     TEXT,
  url             TEXT,
  budget_min      INT,
  budget_max      INT,
  company_id      BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  score           INT NOT NULL DEFAULT 0,
  score_reasons   JSONB NOT NULL DEFAULT '[]',   -- [{label, points}]
  status          TEXT NOT NULL DEFAULT 'new',   -- new | qualified | contacted | replied | won | lost | ignored
  notes           TEXT,
  published_at    TIMESTAMPTZ,
  collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw             JSONB,
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS leads_score_idx ON leads (score DESC);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);
CREATE INDEX IF NOT EXISTS leads_published_idx ON leads (published_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              BIGSERIAL PRIMARY KEY,
  lead_id         BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL DEFAULT 'email',
  subject         TEXT,
  body            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft', -- draft | approved | sent
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v2: website discovery + contact extraction tracking (idempotent, applied by `prospect migrate`)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contacts_checked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS collector_runs (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  fetched         INT NOT NULL DEFAULT 0,
  inserted        INT NOT NULL DEFAULT 0,
  error           TEXT
);

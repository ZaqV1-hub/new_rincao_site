BEGIN;

CREATE TABLE IF NOT EXISTS chargeback_cases (
  id SERIAL PRIMARY KEY,
  establishment_number VARCHAR(10) NOT NULL,
  id_chargeback VARCHAR(20) NOT NULL,
  id_case VARCHAR(20) NOT NULL,
  payload JSONB NOT NULL,
  purchase_id INTEGER NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','retry','exception','rejected','submitting','uncertain','submitted','resolved','remote_done')),
  issue TEXT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ NULL,
  receipt JSONB NULL,
  lifecycle JSONB NULL,
  result_message TEXT NULL,
  alert_key TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (establishment_number, id_chargeback)
);
CREATE INDEX IF NOT EXISTS chargeback_cases_work ON chargeback_cases (next_attempt_at, status);
CREATE INDEX IF NOT EXISTS chargeback_cases_purchase ON chargeback_cases (purchase_id);

CREATE TABLE IF NOT EXISTS chargeback_events (
  id BIGSERIAL PRIMARY KEY,
  event_key VARCHAR(64) UNIQUE NOT NULL,
  kind TEXT NOT NULL,
  establishment_number VARCHAR(10) NOT NULL,
  id_case VARCHAR(20) NOT NULL,
  processed_at TIMESTAMPTZ NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE chargeback_events ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chargeback_events ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE chargeback_events ADD COLUMN IF NOT EXISTS alert_sent BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS chargeback_events_pending ON chargeback_events (id) WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS chargeback_dossiers (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES chargeback_cases(id),
  snapshot JSONB NOT NULL,
  pdf BYTEA NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  snapshot_hash VARCHAR(64) NOT NULL,
  policy_version VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, sha256, snapshot_hash, policy_version),
  UNIQUE (id, case_id),
  CHECK (octet_length(pdf) <= 8000000)
);
ALTER TABLE chargeback_cases ADD COLUMN IF NOT EXISTS submitted_dossier_id INTEGER;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chargeback_submitted_dossier_case_fk' AND conrelid='chargeback_cases'::regclass) THEN
    ALTER TABLE chargeback_cases ADD CONSTRAINT chargeback_submitted_dossier_case_fk
      FOREIGN KEY (submitted_dossier_id, id) REFERENCES chargeback_dossiers(id, case_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS chargeback_reconciliation (
  id INTEGER PRIMARY KEY CHECK (id=1),
  phase TEXT NOT NULL CHECK (phase IN ('PENDING','DONE')),
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  cycle_end DATE NOT NULL,
  page INTEGER NOT NULL DEFAULT 0 CHECK (page>=0),
  completed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;

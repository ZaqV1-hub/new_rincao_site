BEGIN;

CREATE TABLE IF NOT EXISTS purchase_batches (
  id UUID PRIMARY KEY,
  parque TEXT NOT NULL CHECK (parque IN ('rincao','estancia')),
  idempotency_key VARCHAR(100) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  actor_cpf CHAR(11) NOT NULL,
  actor_name TEXT,
  command JSONB NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (parque,idempotency_key)
);
CREATE TABLE IF NOT EXISTS purchase_adjustments (
  id UUID PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES purchase_batches(id),
  parque TEXT NOT NULL CHECK (parque IN ('rincao','estancia')),
  purchase_id BIGINT NOT NULL REFERENCES compra(idcompra),
  source_dates DATE[] NOT NULL,
  before_snapshot JSONB NOT NULL,
  requested_change JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  resolved_at TIMESTAMPTZ,
  resolution JSONB,
  CHECK ((status='pending' AND resolved_at IS NULL AND resolution IS NULL) OR
    (status<>'pending' AND resolved_at IS NOT NULL AND resolution IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS purchase_adjustments_pending ON purchase_adjustments(parque,purchase_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS purchase_adjustments_dates ON purchase_adjustments USING GIN(source_dates);

-- Separate outbox: legacy email consumers must not retry an uncertain SMTP dispatch.
CREATE TABLE IF NOT EXISTS purchase_batch_email (
  id UUID PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES purchase_batches(id),
  purchase_id BIGINT NOT NULL REFERENCES compra(idcompra),
  destination TEXT NOT NULL,
  material_snapshot JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dispatching','accepted','failed','unknown')),
  dispatch_started_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(batch_id,purchase_id)
);
COMMENT ON TABLE purchase_adjustments IS 'Pending changes never overwrite a closed cash/day snapshot. Resolution requires the explicit operational adjustment workflow.';
COMMENT ON TABLE purchase_batch_email IS 'Private destination and immutable notice content. Accepted means SMTP acceptance, not delivery. Unknown dispatches must not be retried automatically.';

COMMIT;

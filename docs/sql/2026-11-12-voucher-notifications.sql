BEGIN;

-- Private dispatch journal. No historical deliveries are inferred or backfilled.
CREATE TABLE IF NOT EXISTS voucher_notification_requests (
  request_id UUID PRIMARY KEY,
  parque TEXT NOT NULL CHECK (parque IN ('rincao','estancia')),
  idempotency_key VARCHAR(100) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  purchase_id BIGINT NOT NULL REFERENCES compra(idcompra),
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel='whatsapp'),
  voucher_ids BIGINT[] NOT NULL CHECK (cardinality(voucher_ids) BETWEEN 1 AND 1000),
  destination TEXT NOT NULL CHECK (destination ~ '^[0-9]{11,15}$'),
  destination_confirmed BOOLEAN NOT NULL CHECK (destination_confirmed),
  actor_name TEXT,
  actor_cpf TEXT NOT NULL CHECK (actor_cpf ~ '^[0-9]{11}$'),
  material_snapshot JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','dispatching','accepted','queued','failed','unknown')),
  dispatch_started_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (parque,idempotency_key),
  CHECK (status <> 'dispatching' OR (dispatch_started_at IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK (lease_expires_at IS NULL OR dispatch_started_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS voucher_notifications_purchase ON voucher_notification_requests(parque,purchase_id,created_at DESC);
CREATE INDEX IF NOT EXISTS voucher_notifications_dispatching ON voucher_notification_requests(lease_expires_at) WHERE status='dispatching';
COMMENT ON TABLE voucher_notification_requests IS 'Private destination and audit snapshot. API projects masked destination only; expired dispatches become unknown and must never be reclaimed.';

COMMIT;

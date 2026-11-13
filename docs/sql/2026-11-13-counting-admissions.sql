CREATE TABLE IF NOT EXISTS contagem_entradas (
  parque TEXT NOT NULL CHECK (parque IN ('rincao','estancia')),
  idempotency_key VARCHAR(100) NOT NULL,
  actor_cpf VARCHAR(11) NOT NULL CHECK (actor_cpf ~ '^[0-9]{11}$'),
  request_hash CHAR(64) NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(parque,idempotency_key)
);

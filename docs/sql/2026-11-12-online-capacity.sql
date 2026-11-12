-- New managed day-use purchases only. No historical quota/backfill.
CREATE TABLE IF NOT EXISTS online_capacity_reservations (
  idcompra BIGINT PRIMARY KEY REFERENCES compra(idcompra),
  parque TEXT NOT NULL CHECK (parque IN ('rincao','estancia')),
  data DATE NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  attempt_started_at TIMESTAMPTZ,
  delivery_hold BOOLEAN NOT NULL DEFAULT FALSE,
  hold_reason TEXT,
  CHECK (delivery_hold = (hold_reason IS NOT NULL)),
  FOREIGN KEY (parque,data) REFERENCES operacao_dias(parque,data)
);
CREATE INDEX IF NOT EXISTS online_capacity_reservations_day ON online_capacity_reservations(parque,data);

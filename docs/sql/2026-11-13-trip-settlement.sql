BEGIN;

ALTER TABLE passeio_operacao
  ADD COLUMN IF NOT EXISTS financial_version INTEGER NOT NULL DEFAULT 1 CHECK(financial_version>0),
  ADD COLUMN IF NOT EXISTS adult_price_cents BIGINT CHECK(adult_price_cents BETWEEN 0 AND 9999999999),
  ADD COLUMN IF NOT EXISTS child_price_cents BIGINT CHECK(child_price_cents BETWEEN 0 AND 9999999999),
  ADD COLUMN IF NOT EXISTS adult_courtesies INTEGER NOT NULL DEFAULT 0 CHECK(adult_courtesies BETWEEN 0 AND 100000),
  ADD COLUMN IF NOT EXISTS child_courtesies INTEGER NOT NULL DEFAULT 0 CHECK(child_courtesies BETWEEN 0 AND 100000),
  ADD COLUMN IF NOT EXISTS finalized_receipt_id UUID;

CREATE TABLE IF NOT EXISTS passeio_participantes (
  parque TEXT NOT NULL, agenda_id INTEGER NOT NULL, cliente_id INTEGER NOT NULL,
  voucher_id INTEGER NOT NULL REFERENCES voucher(idvoucher),
  category TEXT CHECK(category IN ('adult','child','coordinator','pcdChild','pcdAdult','pcdCompanion','teacherChild','exempt')),
  refund_requested BOOLEAN NOT NULL DEFAULT false,
  refund_paid_cents BIGINT CHECK(refund_paid_cents BETWEEN 0 AND 9999999999),
  refund_reference VARCHAR(200), refund_paid_at TIMESTAMPTZ, refund_method TEXT CHECK(refund_method IN ('dinhe','pix','trans','credi','debit')),
  refund_period_id INTEGER REFERENCES caixa_periodos(id),
  updated_by VARCHAR(11) NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(parque,voucher_id),
  FOREIGN KEY(parque,agenda_id,cliente_id) REFERENCES passeio_operacao(parque,agenda_id,cliente_id),
  CHECK((refund_paid_at IS NULL)=(refund_paid_cents IS NULL)),
  CHECK(refund_paid_at IS NULL OR (refund_requested AND refund_reference IS NOT NULL AND length(trim(refund_reference))>0))
);
CREATE TABLE IF NOT EXISTS passeio_recebimentos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parque TEXT NOT NULL, agenda_id INTEGER NOT NULL, cliente_id INTEGER NOT NULL,
  method VARCHAR(5) NOT NULL CHECK(method IN ('dinhe','pix','trans','bolet','credi','debit')),
  amount_cents BIGINT NOT NULL CHECK(amount_cents BETWEEN 1 AND 9999999999),
  tendered_cents BIGINT NOT NULL CHECK(tendered_cents BETWEEN 1 AND 9999999999),
  change_cents BIGINT NOT NULL DEFAULT 0 CHECK(change_cents>=0),
  status TEXT NOT NULL CHECK(status IN ('pending','confirmed','cancelled')),
  payment_date DATE NOT NULL,
  period_id INTEGER REFERENCES caixa_periodos(id), reference VARCHAR(200),
  actor_cpf VARCHAR(11) NOT NULL, actor_name VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), confirmed_at TIMESTAMPTZ,
  FOREIGN KEY(parque,agenda_id,cliente_id) REFERENCES passeio_operacao(parque,agenda_id,cliente_id),
  CHECK(tendered_cents-change_cents=amount_cents),
  CHECK(method='dinhe' OR change_cents=0),
  CHECK((method='dinhe')=(period_id IS NOT NULL)),
  CHECK(status<>'pending' OR method='bolet'),
  CHECK((status='confirmed')=(confirmed_at IS NOT NULL)),
  CHECK(status<>'confirmed' OR method='dinhe' OR (reference IS NOT NULL AND length(trim(reference))>0))
);
CREATE INDEX IF NOT EXISTS passeio_recebimentos_trip ON passeio_recebimentos(parque,agenda_id,cliente_id,id);
CREATE INDEX IF NOT EXISTS passeio_recebimentos_date ON passeio_recebimentos(parque,payment_date,id);
CREATE INDEX IF NOT EXISTS passeio_recebimentos_period ON passeio_recebimentos(period_id,id) WHERE period_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS passeio_recebimento_estornos (
  payment_id BIGINT PRIMARY KEY REFERENCES passeio_recebimentos(id),
  parque TEXT NOT NULL CHECK(parque IN ('rincao','estancia')),
  payment_date DATE NOT NULL, period_id INTEGER REFERENCES caixa_periodos(id),
  reference VARCHAR(200) NOT NULL CHECK(length(trim(reference))>0),
  reason VARCHAR(1000) NOT NULL CHECK(length(trim(reason))>0),
  actor_cpf VARCHAR(11) NOT NULL, actor_name VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS passeio_recibos (
  id UUID PRIMARY KEY,
  number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  parque TEXT NOT NULL, agenda_id INTEGER NOT NULL, cliente_id INTEGER NOT NULL,
  visit_date DATE NOT NULL, source_fingerprint CHAR(64) NOT NULL,
  snapshot JSONB NOT NULL,
  actor_cpf VARCHAR(11) NOT NULL, actor_name VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(parque,agenda_id,cliente_id) REFERENCES passeio_operacao(parque,agenda_id,cliente_id),
  UNIQUE(parque,agenda_id,cliente_id,id)
);
CREATE INDEX IF NOT EXISTS passeio_recibos_date ON passeio_recibos(parque,visit_date,number);
CREATE TABLE IF NOT EXISTS passeio_recibo_revisoes (
  receipt_id UUID PRIMARY KEY REFERENCES passeio_recibos(id),
  reason VARCHAR(1000) NOT NULL CHECK(length(trim(reason))>0),
  actor_cpf VARCHAR(11) NOT NULL, actor_name VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='passeio_operacao'::regclass AND conname='passeio_current_receipt_fk') THEN
    ALTER TABLE passeio_operacao ADD CONSTRAINT passeio_current_receipt_fk FOREIGN KEY(parque,agenda_id,cliente_id,finalized_receipt_id)
      REFERENCES passeio_recibos(parque,agenda_id,cliente_id,id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS operacao_despesas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parque TEXT NOT NULL CHECK(parque IN ('rincao','estancia')), visit_date DATE NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('day','trips')),
  agenda_id INTEGER, cliente_id INTEGER,
  description VARCHAR(300) NOT NULL CHECK(length(trim(description))>0),
  category TEXT NOT NULL CHECK(category IN ('monitoria','alimentacao','transporte','atividades','materiais','outros')),
  amount_cents BIGINT NOT NULL CHECK(amount_cents BETWEEN 1 AND 9999999999),
  method TEXT NOT NULL CHECK(method IN ('dinhe','pix','company_card')),
  period_id INTEGER REFERENCES caixa_periodos(id),
  reference VARCHAR(200) NOT NULL CHECK(length(trim(reference))>0),
  actor_cpf VARCHAR(11) NOT NULL, actor_name VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(parque,agenda_id,cliente_id) REFERENCES passeio_operacao(parque,agenda_id,cliente_id),
  CHECK((agenda_id IS NULL)=(cliente_id IS NULL)),
  CHECK(agenda_id IS NULL OR scope='trips'),
  CHECK((method='dinhe')=(period_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS operacao_despesas_date ON operacao_despesas(parque,visit_date,id);
CREATE TABLE IF NOT EXISTS financeiro_comandos (
  id UUID PRIMARY KEY,
  parque TEXT NOT NULL CHECK(parque IN ('rincao','estancia')),
  idempotency_key VARCHAR(100) NOT NULL,
  action VARCHAR(30) NOT NULL, request_hash CHAR(64) NOT NULL,
  actor_cpf VARCHAR(11) NOT NULL, result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(parque,idempotency_key)
);
CREATE OR REPLACE FUNCTION protect_trip_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR OLD.status<>'pending' OR
    ROW(NEW.parque,NEW.agenda_id,NEW.cliente_id,NEW.method,NEW.amount_cents,NEW.tendered_cents,NEW.change_cents,NEW.period_id,NEW.actor_cpf,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.parque,OLD.agenda_id,OLD.cliente_id,OLD.method,OLD.amount_cents,OLD.tendered_cents,OLD.change_cents,OLD.period_id,OLD.actor_cpf,OLD.created_at) THEN
    RAISE EXCEPTION 'payment_history_immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_trip_payment ON passeio_recebimentos;
CREATE TRIGGER protect_trip_payment BEFORE UPDATE OR DELETE ON passeio_recebimentos FOR EACH ROW EXECUTE FUNCTION protect_trip_payment();
CREATE OR REPLACE FUNCTION protect_trip_financial_artifact() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'financial_artifact_immutable' USING ERRCODE='23514';
END $$;
DO $$
DECLARE target TEXT;
BEGIN
  FOREACH target IN ARRAY ARRAY['passeio_recibos','passeio_recibo_revisoes','passeio_recebimento_estornos','operacao_despesas','financeiro_comandos'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS financial_artifact_immutable ON %I',target);
    EXECUTE format('CREATE TRIGGER financial_artifact_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION protect_trip_financial_artifact()',target);
  END LOOP;
END $$;
COMMIT;

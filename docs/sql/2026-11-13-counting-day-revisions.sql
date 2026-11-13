CREATE TABLE IF NOT EXISTS contagem_dias (
 parque TEXT NOT NULL CHECK(parque IN ('rincao','estancia')),
 data DATE NOT NULL,
 estado TEXT NOT NULL DEFAULT 'open' CHECK(estado IN ('open','closed')),
 versao INTEGER NOT NULL DEFAULT 0 CHECK(versao>=0),
 revision_id UUID,
 PRIMARY KEY(parque,data)
);
CREATE TABLE IF NOT EXISTS contagem_dia_revisoes (
 id UUID PRIMARY KEY,
 parque TEXT NOT NULL,
 data DATE NOT NULL,
 versao INTEGER NOT NULL CHECK(versao>0),
 snapshot JSONB NOT NULL,
 actor_cpf VARCHAR(11) NOT NULL,
 actor_name VARCHAR(160),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(parque,data,versao),
 FOREIGN KEY(parque,data) REFERENCES contagem_dias(parque,data)
);
CREATE TABLE IF NOT EXISTS contagem_dia_comandos (
 parque TEXT NOT NULL,
 idempotency_key VARCHAR(100) NOT NULL,
 actor_cpf VARCHAR(11) NOT NULL,
 request_hash CHAR(64) NOT NULL,
 result JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(parque,idempotency_key)
);
CREATE OR REPLACE FUNCTION protect_count_day_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'count_day_history_immutable' USING ERRCODE='23514'; END $$;
DROP TRIGGER IF EXISTS protect_count_day_revision ON contagem_dia_revisoes;
CREATE TRIGGER protect_count_day_revision BEFORE UPDATE OR DELETE ON contagem_dia_revisoes FOR EACH ROW EXECUTE FUNCTION protect_count_day_revision();

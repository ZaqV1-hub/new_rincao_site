BEGIN;
ALTER TABLE operacao_dias ALTER COLUMN tabela_preco_id DROP NOT NULL;
CREATE TABLE IF NOT EXISTS operacao_fechamentos (
  id UUID PRIMARY KEY,
  parque TEXT NOT NULL CHECK(parque IN ('rincao','estancia')),
  data DATE NOT NULL,
  revisao INTEGER NOT NULL CHECK(revisao>0),
  snapshot JSONB NOT NULL,
  source_fingerprint CHAR(64) NOT NULL,
  motivo TEXT NOT NULL,
  actor_cpf VARCHAR(11) NOT NULL,
  actor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(parque,data,revisao),UNIQUE(parque,data,id)
);
ALTER TABLE operacao_dias ADD COLUMN IF NOT EXISTS fechamento_id UUID;
ALTER TABLE operacao_dias DROP CONSTRAINT IF EXISTS operacao_dias_fechamento_fk;
ALTER TABLE operacao_dias ADD CONSTRAINT operacao_dias_fechamento_fk FOREIGN KEY(parque,data,fechamento_id) REFERENCES operacao_fechamentos(parque,data,id);
CREATE TABLE IF NOT EXISTS operacao_reaberturas (
  id UUID PRIMARY KEY,
  fechamento_id UUID NOT NULL UNIQUE REFERENCES operacao_fechamentos(id),
  motivo TEXT NOT NULL CHECK(btrim(motivo)<>''),
  actor_cpf VARCHAR(11) NOT NULL,actor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS financial_artifact_immutable ON operacao_fechamentos;
CREATE TRIGGER financial_artifact_immutable BEFORE UPDATE OR DELETE ON operacao_fechamentos FOR EACH ROW EXECUTE FUNCTION protect_trip_financial_artifact();
DROP TRIGGER IF EXISTS financial_artifact_immutable ON operacao_reaberturas;
CREATE TRIGGER financial_artifact_immutable BEFORE UPDATE OR DELETE ON operacao_reaberturas FOR EACH ROW EXECUTE FUNCTION protect_trip_financial_artifact();
COMMIT;

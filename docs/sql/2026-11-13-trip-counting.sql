BEGIN;

CREATE TABLE IF NOT EXISTS contagem_catalogos (
  versao INTEGER PRIMARY KEY CHECK (versao>0),
  definicao JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO contagem_catalogos(versao,definicao) VALUES(1,
  '{"adult":{"label":"Adulto","minAge":10},"child":{"label":"Criança","minAge":4,"maxAge":9},"exempt":{"label":"Isento","maxAge":3},"coordinator":{"label":"Professor / coordenador"},"pcdChild":{"label":"Criança PCD"},"pcdAdult":{"label":"Adulto PCD"},"pcdCompanion":{"label":"Acompanhante PCD"},"teacherChild":{"label":"Filho de professor"}}'::jsonb)
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS passeio_contagens (
  id UUID PRIMARY KEY,
  parque TEXT NOT NULL,
  vehicle_id BIGINT NOT NULL,
  catalog_version INTEGER NOT NULL REFERENCES contagem_catalogos(versao),
  status TEXT NOT NULL CHECK (status IN ('draft','completed','abandoned')),
  owner_cpf VARCHAR(11) CHECK (owner_cpf ~ '^[0-9]{11}$'),
  owner_name VARCHAR(160),
  counts JSONB NOT NULL,
  pcd_details JSONB NOT NULL DEFAULT '[]',
  notes VARCHAR(2000) NOT NULL DEFAULT '',
  responsible_name VARCHAR(160) NOT NULL DEFAULT '',
  responsible_phone VARCHAR(15) NOT NULL DEFAULT '',
  contact_confirmed BOOLEAN NOT NULL DEFAULT false,
  previous_revision UUID REFERENCES passeio_contagens(id),
  created_by VARCHAR(11) NOT NULL CHECK (created_by ~ '^[0-9]{11}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ,
  UNIQUE(parque,vehicle_id,id),
  FOREIGN KEY(parque,vehicle_id) REFERENCES passeio_veiculos(parque,id) ON DELETE RESTRICT,
  CHECK ((status='completed')=(completed_at IS NOT NULL)),
  CHECK (status<>'completed' OR (owner_cpf IS NOT NULL AND contact_confirmed AND length(responsible_name)>1 AND responsible_phone ~ '^[0-9]{11,15}$'))
);
CREATE UNIQUE INDEX IF NOT EXISTS passeio_contagens_active ON passeio_contagens(parque,vehicle_id) WHERE status='draft';
CREATE TABLE IF NOT EXISTS contagem_assinaturas (
  revision_id UUID PRIMARY KEY REFERENCES passeio_contagens(id) ON DELETE RESTRICT,
  png BYTEA NOT NULL CHECK (octet_length(png) BETWEEN 1 AND 262144),
  sha256 CHAR(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  width INTEGER NOT NULL CHECK (width>=3),
  height INTEGER NOT NULL CHECK (height>=3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK(width::bigint*height<=1000000)
);
ALTER TABLE passeio_veiculos ADD COLUMN IF NOT EXISTS current_count_id UUID;
ALTER TABLE passeio_veiculos ADD COLUMN IF NOT EXISTS last_completed_count_id UUID;
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='passeio_veiculos'::regclass AND conname='vehicle_current_count_fk') THEN
    ALTER TABLE passeio_veiculos ADD CONSTRAINT vehicle_current_count_fk FOREIGN KEY(parque,id,current_count_id) REFERENCES passeio_contagens(parque,vehicle_id,id) ON DELETE RESTRICT;
    ALTER TABLE passeio_veiculos ADD CONSTRAINT vehicle_completed_count_fk FOREIGN KEY(parque,id,last_completed_count_id) REFERENCES passeio_contagens(parque,vehicle_id,id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS contagem_comandos (
  id UUID PRIMARY KEY,
  parque TEXT NOT NULL CHECK(parque IN ('rincao','estancia')),
  idempotency_key VARCHAR(100) NOT NULL,
  action VARCHAR(20) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  actor_cpf VARCHAR(11) NOT NULL CHECK(actor_cpf ~ '^[0-9]{11}$'),
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(parque,idempotency_key)
);
CREATE OR REPLACE FUNCTION protect_completed_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR OLD.status='completed' THEN
    RAISE EXCEPTION 'count_history_immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_completed_count ON passeio_contagens;
CREATE TRIGGER protect_completed_count BEFORE UPDATE OR DELETE ON passeio_contagens FOR EACH ROW EXECUTE FUNCTION protect_completed_count();
CREATE OR REPLACE FUNCTION protect_count_artifact() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'count_artifact_immutable' USING ERRCODE='23514';
END $$;
DROP TRIGGER IF EXISTS protect_count_signature ON contagem_assinaturas;
CREATE TRIGGER protect_count_signature BEFORE UPDATE OR DELETE ON contagem_assinaturas FOR EACH ROW EXECUTE FUNCTION protect_count_artifact();
DROP TRIGGER IF EXISTS protect_count_catalog ON contagem_catalogos;
CREATE TRIGGER protect_count_catalog BEFORE UPDATE OR DELETE ON contagem_catalogos FOR EACH ROW EXECUTE FUNCTION protect_count_artifact();
COMMENT ON TABLE contagem_assinaturas IS 'Private PNG signatures. Serve only through an authenticated, authorized and audited no-store route. Never publish as uploads.';

COMMIT;

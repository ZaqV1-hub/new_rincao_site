-- M4: one canonical trip/vehicle source shared by programming, counting and settlement.
CREATE TABLE IF NOT EXISTS programacoes_dia (
  parque TEXT NOT NULL CHECK (parque IN ('rincao','estancia')),
  data DATE NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1 CHECK (versao > 0),
  exported_revision INTEGER CHECK (exported_revision > 0 AND exported_revision <= versao),
  exported_at TIMESTAMPTZ,
  exported_fingerprint VARCHAR(64) CHECK (exported_fingerprint ~ '^[a-f0-9]{64}$'),
  export_id BIGINT,
  observacoes VARCHAR(2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parque,data),
  CHECK ((exported_revision IS NULL) = (exported_at IS NULL))
);
CREATE TABLE IF NOT EXISTS transportadores (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parque TEXT NOT NULL CHECK (parque IN ('rincao','estancia')),
  nome VARCHAR(160) NOT NULL CHECK (length(trim(nome)) > 0),
  contato VARCHAR(160), telefone VARCHAR(40),
  UNIQUE (parque,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS transportadores_nome ON transportadores (parque,lower(nome));
CREATE TABLE IF NOT EXISTS passeio_operacao (
  parque TEXT NOT NULL CHECK (parque IN ('rincao','estancia')),
  agenda_id INTEGER NOT NULL,
  cliente_id INTEGER NOT NULL,
  planned_people INTEGER CHECK (planned_people BETWEEN 0 AND 100000),
  contato VARCHAR(160), telefone VARCHAR(40),
  transport_mode TEXT NOT NULL DEFAULT 'unset' CHECK (transport_mode IN ('unset','client','carrier')),
  carrier_id BIGINT,
  carrier_contact VARCHAR(160), carrier_phone VARCHAR(40),
  carrier_contact_override BOOLEAN NOT NULL DEFAULT false,
  boarding_time VARCHAR(5) CHECK (boarding_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  observacoes VARCHAR(2000),
  vehicle_plan_defined BOOLEAN NOT NULL DEFAULT false,
  updated_by VARCHAR(11),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parque,agenda_id,cliente_id),
  FOREIGN KEY (agenda_id,cliente_id) REFERENCES agenda_extras(idagenda,idcliente) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (parque,carrier_id) REFERENCES transportadores(parque,id) ON DELETE RESTRICT,
  CHECK ((transport_mode = 'carrier') = (carrier_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS passeio_veiculos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parque TEXT NOT NULL,
  agenda_id INTEGER NOT NULL,
  cliente_id INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('bus','van')),
  planned_people INTEGER CHECK (planned_people BETWEEN 0 AND 100000),
  estado TEXT NOT NULL DEFAULT 'waiting' CHECK (estado IN ('waiting','counting','completed')),
  versao INTEGER NOT NULL DEFAULT 1 CHECK (versao > 0),
  added_on_day BOOLEAN NOT NULL DEFAULT false,
  created_by VARCHAR(11),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (parque,agenda_id,cliente_id) REFERENCES passeio_operacao(parque,agenda_id,cliente_id) ON DELETE RESTRICT,
  UNIQUE (parque,id)
);
CREATE INDEX IF NOT EXISTS passeio_veiculos_trip ON passeio_veiculos(parque,agenda_id,cliente_id);
CREATE TABLE IF NOT EXISTS programacao_contratacao_catalogo (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parque TEXT NOT NULL CHECK (parque IN ('rincao','estancia')),
  nome VARCHAR(160) NOT NULL CHECK (length(trim(nome)) > 0),
  ordem INTEGER NOT NULL DEFAULT 100,
  UNIQUE (parque,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS programacao_contratacao_nome ON programacao_contratacao_catalogo(parque,lower(nome));
INSERT INTO programacao_contratacao_catalogo (parque,nome,ordem)
SELECT parque,nome,ordem FROM (VALUES ('rincao'),('estancia')) p(parque)
CROSS JOIN (VALUES ('Escala monitoria',1),('Portaria',2),('Enfermaria',3),('Cantor',4),
 ('Equipe de tirolesa',5),('Equipe de piscina',6),('Manutenção',7),('Sacolão e padaria',8),('Vai acender a caldeira?',9)) i(nome,ordem)
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS programacao_contratacoes (
  parque TEXT NOT NULL, data DATE NOT NULL, item_id BIGINT NOT NULL, valor VARCHAR(500),
  PRIMARY KEY (parque,data,item_id),
  FOREIGN KEY (parque,data) REFERENCES programacoes_dia(parque,data) ON DELETE RESTRICT,
  FOREIGN KEY (parque,item_id) REFERENCES programacao_contratacao_catalogo(parque,id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS programacao_exportacoes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parque TEXT NOT NULL,
  data DATE NOT NULL,
  versao INTEGER NOT NULL CHECK (versao > 0),
  fingerprint VARCHAR(64) NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_name VARCHAR(255), actor_cpf VARCHAR(11),
  FOREIGN KEY (parque,data) REFERENCES programacoes_dia(parque,data) ON DELETE RESTRICT,
  UNIQUE (parque,data,versao,fingerprint)
);

BEGIN;

CREATE TABLE IF NOT EXISTS operacao_dias (
  parque TEXT NOT NULL CHECK (parque IN ('rincao', 'estancia')),
  data DATE NOT NULL,
  tabela_preco_id INTEGER NOT NULL REFERENCES tabpreco (idtabpreco),
  day_use_agenda_id INTEGER REFERENCES agenda (idagenda),
  validade TEXT NOT NULL DEFAULT 'day' CHECK (validade IN ('day', '7_days', '30_days', '6_months')),
  limite_online INTEGER CHECK (limite_online >= 0),
  tipos_ingresso JSONB NOT NULL DEFAULT '["norma", "infan", "isent"]'::jsonb
    CHECK (jsonb_typeof(tipos_ingresso) = 'array'),
  estado TEXT NOT NULL DEFAULT 'open' CHECK (estado IN ('open', 'closed')),
  versao INTEGER NOT NULL DEFAULT 1 CHECK (versao > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (parque, data)
);

CREATE TABLE IF NOT EXISTS servicos_adicionais (
  id BIGSERIAL PRIMARY KEY,
  parque TEXT NOT NULL CHECK (parque IN ('rincao', 'estancia')),
  nome VARCHAR(120) NOT NULL CHECK (btrim(nome) <> ''),
  descricao VARCHAR(1000) NOT NULL DEFAULT '',
  preco_site NUMERIC(12, 2) CHECK (preco_site BETWEEN 0 AND 9999999999.99),
  preco_bilheteria NUMERIC(12, 2) NOT NULL CHECK (preco_bilheteria BETWEEN 0 AND 9999999999.99),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  versao INTEGER NOT NULL DEFAULT 1 CHECK (versao > 0),
  legacy_product_id TEXT,
  legacy_ticket_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parque, id),
  UNIQUE (parque, legacy_product_id),
  UNIQUE (parque, legacy_ticket_id)
);

CREATE TABLE IF NOT EXISTS servico_datas (
  parque TEXT NOT NULL,
  data DATE NOT NULL,
  servico_id BIGINT NOT NULL,
  PRIMARY KEY (parque, data, servico_id),
  FOREIGN KEY (parque, servico_id) REFERENCES servicos_adicionais (parque, id)
);
CREATE INDEX IF NOT EXISTS servico_datas_por_servico ON servico_datas (parque, servico_id);

CREATE TABLE IF NOT EXISTS caixa_locais (
  id BIGSERIAL PRIMARY KEY,
  parque TEXT NOT NULL CHECK (parque IN ('rincao', 'estancia')),
  nome VARCHAR(120) NOT NULL CHECK (btrim(nome) <> ''),
  descricao VARCHAR(1000) NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  versao INTEGER NOT NULL DEFAULT 1 CHECK (versao > 0),
  tipo TEXT NOT NULL DEFAULT 'sales' CHECK (tipo IN ('sales', 'trips')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parque, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS caixa_locais_nome_por_parque ON caixa_locais (parque, LOWER(nome));

COMMIT;

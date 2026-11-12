BEGIN;

-- Null scope identifies legacy records; do not infer historical locations from timestamps.
ALTER TABLE caixa_periodos
  ADD COLUMN IF NOT EXISTS parque TEXT,
  ADD COLUMN IF NOT EXISTS data_operacional DATE,
  ADD COLUMN IF NOT EXISTS local_id BIGINT,
  ADD COLUMN IF NOT EXISTS local_nome VARCHAR(120),
  ADD COLUMN IF NOT EXISTS tipo TEXT,
  ADD COLUMN IF NOT EXISTS troco_inicial NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS aberto_por_cpf VARCHAR(11),
  ADD COLUMN IF NOT EXISTS fechado_por_nome VARCHAR(120),
  ADD COLUMN IF NOT EXISTS fechado_por_cpf VARCHAR(11),
  ADD COLUMN IF NOT EXISTS contado NUMERIC(12,2);

ALTER TABLE compra ADD COLUMN IF NOT EXISTS caixa_periodo_id INTEGER;
ALTER TABLE compra_pagamentos
  ADD COLUMN IF NOT EXISTS periodo_id INTEGER,
  ADD COLUMN IF NOT EXISTS recebido_em TIMESTAMPTZ;
ALTER TABLE movimentacao_caixa
  ADD COLUMN IF NOT EXISTS periodo_id INTEGER,
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS ator_nome VARCHAR(120),
  ADD COLUMN IF NOT EXISTS ator_cpf VARCHAR(11),
  ADD COLUMN IF NOT EXISTS origem_tipo TEXT,
  ADD COLUMN IF NOT EXISTS origem_id BIGINT;
ALTER TABLE voucher
  ADD COLUMN IF NOT EXISTS validacao_periodo_id INTEGER,
  ADD COLUMN IF NOT EXISTS validado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validado_por_nome VARCHAR(120),
  ADD COLUMN IF NOT EXISTS validado_por_cpf VARCHAR(11);
ALTER TABLE caixa_fechamentos ADD COLUMN IF NOT EXISTS modelo_operacional BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='caixa_periodos'::regclass AND conname='caixa_periodos_escopo_check') THEN
    ALTER TABLE caixa_periodos ADD CONSTRAINT caixa_periodos_escopo_check CHECK (
      (parque IS NULL AND data_operacional IS NULL AND local_id IS NULL AND local_nome IS NULL AND tipo IS NULL AND troco_inicial IS NULL)
      OR (parque IS NOT NULL AND parque IN ('rincao','estancia') AND data_operacional IS NOT NULL AND local_id IS NOT NULL AND local_nome IS NOT NULL
        AND tipo IS NOT NULL AND tipo IN ('sales','trips') AND troco_inicial IS NOT NULL AND troco_inicial>=0)
    );
    ALTER TABLE caixa_periodos ADD CONSTRAINT caixa_periodos_contado_check CHECK (contado IS NULL OR contado>=0);
    ALTER TABLE caixa_periodos ADD CONSTRAINT caixa_periodos_local_fk FOREIGN KEY (parque,local_id) REFERENCES caixa_locais(parque,id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='compra'::regclass AND conname='compra_caixa_periodo_fk') THEN
    ALTER TABLE compra ADD CONSTRAINT compra_caixa_periodo_fk FOREIGN KEY (caixa_periodo_id) REFERENCES caixa_periodos(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='compra_pagamentos'::regclass AND conname='compra_pagamentos_periodo_fk') THEN
    ALTER TABLE compra_pagamentos ADD CONSTRAINT compra_pagamentos_periodo_fk FOREIGN KEY (periodo_id) REFERENCES caixa_periodos(id);
    ALTER TABLE compra_pagamentos ADD CONSTRAINT compra_pagamentos_recebido_check CHECK (periodo_id IS NULL OR recebido_em IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='movimentacao_caixa'::regclass AND conname='movimentacao_caixa_periodo_fk') THEN
    ALTER TABLE movimentacao_caixa ADD CONSTRAINT movimentacao_caixa_periodo_fk FOREIGN KEY (periodo_id) REFERENCES caixa_periodos(id);
    ALTER TABLE movimentacao_caixa ADD CONSTRAINT movimentacao_caixa_origem_check CHECK ((origem_tipo IS NULL)=(origem_id IS NULL));
    ALTER TABLE movimentacao_caixa ADD CONSTRAINT movimentacao_caixa_tipo_operacional_check CHECK (periodo_id IS NULL OR tipo IN ('fundo','sangria','despesa','devolucao'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='voucher'::regclass AND conname='voucher_validacao_periodo_fk') THEN
    ALTER TABLE voucher ADD CONSTRAINT voucher_validacao_periodo_fk FOREIGN KEY (validacao_periodo_id) REFERENCES caixa_periodos(id);
    ALTER TABLE voucher ADD CONSTRAINT voucher_validacao_instante_check CHECK (validacao_periodo_id IS NULL OR validado_em IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='caixa_fechamentos'::regclass AND conname='caixa_fechamentos_operacional_check') THEN
    ALTER TABLE caixa_fechamentos ADD CONSTRAINT caixa_fechamentos_operacional_check CHECK (NOT modelo_operacional OR periodo_id IS NOT NULL);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS caixa_periodos_aberto_por_local ON caixa_periodos(parque,data_operacional,local_id) WHERE fechado_em IS NULL AND local_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS caixa_periodos_por_data ON caixa_periodos(parque,data_operacional,id);
CREATE INDEX IF NOT EXISTS compra_por_caixa ON compra(caixa_periodo_id) WHERE caixa_periodo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS compra_pagamentos_por_caixa ON compra_pagamentos(periodo_id,id) WHERE periodo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS movimentacao_por_caixa ON movimentacao_caixa(periodo_id,id) WHERE periodo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS movimentacao_origem_unica ON movimentacao_caixa(origem_tipo,origem_id) WHERE origem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS voucher_por_caixa_validacao ON voucher(validacao_periodo_id) WHERE validacao_periodo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS caixa_fechamentos_periodo_operacional ON caixa_fechamentos(periodo_id) WHERE modelo_operacional;

CREATE TABLE IF NOT EXISTS caixa_operacoes (
  parque TEXT NOT NULL CHECK (parque IN ('rincao','estancia')),
  acao TEXT NOT NULL,
  chave VARCHAR(100) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  periodo_id INTEGER NOT NULL REFERENCES caixa_periodos(id),
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parque,acao,chave)
);

COMMIT;

CREATE TABLE IF NOT EXISTS contagem_compartilhamentos (
  id UUID PRIMARY KEY,
  parque TEXT NOT NULL,
  revision_id UUID NOT NULL REFERENCES passeio_contagens(id) ON DELETE RESTRICT,
  actor_cpf VARCHAR(11) NOT NULL CHECK(actor_cpf ~ '^[0-9]{11}$'),
  actor_name VARCHAR(160),
  action TEXT NOT NULL CHECK(action IN ('opened','declared')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS contagem_compartilhamentos_revision ON contagem_compartilhamentos(parque,revision_id,created_at DESC);

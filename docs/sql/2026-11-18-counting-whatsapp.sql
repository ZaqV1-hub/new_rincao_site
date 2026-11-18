CREATE TABLE IF NOT EXISTS contagem_whatsapp_envios (
  parque TEXT NOT NULL,
  revision_id UUID NOT NULL REFERENCES passeio_contagens(id) ON DELETE RESTRICT,
  actor_cpf VARCHAR(11) NOT NULL CHECK(actor_cpf ~ '^[0-9]{11}$'),
  recipient VARCHAR(13) NOT NULL CHECK(recipient ~ '^55[0-9]{10,11}$'),
  status TEXT NOT NULL CHECK(status IN ('sending','accepted','failed','uncertain')),
  pages INTEGER NOT NULL CHECK(pages BETWEEN 1 AND 100),
  provider_ids JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(provider_ids)='array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(parque,revision_id)
);

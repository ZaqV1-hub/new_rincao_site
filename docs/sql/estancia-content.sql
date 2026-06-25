-- Estrutura sugerida para levar o gerenciamento do Estancia para o banco.
-- No ambiente local desta entrega, o painel grava em .data/estancia-content.json.

CREATE TABLE IF NOT EXISTS estancia_home_images (
  id text PRIMARY KEY,
  desktop_src text NOT NULL,
  mobile_src text NOT NULL,
  alt text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS estancia_attractions (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_src text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS estancia_events (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_src text NOT NULL,
  href text NOT NULL DEFAULT '/agenda',
  button_label text NOT NULL DEFAULT 'Compre seu ingresso!',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS estancia_products (
  id text PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('passport', 'addon')),
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  image_src text NOT NULL,
  fixed_price numeric(10,2) NOT NULL DEFAULT 0,
  voucher_type text NOT NULL DEFAULT 'norma' CHECK (voucher_type IN ('norma', 'infan', 'espec')),
  voucher_prefix text NOT NULL DEFAULT 'A',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS estancia_agenda_products (
  id bigserial PRIMARY KEY,
  agenda_id integer NOT NULL,
  product_id text NOT NULL REFERENCES estancia_products(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agenda_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_estancia_home_images_order
  ON estancia_home_images (active, sort_order);

CREATE INDEX IF NOT EXISTS idx_estancia_attractions_order
  ON estancia_attractions (active, sort_order);

CREATE INDEX IF NOT EXISTS idx_estancia_events_order
  ON estancia_events (active, sort_order);

CREATE INDEX IF NOT EXISTS idx_estancia_products_type_order
  ON estancia_products (type, active, sort_order);

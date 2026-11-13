BEGIN;

ALTER TABLE passeio_operacao ADD COLUMN IF NOT EXISTS food_notes VARCHAR(2000);
ALTER TABLE passeio_veiculos ADD COLUMN IF NOT EXISTS carrier_id BIGINT;
ALTER TABLE passeio_veiculos ADD COLUMN IF NOT EXISTS ordinal INTEGER;
ALTER TABLE passeio_veiculos ADD COLUMN IF NOT EXISTS is_extra BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE passeio_contagens ADD COLUMN IF NOT EXISTS draft_saved_at TIMESTAMPTZ;
ALTER TABLE passeio_contagens ADD COLUMN IF NOT EXISTS document_context JSONB;

WITH ordinals AS (
  SELECT id, row_number() OVER (PARTITION BY parque,agenda_id,cliente_id,tipo ORDER BY id)::integer AS ordinal
  FROM passeio_veiculos
)
UPDATE passeio_veiculos v SET ordinal=o.ordinal FROM ordinals o WHERE v.id=o.id AND v.ordinal IS NULL;

-- Old programming also used added_on_day. Only counting commands prove an extra vehicle.
UPDATE passeio_veiculos v SET is_extra=true
WHERE NOT v.is_extra AND EXISTS (
  SELECT 1 FROM contagem_comandos c WHERE c.parque=v.parque AND c.action='add' AND c.result->>'vehicleId'=v.id::text
);

ALTER TABLE passeio_veiculos ALTER COLUMN ordinal SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS passeio_veiculos_trip_type_ordinal
  ON passeio_veiculos(parque,agenda_id,cliente_id,tipo,ordinal);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='passeio_veiculos'::regclass AND conname='passeio_veiculos_carrier_fk') THEN
    ALTER TABLE passeio_veiculos ADD CONSTRAINT passeio_veiculos_carrier_fk
      FOREIGN KEY(parque,carrier_id) REFERENCES transportadores(parque,id) ON DELETE RESTRICT;
    ALTER TABLE passeio_veiculos ADD CONSTRAINT passeio_veiculos_ordinal_positive CHECK (ordinal > 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION assign_trip_vehicle_ordinal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM passeio_operacao WHERE parque=NEW.parque AND agenda_id=NEW.agenda_id AND cliente_id=NEW.cliente_id FOR UPDATE;
  SELECT COALESCE(max(ordinal),0)+1 INTO NEW.ordinal FROM passeio_veiculos
    WHERE parque=NEW.parque AND agenda_id=NEW.agenda_id AND cliente_id=NEW.cliente_id AND tipo=NEW.tipo;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS assign_trip_vehicle_ordinal ON passeio_veiculos;
CREATE TRIGGER assign_trip_vehicle_ordinal BEFORE INSERT ON passeio_veiculos
  FOR EACH ROW EXECUTE FUNCTION assign_trip_vehicle_ordinal();

INSERT INTO contagem_catalogos(versao,definicao)
SELECT 2, definicao || '{"pcdTypes":["Física","Visual","Auditiva","Intelectual","TEA (autismo)","Múltipla","Outra"]}'::jsonb
FROM contagem_catalogos WHERE versao=1 ON CONFLICT DO NOTHING;

COMMIT;

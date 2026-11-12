BEGIN;

ALTER TABLE voucher ADD COLUMN IF NOT EXISTS dtinicio_validade DATE;
ALTER TABLE voucher ADD COLUMN IF NOT EXISTS parque_operacional TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'voucher'::regclass AND conname = 'voucher_operational_validity_check'
  ) THEN
    ALTER TABLE voucher ADD CONSTRAINT voucher_operational_validity_check CHECK (
      (dtinicio_validade IS NULL AND parque_operacional IS NULL)
      OR (
        dtinicio_validade IS NOT NULL
        AND parque_operacional IS NOT NULL
        AND parque_operacional IN ('rincao', 'estancia')
        AND dtvalidade IS NOT NULL
        AND dtvalidade >= dtinicio_validade
      )
    );
  END IF;
END $$;

COMMENT ON COLUMN voucher.dtinicio_validade IS
  'Inicio inclusivo da validade operacional vendida; NULL preserva a politica legada.';
COMMENT ON COLUMN voucher.parque_operacional IS
  'Parque do snapshot de validade. Nao recalcular usando a configuracao atual da agenda.';

COMMIT;

BEGIN;

ALTER TABLE voucher ADD COLUMN IF NOT EXISTS servico_id BIGINT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='voucher_operational_service_fk' AND conrelid='voucher'::regclass) THEN
    ALTER TABLE voucher ADD CONSTRAINT voucher_operational_service_fk
      FOREIGN KEY (parque_operacional,servico_id) REFERENCES servicos_adicionais (parque,id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='voucher_operational_service_check' AND conrelid='voucher'::regclass) THEN
    ALTER TABLE voucher ADD CONSTRAINT voucher_operational_service_check
      CHECK (servico_id IS NULL OR (parque_operacional IS NOT NULL AND tpvoucher IS NOT NULL AND tpvoucher='espec'));
  END IF;
END $$;
COMMENT ON COLUMN voucher.servico_id IS 'Serviço operacional vendido; descrição e preço históricos permanecem no voucher.';

COMMIT;

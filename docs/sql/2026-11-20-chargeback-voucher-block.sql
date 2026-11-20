BEGIN;
-- NULL identifies rows predating this migration. Only previously closed issuer losses are deferred.
ALTER TABLE chargeback_cases ADD COLUMN IF NOT EXISTS voucher_block_enabled boolean;
UPDATE chargeback_cases SET voucher_block_enabled=NOT (
  status='resolved' AND lower(trim(coalesce(result_message,'')))='a favor do emissor'
) WHERE voucher_block_enabled IS NULL;
ALTER TABLE chargeback_cases ALTER COLUMN voucher_block_enabled SET DEFAULT true,
  ALTER COLUMN voucher_block_enabled SET NOT NULL;
ALTER TABLE chargeback_cases ADD COLUMN IF NOT EXISTS invalidated_vouchers INTEGER[];
ALTER TABLE chargeback_cases ADD COLUMN IF NOT EXISTS voucher_block_completed_at TIMESTAMPTZ;

-- Preserve historical use and prevent a later reissue or manual undo from reopening admission.
CREATE OR REPLACE FUNCTION guard_issuer_loss_voucher() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM chargeback_cases WHERE purchase_id=NEW.idcompra AND invalidated_vouchers IS NOT NULL)
  THEN RAISE EXCEPTION 'Ingresso bloqueado por decisão final da contestação.' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS issuer_loss_voucher_guard ON voucher;
CREATE TRIGGER issuer_loss_voucher_guard BEFORE INSERT OR UPDATE OF stusado,idcompra ON voucher
  FOR EACH ROW WHEN (NEW.stusado IN ('n','s')) EXECUTE FUNCTION guard_issuer_loss_voucher();
COMMIT;

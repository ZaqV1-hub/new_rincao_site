-- Additive checkout attribution contract. Existing purchases remain NULL (unknown).
-- For HML, use scripts/migrate-commerce-source.mjs so it captures a private
-- structural snapshot and validates the row count before and after this DDL.
ALTER TABLE public.compra
  ADD COLUMN IF NOT EXISTS origem_checkout character varying(12),
  ADD COLUMN IF NOT EXISTS checkout_session_id character varying(120),
  ADD COLUMN IF NOT EXISTS checkout_buyer_name character varying(120),
  ADD COLUMN IF NOT EXISTS checkout_buyer_phone character varying(32);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'compra_origem_checkout_check'
      AND conrelid = 'public.compra'::regclass
  ) THEN
    ALTER TABLE public.compra
      ADD CONSTRAINT compra_origem_checkout_check
      CHECK (origem_checkout IS NULL OR origem_checkout IN ('site', 'lumi'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS compra_checkout_session_id_uq
  ON public.compra (checkout_session_id)
  WHERE checkout_session_id IS NOT NULL;

COMMENT ON COLUMN public.compra.origem_checkout IS
  'Origem persistida do checkout: site ou lumi; NULL preserva origem historica desconhecida.';
COMMENT ON COLUMN public.compra.checkout_session_id IS
  'Identificador idempotente da sessao de checkout externa, quando aplicavel.';
COMMENT ON COLUMN public.compra.checkout_buyer_name IS
  'Nome informado no checkout enquanto a conta do comprador ainda nao esta vinculada.';
COMMENT ON COLUMN public.compra.checkout_buyer_phone IS
  'Telefone informado no checkout enquanto a conta do comprador ainda nao esta vinculada.';

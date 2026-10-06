-- Additive checkout attribution contract. Existing purchases remain NULL (unknown).
ALTER TABLE public.compra
  ADD COLUMN IF NOT EXISTS origem_checkout character varying(12),
  ADD COLUMN IF NOT EXISTS checkout_session_id character varying(120);

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

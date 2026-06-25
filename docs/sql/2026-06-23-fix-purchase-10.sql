BEGIN;

UPDATE compra
SET stcompra = 'canc'
WHERE idcompra = 10
  AND stcompra = 'conc';

INSERT INTO edicoes_log (
  origem,
  acao,
  compra_id,
  descricao,
  motivo,
  usuario_nome,
  detalhes_json,
  created_at
) VALUES (
  'ticket-delivery',
  'skip-cleanup',
  10,
  'Compra 10 retirada da fila de recovery por falta de contato.',
  'Limpeza manual do registro inconsistente identificado durante alinhamento do operador.',
  'codex',
  '{"purchaseId":10,"reason":"contact_missing_for_delivery"}',
  NOW()
);

COMMIT;

// Shared queries: the operational summary and owners use the same financial sources.
export const DAY_SALES_SQL = `
    WITH facts AS (
      SELECT v.vlunicompra * 100 AS cents, v.stusado, v.dtuso,
        COALESCE(v.dtinicio_validade, a.dtagenda) AS chosen_date, v.dtinicio_validade,
        c.stcompra='conc' AS paid, c.tpcompra AS channel,
        CASE
          WHEN v.idescola IS NOT NULL OR v.tpvoucher='escol'
            OR a.tpagenda IN ('escol','igrej','casam','melho','confr','ongs','grmix') THEN 'school'
          WHEN v.servico_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM servicos_adicionais s WHERE s.id=v.servico_id AND s.parque=$2
          ) THEN 'service'
          WHEN v.tpvoucher='espec' AND v.item_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM servicos_adicionais s WHERE s.legacy_ticket_id=v.item_id AND s.parque=$2
          ) THEN 'service'
          WHEN v.tpvoucher IN ('norma','infan','isent','corte') AND a.tpagenda IN ('padra','promo')
            AND NOT EXISTS (SELECT 1 FROM agenda_extras ae WHERE ae.idagenda=a.idagenda) THEN 'admission'
          ELSE 'unknown'
        END AS kind,
        c.tpcompra IN ('ponli','bilhe') OR (c.tpcompra='reser' AND COALESCE(UPPER(TRIM(c.formapag)), '') NOT IN ('','N/A')) AS known_channel
      FROM voucher v JOIN compra c ON c.idcompra=v.idcompra JOIN agenda a ON a.idagenda=v.idagenda
      WHERE (COALESCE(v.dtinicio_validade,a.dtagenda)=$1::date OR v.dtuso=$1::date)
        AND (v.parque_operacional IS NULL OR v.parque_operacional=$2)
    )
    SELECT
      COALESCE(SUM(cents) FILTER (WHERE paid AND chosen_date=$1::date AND kind='admission' AND channel='ponli'),0)::text AS site,
      COALESCE(SUM(cents) FILTER (WHERE paid AND chosen_date=$1::date AND kind='admission' AND channel IN ('bilhe','reser') AND known_channel),0)::text AS gate,
      COALESCE(SUM(cents) FILTER (WHERE paid AND chosen_date=$1::date AND kind='service' AND known_channel),0)::text AS services,
      COALESCE(SUM(cents) FILTER (WHERE paid AND chosen_date=$1::date AND kind<>'school' AND (kind='unknown' OR NOT known_channel OR known_channel IS NULL)),0)::text AS unclassified,
      COUNT(*) FILTER (WHERE kind='admission' AND stusado='s' AND dtuso=$1::date)::text AS admitted,
      COUNT(*) FILTER (WHERE paid AND chosen_date=$1::date AND kind='admission' AND known_channel AND stusado IS DISTINCT FROM 'inv')::text AS tickets,
      COUNT(*) FILTER (WHERE paid AND chosen_date=$1::date AND kind<>'school' AND (cents IS NULL OR cents<0 OR cents<>TRUNC(cents)))::text AS "invalidAmounts",
      COUNT(*) FILTER (WHERE paid AND chosen_date=$1::date AND kind<>'school' AND (kind='unknown' OR NOT known_channel OR known_channel IS NULL))::text AS "unclassifiedCount",
      COUNT(*) FILTER (WHERE paid AND chosen_date=$1::date AND stusado='inv')::text AS "invalidatedPaid",
      COUNT(*) FILTER (WHERE paid AND chosen_date=$1::date AND dtinicio_validade IS NULL)::text AS "legacyDates"
    FROM facts`;

export const DAY_COUNTS_SQL = `    SELECT CURRENT_TIMESTAMP AS "generatedAt",
      (SELECT COUNT(*)::text FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda WHERE a.dtagenda=$1::date) AS "groupCount",
      (SELECT COUNT(*)::text FROM caixa_periodos WHERE parque=$2 AND data_operacional=$1::date AND local_id IS NOT NULL) AS "cashCount",
      (SELECT COALESCE(SUM((SELECT SUM(value::bigint) FROM jsonb_each_text(n.counts))),0)::text
        FROM passeio_veiculos v JOIN agenda a ON a.idagenda=v.agenda_id JOIN passeio_contagens n ON n.id=v.current_count_id AND n.parque=v.parque
        WHERE v.parque=$2 AND a.dtagenda=$1::date AND v.estado='completed' AND n.status='completed') AS "countedPeople",
      (SELECT COUNT(*)::text FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda WHERE a.dtagenda=$1::date AND
        (NOT EXISTS(SELECT 1 FROM passeio_veiculos v WHERE v.parque=$2 AND v.agenda_id=ae.idagenda AND v.cliente_id=ae.idcliente) OR
         EXISTS(SELECT 1 FROM passeio_veiculos v LEFT JOIN passeio_contagens n ON n.id=v.current_count_id AND n.parque=v.parque
           WHERE v.parque=$2 AND v.agenda_id=ae.idagenda AND v.cliente_id=ae.idcliente AND (v.estado<>'completed' OR n.status IS DISTINCT FROM 'completed')))) AS "incompleteGroups",
      (SELECT COALESCE(SUM(o.planned_people),0)::text FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda
        LEFT JOIN passeio_operacao o ON o.parque=$2 AND o.agenda_id=ae.idagenda AND o.cliente_id=ae.idcliente WHERE a.dtagenda=$1::date) AS "plannedPeople",
      (SELECT COUNT(*)::text FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda
        LEFT JOIN passeio_operacao o ON o.parque=$2 AND o.agenda_id=ae.idagenda AND o.cliente_id=ae.idcliente WHERE a.dtagenda=$1::date AND o.planned_people IS NULL) AS "missingPlans"`;

export const DAY_METADATA_SQL = `
    WITH movement AS (
      SELECT DISTINCT a.dtagenda AS date FROM agenda a
      WHERE (a.tpagenda IN ('padra','promo') AND a.stagenda IN ('abe','lot') AND NOT EXISTS (
        SELECT 1 FROM operacao_dias d WHERE d.parque=$2 AND d.data=a.dtagenda AND d.estado='closed'
      )) OR EXISTS (SELECT 1 FROM agenda_extras ae WHERE ae.idagenda=a.idagenda)
      UNION
      SELECT data_operacional AS date FROM caixa_periodos
      WHERE parque=$2 AND data_operacional IS NOT NULL AND local_id IS NOT NULL
    )
SELECT counts.*,
      (SELECT MAX(date)::text FROM movement WHERE date<$1::date) AS "previousDate",
      (SELECT MIN(date)::text FROM movement WHERE date>$1::date) AS "nextDate"
    FROM (${DAY_COUNTS_SQL}) counts`;

export const DAY_FINANCIAL_SQL = `SELECT
    (SELECT COALESCE(SUM((r.snapshot->'calculation'->>'totalTripCents')::numeric),0)::text FROM passeio_recibos r JOIN passeio_operacao o ON o.finalized_receipt_id=r.id AND o.parque=r.parque WHERE r.parque=$2 AND r.visit_date=$1::date) AS revenue,
    (SELECT COALESCE(SUM(amount_cents),0)::text FROM operacao_despesas WHERE parque=$2 AND visit_date=$1::date) AS expenses,
    (SELECT COUNT(*)::text FROM passeio_recibos r JOIN passeio_operacao o ON o.finalized_receipt_id=r.id AND o.parque=r.parque WHERE r.parque=$2 AND r.visit_date=$1::date AND
      (jsonb_typeof(r.snapshot->'calculation'->'totalTripCents') IS DISTINCT FROM 'number' OR r.snapshot->>'remainingCents' IS DISTINCT FROM '0' OR r.snapshot->>'pendingPaymentCents' IS DISTINCT FROM '0')) AS "invalidReceipts",
    (SELECT COUNT(*)::text FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda LEFT JOIN passeio_operacao o ON o.parque=$2 AND o.agenda_id=ae.idagenda AND o.cliente_id=ae.idcliente WHERE a.dtagenda=$1::date AND o.finalized_receipt_id IS NULL) AS unfinished`;


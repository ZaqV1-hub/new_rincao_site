import { getOperationalParkId, type OperationalService } from "@/lib/operational-day-contract";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import {
  catalogId,
  getOperationalCatalogPool,
  OperationalCatalogError,
  readCatalogInput,
  requireCatalogRow,
  withOperationalCatalogTransaction,
  type CatalogActor,
} from "@/lib/painel-operational-catalog";

type ServiceRow = Omit<OperationalService, "id" | "sitePriceCents" | "gatePriceCents"> & {
  id: string;
  sitePriceCents: string | null;
  gatePriceCents: string;
};

const serviceColumns = `
  id, nome AS name, descricao AS description, ativo AS active, versao AS version,
  (preco_site * 100)::bigint AS "sitePriceCents",
  (preco_bilheteria * 100)::bigint AS "gatePriceCents"
`;

function mapService(row: ServiceRow): OperationalService {
  return {
    ...row,
    id: catalogId(row.id),
    sitePriceCents: row.sitePriceCents === null ? null : Number(row.sitePriceCents),
    gatePriceCents: Number(row.gatePriceCents),
  };
}

function isPriceCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 999_999_999_999;
}

export async function listPainelServices(): Promise<OperationalService[]> {
  const park = getOperationalParkId();
  const result = await getOperationalCatalogPool().query<ServiceRow>(
    `SELECT ${serviceColumns} FROM servicos_adicionais WHERE parque = $1 ORDER BY LOWER(nome), id`,
    [park],
  );
  return result.rows.map(mapService);
}

export async function savePainelService(input: unknown, actor: CatalogActor) {
  const { record, name, description, active, edit } = readCatalogInput(input, ["sitePriceCents", "gatePriceCents", "applyToOpenDates"]);
  const { sitePriceCents, gatePriceCents, applyToOpenDates } = record;
  if ((sitePriceCents !== null && !isPriceCents(sitePriceCents)) || !isPriceCents(gatePriceCents)) {
    throw new OperationalCatalogError("invalid_input", "Os preços devem ser informados em centavos inteiros. O preço do site pode ficar indisponível.");
  }
  if ("applyToOpenDates" in record && (edit || typeof applyToOpenDates !== "boolean")) {
    throw new OperationalCatalogError("invalid_input", "A inclusão em datas abertas deve ser selecionada na criação do serviço.");
  }
  const park = getOperationalParkId();

  return withOperationalCatalogTransaction(async (client) => {
    const fields = [park, name, description, sitePriceCents, gatePriceCents, active];
    const result = edit
      ? await client.query<ServiceRow>(
        `UPDATE servicos_adicionais
         SET nome = $2, descricao = $3, preco_site = $4::numeric / 100,
             preco_bilheteria = $5::numeric / 100, ativo = $6, versao = versao + 1, updated_at = NOW()
         WHERE parque = $1 AND id = $7 AND versao = $8::bigint AND versao < 2147483647
         RETURNING ${serviceColumns}`,
        [...fields, edit.id, edit.version],
      )
      : await client.query<ServiceRow>(
        `INSERT INTO servicos_adicionais (parque, nome, descricao, preco_site, preco_bilheteria, ativo)
         VALUES ($1, $2, $3, $4::numeric / 100, $5::numeric / 100, $6)
         RETURNING ${serviceColumns}`,
        fields,
      );
    const service = mapService(requireCatalogRow(result.rows));
    let appliedDates = 0;
    if (applyToOpenDates) {
      const assignments = await client.query(
        `INSERT INTO servico_datas (parque, data, servico_id)
         SELECT DISTINCT $1::text, dtagenda, $2::bigint
         FROM agenda
         WHERE dtagenda >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
           AND stagenda = 'abe' AND tpagenda IN ('padra', 'promo')
         ON CONFLICT DO NOTHING`,
        [park, service.id],
      );
      appliedDates = assignments.rowCount ?? 0;
    }
    await registerOpsAuditLog(client, {
      origem: "painel-servicos",
      acao: edit ? "update" : "create",
      descricao: `Serviço adicional ${edit ? "alterado" : "cadastrado"}: ${service.name}.`,
      motivo: "Cadastro de serviços adicionais.",
      usuarioNome: actor.name,
      detalhes: { park, service, actorCpf: actor.cpf, appliedDates },
    }, "postgres");
    return { service, appliedDates };
  });
}

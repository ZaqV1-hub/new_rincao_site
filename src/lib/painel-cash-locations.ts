import { getOperationalParkId, type CashLocation } from "@/lib/operational-day-contract";
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

type LocationRow = Omit<CashLocation, "id"> & { id: string };

const locationColumns = "id, nome AS name, descricao AS description, ativo AS active, versao AS version";

function mapLocation(row: LocationRow): CashLocation {
  return { ...row, id: catalogId(row.id) };
}

export async function listPainelCashLocations(): Promise<CashLocation[]> {
  const park = getOperationalParkId();
  const result = await getOperationalCatalogPool().query<LocationRow>(
    `SELECT ${locationColumns} FROM caixa_locais WHERE parque = $1 ORDER BY LOWER(nome), id`,
    [park],
  );
  return result.rows.map(mapLocation);
}

export async function savePainelCashLocation(input: unknown, actor: CatalogActor): Promise<CashLocation> {
  const { name, description, active, edit } = readCatalogInput(input);
  const park = getOperationalParkId();

  return withOperationalCatalogTransaction(async (client) => {
    const fields = [park, name, description, active];
    let rows: LocationRow[];
    try {
      const result = edit
        ? await client.query<LocationRow>(
          `UPDATE caixa_locais
           SET nome = $2, descricao = $3, ativo = $4, versao = versao + 1, updated_at = NOW()
           WHERE parque = $1 AND id = $5 AND versao = $6::bigint AND versao < 2147483647
           RETURNING ${locationColumns}`,
          [...fields, edit.id, edit.version],
        )
        : await client.query<LocationRow>(
          `INSERT INTO caixa_locais (parque, nome, descricao, ativo)
           VALUES ($1, $2, $3, $4) RETURNING ${locationColumns}`,
          fields,
        );
      rows = result.rows;
    } catch (error) {
      if (error instanceof Error && "constraint" in error && error.constraint === "caixa_locais_nome_por_parque") {
        throw new OperationalCatalogError("duplicate_name", "Já existe um local de caixa com esse nome.");
      }
      throw error;
    }
    const location = mapLocation(requireCatalogRow(rows));
    await registerOpsAuditLog(client, {
      origem: "painel-locais-caixa",
      acao: edit ? "update" : "create",
      descricao: `Local de caixa ${edit ? "alterado" : "cadastrado"}: ${location.name}.`,
      motivo: "Cadastro de locais de caixa.",
      usuarioNome: actor.name,
      detalhes: { park, location, actorCpf: actor.cpf },
    }, "postgres");
    return location;
  });
}

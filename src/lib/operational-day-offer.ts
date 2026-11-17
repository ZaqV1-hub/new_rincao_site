import type { PoolClient } from "pg";
import type { B2cProduct } from "@/lib/b2c-catalog-defaults";
import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { getOperationalParkId } from "@/lib/operational-day-contract";
import { voucherValidityRange, type OperationalValidity } from "@/lib/operational-date";
import type { PurchaseAgendaDetail } from "@/lib/purchase-contracts";
import { buildStandardTicketProducts } from "@/lib/standard-ticket-products";

type ConfigurationRow = {
  agendaId: number | null;
  priceTableId: number;
  validity: OperationalValidity;
  ticketTypes: string[];
  state: string;
};
type ServiceRow = { id: string; name: string; description: string; sitePrice: string | null; gatePrice: string };
export class OperationalDayOfferError extends Error {
  readonly code = "agenda_unavailable";
  readonly status = 409;
  constructor() { super("A programação desta data mudou ou não está disponível. Consulte a agenda novamente."); }
}

export async function loadOperationalDayOffer(
  agenda: Pick<PurchaseAgendaDetail, "id" | "date" | "priceTable">,
  client?: Pick<PoolClient, "query">,
  channel: "site" | "gate" = "site",
): Promise<{ products: B2cProduct[]; validity: { validFrom: string; validUntil: string } | null }> {
  const queryClient = client ?? getIngressoSistemaDbPool();
  const park = getOperationalParkId();
  const configuration = (await queryClient.query<ConfigurationRow>(`
    SELECT day_use_agenda_id AS "agendaId", tabela_preco_id AS "priceTableId", validade AS validity,
      tipos_ingresso AS "ticketTypes", estado AS state
    FROM operacao_dias WHERE parque=$1 AND data=$2::date`, [park, agenda.date])).rows[0];
  const standard = buildStandardTicketProducts({ siteNormal: agenda.priceTable.normal, siteChild: agenda.priceTable.child,
    ...(channel === "gate" ? { gateNormal: agenda.priceTable.gateNormal, gateChild: agenda.priceTable.gateChild } : {}) });
  if (!configuration) return { products: standard, validity: null };
  if (configuration.state !== "open" || configuration.agendaId !== agenda.id || configuration.priceTableId !== agenda.priceTable.id ||
      !Array.isArray(configuration.ticketTypes) || configuration.ticketTypes.some((type) => !["norma", "infan", "isent"].includes(type)) ||
      !["day", "7_days", "30_days", "6_months"].includes(configuration.validity)) {
    throw new OperationalDayOfferError();
  }
  const addons = await loadDayServices(agenda.date, client, channel);
  return {
    products: [...standard.filter((product) => configuration.ticketTypes.includes(product.voucherType)), ...addons],
    validity: voucherValidityRange(agenda.date, configuration.validity),
  };
}

async function loadDayServices(date: string, client?: Pick<PoolClient, "query">, channel: "site" | "gate" = "gate"): Promise<B2cProduct[]> {
  const queryClient = client ?? getIngressoSistemaDbPool();
  const park = getOperationalParkId();
  const services = await queryClient.query<ServiceRow>(`
    SELECT s.id::text AS id, s.nome AS name, s.descricao AS description,
      s.preco_site::text AS "sitePrice", s.preco_bilheteria::text AS "gatePrice"
    FROM servicos_adicionais s JOIN servico_datas d ON d.servico_id=s.id AND d.parque=s.parque
    WHERE d.parque=$1 AND d.data=$2::date AND s.ativo=TRUE${channel === "site" ? " AND s.preco_site IS NOT NULL" : ""}
    ORDER BY s.id${client ? " FOR SHARE OF s" : ""}`, [park, date]);
  return services.rows.map((service): B2cProduct => {
    const id = Number(service.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new OperationalDayOfferError();
    return { id: `servico:${id}`, operationalServiceId: id, type: "addon", title: service.name,
      subtitle: "Serviço adicional", description: service.description, imageSrc: "",
      sitePrice: service.sitePrice ?? "", boxOfficePrice: service.gatePrice,
      active: true, voucherType: "espec", voucherPrefix: "S" };
  });
}

export async function loadOperationalServiceOffer(date: string): Promise<{ agendaId: number | null; products: B2cProduct[] }> {
  const agenda = (await getIngressoSistemaDbPool().query<{ agendaId: number }>(`
    SELECT a.idagenda AS "agendaId" FROM operacao_dias d JOIN agenda a ON a.dtagenda=d.data
    WHERE d.parque=$1 AND d.data=$2::date AND d.estado='open' AND (
      (d.day_use_agenda_id=a.idagenda AND a.tpagenda IN ('padra','promo')) OR
      (d.day_use_agenda_id IS NULL AND a.tpagenda IN ('escol','igrej','casam','melho','confr','ongs','grmix') AND a.stagenda IN ('abe','lot'))
    ) ORDER BY a.idagenda LIMIT 1`, [getOperationalParkId(), date])).rows[0];
  return { agendaId: agenda?.agendaId ?? null, products: agenda ? await loadDayServices(date) : [] };
}

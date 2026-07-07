import Link from "next/link";
import { PainelComprasPageContent } from "@/components/painel-compras-page-content";
import type { PainelPurchaseListFilters } from "@/lib/painel-compras";

type PainelComprasPageProps = {
  actorName: string | null;
  actorCpf: string | null;
  initialFilters: PainelPurchaseListFilters;
  initialPage: number;
};

const typeOptions = [
  { value: "bilhe", label: "Bilheteria" },
  { value: "reser", label: "Reserva" },
  { value: "ponli", label: "Compra" },
];

const purchaseStatusOptions = [
  { value: "pend", label: "Em processamento" },
  { value: "conc", label: "Concluída" },
  { value: "canc", label: "Cancelada" },
];

const gatewayPaymentMethodOptions = [
  { value: "1", label: "Cartao de credito" },
  { value: "2", label: "Boleto" },
  { value: "11", label: "Pix" },
];

const ticketPaymentMethodOptions = [
  { value: "dinhe", label: "Dinheiro" },
  { value: "debit", label: "Débito" },
  { value: "credi", label: "Crédito" },
  { value: "chequ", label: "Cheque" },
  { value: "tranb", label: "Trans. Bancária" },
  { value: "corte", label: "Cortesia" },
  { value: "pix", label: "PIX" },
];

const paymentMethodOptions = [
  ...gatewayPaymentMethodOptions.map((option) => ({
    value: `gateway:${option.value}`,
    label: option.label,
  })),
  ...ticketPaymentMethodOptions.map((option) => ({
    value: `ticket:${option.value}`,
    label: option.label,
  })),
];

const gatewayStatusOptions = [
  { value: "1", label: "Aguardando pagamento" },
  { value: "2", label: "Em análise" },
  { value: "3", label: "Paga" },
  { value: "4", label: "Disponível" },
  { value: "5", label: "Em disputa" },
  { value: "6", label: "Devolvida" },
  { value: "7", label: "Cancelada" },
  { value: "8", label: "Chargeback debitado" },
  { value: "9", label: "Em contestação" },
];

function buildComprasHref(filters: PainelPurchaseListFilters, page: number) {
  const params = new URLSearchParams();

  if (filters.dateFrom) {
    params.set("dtcompra[de]", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("dtcompra[ate]", filters.dateTo);
  }

  if (filters.purchaseId) {
    params.set("idcompra", filters.purchaseId);
  }

  if (filters.type) {
    params.set("tpcompra", filters.type);
  }

  if (filters.purchaseStatus) {
    params.set("stcompra", filters.purchaseStatus);
  }

  if (filters.paymentMethod) {
    params.set("payment", filters.paymentMethod);
  } else if (filters.gatewayPaymentMethod) {
    params.set("paymentmethodtype", filters.gatewayPaymentMethod);
  } else if (filters.ticketPaymentMethod) {
    params.set("formapag", filters.ticketPaymentMethod);
  }

  if (filters.gatewayStatus) {
    params.set("status", filters.gatewayStatus);
  }

  if (filters.cpf) {
    params.set("cpf", filters.cpf);
  }

  if (filters.userName) {
    params.set("nmusuario", filters.userName);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/painel/compras?${query}` : "/painel/compras";
}

function hasActiveFilters(filters: PainelPurchaseListFilters) {
  return Object.values(filters).some((value) => value != null && value !== "");
}

export function PainelComprasPage({
  actorName,
  actorCpf,
  initialFilters,
  initialPage,
}: PainelComprasPageProps) {
  const filtersActive = hasActiveFilters(initialFilters);
  const exportHref = buildComprasHref(initialFilters, 1).replace(
    "/painel/compras",
    "/api/painel/compras/export",
  );

  return (
    <section className="grid gap-3">
      <div className="panel-section p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="panel-eyebrow">Compras</p>
            <h1 className="mt-1 text-[24px] font-black text-[#133d63]">
              Lista de compras e reservas
            </h1>
            <p className="mt-1 text-sm text-[#58728b]">
              Operador: {actorName || actorCpf || "Sessão operacional"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-[8px] border border-[#d7e3ee] px-3 py-2 text-xs font-semibold text-[#133d63]"
              href={exportHref}
            >
              Exportar
            </Link>
            {filtersActive ? (
              <Link
                className="rounded-[8px] border border-[#d7e3ee] px-3 py-2 text-xs font-semibold text-[#133d63]"
                href="/painel/compras"
              >
                Limpar filtros
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <PainelComprasPageContent
        actorCpf={actorCpf}
        initialFilters={initialFilters}
        initialPage={initialPage}
        typeOptions={typeOptions}
        purchaseStatusOptions={purchaseStatusOptions}
        paymentMethodOptions={paymentMethodOptions}
        gatewayStatusOptions={gatewayStatusOptions}
      />
    </section>
  );
}

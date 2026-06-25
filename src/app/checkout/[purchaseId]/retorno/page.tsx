import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IngressoShell } from "@/components/ingresso-shell";
import { requireAuthenticatedCustomer } from "@/lib/customer-area";
import { syncCheckoutStatus } from "@/lib/checkout-status";
import { getUserVoucherPurchaseById } from "@/lib/voucher-repository";

export const metadata: Metadata = {
  title: "Retorno do pagamento | Estancia",
  description: "Confirmacao do pagamento de ingressos do Estancia.",
};

export const dynamic = "force-dynamic";

type CheckoutReturnPageProps = {
  params: Promise<{
    purchaseId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toUrlSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
      return;
    }

    if (value !== undefined) {
      params.set(key, value);
    }
  });

  return params;
}

function resolveReturnSearchParams(
  purchaseId: number,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const params = toUrlSearchParams(searchParams);
  const paymentId =
    getFirstParam(searchParams, "payment_id") ??
    getFirstParam(searchParams, "paymentId") ??
    getFirstParam(searchParams, "transaction_id") ??
    getFirstParam(searchParams, "order_id");
  const reference =
    getFirstParam(searchParams, "reference") ??
    getFirstParam(searchParams, "merchant_order_id") ??
    getFirstParam(searchParams, "merchantOrderId") ??
    getFirstParam(searchParams, "order_number") ??
    getFirstParam(searchParams, "orderNumber") ??
    String(purchaseId);

  if (paymentId) {
    params.set("payment_id", paymentId);
  }

  params.set("reference", reference);
  params.set("idcompra", String(purchaseId));

  return params;
}

function getStatusCopy(status: string | null) {
  if (status === "conc") {
    return {
      eyebrow: "Pagamento confirmado",
      title: "Compra realizada com sucesso",
      message:
        "Os vouchers desta compra ja podem ser acompanhados em Meus Ingressos.",
      tone: "success",
    };
  }

  if (status === "canc") {
    return {
      eyebrow: "Pagamento nao concluido",
      title: "Nao conseguimos confirmar esta compra",
      message:
        "Revise os dados informados ou tente novamente com outra forma de pagamento.",
      tone: "danger",
    };
  }

  return {
    eyebrow: "Pagamento em processamento",
    title: "Ainda estamos aguardando confirmacao",
    message:
      "Assim que a operadora confirmar o pagamento, os vouchers serao liberados em Meus Ingressos.",
    tone: "pending",
  };
}

export default async function CheckoutReturnPage({
  params,
  searchParams,
}: CheckoutReturnPageProps) {
  const { purchaseId } = await params;
  const resolvedSearchParams = await searchParams;
  const customer = await requireAuthenticatedCustomer(
    `/checkout/${purchaseId}/retorno`,
  );
  const numericPurchaseId = Number(purchaseId);

  if (!Number.isInteger(numericPurchaseId) || numericPurchaseId <= 0) {
    notFound();
  }

  const purchase = await getUserVoucherPurchaseById(
    customer.cpf,
    numericPurchaseId,
  );

  if (!purchase || purchase.type !== "ponli") {
    notFound();
  }

  const synced = await syncCheckoutStatus(
    purchase,
    resolveReturnSearchParams(numericPurchaseId, resolvedSearchParams),
  ).catch((error) => {
    console.error("checkout-return-sync-failed", error);

    return {
      mapped: {
        ok: false,
        gatewayStatus: null,
        gatewayStatusLabel: "Indisponivel",
        purchaseStatus: "unknown" as const,
        raw: null,
      },
    };
  });
  const refreshedPurchase =
    (await getUserVoucherPurchaseById(customer.cpf, numericPurchaseId)) ??
    purchase;
  const finalStatus =
    refreshedPurchase.status === "conc" || refreshedPurchase.status === "canc"
      ? refreshedPurchase.status
      : synced.mapped.purchaseStatus === "conc" ||
          synced.mapped.purchaseStatus === "canc"
        ? synced.mapped.purchaseStatus
        : refreshedPurchase.status;
  const copy = getStatusCopy(finalStatus);
  const badgeClass =
    copy.tone === "success"
      ? "bg-[#e8f6e7] text-[#1f6b36]"
      : copy.tone === "danger"
        ? "bg-[#fff0ed] text-[#a34335]"
        : "bg-[#f4f7e8] text-[#6f5e1b]";

  return (
    <IngressoShell active="buy" user={customer}>
      <div className="mx-auto w-full max-w-[1100px] px-4 pb-4 pt-8 md:px-6">
        <h1 className="text-center text-[30px] font-black text-[#17351f] sm:text-[38px]">
          Retorno do pagamento
        </h1>
        <p className="mx-auto mt-2 max-w-[760px] text-center text-[15px] leading-8 text-[#516956]">
          Acompanhe a confirmacao da operadora e a liberacao dos vouchers.
        </p>
      </div>

      <div className="mx-auto grid w-full max-w-[1100px] gap-6 px-4 pb-12 md:px-6 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-[30px] border border-[#dce8d8] bg-white p-7 text-left shadow-[0_18px_48px_rgba(34,85,41,0.11)]">
          <span
            className={`inline-flex rounded-full px-4 py-2 text-[13px] font-bold ${badgeClass}`}
          >
            {copy.eyebrow}
          </span>
          <h1 className="mt-5 text-[31px] font-black leading-tight text-[#17351f]">
            {copy.title}
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#516956]">
            {copy.message}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/meus-ingressos"
              className="inline-flex min-h-[48px] items-center justify-center rounded-[999px] bg-[#2b8c46] px-5 py-3 text-[15px] font-black text-white shadow-[0_12px_25px_rgba(43,140,70,0.24)] hover:bg-[#1f6b36]"
            >
              Ver meus ingressos
            </Link>
            {finalStatus === "conc" ? null : (
              <Link
                href={`/checkout/${refreshedPurchase.id}`}
                className="inline-flex min-h-[48px] items-center justify-center rounded-[999px] border border-[#cfe0ca] bg-white px-5 py-3 text-[15px] font-bold text-[#275033] hover:bg-[#f7fbf5]"
              >
                Voltar ao checkout
              </Link>
            )}
          </div>
        </div>

        <aside className="rounded-[30px] bg-[linear-gradient(145deg,#1d4c27,#2b8c46)] p-7 text-left text-white shadow-[0_24px_55px_rgba(29,76,39,0.18)]">
          <p className="text-[12px] uppercase tracking-[0.28em] text-white/72">
            Pedido #{refreshedPurchase.id}
          </p>
          <dl className="mt-5 space-y-4 text-sm leading-6 text-white/84">
            <div>
              <dt className="text-white/62">Status da compra</dt>
              <dd className="text-[18px] font-black text-white">
                {refreshedPurchase.statusLabel}
              </dd>
            </div>
            <div>
              <dt className="text-white/62">Status da operadora</dt>
              <dd className="text-[18px] font-black text-white">
                {synced.mapped.gatewayStatusLabel}
              </dd>
            </div>
            <div>
              <dt className="text-white/62">Ingressos vinculados</dt>
              <dd className="text-[18px] font-black text-white">
                {refreshedPurchase.voucherCount}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </IngressoShell>
  );
}

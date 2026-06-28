"use client";

import { IngressoShell } from "@/components/ingresso-shell";
import {
  FlowIcon,
  FlowStepper,
  IconBubble,
  PrimaryFlowButton,
} from "@/components/order-flow-ui";
import type { AuthUser } from "@/lib/auth-contracts";
import {
  getB2cSitePrice,
  type B2cProduct,
} from "@/lib/b2c-catalog-defaults";
import type {
  CreatePurchaseResponse,
  PurchaseAgendaDetail,
} from "@/lib/purchase-contracts";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type PurchasePageProps = {
  agenda: PurchaseAgendaDetail;
  user: AuthUser;
  products: B2cProduct[];
};

type PurchaseStep = "tickets" | "review";
type Quantities = Record<string, number>;

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function normalizeMoney(value: number) {
  return value.toFixed(2);
}

function buildClientCartSummary(
  products: B2cProduct[],
  lineItems: { productId: string; quantity: number }[],
) {
  const lines = lineItems.map((item) => {
    const product = products.find((current) => current.id === item.productId);
    const unitPrice = product ? Number(getB2cSitePrice(product)) : 0;

    if (!product || !Number.isFinite(unitPrice)) {
      throw new Error("Produto indisponível para compra.");
    }

    return {
      productId: product.id,
      title: product.title,
      quantity: item.quantity,
      unitPrice: normalizeMoney(unitPrice),
      totalValue: normalizeMoney(unitPrice * item.quantity),
    };
  });

  const ticketQuantity = lines.reduce((total, line) => total + line.quantity, 0);
  const totalValue = normalizeMoney(
    lines.reduce((total, line) => total + Number(line.totalValue), 0),
  );

  return { lines, ticketQuantity, totalValue };
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

async function readResponseBody<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

type CodindicaPreviewResponse =
  | {
      ok: true;
      data: {
        codindica: string;
        subtotal: string;
        discountAmount: string;
        totalValue: string;
      };
    }
  | {
      ok: false;
      error: {
        message: string;
      };
    };

function TicketCard({
  product,
  quantity,
  onStep,
}: {
  product: B2cProduct;
  quantity: number;
  onStep: (delta: number) => void;
}) {
  const selected = quantity > 0;
  const price = Number(getB2cSitePrice(product));

  return (
    <article
      className={`rounded-[18px] border bg-white p-5 shadow-[0_12px_28px_rgba(20,59,99,0.06)] transition ${
        selected ? "border-[#1d6fb8] bg-[#f7fbff]" : "border-[#d7e3ee]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex rounded-full bg-[#eaf2fb] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#3f78ab]">
            Ingresso
          </div>
          <h3 className="mt-3 text-[22px] font-extrabold leading-tight text-[#143b63]">
            {product.title}
          </h3>
          <p className="mt-2 text-[13px] leading-5 text-[#5f748b]">
            {product.description}
          </p>
          <strong className="mt-4 block text-[24px] font-black text-[#143b63]">
            {price > 0 ? formatCurrency(price) : "Gratuito"}
          </strong>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Remover ${product.title}`}
            onClick={() => onStep(-1)}
            className="grid h-10 w-10 place-items-center rounded-[12px] border border-[#d7e3ee] bg-white text-[22px] font-bold text-[#143b63] hover:border-[#1d6fb8]"
          >
            -
          </button>
          <span className="grid h-10 min-w-10 place-items-center rounded-[12px] border border-[#d7e3ee] bg-white px-3 text-[16px] font-black text-[#143b63]">
            {quantity}
          </span>
          <button
            type="button"
            aria-label={`Adicionar ${product.title}`}
            onClick={() => onStep(1)}
            className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#1d6fb8] text-[22px] font-bold text-white shadow-[0_10px_18px_rgba(29,111,184,0.18)] hover:bg-[#155990]"
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}

export function PurchasePage({ agenda, user, products }: PurchasePageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const tickets = products.filter((product) => product.type === "passport");
  const [step, setStep] = useState<PurchaseStep>("tickets");
  const [quantities, setQuantities] = useState<Quantities>({});
  const [codindica, setCodindica] = useState("");
  const [appliedCodindica, setAppliedCodindica] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState("0.00");
  const [isApplyingCodindica, setIsApplyingCodindica] = useState(false);
  const [codindicaFeedback, setCodindicaFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dateLabel = formatLongDate(agenda.date);

  const lineItems = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    [quantities],
  );

  const cart = useMemo(() => {
    if (lineItems.length === 0) {
      return null;
    }

    try {
      return buildClientCartSummary(products, lineItems);
    } catch {
      return null;
    }
  }, [lineItems, products]);

  const ticketQuantity = cart?.ticketQuantity ?? 0;
  const totalQuantity =
    cart?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0;
  const totalValue = cart?.totalValue ?? "0.00";
  const totalValueWithDiscount = appliedCodindica
    ? Math.max(Number(totalValue) - Number(appliedDiscount), 0).toFixed(2)
    : totalValue;

  function setProductQuantity(productId: string, delta: number) {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max((current[productId] ?? 0) + delta, 0),
    }));
    setAppliedCodindica(null);
    setAppliedDiscount("0.00");
    setCodindicaFeedback(null);
  }

  function goTo(nextStep: PurchaseStep) {
    if (nextStep !== "tickets" && ticketQuantity <= 0) {
      setError("Selecione pelo menos um ingresso para continuar.");
      setStep("tickets");
      return;
    }

    setError(null);
    setStep(nextStep);
  }

  async function handleSubmit() {
    if (!cart || ticketQuantity <= 0) {
      setError("Selecione pelo menos um ingresso para continuar.");
      setStep("tickets");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/me/purchases", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: agenda.id,
          codindica: appliedCodindica || undefined,
          lineItems,
        }),
      });

      const payload = await readResponseBody<
        | CreatePurchaseResponse
        | {
            ok: false;
            error: {
              message: string;
            };
          }
      >(response);

      if (response.status === 401) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      if (!response.ok || !payload?.ok) {
        setError(
          payload && !payload.ok
            ? payload.error.message
            : "Não foi possível iniciar a compra agora.",
        );
        return;
      }

      router.replace(payload.data.checkoutRedirect);
      router.refresh();
    } catch (requestError) {
      console.error("purchase-submit-failed", requestError);
      setError("Não foi possível iniciar a compra agora.");
    } finally {
      setPending(false);
    }
  }

  async function handleApplyCodindica() {
    if (!cart || ticketQuantity <= 0) {
      setCodindicaFeedback({
        tone: "error",
        message: "Selecione pelo menos um ingresso antes de aplicar o código.",
      });
      return;
    }

    const normalizedCode = codindica.trim().toUpperCase();

    if (normalizedCode.length !== 6) {
      setAppliedCodindica(null);
      setAppliedDiscount("0.00");
      setCodindicaFeedback({
        tone: "error",
        message: "Informe um código de indicação válido.",
      });
      return;
    }

    setIsApplyingCodindica(true);
    setCodindicaFeedback(null);

    try {
      const response = await fetch("/api/me/purchases/codindica", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: agenda.id,
          codindica: normalizedCode,
          lineItems,
        }),
      });
      const payload = await readResponseBody<CodindicaPreviewResponse>(response);

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload && !payload.ok
            ? payload.error.message
            : "Não foi possível validar o código agora.",
        );
      }

      setAppliedCodindica(payload.data.codindica);
      setAppliedDiscount(payload.data.discountAmount);
      setCodindica(payload.data.codindica);
      setCodindicaFeedback({
        tone: "success",
        message: `Código ${payload.data.codindica} aplicado com sucesso.`,
      });
    } catch (applyError) {
      setAppliedCodindica(null);
      setAppliedDiscount("0.00");
      setCodindicaFeedback({
        tone: "error",
        message:
          applyError instanceof Error
            ? applyError.message
            : "Não foi possível validar o código agora.",
      });
    } finally {
      setIsApplyingCodindica(false);
    }
  }

  function renderProducts(currentProducts: B2cProduct[], title: string) {
    return (
      <div>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-extrabold leading-[1.06] text-[#143b63] sm:text-[25px] lg:text-[28px]">
              {title}
            </h1>
            <p className="mt-1.5 max-w-[460px] text-[12px] leading-5 text-[#5f748b] lg:text-[13px]">
              Escolha a quantidade de ingressos adulto, criança e isento para a sua visita.
            </p>
          </div>
          <Link
            href="/agenda"
            className="hidden min-h-9 items-center gap-2 rounded-full border border-[#d7e3ee] bg-white px-3 text-[12px] font-bold text-[#143b63] shadow-[0_8px_18px_rgba(20,59,99,0.045)] hover:border-[#1d6fb8] lg:inline-flex"
          >
            <FlowIcon name="calendar" className="h-4 w-4" />
            Alterar data
          </Link>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {currentProducts.map((product) => (
            <TicketCard
              key={product.id}
              product={product}
              quantity={quantities[product.id] ?? 0}
              onStep={(delta) => setProductQuantity(product.id, delta)}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderCartSummary(compact = false) {
    return (
      <>
        <div className={compact ? "space-y-2.5" : "mt-3 space-y-3"}>
          {cart?.lines.length ? (
            cart.lines.map((line) => (
              <div
                key={line.productId}
                className={`gap-3 ${
                  compact
                    ? "grid grid-cols-[minmax(0,1fr)_auto] items-start"
                    : "flex items-center justify-between border-b border-[#d7e3ee] pb-4"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-[13px] font-black text-[#143b63] sm:text-[14px]">
                    {compact ? `${line.quantity}x ${line.title}` : line.title}
                  </strong>
                  {!compact ? (
                    <span className="mt-1 block text-[12px] text-[#5f748b]">
                      x{line.quantity}
                    </span>
                  ) : null}
                </div>
                <strong className="whitespace-nowrap text-right text-[13px] font-extrabold text-[#143b63] sm:text-[14px]">
                  {formatCurrency(line.totalValue)}
                </strong>
              </div>
            ))
          ) : (
            <p className="text-[13px] font-semibold text-[#5f748b]">
              Nenhum produto selecionado.
            </p>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[#d7e3ee] pt-3 text-[#143b63]">
          <span className="text-[15px] font-black sm:text-[16px]">Subtotal</span>
          <strong className="text-[17px] font-black sm:text-[18px]">
            {formatCurrency(totalValue)}
          </strong>
        </div>
        {appliedCodindica ? (
          <div className="mt-3 flex items-center justify-between text-[#1d6fb8]">
            <span className="text-[14px] font-black sm:text-[15px]">Desconto</span>
            <strong className="text-[15px] font-black sm:text-[16px]">
              - {formatCurrency(appliedDiscount)}
            </strong>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <IngressoShell active="buy" user={user} variant="checkout">
      <div className="min-h-[calc(100vh-58px)] pb-28 text-[#143b63] lg:pb-6">
        <div
          className={`mx-auto py-3 sm:py-4 ${
            step === "review"
              ? "w-[min(1080px,calc(100%-16px))] sm:w-[min(1080px,calc(100%-24px))]"
              : "w-[min(980px,calc(100%-16px))] sm:w-[min(980px,calc(100%-24px))]"
          }`}
        >
          <FlowStepper current={step === "tickets" ? "tickets" : "payment"} />

          {error ? (
            <div className="mt-5 rounded-[16px] border border-[#efc3c3] bg-[#fff3f1] px-4 py-3 text-left text-sm font-semibold text-[#9f3f36]">
              {error}
            </div>
          ) : null}

          {step !== "review" ? (
            <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-start">
              <section>
                <div className="mb-3 inline-flex items-center gap-2.5 rounded-[10px] border border-[#d7e3ee] bg-white px-2.5 py-2 shadow-[0_8px_16px_rgba(20,59,99,0.035)] lg:hidden">
                  <IconBubble name="calendar" className="h-8 w-8" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3f78ab]">
                      Data da visita
                    </p>
                    <strong className="block text-[13px] font-black text-[#143b63]">
                      {dateLabel}
                    </strong>
                  </div>
                </div>

                {renderProducts(tickets, "Escolha seus ingressos")}
              </section>

              <aside className="hidden h-fit rounded-[12px] border border-[#d7e3ee] bg-white p-3.5 text-left shadow-[0_10px_22px_rgba(20,59,99,0.05)] xl:block">
                <h2 className="text-[17px] font-extrabold text-[#143b63]">
                  Carrinho
                </h2>
                <p className="mt-2.5 flex items-center gap-2 border-b border-[#d7e3ee] pb-2.5 text-[12px] text-[#5f748b]">
                  <IconBubble name="bag" className="h-8 w-8" />
                  {totalQuantity}{" "}
                  {totalQuantity === 1 ? "item selecionado" : "itens selecionados"}
                </p>
                {renderCartSummary()}
                <PrimaryFlowButton
                  onClick={() => goTo("review")}
                  className="mt-3 min-h-[38px] text-[12px] sm:text-[13px]"
                >
                  Ir para pagamento
                </PrimaryFlowButton>
                <p className="mt-3 flex items-center justify-center gap-2 text-[12px] text-[#5f748b]">
                  <FlowIcon name="lock" className="h-4 w-4 text-[#1d6fb8]" />
                  Seus dados estão protegidos.
                </p>
              </aside>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px] xl:items-start">
              <section className="text-left">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.26em] text-[#3f78ab]">
                  {dateLabel}
                </p>
                <h1 className="text-[22px] font-black leading-tight text-[#143b63] sm:text-[28px] lg:text-[32px]">
                  Resumo da compra
                </h1>
                <p className="mt-1.5 text-[13px] text-[#5f748b] lg:text-[15px]">
                  Revise os dados antes de concluir.
                </p>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <section className="rounded-[12px] border border-[#d7e3ee] bg-white p-4 shadow-[0_10px_24px_rgba(20,59,99,0.055)]">
                    <div className="flex items-start gap-3">
                      <IconBubble name="cart" className="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <h2 className="text-[18px] font-black text-[#143b63]">
                          Seu carrinho
                        </h2>
                        {renderCartSummary(true)}
                        <div className="mt-4 border-t border-[#d7e3ee] pt-4">
                          <p className="text-[13px] font-bold text-[#5f748b]">
                            Código de indicação
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                            <input
                              value={codindica}
                              onChange={(event) => {
                                const nextValue = event.target.value
                                  .toUpperCase()
                                  .replace(/[^A-Z0-9]/g, "")
                                  .slice(0, 6);
                                setCodindica(nextValue);
                                if (appliedCodindica && nextValue !== appliedCodindica) {
                                  setAppliedCodindica(null);
                                  setAppliedDiscount("0.00");
                                }
                                setCodindicaFeedback(null);
                              }}
                              maxLength={6}
                              placeholder="ABC123"
                              className="w-full rounded-[10px] border border-[#d7e3ee] px-4 py-3 text-[14px] font-semibold text-[#143b63]"
                            />
                            <button
                              type="button"
                              onClick={() => void handleApplyCodindica()}
                              disabled={isApplyingCodindica}
                              className="rounded-[10px] bg-[#1d6fb8] px-4 py-3 text-[13px] font-black text-white shadow-[0_10px_20px_rgba(29,111,184,0.15)] transition duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-[#155990] disabled:opacity-60"
                            >
                              {isApplyingCodindica ? "Aplicando..." : "Aplicar"}
                            </button>
                          </div>
                          {codindicaFeedback ? (
                            <div
                              className={`mt-3 rounded-[10px] border px-3 py-2 text-[12px] font-semibold ${
                                codindicaFeedback.tone === "success"
                                  ? "border-[#bfd6ec] bg-[#eef5fc] text-[#1d5d93]"
                                  : "border-[#efc3c3] bg-[#fff3f1] text-[#9f3f36]"
                              }`}
                            >
                              {codindicaFeedback.message}
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-[#d7e3ee] pt-4">
                          <span className="text-[16px] font-black text-[#143b63]">
                            Total
                          </span>
                          <strong className="text-[20px] font-black text-[#143b63]">
                            {formatCurrency(totalValueWithDiscount)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[12px] border border-[#d7e3ee] bg-white p-4 shadow-[0_10px_24px_rgba(20,59,99,0.055)]">
                    <div className="flex items-start gap-3">
                      <IconBubble name="user" className="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <h2 className="text-[18px] font-black text-[#143b63]">
                          Seus dados
                        </h2>
                        <dl className="mt-3 space-y-2.5 text-[13px]">
                          <div className="border-b border-[#d7e3ee] pb-3">
                            <dt className="font-black text-[#5f748b]">Nome</dt>
                            <dd className="mt-1 text-[#26292d]">{user.name}</dd>
                          </div>
                          {user.email ? (
                            <div className="border-b border-[#d7e3ee] pb-3">
                              <dt className="font-black text-[#5f748b]">E-mail</dt>
                              <dd className="mt-1 break-words text-[#26292d]">
                                {user.email}
                              </dd>
                            </div>
                          ) : null}
                          <div>
                            <dt className="font-black text-[#5f748b]">CPF</dt>
                            <dd className="mt-1 text-[#26292d]">{user.cpfMasked}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </section>
                </div>

                <section className="mt-3 rounded-[12px] border border-[#d7e3ee] bg-white p-4 shadow-[0_10px_24px_rgba(20,59,99,0.055)]">
                  <div className="flex items-start gap-3">
                    <IconBubble name="shield" className="h-10 w-10" />
                    <div>
                      <h2 className="text-[18px] font-black text-[#143b63]">
                        Pagamento
                      </h2>
                      <p className="mt-2 flex items-start gap-2.5 text-[13px] leading-5 text-[#5f748b]">
                        <span className="mt-1 grid h-5 w-5 place-items-center rounded-full bg-[#1d6fb8] text-[13px] font-black text-white">
                          ✓
                        </span>
                        Seus dados estão seguros e criptografados. Você será
                        redirecionado para a próxima etapa para concluir o
                        pagamento.
                      </p>
                    </div>
                  </div>
                </section>
              </section>

              <aside className="hidden h-fit rounded-[12px] border border-[#d7e3ee] bg-white p-4 text-left shadow-[0_12px_28px_rgba(20,59,99,0.055)] xl:block">
                <h2 className="text-[18px] font-black text-[#143b63]">
                  Resumo da compra
                </h2>
                {renderCartSummary(true)}
                <div className="mt-5 flex items-center justify-between border-t border-[#d7e3ee] pt-5">
                  <span className="text-[18px] font-black text-[#143b63]">
                    Total
                  </span>
                  <strong className="text-[22px] font-black text-[#143b63]">
                    {formatCurrency(totalValueWithDiscount)}
                  </strong>
                </div>
                <PrimaryFlowButton
                  onClick={() => void handleSubmit()}
                  disabled={pending}
                  className="mt-4 min-h-[42px] text-[13px] sm:text-[14px]"
                >
                  {pending ? "Preparando..." : "Finalizar e comprar"}
                </PrimaryFlowButton>
                <p className="mt-4 flex items-center justify-center gap-2 text-[12px] text-[#5f748b]">
                  <FlowIcon name="lock" className="h-4 w-4" />
                  Ambiente 100% seguro
                </p>
              </aside>
            </div>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-[16px] border border-[#e2e8ef] bg-white/96 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2.5 text-left shadow-[0_-10px_28px_rgba(20,59,99,0.11)] backdrop-blur xl:hidden">
          {step === "review" ? (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-[#5f748b]">
                    Total da compra
                  </p>
                  <strong className="mt-1 block truncate text-[18px] font-black text-[#143b63] sm:text-[22px]">
                    {formatCurrency(totalValueWithDiscount)}
                  </strong>
                </div>
                <PrimaryFlowButton
                  onClick={() => void handleSubmit()}
                  disabled={pending}
                  className="min-h-[42px] px-3 text-[13px] sm:text-[14px]"
                >
                  <span className="sm:hidden">
                    {pending ? "Preparando..." : "Finalizar"}
                  </span>
                  <span className="hidden sm:inline">
                    {pending ? "Preparando..." : "Finalizar e comprar"}
                  </span>
                </PrimaryFlowButton>
              </div>
              <p className="mt-2.5 flex items-center justify-center gap-2 text-[12px] text-[#5f748b]">
                <FlowIcon name="lock" className="h-4 w-4" />
                Ambiente 100% seguro
              </p>
            </>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-center gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <IconBubble name="bag" className="h-9 w-9" />
                <div className="min-w-0">
                  <p className="text-[12px] text-[#5f748b]">
                    {totalQuantity} {totalQuantity === 1 ? "item" : "itens"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#5f748b]">
                    Subtotal{" "}
                    <strong className="ml-1 text-[15px] font-black text-[#143b63] sm:text-[18px]">
                      {formatCurrency(totalValue)}
                    </strong>
                  </p>
                </div>
              </div>
              <PrimaryFlowButton
                onClick={() => goTo("review")}
                className="min-h-[42px] px-3 text-[13px] sm:text-[14px]"
              >
                <span className="sm:hidden">Continuar</span>
                <span className="hidden sm:inline">Continuar para pagamento</span>
              </PrimaryFlowButton>
            </div>
          )}
        </div>
      </div>
    </IngressoShell>
  );
}

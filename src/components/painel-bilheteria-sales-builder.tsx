"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { PublicAgendaEvent } from "@/lib/agenda-contracts";
import {
  getB2cBoxOfficePrice,
  type B2cProduct,
} from "@/lib/b2c-catalog-defaults";
import type { OpsCourtesyAuthor, OpsDiscount } from "@/lib/ops-reference-data";
import {
  PAINEL_BILHETERIA_SALE_DRAFT_KEY,
  type PainelBilheteriaSaleDraft,
  type PainelBilheteriaSaleDraftCourtesy,
  type PainelBilheteriaSaleDraftItem,
} from "@/lib/painel-bilheteria-sales";

type ReferenceDataResponse = {
  ok: boolean;
  data?: {
    discounts: OpsDiscount[];
    courtesyAuthors: OpsCourtesyAuthor[];
  };
  error?: {
    message?: string;
  };
};

type SaleLineDraft = {
  id: string;
  selection: string;
  quantity: number;
  authorId: string;
  identification: string;
  note: string;
};

type PainelBilheteriaSalesBuilderProps = {
  today: string;
  agendas: PublicAgendaEvent[];
  products: B2cProduct[];
};

const emptySaleLineDraft: SaleLineDraft = {
  id: "",
  selection: "",
  quantity: 1,
  authorId: "",
  identification: "",
  note: "",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function parseMoney(value: string | null | undefined) {
  const raw = String(value ?? "").trim().replace(/^R\$\s*/i, "");
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.includes(",")
        ? raw.replace(",", ".")
        : raw;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatDateLabel(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function SalesIcon({ kind }: { kind: "ticket" | "discount" | "summary" | "plus" }) {
  const className = "h-7 w-7";

  switch (kind) {
    case "discount":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M19 5 5 19M8 7h.01M16 17h.01" />
          <circle cx="7.5" cy="7.5" r="2.5" />
          <circle cx="16.5" cy="16.5" r="2.5" />
        </svg>
      );
    case "summary":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M7 7.5h10a2 2 0 0 1 2 2v1.5a2 2 0 0 0-2 2 2 2 0 0 0 2 2V16.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V15a2 2 0 0 0 0-4V9.5a2 2 0 0 1 2-2Z" />
          <path d="M9.5 10h5M9.5 14h5" />
        </svg>
      );
  }
}

function calculatePurchaseDiscount(
  subtotal: number,
  discountId: string,
  discounts: OpsDiscount[],
) {
  const discount = discounts.find((item) => String(item.id) === discountId.trim());

  if (!discount) {
    return 0;
  }

  const value = parseMoney(discount.value);

  if (discount.applicationType === "percentual") {
    return money(subtotal * (value / 100));
  }

  if (discount.applicationType === "valor_fixo") {
    return Math.min(subtotal, money(value));
  }

  return 0;
}

function readAgendaPrice(product: B2cProduct) {
  return parseMoney(getB2cBoxOfficePrice(product));
}

export function PainelBilheteriaSalesBuilder({
  today,
  agendas,
  products,
}: PainelBilheteriaSalesBuilderProps) {
  const router = useRouter();
  const agendaId = agendas[0] ? String(agendas[0].id) : "";
  const [saleLines, setSaleLines] = useState<SaleLineDraft[]>([]);
  const [purchaseDiscountId, setPurchaseDiscountId] = useState("");
  const [discounts, setDiscounts] = useState<OpsDiscount[]>([]);
  const [courtesyAuthors, setCourtesyAuthors] = useState<OpsCourtesyAuthor[]>([]);
  const [loadingReference, setLoadingReference] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const todayLabel = useMemo(() => formatDateLabel(today), [today]);

  useEffect(() => {
    let active = true;

    async function loadReferenceData() {
      setLoadingReference(true);

      try {
        const response = await fetch("/api/painel/bilheteria/reference-data");
        const payload =
          (await response.json().catch(() => null)) as ReferenceDataResponse | null;

        if (!active) {
          return;
        }

        if (!response.ok || !payload?.ok || !payload.data) {
          setErrorMessage(
            payload?.error?.message ||
              "Nao foi possivel carregar descontos e autorizadores.",
          );
          return;
        }

        setDiscounts(payload.data.discounts);
        setCourtesyAuthors(payload.data.courtesyAuthors);
      } finally {
        if (active) {
          setLoadingReference(false);
        }
      }
    }

    void loadReferenceData();

    return () => {
      active = false;
    };
  }, []);

  const selectedAgenda = useMemo(
    () => agendas.find((agenda) => String(agenda.id) === agendaId.trim()) ?? null,
    [agendaId, agendas],
  );

  const saleItems: PainelBilheteriaSaleDraftItem[] = useMemo(
    () =>
      saleLines.flatMap((line) => {
        const product = products.find((item) => item.id === line.selection);

        if (!product || line.quantity <= 0) {
          return [];
        }

        const basePrice = readAgendaPrice(product);
        const totalValue = money(basePrice * line.quantity);

        return [
          {
            type: product.voucherType === "infan" ? "infan" : "norma",
            quantity: line.quantity,
            label: product.title,
            baseUnitValue: basePrice.toFixed(2),
            unitValue: basePrice.toFixed(2),
            totalValue: totalValue.toFixed(2),
          },
        ];
      }),
    [products, saleLines, selectedAgenda],
  );

  const courtesyDrafts: PainelBilheteriaSaleDraftCourtesy[] = useMemo(
    () =>
      saleLines.flatMap((line) => {
        if (line.selection !== "courtesy") {
          return [];
        }

        const author = courtesyAuthors.find(
          (item) => String(item.id) === line.authorId.trim(),
        );

        if (!author || line.quantity <= 0) {
          return [];
        }

        return [
          {
            authorId: author.id,
            authorName: author.name,
            quantity: line.quantity,
            identification: line.identification.trim(),
            note: line.note.trim(),
          },
        ];
      }),
    [courtesyAuthors, saleLines],
  );

  const subtotalValue = useMemo(
    () => money(saleItems.reduce((total, item) => total + parseMoney(item.totalValue), 0)),
    [saleItems],
  );
  const selectedDiscount = useMemo(
    () => discounts.find((item) => String(item.id) === purchaseDiscountId.trim()) ?? null,
    [discounts, purchaseDiscountId],
  );
  const discountValue = useMemo(
    () => calculatePurchaseDiscount(subtotalValue, purchaseDiscountId, discounts),
    [discounts, purchaseDiscountId, subtotalValue],
  );
  const saleTotal = money(Math.max(0, subtotalValue - discountValue));
  const canProceed =
    selectedAgenda != null && (saleItems.length > 0 || courtesyDrafts.length > 0);

  function addLine() {
    setSaleLines((current) => [
      {
        ...emptySaleLineDraft,
        id: `${Date.now()}-${current.length}`,
      },
      ...current,
    ]);
    setErrorMessage(null);
  }

  function updateLine(lineId: string, nextLine: Partial<SaleLineDraft>) {
    setSaleLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,
              ...nextLine,
            }
          : line,
      ),
    );
    setErrorMessage(null);
  }

  function updateQuantity(lineId: string, quantity: number) {
    updateLine(lineId, {
      quantity: Math.max(1, Math.trunc(quantity) || 1),
    });
  }

  function removeLine(lineId: string) {
    setSaleLines((current) => current.filter((line) => line.id !== lineId));
    setErrorMessage(null);
  }

  function handleProceed() {
    if (!selectedAgenda) {
      setErrorMessage("A agenda nao esta aberta para hoje.");
      return;
    }

    if (!canProceed) {
      setErrorMessage("Adicione ao menos um passaporte ou uma cortesia.");
      return;
    }

    const draft: PainelBilheteriaSaleDraft = {
      agendaId: selectedAgenda.id,
      agendaLabel: `${selectedAgenda.date} - #${selectedAgenda.id}`,
      cpf: "",
      items: saleItems,
      courtesies: courtesyDrafts,
      purchaseDiscountId: selectedDiscount?.id ?? null,
      purchaseDiscountLabel: selectedDiscount
        ? selectedDiscount.typeDescription
          ? `${selectedDiscount.typeDescription} - ${selectedDiscount.name}`
          : selectedDiscount.name
        : null,
      discountValue: discountValue.toFixed(2),
      subtotalValue: subtotalValue.toFixed(2),
      totalValue: saleTotal.toFixed(2),
      reason: "Venda presencial na bilheteria",
      createdAt: new Date().toISOString(),
    };

    sessionStorage.setItem(PAINEL_BILHETERIA_SALE_DRAFT_KEY, JSON.stringify(draft));
    router.push("/painel/bilheteria/finalizar");
  }

  if (agendas.length === 0) {
    return (
      <section className="panel-section p-4">
        <p className="panel-eyebrow">Bilheteria</p>
        <h2 className="mt-2 text-[28px] font-black leading-tight text-[#17351f]">
          {todayLabel}
        </h2>
        <div className="mt-4 rounded-[12px] border border-[#f0d3a8] bg-[#fff6e3] px-4 py-3 text-sm text-[#8a6100]">
          A agenda nao esta aberta para hoje.
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
      <div className="grid gap-6">
        <article className="panel-section p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[8px] bg-[#f1f7f0] text-[#214f2d]">
                <SalesIcon kind="ticket" />
              </div>
              <div>
                <h3 className="text-[22px] font-black text-[#17351f]">
                  Passaportes e cortesias
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex min-h-[52px] items-center gap-3 rounded-[6px] bg-[#23823f] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_26px_rgba(24,67,34,0.14)]"
            >
              <SalesIcon kind="plus" />
              <span>Nova linha</span>
            </button>
          </div>

          {saleLines.length > 0 ? (
            <div className="mt-6 grid gap-4">
              {saleLines.map((line) => {
                const lineProduct =
                  line.selection && line.selection !== "courtesy"
                    ? products.find((product) => product.id === line.selection) ?? null
                    : null;
                const lineBaseValue = lineProduct
                  ? readAgendaPrice(lineProduct)
                  : 0;
                const lineSubtotal = lineProduct
                  ? money(lineBaseValue * line.quantity)
                  : 0;
                const isCourtesy = line.selection === "courtesy";
                const hasSelection = line.selection !== "";

                return (
                  <div
                    key={line.id}
                    className="rounded-[8px] border border-[#dbe7d7] bg-[#fcfefd] px-6 py-5"
                  >
                    <div
                      className={
                        isCourtesy
                          ? "grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]"
                          : hasSelection
                            ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"
                            : "grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
                      }
                    >
                      <label className="grid gap-2 text-sm font-semibold text-[#3d5844]">
                        Passaporte
                        <select
                          value={line.selection}
                          onChange={(event) =>
                            updateLine(line.id, {
                              selection: event.target.value,
                              authorId: "",
                              identification: "",
                              note: "",
                              quantity: 1,
                            })
                          }
                          className="min-h-[54px] rounded-[6px] border border-[#dbe7d7] bg-white px-4 text-sm font-normal text-[#17351f]"
                        >
                          <option value="">Selecione</option>
                          <option value="courtesy">Cortesia</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.title}
                            </option>
                          ))}
                        </select>
                      </label>

                      {isCourtesy ? (
                        <>
                          <label className="grid gap-2 text-sm font-semibold text-[#3d5844]">
                            Nome
                            <input
                              value={line.identification}
                              onChange={(event) =>
                                updateLine(line.id, {
                                  identification: event.target.value,
                                })
                              }
                              placeholder="Nome da pessoa ou identificação"
                              className="min-h-[54px] rounded-[6px] border border-[#dbe7d7] bg-white px-4 text-sm font-normal text-[#17351f]"
                            />
                          </label>
                          <label className="grid gap-2 text-sm font-semibold text-[#3d5844]">
                            Observações
                            <input
                              value={line.note}
                              onChange={(event) =>
                                updateLine(line.id, { note: event.target.value })
                              }
                              placeholder="Observações da cortesia"
                              className="min-h-[54px] rounded-[6px] border border-[#dbe7d7] bg-white px-4 text-sm font-normal text-[#17351f]"
                            />
                          </label>
                        </>
                      ) : null}

                      {lineProduct ? (
                        <div className="grid gap-2 text-sm font-semibold text-[#3d5844]">
                          Quantidade
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => updateQuantity(line.id, line.quantity - 1)}
                              className="inline-flex h-[54px] w-[54px] items-center justify-center rounded-[6px] bg-[#d93636] text-2xl font-normal text-white shadow-[0_8px_18px_rgba(217,54,54,0.16)]"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(event) =>
                                updateQuantity(line.id, Number(event.target.value))
                              }
                              className="h-[54px] w-[76px] rounded-[6px] border border-[#dbe7d7] bg-white text-center text-base font-semibold text-[#17351f]"
                            />
                            <button
                              type="button"
                              onClick={() => updateQuantity(line.id, line.quantity + 1)}
                              className="inline-flex h-[54px] w-[54px] items-center justify-center rounded-[6px] bg-[#13823a] text-2xl font-normal text-white shadow-[0_8px_18px_rgba(19,130,58,0.16)]"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {isCourtesy ? (
                      <>
                        <label className="mt-4 grid gap-2 text-sm font-semibold text-[#3d5844]">
                          Autorizado por
                          <select
                            value={line.authorId}
                            onChange={(event) =>
                              updateLine(line.id, { authorId: event.target.value })
                            }
                            className="min-h-[48px] rounded-[6px] border border-[#dbe7d7] bg-white px-4 text-sm font-normal text-[#17351f]"
                            disabled={loadingReference}
                          >
                            <option value="">Selecione o responsável pela cortesia</option>
                            {courtesyAuthors.map((author) => (
                              <option key={author.id} value={author.id}>
                                {author.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="mt-4 grid gap-2 text-sm font-semibold text-[#3d5844]">
                          Quantidade
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => updateQuantity(line.id, line.quantity - 1)}
                              className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-[6px] bg-[#d93636] text-xl font-normal text-white shadow-[0_8px_18px_rgba(217,54,54,0.16)]"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(event) =>
                                updateQuantity(line.id, Number(event.target.value))
                              }
                              className="h-[42px] w-[70px] rounded-[6px] border border-[#dbe7d7] bg-white text-center text-base font-semibold text-[#17351f]"
                            />
                            <button
                              type="button"
                              onClick={() => updateQuantity(line.id, line.quantity + 1)}
                              className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-[6px] bg-[#13823a] text-xl font-normal text-white shadow-[0_8px_18px_rgba(19,130,58,0.16)]"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </>
                    ) : null}

                    {hasSelection ? (
                      <div className="mt-5 grid gap-4 border-t border-[#dbe7d7] pt-5 lg:grid-cols-[140px_150px_150px_minmax(0,1fr)] lg:items-end">
                        <div>
                          <div className="text-sm font-semibold text-[#5f7564]">
                            Valor base
                          </div>
                          <div className="mt-1 text-[22px] font-black text-[#102f1d]">
                            {formatMoney(lineBaseValue)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[#5f7564]">
                            {isCourtesy ? "Valor da cortesia" : "Valor unitário"}
                          </div>
                          <div className="mt-1 text-[22px] font-black text-[#102f1d]">
                            {formatMoney(lineBaseValue)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[#5f7564]">
                            Subtotal
                          </div>
                          <div className="mt-1 text-[22px] font-black text-[#102f1d]">
                            {formatMoney(lineSubtotal)}
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            className="inline-flex min-h-[52px] items-center gap-3 rounded-[6px] border border-[#dbe7d7] bg-white px-5 text-sm font-bold text-[#17351f]"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              className="h-5 w-5"
                              aria-hidden="true"
                            >
                              <path d="M6 7h12M10 7V5h4v2M8 7l1 12h6l1-12" />
                            </svg>
                            Remover linha
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="inline-flex min-h-[52px] items-center gap-3 rounded-[6px] border border-[#dbe7d7] bg-white px-5 text-sm font-bold text-[#17351f]"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="h-5 w-5"
                            aria-hidden="true"
                          >
                            <path d="M6 7h12M10 7V5h4v2M8 7l1 12h6l1-12" />
                          </svg>
                          Remover linha
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 flex min-h-[230px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[#dbe4d7] bg-[#fcfefd] px-6 py-10 text-center text-sm text-[#5f7564]">
              <div className="text-[#6c8b71]">
                <SalesIcon kind="ticket" />
              </div>
              <div className="mt-5">Nenhum passaporte ou cortesia adicionado ainda.</div>
            </div>
          )}
        </article>

        <article className="panel-section p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[8px] bg-[#f1f7f0] text-[#214f2d]">
                <SalesIcon kind="discount" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[22px] font-black text-[#17351f]">
                  Desconto da compra
                </h3>
                <label className="mt-4 grid gap-2 text-sm font-semibold text-[#17351f]">
                  Modalidade
                  <select
                    value={purchaseDiscountId}
                    onChange={(event) => setPurchaseDiscountId(event.target.value)}
                    className="min-h-[54px] rounded-[6px] border border-[#dbe7d7] px-4 text-sm text-[#17351f]"
                    disabled={loadingReference}
                  >
                    <option value="">Sem desconto</option>
                    {discounts.map((discount) => (
                      <option key={discount.id} value={discount.id}>
                        {discount.typeDescription
                          ? `${discount.typeDescription} - ${discount.name}`
                          : discount.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="flex min-h-[104px] items-center gap-6 rounded-[8px] border border-dashed border-[#dbe4d7] bg-[#fcfefd] px-6 py-4 text-sm leading-7 text-[#5f7564]">
              <div className="text-[#6c8b71]">
                <SalesIcon kind="ticket" />
              </div>
              {selectedDiscount ? (
                <div>
                  <div className="font-semibold text-[#17351f]">
                    {selectedDiscount.typeDescription
                      ? `${selectedDiscount.typeDescription} - ${selectedDiscount.name}`
                      : selectedDiscount.name}
                  </div>
                  <div>Valor aplicado na compra: {selectedDiscount.value}</div>
                </div>
              ) : (
                <div>Nenhum desconto selecionado para a compra.</div>
              )}
            </div>
          </div>
        </article>
      </div>

      <aside className="xl:sticky xl:top-5">
        <article className="panel-section p-6">
          <p className="panel-eyebrow">Resumo</p>
          <h3 className="mt-3 text-[28px] font-black text-[#17351f]">{todayLabel}</h3>

          <div className="mt-6">
            <p className="panel-eyebrow">Passaportes e cortesias</p>
          </div>

          <div className="mt-4 space-y-2 rounded-[8px] border border-dashed border-[#dbe4d7] bg-[#fcfefd] px-5 py-5">
            {saleItems.length > 0 || courtesyDrafts.length > 0 ? (
              <>
                {saleItems.map((item) => (
                  <div
                    key={`${item.label}-${item.quantity}`}
                    className="text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[#17351f]">{item.label}</div>
                        <div className="mt-1 text-xs text-[#5f7564]">
                          x{item.quantity} | {formatMoney(parseMoney(item.baseUnitValue))}
                        </div>
                      </div>
                      <div className="font-black text-[#17351f]">
                        {formatMoney(parseMoney(item.totalValue))}
                      </div>
                    </div>
                  </div>
                ))}
                {courtesyDrafts.map((courtesy) => (
                  <div
                    key={`${courtesy.authorId}-${courtesy.identification}-${courtesy.note}`}
                    className="text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[#17351f]">Cortesia</div>
                        <div className="mt-1 text-xs text-[#5f7564]">
                          x{courtesy.quantity} | {courtesy.authorName}
                        </div>
                      </div>
                      <div className="font-black text-[#17351f]">
                        {formatMoney(0)}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="flex items-center gap-5 text-sm leading-7 text-[#5f7564]">
                <div className="text-[#9fb0a3]">
                  <SalesIcon kind="ticket" />
                </div>
                <div>
                  Nenhum passaporte ou cortesia adicionado ainda.
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3 border-t border-[#dbe7d7] pt-5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#5f7564]">Subtotal</span>
              <strong className="text-[#17351f]">{formatMoney(subtotalValue)}</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#5f7564]">Desconto</span>
              <strong className="text-[#17351f]">- {formatMoney(discountValue)}</strong>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[#dbe7d7] pt-5">
              <span className="text-[13px] font-bold uppercase tracking-[0.22em] text-[#2d7b3b]">
                Total
              </span>
              <strong className="text-[34px] font-black text-[#17351f]">
                {formatMoney(saleTotal)}
              </strong>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-[12px] border border-[#f1b1aa] bg-[#fff4f2] px-4 py-3 text-sm text-[#9d3d31]">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleProceed}
            disabled={!canProceed || loadingReference}
            className="mt-5 inline-flex min-h-[56px] w-full items-center justify-center rounded-[14px] bg-[#23823f] px-4 py-3 text-base font-bold text-white shadow-[0_10px_26px_rgba(24,67,34,0.14)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Finalizar compra
          </button>
        </article>

        <article className="panel-section p-5">
          <div className="flex items-start gap-4 text-sm text-[#667c6a]">
            <div className="text-[#6c8b71]">
              <SalesIcon kind="summary" />
            </div>
            <p className="leading-7">
              Confira o resumo ao lado e finalize quando a venda estiver certa.
            </p>
          </div>
        </article>
      </aside>

    </section>
  );
}

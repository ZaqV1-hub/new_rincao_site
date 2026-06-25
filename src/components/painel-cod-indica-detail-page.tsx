"use client";

import { CurrencyInput, parseCurrencyInput } from "@/components/currency-input";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { PainelCodIndicaDetail } from "@/lib/painel-cod-indica";

type Props = {
  detail: PainelCodIndicaDetail;
  isManager: boolean;
  actorName: string | null;
  actorCpf: string | null;
};

export function PainelCodIndicaDetailPage({
  detail,
  isManager,
  actorName,
  actorCpf,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("0,00");
  const [isPending, startTransition] = useTransition();
  const availableCashback = Number(detail.cashbackSummary.disponivel);

  const handleAmountChange = useCallback((value: string) => {
    setPaymentAmount(value);
  }, []);

  async function handleCashbackPayment(formData: FormData) {
    setFeedback(null);

    if (parseCurrencyInput(paymentAmount) > availableCashback) {
      setFeedback({
        tone: "error",
        message: "O valor informado e maior que o cashback disponivel.",
      });
      return;
    }

    const values = {
      vlpagamento: String(formData.get("vlpagamento") ?? ""),
      senha_admin: String(formData.get("senha_admin") ?? ""),
      dsobservacao: String(formData.get("dsobservacao") ?? ""),
    };

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/painel/cod-indica/${encodeURIComponent(detail.codigo)}/cashback/pagar`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              values,
              actor: {
                name: actorName,
                cpf: actorCpf,
              },
            }),
          },
        );

        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(
            payload?.error?.message || "Falha ao registrar o pagamento de cashback.",
          );
        }

        setFeedback({
          tone: "success",
          message: payload.data?.message || "Pagamento registrado com sucesso.",
        });
        startTransition(() => router.refresh());
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao registrar o pagamento de cashback.",
        });
      }
    });
  }

  async function handleReprocess(purchaseId: number) {
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/painel/cod-indica/${encodeURIComponent(detail.codigo)}/compras/${purchaseId}/reprocessar`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ actorRoleId: isManager ? 1 : null }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Falha ao reprocessar o cashback.");
      }

      setFeedback({
        tone: "success",
        message: payload.data?.message || "Cashback reprocessado com sucesso.",
      });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Falha ao reprocessar o cashback.",
      });
    }
  }

  return (
    <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
          <Link className="text-[#1d68a2] underline" href="/painel">
            Home
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <Link className="text-[#1d68a2] underline" href="/painel/cod-indica">
            Cod Indica
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>{detail.codigo}</span>
        </div>

        {feedback ? (
          <div
            className={`mt-4 border px-4 py-3 text-sm ${
              feedback.tone === "success"
                ? "border-[#b7dfc0] bg-[#edf8f0] text-[#245336]"
                : "border-[#efc0c0] bg-[#fff0f0] text-[#7a2b2b]"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        <h1 className="mt-6 text-[34px] font-semibold text-[#205a7f]">{detail.codigo}</h1>

        <div className="mt-6 overflow-x-auto border border-[#d7d7d7]">
          <table className="min-w-full border-collapse text-[15px]">
            <tbody>
              <tr className="bg-[#5f84a3] text-white">
                <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                  Representante
                </th>
                <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                  Validade
                </th>
                <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                  Status
                </th>
                <th className="border border-[#6f8ea8] px-4 py-3 text-left font-normal">
                  Email
                </th>
              </tr>
              <tr>
                <td className="border border-[#d7d7d7] px-4 py-3">{detail.representante}</td>
                <td className="border border-[#d7d7d7] px-4 py-3">{detail.validadeLabel}</td>
                <td className="border border-[#d7d7d7] px-4 py-3">{detail.statusLabel}</td>
                <td className="border border-[#d7d7d7] px-4 py-3">{detail.email}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="border border-[#d7d7d7] bg-[#f8fbfd] p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-[#6f7f8d]">Compras pagas</div>
            <div className="mt-2 text-[28px] font-semibold text-[#205a7f]">
              R$ {detail.indicators.totalPagasLabel}
            </div>
          </div>
          <div className="border border-[#d7d7d7] bg-[#f8fbfd] p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-[#6f7f8d]">
              Compras nao pagas
            </div>
            <div className="mt-2 text-[28px] font-semibold text-[#205a7f]">
              R$ {detail.indicators.totalNaoPagasLabel}
            </div>
          </div>
          <div className="border border-[#d7d7d7] bg-[#f8fbfd] p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-[#6f7f8d]">
              Desconto gerado
            </div>
            <div className="mt-2 text-[28px] font-semibold text-[#205a7f]">
              R$ {detail.indicators.totalDescontoLabel}
            </div>
          </div>
          <div className="border border-[#d7d7d7] bg-[#f8fbfd] p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-[#6f7f8d]">
              Cashback gerado
            </div>
            <div className="mt-2 text-[28px] font-semibold text-[#205a7f]">
              R$ {detail.indicators.cashbackGeradoLabel}
            </div>
          </div>
          <div className="border border-[#d7d7d7] bg-[#f8fbfd] p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-[#6f7f8d]">Cashback pago</div>
            <div className="mt-2 text-[28px] font-semibold text-[#205a7f]">
              R$ {detail.indicators.cashbackPagoLabel}
            </div>
          </div>
          <div className="border border-[#d7d7d7] bg-[#f8fbfd] p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-[#6f7f8d]">
              Cashback disponivel
            </div>
            <div className="mt-2 text-[28px] font-semibold text-[#205a7f]">
              R$ {detail.indicators.cashbackDisponivelLabel}
            </div>
          </div>
        </div>

        <h2 className="mt-8 text-[28px] font-semibold text-[#205a7f]">Pagamentos de cashback</h2>
        {isManager ? (
          <form
            action={handleCashbackPayment}
            autoComplete="off"
            className="mt-4 space-y-4 border border-[#d7d7d7] bg-[#f8fbfd] p-4"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block text-sm font-semibold text-[#5a5a5a]">
                Valor pagamento
                <CurrencyInput
                  autoComplete="off"
                  className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                  defaultValue="0,00"
                  name="vlpagamento"
                  onValueChange={handleAmountChange}
                />
              </label>
              <label className="block text-sm font-semibold text-[#5a5a5a]">
                Senha administrativa
                <input
                  autoComplete="new-password"
                  className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                  name="senha_admin"
                  type="password"
                />
              </label>
              <label className="block text-sm font-semibold text-[#5a5a5a]">
                Observacao
                <input
                  autoComplete="off"
                  className="mt-1 w-full border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                  name="dsobservacao"
                  type="text"
                />
              </label>
            </div>
            <p className="text-sm text-[#5a5a5a]">
              Disponivel para pagamento: <strong>R$ {detail.indicators.cashbackDisponivelLabel}</strong>
            </p>
            <button
              className="inline-flex items-center justify-center bg-[#4aa329] px-6 py-3 text-sm font-semibold text-white hover:bg-[#3c8721] disabled:opacity-60"
              disabled={isPending}
              type="submit"
            >
              Pagar cashback
            </button>
          </form>
        ) : null}

        <div className="mt-4 overflow-x-auto border border-[#cfcfcf]">
          <table className="min-w-full border-collapse text-[15px]">
            <thead className="bg-[#5f84a3] text-left text-white">
              <tr>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Hora</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Gerente</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Observacao</th>
              </tr>
            </thead>
            <tbody>
              {detail.payments.length > 0 ? (
                detail.payments.map((payment, index) => (
                  <tr className={index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"} key={payment.id}>
                    <td className="border border-[#d7d7d7] px-4 py-3">{payment.dataLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{payment.horaLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">R$ {payment.valorLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{payment.gerente}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{payment.observacao}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="border border-[#d7d7d7] px-4 py-6 text-center" colSpan={5}>
                    Nenhum pagamento registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-[28px] font-semibold text-[#205a7f]">Compras vinculadas</h2>
        <div className="mt-4 border border-[#d3d3d3] bg-[#f6f7f8] p-4">
          <form action={`/painel/cod-indica/${encodeURIComponent(detail.codigo)}`} className="grid gap-4 md:grid-cols-3 xl:grid-cols-5" method="get">
            <label className="block text-sm font-semibold text-[#5a5a5a]">
              ID Compra
              <input className="mt-1 w-full border border-[#d7d7d7] px-3 py-2 text-sm" defaultValue={detail.filters.idcompra} name="idcompra" type="text" />
            </label>
            <label className="block text-sm font-semibold text-[#5a5a5a]">
              CPF
              <input className="mt-1 w-full border border-[#d7d7d7] px-3 py-2 text-sm" defaultValue={detail.filters.cpf} name="cpf" type="text" />
            </label>
            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Titular
              <input className="mt-1 w-full border border-[#d7d7d7] px-3 py-2 text-sm" defaultValue={detail.filters.nmusuario} name="nmusuario" type="text" />
            </label>
            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Compra de
              <input className="mt-1 w-full border border-[#d7d7d7] px-3 py-2 text-sm" defaultValue={detail.filters.dtcompraDe} name="dtcompra[de]" type="date" />
            </label>
            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Compra ate
              <input className="mt-1 w-full border border-[#d7d7d7] px-3 py-2 text-sm" defaultValue={detail.filters.dtcompraAte} name="dtcompra[ate]" type="date" />
            </label>
            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Pagamento de
              <input className="mt-1 w-full border border-[#d7d7d7] px-3 py-2 text-sm" defaultValue={detail.filters.dtpagamentoDe} name="dtpagamento[de]" type="date" />
            </label>
            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Pagamento ate
              <input className="mt-1 w-full border border-[#d7d7d7] px-3 py-2 text-sm" defaultValue={detail.filters.dtpagamentoAte} name="dtpagamento[ate]" type="date" />
            </label>
            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Forma Pgto. Cielo
              <select className="mt-1 w-full border border-[#d7d7d7] px-3 py-2 text-sm" defaultValue={detail.filters.paymentmethodtype || "-1"} name="paymentmethodtype">
                <option value="-1">Todos</option>
                <option value="1">Cartao de credito</option>
                <option value="2">Boleto</option>
                <option value="11">Pix</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Pagamento
              <select className="mt-1 w-full border border-[#d7d7d7] px-3 py-2 text-sm" defaultValue={detail.filters.status || "-1"} name="status">
                <option value="-1">Todos</option>
                <option value="1">Aguardando pagamento</option>
                <option value="2">Em analise</option>
                <option value="3">Paga</option>
                <option value="7">Cancelada</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-[#5a5a5a]">
              Status
              <select className="mt-1 w-full border border-[#d7d7d7] px-3 py-2 text-sm" defaultValue={detail.filters.stcompra || "-1"} name="stcompra">
                <option value="-1">Todos</option>
                <option value="pend">Pendente</option>
                <option value="conc">Concluida</option>
                <option value="canc">Cancelada</option>
              </select>
            </label>
            <div className="flex items-end">
              <button className="w-full bg-[#9c9c9c] px-4 py-3 text-sm font-semibold text-white" type="submit">
                Filtrar
              </button>
            </div>
          </form>
        </div>

        <div className="mt-4 overflow-x-auto border border-[#cfcfcf]">
          <table className="min-w-full border-collapse text-[15px]">
            <thead className="bg-[#5f84a3] text-left text-white">
              <tr>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Compra</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">CPF</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Titular</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data compra</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Pagamento</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Desconto</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Cashback</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Status</th>
                <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {detail.purchases.length > 0 ? (
                detail.purchases.map((purchase, index) => (
                  <tr className={index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"} key={purchase.purchaseId}>
                    <td className="border border-[#d7d7d7] px-4 py-3">
                      <Link className="text-[#1868d6] underline" href={purchase.detailHref}>
                        {purchase.purchaseId}
                      </Link>
                    </td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{purchase.cpfLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{purchase.userName}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">
                      {purchase.purchaseDateLabel} {purchase.purchaseTimeLabel !== "-" ? `- ${purchase.purchaseTimeLabel}` : ""}
                    </td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{purchase.paymentMethodLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">R$ {purchase.totalValueLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">R$ {purchase.discountValueLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">R$ {purchase.cashbackValueLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">{purchase.statusLabel}</td>
                    <td className="border border-[#d7d7d7] px-4 py-3">
                      {purchase.canReprocess && isManager ? (
                        <button
                          className="text-[#1868d6] underline"
                          onClick={() => handleReprocess(purchase.purchaseId)}
                          type="button"
                        >
                          Reprocessar
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="border border-[#d7d7d7] px-4 py-6 text-center" colSpan={10}>
                    Nenhuma compra encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="self-start rounded-[6px] border border-[#d7d7d7] bg-[#f6f7f8] p-4 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
        <ul className="space-y-3 text-[15px]">
          <li>
            <Link className="text-[#1d68a2] underline" href="/painel/cod-indica">
              Lista de codigos
            </Link>
          </li>
          <li>
            <Link
              className="text-[#1d68a2] underline"
              href={`/painel/cod-indica/${encodeURIComponent(detail.codigo)}/editar`}
            >
              Editar
            </Link>
          </li>
          <li>
            <Link className="text-[#1d68a2] underline" href="/painel/cod-indica/mensagem">
              Mensagem
            </Link>
          </li>
          <li>
            <Link
              className="text-[#1d68a2] underline"
              href={`/painel/cod-indica/${encodeURIComponent(detail.codigo)}/relatorio${
                searchParams.toString() ? `?${searchParams.toString()}` : ""
              }`}
            >
              Relatorio PDF
            </Link>
          </li>
        </ul>
      </aside>
    </section>
  );
}

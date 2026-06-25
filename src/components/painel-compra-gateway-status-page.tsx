import Link from "next/link";
import { formatPainelBilheteriaDate as formatDate } from "@/lib/painel-bilheteria-format";
import type {
  PainelPurchaseDetail,
  PainelPurchaseGatewayConsultResult,
} from "@/lib/painel-compras";

type PainelCompraGatewayStatusPageProps = {
  detail: PainelPurchaseDetail;
  consult: PainelPurchaseGatewayConsultResult;
};

function formatTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const match = value.match(/T(\d{2}:\d{2}:\d{2})/);
  return match?.[1] ?? (value.slice(11, 19) || "-");
}

export function PainelCompraGatewayStatusPage({
  detail,
  consult,
}: PainelCompraGatewayStatusPageProps) {
  return (
    <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
          <Link className="text-[#1d68a2] underline" href="/painel">
            Home
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <Link className="text-[#1d68a2] underline" href="/painel/compras">
            Lista de compras / reservas
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>{detail.purchaseId}</span>
        </div>

        <h1 className="mt-6 text-[28px] font-semibold text-[#205a7f]">
          Consulta pagamento
        </h1>

        <div className="mt-4 overflow-x-auto border border-[#cfcfcf]">
          <table className="min-w-full border-collapse text-[15px]">
            {!consult.found ? (
              <tbody>
                <tr className="bg-[#5f84a3] text-left text-white">
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal" colSpan={2}>
                    Status
                  </th>
                </tr>
                <tr>
                  <td className="border border-[#d7d7d7] px-4 py-3">
                    Dados nao encontrados na Cielo
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                <tr className="bg-[#5f84a3] text-left text-white">
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal" colSpan={2}>
                    Status
                  </th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                    Forma Pag.
                  </th>
                </tr>
                <tr>
                  <td className="border border-[#d7d7d7] px-4 py-3" colSpan={2}>
                    {consult.statusCode != null
                      ? `Cielo ${consult.statusCode} - ${consult.statusLabel}`
                      : "-"}
                  </td>
                  <td className="border border-[#d7d7d7] px-4 py-3">
                    {consult.paymentMethodLabel ?? "-"}
                  </td>
                </tr>
                <tr className="bg-[#5f84a3] text-left text-white">
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor total</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Taxa Cielo</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Valor liquido</th>
                </tr>
                <tr>
                  <td className="border border-[#d7d7d7] px-4 py-3">{consult.grossAmount}</td>
                  <td className="border border-[#d7d7d7] px-4 py-3">{consult.feeAmount}</td>
                  <td className="border border-[#d7d7d7] px-4 py-3">{consult.netAmount}</td>
                </tr>
                <tr className="bg-[#5f84a3] text-left text-white">
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                    Data de pagamento
                  </th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                    Inicio da operacao
                  </th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                    Fim da operacao
                  </th>
                </tr>
                <tr>
                  <td className="border border-[#d7d7d7] px-4 py-3">
                    {formatDate(consult.finishedAt)}
                  </td>
                  <td className="border border-[#d7d7d7] px-4 py-3">
                    {formatTime(consult.startedAt)}
                  </td>
                  <td className="border border-[#d7d7d7] px-4 py-3">
                    {formatTime(consult.finishedAt)}
                  </td>
                </tr>
                <tr className="bg-[#5f84a3] text-left text-white">
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Nome</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Email</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Telefone</th>
                </tr>
                <tr>
                  <td className="border border-[#d7d7d7] px-4 py-3">{consult.senderName ?? "-"}</td>
                  <td className="border border-[#d7d7d7] px-4 py-3">{consult.senderEmail ?? "-"}</td>
                  <td className="border border-[#d7d7d7] px-4 py-3">{consult.senderPhone ?? "-"}</td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
      </div>

      <aside className="grid content-start gap-5">
        <div className="rounded-[6px] border border-[#d4dde5] bg-white p-5 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
          <h2 className="text-lg font-semibold text-[#205a7f]">Acoes</h2>
          <ul className="mt-4 grid gap-3 text-sm">
            <li>
              <Link className="text-[#1d68a2] underline" href="/painel/compras">
                Lista de compras / reservas
              </Link>
            </li>
            <li>
              <Link
                className="text-[#1d68a2] underline"
                href={`/painel/compras/${detail.purchaseId}`}
              >
                Voltar
              </Link>
            </li>
          </ul>
        </div>
      </aside>
    </section>
  );
}

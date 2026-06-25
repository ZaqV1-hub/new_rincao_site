import Link from "next/link";
import { BilheteriaCashHeader } from "@/components/bilheteria-cash-header";
import { formatBilheteriaCashDateTime } from "@/lib/bilheteria-cash-view-model";

type Props = {
  actorName?: string | null;
  edits: {
    closureId: number | null;
    items: Array<{
      action: string;
      createdAt: string | null;
      description: string;
      id: number;
      movementId: number | null;
      movementType: string | null;
      origin: string;
      purchaseId: number | null;
      reason: string;
      userName: string | null;
    }>;
    page: number;
    total: number;
    totalPages: number;
  };
};

function actionLabel(action: string, origin: string) {
  const normalizedAction = action.toLowerCase();
  const normalizedOrigin = origin.toLowerCase();

  if (normalizedAction === "editar") {
    return "Alterada";
  }

  if (normalizedAction === "excluir" && normalizedOrigin === "compra") {
    return "Cancelada";
  }

  if (normalizedAction === "excluir") {
    return "Excluida";
  }

  return action || "-";
}

function recordLabel(item: Props["edits"]["items"][number]) {
  if (item.purchaseId) {
    return `Compra ${item.purchaseId}`;
  }

  if (item.movementId) {
    return item.movementType === "sangria"
      ? `Sangria ${item.movementId}`
      : `Fundo de caixa ${item.movementId}`;
  }

  return item.description || "-";
}

function buildPageHref(page: number, closureId: number | null) {
  const params = new URLSearchParams();
  if (page > 1) {
    params.set("page", String(page));
  }
  if (closureId) {
    params.set("fechamento_id", String(closureId));
  }
  const query = params.toString();
  return query
    ? `/painel/bilheteria/fechamento-caixa/edicoes?${query}`
    : "/painel/bilheteria/fechamento-caixa/edicoes";
}

export function BilheteriaCashClosureEditsPage({
  actorName = null,
  edits,
}: Props) {
  const title =
    edits.closureId != null
      ? "Edicoes do fechamento"
      : "Edicoes do periodo aberto";
  const closureHref =
    edits.closureId != null
      ? `/painel/bilheteria/fechamento-caixa?fechamento_id=${edits.closureId}`
      : "/painel/bilheteria/fechamento-caixa";

  return (
    <div className="grid gap-5">
      <BilheteriaCashHeader
        actorName={actorName}
        primaryActions={[
          { href: closureHref, label: "Fechamento de Caixa" },
        ]}
      />

      <section className="panel-section grid gap-5 p-5">
        <div>
          <p className="panel-eyebrow">Caixa</p>
          <h1 className="text-[28px] font-black leading-tight text-[#17351f]">{title}</h1>
        </div>

        <div className="overflow-hidden rounded-[8px] border border-[#dbe7d7] bg-white shadow-none">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[#5f84a3] text-left text-white">
                <tr>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data/Hora</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Registro</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Acao</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Descricao</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Motivo</th>
                  <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Responsavel</th>
                </tr>
              </thead>
              <tbody>
                {edits.items.length > 0 ? (
                  edits.items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="border border-[#d2dde6] px-4 py-3">{formatBilheteriaCashDateTime(item.createdAt)}</td>
                      <td className="border border-[#d2dde6] px-4 py-3">{recordLabel(item)}</td>
                      <td className="border border-[#d2dde6] px-4 py-3">{actionLabel(item.action, item.origin)}</td>
                      <td className="border border-[#d2dde6] px-4 py-3">{item.description || "-"}</td>
                      <td className="border border-[#d2dde6] px-4 py-3">{item.reason || "-"}</td>
                      <td className="border border-[#d2dde6] px-4 py-3">{item.userName || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-5 text-center text-[#5f7387]" colSpan={6}>
                      - Nenhuma edicao registrada -
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#5f7387]">
          <div>
            {edits.total} registro(s). Pagina {edits.page} de {edits.totalPages}.
          </div>
          <div className="flex gap-2">
            {edits.page > 1 ? (
              <Link
                className="rounded-[4px] border border-[#d0dbe7] bg-white px-3 py-2 font-bold text-[#205a7f]"
                href={buildPageHref(edits.page - 1, edits.closureId)}
              >
                Anterior
              </Link>
            ) : null}
            {edits.page < edits.totalPages ? (
              <Link
                className="rounded-[4px] border border-[#d0dbe7] bg-white px-3 py-2 font-bold text-[#205a7f]"
                href={buildPageHref(edits.page + 1, edits.closureId)}
              >
                Proxima
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { asOperationalCashError } from "@/lib/ops-cash-management";
import { BilheteriaCashClosurePage } from "@/components/bilheteria-cash-closure-page";
import { getBilheteriaCashClosureReport } from "@/lib/bilheteria-cash-data";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Fechamento de Caixa | Rincao",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelBilheteriaFechamentoCaixaPage({
  searchParams,
}: {
  searchParams: Promise<{
    fechamento_id?: string;
  }>;
}) {
  const session = await requirePainelAccess("vis_bilhet", "/painel/bilheteria/fechamento-caixa");
  if (session.authSource !== "panel") redirect("/painel/login");
  const params = await searchParams;
  const closureId = Number(params.fechamento_id ?? 0);
  let data;

  try {
    data = await getBilheteriaCashClosureReport(
      Number.isInteger(closureId) && closureId > 0 ? closureId : null,
    );
  } catch (error) {
    const needsSession = asOperationalCashError(error).code === "cash_session_required";
    return (
      <section role="status" className="rounded-[24px] border border-[#d7e5ef] bg-white p-6 text-[#205a7f]">
        <h1 className="text-2xl font-semibold">Fechamento de caixa</h1>
        <p className="mt-3">{needsSession
          ? "Não há caixa legado aberto. Selecione um caixa por local e data para continuar."
          : "Não foi possível carregar o fechamento do caixa agora. Tente novamente mais tarde."}</p>
        <Link href="/painel/caixas" className="mt-4 inline-block font-semibold underline">Selecionar caixa</Link>
      </section>
    );
  }

  return (
    <BilheteriaCashClosurePage
      actorCpf={session.actorCpf}
      actorName={session.actorName}
      closureId={data.closureId}
      isHistorical={data.isHistorical}
      isManager={session.legacyRoleId === 1}
      printHref={data.printHref}
      report={data.report}
    />
  );
}

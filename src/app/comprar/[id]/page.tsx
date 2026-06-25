import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IngressoShell } from "@/components/ingresso-shell";
import { PurchasePage } from "@/components/purchase-page";
import { parseAgendaId } from "@/lib/agenda-id";
import { listB2cProducts } from "@/lib/b2c-catalog";
import {
  getPublicAgendaEventById,
  isAgendaDateExpired,
} from "@/lib/agenda-repository";
import { requireAuthenticatedCustomer } from "@/lib/customer-area";
import { getAgendaProductAvailability } from "@/lib/painel-agenda-product-availability";
import { getPurchaseAgendaContext } from "@/lib/purchase-repository";

export const metadata: Metadata = {
  title: "Comprar Ingressos | Estancia",
  description:
    "Compra online de ingressos do Estancia com checkout seguro.",
};

export const dynamic = "force-dynamic";

type BuyRoutePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BuyRoutePage({ params }: BuyRoutePageProps) {
  const { id } = await params;
  const customer = await requireAuthenticatedCustomer(`/comprar/${id}`);
  const agendaId = parseAgendaId(id);

  if (!agendaId) {
    notFound();
  }

  const publicAgenda = await getPublicAgendaEventById(agendaId);

  if (publicAgenda && isAgendaDateExpired(publicAgenda.date)) {
    return (
      <IngressoShell active="buy" user={customer}>
        <div className="mx-auto flex w-full max-w-[920px] px-4 pb-16 pt-10 md:px-6">
          <div className="w-full rounded-[30px] border border-[#d8e6f0] bg-white p-8 text-center shadow-[0_18px_48px_rgba(17,66,97,0.11)]">
            <h1 className="legacy-rounded text-[31px] leading-tight text-[#1c5a80]">
              Esta data nao esta mais disponivel.
            </h1>
            <p className="mx-auto mt-4 max-w-[620px] text-[15px] leading-8 text-[#5f768a]">
              Escolha uma nova data na agenda para continuar a compra online.
            </p>
            <Link
              href="/agenda"
              className="legacy-rounded mt-6 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#3394d6] px-6 py-3 text-[15px] text-white shadow-[2px_2px_4px_rgba(0,0,0,0.2)] transition hover:bg-[#246b99]"
            >
              Voltar para a agenda
            </Link>
          </div>
        </div>
      </IngressoShell>
    );
  }

  const agenda = await getPurchaseAgendaContext(customer.cpf, agendaId);

  if (!agenda) {
    notFound();
  }

  const availability = await getAgendaProductAvailability(agenda.date);
  const products = (await listB2cProducts()).filter((product) =>
    product.type === "passport"
      ? availability.passportIds.includes(product.id)
      : availability.addonIds.includes(product.id),
  );

  return <PurchasePage agenda={agenda} user={customer} products={products} />;
}

import Link from "next/link";
import { EnfermariaPrintButton } from "@/components/enfermaria-print-button";
import { EnfermariaRecordDocument } from "@/components/enfermaria-record-document";
import styles from "@/components/enfermaria-visual.module.css";
import { requirePainelAccess } from "@/lib/painel-session";
import { listEnfermariaRecords } from "@/lib/enfermaria";

export const dynamic = "force-dynamic";

export default async function EnfermariaPrintPack({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePainelAccess("vis_enfermaria", "/painel/enfermaria/exportar");
  const query = await searchParams;
  const records = (await listEnfermariaRecords({
    from: typeof query.from === "string" ? query.from : null,
    to: typeof query.to === "string" ? query.to : null,
  })).slice(0, 10);

  return <main className={`${styles.page} mx-auto max-w-4xl bg-white p-8 print:max-w-none print:p-0`}>
    <nav className="mb-6 flex justify-between print:hidden"><Link href="/painel/enfermaria" className="text-sm text-[#176b96]">← Voltar</Link><EnfermariaPrintButton label="Imprimir pacote / Salvar PDF" /></nav>
    <h1 className="text-3xl font-semibold text-[#194d6b] print:hidden">Pacote de fichas · Enfermaria</h1>
    <p className="mt-2 text-sm text-slate-500 print:hidden">Até 10 atendimentos mais recentes no período selecionado.</p>
    {records.map((record) => <div key={record.id} className="mt-8 print:m-0 print:break-after-page">
      <EnfermariaRecordDocument
        record={record}
        form={record.form}
        occurredAt={record.occurredAt}
        localName={record.localName ?? ""}
        professional={record.professional}
      />
    </div>)}
    {records.length === 0 && <p className="mt-6 text-slate-500">Não há fichas no período.</p>}
  </main>;
}

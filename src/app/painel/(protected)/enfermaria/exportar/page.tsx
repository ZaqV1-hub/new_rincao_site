import Link from "next/link";
import { EnfermariaPrintButton } from "@/components/enfermaria-print-button";
import { requirePainelAccess } from "@/lib/painel-session";
import { listEnfermariaRecords } from "@/lib/enfermaria";

export const dynamic = "force-dynamic";

function section(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
function display(value: unknown) { return String(value ?? "—"); }

export default async function EnfermariaPrintPack({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePainelAccess("vis_enfermaria", "/painel/enfermaria/exportar");
  const query = await searchParams;
  const records = (await listEnfermariaRecords({
    from: typeof query.from === "string" ? query.from : null,
    to: typeof query.to === "string" ? query.to : null,
  })).slice(0, 10);

  return <main className="mx-auto max-w-4xl bg-white p-8 print:max-w-none print:p-0">
    <nav className="mb-6 flex justify-between print:hidden"><Link href="/painel/enfermaria" className="text-sm text-[#176b96]">← Voltar</Link><EnfermariaPrintButton label="Imprimir pacote / Salvar PDF" /></nav>
    <h1 className="text-3xl font-semibold text-[#194d6b]">Pacote de fichas · Enfermaria</h1>
    <p className="mt-2 text-sm text-slate-500">Até 10 atendimentos mais recentes no período selecionado.</p>
    {records.map((record) => {
      const identification = section(record.form.identification);
      const complaint = section(record.form.complaint);
      const symptoms = section(record.form.symptoms);
      const vitals = section(record.form.vitals);
      const urgency = section(record.form.urgency);
      const risk = section(record.form.risk);
      const referral = section(record.form.referral);
      const reports = section(record.form.reports);
      const responsible = section(record.form.responsible);
      return <article key={record.id} className="mt-8 min-h-[95vh] border-t-2 border-slate-400 pt-5 print:break-after-page print:border-0">
        <header><p className="text-xs text-slate-500">Atendimento nº {record.numberLabel} · {record.source === "sem_cadastro" ? "Sem cadastro" : record.source === "day_use" ? `Day use · Compra #${record.purchaseId}` : `Cliente #${record.clientId} · Passeio #${record.tripId}`}</p><h2 className="mt-2 text-2xl font-semibold">Ficha de atendimento de enfermagem</h2><p className="mt-1 text-sm">{record.occurredAt} · {record.localName ?? "Local não informado"} · {record.professional}</p></header>
        <section className="mt-5 grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
          <p><b>Nome:</b> {display(identification.name)}</p><p><b>CPF:</b> {display(identification.cpf ?? record.buyerCpf)}</p>
          <p><b>Nascimento:</b> {display(identification.birthDate)}</p><p><b>Sexo:</b> {display(identification.sex)}</p>
          <p><b>Telefone:</b> {display(identification.phone)}</p><p><b>Acompanhante:</b> {display(identification.companion)} · {display(identification.relationship)}</p>
          <p className="col-span-2"><b>Queixa principal:</b> {display(complaint.text)}</p><p className="col-span-2"><b>Tipo de demanda:</b> {Array.isArray(complaint.demandTypes) ? complaint.demandTypes.join(", ") : "—"}</p>
          <p className="col-span-2"><b>Sinais e sintomas:</b> {Array.isArray(symptoms.items) ? symptoms.items.join(", ") : "—"} · Dor em {display(symptoms.painLocation)} · Intensidade {display(symptoms.painIntensity)}/10</p>
          <p className="col-span-2"><b>Sinais vitais:</b> PA {display(vitals.bloodPressure)} mmHg · FC {display(vitals.heartRate)} bpm · FR {display(vitals.respiratoryRate)} irpm · SpO₂ {display(vitals.oxygenSaturation)}% · Temperatura {display(vitals.temperature)} °C · Glicemia {display(vitals.glucose)} mg/dL · Dor {display(vitals.pain)}/10 · Aferição {display(vitals.measuredAt)}</p>
          <p className="col-span-2"><b>Urgência/emergência:</b> {record.form.urgent ? "Sim" : "Não"} · {Array.isArray(urgency.items) ? urgency.items.join(", ") : ""}</p><p className="col-span-2"><b>Conduta:</b> {display(urgency.conduct)}</p>
          <p className="col-span-2"><b>Estratificação de risco:</b> {Array.isArray(risk.items) ? risk.items.join(", ") : "—"}</p>
          <p><b>Encaminhado à UPA:</b> {record.form.referralToUpa ? "Sim" : "Não"}</p><p><b>Motivo / forma:</b> {display(referral.reason)} · {display(referral.method)}</p><p><b>Horário / destino:</b> {display(referral.time)} · {display(referral.destination)}</p>
          <p className="col-span-2"><b>Relatório do enfermeiro:</b> {display(reports.nurse)}</p><p className="col-span-2"><b>Relatório do técnico:</b> {display(reports.technician)}</p><p className="col-span-2"><b>Observações complementares:</b> {display(reports.additional)}</p>
        </section>
        <div className="mt-20 grid grid-cols-2 gap-12 text-center text-xs"><div className="border-t pt-2">Pessoa atendida ou responsável<br />Assinatura</div><div className="border-t pt-2">{display(responsible.name)} · COREN {display(responsible.coren)}<br />Assinatura e carimbo</div></div>
      </article>;
    })}
    {records.length === 0 && <p className="mt-6 text-slate-500">Não há fichas no período.</p>}
  </main>;
}

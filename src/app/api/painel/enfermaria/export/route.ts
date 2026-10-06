import { NextResponse } from "next/server";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { listEnfermariaRecords } from "@/lib/enfermaria";

export const runtime = "nodejs";

function cell(value: unknown) {
  const text = String(value ?? "").replace(/[\r\n\t]+/g, " ");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, "vis_enfermaria");
  if (!access.ok) return access.response;
  const url = new URL(request.url);
  try {
    const filters = Object.fromEntries(url.searchParams.entries());
    const records = await listEnfermariaRecords(filters);
    const headers = ["Atendimento", "Data e hora", "Tipo", "Atendido", "CPF atendido", "Telefone", "Cliente ID", "Passeio ID", "Compra ID", "CPF comprador", "Local", "Demanda", "Queixa", "Sinais", "PA", "FC", "FR", "SpO2", "Temperatura", "Glicemia", "Urgência", "Conduta", "Encaminhado à UPA", "Motivo UPA", "Destino UPA", "Relatório enfermeiro", "Relatório técnico", "Observações", "Profissional", "Status", "Criado por", "Editado por", "Encerrado por"];
    const rows = records.map((record) => {
      const identification = (record.form.identification ?? {}) as Record<string, unknown>;
      const complaint = (record.form.complaint ?? {}) as Record<string, unknown>;
      const symptoms = (record.form.symptoms ?? {}) as Record<string, unknown>;
      const vitals = (record.form.vitals ?? {}) as Record<string, unknown>;
      const urgency = (record.form.urgency ?? {}) as Record<string, unknown>;
      const referral = (record.form.referral ?? {}) as Record<string, unknown>;
      const reports = (record.form.reports ?? {}) as Record<string, unknown>;
      return [record.numberLabel, record.occurredAt, record.source, identification.name, identification.cpf, identification.phone, record.clientId, record.tripId, record.purchaseId, record.buyerCpf, record.localName, Array.isArray(complaint.demandTypes) ? complaint.demandTypes.join(", ") : "", complaint.text, Array.isArray(symptoms.items) ? symptoms.items.join(", ") : "", vitals.bloodPressure, vitals.heartRate, vitals.respiratoryRate, vitals.oxygenSaturation, vitals.temperature, vitals.glucose, record.form.urgent ? "Sim" : "Não", urgency.conduct, record.form.referralToUpa ? "Sim" : "Não", referral.reason, referral.destination, reports.nurse, reports.technician, reports.additional, record.professional, record.status, record.createdBy, record.updatedBy, record.closedBy].map(cell);
    });
    const csv = [headers, ...rows].map((row) => row.map((item) => `"${item.replaceAll('"', '""')}"`).join(";")).join("\r\n");
    return new NextResponse(`\uFEFF${csv}`, { headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="enfermaria-${url.searchParams.get("from") ?? "periodo"}.csv"`,
      "cache-control": "no-store",
    } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: { message: error instanceof Error ? error.message : "Não foi possível exportar." } }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { listEnfermariaRecords } from "@/lib/enfermaria";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

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
      return [record.numberLabel, record.occurredAt, record.source, identification.name, identification.cpf, identification.phone, record.clientId, record.tripId, record.purchaseId, record.buyerCpf, record.localName, Array.isArray(complaint.demandTypes) ? complaint.demandTypes.join(", ") : "", complaint.text, Array.isArray(symptoms.items) ? symptoms.items.join(", ") : "", vitals.bloodPressure, vitals.heartRate, vitals.respiratoryRate, vitals.oxygenSaturation, vitals.temperature, vitals.glucose, record.form.urgent ? "Sim" : "Não", urgency.conduct, record.form.referralToUpa ? "Sim" : "Não", referral.reason, referral.destination, reports.nurse, reports.technician, reports.additional, record.professional, record.status, record.createdBy, record.updatedBy, record.closedBy].map((value) => String(value ?? ""));
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Atendimentos", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.addRow(headers);
    rows.forEach((row) => sheet.addRow(row));
    sheet.columns.forEach((column, index) => { column.width = Math.min(42, Math.max(16, headers[index].length + 3)); });
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF183E63" } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    sheet.getRow(1).height = 28;
    sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(headers.length).letter}${Math.max(1, rows.length + 1)}` };
    const file = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(file), { headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="enfermaria-${url.searchParams.get("from") ?? "periodo"}.xlsx"`,
      "cache-control": "no-store",
    } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: { message: error instanceof Error ? error.message : "Não foi possível exportar." } }, { status: 500 });
  }
}

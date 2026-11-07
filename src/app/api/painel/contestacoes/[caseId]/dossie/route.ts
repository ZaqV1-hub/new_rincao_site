import { getChargebackDossier } from "@/lib/chargeback-repository";
import { getIngressoSistemaDbDialect, getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requirePainelApiAccess(request, "vis_compra");
  if (!access.ok) return access.response;

  const { caseId: rawCaseId } = await params;
  const caseId = Number(rawCaseId);
  if (!/^\d+$/.test(rawCaseId) || caseId < 1 || caseId > 2_147_483_647) {
    return Response.json({ ok: false, error: { message: "Caso inválido." } }, { status: 400, headers: privateHeaders });
  }

  try {
    const dossier = await getChargebackDossier(caseId);
    if (!dossier) {
      return Response.json(
        { ok: false, error: { message: "Dossiê ainda não arquivado." } },
        { status: 404, headers: privateHeaders },
      );
    }

    const client = await getIngressoSistemaDbPool().connect();
    try {
      const actor = [access.session.actorName, access.session.actorCpf].filter(Boolean).join(" ");
      await registerOpsAuditLog(
        client,
        {
          origem: "contestacao",
          acao: "baixar_dossie",
          descricao: `Download do dossiê da contestação ${caseId}.`,
          motivo: "Consulta operacional no painel.",
          usuarioNome: actor || null,
          detalhes: { caseId, sha256: dossier.sha256 },
        },
        getIngressoSistemaDbDialect(),
      );
    } finally {
      client.release();
    }

    const filename = /^[a-z0-9_-]+\.pdf$/i.test(dossier.filename)
      ? dossier.filename
      : `dossie-contestacao-${caseId}.pdf`;
    return new Response(new Uint8Array(dossier.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        ...privateHeaders,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { ok: false, error: { message: "Download do dossiê indisponível." } },
      { status: 503, headers: privateHeaders },
    );
  }
}

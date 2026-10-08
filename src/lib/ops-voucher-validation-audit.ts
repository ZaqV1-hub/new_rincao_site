import type { PoolClient } from "pg";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import type { VoucherOperationInputActor, VoucherValidationRow, VoucherOperationSuccess, VoucherOperationMode } from "@/lib/ops-voucher-validation-contract";

export function buildAuditActorName(actor?: VoucherOperationInputActor | null) {
  const name = String(actor?.name ?? "").trim();
  const cpf = normalizeCpfDigits(actor?.cpf ?? "");

  if (name && cpf) {
    return `${name} (${cpf})`;
  }

  return name || cpf || null;
}

export function normalizeCpfDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D+/g, "");
}

export function getAffectedVoucherRows(
  vouchers: VoucherValidationRow[],
  affectedVoucherIds: number[],
) {
  const affectedIds = new Set(affectedVoucherIds);

  return vouchers.filter((voucher) => affectedIds.has(voucher.idvoucher));
}

export function collectAffectedAgendaIds(vouchers: VoucherValidationRow[]) {
  return Array.from(
    new Set(
      vouchers
        .map((voucher) => Number(voucher.idagenda ?? 0))
        .filter(
          (agendaId) => Number.isInteger(agendaId) && Number(agendaId) > 0,
        ),
    ),
  );
}

export function resolveAuditPurchaseId(
  vouchers: VoucherValidationRow[],
  explicitPurchaseId?: number | null,
) {
  if (Number.isInteger(explicitPurchaseId) && Number(explicitPurchaseId) > 0) {
    return Number(explicitPurchaseId);
  }

  const purchaseIds = Array.from(
    new Set(
      vouchers
        .map((voucher) => Number(voucher.idcompra ?? 0))
        .filter((purchaseId) => Number.isInteger(purchaseId) && purchaseId > 0),
    ),
  );

  return purchaseIds.length === 1 ? purchaseIds[0] : null;
}

export function buildVoucherAuditDescription(input: {
  action: VoucherOperationSuccess["action"];
  mode: VoucherOperationMode;
  affectedVoucherRows: VoucherValidationRow[];
  explicitPurchaseId?: number | null;
  schoolId?: number | null;
  agendaId?: number | null;
  requestedVoucherNumber?: string | null;
}) {
  const count = input.affectedVoucherRows.length;
  const voucherNumbers = input.affectedVoucherRows
    .map((voucher) => voucher.numvoucher ?? String(voucher.idvoucher))
    .join(", ");
  const actionLabel =
    input.action === "validate"
      ? "validado(s)"
      : input.action === "unvalidate"
        ? "desvalidado(s)"
        : "invalidado(s)";

  if (input.mode === "voucher_number") {
    return `Voucher ${input.requestedVoucherNumber ?? voucherNumbers} ${actionLabel} operacionalmente.`;
  }

  if (input.mode === "purchase") {
    const purchaseId = resolveAuditPurchaseId(
      input.affectedVoucherRows,
      input.explicitPurchaseId,
    );

    return `${count} voucher(s) ${actionLabel} operacionalmente na compra ${purchaseId ?? "-"}.`;
  }

  if (input.mode === "school_trip") {
    return `${count} voucher(s) do passeio escolar ${input.schoolId ?? "-"}:${input.agendaId ?? "-"} ${actionLabel} operacionalmente.`;
  }

  return `${count} voucher(s) ${actionLabel} operacionalmente: ${voucherNumbers}.`;
}

export function buildVoucherAuditReason(
  action: VoucherOperationSuccess["action"],
  mode: VoucherOperationMode,
) {
  if (action === "validate") {
    if (mode === "school_trip") {
      return "Validacao operacional de vouchers de passeio escolar.";
    }

    return "Validacao operacional de vouchers pelo BFF.";
  }

  if (action === "unvalidate") {
    return "Desvalidacao operacional de vouchers pelo BFF.";
  }

  return "Invalidacao operacional de vouchers pelo BFF.";
}

export async function registerVoucherOperationAuditLog(
  client: PoolClient,
  input: {
    action: VoucherOperationSuccess["action"];
    mode: VoucherOperationMode;
    actor?: VoucherOperationInputActor | null;
    vouchers: VoucherValidationRow[];
    affectedVoucherIds: number[];
    warnings?: string[];
    skippedVoucherNumbers?: string[];
    explicitPurchaseId?: number | null;
    requestedVoucherNumber?: string | null;
    schoolId?: number | null;
    agendaId?: number | null;
  },
) {
  const affectedVoucherRows = getAffectedVoucherRows(
    input.vouchers,
    input.affectedVoucherIds,
  );

  return registerOpsAuditLog(client, {
    origem: "voucher",
    acao:
      input.action === "validate"
        ? "validar"
        : input.action === "unvalidate"
          ? "desvalidar"
          : "invalidar",
    compraId: resolveAuditPurchaseId(
      affectedVoucherRows,
      input.explicitPurchaseId,
    ),
    descricao: buildVoucherAuditDescription({
      action: input.action,
      mode: input.mode,
      affectedVoucherRows,
      explicitPurchaseId: input.explicitPurchaseId,
      schoolId: input.schoolId,
      agendaId: input.agendaId,
      requestedVoucherNumber: input.requestedVoucherNumber,
    }),
    motivo: buildVoucherAuditReason(input.action, input.mode),
    usuarioNome: buildAuditActorName(input.actor),
    detalhes: {
      via: "apps/web",
      mode: input.mode,
      affectedVoucherIds: input.affectedVoucherIds,
      affectedVoucherNumbers: affectedVoucherRows.map(
        (voucher) => voucher.numvoucher ?? String(voucher.idvoucher),
      ),
      purchaseIds: Array.from(
        new Set(
          affectedVoucherRows
            .map((voucher) => Number(voucher.idcompra ?? 0))
            .filter(
              (purchaseId) =>
                Number.isInteger(purchaseId) && Number(purchaseId) > 0,
            ),
        ),
      ),
      affectedAgendaIds: collectAffectedAgendaIds(affectedVoucherRows),
      warnings: input.warnings ?? [],
      skippedVoucherNumbers: input.skippedVoucherNumbers ?? [],
      requestedVoucherNumber: input.requestedVoucherNumber ?? null,
      schoolId: input.schoolId ?? null,
      agendaId: input.agendaId ?? null,
      actor: {
        name: String(input.actor?.name ?? "").trim() || null,
        cpf: normalizeCpfDigits(input.actor?.cpf ?? "") || null,
      },
    },
  }, "postgres");
}

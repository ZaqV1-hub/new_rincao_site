import { resolveVoucherTypeLabel } from "@/lib/voucher-type-label";
import { ConfirmedPurchaseRow } from "@/lib/ticket-purchase-eligibility";
import { VoucherTicketRow, VoucherCpfSource, VoucherCodeSource, TicketValidationVoucherRow } from "@/lib/ticket-service-contract";
import { digitsOnly } from "@/lib/ticket-service-config";

export function resolveVoucherCpf(compraCpf: string | null, voucher: VoucherCpfSource) {
  const purchaseCpf = digitsOnly(compraCpf);

  if (purchaseCpf.length === 11) {
    return purchaseCpf;
  }

  const voucherCpf = digitsOnly(voucher.identificacao);

  return voucherCpf.length === 11 ? voucherCpf : "";
}

export function voucherPrefixForType(type: string | null) {
  switch (type) {
    case "norma":
    case "corte":
      return "A";
    case "infan":
      return "C";
    case "isent":
      return "I";
    case "escol":
      return "ESC-";
    case "espec":
      return "E";
    default:
      return "";
  }
}

export function normalizeVoucherCode(voucher: VoucherCodeSource) {
  const code = String(voucher.numvoucher ?? "").trim();

  if (!code || !/^\d+$/.test(code)) {
    return code;
  }

  const prefix = voucherPrefixForType(voucher.tpvoucher);

  return prefix && !code.startsWith(prefix) ? `${prefix}${code}` : code;
}

export function buildValidationTicketPayload(voucher: TicketValidationVoucherRow) {
  return {
    purchaseId: String(voucher.idcompra),
    voucherId: String(voucher.idvoucher),
    voucherCode: normalizeVoucherCode(voucher),
    numvoucher: String(voucher.numvoucher ?? ""),
    cpf: resolveVoucherCpf(voucher.cpf, voucher),
    cellphone: String(voucher.celular ?? ""),
    type: String(voucher.tpvoucher ?? ""),
    typeLabel: resolveVoucherTypeLabel({
      description: null,
      type: voucher.tpvoucher,
    }),
    purchaseLocation: voucher.tpcompra === "ponli" ? "Online" : "Bilheteria",
    purchaseDate: String(voucher.dtcompra ?? ""),
    price: String(voucher.vlunicompra ?? ""),
    tpcompra: String(voucher.tpcompra ?? ""),
    dtAgenda: String(voucher.dtagenda ?? ""),
  };
}

export function buildTicketPayload(
  purchase: ConfirmedPurchaseRow,
  vouchers: VoucherTicketRow[],
) {
  const purchaseLocation =
    purchase.tpcompra === "ponli" ? "Online" : "Bilheteria";

  return vouchers.map((voucher) => ({
    purchaseId: String(purchase.idcompra),
    voucherId: String(voucher.idvoucher),
    voucherCode: normalizeVoucherCode(voucher),
    numvoucher: String(voucher.numvoucher ?? ""),
    cpf: resolveVoucherCpf(purchase.cpf, voucher),
    cellphone: String(purchase.celular ?? ""),
    type: String(voucher.tpvoucher ?? ""),
    typeLabel: resolveVoucherTypeLabel({
      description: voucher.descricao,
      type: voucher.tpvoucher,
    }),
    purchaseLocation,
    purchaseDate: String(purchase.dtcompra ?? ""),
    price: String(voucher.vlunicompra ?? ""),
    tpcompra: String(purchase.tpcompra ?? ""),
    dtAgenda: String(voucher.dtagenda ?? ""),
  }));
}


import { Buffer } from "node:buffer";
import QRCode from "qrcode";

export const defaultTicketsApiBaseUrl =
  "https://rincaoticketapi-a8buakffcrarc3an.brazilsouth-01.azurewebsites.net";

export type TicketApiVoucherPayload = {
  purchaseId: number;
  voucherId: number;
  cpf: string;
  type: string | null;
  purchaseLocation: string;
  purchaseDate: string | null;
  price: number;
  tpcompra: string;
};

type GenerateQrCodesResponse = {
  qrcodes?: Record<string, string>;
};

export class TicketApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = "TicketApiError";
    this.code = code;
    this.status = status;
  }
}

export function getTicketsApiBaseUrl() {
  return (
    normalizeTicketsApiBaseUrl(process.env.TICKETS_API_BASE_URL) ||
    normalizeTicketsApiBaseUrl(process.env.INGRESSO_TICKET_API_BASE_URL) ||
    defaultTicketsApiBaseUrl
  );
}

function normalizeTicketsApiBaseUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

export function buildTicketsApiHeaders() {
  const headers = new Headers({
    "content-type": "application/json",
  });

  if (process.env.TICKETS_API_TESTING_ENABLED === "true") {
    headers.set("x-testing", "true");
  }

  return headers;
}

export async function generateVoucherQrcodes(
  vouchers: TicketApiVoucherPayload[],
) {
  let response: Response;

  try {
    response = await fetch(`${getTicketsApiBaseUrl()}/generate-qrcodes`, {
      method: "POST",
      headers: buildTicketsApiHeaders(),
      body: JSON.stringify({ vouchers }),
      cache: "no-store",
    });
  } catch {
    return generateLocalVoucherQrCodes(vouchers);
  }

  if (!response.ok) {
    return generateLocalVoucherQrCodes(vouchers);
  }

  const payload = (await response.json()) as GenerateQrCodesResponse;

  const remoteQrcodes = payload.qrcodes ?? {};

  return {
    ...Object.fromEntries(
      await Promise.all(
        vouchers
          .filter((voucher) => !remoteQrcodes[voucher.voucherId])
          .map(async (voucher) => [
            voucher.voucherId,
            await generateLocalVoucherQrCode(voucher),
          ]),
      ),
    ),
    ...remoteQrcodes,
  };
}

export function buildVoucherQrPayload(voucher: TicketApiVoucherPayload) {
  return JSON.stringify({
    purchaseId: voucher.purchaseId,
    voucherId: voucher.voucherId,
    cpf: voucher.cpf,
    type: voucher.type,
    purchaseLocation: voucher.purchaseLocation,
    purchaseDate: voucher.purchaseDate,
    price: voucher.price,
    tpcompra: voucher.tpcompra,
  });
}

export async function generateLocalVoucherQrCode(voucher: TicketApiVoucherPayload) {
  return QRCode.toDataURL(buildVoucherQrPayload(voucher), {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 6,
  });
}

export async function generateLocalVoucherQrCodes(vouchers: TicketApiVoucherPayload[]) {
  return Object.fromEntries(
    await Promise.all(
      vouchers.map(async (voucher) => [
        voucher.voucherId,
        await generateLocalVoucherQrCode(voucher),
      ]),
    ),
  );
}

export async function downloadImageAsDataUrl(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new TicketApiError(
      "ticket_api_asset_unavailable",
      "Não foi possível baixar o QR Code agora.",
      502,
    );
  }

  const contentType = response.headers.get("content-type") ?? "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());

  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

import { NextResponse } from "next/server";
import {
  customerApiErrorResponse,
} from "@/lib/customer-api-route";
import {
  parseDistinctPositiveIds,
  requireAuthenticatedVoucherRouteId,
} from "@/lib/customer-voucher-route";
import {
  downloadImageAsDataUrl,
  generateVoucherQrcodes,
  TicketApiError,
} from "@/lib/ticket-api";
import { renderVoucherPdfBuffer } from "@/lib/voucher-pdf";
import { getUserVoucherExportData } from "@/lib/voucher-repository";

export const runtime = "nodejs";

function parseSelectedVoucherIds(request: Request) {
  const url = new URL(request.url);
  const values = url.searchParams.getAll("voucherId");

  if (values.length === 0) {
    return [];
  }

  return parseDistinctPositiveIds(values);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ voucherId: string }> },
) {
  const route = await requireAuthenticatedVoucherRouteId(context, {
    invalidCode: "invalid_purchase_id",
    invalidMessage: "Informe um identificador de compra valido.",
  });

  if (!route.ok) {
    return route.response;
  }

  const purchaseId = route.routeId;

  const selectedVoucherIds = parseSelectedVoucherIds(request);

  if (selectedVoucherIds === null) {
    return customerApiErrorResponse(
      "invalid_voucher_selection",
      "Informe vouchers validos para exportacao.",
      400,
    );
  }

  try {
    const user = route.subject;

    const exportData = await getUserVoucherExportData(
      user.cpf,
      purchaseId,
      selectedVoucherIds,
    );

    if (!exportData) {
      return customerApiErrorResponse(
        "purchase_not_found",
        "Compra nao encontrada para esta conta.",
        404,
      );
    }

    if (!exportData.purchase.canGenerateVoucher) {
      return customerApiErrorResponse(
        "voucher_export_unavailable",
        "Esta compra nao pode gerar vouchers agora.",
        409,
      );
    }

    if (exportData.vouchers.length === 0) {
      return customerApiErrorResponse(
        "voucher_selection_empty",
        "Nenhum voucher elegivel foi selecionado para exportacao.",
        409,
      );
    }
    const qrcodeMap = exportData.isSchool
      ? {}
      : await generateVoucherQrcodes(
          exportData.vouchers.map((voucher) => ({
            purchaseId: exportData.purchase.id,
            voucherId: voucher.id,
            cpf: user.cpf,
            type: voucher.type,
            purchaseLocation: "Online",
            purchaseDate: exportData.purchase.purchaseDate,
            price: Number(voucher.unitValue ?? 0),
            tpcompra: exportData.purchase.type,
          })),
        );
    const vouchers = await Promise.all(
      exportData.vouchers.map(async (voucher) => ({
        ...voucher,
        qrCodeDataUrl: qrcodeMap[voucher.id]
          ? await downloadImageAsDataUrl(qrcodeMap[voucher.id])
          : null,
      })),
    );
    const pdfBuffer = await renderVoucherPdfBuffer({
      purchase: exportData.purchase,
      customer: {
        name: user.name,
        cpfMasked: user.cpfMasked,
      },
      vouchers,
      information: exportData.information,
      isSchool: exportData.isSchool,
    });
    const headers = new Headers();

    headers.set("content-type", "application/pdf");
    headers.set(
      "content-disposition",
      `inline; filename="voucher-${exportData.purchase.id}.pdf"`,
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    if (error instanceof TicketApiError) {
      const response = customerApiErrorResponse(
        error.code,
        error.message,
        error.status,
      );

      return response;
    }

    console.error("user-voucher-export-bff-failed", error);

    return customerApiErrorResponse(
      "voucher_export_unavailable",
      "Nao foi possivel exportar o voucher agora.",
      502,
    );
  }
}

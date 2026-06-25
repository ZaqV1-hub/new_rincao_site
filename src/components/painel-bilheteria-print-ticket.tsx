/* eslint-disable @next/next/no-img-element */

"use client";

import { useEffect } from "react";
import { EstanciaLogo } from "@/components/estancia-logo";
import type { PainelBilheteriaVoucherPrintModel } from "@/lib/painel-bilheteria";
import {
  formatPainelBilheteriaCpf,
  formatPainelBilheteriaDate,
  formatPainelBilheteriaMoney,
} from "@/lib/painel-bilheteria-format";

type Props = {
  vouchers: PainelBilheteriaVoucherPrintModel[];
};

function useAutoPrint() {
  useEffect(() => {
    const onAfterPrint = () => window.close();
    const timer = window.setTimeout(() => window.print(), 500);

    window.addEventListener("afterprint", onAfterPrint);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);
}

function PainelBilheteriaPrintTicketItem({
  voucher,
}: {
  voucher: PainelBilheteriaVoucherPrintModel;
}) {
  return (
    <article className="overflow-hidden rounded-[18px] border border-[#d7e3d2] bg-white shadow-[0_10px_28px_rgba(24,67,34,0.1)] print:border-0 print:shadow-none">
      <div className="border-b border-[#dbe7d7] bg-[linear-gradient(135deg,#1f6b36,#7bc043)] px-4 py-4 text-center">
        <div className="flex justify-center">
          <EstanciaLogo href={null} compact light className="scale-[0.82]" />
        </div>
        <div className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#2b8c46]">
          Voucher
        </div>
      </div>

      <div className="px-4 py-4 text-center">
        <h1 className="text-xl font-bold text-[#17351f]">
          Ingresso {voucher.typeLabel}
        </h1>
        <h2 className="mt-1 text-2xl font-bold text-[#17351f]">
          {voucher.voucherCode}
        </h2>

        {voucher.qrCodeUrl ? (
          <img
            src={voucher.qrCodeUrl}
            alt={`QR do voucher ${voucher.voucherId}`}
            className="mx-auto mt-3 h-[120px] w-[120px] object-contain"
          />
        ) : (
          <p className="mt-3 text-sm font-semibold text-[#9f3d2f]">
            QR Code indisponivel
          </p>
        )}

        <div className="mt-3 space-y-1 text-[13px] font-bold text-[#35503b]">
          <p>CPF: {formatPainelBilheteriaCpf(voucher.cpf)}</p>
          <p>ID da compra: {voucher.purchaseId}</p>
          <p>Origem: {voucher.purchaseLocation}</p>
          <p>Compra: {formatPainelBilheteriaDate(voucher.purchaseDate)}</p>
          <p>Visita: {formatPainelBilheteriaDate(voucher.visitDate)}</p>
          <p>Valor: {formatPainelBilheteriaMoney(voucher.price)}</p>
          <p>Validade: {formatPainelBilheteriaDate(voucher.validUntil)}</p>
        </div>
      </div>
    </article>
  );
}

export function PainelBilheteriaPrintTicket({ vouchers }: Props) {
  useAutoPrint();

  return (
    <>
      <style jsx global>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }

        @media print {
          body {
            margin: 0;
            background: #ffffff;
          }
        }
      `}</style>

      <main className="min-h-screen bg-[#f4f6f1] px-3 py-4 print:bg-white print:px-0 print:py-0">
        <div className="mx-auto flex w-[80mm] flex-col gap-3">
          {vouchers.map((voucher) => (
            <PainelBilheteriaPrintTicketItem
              key={voucher.voucherId}
              voucher={voucher}
            />
          ))}
        </div>
      </main>
    </>
  );
}

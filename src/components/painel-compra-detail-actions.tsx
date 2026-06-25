"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type PainelCompraDetailActionsProps = {
  purchaseId: number;
  voucherIds: number[];
  actorName: string | null;
  actorCpf: string | null;
  canManageHistory: boolean;
};

async function readErrorPayload(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as {
      error?: {
        message?: string;
      };
    };

    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export function PainelCompraDetailActions({
  purchaseId,
  voucherIds,
  actorName,
  actorCpf,
  canManageHistory,
}: PainelCompraDetailActionsProps) {
  const router = useRouter();
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [whatsappSuccess, setWhatsappSuccess] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);
  const editHref = useMemo(
    () => `/painel/bilheteria/historico?purchase=${purchaseId}&mode=edit`,
    [purchaseId],
  );

  async function handleSendWhatsapp() {
    setSendingWhatsapp(true);
    setWhatsappError(null);
    setWhatsappSuccess(null);

    try {
      const response = await fetch(
        `/api/painel/bilheteria/purchases/${purchaseId}/whatsapp`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber: whatsappPhone,
            voucherIds,
            actor: {
              name: actorName,
              cpf: actorCpf,
            },
          }),
        },
      );

      if (!response.ok) {
        setWhatsappError(
          await readErrorPayload(
            response,
            "Nao foi possivel enviar os ingressos por WhatsApp agora.",
          ),
        );
        return;
      }

      setWhatsappSuccess("Ingressos enviados por WhatsApp com sucesso.");
      setWhatsappOpen(false);
      router.refresh();
    } finally {
      setSendingWhatsapp(false);
    }
  }

  async function handleCancelPurchase() {
    setCancelling(true);
    setCancelError(null);
    setCancelSuccess(null);

    try {
      const response = await fetch("/api/painel/bilheteria/purchases/cancel", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          purchaseId,
          reason: cancelReason,
          actor: {
            name: actorName,
            cpf: actorCpf,
          },
        }),
      });

      if (!response.ok) {
        setCancelError(
          await readErrorPayload(
            response,
            "Nao foi possivel cancelar a compra agora.",
          ),
        );
        return;
      }

      setCancelSuccess("Compra cancelada com sucesso.");
      setCancelOpen(false);
      router.refresh();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <div className="rounded-[6px] border border-[#d4dde5] bg-white p-5 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
        <h2 className="text-lg font-semibold text-[#205a7f]">Microacoes</h2>
        <div className="mt-4 grid gap-3 text-sm">
          <a
            className="inline-flex items-center justify-center rounded-full bg-[#246b99] px-4 py-2 font-semibold text-white"
            href={`/painel/bilheteria/compras/${purchaseId}/imprimir`}
            rel="noreferrer"
            target="_blank"
          >
            Imprimir QR-Codes
          </a>
          <button
            className="inline-flex items-center justify-center rounded-full bg-[#25D366] px-4 py-2 font-semibold text-white disabled:opacity-60"
            disabled={voucherIds.length === 0}
            onClick={() => setWhatsappOpen(true)}
            type="button"
          >
            Enviar por WhatsApp
          </button>
          {canManageHistory ? (
            <a
              className="inline-flex items-center justify-center rounded-full border border-[#c9d8e3] px-4 py-2 font-semibold text-[#205a7f]"
              href={editHref}
            >
              Editar venda
            </a>
          ) : null}
          {canManageHistory ? (
            <button
              className="inline-flex items-center justify-center rounded-full bg-[#9f3d2f] px-4 py-2 font-semibold text-white"
              onClick={() => setCancelOpen(true)}
              type="button"
            >
              Cancelar compra
            </button>
          ) : null}
        </div>

        {whatsappSuccess ? (
          <div className="mt-4 rounded-[18px] border border-[#b9dec6] bg-[#eefaf2] px-4 py-3 text-sm text-[#286445]">
            {whatsappSuccess}
          </div>
        ) : null}

        {cancelSuccess ? (
          <div className="mt-4 rounded-[18px] border border-[#b9dec6] bg-[#eefaf2] px-4 py-3 text-sm text-[#286445]">
            {cancelSuccess}
          </div>
        ) : null}
      </div>

      {whatsappOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#12334a]/40 px-4">
          <div className="w-full max-w-[520px] rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(18,51,74,0.24)]">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-[32px] font-semibold text-[#205a7f]">
                Enviar ingressos por WhatsApp
              </h3>
              <button
                className="rounded-full border border-[#d6e0e8] px-4 py-2 text-sm font-semibold text-[#4c6a81]"
                onClick={() => setWhatsappOpen(false)}
                type="button"
              >
                Fechar
              </button>
            </div>
            <label className="mt-6 grid gap-2 text-sm font-semibold text-[#345062]">
              Telefone com DDD
              <input
                className="rounded-[18px] border border-[#c9d8e3] bg-white px-4 py-3 text-base text-[#1b3447]"
                onChange={(event) => setWhatsappPhone(event.target.value)}
                placeholder="11999999999"
                type="text"
                value={whatsappPhone}
              />
            </label>
            {whatsappError ? (
              <div className="mt-4 rounded-[18px] border border-[#f0bbb1] bg-[#fff2ef] px-4 py-3 text-sm text-[#9f3d2f]">
                {whatsappError}
              </div>
            ) : null}
            <button
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#25D366] px-5 py-4 text-lg font-semibold text-white disabled:opacity-60"
              disabled={sendingWhatsapp || whatsappPhone.trim() === ""}
              onClick={() => void handleSendWhatsapp()}
              type="button"
            >
              {sendingWhatsapp ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </div>
      ) : null}

      {cancelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#12334a]/40 px-4">
          <div className="w-full max-w-[520px] rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(18,51,74,0.24)]">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-[32px] font-semibold text-[#205a7f]">
                Cancelar compra
              </h3>
              <button
                className="rounded-full border border-[#d6e0e8] px-4 py-2 text-sm font-semibold text-[#4c6a81]"
                onClick={() => setCancelOpen(false)}
                type="button"
              >
                Fechar
              </button>
            </div>
            <label className="mt-6 grid gap-2 text-sm font-semibold text-[#345062]">
              Motivo da exclusao
              <textarea
                className="rounded-[18px] border border-[#c9d8e3] bg-white px-4 py-3 text-base text-[#1b3447]"
                onChange={(event) => setCancelReason(event.target.value)}
                rows={4}
                value={cancelReason}
              />
            </label>
            {cancelError ? (
              <div className="mt-4 rounded-[18px] border border-[#f0bbb1] bg-[#fff2ef] px-4 py-3 text-sm text-[#9f3d2f]">
                {cancelError}
              </div>
            ) : null}
            <button
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#9f3d2f] px-5 py-4 text-lg font-semibold text-white disabled:opacity-60"
              disabled={cancelling || cancelReason.trim() === ""}
              onClick={() => void handleCancelPurchase()}
              type="button"
            >
              {cancelling ? "Cancelando..." : "Confirmar cancelamento"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import type { SchoolContractApproval } from "@/lib/school-contracts";

type SchoolContractApprovalPageProps = {
  approval: SchoolContractApproval;
};

type ApiPayload =
  | {
      ok?: boolean;
      data?: {
        message?: string;
      };
      error?: {
        message?: string;
      };
    }
  | null;

function getStatusMessage(approval: SchoolContractApproval) {
  if (approval.status === "expired") {
    return "Este link expirou.";
  }

  if (approval.status === "confirmed") {
    const confirmedBy = [approval.confirmerName, approval.confirmerRole]
      .filter(Boolean)
      .join(" - ");

    if (confirmedBy) {
      return `Este passeio já foi confirmado por ${confirmedBy} em ${approval.confirmedAt ?? "data anterior"}.`;
    }

    return `Este passeio já foi confirmado em ${approval.confirmedAt ?? "data anterior"}.`;
  }

  if (approval.status === "invalidated") {
    return "Este link foi invalidado por um envio mais recente.";
  }

  return null;
}

export function SchoolContractApprovalPage({
  approval,
}: SchoolContractApprovalPageProps) {
  const [confirmerName, setConfirmerName] = useState("");
  const [confirmerRole, setConfirmerRole] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const statusMessage = getStatusMessage(approval);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/contrato/aprovacao/${approval.token}`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          confirmerName,
          confirmerRole,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error?.message || "Não foi possível confirmar o agendamento.",
        );
      }

      setSuccessMessage(payload.data?.message || "Passeio agendado com sucesso.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar o agendamento.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const shouldShowConfirmedState = approval.status === "confirmed" && !successMessage;

  return (
    <main className="min-h-screen bg-[#f4f8fc] text-[#133d63]">
      <header className="border-b border-[#d9e3eb] bg-white px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#55718a]">
            Clube Rincão
          </p>
          <Link
            className="rounded-[6px] border border-[#c9d8e3] px-4 py-2 text-sm font-bold text-[#246b99] transition hover:bg-[#f4f8fc]"
            href="/"
          >
            Voltar para o site
          </Link>
        </div>
      </header>

      <div className="px-4 py-6 md:px-8">
        <div className="mx-auto max-w-4xl">
          <header className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#55718a]">
              Confirmação digital
            </p>
            <h1 className="mt-2 text-3xl font-bold">Agendamento de passeio escolar</h1>
          </header>

          <section className="rounded-[8px] border border-[#d9e3eb] bg-white p-5 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#55718a]">
                  Escola
                </p>
                <p className="mt-1 text-xl font-bold">{approval.schoolName}</p>
                {approval.schoolAddress ? (
                  <p className="mt-1 text-sm text-[#55718a]">{approval.schoolAddress}</p>
                ) : null}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#55718a]">
                  Data do passeio
                </p>
                <p className="mt-1 text-xl font-bold">{approval.visitDateLabel}</p>
              </div>
              {approval.negotiatedValueLabel ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#55718a]">
                    Valor negociado
                  </p>
                  <p className="mt-1 text-xl font-bold">{approval.negotiatedValueLabel}</p>
                </div>
              ) : null}
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#55718a]">
                  Representante
                </p>
                <p className="mt-1 font-semibold">{approval.representativeName}</p>
                <p className="text-sm text-[#55718a]">{approval.representativeEmail}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#55718a]">
                  Responsável
                </p>
                <p className="mt-1 font-semibold">{approval.responsibleName}</p>
                <p className="text-sm text-[#55718a]">{approval.responsibleEmail}</p>
              </div>
            </div>

            {approval.observation ? (
              <div className="mt-5 rounded-[8px] border border-[#d9e3eb] bg-[#f8fbfd] p-4 text-sm">
                {approval.observation}
              </div>
            ) : null}
          </section>

          <section className="mt-5 rounded-[8px] border border-[#d9e3eb] bg-white p-5 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Contrato do passeio</h2>
              <Link
                className="rounded-[6px] border border-[#c9d8e3] px-4 py-2 text-sm font-bold text-[#246b99] transition hover:bg-[#f4f8fc]"
                href={approval.contractPdfUrl}
                rel="noreferrer"
                target="_blank"
              >
                Abrir PDF
              </Link>
            </div>
            <iframe
              className="mt-4 min-h-[640px] w-full rounded-[8px] border border-[#d9e3eb]"
              src={approval.contractPdfUrl}
              title="Contrato de passeio escolar"
            />
          </section>

          {successMessage ? (
            <section className="mt-5 rounded-[8px] border border-[#bbf7d0] bg-[#f0fdf4] p-5 text-sm font-semibold text-[#166534]">
              {successMessage}
            </section>
          ) : null}

          {statusMessage && !successMessage ? (
            <section className="mt-5 rounded-[8px] border border-[#fecaca] bg-[#fff1f2] p-5 text-sm font-semibold text-[#991b1b]">
              {statusMessage}
            </section>
          ) : null}

          {shouldShowConfirmedState ? (
            <section className="mt-5 rounded-[8px] border border-[#d9e3eb] bg-white p-5 text-sm text-[#345062] shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
              <p>
                <strong>Confirmado por:</strong>{" "}
                {approval.confirmerName ?? "Não identificado"}
              </p>
              <p className="mt-2">
                <strong>Cargo:</strong> {approval.confirmerRole ?? "-"}
              </p>
              <p className="mt-2">
                <strong>Data:</strong> {approval.confirmedAt ?? "-"}
              </p>
            </section>
          ) : null}

          {errorMessage ? (
            <section className="mt-5 rounded-[8px] border border-[#fecaca] bg-[#fff1f2] p-5 text-sm font-semibold text-[#991b1b]">
              {errorMessage}
            </section>
          ) : null}

          {approval.status === "ready" && !successMessage ? (
            <form
              className="mt-5 grid gap-4 rounded-[8px] border border-[#d9e3eb] bg-white p-5 shadow-[0_12px_34px_rgba(31,67,98,0.08)] md:grid-cols-2"
              onSubmit={handleSubmit}
            >
              <label className="grid gap-2 text-sm font-semibold">
                <span>Nome de quem confirma</span>
                <input
                  className="h-11 rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                  onChange={(event) => setConfirmerName(event.target.value)}
                  required
                  value={confirmerName}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                <span>Cargo</span>
                <input
                  className="h-11 rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                  onChange={(event) => setConfirmerRole(event.target.value)}
                  required
                  value={confirmerRole}
                />
              </label>
              <div className="flex justify-end md:col-span-2">
                <button
                  className="h-11 rounded-[6px] bg-[#246b99] px-5 text-sm font-bold text-white disabled:opacity-70"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Confirmando..." : "Confirmar agendamento"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  );
}

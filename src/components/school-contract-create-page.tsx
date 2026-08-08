"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SchoolContractOptions } from "@/lib/school-contracts";

type SchoolContractCreatePageProps = {
  options: SchoolContractOptions;
};

type ApiPayload =
  | {
      ok?: boolean;
      data?: {
        approvalPath?: string;
        message?: string;
      };
      error?: {
        message?: string;
      };
    }
  | null;

export function SchoolContractCreatePage({
  options,
}: SchoolContractCreatePageProps) {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState("");
  const [isNewSchool, setIsNewSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState("");
  const [representativeId, setRepresentativeId] = useState("");
  const [isNewRepresentative, setIsNewRepresentative] = useState(false);
  const [representativeName, setRepresentativeName] = useState("");
  const [representativeEmail, setRepresentativeEmail] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [observation, setObservation] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [responsiblePhone, setResponsiblePhone] = useState("");
  const [responsibleEmail, setResponsibleEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedSchoolId = Number(schoolId);
  const representatives = useMemo(
    () =>
      options.representatives.filter(
        (representative) => representative.schoolId === selectedSchoolId,
      ),
    [options.representatives, selectedSchoolId],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      const response = await fetch("/api/contrato", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          schoolId: isNewSchool ? null : schoolId,
          newSchoolName: isNewSchool ? newSchoolName : "",
          visitDate,
          representativeId: isNewRepresentative ? null : representativeId,
          representativeName: isNewRepresentative ? representativeName : "",
          representativeEmail: isNewRepresentative ? representativeEmail : "",
          observation,
          responsibleName,
          responsiblePhone,
          responsibleEmail,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      if (!response.ok || !payload?.ok || !payload.data?.approvalPath) {
        throw new Error(
          payload?.error?.message || "Nao foi possivel enviar o contrato agora.",
        );
      }

      setMessage(payload.data.message || "E-mail enviado.");
      router.push(payload.data.approvalPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel enviar o contrato agora.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f8fc] px-4 py-6 text-[#133d63] md:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#55718a]">
            Contrato escolar
          </p>
          <h1 className="mt-2 text-3xl font-bold">Novo agendamento</h1>
        </header>

        {message ? (
          <div className="mb-4 rounded-[8px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1d4f91]">
            {message}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-4 rounded-[8px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#991b1b]">
            {errorMessage}
          </div>
        ) : null}

        <form
          className="grid gap-5 rounded-[8px] border border-[#d9e3eb] bg-white p-5 shadow-[0_12px_34px_rgba(31,67,98,0.08)]"
          onSubmit={handleSubmit}
        >
          <section className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              <span>Escola</span>
              <select
                className="h-11 rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                disabled={isNewSchool}
                onChange={(event) => {
                  setSchoolId(event.target.value);
                  setRepresentativeId("");
                }}
                value={schoolId}
              >
                <option value="">Selecione...</option>
                {options.schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-7 flex items-center gap-3 text-sm font-semibold">
              <input
                checked={isNewSchool}
                onChange={(event) => {
                  setIsNewSchool(event.target.checked);
                  setSchoolId("");
                  setRepresentativeId("");
                  setIsNewRepresentative(true);
                }}
                type="checkbox"
              />
              Adicionar nova escola
            </label>

            {isNewSchool ? (
              <label className="grid gap-2 text-sm font-semibold md:col-span-2">
                <span>Nome da nova escola</span>
                <input
                  className="h-11 rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                  onChange={(event) => setNewSchoolName(event.target.value)}
                  value={newSchoolName}
                />
              </label>
            ) : null}

            <label className="grid gap-2 text-sm font-semibold">
              <span>Data do passeio</span>
              <input
                className="h-11 rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                onChange={(event) => setVisitDate(event.target.value)}
                type="date"
                value={visitDate}
              />
            </label>
          </section>

          <section className="grid gap-4 border-t border-[#d9e3eb] pt-5 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              <span>Representante da escola</span>
              <select
                className="h-11 rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                disabled={isNewRepresentative || isNewSchool || !schoolId}
                onChange={(event) => setRepresentativeId(event.target.value)}
                value={representativeId}
              >
                <option value="">Selecione...</option>
                {representatives.map((representative) => (
                  <option key={representative.id} value={representative.id}>
                    {representative.name} - {representative.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-7 flex items-center gap-3 text-sm font-semibold">
              <input
                checked={isNewRepresentative}
                onChange={(event) => {
                  setIsNewRepresentative(event.target.checked);
                  setRepresentativeId("");
                }}
                type="checkbox"
              />
              Adicionar novo representante
            </label>

            {isNewRepresentative || isNewSchool ? (
              <>
                <label className="grid gap-2 text-sm font-semibold">
                  <span>Nome do representante</span>
                  <input
                    className="h-11 rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                    onChange={(event) => setRepresentativeName(event.target.value)}
                    value={representativeName}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  <span>E-mail do representante</span>
                  <input
                    className="h-11 rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                    onChange={(event) => setRepresentativeEmail(event.target.value)}
                    type="email"
                    value={representativeEmail}
                  />
                </label>
              </>
            ) : null}
          </section>

          <section className="grid gap-4 border-t border-[#d9e3eb] pt-5 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold">
              <span>Nome do responsavel</span>
              <input
                className="h-11 rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                onChange={(event) => setResponsibleName(event.target.value)}
                value={responsibleName}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              <span>Telefone do responsavel</span>
              <input
                className="h-11 rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                onChange={(event) => setResponsiblePhone(event.target.value)}
                value={responsiblePhone}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              <span>E-mail do responsavel</span>
              <input
                className="h-11 rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                onChange={(event) => setResponsibleEmail(event.target.value)}
                type="email"
                value={responsibleEmail}
              />
            </label>
          </section>

          <label className="grid gap-2 border-t border-[#d9e3eb] pt-5 text-sm font-semibold">
            <span>Observacao</span>
            <textarea
              className="min-h-28 rounded-[6px] border border-[#c9d8e3] px-3 py-3 text-sm"
              onChange={(event) => setObservation(event.target.value)}
              value={observation}
            />
          </label>

          <div className="flex justify-end">
            <button
              className="h-11 rounded-[6px] bg-[#246b99] px-5 text-sm font-bold text-white disabled:opacity-70"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Enviando..." : "Enviar contrato"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

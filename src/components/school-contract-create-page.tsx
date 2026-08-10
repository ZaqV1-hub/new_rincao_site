"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  SchoolContractActor,
  SchoolContractOptions,
} from "@/lib/school-contracts";

type SchoolContractCreatePageProps = {
  options: SchoolContractOptions;
  actor: SchoolContractActor;
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
  actor,
}: SchoolContractCreatePageProps) {
  const router = useRouter();
  const isRepresentativeSession = actor.roleId === 4;
  const [schoolId, setSchoolId] = useState("");
  const [schoolSearch, setSchoolSearch] = useState("");
  const [isSchoolListOpen, setIsSchoolListOpen] = useState(false);
  const [isNewSchool, setIsNewSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [representativeId, setRepresentativeId] = useState("");
  const [isNewRepresentative, setIsNewRepresentative] = useState(false);
  const [representativeName, setRepresentativeName] = useState(actor.name);
  const [representativeEmail, setRepresentativeEmail] = useState(actor.email);
  const [observation, setObservation] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [responsiblePhone, setResponsiblePhone] = useState("");
  const [responsibleEmail, setResponsibleEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedSchoolName = useMemo(
    () => options.schools.find((school) => String(school.id) === schoolId)?.name ?? "",
    [options.schools, schoolId],
  );

  const filteredSchools = useMemo(() => {
    const query = schoolSearch.trim().toLowerCase();

    if (!query) {
      return options.schools.slice(0, 12);
    }

    return options.schools
      .filter((school) => school.name.toLowerCase().includes(query))
      .slice(0, 20);
  }, [options.schools, schoolSearch]);

  const filteredRepresentatives = useMemo(
    () =>
      options.representatives.filter(
        (representative) => String(representative.schoolId) === schoolId,
      ),
    [options.representatives, schoolId],
  );

  const shouldShowRepresentativeFields =
    !isRepresentativeSession &&
    (isNewSchool || isNewRepresentative || filteredRepresentatives.length === 0);

  useEffect(() => {
    if (selectedSchoolName && !isNewSchool) {
      setSchoolSearch(selectedSchoolName);
    }
  }, [isNewSchool, selectedSchoolName]);

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
          representativeId:
            shouldShowRepresentativeFields || isNewSchool ? null : representativeId,
          representativeName:
            shouldShowRepresentativeFields || isRepresentativeSession
              ? representativeName
              : "",
          representativeEmail:
            shouldShowRepresentativeFields || isRepresentativeSession
              ? representativeEmail
              : "",
          observation,
          responsibleName,
          responsiblePhone,
          responsibleEmail,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      if (!response.ok || !payload?.ok || !payload.data?.approvalPath) {
        throw new Error(
          payload?.error?.message || "Não foi possível enviar o contrato agora.",
        );
      }

      setMessage(payload.data.message || "E-mail enviado.");
      router.push(payload.data.approvalPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o contrato agora.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f8fc] text-[#133d63]">
      <header className="border-b border-[#d9e3eb] bg-white px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
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
                <div className="relative">
                  <input
                    className="h-11 w-full rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                    disabled={isNewSchool}
                    onChange={(event) => {
                      setSchoolSearch(event.target.value);
                      setSchoolId("");
                      setRepresentativeId("");
                      setIsNewRepresentative(false);
                      setIsSchoolListOpen(true);
                    }}
                    onFocus={() => {
                      if (!isNewSchool) {
                        setIsSchoolListOpen(true);
                      }
                    }}
                    placeholder="Digite para buscar a escola"
                    value={isNewSchool ? "" : schoolSearch}
                  />

                  {!isNewSchool && isSchoolListOpen ? (
                    <div className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-[6px] border border-[#c9d8e3] bg-white shadow-[0_12px_30px_rgba(31,67,98,0.12)]">
                      {filteredSchools.length > 0 ? (
                        filteredSchools.map((school) => (
                          <button
                            key={school.id}
                            className="block w-full border-b border-[#eef3f7] px-3 py-2 text-left text-sm text-[#133d63] last:border-b-0 hover:bg-[#f4f8fc]"
                            onClick={() => {
                              setSchoolId(String(school.id));
                              setSchoolSearch(school.name);
                              setRepresentativeId("");
                              setIsNewRepresentative(false);
                              setIsSchoolListOpen(false);
                            }}
                            type="button"
                          >
                            {school.name}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-[#55718a]">
                          Nenhuma escola encontrada.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </label>

              <label className="mt-7 flex items-center gap-3 text-sm font-semibold">
                <input
                  checked={isNewSchool}
                  onChange={(event) => {
                    setIsNewSchool(event.target.checked);
                    setSchoolId("");
                    setSchoolSearch("");
                    setRepresentativeId("");
                    setIsNewRepresentative(event.target.checked && !isRepresentativeSession);
                    setIsSchoolListOpen(false);
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
              {!isRepresentativeSession && !shouldShowRepresentativeFields ? (
                <label className="grid gap-2 text-sm font-semibold">
                  <span>Representante da escola</span>
                  <select
                    className="h-11 rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                    onChange={(event) => setRepresentativeId(event.target.value)}
                    value={representativeId}
                  >
                    <option value="">Selecione...</option>
                    {filteredRepresentatives.map((representative) => (
                      <option key={representative.id} value={representative.id}>
                        {representative.name} - {representative.email}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {!isRepresentativeSession &&
              !isNewSchool &&
              filteredRepresentatives.length > 0 ? (
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
              ) : null}

              {shouldShowRepresentativeFields ? (
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

            <section className="rounded-[8px] border border-[#d9e3eb] bg-[#f8fbfd] px-4 py-3 text-sm text-[#345062]">
              O representante ou responsável confirma depois pelo link de aprovação.
              {selectedSchoolName ? ` Escola selecionada: ${selectedSchoolName}.` : ""}
            </section>

            <section className="grid gap-4 border-t border-[#d9e3eb] pt-5 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-semibold">
                <span>Nome do responsável</span>
                <input
                  className="h-11 rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                  onChange={(event) => setResponsibleName(event.target.value)}
                  value={responsibleName}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                <span>Telefone do responsável</span>
                <input
                  className="h-11 rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                  onChange={(event) => setResponsiblePhone(event.target.value)}
                  value={responsiblePhone}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                <span>E-mail do responsável</span>
                <input
                  className="h-11 rounded-[6px] border border-[#c9d8e3] px-3 text-sm"
                  onChange={(event) => setResponsibleEmail(event.target.value)}
                  type="email"
                  value={responsibleEmail}
                />
              </label>
            </section>

            <label className="grid gap-2 border-t border-[#d9e3eb] pt-5 text-sm font-semibold">
              <span>Observação</span>
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
      </div>
    </main>
  );
}

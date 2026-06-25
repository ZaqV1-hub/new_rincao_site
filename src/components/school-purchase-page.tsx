"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { IngressoShell } from "@/components/ingresso-shell";
import type { AuthUser } from "@/lib/auth-contracts";
import type {
  SchoolPurchaseContext,
  SchoolOption,
  SchoolPurchasePreset,
} from "@/lib/school-purchase-repository";

type SchoolPurchasePageProps = {
  user: AuthUser | null;
  preset?: SchoolPurchasePreset | null;
  mode?: "student" | "educator";
};

type SchoolPurchasePayload = {
  participantType: "student" | "educator";
  schoolId: number | null;
  schoolName: string;
  studentName: string;
  educationType: string;
  educationYear: string;
  classLetter: string;
  educatorName: string;
  educatorRole: string;
  agendaId: number | null;
  value: string;
};

type SchoolSearchResponse = {
  ok: true;
  data: {
    schools: SchoolOption[];
  };
};

type SchoolContextResponse = {
  ok: true;
  data: SchoolPurchaseContext;
};

type ErrorResponse = {
  ok: false;
  error: {
    message: string;
  };
};

type CreatePurchaseResponse = {
  ok: true;
  data: {
    checkoutRedirect: string;
  };
};

const educatorRoleOptions = ["Coordenador", "Diretor", "Professor", "Outros"];

function createEmptyPayload(
  participantType: "student" | "educator",
): SchoolPurchasePayload {
  return {
    participantType,
    schoolId: null,
    schoolName: "",
    studentName: "",
    educationType: "",
    educationYear: "",
    classLetter: "",
    educatorName: "",
    educatorRole: "",
    agendaId: null,
    value: "",
  };
}

function readDraftFromSessionStorage(mode: "student" | "educator") {
  if (typeof window === "undefined") {
    return null;
  }

  const savedDraft = window.sessionStorage.getItem(`school-purchase-draft:${mode}`);

  if (!savedDraft) {
    return null;
  }

  try {
    return JSON.parse(savedDraft) as SchoolPurchasePayload;
  } catch (draftError) {
    console.error("school-purchase-draft-restore-failed", draftError);
    return null;
  }
}

async function readResponseBody<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function SchoolPurchasePage({
  user,
  preset = null,
  mode = "student",
}: SchoolPurchasePageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialDraft = readDraftFromSessionStorage(mode);
  const hasPreset = preset !== null;
  const isEducator = mode === "educator";
  const labels = isEducator
    ? {
        title: "Passeio Estudantil - Compra Online (Educador)",
        subtitle: "Selecione a unidade escolar, informe os dados do educador e conclua o pagamento online.",
        roleCardTitle: "Funcao do educador",
        roleCardBody: "Selecione a funcao conforme o fluxo legado para gerar o voucher escolar correto.",
        formTitle: "Preencha os dados do educador",
        formDescription: "O pagamento segue para o checkout seguro assim que a compra escolar for criada.",
        participantLabel: "Nome do Educador",
        participantErrorFallback: "Nao foi possivel iniciar a compra do educador agora.",
        schoolSearchPlaceholder: "Digite ao menos 2 letras",
        contextSummary: "Selecione a escola para carregar as datas de passeio abertas.",
      }
    : {
        title: "Passeio Estudantil - Compra Online",
        subtitle: "Selecione a unidade escolar, informe os dados do aluno e conclua o pagamento online.",
        roleCardTitle: "Valor da autorizacao",
        roleCardBody: "Informe o valor exato do passeio conforme a autorizacao enviada pela escola.",
        formTitle: "Preencha os dados",
        formDescription: "O pagamento segue para o checkout seguro assim que a compra escolar for criada.",
        participantLabel: "Nome do Aluno",
        participantErrorFallback: "Nao foi possivel iniciar a compra estudantil agora.",
        schoolSearchPlaceholder: "Digite ao menos 2 letras",
        contextSummary: "Selecione a escola para carregar as datas de passeio abertas.",
      };
  const [payload, setPayload] = useState<SchoolPurchasePayload>(() => ({
    ...createEmptyPayload(mode),
    ...initialDraft,
    participantType: mode,
    schoolId: preset?.schoolId ?? initialDraft?.schoolId ?? null,
    schoolName: preset?.schoolName ?? initialDraft?.schoolName ?? "",
    agendaId: preset?.agendaId ?? initialDraft?.agendaId ?? null,
  }));
  const [schoolSearchTerm, setSchoolSearchTerm] = useState(
    preset?.schoolName ?? initialDraft?.schoolName ?? "",
  );
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([]);
  const [context, setContext] = useState<SchoolPurchaseContext | null>(null);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [loadingContext, setLoadingContext] = useState(
    Boolean(preset?.schoolId ?? initialDraft?.schoolId),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoredDraft] = useState(Boolean(initialDraft));

  const selectedEducationType = useMemo(
    () =>
      context?.educationStructure.types.find(
        (educationType) => educationType.id === payload.educationType,
      ) ?? null,
    [context, payload.educationType],
  );

  useEffect(() => {
    if (!payload.schoolId) {
      return;
    }

    let cancelled = false;

    fetch(`/api/escola/${payload.schoolId}/context`)
      .then(async (response) => {
        const responseBody = await readResponseBody<SchoolContextResponse | ErrorResponse>(
          response,
        );

        if (!response.ok || !responseBody || !responseBody.ok) {
          throw new Error(
            responseBody && !responseBody.ok
              ? responseBody.error.message
              : "Nao foi possivel carregar as datas do passeio agora.",
          );
        }

        if (cancelled) {
          return;
        }

        setContext(responseBody.data);
        setPayload((current) => {
          const agendaStillValid = responseBody.data.dates.some(
            (tripDate) => tripDate.agendaId === current.agendaId,
          );

          return {
            ...current,
            schoolName: responseBody.data.schoolName,
            agendaId: agendaStillValid ? current.agendaId : null,
          };
        });
        setSchoolSearchTerm(responseBody.data.schoolName);
      })
      .catch((contextError) => {
        if (cancelled) {
          return;
        }

        console.error("school-purchase-context-load-failed", contextError);
        setContext(null);
        setError(
          contextError instanceof Error
            ? contextError.message
            : "Nao foi possivel carregar as datas do passeio agora.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingContext(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [payload.schoolId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (
      hasPreset ||
      schoolSearchTerm.trim().length < 2 ||
      payload.schoolName === schoolSearchTerm
    ) {
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      setLoadingSchools(true);

      fetch(`/api/escola/search?term=${encodeURIComponent(schoolSearchTerm.trim())}`)
        .then(async (response) => {
          const responseBody = await readResponseBody<
            SchoolSearchResponse | ErrorResponse
          >(response);

          if (!response.ok || !responseBody || !responseBody.ok) {
            throw new Error(
              responseBody && !responseBody.ok
                ? responseBody.error.message
                : "Nao foi possivel buscar escolas agora.",
            );
          }

          setSchoolOptions(responseBody.data.schools);
        })
        .catch((searchError) => {
          console.error("school-purchase-school-search-failed", searchError);
          setSchoolOptions([]);
        })
        .finally(() => {
          setLoadingSchools(false);
        });
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [hasPreset, payload.schoolName, schoolSearchTerm]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!restoredDraft) {
      return;
    }

    window.sessionStorage.setItem(
      `school-purchase-draft:${mode}`,
      JSON.stringify(payload),
    );
  }, [mode, payload, restoredDraft]);

  function updatePayload<K extends keyof SchoolPurchasePayload>(
    key: K,
    value: SchoolPurchasePayload[K],
  ) {
    setPayload((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetSchoolSelection() {
    if (hasPreset) {
      return;
    }

    setLoadingContext(false);
    setPayload((current) => ({
      ...current,
      schoolId: null,
      schoolName: "",
      agendaId: null,
    }));
    setContext(null);
    setSchoolOptions([]);
  }

  function selectSchool(option: SchoolOption) {
    if (hasPreset) {
      return;
    }

    setError(null);
    setLoadingContext(true);
    setSchoolOptions([]);
    setPayload((current) => ({
      ...current,
      schoolId: option.id,
      schoolName: option.name,
      agendaId: null,
    }));
    setSchoolSearchTerm(option.name);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!payload.schoolId || !payload.agendaId) {
      setError("Selecione a escola e a data do passeio para continuar.");
      return;
    }

    if (!user) {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          `school-purchase-draft:${mode}`,
          JSON.stringify(payload),
        );
      }

      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/escola/purchases", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(
          isEducator
            ? {
                schoolId: payload.schoolId,
                agendaId: payload.agendaId,
                value: payload.value,
                participantType: "educator",
                educatorName: payload.educatorName,
                educatorRole: payload.educatorRole,
              }
            : {
                schoolId: payload.schoolId,
                studentName: payload.studentName,
                educationType: payload.educationType,
                educationYear: payload.educationYear,
                classLetter: payload.classLetter,
                agendaId: payload.agendaId,
                value: payload.value,
              },
        ),
      });
      const responseBody = await readResponseBody<
        CreatePurchaseResponse | ErrorResponse
      >(response);

      if (response.status === 401) {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            `school-purchase-draft:${mode}`,
            JSON.stringify(payload),
          );
        }

        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      if (!response.ok || !responseBody || !responseBody.ok) {
        setError(
          responseBody && !responseBody.ok
            ? responseBody.error.message
            : labels.participantErrorFallback,
        );
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(`school-purchase-draft:${mode}`);
      }

      router.replace(responseBody.data.checkoutRedirect);
      router.refresh();
    } catch (requestError) {
      console.error("school-purchase-submit-failed", requestError);
      setError(labels.participantErrorFallback);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <IngressoShell active="buy" user={user}>
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-12 pt-8 md:px-6">
        <h1 className="legacy-rounded text-center text-[26px] text-[#3393d6] sm:text-[34px]">
          {labels.title}
        </h1>

        {error ? (
          <div className="mx-auto mt-5 max-w-[1100px] rounded-[12px] border border-[#efc3c3] bg-[#fff3f1] px-4 py-3 text-sm text-[#9f3f36]">
            {error}
          </div>
        ) : null}

        {restoredDraft && !user ? (
          <div className="mx-auto mt-5 max-w-[1100px] rounded-[12px] border border-[#d4e5f0] bg-[#f4fbff] px-4 py-3 text-sm text-[#305a76]">
            Seus dados anteriores foram restaurados. Entre com CPF e senha para concluir o pagamento.
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_410px]">
          <section className="rounded-[26px] bg-[linear-gradient(180deg,#2f6e99_0%,#184f74_100%)] p-6 text-left text-white shadow-[0_16px_40px_rgba(17,66,97,0.12)] md:p-8">
            <p className="legacy-rounded text-[13px] uppercase tracking-[0.24em] text-white/70">
              Fluxo escolar legado
            </p>
            <h2 className="legacy-rounded mt-4 text-[38px] leading-[1.05] text-white md:text-[46px]">
              {isEducator ? "Compre o ingresso do educador" : "Compre o ingresso estudantil"}
            </h2>
            <p className="mt-5 text-[17px] leading-8 text-[#dceaf4]">
              {labels.subtitle}
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-[22px] border border-white/15 bg-white/10 p-5">
                <strong className="block text-[22px] text-white">
                  Unidade escolar
                </strong>
                <p className="mt-3 text-[15px] leading-7 text-[#dceaf4]">
                  A escola precisa estar vinculada a uma data aberta de passeio para aparecer na busca.
                </p>
              </div>
              <div className="rounded-[22px] border border-white/15 bg-white/10 p-5">
                <strong className="block text-[22px] text-white">
                  {labels.roleCardTitle}
                </strong>
                <p className="mt-3 text-[15px] leading-7 text-[#dceaf4]">
                  {labels.roleCardBody}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-[22px] border border-dashed border-white/25 px-5 py-5">
              <strong className="block text-[20px] text-white">
                Ajuda para comprar
              </strong>
              <p className="mt-3 text-[15px] leading-7 text-[#dceaf4]">
                Se a unidade ainda nao estiver cadastrada ou nao houver uma data de passeio liberada, use o cadastro institucional para o time comercial organizar a operacao escolar.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/escola/procedimento-pdf"
                  target="_blank"
                  className="legacy-rounded inline-flex min-h-[46px] items-center justify-center rounded-full border border-white px-5 text-[15px] text-white hover:bg-white/10"
                >
                  Procedimento PDF
                </Link>
                <Link
                  href="/grupo-escola"
                  className="legacy-rounded inline-flex min-h-[46px] items-center justify-center rounded-full border border-white px-5 text-[15px] text-white hover:bg-white/10"
                >
                  Cadastrar escola
                </Link>
                <Link
                  href="/escola"
                  className="legacy-rounded inline-flex min-h-[46px] items-center justify-center rounded-full border border-white px-5 text-[15px] text-white hover:bg-white/10"
                >
                  Voltar ao servico escola
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-[26px] border border-[#d0e0eb] bg-white p-6 shadow-[0_16px_40px_rgba(17,66,97,0.09)] md:p-8">
            <h2 className="legacy-rounded text-[33px] leading-tight text-[#1d5b80]">
              {labels.formTitle}
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-[#5f7688]">
              {labels.formDescription}
            </p>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="legacy-rounded text-[13px] uppercase tracking-[0.18em] text-[#6d8497]">
                  Unidade Escolar
                </label>
                <input
                  type="text"
                  value={schoolSearchTerm}
                  onChange={(event) => {
                    if (hasPreset) {
                      return;
                    }

                    const nextValue = event.target.value;

                    if (nextValue.trim().length < 2) {
                      setSchoolOptions([]);
                      setLoadingSchools(false);
                    }

                    setSchoolSearchTerm(event.target.value);

                    if (payload.schoolId && nextValue !== payload.schoolName) {
                      resetSchoolSelection();
                    }
                  }}
                  placeholder={labels.schoolSearchPlaceholder}
                  disabled={hasPreset}
                  className="mt-2 w-full rounded-[18px] border border-[#cad9e4] px-4 py-3 text-[15px] text-[#1f4f6c] outline-none placeholder:text-[#90a4b6] focus:border-[#3498db] disabled:bg-[#eef3f7]"
                />
                {loadingSchools ? (
                  <p className="mt-2 text-[13px] text-[#6d8497]">Buscando escolas...</p>
                ) : null}
                {!payload.schoolId && schoolOptions.length > 0 && !hasPreset ? (
                  <div className="mt-2 max-h-[220px] overflow-y-auto rounded-[18px] border border-[#d5e2ec] bg-white shadow-[0_12px_26px_rgba(17,66,97,0.08)]">
                    {schoolOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => selectSchool(option)}
                        className="block w-full border-b border-[#edf3f7] px-4 py-3 text-left text-[15px] text-[#1d5b80] last:border-b-0 hover:bg-[#f7fbfe]"
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="legacy-rounded text-[13px] uppercase tracking-[0.18em] text-[#6d8497]">
                  {labels.participantLabel}
                </label>
                <input
                  type="text"
                  value={isEducator ? payload.educatorName : payload.studentName}
                  onChange={(event) =>
                    updatePayload(
                      isEducator ? "educatorName" : "studentName",
                      event.target.value,
                    )
                  }
                  maxLength={80}
                  className="mt-2 w-full rounded-[18px] border border-[#cad9e4] px-4 py-3 text-[15px] text-[#1f4f6c] outline-none focus:border-[#3498db]"
                />
              </div>

              {isEducator ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="legacy-rounded text-[13px] uppercase tracking-[0.18em] text-[#6d8497]">
                      Funcao
                    </label>
                    <select
                      value={payload.educatorRole}
                      onChange={(event) => updatePayload("educatorRole", event.target.value)}
                      className="mt-2 h-[50px] w-full rounded-[18px] border border-[#cad9e4] bg-white px-4 text-[15px] text-[#1f4f6c] outline-none focus:border-[#3498db]"
                    >
                      <option value="">Selecione</option>
                      {educatorRoleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="legacy-rounded text-[13px] uppercase tracking-[0.18em] text-[#6d8497]">
                      Data do Passeio
                    </label>
                    <select
                      value={payload.agendaId ?? ""}
                      onChange={(event) =>
                        updatePayload(
                          "agendaId",
                          event.target.value ? Number(event.target.value) : null,
                        )
                      }
                      disabled={!context || loadingContext || hasPreset}
                      className="mt-2 h-[50px] w-full rounded-[18px] border border-[#cad9e4] bg-white px-4 text-[15px] text-[#1f4f6c] outline-none focus:border-[#3498db] disabled:bg-[#eef3f7]"
                    >
                      <option value="">
                        {loadingContext ? "Carregando..." : "Selecione"}
                      </option>
                      {context?.dates.map((tripDate) => (
                        <option key={tripDate.agendaId} value={tripDate.agendaId}>
                          {tripDate.label}
                        </option>
                      ))}
                    </select>
                    {preset ? (
                      <p className="mt-2 text-[13px] leading-6 text-[#6d8497]">
                        Link exclusivo para {preset.schoolName} em {preset.agendaLabel}.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="legacy-rounded text-[13px] uppercase tracking-[0.18em] text-[#6d8497]">
                        Tipo de Ensino
                      </label>
                      <select
                        value={payload.educationType}
                        onChange={(event) => {
                          updatePayload("educationType", event.target.value);
                          updatePayload("educationYear", "");
                          updatePayload("classLetter", "");
                        }}
                        disabled={!context}
                        className="mt-2 h-[50px] w-full rounded-[18px] border border-[#cad9e4] bg-white px-4 text-[15px] text-[#1f4f6c] outline-none focus:border-[#3498db] disabled:bg-[#eef3f7]"
                      >
                        <option value="">Selecione</option>
                        {context?.educationStructure.types.map((educationType) => (
                          <option key={educationType.id} value={educationType.id}>
                            {educationType.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="legacy-rounded text-[13px] uppercase tracking-[0.18em] text-[#6d8497]">
                        Ano
                      </label>
                      <select
                        value={payload.educationYear}
                        onChange={(event) => {
                          updatePayload("educationYear", event.target.value);
                          updatePayload("classLetter", "");
                        }}
                        disabled={!selectedEducationType}
                        className="mt-2 h-[50px] w-full rounded-[18px] border border-[#cad9e4] bg-white px-4 text-[15px] text-[#1f4f6c] outline-none focus:border-[#3498db] disabled:bg-[#eef3f7]"
                      >
                        <option value="">Selecione</option>
                        {selectedEducationType?.years.map((year) => (
                          <option key={year.id} value={year.id}>
                            {year.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="legacy-rounded text-[13px] uppercase tracking-[0.18em] text-[#6d8497]">
                        Turma
                      </label>
                      <select
                        value={payload.classLetter}
                        onChange={(event) => updatePayload("classLetter", event.target.value)}
                        disabled={!payload.educationYear}
                        className="mt-2 h-[50px] w-full rounded-[18px] border border-[#cad9e4] bg-white px-4 text-[15px] text-[#1f4f6c] outline-none focus:border-[#3498db] disabled:bg-[#eef3f7]"
                      >
                        <option value="">Selecione</option>
                        {context?.educationStructure.classes.map((classLetter) => (
                          <option key={classLetter} value={classLetter}>
                            {classLetter}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="legacy-rounded text-[13px] uppercase tracking-[0.18em] text-[#6d8497]">
                        Data do Passeio
                      </label>
                      <select
                        value={payload.agendaId ?? ""}
                        onChange={(event) =>
                          updatePayload(
                            "agendaId",
                            event.target.value ? Number(event.target.value) : null,
                          )
                        }
                        disabled={!context || loadingContext || hasPreset}
                        className="mt-2 h-[50px] w-full rounded-[18px] border border-[#cad9e4] bg-white px-4 text-[15px] text-[#1f4f6c] outline-none focus:border-[#3498db] disabled:bg-[#eef3f7]"
                      >
                        <option value="">
                          {loadingContext ? "Carregando..." : "Selecione"}
                        </option>
                        {context?.dates.map((tripDate) => (
                          <option key={tripDate.agendaId} value={tripDate.agendaId}>
                            {tripDate.label}
                          </option>
                        ))}
                      </select>
                      {preset ? (
                        <p className="mt-2 text-[13px] leading-6 text-[#6d8497]">
                          Link exclusivo para {preset.schoolName} em {preset.agendaLabel}.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="legacy-rounded text-[13px] uppercase tracking-[0.18em] text-[#6d8497]">
                  Valor do Passeio
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={payload.value}
                  onChange={(event) => updatePayload("value", event.target.value)}
                  placeholder="Ex.: 49,90"
                  className="mt-2 w-full rounded-[18px] border border-[#cad9e4] px-4 py-3 text-[15px] text-[#1f4f6c] outline-none placeholder:text-[#90a4b6] focus:border-[#3498db]"
                />
                <p className="mt-2 text-[13px] leading-6 text-[#6d8497]">
                  Informe o valor exato conforme a autorizacao do passeio.
                </p>
              </div>

              <div className="rounded-[20px] bg-[#f3f9fd] px-4 py-4 text-[14px] leading-7 text-[#47657b]">
                {context ? (
                  <>
                    <strong className="block text-[#1d5b80]">
                      {context.schoolName}
                    </strong>
                    <span>{context.dates.length} data(s) aberta(s) para compra online.</span>
                  </>
                ) : (
                  <span>{labels.contextSummary}</span>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="legacy-rounded inline-flex min-h-[50px] w-full items-center justify-center rounded-full bg-[#3394d6] px-5 py-3 text-[16px] text-white shadow-[2px_2px_4px_rgba(0,0,0,0.2)] transition hover:bg-[#246b99] disabled:cursor-not-allowed disabled:bg-[#8abfe7]"
              >
                {submitting ? "Preparando..." : "Pagar Online"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </IngressoShell>
  );
}

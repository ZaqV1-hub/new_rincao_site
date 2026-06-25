"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OpsSchoolTripsScreenData } from "@/lib/ops-school-trips";

type PainelSchoolTripsManagerProps = {
  data: OpsSchoolTripsScreenData;
  actorName?: string | null;
  actorCpf?: string | null;
};

export function PainelSchoolTripsManager({
  data,
  actorName,
  actorCpf,
}: PainelSchoolTripsManagerProps) {
  const router = useRouter();
  const selectedSchool = data.selectedSchool;
  const [visitDate, setVisitDate] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSchool) {
      return;
    }

    setPendingKey("create");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/ops/admin/schools/${selectedSchool.schoolId}/trips`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            visitDate,
            actor: {
              name: actorName ?? null,
              cpf: actorCpf ?? null,
            },
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: { message?: string };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error?.message ||
            "Nao foi possivel vincular a data de passeio agora.",
        );
      }

      setVisitDate("");
      setSuccessMessage(payload.data?.message || "Data de passeio vinculada com sucesso.");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel vincular a data de passeio agora.",
      );
    } finally {
      setPendingKey(null);
    }
  }

  async function handleToggleStatus(agendaId: number, nextStatus: "ati" | "ina") {
    if (!selectedSchool) {
      return;
    }

    setPendingKey(`status-${agendaId}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/ops/admin/schools/${selectedSchool.schoolId}/trips/${agendaId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
            actor: {
              name: actorName ?? null,
              cpf: actorCpf ?? null,
            },
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: { message?: string };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error?.message ||
            "Nao foi possivel atualizar o status da data agora.",
        );
      }

      setSuccessMessage(payload.data?.message || "Status da data atualizado com sucesso.");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel atualizar o status da data agora.",
      );
    } finally {
      setPendingKey(null);
    }
  }

  async function handleDelete(agendaId: number) {
    if (!selectedSchool) {
      return;
    }

    if (!window.confirm("Deseja realmente remover esta data de passeio?")) {
      return;
    }

    setPendingKey(`delete-${agendaId}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/ops/admin/schools/${selectedSchool.schoolId}/trips/${agendaId}`,
        {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            actor: {
              name: actorName ?? null,
              cpf: actorCpf ?? null,
            },
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: { message?: string };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error?.message ||
            "Nao foi possivel remover a data de passeio agora.",
        );
      }

      setSuccessMessage(payload.data?.message || "Data de passeio removida com sucesso.");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel remover a data de passeio agora.",
      );
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5d7282]">
              Passeios escolares
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#205a7f]">
              Datas e status por escola
            </h2>
          </div>
          <Link
            href="/painel/clientes"
            className="rounded-full border border-[#c9d8e3] px-5 py-3 text-sm font-semibold text-[#205a7f]"
          >
            Voltar aos clientes
          </Link>
        </div>

        {successMessage ? (
          <div className="mt-4 rounded-[20px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1d4f91]">
            {successMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-4 rounded-[20px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#991b1b]">
            {errorMessage}
          </div>
        ) : null}

        <form method="get" className="mt-5 grid gap-4 rounded-[22px] border border-[#d9e3eb] bg-[#f8fbfd] p-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="grid gap-2 text-sm text-[#345062]">
            <span>Buscar escola</span>
            <input
              name="query"
              defaultValue={data.search.query}
              placeholder="Digite pelo menos 2 caracteres"
              className="h-11 rounded-[16px] border border-[#c9d8e3] px-4 text-sm text-[#205a7f]"
            />
          </label>
          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="h-11 rounded-full bg-[#246b99] px-5 text-sm font-semibold text-white"
            >
              Buscar
            </button>
            <Link
              href="/painel/clientes/escolas/passeios"
              className="h-11 rounded-full border border-[#c9d8e3] px-5 text-sm font-semibold leading-[44px] text-[#205a7f]"
            >
              Limpar
            </Link>
          </div>
          {selectedSchool ? (
            <div className="flex items-end justify-end">
              <input type="hidden" name="schoolId" value={selectedSchool.schoolId} />
            </div>
          ) : null}
        </form>
      </section>

      {data.search.query.length >= 2 && data.search.results.length > 0 ? (
        <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
          <h2 className="text-xl font-semibold text-[#205a7f]">Resultados</h2>
          <div className="mt-5 grid gap-3">
            {data.search.results.map((item) => (
              <Link
                key={item.schoolId}
                href={`/painel/clientes/escolas/passeios?schoolId=${item.schoolId}&query=${encodeURIComponent(data.search.query)}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#d9e3eb] bg-[#f8fbfd] px-4 py-4 text-sm text-[#205a7f]"
              >
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="mt-1 text-[#5d7282]">Status da escola: {item.statusLabel}</div>
                </div>
                <span className="font-semibold text-[#246b99]">Abrir</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {selectedSchool ? (
        <>
          <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-[#205a7f]">
                  {selectedSchool.name}
                </h2>
                <p className="mt-2 text-sm text-[#5d7282]">
                  Status da escola: {selectedSchool.statusLabel} •{" "}
                  {selectedSchool.trips.length} data(s) vinculada(s)
                </p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="mt-5 grid gap-4 rounded-[22px] border border-[#d9e3eb] bg-[#f8fbfd] p-4 md:grid-cols-[minmax(0,280px)_auto]">
              <label className="grid gap-2 text-sm text-[#345062]">
                <span>Nova data de passeio</span>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(event) => setVisitDate(event.target.value)}
                  className="h-11 rounded-[16px] border border-[#c9d8e3] px-4 text-sm text-[#205a7f]"
                />
              </label>
              <div className="flex items-end gap-3">
                <button
                  type="submit"
                  disabled={isPending && pendingKey === "create"}
                  className="h-11 rounded-full bg-[#246b99] px-5 text-sm font-semibold text-white disabled:opacity-70"
                >
                  {isPending && pendingKey === "create" ? "Salvando..." : "Adicionar data"}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
            {selectedSchool.trips.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[#c9d8e3] bg-[#f8fbfd] px-4 py-8 text-sm text-[#5d7282]">
                Nenhuma data de passeio vinculada para esta escola.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-[22px] border border-[#d9e3eb] text-sm">
                  <thead className="bg-[#edf5fa] text-left text-[#345062]">
                    <tr>
                      <th className="px-4 py-3">Codigo</th>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Permalink</th>
                      <th className="px-4 py-3">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSchool.trips.map((trip, index) => {
                      const nextStatus = trip.status === "ati" ? "ina" : "ati";

                      return (
                        <tr
                          key={trip.agendaId}
                          className={index % 2 === 0 ? "bg-white" : "bg-[#f8fbfd]"}
                        >
                          <td className="px-4 py-3 font-semibold text-[#205a7f]">
                            {trip.code}
                          </td>
                          <td className="px-4 py-3">{trip.dateLabel}</td>
                          <td className="px-4 py-3">{trip.statusLabel}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[#5d7282]">
                            {trip.permalink || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-3">
                              <Link
                                href={`/painel/clientes/escolas/passeios/${selectedSchool.schoolId}/${trip.agendaId}`}
                                className="font-semibold text-[#205a7f]"
                              >
                                Detalhe
                              </Link>
                              <button
                                type="button"
                                onClick={() => void handleToggleStatus(trip.agendaId, nextStatus)}
                                disabled={isPending && pendingKey === `status-${trip.agendaId}`}
                                className="font-semibold text-[#246b99]"
                              >
                                {isPending && pendingKey === `status-${trip.agendaId}`
                                  ? "Salvando..."
                                  : nextStatus === "ina"
                                    ? "Inativar"
                                    : "Ativar"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(trip.agendaId)}
                                disabled={isPending && pendingKey === `delete-${trip.agendaId}`}
                                className="font-semibold text-[#b42318]"
                              >
                                {isPending && pendingKey === `delete-${trip.agendaId}`
                                  ? "Removendo..."
                                  : "Remover"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
          <div className="rounded-[20px] border border-dashed border-[#c9d8e3] bg-[#f8fbfd] px-4 py-8 text-sm text-[#5d7282]">
            Busque uma escola e abra o registro para gerenciar datas, status e relatorios do passeio.
          </div>
        </section>
      )}
    </div>
  );
}

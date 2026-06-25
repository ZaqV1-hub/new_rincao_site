"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  OpsClientTripCreateScreenData,
  OpsClientTripEditScreenData,
} from "@/lib/ops-client-trips";

type PainelClientTripEditorProps = {
  data: OpsClientTripCreateScreenData | OpsClientTripEditScreenData;
  actorName?: string | null;
  actorCpf?: string | null;
};

type EditableFaixa = {
  minAge: string;
  maxAge: string;
  value: string;
};

function toEditableFaixa(value: {
  minAge: number;
  maxAge: number;
  value: string;
}): EditableFaixa {
  return {
    minAge: String(value.minAge),
    maxAge: String(value.maxAge),
    value: value.value,
  };
}

export function PainelClientTripEditor({
  data,
  actorName,
  actorCpf,
}: PainelClientTripEditorProps) {
  const router = useRouter();
  const [agendaId, setAgendaId] = useState(
    data.mode === "create"
      ? String(data.preselectedAgendaId ?? "")
      : String(data.agenda.agendaId),
  );
  const [clientId, setClientId] = useState(
    data.mode === "create"
      ? String(data.preselectedClientId ?? "")
      : String(data.client.clientId),
  );
  const [acceptsFamily, setAcceptsFamily] = useState(
    data.mode === "edit" ? data.acceptsFamily : false,
  );
  const [faixas, setFaixas] = useState<EditableFaixa[]>(
    (data.faixas.length > 0 ? data.faixas : [{ minAge: 0, maxAge: 0, value: "0.00" }]).map(
      toEditableFaixa,
    ),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isMovingDate, setIsMovingDate] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [moveDateValue, setMoveDateValue] = useState(
    data.mode === "edit" ? data.agenda.dateLabel : "",
  );

  const selectedAgendaLabel = useMemo(() => {
    if (data.mode !== "create") {
      return `#${data.agenda.agendaId} - ${data.agenda.dateLabel} (${data.agenda.agendaTypeLabel}, ${data.agenda.statusLabel})`;
    }

    const selectedAgenda = data.agendas.find((item) => String(item.agendaId) === agendaId);
    return selectedAgenda
      ? `#${selectedAgenda.agendaId} - ${selectedAgenda.dateLabel} (${selectedAgenda.agendaTypeLabel}, ${selectedAgenda.statusLabel})`
      : "";
  }, [agendaId, data]);

  const selectedClientLabel = useMemo(() => {
    if (data.mode !== "create") {
      return `${data.client.name}${data.client.typeName ? ` (${data.client.typeName})` : ""}`;
    }

    const selectedClient = data.clients.find((item) => String(item.clientId) === clientId);
    return selectedClient
      ? `${selectedClient.name}${selectedClient.typeName ? ` (${selectedClient.typeName})` : ""}`
      : "";
  }, [clientId, data]);

  function updateFaixa(index: number, field: keyof EditableFaixa, value: string) {
    setFaixas((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  }

  function addFaixa() {
    setFaixas((current) => [...current, { minAge: "", maxAge: "", value: "0.00" }]);
  }

  function removeFaixa(index: number) {
    setFaixas((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const url =
        data.mode === "create"
          ? "/api/painel/clientes/passeios"
          : `/api/painel/clientes/passeios/${data.agenda.agendaId}`;
      const method = data.mode === "create" ? "POST" : "PATCH";
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId,
          clientId,
          acceptsFamily,
          faixas: faixas.map((faixa) => ({
            minAge: faixa.minAge,
            maxAge: faixa.maxAge,
            value: faixa.value,
          })),
          actor: {
            name: actorName ?? null,
            cpf: actorCpf ?? null,
          },
        }),
      });
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
            "Nao foi possivel salvar o passeio agora.",
        );
      }

      router.push(
        `/painel/clientes/passeios?success=${encodeURIComponent(
          payload.data?.message || "Passeio salvo com sucesso.",
        )}`,
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar o passeio agora.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMoveDate() {
    if (data.mode !== "edit") {
      return;
    }

    setIsMovingDate(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/painel/clientes/passeios/${data.agenda.agendaId}/date`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            clientId: data.client.clientId,
            datapasseio: moveDateValue,
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
            data?: { agendaId?: number; message?: string };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.data?.agendaId) {
        throw new Error(
          payload?.error?.message ||
            "Nao foi possivel mover a data do passeio agora.",
        );
      }

      router.push(
        `/painel/clientes/passeios/${payload.data.agendaId}/editar?clientId=${data.client.clientId}&success=${encodeURIComponent(
          payload.data.message || "Data do passeio atualizada com sucesso.",
        )}`,
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel mover a data do passeio agora.",
      );
    } finally {
      setIsMovingDate(false);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
          <Link className="text-[#1d68a2] underline" href="/painel">
            Home
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <Link className="text-[#1d68a2] underline" href="/painel/clientes">
            Clientes
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <Link className="text-[#1d68a2] underline" href="/painel/clientes/passeios">
            Passeios
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>{data.mode === "create" ? "Vincular passeio" : "Editar passeio"}</span>
        </div>

        {errorMessage ? (
          <div className="mt-4 border border-[#efc0c0] bg-[#fff0f0] px-4 py-3 text-sm text-[#7a2b2b]">
            {errorMessage}
          </div>
        ) : null}

        <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
          {data.mode === "edit" ? (
            <section className="rounded-[6px] border border-[#d7d7d7] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d7d7d7] bg-[#f4f4f4] px-4 py-3">
                <h2 className="text-[18px] font-bold text-[#555]">
                  Alterar data do passeio
                </h2>
                <button
                  className="border border-[#2b6cb0] bg-[#3277bb] px-4 py-2 text-sm font-bold text-white"
                  disabled={isMovingDate}
                  onClick={() => void handleMoveDate()}
                  type="button"
                >
                  {isMovingDate ? "Movendo..." : "Mover para data selecionada"}
                </button>
              </div>
              <div className="grid gap-3 px-4 py-4">
                <label className="grid gap-2 text-[15px] text-[#555]" htmlFor="nova_data">
                  <span className="font-bold">Nova data (dd/mm/aaaa)</span>
                  <input
                    className="h-10 w-[220px] max-w-full border border-[#d7d7d7] px-3 text-[15px]"
                    id="nova_data"
                    onChange={(event) => setMoveDateValue(event.target.value)}
                    placeholder="dd/mm/aaaa"
                    type="text"
                    value={moveDateValue}
                  />
                </label>
                <p className="text-sm text-[#667]">
                  Se ja existir agenda na data escolhida, o vinculo e os vouchers
                  deste cliente serao movidos para ela.
                </p>
              </div>
            </section>
          ) : null}

          <table className="w-full border-collapse text-[15px]">
            <tbody>
              <tr>
                <th className="w-[22%] border border-[#d7d7d7] bg-[#f4f4f4] px-4 py-3 text-left font-bold text-[#555]">
                  Agenda
                </th>
                <td className="border border-[#d7d7d7] px-4 py-3">
                  {data.mode === "create" ? (
                    <select
                      className="h-10 w-[420px] max-w-full border border-[#d7d7d7] px-3 text-[15px]"
                      onChange={(event) => setAgendaId(event.target.value)}
                      value={agendaId}
                    >
                      <option value="">Selecione...</option>
                      {data.agendas.map((agenda) => (
                        <option key={agenda.agendaId} value={agenda.agendaId}>
                          #{agenda.agendaId} - {agenda.dateLabel} ({agenda.agendaTypeLabel},{" "}
                          {agenda.statusLabel})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{selectedAgendaLabel}</span>
                  )}
                </td>
              </tr>

              <tr>
                <th className="border border-[#d7d7d7] bg-[#f4f4f4] px-4 py-3 text-left font-bold text-[#555]">
                  Cliente
                </th>
                <td className="border border-[#d7d7d7] px-4 py-3">
                  {data.mode === "create" ? (
                    <select
                      className="h-10 w-[420px] max-w-full border border-[#d7d7d7] px-3 text-[15px]"
                      onChange={(event) => setClientId(event.target.value)}
                      value={clientId}
                    >
                      <option value="">Selecione...</option>
                      {data.clients.map((client) => (
                        <option key={client.clientId} value={client.clientId}>
                          {client.name}
                          {client.typeName ? ` (${client.typeName})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{selectedClientLabel}</span>
                  )}
                </td>
              </tr>

              <tr>
                <th className="border border-[#d7d7d7] bg-[#f4f4f4] px-4 py-3 text-left font-bold text-[#555]">
                  Aceita familia?
                </th>
                <td className="border border-[#d7d7d7] px-4 py-3">
                  <select
                    className="h-10 w-[160px] max-w-full border border-[#d7d7d7] px-3 text-[15px]"
                    onChange={(event) => setAcceptsFamily(event.target.value === "1")}
                    value={acceptsFamily ? "1" : "0"}
                  >
                    <option value="0">Nao</option>
                    <option value="1">Sim</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>

          <section className="rounded-[6px] border border-[#d7d7d7] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d7d7d7] bg-[#f4f4f4] px-4 py-3">
              <h2 className="text-[18px] font-bold text-[#555]">Faixas de preco</h2>
              <button
                className="border border-[#c5c5c5] bg-[#f8f8f8] px-4 py-2 text-sm text-[#555]"
                onClick={addFaixa}
                type="button"
              >
                Adicionar faixa
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[15px]">
                <thead className="bg-[#5f84a3] text-left text-white">
                  <tr>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Idade de
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Idade ate
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Valor (R$)
                    </th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">
                      Acao
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {faixas.map((faixa, index) => (
                    <tr
                      className={index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"}
                      key={`faixa-${index}`}
                    >
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <input
                          className="h-10 w-full border border-[#d7d7d7] px-3 text-[15px]"
                          onChange={(event) =>
                            updateFaixa(index, "minAge", event.target.value)
                          }
                          type="number"
                          value={faixa.minAge}
                        />
                      </td>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <input
                          className="h-10 w-full border border-[#d7d7d7] px-3 text-[15px]"
                          onChange={(event) =>
                            updateFaixa(index, "maxAge", event.target.value)
                          }
                          type="number"
                          value={faixa.maxAge}
                        />
                      </td>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <input
                          className="h-10 w-full border border-[#d7d7d7] px-3 text-[15px]"
                          onChange={(event) =>
                            updateFaixa(index, "value", event.target.value)
                          }
                          type="text"
                          value={faixa.value}
                        />
                      </td>
                      <td className="border border-[#d7d7d7] px-4 py-3">
                        <button
                          className="text-[#b53a2d] underline"
                          disabled={faixas.length === 1}
                          onClick={() => removeFaixa(index)}
                          type="button"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-3">
            <Link
              className="border border-[#c5c5c5] bg-[#f8f8f8] px-5 py-2.5 text-sm text-[#555]"
              href="/painel/clientes/passeios"
            >
              Cancelar
            </Link>
            <button
              className="border border-[#2f7f2f] bg-[#4b9c38] px-5 py-2.5 text-sm font-bold text-white"
              disabled={isSaving}
              type="submit"
            >
              {isSaving
                ? "Salvando..."
                : data.mode === "create"
                  ? "Vincular"
                  : "Salvar alteracoes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

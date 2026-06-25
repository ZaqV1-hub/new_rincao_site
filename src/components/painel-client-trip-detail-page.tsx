"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { PainelClientTripDetailData } from "@/lib/painel-client-trip-detail";

type EditableParticipant = PainelClientTripDetailData["students"][number];

function formatCurrency(value: string) {
  const numeric = Number(value ?? 0);
  return numeric.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildStatusPillClass(status: string) {
  switch (status) {
    case "concluida":
    case "conc":
      return "bg-[#d9f1df] text-[#245838]";
    case "cancelada":
    case "canc":
      return "bg-[#f8dede] text-[#8d2626]";
    default:
      return "bg-[#fff3cd] text-[#73510d]";
  }
}

function buildEditFormState(
  participant: EditableParticipant,
  data: PainelClientTripDetailData,
) {
  return {
    studentName: participant.name,
    educationType: participant.educationType,
    educationYear: participant.educationYear,
    classLetter: participant.classLetter,
    schoolId: String(participant.schoolId || data.trip.clientId),
    agendaId: String(participant.agendaId || data.trip.agendaId),
    value: formatCurrency(participant.unitValue),
    purchaseStatus: participant.purchaseStatus || "pend",
  };
}

function groupStudents(
  rows: PainelClientTripDetailData["students"],
) {
  const groups = new Map<string, PainelClientTripDetailData["students"]>();

  for (const row of rows) {
    const key = row.classDisplay || "Outros";
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([label, participants]) => ({
    label,
    participants,
  }));
}

export function PainelClientTripDetailPage({
  data,
  isManager = false,
  csvHref,
  pdfHref,
}: {
  data: PainelClientTripDetailData;
  isManager?: boolean;
  csvHref?: string;
  pdfHref?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditableParticipant | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [schools, setSchools] = useState(data.schools);
  const [dates, setDates] = useState<Array<{ agendaId: number; dateLabel: string }>>([]);
  const [editForm, setEditForm] = useState({
    studentName: "",
    educationType: "",
    educationYear: "",
    classLetter: "",
    schoolId: "",
    agendaId: "",
    value: "",
    purchaseStatus: "pend",
  });
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!editTarget) {
      return;
    }

    let active = true;
    startTransition(async () => {
      const schoolResponse = await fetch(
        `/api/painel/clientes/passeios/${data.trip.agendaId}/schools`,
        {
          method: "POST",
        },
      );
      const schoolPayload = (await schoolResponse.json().catch(() => null)) as
        | { ok?: boolean; data?: { schools?: Array<{ clientId: number; name: string }> } }
        | null;

      if (active && schoolPayload?.ok) {
        setSchools(schoolPayload.data?.schools ?? []);
      }

      const selectedSchoolId = Number(editTarget.schoolId || data.trip.clientId);
      const datesResponse = await fetch(
        `/api/painel/clientes/passeios/${data.trip.agendaId}/dates`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ clientId: selectedSchoolId }),
        },
      );
      const datesPayload = (await datesResponse.json().catch(() => null)) as
        | { ok?: boolean; data?: { dates?: Array<{ agendaId: number; dateLabel: string }> } }
        | null;

      if (active && datesPayload?.ok) {
        setDates(datesPayload.data?.dates ?? []);
      }
    });

    return () => {
      active = false;
    };
  }, [data.trip.agendaId, data.trip.clientId, editTarget]);

  async function handleToggleStatus() {
    setStatusMessage(null);
    const response = await fetch(
      `/api/painel/clientes/${data.trip.clientId}/trip-dates/${data.trip.agendaId}/status`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status: data.trip.nextUiStatus,
        }),
      },
    );

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
      | null;

    if (!response.ok || !payload?.ok) {
      setStatusMessage(payload?.error?.message ?? "Nao foi possivel alterar o status.");
      return;
    }

    setStatusMessage(payload.data?.message ?? "Status alterado com sucesso.");
    router.refresh();
  }

  function handleOpenEdit(participant: EditableParticipant) {
    setEditTarget(participant);
    setEditForm(buildEditFormState(participant, data));
    setEditError(null);
  }

  function handleSchoolChange(nextSchoolId: string) {
    setEditForm((current) => ({
      ...current,
      schoolId: nextSchoolId,
      agendaId: "",
    }));
    startTransition(async () => {
      const response = await fetch(
        `/api/painel/clientes/passeios/${data.trip.agendaId}/dates`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ clientId: Number(nextSchoolId) }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { dates?: Array<{ agendaId: number; dateLabel: string }> } }
        | null;

      if (payload?.ok) {
        setDates(payload.data?.dates ?? []);
      }
    });
  }

  async function handleSaveStudent() {
    if (!editTarget) {
      return;
    }

    setEditError(null);
    const response = await fetch(
      `/api/painel/clientes/passeios/vouchers/${editTarget.voucherId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          purchaseId: editTarget.purchaseId,
          studentName: editForm.studentName,
          educationType: editForm.educationType,
          educationYear: editForm.educationYear,
          classLetter: editForm.classLetter,
          schoolId: Number(editForm.schoolId),
          agendaId: Number(editForm.agendaId),
          value: editForm.value,
          purchaseStatus: editForm.purchaseStatus,
        }),
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
      | null;

    if (!response.ok || !payload?.ok) {
      setEditError(payload?.error?.message ?? "Erro ao salvar.");
      return;
    }

    setConfirmOpen(false);
    setEditTarget(null);
    router.refresh();
  }

  const studentGroups = groupStudents(data.students);

  return (
    <div className="space-y-5 text-[13px] text-[#4c5f70]">
      <div className="border-b border-[#d9dee3] pb-3 text-[13px]">
        <Link className="text-[#23679f] underline" href="/painel">
          Home
        </Link>{" "}
        <span className="text-[#7c8791]">&gt;</span>{" "}
        <Link className="text-[#23679f] underline" href="/painel/clientes">
          Clientes
        </Link>{" "}
        <span className="text-[#7c8791]">&gt;</span>{" "}
        <Link
          className="text-[#23679f] underline"
          href={`/painel/clientes/passeios?clientId=${data.trip.clientId}`}
        >
          Passeios
        </Link>{" "}
        <span className="text-[#8a949d]">
          {data.trip.clientName} - {data.trip.dateLabel}
        </span>
      </div>

      <div className="space-y-4">
        <h1 className="text-[32px] font-light text-[#546979]">Dados do Passeio</h1>

        <table className="w-full border-collapse border border-[#d8dfe5] bg-white">
          <tbody>
            <tr>
              <th className="border border-[#d8dfe5] bg-[#f4f6f8] px-4 py-3 text-left font-semibold text-[#53697a]">
                Data Agendada
              </th>
              <th className="border border-[#d8dfe5] bg-[#f4f6f8] px-4 py-3 text-left font-semibold text-[#53697a]">
                Status Agenda
              </th>
            </tr>
            <tr>
              <td className="border border-[#d8dfe5] px-4 py-3">{data.trip.dateLabel}</td>
              <td className="border border-[#d8dfe5] px-4 py-3">{data.trip.agendaStatusLabel}</td>
            </tr>
            <tr>
              <th
                className="border border-[#d8dfe5] bg-[#f4f6f8] px-4 py-3 text-left font-semibold text-[#53697a]"
                colSpan={2}
              >
                Codigo Passeio
              </th>
              <th className="border border-[#d8dfe5] bg-[#f4f6f8] px-4 py-3 text-left font-semibold text-[#53697a]">
                Status Passeio
              </th>
            </tr>
            <tr>
              <td className="border border-[#d8dfe5] px-4 py-3" colSpan={2}>
                <span className="inline-block rounded border border-[#dbe3ea] bg-[#f4f7fa] px-3 py-2 font-mono text-[#3f5362]">
                  {data.trip.code}
                </span>
              </td>
              <td className="border border-[#d8dfe5] px-4 py-3">
                {data.trip.uiStatusLabel}{" "}
                <button
                  className="text-[#23679f] underline"
                  disabled={isPending}
                  type="button"
                  onClick={() => {
                    void handleToggleStatus();
                  }}
                >
                  {data.trip.uiStatus === "ati" ? "Desativar" : "Ativar"}
                </button>
              </td>
            </tr>
            <tr>
              <th
                className="border border-[#d8dfe5] bg-[#f4f6f8] px-4 py-3 text-left font-semibold text-[#53697a]"
                colSpan={2}
              >
                Cliente
              </th>
              <th className="border border-[#d8dfe5] bg-[#f4f6f8] px-4 py-3 text-left font-semibold text-[#53697a]">
                Aceita familia?
              </th>
            </tr>
            <tr>
              <td className="border border-[#d8dfe5] px-4 py-3" colSpan={2}>
                {data.trip.clientId} - {data.trip.clientName}
                {data.trip.clientTypeName ? (
                  <span className="ml-2 inline-block rounded border border-[#dbe3ea] bg-[#eef4fb] px-2 py-1 text-[11px] text-[#53697a]">
                    {data.trip.clientTypeName}
                  </span>
                ) : null}
              </td>
              <td className="border border-[#d8dfe5] px-4 py-3">
                {data.trip.acceptsFamily ? "Sim" : "Nao"}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="flex flex-wrap gap-3">
          {data.trip.purchaseLink ? (
            <button
              className="rounded border border-[#cdd8e2] bg-white px-4 py-2 text-[#215f92]"
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(
                  `${window.location.origin}${data.trip.purchaseLink}`,
                );
                setStatusMessage("Link copiado com sucesso.");
              }}
            >
              Gerar link
            </button>
          ) : null}
          {csvHref ? (
            <Link
              className="rounded border border-[#cdd8e2] bg-white px-4 py-2 text-[#215f92]"
              href={csvHref}
            >
              Relatorio CSV
            </Link>
          ) : null}
          {pdfHref ? (
            <Link
              className="rounded border border-[#cdd8e2] bg-white px-4 py-2 text-[#215f92]"
              href={pdfHref}
              rel="noreferrer"
              target="_blank"
            >
              Relatorio PDF
            </Link>
          ) : null}
        </div>

        {statusMessage ? (
          <div className="rounded border border-[#d8dfe5] bg-[#f8fbfd] px-4 py-3 text-[#4d6170]">
            {statusMessage}
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <h2 className="text-[26px] font-light text-[#546979]">Relatorio de Ingressos</h2>

        <form action="" className="flex flex-wrap items-end gap-3" method="get">
          <input name="clientId" type="hidden" value={String(data.trip.clientId)} />
          <label className="grid gap-2">
            <span>Status da compra</span>
            <select
              className="h-10 min-w-[220px] border border-[#cfd7de] px-3"
              defaultValue={data.filters.purchaseStatus}
              name="purchaseStatus"
            >
              {data.statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="h-10 bg-[#7c848c] px-5 text-white" type="submit">
            Filtrar
          </button>
          <Link
            className="h-10 border border-[#cfd7de] px-5 leading-10 text-[#215f92]"
            href={`/painel/clientes/passeios/${data.trip.agendaId}/alunos?clientId=${data.trip.clientId}`}
          >
            Limpar
          </Link>
        </form>

        {data.isSchool ? (
          <>
            <div className="space-y-5">
              <h3 className="text-[22px] font-light text-[#546979]">Alunos</h3>
              {studentGroups.map((group) => (
                <div key={group.label} className="space-y-2">
                  <div className="text-[13px] font-semibold text-[#4f6576]">{group.label}</div>
              <ParticipantTable
                isManager={isManager}
                kind="student"
                onEdit={handleOpenEdit}
                rows={group.participants}
              />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-[22px] font-light text-[#546979]">
                Educadores &amp; Acompanhantes
              </h3>
              <ParticipantTable
                isManager={false}
                kind="educator"
                onEdit={handleOpenEdit}
                rows={data.educators}
              />
            </div>
          </>
        ) : (
          <ParticipantTable
            isManager={false}
            kind="generic"
            onEdit={handleOpenEdit}
            rows={data.genericParticipants}
          />
        )}
      </div>

      {editTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-[760px] overflow-auto rounded bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#d8dfe5] px-5 py-4">
              <h4 className="text-xl font-semibold text-[#355062]">Editar aluno</h4>
              <button
                className="text-2xl text-[#6d7c89]"
                type="button"
                onClick={() => setEditTarget(null)}
              >
                ×
              </button>
            </div>

            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <label className="grid gap-2 md:col-span-2">
                <span>Nome do aluno</span>
                <input
                  className="h-10 border border-[#cfd7de] px-3"
                  type="text"
                  value={editForm.studentName}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      studentName: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="grid gap-2">
                <span>Tipo de ensino</span>
                <select
                  className="h-10 border border-[#cfd7de] px-3"
                  value={editForm.educationType}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      educationType: event.target.value,
                      educationYear: "",
                    }))
                  }
                >
                  <option value="">Selecione</option>
                  {data.educationStructure.types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span>Ano</span>
                <select
                  className="h-10 border border-[#cfd7de] px-3"
                  value={editForm.educationYear}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      educationYear: event.target.value,
                    }))
                  }
                >
                  <option value="">Selecione</option>
                  {data.educationStructure.types
                    .find((type) => type.id === editForm.educationType)
                    ?.years.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.label}
                      </option>
                    )) ?? null}
                </select>
              </label>

              <label className="grid gap-2">
                <span>Turma</span>
                <select
                  className="h-10 border border-[#cfd7de] px-3"
                  value={editForm.classLetter}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      classLetter: event.target.value,
                    }))
                  }
                >
                  <option value="">Selecione</option>
                  {data.educationStructure.classes.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span>Escola</span>
                <select
                  className="h-10 border border-[#cfd7de] px-3"
                  value={editForm.schoolId}
                  onChange={(event) => handleSchoolChange(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {schools.map((school) => (
                    <option key={school.clientId} value={school.clientId}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span>Data do passeio</span>
                <select
                  className="h-10 border border-[#cfd7de] px-3"
                  value={editForm.agendaId}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      agendaId: event.target.value,
                    }))
                  }
                >
                  <option value="">Selecione</option>
                  {dates.map((date) => (
                    <option key={date.agendaId} value={date.agendaId}>
                      {date.dateLabel}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span>Valor</span>
                <input
                  className="h-10 border border-[#cfd7de] px-3"
                  type="text"
                  value={editForm.value}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      value: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="grid gap-2">
                <span>Status do pagamento</span>
                <select
                  className="h-10 border border-[#cfd7de] px-3"
                  value={editForm.purchaseStatus}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      purchaseStatus: event.target.value,
                    }))
                  }
                >
                  <option value="pend">Pendente</option>
                  <option value="conc">Concluida</option>
                  <option value="canc">Cancelada</option>
                  <option value="pago">Pago</option>
                </select>
              </label>

              {editError ? (
                <div className="rounded border border-[#ebc3c3] bg-[#fff1f1] px-4 py-3 text-[#8c2d2d] md:col-span-2">
                  {editError}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-[#d8dfe5] px-5 py-4">
              <button
                className="rounded border border-[#cfd7de] px-4 py-2 text-[#4f6576]"
                type="button"
                onClick={() => setEditTarget(null)}
              >
                Cancelar
              </button>
              <button
                className="rounded bg-[#246b99] px-4 py-2 text-white"
                type="button"
                onClick={() => setConfirmOpen(true)}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[420px] rounded bg-white shadow-xl">
            <div className="border-b border-[#d8dfe5] px-5 py-4">
              <h4 className="text-lg font-semibold text-[#355062]">Confirmar</h4>
            </div>
            <div className="px-5 py-5">Deseja salvar as alteracoes deste aluno?</div>
            <div className="flex justify-end gap-3 border-t border-[#d8dfe5] px-5 py-4">
              <button
                className="rounded border border-[#cfd7de] px-4 py-2 text-[#4f6576]"
                type="button"
                onClick={() => setConfirmOpen(false)}
              >
                Nao
              </button>
              <button
                className="rounded bg-[#246b99] px-4 py-2 text-white"
                type="button"
                onClick={() => {
                  void handleSaveStudent();
                }}
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ParticipantTable({
  rows,
  kind,
  isManager,
  onEdit,
}: {
  rows: Array<PainelClientTripDetailData["students"][number]>;
  kind: "student" | "educator" | "generic";
  isManager: boolean;
  onEdit: (participant: EditableParticipant) => void;
}) {
  const colSpan = kind === "student" && isManager ? 11 : 10;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse border border-[#d8dfe5] bg-white">
        <thead>
          <tr className="bg-[#f4f6f8] text-left text-[#53697a]">
            <th className="border border-[#d8dfe5] px-3 py-3 font-semibold">ID Compra</th>
            <th className="border border-[#d8dfe5] px-3 py-3 font-semibold">Voucher</th>
            <th className="border border-[#d8dfe5] px-3 py-3 font-semibold">
              {kind === "student" ? "Nome do aluno" : "Nome"}
            </th>
            <th className="border border-[#d8dfe5] px-3 py-3 font-semibold">
              {kind === "student" ? "Tipo/Ano/Turma" : kind === "educator" ? "Funcao" : "Tipo"}
            </th>
            <th className="border border-[#d8dfe5] px-3 py-3 font-semibold text-right">Valor</th>
            <th className="border border-[#d8dfe5] px-3 py-3 font-semibold">Data da Compra</th>
            <th className="border border-[#d8dfe5] px-3 py-3 font-semibold">Data Pag.</th>
            <th className="border border-[#d8dfe5] px-3 py-3 font-semibold">Usado?</th>
            <th className="border border-[#d8dfe5] px-3 py-3 font-semibold">Data de Uso</th>
            <th className="border border-[#d8dfe5] px-3 py-3 font-semibold">Status</th>
            {kind === "student" && isManager ? (
              <th className="border border-[#d8dfe5] px-3 py-3 font-semibold">Editar</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="border border-[#d8dfe5] px-3 py-4 text-[#768592]" colSpan={colSpan}>
                {kind === "generic" ? "Nenhum ingresso." : kind === "educator" ? "Nenhum educador/acompanhante." : "Nenhum aluno."}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.voucherId} className="odd:bg-white even:bg-[#fcfcfd]">
                <td className="border border-[#d8dfe5] px-3 py-3">{row.purchaseId}</td>
                <td className="border border-[#d8dfe5] px-3 py-3">
                  <span className="inline-block rounded border border-[#dbe3ea] bg-[#f4f7fa] px-2 py-1 font-mono text-[#3f5362]">
                    {row.voucherNumber}
                  </span>
                </td>
                <td className="border border-[#d8dfe5] px-3 py-3">{row.name}</td>
                <td className="border border-[#d8dfe5] px-3 py-3">
                  {kind === "student" ? row.classDisplay || "-" : row.role || "-"}
                </td>
                <td className="border border-[#d8dfe5] px-3 py-3 text-right">
                  R$ {formatCurrency(row.unitValue)}
                </td>
                <td className="border border-[#d8dfe5] px-3 py-3">{row.purchaseDateLabel}</td>
                <td className="border border-[#d8dfe5] px-3 py-3">{row.paymentDateLabel}</td>
                <td className="border border-[#d8dfe5] px-3 py-3">
                  <span
                    className={`mr-2 inline-block h-[10px] w-[10px] rounded-full ${
                      row.used ? "bg-[#27b15f]" : "bg-[#9aa6af]"
                    }`}
                  />
                  {row.usedLabel}
                </td>
                <td className="border border-[#d8dfe5] px-3 py-3">{row.usedDateLabel}</td>
                <td className="border border-[#d8dfe5] px-3 py-3">
                  <span
                    className={`inline-block rounded px-2 py-1 text-[12px] ${buildStatusPillClass(
                      row.purchaseStatus,
                    )}`}
                  >
                    {row.purchaseStatusLabel}
                  </span>
                </td>
                {kind === "student" && isManager ? (
                  <td className="border border-[#d8dfe5] px-3 py-3">
                    <button
                      className="rounded bg-[#246b99] px-3 py-1 text-white"
                      type="button"
                      onClick={() => onEdit(row)}
                    >
                      Editar
                    </button>
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

import Link from "next/link";
import { PainelClientesNav } from "@/components/painel-clientes-nav";
import type {
  OpsTripSchoolReportFilters,
  OpsTripSchoolReportIndicators,
  OpsTripSchoolReportParticipant,
  OpsTripSchoolReportStatusOption,
} from "@/lib/ops-trip-school-report-core";

type TripReportViewModel = {
  trip: {
    code: string;
    dateLabel: string;
  };
  filters: OpsTripSchoolReportFilters;
  statusOptions: OpsTripSchoolReportStatusOption[];
  indicators: OpsTripSchoolReportIndicators;
  students: OpsTripSchoolReportParticipant[];
  educators: OpsTripSchoolReportParticipant[];
};

type HiddenField = {
  name: string;
  value: string;
};

function SummaryCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-[24px] border border-[#d7e5ef] bg-white p-5 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
      <div className="text-4xl font-semibold text-[#205a7f]">{value}</div>
      <div className="mt-2 text-sm text-[#5d7282]">{label}</div>
    </div>
  );
}

function ParticipantTable({
  title,
  emptyLabel,
  rows,
  thirdColumnLabel,
  thirdColumnValue,
}: {
  title: string;
  emptyLabel: string;
  rows: OpsTripSchoolReportParticipant[];
  thirdColumnLabel: string;
  thirdColumnValue: (participant: OpsTripSchoolReportParticipant) => string;
}) {
  return (
    <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
      <div>
        <h2 className="text-2xl font-semibold text-[#205a7f]">{title}</h2>
        <p className="mt-1 text-sm text-[#5d7282]">
          {rows.length} registro(s) no filtro atual.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="mt-5 rounded-[20px] border border-dashed border-[#c9d8e3] bg-[#f8fbfd] px-4 py-8 text-sm text-[#5d7282]">
          {emptyLabel}
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-[22px] border border-[#d9e3eb] text-sm">
            <thead className="bg-[#edf5fa] text-left text-[#345062]">
              <tr>
                <th className="px-4 py-3">Voucher</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">{thirdColumnLabel}</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Compra</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3">Usado</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((participant, index) => (
                <tr
                  key={participant.voucherId}
                  className={index % 2 === 0 ? "bg-white" : "bg-[#f8fbfd]"}
                >
                  <td className="px-4 py-3 font-semibold text-[#205a7f]">
                    {participant.voucherNumber}
                  </td>
                  <td className="px-4 py-3">{participant.name}</td>
                  <td className="px-4 py-3">{thirdColumnValue(participant) || "-"}</td>
                  <td className="px-4 py-3">R$ {participant.unitValue}</td>
                  <td className="px-4 py-3">{participant.purchaseDateLabel}</td>
                  <td className="px-4 py-3">{participant.paymentDateLabel}</td>
                  <td className="px-4 py-3">
                    {participant.usedLabel}
                    {participant.usedDateLabel !== "-"
                      ? ` • ${participant.usedDateLabel}`
                      : ""}
                  </td>
                  <td className="px-4 py-3">{participant.purchaseStatusLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function PainelTripSchoolReportPage({
  report,
  heading,
  ownerName,
  csvHref,
  pdfHref,
  backHref,
  backLabel,
  resetHref,
  navCurrent,
  hiddenFields = [],
}: {
  report: TripReportViewModel;
  heading: string;
  ownerName: string;
  csvHref: string;
  pdfHref: string;
  backHref: string;
  backLabel: string;
  resetHref: string;
  navCurrent: "trips" | "schoolTrips";
  hiddenFields?: HiddenField[];
}) {
  return (
    <div className="grid gap-5">
      <header className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="legacy-condensed text-5xl text-[#205a7f]">{heading}</h1>
            <p className="mt-3 max-w-[80ch] text-sm leading-7 text-[#5d7282]">
              Passeio {report.trip.code} • {ownerName} • {report.trip.dateLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={csvHref}
              className="rounded-full border border-[#c9d8e3] px-4 py-2 text-sm font-semibold text-[#205a7f]"
            >
              Baixar CSV
            </Link>
            <Link
              href={pdfHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#c9d8e3] px-4 py-2 text-sm font-semibold text-[#205a7f]"
            >
              Abrir PDF
            </Link>
            <Link
              href={backHref}
              className="rounded-full bg-[#246b99] px-4 py-2 text-sm font-semibold text-white"
            >
              {backLabel}
            </Link>
          </div>
        </div>
        <div className="mt-5">
          <PainelClientesNav current={navCurrent} />
        </div>
      </header>

      <section className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
        <form method="get" className="grid gap-4 md:grid-cols-[1fr_auto]">
          {hiddenFields.map((field) => (
            <input
              key={field.name}
              type="hidden"
              name={field.name}
              value={field.value}
            />
          ))}
          <label className="grid gap-2 text-sm text-[#345062]">
            <span>Status da compra</span>
            <select
              name="purchaseStatus"
              defaultValue={report.filters.purchaseStatus}
              className="h-11 rounded-[16px] border border-[#c9d8e3] px-4 text-sm text-[#205a7f]"
            >
              {report.statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="h-11 rounded-full bg-[#246b99] px-5 text-sm font-semibold text-white"
            >
              Filtrar
            </button>
            <Link
              href={resetHref}
              className="h-11 rounded-full border border-[#c9d8e3] px-5 text-sm font-semibold leading-[44px] text-[#205a7f]"
            >
              Limpar
            </Link>
          </div>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <SummaryCard value={report.indicators.totalCount} label="Participantes" />
        <SummaryCard value={report.indicators.paidCount} label="Pagos" />
        <SummaryCard value={report.indicators.unpaidCount} label="Nao pagos" />
        <SummaryCard value={report.indicators.usedCount} label="Usados" />
        <SummaryCard value={`R$ ${report.indicators.totalValue}`} label="Valor total" />
      </section>

      <ParticipantTable
        title="Alunos"
        emptyLabel="Nenhum aluno encontrado para o filtro atual."
        rows={report.students}
        thirdColumnLabel="Turma"
        thirdColumnValue={(participant) => participant.classDisplay}
      />

      <ParticipantTable
        title="Educadores"
        emptyLabel="Nenhum educador encontrado para o filtro atual."
        rows={report.educators}
        thirdColumnLabel="Funcao"
        thirdColumnValue={(participant) => participant.role}
      />
    </div>
  );
}

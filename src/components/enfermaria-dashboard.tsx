"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { EnfermariaRecord } from "@/lib/enfermaria";
import styles from "./enfermaria-visual.module.css";

type DashboardData = {
  records: EnfermariaRecord[];
  totals: { count: number; open: number; upa: number; urgent: number };
  demandCounts: Record<string, number>;
  localCounts: Record<string, number>;
  timeCounts: Record<string, number>;
  timeline: Record<string, number>;
};

const chartColors = ["#133A62", "#2F6FB2", "#5FA8D3", "#E0A43A", "#C9D6E4"];

async function load(from: string, to: string) {
  const response = await fetch(`/api/painel/enfermaria?action=dashboard&from=${from}&to=${to}`);
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "Falha ao carregar o painel.");
  return result.data as DashboardData;
}

function dateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function periodRange(period: string) {
  const end = new Date();
  const start = new Date();
  if (period === "semana") start.setDate(start.getDate() - 6);
  if (period === "mes") start.setDate(1);
  return { from: dateString(start), to: dateString(end) };
}

function getTimelineDays(from: string, to: string, counts: Record<string, number>) {
  const first = new Date(`${from}T12:00:00`);
  const last = new Date(`${to}T12:00:00`);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime()) || first > last) return [];

  const days: Array<{ date: string; count: number; weekend: boolean; label: boolean }> = [];
  const cursor = new Date(first);
  while (cursor <= last && days.length < 366) {
    const date = dateString(cursor);
    const dayNumber = cursor.getDate();
    const totalDays = Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;
    days.push({
      date,
      count: counts[date] ?? 0,
      weekend: cursor.getDay() === 0 || cursor.getDay() === 6,
      label: totalDays <= 14 || dayNumber === 1 || dayNumber % 7 === 1 || date === to,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
}

function makeDonutGradient(rows: Array<[string, number]>, total: number) {
  if (total <= 0) return "conic-gradient(#EAF2FB 0deg 360deg)";
  let offset = 0;
  const parts = rows.map(([, value], index) => {
    const start = (offset / total) * 360;
    offset += value;
    return `${chartColors[index % chartColors.length]} ${start}deg ${(offset / total) * 360}deg`;
  });
  return `conic-gradient(${parts.join(", ")})`;
}

function BarRows({ values, color = "#133A62" }: { values: Record<string, number>; color?: string }) {
  const rows = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, value]) => value));
  if (!rows.length) return <p className={styles.empty}>Sem registros no período.</p>;

  return <div className={styles.hbars}>
    {rows.map(([label, value]) => <div key={label} className={styles.hbar}>
      <span>{label}</span>
      <div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${(value / max) * 100}%`, background: color }} /></div>
      <span className={styles.barCount}>{value}</span>
    </div>)}
  </div>;
}

function DemandChart({ values, recordCount }: { values: Record<string, number>; recordCount: number }) {
  const rows = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  return <section className={styles.chartCard}>
    <h2 className={styles.chartTitle}>Por tipo de demanda</h2>
    <p className={styles.chartCaption}>Conforme o checklist da ficha.</p>
    {rows.length ? <div className={styles.donutRow}>
      <div className={styles.donut} style={{ background: makeDonutGradient(rows, total) }} aria-label={`${total} atendimentos por tipo de demanda`}>
        <span className={styles.donutLabel}><strong>{recordCount}</strong>atendimentos</span>
      </div>
      <div className={styles.legend}>
        {rows.map(([label, count], index) => <div key={label} className={styles.legendItem}>
          <i className={styles.legendSwatch} style={{ background: chartColors[index % chartColors.length] }} />
          <span>{label}</span><b className={styles.legendValue}>{count}</b>
        </div>)}
      </div>
    </div> : <p className={styles.empty}>Sem registros no período.</p>}
  </section>;
}

function TimelineChart({ from, to, counts }: { from: string; to: string; counts: Record<string, number> }) {
  const days = getTimelineDays(from, to, counts);
  const max = Math.max(1, ...days.map((item) => item.count));
  return <section className={styles.chartCard}>
    <h2 className={styles.chartTitle}>Linha do tempo</h2>
    <p className={styles.chartCaption}>Atendimentos por dia no período selecionado.</p>
    {days.length ? <div className={styles.timeline} aria-label="Gráfico de atendimentos por dia">
      {days.map((day) => <div key={day.date} className={styles.timelineDay} title={`${formatDate(day.date)}: ${day.count} atendimento(s)`}>
        <span className={styles.timelineCount}>{day.count || ""}</span>
        <div className={`${styles.timelineBar} ${day.weekend ? styles.timelineWeekend : ""}`} style={{ height: `${Math.max(day.count ? 8 : 3, (day.count / max) * 104)}px` }} />
        <span className={styles.timelineDate}>{day.label ? String(Number(day.date.slice(8))) : ""}</span>
      </div>)}
    </div> : <p className={styles.empty}>Escolha um período válido para ver a linha do tempo.</p>}
  </section>;
}

function SourceAndTimeChart({ records, timeCounts }: { records: EnfermariaRecord[]; timeCounts: Record<string, number> }) {
  const groups = [
    { label: "Passeio", count: records.filter((record) => record.source === "cliente").length, color: "#133A62", textColor: "#fff" },
    { label: "Day use", count: records.filter((record) => record.source === "day_use").length, color: "#5FA8D3", textColor: "#0F2D52" },
    { label: "Sem cadastro", count: records.filter((record) => record.source === "sem_cadastro").length, color: "#E0A43A", textColor: "#3A2606" },
  ];
  const total = groups.reduce((sum, item) => sum + item.count, 0);

  return <section className={styles.chartCard}>
    <h2 className={styles.chartTitle}>Cliente/passeio vs day use</h2>
    <p className={styles.chartCaption}>Quem foi atendido.</p>
    {total ? <>
      <div className={styles.splitBar} aria-label={`${total} atendimentos por origem`}>
        {groups.filter((item) => item.count > 0).map((item) => <div key={item.label} className={styles.splitPart} style={{ width: `${(item.count / total) * 100}%`, background: item.color, color: item.textColor }} title={`${item.label}: ${item.count}`}>
          {item.count / total >= 0.18 ? `${item.label} · ${item.count}` : item.count}
        </div>)}
      </div>
      <div className={styles.splitLegend}>{groups.map((item) => <span key={item.label}>{item.label} · {item.count}</span>)}</div>
    </> : <p className={styles.empty}>Sem registros no período.</p>}
    <h3 className={styles.subChartTitle}>Por faixa de horário</h3>
    <p className={styles.chartCaption}>Quando os atendimentos acontecem.</p>
    <BarRows values={timeCounts} color="#2F6FB2" />
  </section>;
}

export function EnfermariaDashboard({ canManage = false }: { canManage?: boolean }) {
  const [period, setPeriod] = useState("mes");
  const initialRange = periodRange("mes");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    void load(from, to)
      .then((result) => { setData(result); setError(""); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Falha ao carregar o painel."));
  }, [from, to]);

  const recent = useMemo(() => data?.records.slice(0, 8) ?? [], [data]);
  const monthLabel = useMemo(() => {
    if (from === to) return from === dateString(new Date()) ? "hoje" : formatDate(from);
    const fromDate = new Date(`${from}T12:00:00`);
    const toDate = new Date(`${to}T12:00:00`);
    if (fromDate.getDate() === 1 && fromDate.getMonth() === toDate.getMonth() && fromDate.getFullYear() === toDate.getFullYear()) {
      return `em ${fromDate.toLocaleDateString("pt-BR", { month: "long" })}`;
    }
    return "no período";
  }, [from, to]);

  function choosePeriod(value: string) {
    setPeriod(value);
    if (value !== "personalizado") {
      const range = periodRange(value);
      setFrom(range.from);
      setTo(range.to);
    }
  }

  const sources = new URLSearchParams({ from, to });
  const recordsUrl = `/api/painel/enfermaria/export?kind=cases&${sources.toString()}`;
  const reportUrl = `/painel/enfermaria/relatorio?${sources.toString()}`;
  const packageUrl = `/painel/enfermaria/exportar?kind=pack&${sources.toString()}`;

  return <div className={`${styles.page} ${styles.dashboard}`}>
    <section className={styles.card}>
      <header className={styles.headRow}>
        <div>
          <p className={styles.eyebrow}>Enfermaria</p>
          <h1 className={styles.pageTitle}>Painel da Enfermaria</h1>
          <p className={styles.pageSub}>Atendimentos registrados pela equipe de enfermagem do Rincão.</p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.button} href="/painel/enfermaria/historico">Histórico</Link>
          {canManage && <Link className={styles.button} href="/painel/enfermaria/locais">Locais do parque</Link>}
          <button className={styles.button} type="button" onClick={() => setExportOpen(true)}>Exportar</button>
          <Link className={`${styles.button} ${styles.buttonPrimary}`} href="/painel/enfermaria/novo">＋ Novo atendimento</Link>
        </div>
      </header>
    </section>

    <section className={styles.card}>
      <div className={styles.periodRow}>
        <span className={styles.periodLabel}>Período</span>
        <div className={styles.period} role="group" aria-label="Período">
          {[["hoje", "Hoje"], ["semana", "Semana"], ["mes", "Mês"], ["personalizado", "Personalizado"]].map(([value, label]) => <button key={value} aria-pressed={period === value} type="button" onClick={() => choosePeriod(value)}>{label}</button>)}
        </div>
      </div>
      {period === "personalizado" && <div className={styles.customDates}>
        <label>De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {!data ? <p className={styles.empty}>Carregando atendimentos…</p> : <div className={styles.kpis}>
        {[
          { label: "Atendimentos", value: data.totals.count, hint: monthLabel, highlight: true },
          { label: "Em aberto", value: data.totals.open, hint: "ficha ainda não encerrada" },
          { label: "Encaminhados à UPA", value: data.totals.upa, hint: `${data.totals.count ? Math.round((data.totals.upa / data.totals.count) * 100) : 0}% dos atendimentos`, alert: true },
          { label: "Sinais de alerta", value: data.totals.urgent, hint: "urgência marcada na ficha", alert: true },
        ].map((item) => <article key={item.label} className={`${styles.kpi} ${item.highlight ? styles.kpiHighlight : ""}`}>
          <p className={styles.kpiLabel}>{item.label}</p>
          <p className={`${styles.kpiValue} ${item.alert ? styles.kpiAlert : ""}`}>{item.value}</p>
          <p className={styles.kpiHint}>{item.hint}</p>
        </article>)}
      </div>}
    </section>

    {data && <>
      <div className={styles.charts}>
        <section className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Ocorrências por local</h2>
          <p className={styles.chartCaption}>Onde os atendimentos aconteceram no parque.</p>
          <BarRows values={data.localCounts} />
        </section>
        <DemandChart values={data.demandCounts} recordCount={data.totals.count} />
        <TimelineChart from={from} to={to} counts={data.timeline} />
        <SourceAndTimeChart records={data.records} timeCounts={data.timeCounts} />
      </div>

      <section className={styles.recent}>
        <div className={styles.recentHead}>
          <div><h2 className={styles.recentTitle}>Últimos atendimentos</h2><p className={styles.recentHint}>{data.totals.count} atendimentos no período escolhido.</p></div>
          <Link className={styles.textLink} href="/painel/enfermaria/historico">Ver histórico completo →</Link>
        </div>
        <div className={styles.tableScroll}>
          <table className="w-full min-w-[760px] text-left">
            <thead><tr>{["Nº", "Data", "Atendido", "Local", "Demanda", "Status"].map((label) => <th key={label}>{label}</th>)}</tr></thead>
            <tbody>
              {recent.map((record) => {
                const form = record.form as { identification?: { name?: string }; context?: { buyerName?: string }; complaint?: { demandTypes?: string[] } };
                return <tr key={record.id}>
                  <td><Link className={styles.textLink} href={`/painel/enfermaria/${record.id}`}>{record.numberLabel}</Link></td>
                  <td>{new Date(record.occurredAt.replace(" ", "T")).toLocaleString("pt-BR")}</td>
                  <td>{form.identification?.name ?? form.context?.buyerName ?? "—"}</td>
                  <td>{record.localName ?? "—"}</td>
                  <td>{form.complaint?.demandTypes?.join(", ") || "—"}</td>
                  <td><span className={record.status === "aberto" ? styles.statusOpen : styles.statusClosed}>{record.status === "aberto" ? "Em aberto" : "Encerrado"}</span></td>
                </tr>;
              })}
              {!recent.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Nenhum atendimento neste período.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>}

    {data && <div className="flex justify-end"><Link className={styles.textLink} href={packageUrl}>Imprimir pacote de fichas do período →</Link></div>}

    {exportOpen && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setExportOpen(false); }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="enfermaria-export-title">
        <h2 id="enfermaria-export-title" className={styles.modalTitle}>Exportar atendimentos</h2>
        <p className={styles.pageSub}>As exportações respeitam o período selecionado.</p>
        <div className={styles.exportList}>
          <a className={styles.exportItem} href={recordsUrl}><span className={styles.exportIcon}>XLS</span><span><b className={styles.exportLabel}>Lista de casos em Excel</b><small className={styles.exportHint}>CSV compatível com Excel para o período.</small></span></a>
          <Link className={styles.exportItem} href={reportUrl}><span className={styles.exportIcon}>PDF</span><span><b className={styles.exportLabel}>Relatório executivo em PDF</b><small className={styles.exportHint}>Resumo e gráficos, com opção anonimizada.</small></span></Link>
          <Link className={styles.exportItem} href={packageUrl}><span className={styles.exportIcon}>PDF</span><span><b className={styles.exportLabel}>Pacote com as últimas fichas</b><small className={styles.exportHint}>Reúne as fichas do período para imprimir.</small></span></Link>
          <Link className={styles.exportItem} href="/painel/enfermaria/historico"><span className={styles.exportIcon}>PDF</span><span><b className={styles.exportLabel}>Ficha individual</b><small className={styles.exportHint}>Abra um atendimento no histórico e escolha imprimir.</small></span></Link>
        </div>
        <div className={styles.modalActions}><button type="button" className={styles.button} onClick={() => setExportOpen(false)}>Fechar</button></div>
      </section>
    </div>}
  </div>;
}

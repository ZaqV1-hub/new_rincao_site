"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { EnfermariaRecord } from "@/lib/enfermaria";
import { EnfermariaPagination } from "./enfermaria-pagination";
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

function BarRows({ values, color = "#133A62" }: { values: Record<string, number>; color?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const rows = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, value]) => value));
  const total = rows.reduce((sum, [, value]) => sum + value, 0);
  const selected = rows.find(([label]) => label === active);
  if (!rows.length) return <p className={styles.empty}>Sem registros no período.</p>;

  return <div className={styles.chartInteractive}>
    <div className={styles.hbars}>{rows.map(([label, value]) => <button type="button" key={label} className={`${styles.hbar} ${active === label ? styles.hbarActive : ""}`} aria-label={`${label}: ${value} atendimento(s), ${Math.round(value / total * 100)}% do total`} onMouseEnter={() => setActive(label)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(label)} onBlur={() => setActive(null)} onClick={() => setActive(active === label ? null : label)}>
      <span>{label}</span>
      <div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${(value / max) * 100}%`, background: color }} /></div>
      <span className={styles.barCount}>{value}</span>
    </button>)}</div>
    <p className={styles.chartDetail} aria-live="polite">{selected ? <><strong>{selected[0]}</strong> · {selected[1]} atendimento(s) · {Math.round(selected[1] / total * 100)}% do total</> : "Passe o mouse, toque ou use o teclado para ver os detalhes."}</p>
  </div>;
}

function DemandChart({ values, recordCount }: { values: Record<string, number>; recordCount: number }) {
  const [active, setActive] = useState<string | null>(null);
  const rows = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  const selected = rows.find(([label]) => label === active);
  const circumference = 2 * Math.PI * 54;
  let offset = 0;
  return <section className={styles.chartCard}>
    <h2 className={styles.chartTitle}>Por tipo de demanda</h2>
    <p className={styles.chartCaption}>Conforme o checklist da ficha.</p>
    {rows.length ? <div className={styles.donutRow}>
      <div className={styles.donut} onMouseLeave={() => setActive(null)}>
        <svg className={styles.donutSvg} viewBox="0 0 150 150" aria-label="Atendimentos por tipo de demanda">
          <circle cx="75" cy="75" r="54" fill="none" stroke="#eaf2fb" strokeWidth="20" />
          {rows.map(([label, count], index) => {
            const length = count / total * circumference;
            const start = offset;
            offset += length;
            return <circle key={label} cx="75" cy="75" r="54" fill="none" stroke={chartColors[index % chartColors.length]} strokeWidth={active === label ? "27" : "20"} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-start} transform="rotate(-90 75 75)" className={`${styles.donutSegment} ${active && active !== label ? styles.chartDimmed : ""}`} tabIndex={0} role="button" aria-label={`${label}: ${count} atendimento(s), ${Math.round(count / total * 100)}% das demandas`} onMouseEnter={() => setActive(label)} onFocus={() => setActive(label)} onBlur={() => setActive(null)} onClick={() => setActive(active === label ? null : label)} />;
          })}
        </svg>
        <span className={styles.donutLabel}><strong>{selected ? selected[1] : recordCount}</strong>{selected ? selected[0] : "atendimentos"}</span>
      </div>
      <div className={styles.legend}>
        {rows.map(([label, count], index) => <button type="button" key={label} className={`${styles.legendItem} ${active === label ? styles.legendItemActive : ""}`} onMouseEnter={() => setActive(label)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(label)} onBlur={() => setActive(null)} onClick={() => setActive(active === label ? null : label)}>
          <i className={styles.legendSwatch} style={{ background: chartColors[index % chartColors.length] }} />
          <span>{label}</span><b className={styles.legendValue}>{count}</b>
        </button>)}
      </div>
    </div> : <p className={styles.empty}>Sem registros no período.</p>}
    {rows.length > 0 && <p className={styles.chartDetail} aria-live="polite">{selected ? <><strong>{selected[0]}</strong> · {selected[1]} ocorrência(s) · {Math.round(selected[1] / total * 100)}% das demandas</> : "Passe o mouse, toque ou use o teclado para ver os detalhes."}</p>}
  </section>;
}

function TimelineChart({ from, to, counts }: { from: string; to: string; counts: Record<string, number> }) {
  const [active, setActive] = useState<string | null>(null);
  const days = getTimelineDays(from, to, counts);
  const max = Math.max(1, ...days.map((item) => item.count));
  const selected = days.find((day) => day.date === active);
  return <section className={styles.chartCard}>
    <h2 className={styles.chartTitle}>Linha do tempo</h2>
    <p className={styles.chartCaption}>Atendimentos por dia no período selecionado.</p>
    {days.length ? <div className={styles.timeline} aria-label="Gráfico de atendimentos por dia">
      {days.map((day) => <button type="button" key={day.date} className={`${styles.timelineDay} ${active === day.date ? styles.timelineDayActive : ""} ${active && active !== day.date ? styles.chartDimmed : ""}`} aria-label={`${formatDate(day.date)}: ${day.count} atendimento(s)`} onMouseEnter={() => setActive(day.date)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(day.date)} onBlur={() => setActive(null)} onClick={() => setActive(active === day.date ? null : day.date)}>
        <span className={styles.timelineCount}>{day.count || ""}</span>
        <div className={`${styles.timelineBar} ${day.weekend ? styles.timelineWeekend : ""}`} style={{ height: `${Math.max(day.count ? 8 : 3, (day.count / max) * 104)}px` }} />
        <span className={styles.timelineDate}>{day.label ? String(Number(day.date.slice(8))) : ""}</span>
      </button>)}
    </div> : <p className={styles.empty}>Escolha um período válido para ver a linha do tempo.</p>}
    {days.length > 0 && <p className={styles.chartDetail} aria-live="polite">{selected ? <><strong>{formatDate(selected.date)}</strong> · {selected.count} atendimento(s){selected.weekend ? " · fim de semana" : ""}</> : "Passe o mouse, toque ou use o teclado para ver os detalhes de cada dia."}</p>}
  </section>;
}

function SourceAndTimeChart({ records, timeCounts }: { records: EnfermariaRecord[]; timeCounts: Record<string, number> }) {
  const [active, setActive] = useState<string | null>(null);
  const groups = [
    { label: "Passeio", count: records.filter((record) => record.source === "cliente").length, color: "#133A62", textColor: "#fff" },
    { label: "Day use", count: records.filter((record) => record.source === "day_use").length, color: "#5FA8D3", textColor: "#0F2D52" },
    { label: "Sem cadastro", count: records.filter((record) => record.source === "sem_cadastro").length, color: "#E0A43A", textColor: "#3A2606" },
  ];
  const total = groups.reduce((sum, item) => sum + item.count, 0);
  const selected = groups.find((item) => item.label === active);

  return <section className={styles.chartCard}>
    <h2 className={styles.chartTitle}>Cliente/passeio vs day use</h2>
    <p className={styles.chartCaption}>Quem foi atendido.</p>
    {total ? <>
      <div className={styles.splitBar} aria-label={`${total} atendimentos por origem`}>
        {groups.filter((item) => item.count > 0).map((item) => <button type="button" key={item.label} className={`${styles.splitPart} ${active === item.label ? styles.splitPartActive : ""} ${active && active !== item.label ? styles.chartDimmed : ""}`} style={{ width: `${(item.count / total) * 100}%`, background: item.color, color: item.textColor }} aria-label={`${item.label}: ${item.count} atendimento(s), ${Math.round(item.count / total * 100)}% do total`} onMouseEnter={() => setActive(item.label)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(item.label)} onBlur={() => setActive(null)} onClick={() => setActive(active === item.label ? null : item.label)}>
          {item.count / total >= 0.18 ? `${item.label} · ${item.count}` : item.count}
        </button>)}
      </div>
      <div className={styles.splitLegend}>{groups.map((item) => <button type="button" key={item.label} className={active === item.label ? styles.splitLegendActive : ""} onMouseEnter={() => setActive(item.label)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(item.label)} onBlur={() => setActive(null)} onClick={() => setActive(active === item.label ? null : item.label)}>{item.label} · {item.count}</button>)}</div>
    </> : <p className={styles.empty}>Sem registros no período.</p>}
    {total > 0 && <p className={styles.chartDetail} aria-live="polite">{selected ? <><strong>{selected.label}</strong> · {selected.count} atendimento(s) · {Math.round(selected.count / total * 100)}% do total</> : "Passe o mouse, toque ou use o teclado para ver os detalhes."}</p>}
    <h3 className={styles.subChartTitle}>Por faixa de horário</h3>
    <p className={styles.chartCaption}>Quando os atendimentos acontecem.</p>
    <BarRows values={timeCounts} color="#2F6FB2" />
  </section>;
}

export function EnfermariaDashboard({ canManage = false }: { canManage?: boolean }) {
  const router = useRouter();
  const [period, setPeriod] = useState("mes");
  const initialRange = periodRange("mes");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [recentPage, setRecentPage] = useState(1);

  useEffect(() => {
    void load(from, to)
      .then((result) => { setData(result); setRecentPage(1); setError(""); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Falha ao carregar o painel."));
  }, [from, to]);

  const recent = useMemo(() => data?.records.slice((recentPage - 1) * 10, recentPage * 10) ?? [], [data, recentPage]);
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
                return <tr key={record.id} className={styles.clickableRow} tabIndex={0} role="link" aria-label={`Abrir atendimento ${record.numberLabel}`} onClick={() => router.push(`/painel/enfermaria/${record.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(`/painel/enfermaria/${record.id}`); } }}>
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
        <EnfermariaPagination page={recentPage} total={data.records.length} onChange={setRecentPage} />
      </section>
    </>}

    {data && <div className="flex justify-end"><Link className={styles.textLink} href={packageUrl}>Imprimir pacote de fichas do período →</Link></div>}

    {exportOpen && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setExportOpen(false); }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="enfermaria-export-title">
        <h2 id="enfermaria-export-title" className={styles.modalTitle}>Exportar atendimentos</h2>
        <p className={styles.pageSub}>As exportações respeitam o período selecionado.</p>
        <div className={styles.exportList}>
          <a className={styles.exportItem} href={recordsUrl}><span className={styles.exportIcon}>XLS</span><span><b className={styles.exportLabel}>Lista de casos em Excel</b><small className={styles.exportHint}>Planilha Excel para o período.</small></span></a>
          <Link className={styles.exportItem} href={reportUrl}><span className={styles.exportIcon}>PDF</span><span><b className={styles.exportLabel}>Relatório executivo em PDF</b><small className={styles.exportHint}>Indicadores e gráficos consolidados do período.</small></span></Link>
          <Link className={styles.exportItem} href={packageUrl}><span className={styles.exportIcon}>PDF</span><span><b className={styles.exportLabel}>Pacote com as últimas fichas</b><small className={styles.exportHint}>Reúne as fichas do período para imprimir.</small></span></Link>
          <Link className={styles.exportItem} href="/painel/enfermaria/historico"><span className={styles.exportIcon}>PDF</span><span><b className={styles.exportLabel}>Ficha individual</b><small className={styles.exportHint}>Abra um atendimento no histórico e escolha imprimir.</small></span></Link>
        </div>
        <div className={styles.modalActions}><button type="button" className={styles.button} onClick={() => setExportOpen(false)}>Fechar</button></div>
      </section>
    </div>}
  </div>;
}

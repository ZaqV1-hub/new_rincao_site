import Link from "next/link";
import { EnfermariaPrintButton } from "@/components/enfermaria-print-button";
import { requirePainelAccess } from "@/lib/painel-session";
import { listEnfermariaDashboard } from "@/lib/enfermaria";
import styles from "./report.module.css";

export const dynamic = "force-dynamic";

type CountRow = [string, number];

function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function topLocations(values: Record<string, number>): CountRow[] {
  const rows = Object.entries(values).sort((a, b) => b[1] - a[1]);
  if (rows.length <= 6) return rows;
  return [...rows.slice(0, 5), ["Outros locais", rows.slice(5).reduce((sum, [, count]) => sum + count, 0)]];
}

function BarChart({ title, hint, values, total, color }: {
  title: string;
  hint: string;
  values: CountRow[];
  total: number;
  color: string;
}) {
  const max = Math.max(1, ...values.map(([, count]) => count));
  return <section className={styles.chartCard}>
    <div className={styles.chartHeading}><h2>{title}</h2><p>{hint}</p></div>
    {values.length ? <div className={styles.barList}>{values.map(([label, count]) => <div className={styles.barRow} key={label}>
      <div className={styles.barLabel}><span>{label}</span><strong>{count} <small>({total ? Math.round(count / total * 100) : 0}%)</small></strong></div>
      <div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${count / max * 100}%`, backgroundColor: color }} /></div>
    </div>)}</div> : <p className={styles.empty}>Sem registros no período.</p>}
  </section>;
}

function OriginChart({ values }: { values: CountRow[] }) {
  const colors = ["#153f68", "#4e97c3", "#d9a048"];
  const total = values.reduce((sum, [, count]) => sum + count, 0);
  let offset = 0;
  const stops = values.map(([, count], index) => {
    const start = total ? offset / total * 360 : 0;
    offset += count;
    return `${colors[index]} ${start}deg ${total ? offset / total * 360 : 0}deg`;
  });
  return <section className={styles.chartCard}>
    <div className={styles.chartHeading}><h2>Origem do atendimento</h2><p>Como a pessoa chegou ao parque.</p></div>
    {total ? <div className={styles.originBody}>
      <div className={styles.donut} style={{ background: `conic-gradient(${stops.join(", ")})` }} role="img" aria-label={values.map(([label, count]) => `${label}: ${count}`).join(", ")}>
        <div><strong>{total}</strong><span>atendimentos</span></div>
      </div>
      <div className={styles.legend}>{values.map(([label, count], index) => <div key={label}>
        <i style={{ backgroundColor: colors[index] }} /><span>{label}</span><strong>{count}</strong>
      </div>)}</div>
    </div> : <p className={styles.empty}>Sem registros no período.</p>}
  </section>;
}

function TimeChart({ values, total }: { values: CountRow[]; total: number }) {
  const max = Math.max(1, ...values.map(([, count]) => count));
  return <section className={styles.chartCard}>
    <div className={styles.chartHeading}><h2>Faixa de horário</h2><p>Distribuição dos atendimentos ao longo do dia.</p></div>
    {total ? <div className={styles.timeChart}>{values.map(([label, count]) => <div className={styles.timeColumn} key={label}>
      <div className={styles.timePlot}><strong>{count}</strong><div style={{ height: `${Math.max(4, count / max * 100)}%` }} /></div>
      <span>{label}</span>
      <small>{Math.round(count / total * 100)}%</small>
    </div>)}</div> : <p className={styles.empty}>Sem registros no período.</p>}
  </section>;
}

export default async function EnfermariaExecutiveReport({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePainelAccess("vis_enfermaria", "/painel/enfermaria/relatorio");
  const query = await searchParams;
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const from = typeof query.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.from) ? query.from : today;
  const to = typeof query.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.to) ? query.to : today;
  const data = await listEnfermariaDashboard(from, to, true);
  const count = data.totals.count;
  const demand = Object.entries(data.demandCounts).sort((a, b) => b[1] - a[1]);
  const origin: CountRow[] = [
    ["Cliente / passeio", data.records.filter((record) => record.source === "cliente").length],
    ["Day use", data.records.filter((record) => record.source === "day_use").length],
    ["Sem cadastro", data.records.filter((record) => record.source === "sem_cadastro").length],
  ];
  const times: CountRow[] = ["Antes de 12h", "12h às 15h", "Após 15h"].map((label) => [label, data.timeCounts[label] ?? 0]);
  const generated = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date());
  const metrics = [
    { label: "Atendimentos", value: count, detail: "no período selecionado" },
    { label: "Encerrados", value: count - data.totals.open, detail: count ? `${Math.round((count - data.totals.open) / count * 100)}% do total` : "0% do total" },
    { label: "Encaminhados à UPA", value: data.totals.upa, detail: count ? `${Math.round(data.totals.upa / count * 100)}% do total` : "0% do total" },
    { label: "Sinais de urgência", value: data.totals.urgent, detail: count ? `${Math.round(data.totals.urgent / count * 100)}% do total` : "0% do total" },
  ];

  return <main className={styles.report}>
    <nav className={styles.toolbar}><Link href={`/painel/enfermaria?from=${from}&to=${to}`}>← Voltar à Enfermaria</Link><EnfermariaPrintButton label="Imprimir / Salvar PDF" /></nav>
    <div className={styles.sheet}>
      <header className={styles.reportHeader}>
        <div><p className={styles.brand}>Clube e Park Rincão</p><h1>Enfermaria <span>Relatório executivo</span></h1><p className={styles.reportSubtitle}>Visão consolidada dos atendimentos, sem dados pessoais.</p></div>
        <div className={styles.period}><span>Período analisado</span><strong>{formatDate(from)} a {formatDate(to)}</strong><small>Gerado em {generated}</small></div>
      </header>

      <section className={styles.metrics} aria-label="Indicadores do período">
        {metrics.map((metric) => <div className={styles.metric} key={metric.label}><span>{metric.label}</span><strong>{metric.value.toLocaleString("pt-BR")}</strong><small>{metric.detail}</small></div>)}
      </section>

      <div className={styles.chartGrid}>
        <BarChart title="Ocorrências por local" hint="Locais com mais registros; os demais são agrupados." values={topLocations(data.localCounts)} total={count} color="#153f68" />
        <BarChart title="Tipos de demanda" hint="Uma ficha pode conter mais de um tipo." values={demand} total={count} color="#4e97c3" />
        <OriginChart values={origin} />
        <TimeChart values={times} total={count} />
      </div>

      <footer className={styles.footer}><span>Documento interno para acompanhamento da Enfermaria do Rincão.</span><span>Dados agregados · {count.toLocaleString("pt-BR")} atendimento(s)</span></footer>
    </div>
  </main>;
}

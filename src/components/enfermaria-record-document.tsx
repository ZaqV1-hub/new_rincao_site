import type { EnfermariaRecord } from "@/lib/enfermaria";
import styles from "./enfermaria-visual.module.css";

type Section = Record<string, unknown>;

function section(form: Record<string, unknown>, key: string): Section {
  const value = form[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Section : {};
}

function shown(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "—";
  const text = String(value ?? "").trim();
  return text || "—";
}

function Detail({ label, value, wide = false }: { label: string; value: unknown; wide?: boolean }) {
  return <div className={wide ? styles.documentWide : undefined}><dt>{label}</dt><dd>{shown(value)}</dd></div>;
}

export function EnfermariaRecordDocument({ record, form, occurredAt, localName, age, professional }: {
  record: EnfermariaRecord;
  form: Record<string, unknown>;
  occurredAt: string;
  localName: string;
  age?: string;
  professional: string;
}) {
  const identification = section(form, "identification");
  const context = section(form, "context");
  const unregistered = section(form, "unregisteredDetails");
  const complaint = section(form, "complaint");
  const symptoms = section(form, "symptoms");
  const vitals = section(form, "vitals");
  const urgency = section(form, "urgency");
  const risk = section(form, "risk");
  const referral = section(form, "referral");
  const reports = section(form, "reports");
  const responsible = section(form, "responsible");
  const date = new Date(occurredAt.replace(" ", "T"));
  const dateLabel = Number.isNaN(date.getTime()) ? occurredAt : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const birth = new Date(`${String(identification.birthDate ?? "")}T12:00:00`);
  const calculatedAge = !Number.isNaN(date.getTime()) && !Number.isNaN(birth.getTime())
    ? date.getFullYear() - birth.getFullYear() - (date.getMonth() < birth.getMonth() || (date.getMonth() === birth.getMonth() && date.getDate() < birth.getDate()) ? 1 : 0)
    : -1;
  const source = record.source === "day_use" ? "Day use" : record.source === "cliente" ? "Cliente / passeio" : "Sem cadastro";
  const link = record.source === "day_use"
    ? `Comprador ${shown(context.buyerName)} · CPF ${shown(record.buyerCpf)} · Compra #${record.purchaseId}`
    : record.source === "cliente"
      ? `${shown(context.clientName)} · Cliente #${record.clientId} · Passeio #${record.tripId}`
      : shown(unregistered.intakeSource);
  return <article className={styles.recordDocument} aria-label="Ficha de atendimento de enfermagem">
    <div className={styles.documentHead}>
      <div><p className={styles.documentEyebrow}>Clube e Park Rincão</p><h2>Ficha de atendimento de enfermagem</h2></div>
      <div className={styles.documentMeta}><strong>Nº {record.numberLabel}</strong><span>{dateLabel}</span></div>
    </div>
    <section className={styles.documentSection}><h3>Atendimento</h3><dl className={styles.documentGrid}>
      <Detail label="Tipo" value={source} /><Detail label="Vínculo" value={link} wide /><Detail label="Local da ocorrência" value={localName} />
      <Detail label="Profissional" value={professional} /><Detail label="Status" value={record.status === "aberto" ? "Em aberto" : "Encerrado"} />
    </dl></section>
    <section className={styles.documentSection}><h3>1. Identificação</h3><dl className={styles.documentGrid}>
      <Detail label="Nome" value={identification.name} wide /><Detail label="CPF" value={identification.cpf ?? record.buyerCpf} /><Detail label="Idade" value={age || (calculatedAge >= 0 ? `${calculatedAge} anos` : "")} />
      <Detail label="Nascimento" value={identification.birthDate} /><Detail label="Sexo" value={identification.sex} /><Detail label="Telefone" value={identification.phone} />
      <Detail label="Acompanhante" value={identification.companion} /><Detail label="Parentesco" value={identification.relationship} />
    </dl></section>
    <section className={styles.documentSection}><h3>2. Queixa principal e demanda</h3><dl className={styles.documentGrid}>
      <Detail label="Queixa" value={complaint.text} wide /><Detail label="Demanda" value={complaint.demandTypes} wide />
    </dl></section>
    <section className={styles.documentSection}><h3>3. Sinais e sintomas</h3><dl className={styles.documentGrid}>
      <Detail label="Sinais" value={symptoms.items} wide /><Detail label="Localização da dor" value={symptoms.painLocation} /><Detail label="Intensidade da dor" value={symptoms.painIntensity} />
    </dl></section>
    <section className={styles.documentSection}><h3>4. Sinais vitais</h3><dl className={styles.documentGrid}>
      <Detail label="PA" value={vitals.bloodPressure} /><Detail label="FC" value={vitals.heartRate} /><Detail label="FR" value={vitals.respiratoryRate} /><Detail label="SpO₂" value={vitals.oxygenSaturation} />
      <Detail label="Temperatura" value={vitals.temperature} /><Detail label="Glicemia" value={vitals.glucose} /><Detail label="Dor" value={vitals.pain} /><Detail label="Aferição" value={vitals.measuredAt} />
    </dl></section>
    <section className={styles.documentSection}><h3>5 a 7. Urgência, risco e encaminhamento</h3><dl className={styles.documentGrid}>
      <Detail label="Urgência" value={typeof form.urgent === "boolean" ? form.urgent ? "Sim" : "Não" : ""} /><Detail label="Sinais de alerta" value={urgency.items} /><Detail label="Risco" value={risk.items} wide />
      <Detail label="Conduta" value={urgency.conduct} wide /><Detail label="Encaminhado à UPA" value={typeof form.referralToUpa === "boolean" ? form.referralToUpa ? "Sim" : "Não" : ""} />
      {form.referralToUpa === true && <><Detail label="Motivo" value={referral.reason} /><Detail label="Forma" value={referral.method} /><Detail label="Horário" value={referral.time} /><Detail label="Destino" value={referral.destination} /></>}
    </dl></section>
    <section className={styles.documentSection}><h3>8. Relatório do enfermeiro</h3><p>{shown(reports.nurse)}</p></section>
    <section className={styles.documentSection}><h3>9. Relatório do técnico de enfermagem</h3><p>{shown(reports.technician)}</p></section>
    <section className={styles.documentSection}><h3>10. Observações complementares</h3><p>{shown(reports.additional)}</p></section>
    <div className={styles.documentSignatures}><div>{shown(responsible.name)} · COREN {shown(responsible.coren)}<br />Assinatura e carimbo</div><div>Pessoa atendida ou responsável<br />Assinatura</div></div>
  </article>;
}

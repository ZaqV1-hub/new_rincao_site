import fs from "node:fs";
import { createRequire } from "node:module";

if (process.argv[2] !== "--hml") throw new Error("Use apenas --hml para popular o banco de teste.");

const envPath = "C:/SitesData/Rincao/hml/.env.local";
const values = Object.fromEntries(fs.readFileSync(envPath, "utf8").split(/\r?\n/)
  .filter((line) => /^[A-Za-z_][A-Za-z_0-9]*=/.test(line))
  .map((line) => {
    const split = line.indexOf("=");
    const value = line.slice(split + 1).trim();
    return [line.slice(0, split), value.replace(/^(["'])(.*)\1$/, "$2")];
  }));

if (values.INGRESSO_DB_NAME !== "clrincao_sistema_test") {
  throw new Error("O banco configurado não é o banco de teste esperado.");
}

const require = createRequire(import.meta.url);
const { Client } = require("pg");
const db = new Client({
  host: values.INGRESSO_DB_HOST,
  port: Number(values.INGRESSO_DB_PORT),
  database: values.INGRESSO_DB_NAME,
  user: values.INGRESSO_DB_USER,
  password: values.INGRESSO_DB_PASSWORD,
});
const marker = "SIMULACAO_ENFERMARIA_20261010";
await db.connect();
try {
  const existing = await db.query("SELECT COUNT(*)::int AS count FROM enfermaria_atendimentos WHERE created_by = $1", [marker]);
  if (existing.rows[0].count) {
    console.log(`Registros de simulação já existem: ${existing.rows[0].count}`);
    process.exitCode = 0;
  } else {
    const localResult = await db.query("SELECT id, nome FROM enfermaria_locais WHERE ativo = TRUE ORDER BY id");
    const locais = localResult.rows;
    const demands = ["Ferimento", "Queda", "Mal-estar", "Picada de inseto", "Queimadura", "Outros"];
    const symptoms = ["Dor", "Tontura", "Febre", "Náusea ou vômito"];
    const sources = ["Grupo misto", "Bilheteria presencial", "Excursão", "Cortesia"];
    await db.query("BEGIN");
    let created = 0;
    for (const [year, first, last] of [[2025, 11, 12], [2026, 1, 10]]) {
      for (let month = first; month <= last; month++) {
        for (let n = 0; n < 3; n++) {
          const index = created++;
          const day = year === 2026 && month === 10 ? [1, 5, 9][n] : [5, 15, 25][n];
          const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const occurredAt = `${date}T${String(9 + n * 3).padStart(2, "0")}:20:00-03:00`;
          const local = locais[index % locais.length];
          const urgent = index % 7 === 0;
          const upa = index % 9 === 0;
          const status = index % 4 === 0 ? "aberto" : "encerrado";
          const form = {
            identification: { name: `SIMULAÇÃO ENFERMARIA ${date} ${n + 1}`, sex: n % 2 ? "Masculino" : "Feminino" },
            unregisteredDetails: { intakeSource: sources[index % sources.length], noAccountReason: "Dado fictício para testar filtros." },
            complaint: { text: `Atendimento fictício: ${demands[index % demands.length].toLowerCase()}.`, demandTypes: [demands[index % demands.length]] },
            symptoms: { items: [symptoms[index % symptoms.length]] },
            vitals: { bloodPressure: "120/80", heartRate: String(70 + index % 18), temperature: "36,5" },
            urgent, urgency: { conduct: urgent ? "Avaliação imediata (simulação)." : "" },
            referralToUpa: upa, referral: { reason: upa ? "Simulação de encaminhamento" : "", destination: upa ? "UPA (simulação)" : "" },
            reports: { nurse: "Registro fictício para testes.", additional: "SIMULAÇÃO — não representa atendimento real." },
          };
          const inserted = await db.query(`INSERT INTO enfermaria_atendimentos
            (status, source, local_id, local_name, professional, occurred_at, created_by, closed_by, closed_at, form_json)
            VALUES ($1, 'sem_cadastro', $2, $3, 'Profissional Simulação', $4, $5, $6, $7, $8)
            RETURNING id`, [status, local?.id ?? null, local?.nome ?? null, occurredAt, marker,
              status === "encerrado" ? marker : null, status === "encerrado" ? occurredAt : null, JSON.stringify(form)]);
          await db.query(`INSERT INTO enfermaria_historico (atendimento_id, acao, usuario, detalhes_json)
            VALUES ($1, 'criacao', $2, $3)`, [inserted.rows[0].id, marker, JSON.stringify({ source: "sem_cadastro", simulation: true })]);
        }
      }
    }
    await db.query("COMMIT");
    console.log(`Criados ${created} atendimentos fictícios em ${values.INGRESSO_DB_NAME}.`);
  }
} catch (error) {
  await db.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await db.end();
}

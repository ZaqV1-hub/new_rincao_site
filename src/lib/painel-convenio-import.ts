import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  applyAgreementMembersImport,
  previewAgreementMembersImport,
  type AgreementMemberImportPreviewResult,
} from "@/lib/ops-agreement-members";

export type PainelConvenioImportStage = {
  importId: string;
  agreementId: number;
  csvText: string;
  preview: AgreementMemberImportPreviewResult;
  reason: string | null;
  createdAt: string;
};

export class PainelConvenioImportError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelConvenioImportError";
    this.code = code;
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function assertAgreementId(value: unknown) {
  const agreementId = Number(value);
  if (!Number.isInteger(agreementId) || agreementId <= 0) {
    throw new PainelConvenioImportError(
      "invalid_agreement_id",
      "Informe um convenio valido.",
      400,
    );
  }
  return agreementId;
}

function assertImportId(value: unknown) {
  const importId = normalizeText(value);
  if (!importId) {
    throw new PainelConvenioImportError(
      "invalid_agreement_import_id",
      "Informe uma importacao valida.",
      400,
    );
  }
  return importId;
}

function getImportRootDir() {
  return path.join(process.cwd(), ".tmp", "painel-convenios-import");
}

function getImportFilePath(agreementId: number, importId: string) {
  return path.join(getImportRootDir(), `${agreementId}-${importId}.json`);
}

async function ensureImportRootDir() {
  await mkdir(getImportRootDir(), { recursive: true });
}

function createImportId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function writeStage(stage: PainelConvenioImportStage) {
  await ensureImportRootDir();
  await writeFile(
    getImportFilePath(stage.agreementId, stage.importId),
    JSON.stringify(stage, null, 2),
    "utf8",
  );
}

async function readStage(agreementId: number, importId: string) {
  try {
    const content = await readFile(getImportFilePath(agreementId, importId), "utf8");
    return JSON.parse(content) as PainelConvenioImportStage;
  } catch {
    throw new PainelConvenioImportError(
      "agreement_import_not_found",
      "Importacao nao encontrada.",
      404,
    );
  }
}

export function buildConvenioImportTemplateCsv() {
  return "CPF;QTD. COMPRA POR DIA;DATA INICIO;DATA FIM;STATUS\n";
}

export async function stagePainelConvenioImport(input: {
  agreementId: unknown;
  csvText: string;
  reason?: string | null;
  actor?: { name?: string | null; cpf?: string | null };
}) {
  const agreementId = assertAgreementId(input.agreementId);
  const csvText = normalizeText(input.csvText);

  if (!csvText) {
    throw new PainelConvenioImportError(
      "invalid_agreement_member_import",
      "Selecione um arquivo CSV para importar.",
      400,
    );
  }

  const preview = await previewAgreementMembersImport({
    agreementId,
    csvText,
    reason: input.reason ?? null,
    actor: input.actor ?? null,
  });

  const stage = {
    importId: createImportId(),
    agreementId,
    csvText,
    preview,
    reason: normalizeText(input.reason) || null,
    createdAt: new Date().toISOString(),
  } satisfies PainelConvenioImportStage;

  await writeStage(stage);
  return stage;
}

export async function getPainelConvenioImportState(input: {
  agreementId: unknown;
  importId?: unknown;
}) {
  const agreementId = assertAgreementId(input.agreementId);
  const importId = normalizeText(input.importId);

  if (!importId) {
    return null;
  }

  return readStage(agreementId, importId);
}

export async function applyPainelConvenioImport(input: {
  agreementId: unknown;
  importId: unknown;
  actor?: { name?: string | null; cpf?: string | null };
}) {
  const agreementId = assertAgreementId(input.agreementId);
  const importId = assertImportId(input.importId);
  const stage = await readStage(agreementId, importId);

  const result = await applyAgreementMembersImport({
    agreementId,
    csvText: stage.csvText,
    reason: stage.reason ?? null,
    actor: input.actor ?? null,
  });

  await rm(getImportFilePath(agreementId, importId), { force: true });

  return {
    importId,
    result,
  };
}

export async function cancelPainelConvenioImport(input: {
  agreementId: unknown;
  importId: unknown;
}) {
  const agreementId = assertAgreementId(input.agreementId);
  const importId = assertImportId(input.importId);
  await rm(getImportFilePath(agreementId, importId), { force: true });

  return {
    importId,
    message: "Importacao cancelada com sucesso.",
  };
}

export async function getPainelConvenioImportLog(input: {
  agreementId: unknown;
  importId: unknown;
}) {
  const agreementId = assertAgreementId(input.agreementId);
  const importId = assertImportId(input.importId);
  const stage = await readStage(agreementId, importId);
  return stage.preview.log || "";
}

export function asPainelConvenioImportError(error: unknown) {
  if (error instanceof PainelConvenioImportError) {
    return error;
  }

  const candidate = error as { code?: unknown; message?: unknown; status?: unknown };
  if (
    candidate &&
    typeof candidate === "object" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.status === "number"
  ) {
    return new PainelConvenioImportError(
      candidate.code,
      candidate.message,
      candidate.status,
    );
  }

  return new PainelConvenioImportError(
    "agreement_import_unavailable",
    "Nao foi possivel operar a importacao de conveniados agora.",
    500,
  );
}

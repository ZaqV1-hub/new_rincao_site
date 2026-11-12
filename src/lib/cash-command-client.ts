export type StoredCashCommand<T extends Record<string, unknown> = Record<string, unknown>> = {
  payload: T;
  idempotencyKey: string;
};
export type CashCommandResult<T> = { ok: true; data: T } | { ok: false; message: string; uncertain: boolean };

const pendingMessage = "Há uma operação sem confirmação. Tente conferir novamente antes de alterar os dados.";
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

/** Invalid/inaccessible storage must never silently start a second financial attempt. */
export function readStoredCashCommand<T extends Record<string, unknown> = Record<string, unknown>>(storageKey: string): StoredCashCommand<T> | null {
  const raw = sessionStorage.getItem(storageKey);
  if (raw === null) return null;
  const command = JSON.parse(raw);
  if (!command || typeof command !== "object" || !command.payload || typeof command.payload !== "object" || Array.isArray(command.payload) ||
      typeof command.idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,100}$/.test(command.idempotencyKey) || "idempotencyKey" in command.payload) {
    throw new Error("Operação salva inválida. Peça conferência ao responsável antes de continuar.");
  }
  return command;
}

export function prepareStoredCashCommand<T extends Record<string, unknown>>(storageKey: string, payload: T): StoredCashCommand<T> {
  if ("idempotencyKey" in payload) throw new Error("A chave da operação é criada pelo formulário.");
  const snapshot = JSON.parse(JSON.stringify(payload)) as T;
  const pending = readStoredCashCommand<T>(storageKey);
  if (pending) {
    if (canonical(pending.payload) !== canonical(snapshot)) throw new Error(pendingMessage);
    return pending;
  }
  const command = { payload: snapshot, idempotencyKey: crypto.randomUUID() };
  sessionStorage.setItem(storageKey, JSON.stringify(command));
  return command;
}

export async function submitCashCommand<T>({ storageKey, url, payload }: {
  storageKey: string; url: string; payload?: Record<string, unknown>;
}): Promise<CashCommandResult<T>> {
  try {
    const command = payload === undefined ? readStoredCashCommand(storageKey) : prepareStoredCashCommand(storageKey, payload);
    if (!command) return { ok: false, message: "Não há operação salva para conferir.", uncertain: false };
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...command.payload, idempotencyKey: command.idempotencyKey }) });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok === true && result.data != null) {
      sessionStorage.removeItem(storageKey);
      return { ok: true, data: result.data as T };
    }
    const definitive = response.status >= 400 && response.status < 500 && result?.ok === false && typeof result.error?.message === "string";
    if (definitive) sessionStorage.removeItem(storageKey);
    return { ok: false, uncertain: !definitive, message: definitive ? result.error.message : pendingMessage };
  } catch {
    return { ok: false, message: pendingMessage, uncertain: true };
  }
}

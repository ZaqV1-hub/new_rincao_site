import { pathToFileURL } from "node:url";

export async function runChargebackSyncCommand({ env = process.env, fetchImpl = fetch, log = console.log } = {}) {
  let endpoint;
  const token = env.INGRESSO_OPERATIONS_JOBS_TOKEN?.trim();
  const timeoutMs = Number(env.CIELO_CHARGEBACK_JOB_TIMEOUT_MS ?? 240_000);
  try {
    const base = new URL(env.CIELO_CHARGEBACK_JOB_BASE_URL ?? "");
    const localHttp = base.protocol === "http:" && ["127.0.0.1", "[::1]", "localhost"].includes(base.hostname);
    if (!token || /[\r\n]/.test(token) || (!localHttp && base.protocol !== "https:") || base.username || base.password || base.search || base.hash || base.pathname !== "/" || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 1_800_000) throw new Error("invalid_configuration");
    endpoint = new URL("/api/ops/jobs/chargebacks", base).href;
  } catch {
    log("result=failed reason=invalid_configuration");
    return 1;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, { method: "POST", headers: { "x-ops-jobs-token": token, Accept: "application/json" }, redirect: "error", signal: controller.signal });
    if (!response.ok) {
      await response.body?.cancel();
      log(`result=failed reason=http_${response.status}`);
      return 1;
    }
    let payload;
    try { payload = await response.json(); }
    catch {
      log(`result=failed reason=${controller.signal.aborted ? "timeout" : "invalid_response"}`);
      return 1;
    }
    if (payload?.ok !== true) {
      log("result=failed reason=job_failed");
      return 1;
    }
    if (payload.data === null) {
      log("result=skipped reason=worker_locked");
      return 0;
    }
    const { imported, processed, failed } = payload.data ?? {};
    if (![imported, processed, failed].every((count) => Number.isSafeInteger(count) && count >= 0)) {
      log("result=failed reason=invalid_response");
      return 1;
    }
    log(`result=${failed ? "partial" : "completed"} imported=${imported} processed=${processed} failed=${failed}`);
    return failed ? 1 : 0;
  } catch {
    log(`result=failed reason=${controller.signal.aborted ? "timeout" : "request_failed"}`);
    return 1;
  } finally { clearTimeout(timeout); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runChargebackSyncCommand();
}

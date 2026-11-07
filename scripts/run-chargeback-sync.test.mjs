import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runChargebackSyncCommand } from "./run-chargeback-sync.mjs";

const env = { CIELO_CHARGEBACK_JOB_BASE_URL: "http://127.0.0.1:8061", INGRESSO_OPERATIONS_JOBS_TOKEN: "private-token" };

test("posts once to the authenticated endpoint and reports aggregate counters only", async () => {
  const logs = [];
  let called = 0;
  const exit = await runChargebackSyncCommand({ env, log: (line) => logs.push(line), fetchImpl: async (url, options) => {
    called++;
    assert.equal(url, "http://127.0.0.1:8061/api/ops/jobs/chargebacks");
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers["x-ops-jobs-token"], "private-token");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ ok: true, data: { imported: 4, processed: 2, failed: 0, secret: "must-not-log" } });
  } });
  assert.equal(exit, 0);
  assert.equal(called, 1);
  assert.deepEqual(logs, ["result=completed imported=4 processed=2 failed=0"]);
});

test("concurrent worker skip is successful; a partial failure returns a failing exit code", async () => {
  for (const [data, expected, message] of [[null, 0, "result=skipped reason=worker_locked"], [{ imported: 1, processed: 0, failed: 2 }, 1, "result=partial imported=1 processed=0 failed=2"]]) {
    const logs = [];
    assert.equal(await runChargebackSyncCommand({ env, log: (line) => logs.push(line), fetchImpl: async () => Response.json({ ok: true, data }) }), expected);
    assert.deepEqual(logs, [message]);
  }
});

test("rejects absent credentials, unsafe URLs and invalid timeout without sending anything", async () => {
  for (const changes of [
    { INGRESSO_OPERATIONS_JOBS_TOKEN: "" }, { CIELO_CHARGEBACK_JOB_BASE_URL: "" },
    { CIELO_CHARGEBACK_JOB_BASE_URL: "http://public.example" },
    { CIELO_CHARGEBACK_JOB_BASE_URL: "https://user:secret@example.test" },
    { CIELO_CHARGEBACK_JOB_BASE_URL: "https://example.test?token=secret" },
    { CIELO_CHARGEBACK_JOB_BASE_URL: "https://example.test/wrong-path" },
    { CIELO_CHARGEBACK_JOB_TIMEOUT_MS: "NaN" },
  ]) {
    const logs = [];
    const exit = await runChargebackSyncCommand({ env: { ...env, ...changes }, log: (line) => logs.push(line), fetchImpl: () => assert.fail("Unexpected HTTP request") });
    assert.equal(exit, 1);
    assert.deepEqual(logs, ["result=failed reason=invalid_configuration"]);
  }
});

test("HTTP, invalid JSON, API failures and invalid counters never expose response bodies", async () => {
  for (const response of [
    new Response("sensitive body", { status: 503 }), new Response("secret not JSON"),
    Response.json({ ok: false, error: { code: "private-token" } }),
    Response.json({ ok: true, data: { imported: 1, processed: 2, failed: -1 } }),
    Response.json({ ok: true, data: {} }),
  ]) {
    const logs = [];
    assert.equal(await runChargebackSyncCommand({ env, log: (line) => logs.push(line), fetchImpl: async () => response }), 1);
    assert.equal(logs.length, 1);
    assert.doesNotMatch(logs[0], /sensitive|secret|private-token/);
  }
});

test("aborts a stalled request and keeps the error secret-safe", async () => {
  const logs = [];
  const exit = await runChargebackSyncCommand({ env: { ...env, CIELO_CHARGEBACK_JOB_TIMEOUT_MS: "1000" }, log: (line) => logs.push(line), fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("private-token timeout")))) });
  assert.equal(exit, 1);
  assert.deepEqual(logs, ["result=failed reason=timeout"]);
});

test("actual CLI exits nonzero on partial failure against an isolated local HTTP stub", async () => {
  const received = [];
  const server = createServer((request, response) => {
    received.push({ method: request.method, url: request.url, token: request.headers["x-ops-jobs-token"] });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, data: { imported: 2, processed: 1, failed: 1 } }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const child = spawn(process.execPath, [fileURLToPath(new URL("./run-chargeback-sync.mjs", import.meta.url))], { env: { ...process.env, ...env, CIELO_CHARGEBACK_JOB_BASE_URL: `http://127.0.0.1:${server.address().port}` }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const exit = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
    assert.equal(exit, 1);
    assert.deepEqual(received, [{ method: "POST", url: "/api/ops/jobs/chargebacks", token: "private-token" }]);
    assert.equal(output.trim(), "result=partial imported=2 processed=1 failed=1");
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

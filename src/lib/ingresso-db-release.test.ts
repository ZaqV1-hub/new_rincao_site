import { afterEach, expect, it, vi } from "vitest";
import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";

const { release } = vi.hoisted(() => ({ release: vi.fn() }));
vi.mock("pg", () => ({ Pool: class { connect = async () => ({ query: vi.fn(), release }); } }));
afterEach(() => {
  vi.unstubAllEnvs();
  delete (globalThis as typeof globalThis & { __ingressoSistemaDbPool?: unknown }).__ingressoSistemaDbPool;
});
it("forwards a failed session to pg so it is destroyed rather than pooled with a lock", async () => {
  vi.stubEnv("INGRESSO_SISTEMA_DB_CLIENT", "postgres");
  const client = await getIngressoSistemaDbPool().connect();
  const error = new Error("unknown lock state");
  client.release(error);
  expect(release).toHaveBeenCalledWith(error);
});

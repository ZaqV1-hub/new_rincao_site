import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const { authorize, getDossier, audit, connect, release } = vi.hoisted(() => ({
  authorize: vi.fn(),
  getDossier: vi.fn(),
  audit: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@/lib/painel-api-auth", () => ({ requirePainelApiAccess: authorize }));
vi.mock("@/lib/chargeback-repository", () => ({ getChargebackDossier: getDossier }));
vi.mock("@/lib/ops-audit-log", () => ({ registerOpsAuditLog: audit }));
vi.mock("@/lib/ingresso-db", () => ({
  getIngressoSistemaDbDialect: () => "postgres",
  getIngressoSistemaDbPool: () => ({ connect }),
}));

const request = new Request("https://example.com/api/painel/contestacoes/71/dossie");
const context = { params: Promise.resolve({ caseId: "71" }) };

beforeEach(() => {
  vi.resetAllMocks();
  authorize.mockResolvedValue({ ok: true, session: { actorName: "Operador", actorCpf: null } });
  getDossier.mockResolvedValue({
    filename: "71.pdf",
    sha256: "hash",
    pdf: Buffer.from("%PDF-test"),
  });
  connect.mockResolvedValue({ release });
});

it("delivers the stored PDF as an audited private download", async () => {
  const response = await GET(request, context);

  expect(authorize).toHaveBeenCalledWith(request, "vis_compra");
  expect(getDossier).toHaveBeenCalledWith(71);
  expect(response.headers.get("content-type")).toBe("application/pdf");
  expect(response.headers.get("content-disposition")).toBe('attachment; filename="71.pdf"');
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.text()).toBe("%PDF-test");
  expect(audit).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ usuarioNome: "Operador", detalhes: { caseId: 71, sha256: "hash" } }),
    "postgres",
  );
  expect(release).toHaveBeenCalledOnce();
});

it("rejects unauthenticated downloads before reading the PDF", async () => {
  authorize.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });

  expect((await GET(request, context)).status).toBe(401);
  expect(getDossier).not.toHaveBeenCalled();
});

it("returns 404 if the dossier has yet to be archived", async () => {
  getDossier.mockResolvedValue(null);

  expect((await GET(request, context)).status).toBe(404);
  expect(audit).not.toHaveBeenCalled();
});

it("releases the connection and withholds the PDF if audit fails", async () => {
  audit.mockRejectedValue(new Error("audit connection failed"));
  const response = await GET(request, context);

  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("%PDF-test");
  expect(release).toHaveBeenCalledOnce();
});

it.each(["1e2", "2147483648"])("rejects invalid case ID %s", async (caseId) => {
  const response = await GET(request, { params: Promise.resolve({ caseId }) });

  expect(response.status).toBe(400);
  expect(getDossier).not.toHaveBeenCalled();
});

it("substitutes a safe attachment name when stored metadata cannot be used as a header", async () => {
  getDossier.mockResolvedValue({
    filename: '71.pdf"\r\nX-Untrusted: injected',
    sha256: "hash",
    pdf: Buffer.from("%PDF-test"),
  });
  const response = await GET(request, context);

  expect(response.headers.get("content-disposition")).toBe('attachment; filename="dossie-contestacao-71.pdf"');
  expect(response.headers.has("x-untrusted")).toBe(false);
});

import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const { authorize, listCases } = vi.hoisted(() => ({
  authorize: vi.fn(),
  listCases: vi.fn(),
}));

vi.mock("@/lib/painel-api-auth", () => ({ requirePainelApiAccess: authorize }));
vi.mock("@/lib/chargeback-repository", () => ({ listChargebackCases: listCases }));

const url = "https://example.com/api/painel/contestacoes";

beforeEach(() => {
  vi.resetAllMocks();
  authorize.mockResolvedValue({ ok: true });
});

it("returns the requested page including unlinked cases without caching", async () => {
  listCases.mockResolvedValue({ items: [{ id: 71, purchaseId: null }], total: 21 });
  const request = new Request(url + "?offset=20");
  const response = await GET(request);

  expect(authorize).toHaveBeenCalledWith(request, "vis_compra");
  expect(listCases).toHaveBeenCalledWith({ limit: 20, offset: 20 });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({ items: [{ id: 71, purchaseId: null }], total: 21 });
});

it.each(["-1", "1.2", "9007199254740993", "1e2"])("rejects invalid offset %s", async (offset) => {
  expect((await GET(new Request(url + "?offset=" + offset))).status).toBe(400);
  expect(listCases).not.toHaveBeenCalled();
});

it("returns the authorization failure without reading cases", async () => {
  authorize.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });

  expect((await GET(new Request(url))).status).toBe(403);
  expect(listCases).not.toHaveBeenCalled();
});

it("keeps database errors out of the API response", async () => {
  listCases.mockRejectedValue(new Error("secret database error"));
  const response = await GET(new Request(url));

  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret database error");
});

import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const { authorize, listCases } = vi.hoisted(() => ({
  authorize: vi.fn(),
  listCases: vi.fn(),
}));

vi.mock("@/lib/painel-api-auth", () => ({ requirePainelApiAccess: authorize }));
vi.mock("@/lib/chargeback-repository", () => ({ listChargebackCases: listCases }));

const request = new Request("https://example.com/api/painel/compras/32/contestacoes?offset=20");

beforeEach(() => {
  vi.resetAllMocks();
  authorize.mockResolvedValue({ ok: true });
});

it("limits consultation to cases linked to the purchase", async () => {
  listCases.mockResolvedValue({ items: [{ id: 71 }], total: 21 });
  const response = await GET(request, { params: Promise.resolve({ purchaseId: "32" }) });

  expect(authorize).toHaveBeenCalledWith(request, "vis_compra");
  expect(listCases).toHaveBeenCalledWith({ purchaseId: 32, limit: 20, offset: 20 });
  expect(await response.json()).toMatchObject({ items: [{ id: 71 }], total: 21 });
});

it.each(["2147483648", "9007199254740993"])("rejects out-of-range purchase ID %s", async (purchaseId) => {
  const response = await GET(request, {
    params: Promise.resolve({ purchaseId }),
  });

  expect(response.status).toBe(400);
  expect(listCases).not.toHaveBeenCalled();
});

it("requires authorized panel access before reading the case list", async () => {
  authorize.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
  const response = await GET(request, { params: Promise.resolve({ purchaseId: "32" }) });

  expect(response.status).toBe(401);
  expect(listCases).not.toHaveBeenCalled();
});

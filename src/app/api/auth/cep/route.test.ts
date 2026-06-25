import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureProfileCity = vi.fn();
const ensureProfileUf = vi.fn();

vi.mock("@/lib/user-repository", () => ({
  ensureProfileCity,
  ensureProfileUf,
}));

describe("auth cep route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns address data from cep lookup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          cep: "04844-040",
          logradouro: "Rua Antonio Francisco Rosa",
          complemento: "",
          bairro: "Jardim Edda",
          localidade: "Sao Paulo",
          uf: "SP",
        }),
      }),
    );
    ensureProfileUf.mockResolvedValue({
      id: "SP",
      name: "Sao Paulo",
    });
    ensureProfileCity.mockResolvedValue({
      id: 9668,
      name: "Sao Paulo",
    });

    const { GET } = await import("@/app/api/auth/cep/route");
    const response = await GET(
      new Request("https://example.com/api/auth/cep?cep=04844-040"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(ensureProfileUf).toHaveBeenCalledWith({
      id: "SP",
      name: "SP",
    });
    expect(ensureProfileCity).toHaveBeenCalledWith({
      uf: "SP",
      name: "Sao Paulo",
    });
    expect(body).toEqual({
      ok: true,
      data: {
        cep: "04844040",
        address: "Rua Antonio Francisco Rosa",
        district: "Jardim Edda",
        uf: {
          id: "SP",
          name: "Sao Paulo",
        },
        city: {
          id: 9668,
          name: "Sao Paulo",
        },
        complement: null,
      },
    });
  });

  it("returns 404 when cep is not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          erro: true,
        }),
      }),
    );

    const { GET } = await import("@/app/api/auth/cep/route");
    const response = await GET(
      new Request("https://example.com/api/auth/cep?cep=00000000"),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "cep_not_found",
        message: "CEP nao encontrado.",
      },
    });
  });
});

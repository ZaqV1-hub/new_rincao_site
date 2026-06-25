import { beforeEach, describe, expect, it, vi } from "vitest";

const clearAuthCookie = vi.fn();
const getAuthSession = vi.fn();
const getActivePublicUserByCpf = vi.fn();
const getActivePublicUserProfileByCpf = vi.fn();
const listProfileUfs = vi.fn();
const listProfileCitiesByUf = vi.fn();
const getProfileCityById = vi.fn();
const findPublicUserByEmail = vi.fn();
const updatePublicUserProfile = vi.fn();
const checkPublicUserPassword = vi.fn();
const updatePublicUserPassword = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  clearAuthCookie,
  getAuthSession,
}));

vi.mock("@/lib/user-repository", () => ({
  getActivePublicUserByCpf,
  getActivePublicUserProfileByCpf,
  listProfileUfs,
  listProfileCitiesByUf,
  getProfileCityById,
  findPublicUserByEmail,
  updatePublicUserProfile,
  checkPublicUserPassword,
  updatePublicUserPassword,
}));

describe("me/profile BFF routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthSession.mockResolvedValue({ sub: "52998224725" });
    getActivePublicUserByCpf.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Cliente Teste",
      email: "cliente@example.com",
      status: "ati",
    });
    getActivePublicUserProfileByCpf.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Cliente Teste",
      email: "cliente@example.com",
      status: "ati",
      rg: "1234567890",
      birthDate: "1990-05-20",
      sex: "m",
      phone: "(11) 3333-4444",
      mobile: "(11) 99999-0000",
      address: "Rua das Flores",
      number: "100",
      cep: "01234567",
      district: "Centro",
      uf: "SP",
      cityId: 9668,
      cityName: "Sao Paulo",
      complement: "Apto 12",
    });
    listProfileUfs.mockResolvedValue([
      { id: "SP", name: "Sao Paulo" },
      { id: "RJ", name: "Rio de Janeiro" },
    ]);
    listProfileCitiesByUf.mockResolvedValue([
      { id: 9668, name: "Sao Paulo" },
      { id: 123, name: "Campinas" },
    ]);
  });

  it("returns the authenticated profile with location options", async () => {
    const { GET } = await import("@/app/api/me/profile/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        profile: {
          cpf: "52998224725",
          cpfMasked: "529.***.***-25",
          name: "Cliente Teste",
          email: "cliente@example.com",
          status: "ati",
          rg: "1234567890",
          birthDate: "1990-05-20",
          sex: "m",
          phone: "(11) 3333-4444",
          mobile: "(11) 99999-0000",
          address: "Rua das Flores",
          number: "100",
          cep: "01234567",
          district: "Centro",
          uf: "SP",
          cityId: 9668,
          cityName: "Sao Paulo",
          complement: "Apto 12",
        },
        locations: {
          ufs: [
            { id: "SP", name: "Sao Paulo" },
            { id: "RJ", name: "Rio de Janeiro" },
          ],
          cities: [
            { id: 9668, name: "Sao Paulo" },
            { id: 123, name: "Campinas" },
          ],
        },
      },
    });
  });

  it("updates the authenticated profile", async () => {
    getProfileCityById.mockResolvedValue({
      id: 9668,
      name: "Sao Paulo",
      uf: "SP",
    });
    findPublicUserByEmail.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/me/profile/route");
    const response = await PATCH(
      new Request("https://example.com/api/me/profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Cliente Atualizado",
          email: "novo@example.com",
          rg: "99887766",
          birthDate: "1991-06-21",
          sex: "f",
          phone: "(11) 3333-1111",
          mobile: "(11) 98888-7777",
          address: "Rua Nova",
          number: "120",
          cep: "01001-000",
          district: "Centro",
          uf: "SP",
          cityId: 9668,
          complement: "Casa",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updatePublicUserProfile).toHaveBeenCalledWith("52998224725", {
      name: "Cliente Atualizado",
      email: "novo@example.com",
      rg: "99887766",
      birthDate: "1991-06-21",
      sex: "f",
      phone: "1133331111",
      mobile: "11988887777",
      address: "Rua Nova",
      number: "120",
      cep: "01001000",
      district: "Centro",
      uf: "SP",
      cityId: 9668,
      complement: "Casa",
    });
  });

  it("lists cities for a valid uf", async () => {
    const { GET } = await import("@/app/api/me/profile/cities/route");
    const response = await GET(
      new Request("https://example.com/api/me/profile/cities?uf=SP"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        uf: "SP",
        cities: [
          { id: 9668, name: "Sao Paulo" },
          { id: 123, name: "Campinas" },
        ],
      },
    });
  });

  it("changes the customer password after validating the current password", async () => {
    checkPublicUserPassword.mockResolvedValue(true);

    const { POST } = await import("@/app/api/me/profile/password/route");
    const response = await POST(
      new Request("https://example.com/api/me/profile/password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "senha-atual",
          newPassword: "nova-senha",
          confirmPassword: "nova-senha",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(checkPublicUserPassword).toHaveBeenCalledWith(
      "52998224725",
      "senha-atual",
    );
    expect(updatePublicUserPassword).toHaveBeenCalledWith(
      "52998224725",
      "nova-senha",
    );
    expect(body).toEqual({
      ok: true,
      data: {
        updated: true,
      },
    });
  });
});

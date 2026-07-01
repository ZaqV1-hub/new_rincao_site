import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RegistrationSubmissionInput } from "@/lib/group-registration-form-data";

const { getRegistrationPage, sendGroupRegistrationEmail, storeRegistrationSubmission } =
  vi.hoisted(() => ({
    getRegistrationPage: vi.fn(),
    sendGroupRegistrationEmail: vi.fn(),
    storeRegistrationSubmission: vi.fn(),
  }));

vi.mock("@/lib/group-registration-content", () => ({
  getRegistrationPage,
}));

vi.mock("@/lib/group-registration-storage", () => ({
  storeRegistrationSubmission,
}));

vi.mock("@/lib/group-registration-email", () => ({
  sendGroupRegistrationEmail,
}));

const validPayload: RegistrationSubmissionInput & { website: string } = {
  slug: "grupo-igreja",
  pageTitle: "Grupo Igreja",
  website: "",
  groupName: "Igreja Central",
  coordinatorName: "Maria Silva",
  birthDate: "1980-01-01",
  phone: "1133334444",
  mobile: "11999998888",
  email: "maria@example.com",
  sex: "Feminino",
  howHeard: "Google",
  address: "Rua A",
  number: "123",
  cep: "04870-020",
  district: "Jardim Casa Grande",
  complement: "Sala 1",
  city: "Sao Paulo",
  state: "SP",
  interestDate: "2026-08-10",
  message: "Gostaria de receber orcamento.",
};

function createRequest(payload: Record<string, unknown>) {
  return new Request("http://localhost/api/group-registrations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "vitest",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/group-registrations", () => {
  beforeEach(() => {
    vi.resetModules();
    getRegistrationPage.mockReset();
    sendGroupRegistrationEmail.mockReset();
    storeRegistrationSubmission.mockReset();

    getRegistrationPage.mockReturnValue({ slug: "grupo-igreja" });
    storeRegistrationSubmission.mockResolvedValue({
      protocol: "GRP-20260701120000-ABCD1234",
      createdAt: "2026-07-01T12:00:00.000Z",
      storage: "file",
    });
  });

  it("stores the submission, emails the Clube and returns success without WhatsApp", async () => {
    const { POST } = await import("./route");

    const response = await POST(createRequest(validPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      protocol: "GRP-20260701120000-ABCD1234",
      createdAt: "2026-07-01T12:00:00.000Z",
      storage: "file",
    });
    expect(body).not.toHaveProperty("whatsappUrl");
    expect(storeRegistrationSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "grupo-igreja",
        email: "maria@example.com",
      }),
      {
        ip: "203.0.113.10",
        userAgent: "vitest",
      },
    );
    expect(sendGroupRegistrationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "grupo-igreja",
        email: "maria@example.com",
      }),
      {
        protocol: "GRP-20260701120000-ABCD1234",
        createdAt: "2026-07-01T12:00:00.000Z",
        storage: "file",
      },
    );
  });

  it("rejects invalid registration pages", async () => {
    getRegistrationPage.mockImplementation(() => {
      throw new Error("invalid page");
    });
    const { POST } = await import("./route");

    const response = await POST(createRequest(validPayload));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      error: "Pagina de cadastro invalida.",
    });
    expect(storeRegistrationSubmission).not.toHaveBeenCalled();
    expect(sendGroupRegistrationEmail).not.toHaveBeenCalled();
  });
});

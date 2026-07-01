import { describe, expect, it, vi } from "vitest";
import type { RegistrationSubmissionInput } from "@/lib/group-registration-form-data";

const { queueLegacyEmail } = vi.hoisted(() => ({
  queueLegacyEmail: vi.fn(),
}));

vi.mock("@/lib/legacy-email", () => ({
  queueLegacyEmail,
}));

const baseInput: RegistrationSubmissionInput = {
  slug: "grupo-igreja",
  pageTitle: "Grupo Igreja",
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

describe("sendGroupRegistrationEmail", () => {
  it("queues a Clube email with protocol, origin and submitted fields", async () => {
    const { sendGroupRegistrationEmail } = await import(
      "@/lib/group-registration-email"
    );

    await sendGroupRegistrationEmail(baseInput, {
      protocol: "GRP-20260701120000-ABCD1234",
      createdAt: "2026-07-01T12:00:00.000Z",
      storage: "file",
    });

    expect(queueLegacyEmail).toHaveBeenCalledTimes(1);
    expect(queueLegacyEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.any(String),
        subject: expect.stringContaining("Grupo Igreja"),
        html: expect.stringContaining("GRP-20260701120000-ABCD1234"),
      }),
    );
    expect(queueLegacyEmail.mock.calls[0]?.[0].html).toContain("Igreja Central");
    expect(queueLegacyEmail.mock.calls[0]?.[0].html).toContain(
      "maria@example.com",
    );
  });
});

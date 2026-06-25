import { beforeEach, describe, expect, it, vi } from "vitest";

const clearAuthCookie = vi.fn();
const getAuthSession = vi.fn();
const getActivePublicUserByCpf = vi.fn();
const getUserVoucherRescheduleData = vi.fn();
const rescheduleUserVoucher = vi.fn();
const getRescheduleAgendaOptions = vi.fn();
const getRescheduleAgendaOptionById = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  clearAuthCookie,
  getAuthSession,
}));

vi.mock("@/lib/user-repository", () => ({
  getActivePublicUserByCpf,
}));

vi.mock("@/lib/voucher-repository", () => ({
  getUserVoucherRescheduleData,
  rescheduleUserVoucher,
}));

vi.mock("@/lib/agenda-repository", () => ({
  getRescheduleAgendaOptions,
  getRescheduleAgendaOptionById,
}));

describe("me/vouchers reschedule BFF route", () => {
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
  });

  it("returns available standard future dates for an eligible voucher", async () => {
    getUserVoucherRescheduleData.mockResolvedValue({
      purchaseId: 101,
      agendaId: 10,
      voucher: {
        id: 11,
        type: "norma",
        typeLabel: "a partir de 10 anos",
        number: "ABC-11",
        visitDate: "2026-07-25",
        useDate: null,
        unitValue: "120.00",
        used: false,
        useStatus: "n",
        agendaType: "padra",
        schoolName: null,
        participantName: null,
        sent: false,
        validUntil: "2026-07-25",
        canSelectForVoucher: true,
        canReschedule: true,
        expiredForGeneration: false,
      },
    });
    getRescheduleAgendaOptions.mockResolvedValue([
      {
        id: 10,
        legacyEncodedId: "MTA=",
        date: "2026-07-25",
        day: 25,
        month: 7,
        year: 2026,
      },
      {
        id: 22,
        legacyEncodedId: "MjI=",
        date: "2026-07-26",
        day: 26,
        month: 7,
        year: 2026,
      },
    ]);

    const { GET } = await import(
      "@/app/api/me/vouchers/[voucherId]/reschedule/route"
    );
    const response = await GET(
      new Request("https://example.com/api/me/vouchers/11/reschedule"),
      { params: Promise.resolve({ voucherId: "11" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        voucherId: 11,
        currentVisitDate: "2026-07-25",
        options: [
          {
            id: 22,
            date: "2026-07-26",
            day: 26,
            month: 7,
            year: 2026,
          },
        ],
      },
    });
  });

  it("reschedules an eligible voucher to a new agenda date", async () => {
    getUserVoucherRescheduleData.mockResolvedValue({
      purchaseId: 101,
      agendaId: 10,
      voucher: {
        id: 11,
        type: "norma",
        typeLabel: "a partir de 10 anos",
        number: "ABC-11",
        visitDate: "2026-07-25",
        useDate: null,
        unitValue: "120.00",
        used: false,
        useStatus: "n",
        agendaType: "padra",
        schoolName: null,
        participantName: null,
        sent: false,
        validUntil: "2026-07-25",
        canSelectForVoucher: true,
        canReschedule: true,
        expiredForGeneration: false,
      },
    });
    getRescheduleAgendaOptionById.mockResolvedValue({
      id: 22,
      legacyEncodedId: "MjI=",
      date: "2026-07-26",
      day: 26,
      month: 7,
      year: 2026,
    });
    rescheduleUserVoucher.mockResolvedValue(11);

    const { POST } = await import(
      "@/app/api/me/vouchers/[voucherId]/reschedule/route"
    );
    const response = await POST(
      new Request("https://example.com/api/me/vouchers/11/reschedule", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ agendaId: 22 }),
      }),
      { params: Promise.resolve({ voucherId: "11" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rescheduleUserVoucher).toHaveBeenCalledWith("52998224725", 11, 22);
    expect(body).toEqual({
      ok: true,
      data: {
        voucherId: 11,
        agendaId: 22,
        visitDate: "2026-07-26",
        day: 26,
        month: 7,
        year: 2026,
      },
    });
  });
});

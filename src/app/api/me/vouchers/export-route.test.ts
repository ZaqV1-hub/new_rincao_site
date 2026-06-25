import { beforeEach, describe, expect, it, vi } from "vitest";

const clearAuthCookie = vi.fn();
const getAuthSession = vi.fn();
const getActivePublicUserByCpf = vi.fn();
const getUserVoucherExportData = vi.fn();
const generateVoucherQrcodes = vi.fn();
const downloadImageAsDataUrl = vi.fn();
const renderVoucherPdfBuffer = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  clearAuthCookie,
  getAuthSession,
}));

vi.mock("@/lib/user-repository", () => ({
  getActivePublicUserByCpf,
}));

vi.mock("@/lib/voucher-repository", () => ({
  getUserVoucherExportData,
}));

vi.mock("@/lib/ticket-api", () => ({
  generateVoucherQrcodes,
  downloadImageAsDataUrl,
  TicketApiError: class TicketApiError extends Error {
    code: string;
    status: number;

    constructor(code: string, message: string, status = 502) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

vi.mock("@/lib/voucher-pdf", () => ({
  renderVoucherPdfBuffer,
}));

describe("me/vouchers export BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports a native pdf for selected vouchers", async () => {
    getAuthSession.mockResolvedValue({ sub: "52998224725" });
    getActivePublicUserByCpf.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Cliente Teste",
      email: "cliente@example.com",
      status: "ati",
    });
    getUserVoucherExportData.mockResolvedValue({
      purchase: {
        id: 101,
        legacyEncodedId: "MTAx",
        type: "ponli",
        typeLabel: "Compra",
        purchaseDate: "2026-07-20",
        totalValue: "120.00",
        status: "conc",
        statusLabel: "Pago",
        payment: {
          provider: "pagseguro",
          status: 3,
          statusLabel: "Paga",
          methodType: 1,
        },
        unusedVoucherCount: 2,
        voucherCount: 2,
        canGenerateVoucher: true,
        canCancelReservation: false,
        vouchers: [],
      },
      vouchers: [
        {
          id: 11,
          number: "ABC-11",
          type: "norma",
          typeLabel: "a partir de 10 anos",
          visitDate: "2026-07-25",
          unitValue: "120.00",
          agendaType: "padra",
          schoolName: null,
          participantName: null,
          schoolClassDisplay: null,
          description: "Dia especial",
        },
        {
          id: 12,
          number: "ABC-12",
          type: "infan",
          typeLabel: "de 4 a 9 anos",
          visitDate: "2026-07-25",
          unitValue: "60.00",
          agendaType: "padra",
          schoolName: null,
          participantName: null,
          schoolClassDisplay: null,
          description: "Dia especial",
        },
      ],
      information: "Chegar com antecedencia.",
      isSchool: false,
    });
    generateVoucherQrcodes.mockResolvedValue({
      11: "https://cdn.example.com/11.png",
      12: "https://cdn.example.com/12.png",
    });
    downloadImageAsDataUrl
      .mockResolvedValueOnce("data:image/png;base64,qr11")
      .mockResolvedValueOnce("data:image/png;base64,qr12");
    renderVoucherPdfBuffer.mockResolvedValue(Buffer.from("pdf-binary"));

    const { GET } = await import(
      "@/app/api/me/vouchers/[voucherId]/export/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/me/vouchers/101/export?voucherId=11&voucherId=12",
      ),
      { params: Promise.resolve({ voucherId: "101" }) },
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(getUserVoucherExportData).toHaveBeenCalledWith("52998224725", 101, [
      11, 12,
    ]);
    expect(generateVoucherQrcodes).toHaveBeenCalledWith([
      {
        purchaseId: 101,
        voucherId: 11,
        cpf: "52998224725",
        type: "norma",
        purchaseLocation: "Online",
        purchaseDate: "2026-07-20",
        price: 120,
        tpcompra: "ponli",
      },
      {
        purchaseId: 101,
        voucherId: 12,
        cpf: "52998224725",
        type: "infan",
        purchaseLocation: "Online",
        purchaseDate: "2026-07-20",
        price: 60,
        tpcompra: "ponli",
      },
    ]);
    expect(renderVoucherPdfBuffer).toHaveBeenCalledWith({
      purchase: expect.objectContaining({
        id: 101,
        type: "ponli",
      }),
      customer: {
        name: "Cliente Teste",
        cpfMasked: "529.***.***-25",
      },
      vouchers: [
        expect.objectContaining({
          id: 11,
          qrCodeDataUrl: "data:image/png;base64,qr11",
        }),
        expect.objectContaining({
          id: 12,
          qrCodeDataUrl: "data:image/png;base64,qr12",
        }),
      ],
      information: "Chegar com antecedencia.",
      isSchool: false,
    });
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(body).toBe("pdf-binary");
  });

  it("rejects export when no eligible voucher remains selected", async () => {
    getAuthSession.mockResolvedValue({ sub: "52998224725" });
    getActivePublicUserByCpf.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Cliente Teste",
      email: "cliente@example.com",
      status: "ati",
    });
    getUserVoucherExportData.mockResolvedValue({
      purchase: {
        id: 101,
        legacyEncodedId: "MTAx",
        type: "ponli",
        typeLabel: "Compra",
        purchaseDate: "2026-07-20",
        totalValue: "120.00",
        status: "conc",
        statusLabel: "Pago",
        payment: {
          provider: "pagseguro",
          status: 3,
          statusLabel: "Paga",
          methodType: 1,
        },
        unusedVoucherCount: 0,
        voucherCount: 1,
        canGenerateVoucher: true,
        canCancelReservation: false,
        vouchers: [],
      },
      vouchers: [],
      information: null,
      isSchool: false,
    });

    const { GET } = await import(
      "@/app/api/me/vouchers/[voucherId]/export/route"
    );
    const response = await GET(
      new Request("https://example.com/api/me/vouchers/101/export?voucherId=11"),
      { params: Promise.resolve({ voucherId: "101" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "voucher_selection_empty",
        message: "Nenhum voucher elegivel foi selecionado para exportacao.",
      },
    });
  });
});

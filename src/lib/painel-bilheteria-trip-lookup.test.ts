import { beforeEach, expect, it, vi } from "vitest";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => ({ query }), getIngressoDbPool: () => { throw new Error("Legacy database must not be used"); } }));
import { lookupPainelBilheteriaTrip } from "@/lib/painel-bilheteria-workstation";
beforeEach(() => query.mockReset());
it("resolves the current trip code with school, date and paid vouchers", async () => {
  query.mockResolvedValue({ rows: [{ codescoladata: "9F4006", idescola: 469, idagenda: 2351, nmescola: "ESCOLA ADOLFO VASCONSELOS ARAUJO", dtagenda: "2028-06-28", status: "abe", idvoucher: 563876, stusado: "n", tpvoucher: "escol" }] });
  const result = await lookupPainelBilheteriaTrip(" 9f4006 ");
  expect(result).toMatchObject({ lookup: "9F4006", schoolId: 469, agendaId: 2351, schoolName: "ESCOLA ADOLFO VASCONSELOS ARAUJO", visitDate: "2028-06-28", items: [{ voucherId: 563876 }] });
  expect(query.mock.calls[0][0]).toContain("JOIN agenda_extras");
  expect(query.mock.calls[0][1]).toEqual(["9F4006"]);
});
it("keeps the trip information when there are no paid vouchers", async () => {
  query.mockResolvedValue({ rows: [{ idescola: 469, idagenda: 2351, nmescola: "Escola", dtagenda: "2028-06-28", status: "abe", idvoucher: null }] });
  expect(await lookupPainelBilheteriaTrip("9F4006")).toMatchObject({ schoolId: 469, schoolName: "Escola", visitDate: "2028-06-28", items: [] });
});

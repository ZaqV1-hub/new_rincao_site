import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import sharp from "sharp";
import type { DayProgram, DayProgramGroup } from "@/lib/day-program";
import { buildDayProgramExportDocuments, renderDayProgramBundle } from "@/lib/day-program-export";

function group(clientId: number, carrierId: number | null, extra: Partial<DayProgramGroup> = {}): DayProgramGroup {
  return { agendaId: 20, clientId, clientName: `Escola ${clientId}`, address: `Rua ${clientId}`, representative: "Representante", contact: `Contato ${clientId}`, phone: `Telefone ${clientId}`, plannedPeople: 30,
    carrierContact: carrierId === 8 ? "Contato A" : "Contato B", carrierPhone: carrierId === 8 ? "1111" : "9999",
    transportMode: carrierId === null ? "unset" : "carrier", carrierId, boardingTime: "07:30", observations: null, foodNotes: null, buses: 1, vans: 0, extraBuses: 0, extraVans: 0, vehicles: [],
    origins: { address: "client", representative: "contract", contact: "operational", phone: "operational", observations: null }, ...extra };
}
function fixture(): DayProgram {
  return { park: "rincao", date: "2026-11-13", version: 7, exportedRevision: null, exportedAt: null, status: "created", sourceFingerprint: "a".repeat(64), exportedFingerprint: null, exportId: null, dayUseSold: 13,
    readOnly: false, closed: false, observations: "Observação interna", groups: [group(1, 8), group(2, 8), group(3, 9), group(4, null, { transportMode: "client", plannedPeople: null, buses: null, vans: null }), group(5, null)],
    carriers: [{ id: 8, name: "Mesmo nome", contact: "Contato A", phone: "1111" }, { id: 9, name: "Mesmo nome", contact: "Contato B", phone: "9999" }],
    hiringItems: [{ id: 1, name: "Portaria", value: "Ana" }, { id: 2, name: "Enfermaria", value: null }, { id: 3, name: "Cantor", value: "  " }],
    weather: { status: "unavailable", summary: "Previsão indisponível", reason: "Previsão ainda não consultada", stale: false, source: null, sourceUrl: null, license: null, licenseUrl: null, queriedAt: null, forecastAt: null, modelUpdatedAt: null, nextRefreshAt: null, temperatureC: null, condition: null, coordinates: null } };
}

describe("day program export", () => {
  it('shows the extra vehicle and its own transport in the general program', () => {
    const input = fixture();
    input.groups[0].extraBuses = 1;
    input.groups[0].vehicles = [{ id: 92,type: 'bus',plannedPeople: null,state: 'waiting',version: 1,addedOnDay: true,isExtra: true,ordinal: 2,transportName: 'Viagens do Extra' }];
    const [program,carrier] = buildDayProgramExportDocuments(input);
    expect(program.blocks.map(block => block.text)).toContain('Ônibus 2 extra: Viagens do Extra');
    expect(carrier.blocks.map(block => block.text)).not.toContain('Ônibus 2 extra: Viagens do Extra');
  });
  it("groups stops by ID and shares only each carrier's operational stops", () => {
    const documents = buildDayProgramExportDocuments(fixture());
    expect(documents.map((document) => document.filename)).toEqual(["programacao", "transportador-8", "transportador-9"]);
    const a = JSON.stringify(documents[1]);
    expect(a).toContain("Escola 1"); expect(a).toContain("Escola 2");
    for (const privateText of ["Escola 3", "Escola 4", "Escola 5", "Telefone 3", "9999", "Observação interna", "Portaria"]) expect(a).not.toContain(privateText);
    const program = JSON.stringify(documents[0]);
    expect(program).toContain("a preencher"); expect(program).toContain("120"); expect(program).toContain("13");
    expect(program).toContain("133"); expect(program).toContain("1 grupo(s) a preencher");
    expect(program).toContain("Portaria: Ana"); expect(program).not.toContain("Enfermaria"); expect(program).not.toContain("Cantor");
    expect(program).toContain("Contato A"); expect(program).toContain("1111");
    expect(program).toContain("Previsão indisponível"); expect(program).toContain("Sem ficha");
    expect(documents.every((document) => document.subtitle.includes("13/11/2026") && document.subtitle.includes("7"))).toBe(true);
  });

  it("exports the recorded weather with attribution, local times and stale warning", () => {
    const input = fixture();
    input.weather = { ...input.weather, status: "available", summary: "Às 12:00: 25 °C; céu limpo.", stale: true,
      reason: "A última atualização falhou; previsão anterior preservada.", source: "MET Norway", sourceUrl: "https://www.met.no/en",
      license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", queriedAt: "2026-11-12T15:30:00Z", forecastAt: "2026-11-13T15:00:00Z" };
    const blocks = buildDayProgramExportDocuments(input)[0].blocks.map((block) => block.text).join("\n");
    for (const text of ["25 °C", "MET Norway", "https://www.met.no/en", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/", "12/11/2026, 12:30", "13/11/2026, 12:00", "Previsão desatualizada", "previsão anterior preservada"]) expect(blocks).toContain(text);
    expect(blocks).not.toContain("Previsão indisponível");
  });

  it("does not mutate input and rejects uncreated or unsafe identities", () => {
    const input = fixture(); const before = JSON.stringify(input);
    buildDayProgramExportDocuments(input); expect(JSON.stringify(input)).toBe(before);
    expect(() => buildDayProgramExportDocuments({ ...input, version: null })).toThrow(/criada/);
    expect(() => buildDayProgramExportDocuments({ ...input, carriers: [{ ...input.carriers[0], id: NaN }] })).toThrow(/identificador/);
  });

  it("renders actual PDF/PNG archive and safely handles markup and long text", async () => {
    const input = fixture();
    input.groups[0].clientName = '<span foreground="red">Escola & Filhos</span>';
    input.groups[0].observations = "Observação comprida, sem perda de conteúdo. ".repeat(45) + "\n\nSegunda linha após parágrafo vazio.";
    input.groups[1].address = "W".repeat(300);
    const zip = await JSZip.loadAsync(await renderDayProgramBundle(input));
    const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
    expect(names.filter((name) => name.endsWith(".pdf"))).toEqual(["programacao.pdf", "transportador-8.pdf", "transportador-9.pdf"]);
    for (const name of names) {
      expect(name).toMatch(/^(programacao|transportador-\d+)(\.pdf|-\d{3}\.png)$/);
      const bytes = await zip.file(name)!.async("nodebuffer");
      if (name.endsWith(".pdf")) expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      else { const metadata = await sharp(bytes).metadata(); expect(metadata.format).toBe("png"); expect(metadata.width).toBe(1190); expect(metadata.height).toBe(1684); }
    }
    expect(names.filter((name) => /^programacao-.*\.png$/.test(name)).length).toBeGreaterThan(1);
    const pixels = await sharp(await zip.file("programacao-001.png")!.async("nodebuffer")).removeAlpha().raw().toBuffer();
    let injectedRedPixels = 0;
    for (let i = 0; i < pixels.length; i += 3) if (pixels[i] > 180 && pixels[i + 1] < 100 && pixels[i + 2] < 100) injectedRedPixels++;
    expect(injectedRedPixels).toBe(0);
  }, 30000);

  it("fails honestly instead of allocating an unbounded export", async () => {
    const input = fixture(); input.observations = "x".repeat(250001);
    await expect(renderDayProgramBundle(input)).rejects.toThrow(/limite/);
  });
});

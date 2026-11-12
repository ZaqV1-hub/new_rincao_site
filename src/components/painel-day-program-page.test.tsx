import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DayProgram } from "@/lib/day-program";
import { createProgramEditorState, PainelDayProgramPage, programEditorReducer, programPendingPayload, refreshProgramWeather } from "./painel-day-program-page";

function fixture(): DayProgram {
  return { park: "rincao", date: "2099-01-02", version: 1, exportedRevision: null, exportedAt: null, status: "created", sourceFingerprint: "source-one", exportedFingerprint: null, exportId: null,
    dayUseSold: 7, readOnly: false, closed: false, observations: null,
    groups: [{ agendaId: 10, clientId: 20, clientName: "Escola de teste", representative: null, address: "Rua do cadastro", contact: "Contato do contrato", phone: null,
      plannedPeople: null, buses: null, vans: null, transportMode: "unset", carrierId: null, carrierContact: null, carrierPhone: null, boardingTime: null, observations: null, vehicles: [],
      origins: { address: "client", contact: "contract", phone: null, representative: null, observations: null } }],
    carriers: [{ id: 1, name: "Transportadora cadastrada", contact: "Contato", phone: "111" }], hiringItems: [{ id: 1, name: "Portaria", value: "Pessoa registrada" }, { id: 2, name: "Enfermaria", value: null }],
    weather: { status: "unavailable", summary: "Previsão indisponível", reason: "Previsão ainda não consultada.", stale: false, source: null, sourceUrl: null, license: null, licenseUrl: null, queriedAt: null, forecastAt: null, modelUpdatedAt: null, nextRefreshAt: null, temperatureC: null, condition: null, coordinates: null } };
}
const navigation = { previousDate: "2098-12-26", nextDate: "2099-01-09", dates: [{ date: "2098-12-26", status: "uncreated" as const }, { date: "2099-01-02", status: "created" as const }, { date: "2099-01-09", status: "exported" as const }] };
const render = (program = fixture(), canManage = true) => renderToStaticMarkup(<PainelDayProgramPage program={program} navigation={navigation} canManage={canManage} returnDate="2098-12-20" />);

describe("program editor acknowledgement", () => {
  it("retains edits made to the same field while saving and advances the acknowledged version", () => {
    let state = createProgramEditorState(fixture());
    state = programEditorReducer(state, { type: "edit", key: "observations", patch: { observations: "First draft" } });
    const submittedSequence = state.sequence;
    state = programEditorReducer(state, { type: "phase", phase: "saving" });
    state = programEditorReducer(state, { type: "edit", key: "observations", patch: { observations: "Newer draft" } });
    const acknowledged = { ...fixture(), version: 2, observations: "First draft" };
    state = programEditorReducer(state, { type: "accepted", program: acknowledged, sequence: submittedSequence });
    expect(state.program.version).toBe(2);
    expect(programPendingPayload(state)).toEqual({ observations: "Newer draft" });
    expect(state.phase).toBe("idle");
    state = programEditorReducer(state, { type: "accepted", program: { ...acknowledged, version: 3, observations: "Newer draft" }, sequence: state.sequence });
    expect(state.pending).toEqual({});
    expect(state.program.observations).toBe("Newer draft");
  });
  it("clears only acknowledged fields and preserves unrelated in-flight changes and nulls", () => {
    let state = createProgramEditorState(fixture());
    state = programEditorReducer(state, { type: "edit", key: "hiring:1", patch: { hiringItems: [{ id: 1, value: null }] } });
    const sequence = state.sequence;
    state = programEditorReducer(state, { type: "edit", key: "observations", patch: { observations: null } });
    state = programEditorReducer(state, { type: "accepted", program: { ...fixture(), version: 2 }, sequence });
    expect(programPendingPayload(state)).toEqual({ observations: null });
  });
  it("keeps the complete visible draft on conflict or ambiguous network failure until explicit reload", () => {
    let state = createProgramEditorState(fixture());
    state = programEditorReducer(state, { type: "edit", key: "hiring:1", patch: { hiringItems: [{ id: 1, value: "Rascunho local" }] } });
    const pending = state.pending;
    state = programEditorReducer(state, { type: "failed", message: "A programação mudou." });
    expect(state).toMatchObject({ phase: "blocked", pending, error: "A programação mudou." });
    state = programEditorReducer(state, { type: "edit", key: "observations", patch: { observations: "Ainda aqui" } });
    expect(state.phase).toBe("blocked");
    expect(programPendingPayload(state)).toEqual({ hiringItems: [{ id: 1, value: "Rascunho local" }], observations: "Ainda aqui" });
    state = programEditorReducer(state, { type: "loaded", program: { ...fixture(), version: 9 } });
    expect(state).toMatchObject({ pending: {}, phase: "idle", program: { version: 9 } });
  });
  it("serializes group edits with missing vehicles as null instead of scheduling zero vehicles", () => {
    const group = { agendaId: 10, clientId: 20, plannedPeople: null, contact: "Novo contato", phone: null, transportMode: "unset" as const, carrierId: null, carrierContact: null, carrierPhone: null, boardingTime: null, observations: null, buses: null, vans: null };
    const state = programEditorReducer(createProgramEditorState(fixture()), { type: "edit", key: "group:10:20", patch: { groups: [group] } });
    expect(programPendingPayload(state)).toEqual({ groups: [group] });
    expect(fixture().groups[0].contact).toBe("Contato do contrato");
  });
});

describe("day program UI", () => {
  it("distinguishes real day use counts from unknown group forecasts and unavailable weather", () => {
    const html = render();
    expect(html).toContain("Ônibus: A preencher · Vans: A preencher");
    expect(html).toContain("7 pessoas conhecidas · público a preencher");
    expect(html).toContain("0 veículos conhecidos · veículos a preencher");
    expect(html).toContain("Cadastro do cliente");
    expect(html).toContain("Contrato do passeio");
    expect(html).toContain("Previsão indisponível");
    expect(html).not.toContain("°");
    expect(html).toContain("1 de 2 preenchidos");
    expect(html).toContain("Gerar arquivos para envio");
  });
  it("only offers creation until the explicit first save exists", () => {
    const html = render({ ...fixture(), version: null, status: "uncreated" });
    expect(html).toContain("Criar dia seguinte");
    expect(html).not.toContain("Editar grupo");
    expect(html).not.toContain("Gerar arquivos para envio");
    expect(html).toContain("Crie a programação para começar a preencher");
    expect(html).toContain('disabled="" maxLength="500"');
  });
  it("uses movement dates and preserves the summary date across all links", () => {
    const html = render();
    expect(html).toContain('href="/painel/agenda/2098-12-20"');
    expect(html).toContain('href="/painel/agenda/2098-12-26/dia-seguinte?returnTo=2098-12-20"');
    expect(html).toContain('href="/painel/agenda/2099-01-09/dia-seguinte?returnTo=2098-12-20"');
    expect(html).toContain('aria-current="date"');
    expect(html).not.toContain("2099-01-03");
  });
  it("keeps past dates read-only and offers the manager an explicit reasoned override", () => {
    const program = { ...fixture(), status: "past_created" as const, readOnly: true };
    const html = render(program);
    expect(html).toContain("Editar mesmo assim");
    expect(html).not.toContain("Editar grupo");
    expect(html).not.toContain("Gerar arquivos para envio");
    expect(render(program, false)).not.toContain("Editar mesmo assim");
    expect(render({ ...program, closed: true })).not.toContain("Editar mesmo assim");
  });
  it("does not expose editing or exporting to viewers, or fire requests during server rendering", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    try { const html = render(fixture(), false); expect(html).not.toContain("Editar grupo"); expect(html).not.toContain("Gerar arquivos para envio"); expect(html).not.toContain("Adicionar outro item"); expect(fetch).not.toHaveBeenCalled(); }
    finally { vi.unstubAllGlobals(); }
  });
});


describe("program weather", () => {
  it("shows the available forecast, stale warning, source license and Sao Paulo timestamps", () => {
    const program = fixture();
    program.weather = { ...program.weather, status: "available", summary: "Às 12:00: 23 °C; nublado.", stale: true, reason: "A última atualização falhou; previsão anterior preservada.",
      source: "MET Norway", sourceUrl: "https://www.met.no/en", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      queriedAt: "2099-01-01T15:30:00Z", forecastAt: "2099-01-02T15:00:00Z" };
    const html = render(program);
    expect(html).toContain("23 °C; nublado"); expect(html).toContain("Previsão desatualizada");
    expect(html).toContain("previsão anterior preservada"); expect(html).toContain('href="https://www.met.no/en"');
    expect(html).toContain('href="https://creativecommons.org/licenses/by/4.0/"'); expect(html).toContain("CC BY 4.0");
    expect(html).toContain("01/01/2099, 12:30"); expect(html).toContain("02/01/2099, 12:00");
  });
  it("offers explicit refresh only for an open editable Rincao date", () => {
    const refreshButton = (html: string) => html.match(/<button[^>]*>Atualizar previsão<\/button>/)?.[0];
    expect(refreshButton(render())).not.toContain('disabled=""');
    for (const program of [{ ...fixture(), closed: true }, { ...fixture(), readOnly: true }, { ...fixture(), status: "past_created" as const }, { ...fixture(), park: "estancia" as const }]) {
      expect(refreshButton(render(program))).toContain('disabled=""');
    }
    expect(refreshButton(render(fixture(), false))).toContain('disabled=""');
  });
  it("refreshes explicitly then reloads the full program fingerprint without losing newer edits", async () => {
    const refreshed = { ...fixture(), sourceFingerprint: "weather-updated" };
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ ok: true, data: refreshed.weather })).mockResolvedValueOnce(Response.json({ ok: true, data: refreshed }));
    vi.stubGlobal("fetch", fetch);
    try {
      let state = createProgramEditorState(fixture());
      const sequence = state.sequence;
      state = programEditorReducer(state, { type: "phase", phase: "refreshing" });
      state = programEditorReducer(state, { type: "edit", key: "observations", patch: { observations: "Rascunho preservado" } });
      state = programEditorReducer(state, { type: "accepted", program: await refreshProgramWeather("2099-01-02"), sequence });
      expect(state.program.sourceFingerprint).toBe("weather-updated"); expect(programPendingPayload(state)).toEqual({ observations: "Rascunho preservado" });
      expect(fetch.mock.calls).toEqual([["/api/painel/dias/2099-01-02/previsao", { method: "POST" }], ["/api/painel/dias/2099-01-02/programacao", { cache: "no-store" }]]);
    } finally { vi.unstubAllGlobals(); }
  });
  it("does not claim a refresh succeeded when the program reload fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ ok: true })).mockRejectedValueOnce(new Error("Sem conexão")));
    try { await expect(refreshProgramWeather("2099-01-02")).rejects.toThrow("Sem conexão"); }
    finally { vi.unstubAllGlobals(); }
  });
});

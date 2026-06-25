import { describe, expect, it } from "vitest";
import { encodeLegacyId, parseAgendaId } from "@/lib/agenda-id";

describe("agenda id helpers", () => {
  it("parses plain numeric ids", () => {
    expect(parseAgendaId("2283")).toBe(2283);
  });

  it("parses base64 legacy ids", () => {
    expect(parseAgendaId(encodeLegacyId(2283))).toBe(2283);
  });

  it("parses percent-encoded base64 ids from app router params", () => {
    expect(parseAgendaId(encodeURIComponent(encodeLegacyId(2283)))).toBe(2283);
  });
});

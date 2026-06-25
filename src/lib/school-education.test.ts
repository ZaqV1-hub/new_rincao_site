import { describe, expect, it } from "vitest";
import {
  buildSchoolClassDisplay,
  getSchoolEducationStructure,
  normalizeSchoolClassLetter,
  normalizeSchoolEducationType,
  normalizeSchoolEducationYear,
} from "@/lib/school-education";

describe("school education helpers", () => {
  it("keeps the legacy structure without infantil entries", () => {
    const structure = getSchoolEducationStructure();

    expect(structure.types.map((type) => type.id)).toEqual([
      "fund1",
      "fund2",
      "medio",
    ]);
    expect(structure.classes).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]);
  });

  it("normalizes type, year and class values from free text", () => {
    expect(normalizeSchoolEducationType("Ensino Fundamental II")).toBe("fund2");
    expect(normalizeSchoolEducationYear("Ensino Fundamental II", "8o ano")).toBe("8");
    expect(normalizeSchoolClassLetter("turma b")).toBe("B");
  });

  it("builds the same display string persisted by the legacy flow", () => {
    expect(buildSchoolClassDisplay("fund1", "4", "C")).toBe(
      "Ensino Fundamental I - 4o ano - C",
    );
  });
});

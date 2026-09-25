import { describe, expect, it } from "vitest";
import {
  buildSchoolClassDisplay,
  getSchoolEducationStructure,
  inferSchoolTypeFromName,
  isSchoolClassLetterAllowed,
  isSchoolEducationSelectionAllowed,
  normalizeSchoolClassLetter,
  normalizeSchoolEducationType,
  normalizeSchoolEducationYear,
} from "@/lib/school-education";

describe("school education helpers", () => {
  it("centraliza a estrutura completa em ordem de progressão", () => {
    const structure = getSchoolEducationStructure();

    expect(structure.types.map((type) => type.id)).toEqual([
      "infantil",
      "fund1",
      "fund2",
      "medio",
    ]);
    expect(structure.classes).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]);
  });

  it("filtra agrupamentos e séries pelo tipo da escola", () => {
    const cei = getSchoolEducationStructure("cei");
    const emef = getSchoolEducationStructure("emef");
    const legacy = getSchoolEducationStructure(null);

    expect(cei.types).toEqual([
      expect.objectContaining({
        id: "infantil",
        years: expect.arrayContaining([
          expect.objectContaining({ id: "bercario1" }),
          expect.objectContaining({ id: "minigrupo2" }),
        ]),
      }),
    ]);
    expect(emef.types.map((type) => type.id)).toEqual(["fund1", "fund2"]);
    expect(legacy.types.map((type) => type.id)).toEqual([
      "infantil",
      "fund1",
      "fund2",
      "medio",
    ]);
    expect(isSchoolEducationSelectionAllowed("cei", "infantil", "bercario1")).toBe(true);
    expect(isSchoolEducationSelectionAllowed("cei", "fund1", "1")).toBe(false);
  });

  it("oferece turmas até V somente para Milton Santos (ID 571)", () => {
    const miltonSantos = getSchoolEducationStructure("emei", 571);
    const anotherSchool = getSchoolEducationStructure("emei", 572);

    expect(miltonSantos.classes).toHaveLength(22);
    expect(miltonSantos.classes.at(-1)).toBe("V");
    expect(anotherSchool.classes).toHaveLength(11);
    expect(anotherSchool.classes.at(-1)).toBe("K");
    expect(isSchoolClassLetterAllowed(571, "V")).toBe(true);
    expect(isSchoolClassLetterAllowed(572, "V")).toBe(false);
  });

  it("sugere o tipo a partir da sigla sem tornar a sugestão obrigatória", () => {
    expect(inferSchoolTypeFromName("EMEF CEU Butantã")).toBe("emef");
    expect(inferSchoolTypeFromName("CEMEI Jardim Azul")).toBe("cemei");
    expect(inferSchoolTypeFromName("Escola Estadual Vila Rica")).toBeNull();
    expect(inferSchoolTypeFromName("E.E. Vila Rica")).toBe("ee");
  });

  it("normalizes type, year and class values from free text", () => {
    expect(normalizeSchoolEducationType("Ensino Fundamental II")).toBe("fund2");
    expect(normalizeSchoolEducationYear("Ensino Fundamental II", "8o ano")).toBe("8");
    expect(normalizeSchoolClassLetter("turma b")).toBe("B");
    expect(normalizeSchoolClassLetter("turma v")).toBe("V");
  });

  it("builds the same display string persisted by the legacy flow", () => {
    expect(buildSchoolClassDisplay("fund1", "4", "C")).toBe(
      "Ensino Fundamental I - 4o ano - C",
    );
  });
});

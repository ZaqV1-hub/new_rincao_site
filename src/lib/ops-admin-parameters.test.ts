import { describe, expect, it } from "vitest";
import { getOpsAdminParameterDefinitions } from "@/lib/ops-admin-parameters";

describe("ops-admin-parameters", () => {
  it("exposes Zend parameter definitions used by ParametroController", () => {
    const definitions = getOpsAdminParameterDefinitions();

    expect(definitions.map((definition) => definition.id).sort()).toEqual([
      "codine",
      "codval",
      "codven",
    ]);
    expect(definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group: "msgper",
          id: "codval",
          input: "textarea",
          required: true,
        }),
      ]),
    );
  });
});

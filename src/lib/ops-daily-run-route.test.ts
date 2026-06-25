import { describe, expect, it } from "vitest";
import {
  readDailyRunActor,
  readDailyRunBoolean,
  readDailyRunPaymentSync,
} from "@/lib/ops-daily-run-route";

describe("ops-daily-run-route helpers", () => {
  it("normalizes shared route payload fields", () => {
    expect(readDailyRunBoolean("Sim", false)).toBe(true);
    expect(readDailyRunBoolean(undefined, true)).toBe(true);
    expect(
      readDailyRunPaymentSync({
        recentDays: 7,
        cancelAfterDays: "5",
        limit: 50,
      }),
    ).toEqual({
      recentDays: 7,
      cancelAfterDays: undefined,
      limit: 50,
    });
    expect(
      readDailyRunActor({
        name: "  scheduler  ",
        cpf: 123,
      }),
    ).toEqual({
      name: "scheduler",
      cpf: null,
    });
  });
});

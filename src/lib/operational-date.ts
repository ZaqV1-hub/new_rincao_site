export type OperationalValidity = "day" | "7_days" | "30_days" | "6_months";

function daysInMonth(year: number, month: number) {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isCivilDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function getSaoPauloToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function voucherValidityRange(visitDate: string, validity: OperationalValidity) {
  if (!isCivilDate(visitDate)) throw new Error("Data civil inválida.");
  let [year, month, day] = visitDate.split("-").map(Number);
  if (validity === "6_months") {
    month += 6;
    if (month > 12) { month -= 12; year++; }
    day = Math.min(day, daysInMonth(year, month));
  } else {
    if (!["day", "7_days", "30_days"].includes(validity)) throw new Error("Validade inválida.");
    day += validity === "7_days" ? 6 : validity === "30_days" ? 29 : 0;
    while (day > daysInMonth(year, month)) {
      day -= daysInMonth(year, month);
      month++;
      if (month > 12) { month = 1; year++; }
    }
  }
  if (year > 9999) throw new Error("Validade fora do intervalo de datas.");
  return {
    validFrom: visitDate,
    validUntil: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

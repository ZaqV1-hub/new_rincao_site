type DiscountKind = "fixo" | "percentual";

export type CodindicaRow = {
  codindica: string;
  stcodindica: string | null;
  validade: string | null;
  nmrepresentante: string | null;
  tpdesconto: string | null;
  flpromocional: string | null;
  vldescnormal: string | null;
  vldescinfant: string | null;
  vldescpromonormal: string | null;
  vldescpromoinfant: string | null;
  vlvendanormal: string | null;
  vlvendainfant: string | null;
  vlcashback: string | null;
  vlcashbacknormal: string | null;
  vlcashbackinfant: string | null;
};

export type CodindicaParametroRow = {
  idparametro: string;
  vlparametro: string | null;
};

type TicketTotals = {
  quantity: number;
  unitPrice: number;
  paidUnitPrice: number;
  discountUnitPrice: number;
  totalGross: number;
  totalDiscount: number;
  totalPaid: number;
};

export type CodindicaCalculation = {
  code: string;
  reportedDiscountTotal: number;
  totalDiscount: number;
  totalGross: number;
  totalPaid: number;
  fixedPriceMode: boolean;
  normal: TicketTotals;
  child: TicketTotals;
};

export type CodindicaCartCalculation = {
  code: string;
  discountAmount: number;
  totalGross: number;
  totalPaid: number;
};

export class CodindicaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodindicaValidationError";
  }
}

type CodindicaCalculationInput = {
  code: string;
  record: CodindicaRow | null;
  parameters: CodindicaParametroRow[];
  agendaType: string | null;
  normalUnitPrice: number;
  childUnitPrice: number;
  normalQuantity: number;
  childQuantity: number;
};

function normalizeMoney(value: number) {
  return Number(value.toFixed(2));
}

function readMoney(value: string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeFlag(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase() === "s" ? "s" : "n";
}

function normalizeDiscountKind(value: string | null | undefined): DiscountKind {
  return String(value ?? "").trim().toLowerCase() === "percentual"
    ? "percentual"
    : "fixo";
}

function isPromotionalAgenda(agendaType: string | null) {
  return String(agendaType ?? "").trim().toLowerCase() === "promo";
}

function usesNewRule(record: CodindicaRow) {
  return (
    readMoney(record.vlvendanormal) > 0 ||
    readMoney(record.vlvendainfant) > 0 ||
    readMoney(record.vlcashbacknormal ?? record.vlcashback) > 0 ||
    readMoney(record.vlcashbackinfant ?? record.vlcashback) > 0 ||
    normalizeFlag(record.flpromocional) === "s"
  );
}

function canUseOnPromotionalAgenda(record: CodindicaRow) {
  return usesNewRule(record) && normalizeFlag(record.flpromocional) === "s";
}

function resolveParameterMessage(
  parameters: CodindicaParametroRow[],
  parameterId: string,
  replacements: Record<string, string>,
  fallback: string,
) {
  const template = parameters.find(
    (parameter) => parameter.idparametro === parameterId,
  )?.vlparametro;

  if (!template) {
    return fallback;
  }

  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replaceAll(key, value),
    template.replace(/<[^>]+>/g, ""),
  );
}

function isExpired(validityDate: string) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const expiration = new Date(`${validityDate}T12:00:00`);

  return today.getTime() > expiration.getTime();
}

function assertRecordIsUsable(
  input: Pick<CodindicaCalculationInput, "code" | "record" | "parameters">,
) {
  if (!input.record) {
    const notFoundMessage = resolveParameterMessage(
      input.parameters,
      "codine",
      {
        "##rep##": "",
        "##cod##": input.code,
      },
      `Codigo inexistente. ${input.code}`,
    );
    throw new CodindicaValidationError(
      `${notFoundMessage}${notFoundMessage.endsWith(input.code) ? "" : input.code}`,
    );
  }

  if (input.record.stcodindica === "ina") {
    throw new CodindicaValidationError("Codigo inexistente.");
  }

  if (input.record.validade && isExpired(input.record.validade)) {
    throw new CodindicaValidationError(
      resolveParameterMessage(
        input.parameters,
        "codven",
        {
          "##rep##": input.record.nmrepresentante ?? "",
          "##cod##": input.record.codindica,
        },
        "Codigo expirado.",
      ),
    );
  }
}

function calculateDiscountedTicketTotals(
  unitPrice: number,
  quantity: number,
  configuredValue: number,
  discountKind: DiscountKind,
): TicketTotals {
  const normalizedQuantity = Math.max(quantity, 0);

  if (normalizedQuantity === 0) {
    return {
      quantity: 0,
      unitPrice: 0,
      paidUnitPrice: 0,
      discountUnitPrice: 0,
      totalGross: 0,
      totalDiscount: 0,
      totalPaid: 0,
    };
  }

  const discountUnitPrice =
    discountKind === "percentual"
      ? normalizeMoney(unitPrice * (configuredValue / 100))
      : normalizeMoney(configuredValue);
  const boundedDiscountUnitPrice = Math.min(discountUnitPrice, unitPrice);
  const paidUnitPrice = normalizeMoney(unitPrice - boundedDiscountUnitPrice);

  return {
    quantity: normalizedQuantity,
    unitPrice: normalizeMoney(unitPrice),
    paidUnitPrice,
    discountUnitPrice: boundedDiscountUnitPrice,
    totalGross: normalizeMoney(unitPrice * normalizedQuantity),
    totalDiscount: normalizeMoney(boundedDiscountUnitPrice * normalizedQuantity),
    totalPaid: normalizeMoney(paidUnitPrice * normalizedQuantity),
  };
}

function calculateFixedPriceTicketTotals(
  unitPrice: number,
  quantity: number,
  configuredFinalPrice: number,
): TicketTotals {
  const normalizedQuantity = Math.max(quantity, 0);

  if (normalizedQuantity === 0) {
    return {
      quantity: 0,
      unitPrice: 0,
      paidUnitPrice: 0,
      discountUnitPrice: 0,
      totalGross: 0,
      totalDiscount: 0,
      totalPaid: 0,
    };
  }

  const paidUnitPrice =
    configuredFinalPrice > 0
      ? normalizeMoney(configuredFinalPrice)
      : normalizeMoney(unitPrice);
  const discountUnitPrice =
    paidUnitPrice < unitPrice ? normalizeMoney(unitPrice - paidUnitPrice) : 0;

  return {
    quantity: normalizedQuantity,
    unitPrice: normalizeMoney(unitPrice),
    paidUnitPrice,
    discountUnitPrice,
    totalGross: normalizeMoney(unitPrice * normalizedQuantity),
    totalDiscount: normalizeMoney(discountUnitPrice * normalizedQuantity),
    totalPaid: normalizeMoney(paidUnitPrice * normalizedQuantity),
  };
}

export function normalizeCodindica(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function calculateCodindicaTotals(
  input: CodindicaCalculationInput,
): CodindicaCalculation {
  const totalGross = normalizeMoney(
    input.normalUnitPrice * input.normalQuantity +
      input.childUnitPrice * input.childQuantity,
  );

  if (totalGross <= 0) {
    throw new CodindicaValidationError(
      "Selecione pelo menos um ingresso pago para continuar.",
    );
  }

  assertRecordIsUsable(input);
  const record = input.record as CodindicaRow;

  if (isPromotionalAgenda(input.agendaType) && !canUseOnPromotionalAgenda(record)) {
    throw new CodindicaValidationError(
      "Codigo de indicacao/cupom nao pode ser aplicado em data promocional.",
    );
  }

  if (usesNewRule(record)) {
    if (isPromotionalAgenda(input.agendaType)) {
      const normal = calculateDiscountedTicketTotals(
        input.normalUnitPrice,
        input.normalQuantity,
        readMoney(record.vldescpromonormal),
        "fixo",
      );
      const child = calculateDiscountedTicketTotals(
        input.childUnitPrice,
        input.childQuantity,
        readMoney(record.vldescpromoinfant),
        "fixo",
      );

      return {
        code: input.code,
        reportedDiscountTotal: normalizeMoney(
          normal.totalDiscount + child.totalDiscount,
        ),
        totalDiscount: normalizeMoney(normal.totalDiscount + child.totalDiscount),
        totalGross,
        totalPaid: normalizeMoney(normal.totalPaid + child.totalPaid),
        fixedPriceMode: false,
        normal,
        child,
      };
    }

    const normal = calculateFixedPriceTicketTotals(
      input.normalUnitPrice,
      input.normalQuantity,
      readMoney(record.vlvendanormal),
    );
    const child = calculateFixedPriceTicketTotals(
      input.childUnitPrice,
      input.childQuantity,
      readMoney(record.vlvendainfant),
    );

    return {
      code: input.code,
      reportedDiscountTotal: 0,
      totalDiscount: normalizeMoney(normal.totalDiscount + child.totalDiscount),
      totalGross,
      totalPaid: normalizeMoney(normal.totalPaid + child.totalPaid),
      fixedPriceMode: true,
      normal,
      child,
    };
  }

  const discountKind = normalizeDiscountKind(record.tpdesconto);
  const normal = calculateDiscountedTicketTotals(
    input.normalUnitPrice,
    input.normalQuantity,
    readMoney(record.vldescnormal),
    discountKind,
  );
  const child = calculateDiscountedTicketTotals(
    input.childUnitPrice,
    input.childQuantity,
    readMoney(record.vldescinfant),
    discountKind,
  );

  return {
    code: input.code,
    reportedDiscountTotal: normalizeMoney(
      normal.totalDiscount + child.totalDiscount,
    ),
    totalDiscount: normalizeMoney(normal.totalDiscount + child.totalDiscount),
    totalGross,
    totalPaid: normalizeMoney(normal.totalPaid + child.totalPaid),
    fixedPriceMode: false,
    normal,
    child,
  };
}

export function calculateCodindicaCartTotals(input: {
  code: string;
  record: CodindicaRow | null;
  parameters: CodindicaParametroRow[];
  totalValue: number;
}) {
  const totalGross = normalizeMoney(input.totalValue);

  if (totalGross <= 0) {
    throw new CodindicaValidationError(
      "Selecione pelo menos um ingresso pago para continuar.",
    );
  }

  assertRecordIsUsable(input);
  const record = input.record as CodindicaRow;

  const configuredDiscount = readMoney(record.vldescnormal ?? record.vlvendanormal);
  const discountAmount = Math.min(normalizeMoney(configuredDiscount), totalGross);

  return {
    code: input.code,
    discountAmount,
    totalGross,
    totalPaid: normalizeMoney(totalGross - discountAmount),
  } satisfies CodindicaCartCalculation;
}

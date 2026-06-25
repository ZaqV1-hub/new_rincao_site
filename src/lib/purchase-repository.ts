import {
  getPublicAgendaReservationById,
  isAgendaDateExpired,
} from "@/lib/agenda-repository";
import { encodeLegacyId } from "@/lib/agenda-id";
import { buildB2cCartSummary } from "@/lib/b2c-catalog";
import {
  calculateCodindicaCartTotals,
  calculateCodindicaTotals,
  CodindicaValidationError,
  type CodindicaParametroRow,
  type CodindicaRow,
  normalizeCodindica,
} from "@/lib/codindica";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import { getAgendaProductAvailability } from "@/lib/painel-agenda-product-availability";
import type {
  CreatePurchaseQuantities,
  CreatePurchaseSelection,
  CreatePurchaseRequest,
  PurchaseAgendaDetail,
  PurchasePricing,
} from "@/lib/purchase-contracts";
import { generateUniqueVoucherNumber } from "@/lib/voucher-number";

type ConvenioRow = {
  idconvenio: number;
  nmconvenio: string;
  stconvenio: string;
  stconveniado: string;
  qtcompradia: number | null;
  vlnormal: string | null;
  vlinfant: string | null;
};

type SocioRow = {
  stsocio: string;
  qtcompradia: number | null;
  vlnormal: string | null;
  vlinfant: string | null;
};

type DiscountPurchaseCountRow = {
  total: string;
};

type PurchaseInsertRow = {
  idcompra: number;
};

type CodindicaQueryRow = CodindicaRow;

export class PurchaseCreationError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PurchaseCreationError";
    this.code = code;
    this.status = status;
  }
}

function parseMoney(value: string | null) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeMoney(value: number) {
  return value.toFixed(2);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function labelForPricingMode(mode: PurchasePricing["mode"], name?: string) {
  if (mode === "socio") {
    return "Associado";
  }

  if (mode === "conve") {
    return name ? `Convenio ${name}` : "Convenio";
  }

  return "Tarifa do dia";
}

async function resolveDiscountedPricing(cpf: string, visitDate: string, pricing: {
  standardNormal: number;
  standardChild: number;
}) {
  const pool = getIngressoDbPool();
  const convenios = await pool.query<ConvenioRow>(
    `
      SELECT
        conveniado.idconvenio,
        convenio.nmconvenio,
        convenio.stconvenio,
        conveniado.stconveniado,
        conveniado.qtcompradia,
        tabpreco.vlnormal::text AS vlnormal,
        tabpreco.vlinfant::text AS vlinfant
      FROM conveniado
      JOIN convenio ON convenio.idconvenio = conveniado.idconvenio
      JOIN tabpreco ON tabpreco.idtabpreco = convenio.idtabpreco
      WHERE conveniado.cpf = $1
    `,
    [cpf],
  );

  let resolved: {
    mode: PurchasePricing["mode"];
    label: string;
    discountedNormal: number;
    discountedChild: number;
    discountedLimit: number;
  } = {
    mode: "dia",
    label: "Tarifa do dia",
    discountedNormal: pricing.standardNormal,
    discountedChild: pricing.standardChild,
    discountedLimit: 0,
  };

  for (const convenio of convenios.rows) {
    const convenioNormal = parseMoney(convenio.vlnormal);
    const convenioChild = parseMoney(convenio.vlinfant);

    if (
      convenio.stconvenio === "ati" &&
      convenio.stconveniado === "ati" &&
      convenioNormal !== null &&
      convenioChild !== null &&
      convenioNormal < resolved.discountedNormal &&
      convenioChild < resolved.discountedChild
    ) {
      resolved = {
        mode: "conve",
        label: labelForPricingMode("conve", convenio.nmconvenio),
        discountedNormal: convenioNormal,
        discountedChild: convenioChild,
        discountedLimit: Number(convenio.qtcompradia ?? 0),
      };
    }
  }

  const socio = await pool.query<SocioRow>(
    `
      SELECT
        socio.stsocio,
        socio.qtcompradia,
        tabpreco.vlnormal::text AS vlnormal,
        tabpreco.vlinfant::text AS vlinfant
      FROM socio
      JOIN sociocateg ON sociocateg.idsociocateg = socio.idsociocateg
      JOIN tabpreco ON tabpreco.idtabpreco = sociocateg.idtabpreco
      WHERE socio.cpf = $1
      LIMIT 1
    `,
    [cpf],
  );
  const socioRow = socio.rows[0];
  const socioNormal = parseMoney(socioRow?.vlnormal ?? null);
  const socioChild = parseMoney(socioRow?.vlinfant ?? null);

  if (
    socioRow?.stsocio === "ati" &&
    socioNormal !== null &&
    socioChild !== null &&
    socioNormal < resolved.discountedNormal &&
    socioChild < resolved.discountedChild
  ) {
    resolved = {
      mode: "socio",
      label: labelForPricingMode("socio"),
      discountedNormal: socioNormal,
      discountedChild: socioChild,
      discountedLimit: Number(socioRow.qtcompradia ?? 0),
    };
  }

  if (resolved.mode === "dia") {
    return {
      ...resolved,
      discountedRemaining: 0,
    };
  }

  const alreadyBought = await pool.query<DiscountPurchaseCountRow>(
    `
      SELECT COUNT(*)::text AS total
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE compra.cpf = $1
        AND compra.tpcompra = 'ponli'
        AND compra.stcompra = 'conc'
        AND agenda.dtagenda = $2::date
        AND voucher.tpvoucher <> 'isent'
        AND voucher.fldesconto = 's'
    `,
    [cpf, visitDate],
  );
  const discountedRemaining = Math.max(
    resolved.discountedLimit - Number(alreadyBought.rows[0]?.total ?? 0),
    0,
  );

  return {
    ...resolved,
    discountedRemaining,
  };
}

export async function getPurchaseAgendaContext(
  cpf: string,
  agendaId: number,
): Promise<PurchaseAgendaDetail | null> {
  const agenda = await getPublicAgendaReservationById(agendaId);

  if (!agenda) {
    return null;
  }

  const standardNormal = parseMoney(agenda.priceTable.normal);
  const standardChild = parseMoney(agenda.priceTable.child);

  if (standardNormal === null || standardChild === null) {
    return null;
  }

  const discounted = await resolveDiscountedPricing(cpf, agenda.date, {
    standardNormal,
    standardChild,
  });

  return {
    ...agenda,
    pricing: {
      mode: discounted.mode,
      label: discounted.label,
      discountedNormal: normalizeMoney(discounted.discountedNormal),
      discountedChild: normalizeMoney(discounted.discountedChild),
      standardNormal: normalizeMoney(standardNormal),
      standardChild: normalizeMoney(standardChild),
      discountedRemaining: discounted.discountedRemaining,
    },
  };
}

function validateQuantities(
  pricing: PurchasePricing,
  quantities: CreatePurchaseQuantities,
) {
  const discountedTotal =
    quantities.discountedNormal + quantities.discountedChild;
  const paidTotal =
    discountedTotal + quantities.normal + quantities.child;

  if (paidTotal <= 0) {
    throw new PurchaseCreationError(
      "invalid_purchase",
      "Selecione pelo menos um ingresso pago para continuar.",
      400,
    );
  }

  if (discountedTotal > pricing.discountedRemaining) {
    throw new PurchaseCreationError(
      "discount_limit_exceeded",
      "A quantidade de ingressos com desconto excede o limite disponivel.",
      409,
    );
  }

  if (pricing.mode === "dia" && discountedTotal > 0) {
    throw new PurchaseCreationError(
      "discount_unavailable",
      "Esta compra nao possui tarifa com desconto disponivel.",
      409,
    );
  }
}

function isB2cLineItemSelection(
  selection: CreatePurchaseSelection,
): selection is { lineItems: NonNullable<CreatePurchaseRequest["lineItems"]> } {
  return "lineItems" in selection;
}

function resolveVoucherValidityDate(agenda: PurchaseAgendaDetail, now = new Date()) {
  if (agenda.type === "promo") {
    return agenda.date;
  }

  return addMonths(now, 6).toISOString().slice(0, 10);
}

export async function createOnlinePurchase(
  cpf: string,
  agendaId: number,
  selection: CreatePurchaseSelection,
  codindicaInput?: string,
) {
  const agenda = await getPurchaseAgendaContext(cpf, agendaId);

  if (!agenda) {
    throw new PurchaseCreationError(
      "agenda_not_found",
      "Data de visita indisponivel para compra online.",
      404,
    );
  }

  if (isAgendaDateExpired(agenda.date)) {
    throw new PurchaseCreationError(
      "agenda_expired",
      "Esta data nao esta mais disponivel.",
      409,
    );
  }

  if (isB2cLineItemSelection(selection)) {
    const cart = await buildB2cCartSummary(selection.lineItems);
    const availability = await getAgendaProductAvailability(agenda.date);
    const pool = getIngressoDbPool();
    const codindica = normalizeCodindica(codindicaInput);
    let cartCodindicaTotals: ReturnType<typeof calculateCodindicaCartTotals> | null = null;

    for (const line of cart.lines) {
      const allowedIds =
        line.type === "passport"
          ? availability.passportIds
          : availability.addonIds;

      if (!allowedIds.includes(line.productId)) {
        throw new PurchaseCreationError(
          "product_unavailable_for_date",
          "Um ou mais itens selecionados nao estao disponiveis para esta data.",
          409,
        );
      }
    }

    if (codindica) {
      const [codindicaResult, parametroResult] = await Promise.all([
        pool.query<CodindicaQueryRow>(
          `
            SELECT
              codindica,
              stcodindica,
              validade::text AS validade,
              nmrepresentante,
              tpdesconto,
              flpromocional,
              vldescnormal::text AS vldescnormal,
              vldescinfant::text AS vldescinfant,
              vldescpromonormal::text AS vldescpromonormal,
              vldescpromoinfant::text AS vldescpromoinfant,
              vlvendanormal::text AS vlvendanormal,
              vlvendainfant::text AS vlvendainfant,
              vlcashback::text AS vlcashback,
              vlcashbacknormal::text AS vlcashbacknormal,
              vlcashbackinfant::text AS vlcashbackinfant
            FROM codindica
            WHERE codindica = $1
            LIMIT 1
          `,
          [codindica],
        ),
        pool.query<CodindicaParametroRow>(
          `
            SELECT idparametro, vlparametro
            FROM parametro
            WHERE idparametro IN ('codine', 'codven', 'codval')
          `,
        ),
      ]);

      try {
        cartCodindicaTotals = calculateCodindicaCartTotals({
          code: codindica,
          record: codindicaResult.rows[0] ?? null,
          parameters: parametroResult.rows,
          totalValue: Number(cart.totalValue),
        });
      } catch (error) {
        if (error instanceof CodindicaValidationError) {
          throw new PurchaseCreationError("invalid_codindica", error.message, 409);
        }

        throw error;
      }
    }

    const validityDate = resolveVoucherValidityDate(agenda);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const purchaseResult = await client.query<PurchaseInsertRow>(
        `
          INSERT INTO compra (
            cpf,
            tpcompra,
            dtcompra,
            hrcompra,
            formapag,
            vltotcompra,
            vltotdesc,
            codindica,
            stcompra,
            flenvio
          )
          VALUES (
            $1,
            'ponli',
            CURRENT_DATE,
            CURRENT_TIME,
            'pgseg',
            $2,
            $3,
            $4,
            'pend',
            'nao'
          )
          RETURNING idcompra
        `,
        [
          cpf,
          cartCodindicaTotals
            ? normalizeMoney(cartCodindicaTotals.totalPaid)
            : cart.totalValue,
          cartCodindicaTotals
            ? normalizeMoney(cartCodindicaTotals.discountAmount)
            : null,
          cartCodindicaTotals?.code ?? null,
        ],
      );
      const purchaseId = purchaseResult.rows[0]?.idcompra;

      if (!purchaseId) {
        throw new Error("purchase_insert_failed");
      }

      for (const line of cart.lines) {
        for (let index = 0; index < line.quantity; index += 1) {
          const voucherNumber = await generateUniqueVoucherNumber(
            client,
            line.voucherPrefix,
          );

          await client.query(
            `
              INSERT INTO voucher (
                idcompra,
                numvoucher,
                idagenda,
                tpvoucher,
                vlunicompra,
                vldesc,
                codindica,
                stusado,
                fldesconto,
                dtvalidade,
                descricao
              )
              VALUES ($1, $2, $3, $4, $5, NULL, NULL, 'n', 'n', $6, $7)
            `,
            [
              purchaseId,
              voucherNumber,
              agendaId,
              line.voucherType,
              line.unitPrice,
              validityDate,
              line.description,
            ],
          );
        }
      }

      await client.query("COMMIT");

      return {
        purchaseId,
        legacyEncodedId: encodeLegacyId(purchaseId),
        totalValue: cart.totalValue,
        voucherCount: cart.voucherCount,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  const quantities = selection;

  validateQuantities(agenda.pricing, quantities);

  const discountedNormal = Number(agenda.pricing.discountedNormal);
  const discountedChild = Number(agenda.pricing.discountedChild);
  const standardNormal = Number(agenda.pricing.standardNormal);
  const standardChild = Number(agenda.pricing.standardChild);
  const baseTotalValue = normalizeMoney(
    quantities.discountedNormal * discountedNormal +
      quantities.discountedChild * discountedChild +
      quantities.normal * standardNormal +
      quantities.child * standardChild,
  );
  const voucherCount =
    quantities.discountedNormal +
    quantities.discountedChild +
    quantities.normal +
    quantities.child +
    quantities.exempt;
  const validityDate = resolveVoucherValidityDate(agenda);
  const pool = getIngressoDbPool();
  const codindica = normalizeCodindica(codindicaInput);
  let codindicaTotals: ReturnType<typeof calculateCodindicaTotals> | null = null;

  if (codindica) {
    if (agenda.pricing.mode !== "dia") {
      throw new PurchaseCreationError(
        "codindica_unavailable",
        "Codigo de indicacao nao pode ser combinado com tarifa especial nesta conta.",
        409,
      );
    }

    const [codindicaResult, parametroResult] = await Promise.all([
      pool.query<CodindicaQueryRow>(
        `
          SELECT
            codindica,
            stcodindica,
            validade::text AS validade,
            nmrepresentante,
            tpdesconto,
            flpromocional,
            vldescnormal::text AS vldescnormal,
            vldescinfant::text AS vldescinfant,
            vldescpromonormal::text AS vldescpromonormal,
            vldescpromoinfant::text AS vldescpromoinfant,
            vlvendanormal::text AS vlvendanormal,
            vlvendainfant::text AS vlvendainfant,
            vlcashback::text AS vlcashback,
            vlcashbacknormal::text AS vlcashbacknormal,
            vlcashbackinfant::text AS vlcashbackinfant
          FROM codindica
          WHERE codindica = $1
          LIMIT 1
        `,
        [codindica],
      ),
      pool.query<CodindicaParametroRow>(
        `
          SELECT idparametro, vlparametro
          FROM parametro
          WHERE idparametro IN ('codine', 'codven', 'codval')
        `,
      ),
    ]);

    try {
      codindicaTotals = calculateCodindicaTotals({
        code: codindica,
        record: codindicaResult.rows[0] ?? null,
        parameters: parametroResult.rows,
        agendaType: agenda.type,
        normalUnitPrice: standardNormal,
        childUnitPrice: standardChild,
        normalQuantity: quantities.normal,
        childQuantity: quantities.child,
      });
    } catch (error) {
      if (error instanceof CodindicaValidationError) {
        throw new PurchaseCreationError("invalid_codindica", error.message, 409);
      }

      throw error;
    }
  }

  const totalValue = codindicaTotals
    ? normalizeMoney(codindicaTotals.totalPaid)
    : baseTotalValue;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const purchaseResult = await client.query<PurchaseInsertRow>(
      `
        INSERT INTO compra (
          cpf,
          tpcompra,
          dtcompra,
          hrcompra,
          formapag,
          vltotcompra,
          vltotdesc,
          codindica,
          stcompra,
          flenvio
        )
        VALUES (
          $1,
          'ponli',
          CURRENT_DATE,
          CURRENT_TIME,
          'pgseg',
          $2,
          $3,
          $4,
          'pend',
          'nao'
        )
        RETURNING idcompra
      `,
      [
        cpf,
        totalValue,
        codindicaTotals ? normalizeMoney(codindicaTotals.reportedDiscountTotal) : null,
        codindicaTotals?.code ?? null,
      ],
    );
    const purchaseId = purchaseResult.rows[0]?.idcompra;

    if (!purchaseId) {
      throw new Error("purchase_insert_failed");
    }

    for (let index = 0; index < quantities.discountedNormal; index += 1) {
      const voucherNumber = await generateUniqueVoucherNumber(client, "A");

      await client.query(
        `
          INSERT INTO voucher (
            idcompra,
            numvoucher,
            idagenda,
            tpvoucher,
            vlunicompra,
            vldesc,
            codindica,
            stusado,
            fldesconto,
            dtvalidade
          )
          VALUES ($1, $2, $3, 'norma', $4, NULL, NULL, 'n', 's', $5)
        `,
        [
          purchaseId,
          voucherNumber,
          agendaId,
          normalizeMoney(discountedNormal),
          validityDate,
        ],
      );
    }

    for (let index = 0; index < quantities.discountedChild; index += 1) {
      const voucherNumber = await generateUniqueVoucherNumber(client, "C");

      await client.query(
        `
          INSERT INTO voucher (
            idcompra,
            numvoucher,
            idagenda,
            tpvoucher,
            vlunicompra,
            vldesc,
            codindica,
            stusado,
            fldesconto,
            dtvalidade
          )
          VALUES ($1, $2, $3, 'infan', $4, NULL, NULL, 'n', 's', $5)
        `,
        [
          purchaseId,
          voucherNumber,
          agendaId,
          normalizeMoney(discountedChild),
          validityDate,
        ],
      );
    }

    for (let index = 0; index < quantities.normal; index += 1) {
      const voucherNumber = await generateUniqueVoucherNumber(client, "A");
      const normalVoucherPrice = codindicaTotals
        ? codindicaTotals.normal.unitPrice
        : standardNormal;
      const normalVoucherDiscount = codindicaTotals
        ? normalizeMoney(
            codindicaTotals.fixedPriceMode
              ? 0
              : codindicaTotals.normal.discountUnitPrice,
          )
        : null;

      await client.query(
        `
          INSERT INTO voucher (
            idcompra,
            numvoucher,
            idagenda,
            tpvoucher,
            vlunicompra,
            vldesc,
            codindica,
            stusado,
            fldesconto,
            dtvalidade
          )
          VALUES ($1, $2, $3, 'norma', $4, $5, $6, 'n', 'n', $7)
        `,
        [
          purchaseId,
          voucherNumber,
          agendaId,
          normalizeMoney(normalVoucherPrice),
          normalVoucherDiscount,
          codindicaTotals?.code ?? null,
          validityDate,
        ],
      );
    }

    for (let index = 0; index < quantities.child; index += 1) {
      const voucherNumber = await generateUniqueVoucherNumber(client, "C");
      const childVoucherPrice = codindicaTotals
        ? codindicaTotals.child.unitPrice
        : standardChild;
      const childVoucherDiscount = codindicaTotals
        ? normalizeMoney(
            codindicaTotals.fixedPriceMode
              ? 0
              : codindicaTotals.child.discountUnitPrice,
          )
        : null;

      await client.query(
        `
          INSERT INTO voucher (
            idcompra,
            numvoucher,
            idagenda,
            tpvoucher,
            vlunicompra,
            vldesc,
            codindica,
            stusado,
            fldesconto,
            dtvalidade
          )
          VALUES ($1, $2, $3, 'infan', $4, $5, $6, 'n', 'n', $7)
        `,
        [
          purchaseId,
          voucherNumber,
          agendaId,
          normalizeMoney(childVoucherPrice),
          childVoucherDiscount,
          codindicaTotals?.code ?? null,
          validityDate,
        ],
      );
    }

    for (let index = 0; index < quantities.exempt; index += 1) {
      const voucherNumber = await generateUniqueVoucherNumber(client, "I");

      await client.query(
        `
          INSERT INTO voucher (
            idcompra,
            numvoucher,
            idagenda,
            tpvoucher,
            vlunicompra,
            codindica,
            stusado,
            dtvalidade
          )
          VALUES ($1, $2, $3, 'isent', '0.00', $4, 'n', $5)
        `,
        [purchaseId, voucherNumber, agendaId, codindicaTotals?.code ?? null, validityDate],
      );
    }

    await client.query("COMMIT");

    return {
      purchaseId,
      legacyEncodedId: encodeLegacyId(purchaseId),
      totalValue,
      voucherCount,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function previewOnlinePurchaseCodindica(
  agendaId: number,
  selection: { lineItems: NonNullable<CreatePurchaseRequest["lineItems"]> },
  codindicaInput: string,
) {
  const agenda = await getPublicAgendaReservationById(agendaId);

  if (!agenda) {
    throw new PurchaseCreationError(
      "agenda_not_found",
      "Data de visita indisponivel para compra online.",
      404,
    );
  }

  if (isAgendaDateExpired(agenda.date)) {
    throw new PurchaseCreationError(
      "agenda_expired",
      "Esta data nao esta mais disponivel.",
      409,
    );
  }

  const cart = await buildB2cCartSummary(selection.lineItems);
  const availability = await getAgendaProductAvailability(agenda.date);
  const pool = getIngressoDbPool();
  const codindica = normalizeCodindica(codindicaInput);

  if (!codindica) {
    throw new PurchaseCreationError(
      "invalid_codindica",
      "Informe um codigo de indicacao valido.",
      409,
    );
  }

  for (const line of cart.lines) {
    const allowedIds =
      line.type === "passport" ? availability.passportIds : availability.addonIds;

    if (!allowedIds.includes(line.productId)) {
      throw new PurchaseCreationError(
        "product_unavailable_for_date",
        "Um ou mais itens selecionados nao estao disponiveis para esta data.",
        409,
      );
    }
  }

  const [codindicaResult, parametroResult] = await Promise.all([
    pool.query<CodindicaQueryRow>(
      `
        SELECT
          codindica,
          stcodindica,
          validade::text AS validade,
          nmrepresentante,
          tpdesconto,
          flpromocional,
          vldescnormal::text AS vldescnormal,
          vldescinfant::text AS vldescinfant,
          vldescpromonormal::text AS vldescpromonormal,
          vldescpromoinfant::text AS vldescpromoinfant,
          vlvendanormal::text AS vlvendanormal,
          vlvendainfant::text AS vlvendainfant,
          vlcashback::text AS vlcashback,
          vlcashbacknormal::text AS vlcashbacknormal,
          vlcashbackinfant::text AS vlcashbackinfant
        FROM codindica
        WHERE codindica = $1
        LIMIT 1
      `,
      [codindica],
    ),
    pool.query<CodindicaParametroRow>(
      `
        SELECT idparametro, vlparametro
        FROM parametro
        WHERE idparametro IN ('codine', 'codven', 'codval')
      `,
    ),
  ]);

  try {
    const totals = calculateCodindicaCartTotals({
      code: codindica,
      record: codindicaResult.rows[0] ?? null,
      parameters: parametroResult.rows,
      totalValue: Number(cart.totalValue),
    });

    return {
      codindica: totals.code,
      subtotal: normalizeMoney(totals.totalGross),
      discountAmount: normalizeMoney(totals.discountAmount),
      totalValue: normalizeMoney(totals.totalPaid),
    };
  } catch (error) {
    if (error instanceof CodindicaValidationError) {
      throw new PurchaseCreationError("invalid_codindica", error.message, 409);
    }

    throw error;
  }
}

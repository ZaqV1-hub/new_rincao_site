import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { CIELO_INSTALLMENT_RATES_BPS, quoteCieloInstallments } from "./cielo-installment-pricing";

// The legacy widget uses jQuery; keep only the DOM surface these methods consume.
class Field {
  length = 1;
  value = "";
  content = "";
  options: string[] = [];
  visible = true;
  val(value?: string) { if (value === undefined) return this.value; this.value = value; return this; }
  text(value: string) { this.content = value; return this; }
  toggle(value: boolean) { this.visible = value; return this; }
  prop() { return this; }
  empty() { this.options = []; return this; }
  append(value: string) { this.options.push(value); return this; }
  find() { return { length: this.options.length }; }
}

function checkout(brand: string) {
  let submitted: Record<string, unknown> | undefined;
  const fields = new Map<string, Field>();
  const find = (selector: string) => {
    if (!fields.has(selector)) fields.set(selector, new Field());
    return fields.get(selector)!;
  };
  const window = {
    jQuery: {
      extend: (_deep: boolean, ...objects: object[]) => Object.assign({}, ...objects),
      Deferred: () => ({ resolve() {} }),
      trim: (value: string) => value.trim(),
      ajax: (options: { data: string }) => {
        submitted = JSON.parse(options.data);
        return { done: () => ({ fail() {} }) };
      },
    },
  };
  runInNewContext(readFileSync("public/vendor/checkout/cielo-checkout.js", "utf8"), { window });
  const widget = (window as unknown as {
    CieloCheckout(config: object): {
      current: { valor: string; installments: number; chargedValor: number };
      $modal: { find: typeof find };
      _renderInstallments(): void;
      _updateSummary(): void;
      _submit(): void;
      _setFeedback(message: string): void;
      _handleFail(xhr: object): void;
    };
  }).CieloCheckout({
    maxInstallments: 6,
    installmentRatesBps: CIELO_INSTALLMENT_RATES_BPS,
    quoteInstallments: (count: number, cardBrand: string) => quoteCieloInstallments("350.00", count, cardBrand),
  });
  widget.current.valor = "350.00";
  widget.$modal = { find };
  find("#cieloCardBrand").val(brand);
  find('input[name="cieloPaymentType"]:checked').val("CreditCard");
  return { widget, find, submitted: () => submitted };
}

describe("checkout widget installment totals", () => {
  it.each(["Visa", "Mastercard", "Elo", "Amex"])("uses the server quote in the options and summary for %s", (brand) => {
    const { widget, find } = checkout(brand);
    widget._renderInstallments();
    expect(find("#cieloInstallments").options).toHaveLength(6);
    for (let count = 2; count <= 6; count++) {
      widget.current.installments = count;
      widget._updateSummary();
      const quote = quoteCieloInstallments("350.00", count, brand);
      const total = (quote.chargedCents / 100).toFixed(2).replace(".", ",");
      const surcharge = ((quote.chargedCents - quote.baseCents) / quote.baseCents * 100).toFixed(2).replace(".", ",");
      expect(find("#cieloInstallments").options[count - 1]).toContain(`total R$ ${total}, acréscimo ${surcharge}%`);
      expect(find("#cieloResumoTotal").content).toBe(`R$ ${total}`);
      expect(find("#cieloResumoAcrescimoLabel").content).toContain(`${surcharge}%`);
      expect(widget.current.chargedValor).toBe(quote.chargedCents / 100);
    }
    if (brand === "Visa") {
      expect(find("#cieloInstallments").options[5]).toContain("6x aprox. R$ 65,15 (total R$ 390,89, acréscimo 11,68%)");
    }
  });

  it("removes the surcharge on debit/Pix and resets unsupported brands to 1x", () => {
    const { widget, find } = checkout("Visa");
    widget.current.installments = 6;
    for (const type of ["DebitCard", "Pix"]) {
      find('input[name="cieloPaymentType"]:checked').val(type);
      widget._updateSummary();
      expect(find("#cieloResumoTotal").content).toBe("R$ 350,00");
      expect(find("#cieloResumoAcrescimoLinha").visible).toBe(false);
    }
    find("#cieloCardBrand").val("Diners");
    widget._renderInstallments();
    expect(widget.current.installments).toBe(1);
    expect(find("#cieloInstallments").options).toHaveLength(1);
  });

  it("submits the displayed total and explains a stale-quote rejection", () => {
    const { widget, find, submitted } = checkout("Visa");
    let feedback = "";
    widget._setFeedback = (message) => { feedback = message; };
    find("#cieloCardNumber").val("4111111111111111");
    find("#cieloCardHolder").val("Cliente Teste");
    find("#cieloExpMonth").val("12");
    find("#cieloExpYear").val("2099");
    find("#cieloCardCvv").val("123");
    widget.current.installments = 6;
    widget._updateSummary();
    widget._submit();
    expect(submitted()).toMatchObject({ expectedAmountCents: 39089, payment: { installments: 6 } });
    widget._handleFail({ responseText: JSON.stringify({ error: { code: "checkout_quote_changed" } }) });
    expect(feedback).toContain("Atualize a página");
    widget._handleFail({ responseText: "<html>Bad Gateway</html>" });
    expect(feedback).toContain("Falha ao comunicar");
  });
});

import painelBilheteriaCashClosureContractJson from "@/lib/contracts/legacy-panel/bilheteria-cash-closure.json";
import painelBilheteriaCashClosureEditsContractJson from "@/lib/contracts/legacy-panel/bilheteria-cash-closure-edits.json";
import painelBilheteriaCashClosureHistoryContractJson from "@/lib/contracts/legacy-panel/bilheteria-cash-closure-history.json";
import painelBilheteriaCashFundContractJson from "@/lib/contracts/legacy-panel/bilheteria-cash-fund.json";
import painelBilheteriaFinalizeContractJson from "@/lib/contracts/legacy-panel/bilheteria-finalize.json";
import painelBilheteriaHistoryContractJson from "@/lib/contracts/legacy-panel/bilheteria-history.json";
import painelBilheteriaIndexContractJson from "@/lib/contracts/legacy-panel/bilheteria-index.json";
import painelBilheteriaReservationPaymentContractJson from "@/lib/contracts/legacy-panel/bilheteria-reservation-payment.json";
import painelBilheteriaSalesContractJson from "@/lib/contracts/legacy-panel/bilheteria-sales.json";
import painelHomeContractJson from "@/lib/contracts/legacy-panel/painel-home.json";
import type { LegacyPanelResource } from "@/lib/painel-access";

export type LegacyPanelActionContract = {
  key?: string;
  label: string;
  href: string;
  resource?: LegacyPanelResource;
  managerOnly?: boolean;
};

export type LegacyPanelFieldContract = {
  key: string;
  label: string;
  placeholder?: string;
};

export type LegacyPanelTableColumnContract = {
  key: string;
  label: string;
};

export type LegacyPanelScreenContract = {
  screenId:
    | "painel-home"
    | "bilheteria-index"
    | "bilheteria-sales"
    | "bilheteria-finalize"
    | "bilheteria-reservation-payment"
    | "bilheteria-cash-fund"
    | "bilheteria-cash-closure"
    | "bilheteria-cash-closure-history"
    | "bilheteria-cash-closure-edits"
    | "bilheteria-history";
  title: string;
  breadcrumb?: string[];
  header: {
    primaryLinks?: LegacyPanelActionContract[];
    secondaryLinks?: LegacyPanelActionContract[];
    actions?: LegacyPanelActionContract[];
  };
  forms?: Array<{
    id: string;
    title: string;
    submitLabel: string;
    fields: LegacyPanelFieldContract[];
  }>;
  tables?: Array<{
    id: string;
    title?: string;
    columns: LegacyPanelTableColumnContract[];
  }>;
  feedback?: {
    successText?: string;
    errorTextPrefix?: string;
    errorTextSuffix?: string;
  };
  modals?: Array<{
    id: string;
    title: string;
    primaryActionLabel: string;
  }>;
  emptyStates?: Record<string, string>;
};

export const legacyPanelContracts = {
  home: painelHomeContractJson as LegacyPanelScreenContract,
  bilheteriaIndex: painelBilheteriaIndexContractJson as LegacyPanelScreenContract,
  bilheteriaSales: painelBilheteriaSalesContractJson as LegacyPanelScreenContract,
  bilheteriaFinalize: painelBilheteriaFinalizeContractJson as LegacyPanelScreenContract,
  bilheteriaReservationPayment:
    painelBilheteriaReservationPaymentContractJson as LegacyPanelScreenContract,
  bilheteriaCashFund: painelBilheteriaCashFundContractJson as LegacyPanelScreenContract,
  bilheteriaCashClosure:
    painelBilheteriaCashClosureContractJson as LegacyPanelScreenContract,
  bilheteriaCashClosureHistory:
    painelBilheteriaCashClosureHistoryContractJson as LegacyPanelScreenContract,
  bilheteriaCashClosureEdits:
    painelBilheteriaCashClosureEditsContractJson as LegacyPanelScreenContract,
  bilheteriaHistory: painelBilheteriaHistoryContractJson as LegacyPanelScreenContract,
};

export function getLegacyPanelContract(
  screenId: LegacyPanelScreenContract["screenId"],
) {
  switch (screenId) {
    case "painel-home":
      return legacyPanelContracts.home;
    case "bilheteria-index":
      return legacyPanelContracts.bilheteriaIndex;
    case "bilheteria-sales":
      return legacyPanelContracts.bilheteriaSales;
    case "bilheteria-finalize":
      return legacyPanelContracts.bilheteriaFinalize;
    case "bilheteria-reservation-payment":
      return legacyPanelContracts.bilheteriaReservationPayment;
    case "bilheteria-cash-fund":
      return legacyPanelContracts.bilheteriaCashFund;
    case "bilheteria-cash-closure":
      return legacyPanelContracts.bilheteriaCashClosure;
    case "bilheteria-cash-closure-history":
      return legacyPanelContracts.bilheteriaCashClosureHistory;
    case "bilheteria-cash-closure-edits":
      return legacyPanelContracts.bilheteriaCashClosureEdits;
    case "bilheteria-history":
      return legacyPanelContracts.bilheteriaHistory;
  }
}

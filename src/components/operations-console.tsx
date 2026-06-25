"use client";

import { useEffect, useState } from "react";
import type {
  OperationsPermission,
  OperationsRole,
} from "@/lib/ops-permissions";
import type { PublicAgendaEvent } from "@/lib/agenda-contracts";

type ApiSuccess = {
  ok: true;
  data: unknown;
};

type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type ApiPayload = ApiSuccess | ApiError | null;

type OperationsSessionData = {
  authenticated: boolean;
  actorName: string | null;
  actorCpf: string | null;
  role: OperationsRole;
  permissions: OperationsPermission[];
};

type ReferenceData = {
  discountTypes: Array<{
    id: number;
    description: string;
  }>;
  discounts: Array<{
    id: number;
    typeId: number | null;
    typeDescription: string | null;
    name: string;
    applicationType: string | null;
    value: string;
  }>;
  courtesyAuthors: Array<{
    id: number;
    name: string;
  }>;
};

type ReferenceMutationResult = {
  action: "create" | "update" | "delete";
  resource: "discount_type" | "discount" | "courtesy_author";
  id: number;
  referenceData: ReferenceData;
  auditLogId: number | null;
  message: string;
};

type AuditLogList = {
  items: Array<{
    id: number;
    origin: string;
    action: string;
    purchaseId: number | null;
    description: string;
    reason: string;
    userName: string | null;
    createdAt: string | null;
  }>;
  meta: {
    limit: number;
    offset: number;
    total: number;
    purchaseId: number | null;
    voucherId: number | null;
    agendaId: number | null;
  };
};

type Phase7ParityAction = {
  legacyController: string;
  legacyAction: string;
  capability: string;
  status: "implemented" | "validated" | "pending" | "deprecated";
  nextSurface: string | null;
  evidence: string;
};

type Phase7ParityReport = {
  phase: 7;
  title: string;
  generatedAt: string;
  summary: {
    total: number;
    implemented: number;
    validated: number;
    pending: number;
    deprecated: number;
    completionPercent: number;
    writeCutoverReady: boolean;
  };
  domains: Array<{
    domain: string;
    criticality: "critical" | "high" | "medium";
    actions: Phase7ParityAction[];
  }>;
  blockers: Phase7ParityAction[];
};

type AdminFieldDefinition = {
  name: string;
  column: string;
  type:
    | "text"
    | "money"
    | "integer"
    | "date"
    | "status"
    | "boolean"
    | "cpf"
    | "email"
    | "password";
  required: boolean;
  maxLength: number | null;
  allowed: string[] | null;
  allowedIntegers?: number[] | null;
  editable: boolean;
  writeOnly: boolean;
};

type AdminResourceDefinition = {
  resource: string;
  label: string;
  primaryKey: string;
  primaryKeyType: "integer" | "text";
  supportedActions: Array<"create" | "update" | "delete">;
  fields: AdminFieldDefinition[];
};

type AdminResourceData = {
  resource: string;
  label: string;
  primaryKey: string;
  items: Array<Record<string, unknown>>;
};

type AdminParameterValue = {
  group: string;
  id: string;
  label: string;
  description: string;
  defaultValue: string;
  input: "textarea";
  required: boolean;
  value: string;
  persisted: boolean;
};

type AgreementMemberListItem = {
  agreementId: number;
  agreementName: string | null;
  cpf: string;
  dailyPurchaseLimit: number;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  userName: string | null;
};

type AgreementMemberList = {
  agreementId: number;
  agreementName: string | null;
  items: AgreementMemberListItem[];
  meta: {
    total: number;
    filters: {
      cpf: string | null;
      status: string | null;
      startDateFrom: string | null;
      startDateTo: string | null;
      endDateFrom: string | null;
      endDateTo: string | null;
    };
  };
};

type AgreementMemberImportPreview = {
  agreementId: number;
  agreementName: string | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  log: string;
  rows: Array<{
    line: number;
    cpf: string | null;
    dailyPurchaseLimit: number | null;
    startDate: string | null;
    endDate: string | null;
    status: "ati" | "ina" | null;
    errors: string[];
    willUpdate: boolean;
  }>;
};

type AgreementPurchaseReport = {
  generatedAt: string;
  filters: {
    agreementName: string | null;
    voucherNumber: string | null;
    visitDateFrom: string | null;
    visitDateTo: string | null;
    usedDateFrom: string | null;
    usedDateTo: string | null;
    voucherType: string | null;
    purchaseType: string | null;
    usedStatus: string | null;
    paymentStatus: number | null;
    purchaseStatus: string | null;
    paymentMethodType: number | null;
  };
  indicators: {
    qtdnormal: number;
    vlnormal: string;
    qtdinfantil: number;
    vlinfantil: string;
    qtdisento: number;
    qtdescola: number;
    vlescola: string;
    qtdconvenio: number;
    vlconvenio: string;
  };
  rows: Array<{
    agreementName: string;
    adultQuantity: number;
    adultValue: string;
    childQuantity: number;
    childValue: string;
    schoolQuantity: number;
    schoolValue: string;
    exemptQuantity: number;
    totalQuantity: number;
    totalValue: string;
  }>;
};

type ClientTypeOption = {
  id: number;
  name: string;
};

type ClientAutocompleteItem = {
  id: number;
  text: string;
  name: string;
  typeId: number | null;
  typeName: string | null;
};

type ClientPeriodItem = {
  id: number;
  classId: number;
  name: string;
  order: number;
  status: "ati" | "ina";
};

type ClientClassItem = {
  id: number;
  clientId: number;
  name: string;
  order: number;
  status: "ati" | "ina";
  periods: ClientPeriodItem[];
};

type ClientEducationSummary = {
  client: {
    id: number;
    name: string;
    typeId: number;
    typeName: string | null;
    isSchool: boolean;
    active: boolean;
  };
  standardPeriodOptions: Array<{
    slug: string;
    name: string;
    order: number;
  }>;
  classes: ClientClassItem[];
};

type BoxOfficePaymentRow = {
  id: string;
  method: string;
  value: string;
};

export type OperationsConsoleSection =
  | "phase7"
  | "admin"
  | "agreements"
  | "clients"
  | "operations";

type OperationsConsoleProps = {
  embedded?: boolean;
  visibleSections?: OperationsConsoleSection[];
};

function createBoxOfficeIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `box-office-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseCurrency(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value ?? "").trim().replace(/^R\$\s*/i, "");
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.includes(",")
        ? raw.replace(",", ".")
        : raw;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.slice(0, 10).split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatAdminValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Nao";
  }

  if (typeof value === "object") {
    return prettyJson(value);
  }

  return String(value);
}

type CashMovement = {
  id: number;
  type: "fundo" | "sangria";
  responsible: string;
  value: string;
  createdAt: string | null;
};

type CashSummary = {
  period: {
    id: number;
    openedAt: string | null;
    closedAt: string | null;
    operator: string | null;
    closureSheetId: number | null;
  };
  funds: CashMovement[];
  sangrias: CashMovement[];
  totals: {
    cashSales: string;
    fund: string;
    sangria: string;
    cashInDrawer: string;
  };
};

type CashClosureList = {
  items: Array<{
    id: number;
    periodId: number | null;
    openedAt: string | null;
    closedAt: string | null;
    operator: string | null;
    totals: {
      cash: string;
      fund: string;
      overall: string;
    };
    createdAt: string | null;
  }>;
  meta: {
    limit: number;
    offset: number;
    total: number;
  };
};

type CashClosureDetail = CashClosureList["items"][number] & {
  snapshot: unknown;
};

type JobRunList = {
  items: Array<{
    id: number;
    jobName: string;
    triggerSource: string;
    initiatedBy: string | null;
    status: string;
    message: string;
    summary: unknown;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string | null;
  }>;
  meta: {
    limit: number;
    offset: number;
    total: number;
    jobName: string | null;
  };
};

type JobHealth = {
  jobName: string;
  triggerSource: string;
  maxAgeMinutes: number;
  healthy: boolean;
  status: "healthy" | "stale" | "failed" | "missing";
  message: string;
  recommendedActions: string[];
  ageMinutes: number | null;
  latestRun: JobRunList["items"][number] | null;
  lastSuccessAt: string | null;
};

const storageKeys = {
  actorName: "rincao_ops_actor_name",
  actorCpf: "rincao_ops_actor_cpf",
};

function readSessionValue(key: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return window.sessionStorage.getItem(key) ?? "";
}

function parseCsvIds(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => Number(entry.trim()))
        .filter((entry) => Number.isInteger(entry) && entry > 0),
    ),
  );
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJsonArray<T>(value: string, label: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return [] as T[];
  }

  const parsed = JSON.parse(trimmed) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error(`${label} precisa ser um array JSON.`);
  }

  return parsed as T[];
}

function buildBoxOfficeAgendaPeriod() {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
  };
}

function isApiSuccess(payload: ApiPayload): payload is ApiSuccess {
  return payload?.ok === true;
}

const permissionLabels: Record<OperationsPermission, string> = {
  "ops.read": "consultar dados operacionais",
  "ops.vouchers": "operar vouchers",
  "ops.purchases": "operar compras",
  "ops.cash": "operar caixa",
  "ops.jobs": "executar jobs operacionais",
  "ops.admin": "administrar painel interno",
};

export function OperationsConsole({
  embedded = false,
  visibleSections,
}: OperationsConsoleProps = {}) {
  const sectionSet = new Set<OperationsConsoleSection>(
    visibleSections ?? [
      "phase7",
      "admin",
      "agreements",
      "clients",
      "operations",
    ],
  );
  const [tokenInput, setTokenInput] = useState("");
  const [actorName, setActorName] = useState(() =>
    readSessionValue(storageKeys.actorName),
  );
  const [actorCpf, setActorCpf] = useState(() =>
    readSessionValue(storageKeys.actorCpf),
  );
  const [responseTitle, setResponseTitle] = useState("Nenhuma operacao executada.");
  const [responseBody, setResponseBody] = useState<ApiPayload>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [opsSession, setOpsSession] = useState<OperationsSessionData | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [auditLogList, setAuditLogList] = useState<AuditLogList | null>(null);
  const [cashSummary, setCashSummary] = useState<CashSummary | null>(null);
  const [cashClosureList, setCashClosureList] = useState<CashClosureList | null>(null);
  const [selectedCashClosure, setSelectedCashClosure] = useState<CashClosureDetail | null>(null);
  const [jobRunList, setJobRunList] = useState<JobRunList | null>(null);
  const [jobHealth, setJobHealth] = useState<JobHealth | null>(null);
  const [phase7Parity, setPhase7Parity] = useState<Phase7ParityReport | null>(
    null,
  );
  const [adminResourceCatalog, setAdminResourceCatalog] = useState<
    AdminResourceDefinition[]
  >([]);
  const [selectedAdminResource, setSelectedAdminResource] = useState("");
  const [adminResourceData, setAdminResourceData] = useState<AdminResourceData | null>(
    null,
  );
  const [adminFormValues, setAdminFormValues] = useState<Record<string, string>>({});
  const [adminEditId, setAdminEditId] = useState("");
  const [adminSaveReason, setAdminSaveReason] = useState("");
  const [adminDeleteId, setAdminDeleteId] = useState("");
  const [adminDeleteReason, setAdminDeleteReason] = useState("");
  const [adminParameters, setAdminParameters] = useState<AdminParameterValue[] | null>(
    null,
  );
  const [adminParameterValues, setAdminParameterValues] = useState<
    Record<string, string>
  >({});
  const [adminParametersReason, setAdminParametersReason] = useState("");
  const [agreementMembersAgreementId, setAgreementMembersAgreementId] = useState("");
  const [agreementMembersCpfFilter, setAgreementMembersCpfFilter] = useState("");
  const [agreementMembersStatusFilter, setAgreementMembersStatusFilter] =
    useState("");
  const [agreementMembersData, setAgreementMembersData] =
    useState<AgreementMemberList | null>(null);
  const [agreementMemberEditCpf, setAgreementMemberEditCpf] = useState("");
  const [agreementMemberCpf, setAgreementMemberCpf] = useState("");
  const [agreementMemberDailyPurchaseLimit, setAgreementMemberDailyPurchaseLimit] =
    useState("1");
  const [agreementMemberStartDate, setAgreementMemberStartDate] = useState("");
  const [agreementMemberEndDate, setAgreementMemberEndDate] = useState("");
  const [agreementMemberStatus, setAgreementMemberStatus] = useState("ati");
  const [agreementMemberReason, setAgreementMemberReason] = useState("");
  const [agreementMemberDeleteCpf, setAgreementMemberDeleteCpf] = useState("");
  const [agreementMemberDeleteReason, setAgreementMemberDeleteReason] =
    useState("");
  const [agreementMemberImportCsv, setAgreementMemberImportCsv] = useState(
    "CPF,QTD. COMPRA POR DIA,DATA INICIO,DATA FIM,STATUS",
  );
  const [agreementMemberImportReason, setAgreementMemberImportReason] = useState(
    "Importacao de conveniados no painel interno",
  );
  const [agreementMemberImportPreview, setAgreementMemberImportPreview] =
    useState<AgreementMemberImportPreview | null>(null);
  const [agreementPurchaseReportAgreementName, setAgreementPurchaseReportAgreementName] =
    useState("");
  const [agreementPurchaseReportVisitDateFrom, setAgreementPurchaseReportVisitDateFrom] =
    useState("");
  const [agreementPurchaseReportVisitDateTo, setAgreementPurchaseReportVisitDateTo] =
    useState("");
  const [agreementPurchaseReportVoucherType, setAgreementPurchaseReportVoucherType] =
    useState("");
  const [agreementPurchaseReportPurchaseStatus, setAgreementPurchaseReportPurchaseStatus] =
    useState("");
  const [agreementPurchaseReport, setAgreementPurchaseReport] =
    useState<AgreementPurchaseReport | null>(null);
  const [clientTypeOptions, setClientTypeOptions] = useState<ClientTypeOption[]>([]);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState<
    ClientAutocompleteItem[]
  >([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientEducationSummary, setClientEducationSummary] =
    useState<ClientEducationSummary | null>(null);
  const [clientStatusReason, setClientStatusReason] = useState("");
  const [clientClassEditId, setClientClassEditId] = useState("");
  const [clientClassName, setClientClassName] = useState("");
  const [clientClassOrder, setClientClassOrder] = useState("0");
  const [clientClassStatus, setClientClassStatus] = useState("ati");
  const [clientClassDefaultPeriods, setClientClassDefaultPeriods] = useState<
    string[]
  >([]);
  const [clientClassReason, setClientClassReason] = useState("");
  const [clientClassDeleteId, setClientClassDeleteId] = useState("");
  const [clientClassDeleteReason, setClientClassDeleteReason] = useState("");
  const [clientPeriodClassId, setClientPeriodClassId] = useState("");
  const [clientPeriodEditId, setClientPeriodEditId] = useState("");
  const [clientPeriodName, setClientPeriodName] = useState("");
  const [clientPeriodOrder, setClientPeriodOrder] = useState("0");
  const [clientPeriodStatus, setClientPeriodStatus] = useState("ati");
  const [clientPeriodReason, setClientPeriodReason] = useState("");
  const [clientPeriodDeleteId, setClientPeriodDeleteId] = useState("");
  const [clientPeriodDeleteReason, setClientPeriodDeleteReason] = useState("");
  const [auditPurchaseId, setAuditPurchaseId] = useState("");
  const [auditVoucherId, setAuditVoucherId] = useState("");
  const [auditAgendaId, setAuditAgendaId] = useState("");
  const [cashMovementType, setCashMovementType] = useState<"fundo" | "sangria">("fundo");
  const [cashResponsible, setCashResponsible] = useState("");
  const [cashValue, setCashValue] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [cashEditMovementId, setCashEditMovementId] = useState("");
  const [cashEditResponsible, setCashEditResponsible] = useState("");
  const [cashEditValue, setCashEditValue] = useState("");
  const [cashEditReason, setCashEditReason] = useState("");
  const [cashDeleteMovementId, setCashDeleteMovementId] = useState("");
  const [cashDeleteReason, setCashDeleteReason] = useState("");
  const [cashCloseOperator, setCashCloseOperator] = useState(() =>
    readSessionValue(storageKeys.actorName),
  );
  const [cashCloseReason, setCashCloseReason] = useState("");
  const [cashAutoCloseReason, setCashAutoCloseReason] = useState("");
  const [paymentSyncRecentDays, setPaymentSyncRecentDays] = useState("7");
  const [paymentSyncCancelAfterDays, setPaymentSyncCancelAfterDays] = useState("5");
  const [paymentSyncLimit, setPaymentSyncLimit] = useState("50");
  const [dailyJobsCashReason, setDailyJobsCashReason] = useState(
    "Rotina diaria operacional no BFF",
  );
  const [discountEditId, setDiscountEditId] = useState("");
  const [discountTypeEditId, setDiscountTypeEditId] = useState("");
  const [discountTypeDescription, setDiscountTypeDescription] = useState("");
  const [discountTypeReason, setDiscountTypeReason] = useState("");
  const [discountTypeId, setDiscountTypeId] = useState("");
  const [discountName, setDiscountName] = useState("");
  const [discountApplicationType, setDiscountApplicationType] = useState<
    "percentual" | "valor_fixo"
  >("percentual");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [courtesyEditId, setCourtesyEditId] = useState("");
  const [courtesyName, setCourtesyName] = useState("");
  const [courtesyReason, setCourtesyReason] = useState("");
  const [referenceDeleteResource, setReferenceDeleteResource] = useState<
    "discount_type" | "discount" | "courtesy_author"
  >("discount");
  const [referenceDeleteId, setReferenceDeleteId] = useState("");
  const [referenceDeleteReason, setReferenceDeleteReason] = useState("");

  const [voucherNumber, setVoucherNumber] = useState("");
  const [voucherConfirm, setVoucherConfirm] = useState(false);
  const [purchaseValidateId, setPurchaseValidateId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [agendaId, setAgendaId] = useState("");
  const [voucherAction, setVoucherAction] = useState<
    "validate" | "unvalidate" | "invalidate"
  >("validate");
  const [voucherIdsCsv, setVoucherIdsCsv] = useState("");

  const [cancelPurchaseId, setCancelPurchaseId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const initialBoxOfficePeriod = buildBoxOfficeAgendaPeriod();
  const [boxOfficeAgendaMonth, setBoxOfficeAgendaMonth] = useState(
    initialBoxOfficePeriod.month,
  );
  const [boxOfficeAgendaYear, setBoxOfficeAgendaYear] = useState(
    initialBoxOfficePeriod.year,
  );
  const [boxOfficeAgendas, setBoxOfficeAgendas] = useState<PublicAgendaEvent[]>(
    [],
  );
  const [boxOfficeAgendaId, setBoxOfficeAgendaId] = useState("");
  const [boxOfficeCpf, setBoxOfficeCpf] = useState("");
  const [boxOfficeAdultQuantity, setBoxOfficeAdultQuantity] = useState("1");
  const [boxOfficeAdultDiscountId, setBoxOfficeAdultDiscountId] = useState("");
  const [boxOfficeChildQuantity, setBoxOfficeChildQuantity] = useState("0");
  const [boxOfficeChildDiscountId, setBoxOfficeChildDiscountId] = useState("");
  const [boxOfficeExemptQuantity, setBoxOfficeExemptQuantity] = useState("0");
  const [boxOfficeCourtesyAuthorId, setBoxOfficeCourtesyAuthorId] =
    useState("");
  const [boxOfficeCourtesyQuantity, setBoxOfficeCourtesyQuantity] =
    useState("0");
  const [boxOfficeCourtesyIdentification, setBoxOfficeCourtesyIdentification] =
    useState("");
  const [boxOfficeCourtesyNote, setBoxOfficeCourtesyNote] = useState("");
  const [boxOfficePaymentRows, setBoxOfficePaymentRows] = useState<
    BoxOfficePaymentRow[]
  >([
    { id: "cash", method: "dinhe", value: "100,00" },
    { id: "pix", method: "pix", value: "" },
    { id: "card", method: "cart", value: "" },
  ]);
  const [boxOfficeItemsJson, setBoxOfficeItemsJson] = useState(
    '[\n  { "type": "norma", "quantity": 1 }\n]',
  );
  const [boxOfficeCourtesiesJson, setBoxOfficeCourtesiesJson] = useState("[]");
  const [boxOfficePaymentsJson, setBoxOfficePaymentsJson] = useState(
    '[\n  { "method": "dinhe", "value": "100,00" }\n]',
  );
  const [boxOfficeReason, setBoxOfficeReason] = useState(
    "Venda presencial na bilheteria",
  );
  const [boxOfficeIdempotencyKey, setBoxOfficeIdempotencyKey] = useState("");

  const [updatePurchaseId, setUpdatePurchaseId] = useState("");
  const [updateReason, setUpdateReason] = useState("");
  const [updateDate, setUpdateDate] = useState("");
  const [updateStatus, setUpdateStatus] = useState("conc");
  const [updateCpf, setUpdateCpf] = useState("");
  const [updateVouchersJson, setUpdateVouchersJson] = useState(
    '[\n  { "id": 1, "status": "s", "discountId": 7 }\n]',
  );
  const [updatePaymentsJson, setUpdatePaymentsJson] = useState(
    '[\n  { "method": "pix", "value": "150,00" }\n]',
  );
  const isSessionAuthenticated = opsSession?.authenticated === true;
  const selectedBoxOfficeAgenda =
    boxOfficeAgendas.find(
      (agenda) => String(agenda.id) === boxOfficeAgendaId.trim(),
    ) ?? null;
  const boxOfficeDiscounts = referenceData?.discounts ?? [];
  const boxOfficeCourtesyAuthors = referenceData?.courtesyAuthors ?? [];
  const boxOfficeAdultBasePrice = parseCurrency(
    selectedBoxOfficeAgenda?.priceTable.gateNormal,
  );
  const boxOfficeChildBasePrice = parseCurrency(
    selectedBoxOfficeAgenda?.priceTable.gateChild,
  );
  const boxOfficeAdultQuantityNumber = Math.max(
    0,
    Math.trunc(Number(boxOfficeAdultQuantity) || 0),
  );
  const boxOfficeChildQuantityNumber = Math.max(
    0,
    Math.trunc(Number(boxOfficeChildQuantity) || 0),
  );
  const boxOfficeExemptQuantityNumber = Math.max(
    0,
    Math.trunc(Number(boxOfficeExemptQuantity) || 0),
  );
  const boxOfficeCourtesyQuantityNumber = Math.max(
    0,
    Math.trunc(Number(boxOfficeCourtesyQuantity) || 0),
  );

  function discountUnitPrice(basePrice: number, discountId: string) {
    const discount = boxOfficeDiscounts.find(
      (item) => String(item.id) === discountId.trim(),
    );

    if (!discount) {
      return basePrice;
    }

    const value = parseCurrency(discount.value);

    if (discount.applicationType === "percentual") {
      return Math.max(0, money(basePrice - basePrice * (value / 100)));
    }

    if (discount.applicationType === "valor_fixo") {
      return Math.max(0, money(basePrice - Math.min(basePrice, value)));
    }

    return basePrice;
  }

  const boxOfficeAdultUnitPrice = discountUnitPrice(
    boxOfficeAdultBasePrice,
    boxOfficeAdultDiscountId,
  );
  const boxOfficeChildUnitPrice = discountUnitPrice(
    boxOfficeChildBasePrice,
    boxOfficeChildDiscountId,
  );
  const boxOfficeTotal = money(
    boxOfficeAdultUnitPrice * boxOfficeAdultQuantityNumber +
      boxOfficeChildUnitPrice * boxOfficeChildQuantityNumber,
  );
  const boxOfficePaymentTotal = money(
    boxOfficePaymentRows.reduce(
      (total, payment) => total + parseCurrency(payment.value),
      0,
    ),
  );
  const boxOfficePaymentDifference = money(
    boxOfficePaymentTotal - boxOfficeTotal,
  );
  const selectedAdminResourceDefinition =
    adminResourceCatalog.find(
      (resource) => resource.resource === selectedAdminResource,
    ) ?? null;
  const canCreateAdminResource =
    selectedAdminResourceDefinition?.supportedActions.includes("create") ?? false;
  const canUpdateAdminResource =
    selectedAdminResourceDefinition?.supportedActions.includes("update") ?? false;
  const canDeleteAdminResource =
    selectedAdminResourceDefinition?.supportedActions.includes("delete") ?? false;
  const selectedClientClass =
    clientEducationSummary?.classes.find(
      (item) => String(item.id) === clientPeriodClassId.trim(),
    ) ?? null;

  function isVisible(section: OperationsConsoleSection) {
    return sectionSet.has(section);
  }

  function createInitialAdminFormValues(
    resourceDefinition: AdminResourceDefinition | null,
  ) {
    if (!resourceDefinition) {
      return {};
    }

    return Object.fromEntries(
      resourceDefinition.fields.map((field) => [
        field.name,
        field.writeOnly
          ? ""
          : field.type === "boolean"
            ? "true"
            : field.allowed?.[0] ?? "",
      ]),
    );
  }

  function serializeAdminIdentifier(
    resourceDefinition: AdminResourceDefinition,
    rawValue: string,
  ) {
    if (resourceDefinition.primaryKeyType === "integer") {
      return Number(rawValue);
    }

    return rawValue.trim();
  }

  function resetAdminEditor(resourceDefinition?: AdminResourceDefinition | null) {
    const definition = resourceDefinition ?? selectedAdminResourceDefinition;

    setAdminEditId("");
    setAdminDeleteId("");
    setAdminSaveReason("");
    setAdminDeleteReason("");
    setAdminFormValues(createInitialAdminFormValues(definition ?? null));
  }

  function resetAgreementMemberEditor() {
    setAgreementMemberEditCpf("");
    setAgreementMemberCpf("");
    setAgreementMemberDailyPurchaseLimit("1");
    setAgreementMemberStartDate("");
    setAgreementMemberEndDate("");
    setAgreementMemberStatus("ati");
    setAgreementMemberReason("");
    setAgreementMemberDeleteCpf("");
    setAgreementMemberDeleteReason("");
  }

  function populateAgreementMemberEditor(item: AgreementMemberListItem) {
    setAgreementMemberEditCpf(item.cpf);
    setAgreementMemberDeleteCpf(item.cpf);
    setAgreementMemberCpf(item.cpf);
    setAgreementMemberDailyPurchaseLimit(String(item.dailyPurchaseLimit));
    setAgreementMemberStartDate(item.startDate ?? "");
    setAgreementMemberEndDate(item.endDate ?? "");
    setAgreementMemberStatus(item.status ?? "ati");
  }

  function resetClientClassEditor() {
    setClientClassEditId("");
    setClientClassName("");
    setClientClassOrder("0");
    setClientClassStatus("ati");
    setClientClassDefaultPeriods([]);
    setClientClassReason("");
    setClientClassDeleteId("");
    setClientClassDeleteReason("");
  }

  function populateClientClassEditor(item: ClientClassItem) {
    setClientClassEditId(String(item.id));
    setClientClassName(item.name);
    setClientClassOrder(String(item.order));
    setClientClassStatus(item.status);
    setClientClassDefaultPeriods(
      item.periods
        .map((period) => period.name.toLowerCase())
        .filter((name) => ["manha", "tarde", "noite", "integral"].includes(name)),
    );
    setClientClassDeleteId(String(item.id));
    setClientPeriodClassId(String(item.id));
  }

  function toggleClientClassDefaultPeriod(slug: string) {
    setClientClassDefaultPeriods((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug],
    );
  }

  function resetClientPeriodEditor() {
    setClientPeriodEditId("");
    setClientPeriodName("");
    setClientPeriodOrder("0");
    setClientPeriodStatus("ati");
    setClientPeriodReason("");
    setClientPeriodDeleteId("");
    setClientPeriodDeleteReason("");
  }

  function populateClientPeriodEditor(classId: number, item: ClientPeriodItem) {
    setClientPeriodClassId(String(classId));
    setClientPeriodEditId(String(item.id));
    setClientPeriodName(item.name);
    setClientPeriodOrder(String(item.order));
    setClientPeriodStatus(item.status);
    setClientPeriodDeleteId(String(item.id));
  }

  useEffect(() => {
    sessionStorage.setItem(storageKeys.actorName, actorName);
  }, [actorName]);

  useEffect(() => {
    sessionStorage.setItem(storageKeys.actorCpf, actorCpf);
  }, [actorCpf]);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/ops/session", {
          method: "GET",
        });
        const payload = (await response.json().catch(() => null)) as ApiPayload;

        if (!active) {
          return;
        }

        if (response.ok && isApiSuccess(payload)) {
          const data = payload.data as OperationsSessionData;
          setOpsSession(data);
          setActorName(data.actorName ?? "");
          setActorCpf(data.actorCpf ?? "");
          setCashCloseOperator((current) => current.trim() ? current : (data.actorName ?? ""));
        } else {
          setOpsSession(null);
        }
      } catch {
        if (active) {
          setOpsSession(null);
        }
      } finally {
        if (active) {
          setSessionReady(true);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleSessionLogin() {
    if (!tokenInput.trim()) {
      setResponseTitle("Entrar na console operacional");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_token",
          message: "Informe o token operacional para abrir a sessao.",
        },
      });
      return;
    }

    setPendingKey("ops-session-login");
    setResponseTitle("Entrar na console operacional");

    try {
      const response = await fetch("/api/ops/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          token: tokenInput.trim(),
          actorName: actorName.trim() || undefined,
          actorCpf: actorCpf.trim() || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        const data = payload.data as OperationsSessionData;
        setOpsSession(data);
        setActorName(data.actorName ?? "");
        setActorCpf(data.actorCpf ?? "");
        setCashCloseOperator((current) => current.trim() ? current : (data.actorName ?? ""));
        setTokenInput("");
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao abrir a sessao operacional.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleSessionLogout() {
    setPendingKey("ops-session-logout");
    setResponseTitle("Encerrar sessao operacional");

    try {
      const response = await fetch("/api/ops/session", {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);
      setOpsSession(null);
      setReferenceData(null);
      setAuditLogList(null);
      setCashSummary(null);
      setPhase7Parity(null);
      setAdminResourceCatalog([]);
      setSelectedAdminResource("");
      setAdminResourceData(null);
      setAdminFormValues({});
      setAdminEditId("");
      setAdminDeleteId("");
      setAdminParameters(null);
      setAdminParameterValues({});
      setClientTypeOptions([]);
      setClientSearchResults([]);
      setClientEducationSummary(null);
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao encerrar a sessao operacional.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function loadBoxOfficeAgendas() {
    if (!ensureSessionPermission("Carregar agenda de bilheteria", "ops.read")) {
      return;
    }

    setPendingKey("box-office-agendas");
    setResponseTitle("Carregar agenda de bilheteria");

    try {
      const response = await fetch(
        `/api/agenda/publica?mes=${encodeURIComponent(
          boxOfficeAgendaMonth.trim(),
        )}&ano=${encodeURIComponent(boxOfficeAgendaYear.trim())}`,
        {
          method: "GET",
          credentials: "same-origin",
        },
      );
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        const data = payload.data as {
          events: PublicAgendaEvent[];
        };
        setBoxOfficeAgendas(data.events);
        setBoxOfficeAgendaId((current) =>
          current.trim() ? current : String(data.events[0]?.id ?? ""),
        );
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao carregar a agenda de bilheteria.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  function updateBoxOfficePaymentRow(
    id: string,
    patch: Partial<BoxOfficePaymentRow>,
  ) {
    setBoxOfficePaymentRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function buildStructuredBoxOfficePayload() {
    const items = [
      ...(boxOfficeAdultQuantityNumber > 0
        ? [
            {
              type: "norma",
              quantity: boxOfficeAdultQuantityNumber,
              ...(boxOfficeAdultDiscountId.trim()
                ? { discountId: Number(boxOfficeAdultDiscountId) }
                : {}),
            },
          ]
        : []),
      ...(boxOfficeChildQuantityNumber > 0
        ? [
            {
              type: "infan",
              quantity: boxOfficeChildQuantityNumber,
              ...(boxOfficeChildDiscountId.trim()
                ? { discountId: Number(boxOfficeChildDiscountId) }
                : {}),
            },
          ]
        : []),
      ...(boxOfficeExemptQuantityNumber > 0
        ? [{ type: "isent", quantity: boxOfficeExemptQuantityNumber }]
        : []),
    ];
    const courtesies =
      boxOfficeCourtesyQuantityNumber > 0 &&
      Number(boxOfficeCourtesyAuthorId) > 0
        ? [
            {
              authorId: Number(boxOfficeCourtesyAuthorId),
              quantity: boxOfficeCourtesyQuantityNumber,
              identification: boxOfficeCourtesyIdentification,
              note: boxOfficeCourtesyNote,
            },
          ]
        : [];
    const payments = boxOfficePaymentRows
      .map((payment) => ({
        method: payment.method.trim(),
        value: payment.value.trim(),
      }))
      .filter((payment) => payment.method && parseCurrency(payment.value) > 0);

    return { items, courtesies, payments };
  }

  async function sendRequest(
    key: string,
    title: string,
    url: string,
    body: Record<string, unknown>,
    requiredPermission: OperationsPermission,
  ) {
    if (!ensureSessionPermission(title, requiredPermission)) {
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey(key);
    setResponseTitle(title);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(
          actor ? { ...body, actor } : body,
        ),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao executar a operacao.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function sendReadRequest<T>(
    key: string,
    title: string,
    url: string,
    onSuccess: (data: T) => void,
    requiredPermission: OperationsPermission = "ops.read",
  ) {
    if (!ensureSessionPermission(title, requiredPermission)) {
      return;
    }

    setPendingKey(key);
    setResponseTitle(title);

    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        onSuccess(payload.data as T);
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao carregar os dados operacionais.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function loadCashSummary() {
    await sendReadRequest<CashSummary>(
      "cash-summary",
      "Carregar resumo de caixa",
      "/api/ops/cash-summary",
      setCashSummary,
      "ops.read",
    );
  }

  async function sendReferenceMutation(
    key: string,
    title: string,
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown>,
  ) {
    if (!ensureSessionPermission(title, "ops.purchases")) {
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey(key);
    setResponseTitle(title);

    try {
      const response = await fetch("/api/ops/reference-data", {
        method,
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(actor ? { ...body, actor } : body),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        const data = payload.data as ReferenceMutationResult;
        setReferenceData(data.referenceData);
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao atualizar as referencias operacionais.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleDiscountSave() {
    const isUpdate = discountEditId.trim() !== "";

    await sendReferenceMutation(
      isUpdate ? "reference-discount-update" : "reference-discount-create",
      isUpdate ? "Editar desconto" : "Cadastrar desconto",
      isUpdate ? "PATCH" : "POST",
      {
        resource: "discount",
        ...(isUpdate ? { id: Number(discountEditId) } : {}),
        typeId: Number(discountTypeId),
        name: discountName,
        applicationType: discountApplicationType,
        value: discountValue,
        reason: discountReason,
      },
    );
  }

  async function handleDiscountTypeSave() {
    const isUpdate = discountTypeEditId.trim() !== "";

    await sendReferenceMutation(
      isUpdate
        ? "reference-discount-type-update"
        : "reference-discount-type-create",
      isUpdate ? "Editar tipo de desconto" : "Cadastrar tipo de desconto",
      isUpdate ? "PATCH" : "POST",
      {
        resource: "discount_type",
        ...(isUpdate ? { id: Number(discountTypeEditId) } : {}),
        description: discountTypeDescription,
        reason: discountTypeReason,
      },
    );
  }

  async function handleCourtesySave() {
    const isUpdate = courtesyEditId.trim() !== "";

    await sendReferenceMutation(
      isUpdate ? "reference-courtesy-update" : "reference-courtesy-create",
      isUpdate ? "Editar autorizador de cortesia" : "Cadastrar autorizador de cortesia",
      isUpdate ? "PATCH" : "POST",
      {
        resource: "courtesy_author",
        ...(isUpdate ? { id: Number(courtesyEditId) } : {}),
        name: courtesyName,
        reason: courtesyReason,
      },
    );
  }

  async function handleReferenceDelete() {
    await sendReferenceMutation(
      "reference-delete",
      "Excluir referencia operacional",
      "DELETE",
      {
        resource: referenceDeleteResource,
        id: Number(referenceDeleteId),
        reason: referenceDeleteReason,
      },
    );
  }

  function ensureSessionPermission(
    title: string,
    permission: OperationsPermission,
  ) {
    if (!isSessionAuthenticated) {
      setResponseTitle(title);
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_operations_session",
          message: "Abra a sessao operacional antes de executar a acao.",
        },
      });
      return false;
    }

    if (!(opsSession?.permissions ?? []).includes(permission)) {
      setResponseTitle(title);
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_operations_permission",
          message: `A sessao atual nao possui permissao para ${permissionLabels[permission]}.`,
        },
      });
      return false;
    }

    return true;
  }

  function hasSessionPermission(permission: OperationsPermission) {
    return isSessionAuthenticated && (opsSession?.permissions ?? []).includes(permission);
  }

  async function handleCashMovementSubmit() {
    if (!ensureSessionPermission("Registrar lancamento de caixa", "ops.cash")) {
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey("cash-movement");
    setResponseTitle("Registrar lancamento de caixa");

    try {
      const response = await fetch("/api/ops/cash-movements", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          type: cashMovementType,
          responsible: cashResponsible,
          value: cashValue,
          reason: cashReason,
          ...(actor ? { actor } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        const data = payload.data as {
          summary: CashSummary;
        };
        setCashSummary(data.summary);
        setCashValue("");
        setCashReason("");
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao registrar o lancamento de caixa.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleCashMovementUpdate() {
    if (!ensureSessionPermission("Editar lancamento de caixa", "ops.cash")) {
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey("cash-movement-update");
    setResponseTitle("Editar lancamento de caixa");

    try {
      const response = await fetch("/api/ops/cash-movements", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          movementId: Number(cashEditMovementId),
          responsible: cashEditResponsible,
          value: cashEditValue,
          reason: cashEditReason,
          ...(actor ? { actor } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        const data = payload.data as {
          summary: CashSummary;
        };
        setCashSummary(data.summary);
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao atualizar o lancamento de caixa.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleCashMovementDelete() {
    if (!ensureSessionPermission("Excluir lancamento de caixa", "ops.cash")) {
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey("cash-movement-delete");
    setResponseTitle("Excluir lancamento de caixa");

    try {
      const response = await fetch("/api/ops/cash-movements", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          movementId: Number(cashDeleteMovementId),
          reason: cashDeleteReason,
          ...(actor ? { actor } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        const data = payload.data as {
          summary: CashSummary;
        };
        setCashSummary(data.summary);
        setCashDeleteReason("");
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao excluir o lancamento de caixa.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function loadCashClosures() {
    await sendReadRequest<CashClosureList>(
      "cash-closures",
      "Carregar historico de fechamento",
      "/api/ops/cash-closures?limit=10&offset=0",
      setCashClosureList,
      "ops.read",
    );
  }

  async function loadCashClosureDetail(closureId: number) {
    await sendReadRequest<CashClosureDetail>(
      `cash-closure-${closureId}`,
      `Carregar fechamento #${closureId}`,
      `/api/ops/cash-closures/${closureId}`,
      setSelectedCashClosure,
      "ops.read",
    );
  }

  async function handleCashClose() {
    if (!ensureSessionPermission("Fechar caixa", "ops.cash")) {
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey("cash-close");
    setResponseTitle("Fechar caixa");

    try {
      const response = await fetch("/api/ops/cash-closures", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          operatorName: cashCloseOperator,
          reason: cashCloseReason,
          ...(actor ? { actor } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        const data = payload.data as {
          closure: CashClosureDetail;
          currentSummary: CashSummary;
        };
        setSelectedCashClosure(data.closure);
        setCashSummary(data.currentSummary);
        setCashCloseReason("");
        await loadCashClosures();
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao fechar o caixa.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleCashAutoClose() {
    if (!ensureSessionPermission("Fechar periodos anteriores", "ops.cash")) {
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey("cash-auto-close");
    setResponseTitle("Fechar periodos anteriores");

    try {
      const response = await fetch("/api/ops/cash-closures/auto-close", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          reason: cashAutoCloseReason,
          ...(actor ? { actor } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        const data = payload.data as {
          currentSummary: CashSummary;
        };
        setCashSummary(data.currentSummary);
        setCashAutoCloseReason("");
        await loadCashClosures();
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao fechar periodos anteriores.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handlePaymentSync() {
    if (
      !ensureSessionPermission(
        "Executar reconciliacao de pagamentos",
        "ops.jobs",
      )
    ) {
      return;
    }

    setPendingKey("payment-sync");
    setResponseTitle("Executar reconciliacao de pagamentos");

    try {
      const response = await fetch("/api/ops/jobs/payment-sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          recentDays: Number(paymentSyncRecentDays),
          cancelAfterDays: Number(paymentSyncCancelAfterDays),
          limit: Number(paymentSyncLimit),
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao executar a reconciliacao de pagamentos.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleDailyJobsRun() {
    if (
      !ensureSessionPermission(
        "Executar rotina diaria operacional",
        "ops.jobs",
      )
    ) {
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey("daily-jobs-run");
    setResponseTitle("Executar rotina diaria operacional");

    try {
      const response = await fetch("/api/ops/jobs/daily-run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          includePaymentSync: true,
          includeCashAutoClose: true,
          includeMembershipMaintenance: true,
          cashAutoCloseReason: dailyJobsCashReason,
          paymentSync: {
            recentDays: Number(paymentSyncRecentDays),
            cancelAfterDays: Number(paymentSyncCancelAfterDays),
            limit: Number(paymentSyncLimit),
          },
          ...(actor ? { actor } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        await loadCashClosures();
        await loadCashSummary();
        await loadJobRuns();
        await loadJobHealth();
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao executar a rotina diaria operacional.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function loadJobRuns() {
    await sendReadRequest<JobRunList>(
      "job-runs",
      "Carregar historico de jobs",
      "/api/ops/jobs/runs?limit=10&offset=0&jobName=daily-run",
      setJobRunList,
      "ops.read",
    );
  }

  async function loadJobHealth() {
    await sendReadRequest<JobHealth>(
      "job-health",
      "Carregar saude do scheduler",
      "/api/ops/jobs/health?jobName=daily-run&triggerSource=scheduled&maxAgeMinutes=1560",
      setJobHealth,
      "ops.read",
    );
  }

  async function loadPhase7Parity() {
    await sendReadRequest<Phase7ParityReport>(
      "phase-7-parity",
      "Carregar matriz de paridade da Fase 7",
      "/api/ops/admin/parity",
      setPhase7Parity,
      "ops.admin",
    );
  }

  async function loadAdminResourceCatalog() {
    await sendReadRequest<AdminResourceDefinition[]>(
      "admin-resource-catalog",
      "Carregar catalogo administrativo",
      "/api/ops/admin/master-data/resources",
      (data) => {
        setAdminResourceCatalog(data);
        if (!selectedAdminResource.trim()) {
          const nextSelected = data[0]?.resource ?? "";
          setSelectedAdminResource(nextSelected);
          const definition =
            data.find((resource) => resource.resource === nextSelected) ?? null;
          resetAdminEditor(definition);
        }
      },
      "ops.admin",
    );
  }

  async function loadAdminResource(resource = selectedAdminResource) {
    if (!resource.trim()) {
      setResponseTitle("Carregar cadastro administrativo");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_admin_resource",
          message: "Selecione um recurso administrativo antes de consultar.",
        },
      });
      return;
    }

    await sendReadRequest<AdminResourceData>(
      "admin-resource-data",
      "Carregar cadastro administrativo",
      `/api/ops/admin/master-data/${encodeURIComponent(resource)}`,
      setAdminResourceData,
      "ops.admin",
    );
  }

  function selectAdminResource(resource: string) {
    setSelectedAdminResource(resource);
    const definition =
      adminResourceCatalog.find((item) => item.resource === resource) ?? null;
    setAdminResourceData(null);
    resetAdminEditor(definition);
  }

  function buildAdminMutationValues(mode: "create" | "update") {
    const definition = selectedAdminResourceDefinition;

    if (!definition) {
      throw new Error("Carregue o catalogo administrativo antes de editar.");
    }

    const values = Object.fromEntries(
      definition.fields.flatMap((field) => {
        if (!field.editable) {
          return [];
        }

        const rawValue = adminFormValues[field.name] ?? "";
        const trimmedValue = rawValue.trim();

        if (
          mode === "update" &&
          trimmedValue === "" &&
          field.type !== "boolean" &&
          !field.writeOnly
        ) {
          return [];
        }

        if (mode === "update" && field.writeOnly && trimmedValue === "") {
          return [];
        }

        return [[field.name, rawValue]];
      }),
    );

    if (Object.keys(values).length === 0) {
      throw new Error("Preencha ao menos um campo para salvar.");
    }

    return values;
  }

  function populateAdminEditorFromItem(item: Record<string, unknown>) {
    const definition = selectedAdminResourceDefinition;

    if (!definition) {
      return;
    }

    const values = Object.fromEntries(
      definition.fields.map((field) => [
        field.name,
        field.writeOnly ? "" : String(item[field.column] ?? ""),
      ]),
    );

    setAdminEditId(String(item[definition.primaryKey] ?? ""));
    setAdminDeleteId(String(item[definition.primaryKey] ?? ""));
    setAdminFormValues(values);
  }

  async function handleAdminResourceSave() {
    if (!ensureSessionPermission("Salvar cadastro administrativo", "ops.admin")) {
      return;
    }

    const definition = selectedAdminResourceDefinition;

    if (!definition) {
      setResponseTitle("Salvar cadastro administrativo");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_admin_resource",
          message: "Carregue o catalogo e escolha um recurso administrativo.",
        },
      });
      return;
    }

    const isUpdate = adminEditId.trim() !== "";

    if ((isUpdate && !canUpdateAdminResource) || (!isUpdate && !canCreateAdminResource)) {
      setResponseTitle("Salvar cadastro administrativo");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "unsupported_admin_action",
          message: isUpdate
            ? "Este recurso administrativo nao permite edicao."
            : "Este recurso administrativo nao permite cadastro.",
        },
      });
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey(isUpdate ? "admin-resource-update" : "admin-resource-create");
    setResponseTitle(
      isUpdate
        ? `Editar ${definition.label}`
        : `Cadastrar ${definition.label}`,
    );

    try {
      const response = await fetch(
        `/api/ops/admin/master-data/${encodeURIComponent(definition.resource)}`,
        {
          method: isUpdate ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(
            actor
              ? {
                  ...(isUpdate
                    ? { id: serializeAdminIdentifier(definition, adminEditId) }
                    : {}),
                  reason: adminSaveReason,
                  values: buildAdminMutationValues(isUpdate ? "update" : "create"),
                  actor,
                }
              : {
                  ...(isUpdate
                    ? { id: serializeAdminIdentifier(definition, adminEditId) }
                    : {}),
                  reason: adminSaveReason,
                  values: buildAdminMutationValues(isUpdate ? "update" : "create"),
                },
          ),
        },
      );
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        await loadAdminResource(definition.resource);
        resetAdminEditor(definition);
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao salvar o cadastro administrativo.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleAdminResourceDelete() {
    if (!ensureSessionPermission("Excluir cadastro administrativo", "ops.admin")) {
      return;
    }

    const definition = selectedAdminResourceDefinition;

    if (!definition || !adminDeleteId.trim()) {
      setResponseTitle("Excluir cadastro administrativo");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_admin_delete_id",
          message: "Informe ou selecione um registro para excluir.",
        },
      });
      return;
    }

    if (!canDeleteAdminResource) {
      setResponseTitle("Excluir cadastro administrativo");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "unsupported_admin_action",
          message: "Este recurso administrativo nao permite exclusao.",
        },
      });
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey("admin-resource-delete");
    setResponseTitle(`Excluir ${definition.label}`);

    try {
      const response = await fetch(
        `/api/ops/admin/master-data/${encodeURIComponent(definition.resource)}`,
        {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(
            actor
              ? {
                  id: serializeAdminIdentifier(definition, adminDeleteId),
                  reason: adminDeleteReason,
                  actor,
                }
              : {
                  id: serializeAdminIdentifier(definition, adminDeleteId),
                  reason: adminDeleteReason,
                },
          ),
        },
      );
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        await loadAdminResource(definition.resource);
        resetAdminEditor(definition);
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao excluir o cadastro administrativo.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function loadAdminParameters() {
    await sendReadRequest<AdminParameterValue[]>(
      "admin-parameters",
      "Carregar parametros administrativos",
      "/api/ops/admin/parameters",
      (data) => {
        setAdminParameters(data);
        setAdminParameterValues(
          Object.fromEntries(
            data.map((item) => [`${item.group}:${item.id}`, item.value]),
          ),
        );
      },
      "ops.admin",
    );
  }

  async function handleAdminParametersSave() {
    if (!ensureSessionPermission("Salvar parametros administrativos", "ops.admin")) {
      return;
    }

    if (!adminParameters?.length) {
      setResponseTitle("Salvar parametros administrativos");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_admin_parameters",
          message: "Carregue os parametros administrativos antes de salvar.",
        },
      });
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey("admin-parameters-save");
    setResponseTitle("Salvar parametros administrativos");

    try {
      const response = await fetch("/api/ops/admin/parameters", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(
          actor
            ? {
                reason: adminParametersReason,
                parameters: adminParameters.map((item) => ({
                  group: item.group,
                  id: item.id,
                  value:
                    adminParameterValues[`${item.group}:${item.id}`] ?? item.value,
                })),
                actor,
              }
            : {
                reason: adminParametersReason,
                parameters: adminParameters.map((item) => ({
                  group: item.group,
                  id: item.id,
                  value:
                    adminParameterValues[`${item.group}:${item.id}`] ?? item.value,
                })),
              },
        ),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        const data = payload.data as {
          parameters: AdminParameterValue[];
        };
        setAdminParameters(data.parameters);
        setAdminParameterValues(
          Object.fromEntries(
            data.parameters.map((item) => [`${item.group}:${item.id}`, item.value]),
          ),
        );
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao salvar os parametros administrativos.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function loadAgreementMembers() {
    if (!ensureSessionPermission("Carregar conveniados", "ops.admin")) {
      return;
    }

    if (!agreementMembersAgreementId.trim()) {
      setResponseTitle("Carregar conveniados");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_agreement_id",
          message: "Informe o convenio antes de consultar os conveniados.",
        },
      });
      return;
    }

    const query = new URLSearchParams();

    if (agreementMembersCpfFilter.trim()) {
      query.set("cpf", agreementMembersCpfFilter.trim());
    }

    if (agreementMembersStatusFilter.trim()) {
      query.set("status", agreementMembersStatusFilter.trim());
    }

    await sendReadRequest<AgreementMemberList>(
      "agreement-members",
      "Carregar conveniados",
      `/api/ops/admin/agreements/${encodeURIComponent(agreementMembersAgreementId.trim())}/members${
        query.size > 0 ? `?${query.toString()}` : ""
      }`,
      setAgreementMembersData,
      "ops.admin",
    );
  }

  async function handleAgreementMemberSave() {
    if (!ensureSessionPermission("Salvar conveniado", "ops.admin")) {
      return;
    }

    if (!agreementMembersAgreementId.trim()) {
      setResponseTitle("Salvar conveniado");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_agreement_id",
          message: "Informe o convenio antes de salvar o conveniado.",
        },
      });
      return;
    }

    const isUpdate = agreementMemberEditCpf.trim() !== "";
    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey(isUpdate ? "agreement-member-update" : "agreement-member-create");
    setResponseTitle(isUpdate ? "Editar conveniado" : "Cadastrar conveniado");

    try {
      const response = await fetch(
        `/api/ops/admin/agreements/${encodeURIComponent(agreementMembersAgreementId.trim())}/members`,
        {
          method: isUpdate ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(
            actor
              ? {
                  ...(isUpdate ? { id: agreementMemberEditCpf.trim() } : {}),
                  reason: agreementMemberReason,
                  values: {
                    cpf: agreementMemberCpf,
                    dailyPurchaseLimit: agreementMemberDailyPurchaseLimit,
                    startDate: agreementMemberStartDate,
                    endDate: agreementMemberEndDate,
                    status: agreementMemberStatus,
                  },
                  actor,
                }
              : {
                  ...(isUpdate ? { id: agreementMemberEditCpf.trim() } : {}),
                  reason: agreementMemberReason,
                  values: {
                    cpf: agreementMemberCpf,
                    dailyPurchaseLimit: agreementMemberDailyPurchaseLimit,
                    startDate: agreementMemberStartDate,
                    endDate: agreementMemberEndDate,
                    status: agreementMemberStatus,
                  },
                },
          ),
        },
      );
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        await loadAgreementMembers();
        resetAgreementMemberEditor();
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao salvar o conveniado.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleAgreementMemberDelete() {
    if (!ensureSessionPermission("Excluir conveniado", "ops.admin")) {
      return;
    }

    if (!agreementMembersAgreementId.trim() || !agreementMemberDeleteCpf.trim()) {
      setResponseTitle("Excluir conveniado");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_agreement_member_delete",
          message: "Informe convenio e CPF antes de excluir o conveniado.",
        },
      });
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey("agreement-member-delete");
    setResponseTitle("Excluir conveniado");

    try {
      const response = await fetch(
        `/api/ops/admin/agreements/${encodeURIComponent(agreementMembersAgreementId.trim())}/members`,
        {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(
            actor
              ? {
                  id: agreementMemberDeleteCpf.trim(),
                  reason: agreementMemberDeleteReason,
                  actor,
                }
              : {
                  id: agreementMemberDeleteCpf.trim(),
                  reason: agreementMemberDeleteReason,
                },
          ),
        },
      );
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        await loadAgreementMembers();
        resetAgreementMemberEditor();
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao excluir o conveniado.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function previewAgreementMemberImport() {
    if (!ensureSessionPermission("Validar importacao de conveniados", "ops.admin")) {
      return;
    }

    if (!agreementMembersAgreementId.trim()) {
      setResponseTitle("Validar importacao de conveniados");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_agreement_id",
          message: "Informe o convenio antes de validar a importacao.",
        },
      });
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey("agreement-member-import-preview");
    setResponseTitle("Validar importacao de conveniados");

    try {
      const response = await fetch(
        `/api/ops/admin/agreements/${encodeURIComponent(agreementMembersAgreementId.trim())}/imports/preview`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(
            actor
              ? {
                  csvText: agreementMemberImportCsv,
                  reason: agreementMemberImportReason,
                  actor,
                }
              : {
                  csvText: agreementMemberImportCsv,
                  reason: agreementMemberImportReason,
                },
          ),
        },
      );
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        setAgreementMemberImportPreview(
          payload.data as AgreementMemberImportPreview,
        );
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao validar a importacao.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function applyAgreementMemberImport() {
    if (!ensureSessionPermission("Aplicar importacao de conveniados", "ops.admin")) {
      return;
    }

    if (!agreementMembersAgreementId.trim()) {
      setResponseTitle("Aplicar importacao de conveniados");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_agreement_id",
          message: "Informe o convenio antes de aplicar a importacao.",
        },
      });
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey("agreement-member-import-apply");
    setResponseTitle("Aplicar importacao de conveniados");

    try {
      const response = await fetch(
        `/api/ops/admin/agreements/${encodeURIComponent(agreementMembersAgreementId.trim())}/imports/apply`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(
            actor
              ? {
                  csvText: agreementMemberImportCsv,
                  reason: agreementMemberImportReason,
                  actor,
                }
              : {
                  csvText: agreementMemberImportCsv,
                  reason: agreementMemberImportReason,
                },
          ),
        },
      );
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        await loadAgreementMembers();
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao aplicar a importacao.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function loadAgreementPurchaseReport() {
    if (!ensureSessionPermission("Carregar relatorio de compras por convenio", "ops.admin")) {
      return;
    }

    const query = new URLSearchParams();

    if (agreementPurchaseReportAgreementName.trim()) {
      query.set("agreementName", agreementPurchaseReportAgreementName.trim());
    }

    if (agreementPurchaseReportVisitDateFrom.trim()) {
      query.set("visitDateFrom", agreementPurchaseReportVisitDateFrom.trim());
    }

    if (agreementPurchaseReportVisitDateTo.trim()) {
      query.set("visitDateTo", agreementPurchaseReportVisitDateTo.trim());
    }

    if (agreementPurchaseReportVoucherType.trim()) {
      query.set("voucherType", agreementPurchaseReportVoucherType.trim());
    }

    if (agreementPurchaseReportPurchaseStatus.trim()) {
      query.set("purchaseStatus", agreementPurchaseReportPurchaseStatus.trim());
    }

    await sendReadRequest<AgreementPurchaseReport>(
      "agreement-purchases-report",
      "Carregar relatorio de compras por convenio",
      `/api/ops/admin/reports/agreement-purchases${
        query.size > 0 ? `?${query.toString()}` : ""
      }`,
      setAgreementPurchaseReport,
      "ops.admin",
    );
  }

  async function loadClientTypes() {
    await sendReadRequest<ClientTypeOption[]>(
      "client-types",
      "Carregar tipos de cliente",
      "/api/ops/admin/client-types",
      setClientTypeOptions,
      "ops.admin",
    );
  }

  async function searchClients() {
    if (!ensureSessionPermission("Pesquisar clientes", "ops.admin")) {
      return;
    }

    if (clientSearchQuery.trim().length < 2) {
      setResponseTitle("Pesquisar clientes");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_client_search_query",
          message: "Informe ao menos 2 caracteres para pesquisar clientes.",
        },
      });
      return;
    }

    await sendReadRequest<ClientAutocompleteItem[]>(
      "client-search",
      "Pesquisar clientes",
      `/api/ops/admin/clients/autocomplete?q=${encodeURIComponent(
        clientSearchQuery.trim(),
      )}&limit=10`,
      setClientSearchResults,
      "ops.admin",
    );
  }

  async function loadClientEducation(clientId = selectedClientId) {
    if (!clientId.trim()) {
      setResponseTitle("Carregar estrutura de cliente");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_client_id",
          message: "Selecione um cliente antes de carregar a estrutura.",
        },
      });
      return;
    }

    await sendReadRequest<ClientEducationSummary>(
      "client-education",
      "Carregar estrutura de cliente",
      `/api/ops/admin/clients/${encodeURIComponent(clientId.trim())}/classes`,
      (data) => {
        setClientEducationSummary(data);
        setSelectedClientId(String(data.client.id));
        setClientPeriodClassId((current) => {
          if (
            current.trim() &&
            data.classes.some((item) => String(item.id) === current.trim())
          ) {
            return current;
          }

          return data.classes[0] ? String(data.classes[0].id) : "";
        });
      },
      "ops.admin",
    );
  }

  async function handleClientStatusToggle() {
    if (!ensureSessionPermission("Alternar status do cliente", "ops.admin")) {
      return;
    }

    if (!selectedClientId.trim()) {
      setResponseTitle("Alternar status do cliente");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_client_id",
          message: "Selecione um cliente antes de alterar o status.",
        },
      });
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey("client-status-toggle");
    setResponseTitle("Alternar status do cliente");

    try {
      const response = await fetch(
        `/api/ops/admin/clients/${encodeURIComponent(selectedClientId.trim())}/status`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(
            actor
              ? {
                  reason: clientStatusReason,
                  actor,
                }
              : {
                  reason: clientStatusReason,
                },
          ),
        },
      );
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        setClientStatusReason("");
        await loadClientEducation(selectedClientId);
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao alternar o status do cliente.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleClientClassSave() {
    if (!ensureSessionPermission("Salvar turma do cliente", "ops.admin")) {
      return;
    }

    if (!selectedClientId.trim()) {
      setResponseTitle("Salvar turma do cliente");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_client_id",
          message: "Selecione um cliente antes de salvar a turma.",
        },
      });
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;
    const isUpdate = clientClassEditId.trim() !== "";

    setPendingKey(isUpdate ? "client-class-update" : "client-class-create");
    setResponseTitle(isUpdate ? "Editar turma do cliente" : "Cadastrar turma do cliente");

    try {
      const response = await fetch(
        `/api/ops/admin/clients/${encodeURIComponent(selectedClientId.trim())}/classes`,
        {
          method: isUpdate ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(
            actor
              ? {
                  ...(isUpdate ? { id: Number(clientClassEditId) } : {}),
                  reason: clientClassReason,
                  values: {
                    name: clientClassName,
                    order: Number(clientClassOrder),
                    status: clientClassStatus,
                    defaultPeriods: clientClassDefaultPeriods,
                  },
                  actor,
                }
              : {
                  ...(isUpdate ? { id: Number(clientClassEditId) } : {}),
                  reason: clientClassReason,
                  values: {
                    name: clientClassName,
                    order: Number(clientClassOrder),
                    status: clientClassStatus,
                    defaultPeriods: clientClassDefaultPeriods,
                  },
                },
          ),
        },
      );
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        resetClientClassEditor();
        await loadClientEducation(selectedClientId);
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao salvar a turma do cliente.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleClientClassDelete() {
    if (!ensureSessionPermission("Excluir turma do cliente", "ops.admin")) {
      return;
    }

    if (!selectedClientId.trim() || !clientClassDeleteId.trim()) {
      setResponseTitle("Excluir turma do cliente");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_client_class_id",
          message: "Selecione uma turma antes de excluir.",
        },
      });
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey("client-class-delete");
    setResponseTitle("Excluir turma do cliente");

    try {
      const response = await fetch(
        `/api/ops/admin/clients/${encodeURIComponent(selectedClientId.trim())}/classes`,
        {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(
            actor
              ? {
                  id: Number(clientClassDeleteId),
                  reason: clientClassDeleteReason,
                  actor,
                }
              : {
                  id: Number(clientClassDeleteId),
                  reason: clientClassDeleteReason,
                },
          ),
        },
      );
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        resetClientClassEditor();
        await loadClientEducation(selectedClientId);
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao excluir a turma do cliente.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleClientPeriodSave() {
    if (!ensureSessionPermission("Salvar periodo da turma", "ops.admin")) {
      return;
    }

    if (!selectedClientId.trim() || !clientPeriodClassId.trim()) {
      setResponseTitle("Salvar periodo da turma");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_client_period_context",
          message: "Selecione um cliente e uma turma antes de salvar o periodo.",
        },
      });
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;
    const isUpdate = clientPeriodEditId.trim() !== "";

    setPendingKey(isUpdate ? "client-period-update" : "client-period-create");
    setResponseTitle(isUpdate ? "Editar periodo da turma" : "Cadastrar periodo da turma");

    try {
      const response = await fetch(
        `/api/ops/admin/clients/${encodeURIComponent(
          selectedClientId.trim(),
        )}/classes/${encodeURIComponent(clientPeriodClassId.trim())}/periods`,
        {
          method: isUpdate ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(
            actor
              ? {
                  ...(isUpdate ? { id: Number(clientPeriodEditId) } : {}),
                  reason: clientPeriodReason,
                  values: {
                    name: clientPeriodName,
                    order: Number(clientPeriodOrder),
                    status: clientPeriodStatus,
                  },
                  actor,
                }
              : {
                  ...(isUpdate ? { id: Number(clientPeriodEditId) } : {}),
                  reason: clientPeriodReason,
                  values: {
                    name: clientPeriodName,
                    order: Number(clientPeriodOrder),
                    status: clientPeriodStatus,
                  },
                },
          ),
        },
      );
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        resetClientPeriodEditor();
        await loadClientEducation(selectedClientId);
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao salvar o periodo da turma.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleClientPeriodDelete() {
    if (!ensureSessionPermission("Excluir periodo da turma", "ops.admin")) {
      return;
    }

    if (
      !selectedClientId.trim() ||
      !clientPeriodClassId.trim() ||
      !clientPeriodDeleteId.trim()
    ) {
      setResponseTitle("Excluir periodo da turma");
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "missing_client_period_id",
          message: "Selecione um periodo antes de excluir.",
        },
      });
      return;
    }

    const actor =
      actorName.trim() || actorCpf.trim()
        ? {
            name: actorName.trim() || undefined,
            cpf: actorCpf.trim() || undefined,
          }
        : undefined;

    setPendingKey("client-period-delete");
    setResponseTitle("Excluir periodo da turma");

    try {
      const response = await fetch(
        `/api/ops/admin/clients/${encodeURIComponent(
          selectedClientId.trim(),
        )}/classes/${encodeURIComponent(clientPeriodClassId.trim())}/periods`,
        {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(
            actor
              ? {
                  id: Number(clientPeriodDeleteId),
                  reason: clientPeriodDeleteReason,
                  actor,
                }
              : {
                  id: Number(clientPeriodDeleteId),
                  reason: clientPeriodDeleteReason,
                },
          ),
        },
      );
      const payload = (await response.json().catch(() => null)) as ApiPayload;

      setResponseStatus(response.status);
      setResponseBody(payload);

      if (response.ok && isApiSuccess(payload)) {
        resetClientPeriodEditor();
        await loadClientEducation(selectedClientId);
      }
    } catch (error) {
      setResponseStatus(0);
      setResponseBody({
        ok: false,
        error: {
          code: "network_error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao excluir o periodo da turma.",
        },
      });
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <section
      className={
        embedded
          ? "text-left"
          : "relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(36,107,153,0.18),_transparent_38%),linear-gradient(180deg,#fbfaf8_0%,#efe8df_100%)] px-4 py-10 text-left md:px-8 lg:px-12"
      }
    >
      <div className={embedded ? "w-full" : "mx-auto max-w-[1380px]"}>
        <div
          className={
            embedded
              ? "relative"
              : "relative overflow-hidden rounded-[34px] border border-white/70 bg-white/88 p-6 shadow-[0_24px_80px_rgba(31,67,98,0.16)] backdrop-blur md:p-8"
          }
        >
          {embedded ? null : (
            <>
              <div className="absolute right-[-40px] top-[-40px] h-36 w-36 rounded-full bg-[radial-gradient(circle,_rgba(52,152,219,0.28),_transparent_72%)]" />
              <div className="absolute bottom-[-50px] left-[-20px] h-40 w-40 rounded-full bg-[radial-gradient(circle,_rgba(31,138,112,0.16),_transparent_72%)]" />
            </>
          )}

          <div className="relative z-[1] flex flex-col gap-6">
            {embedded ? null : (
              <div className="flex flex-col gap-4 border-b border-[#d8e4ec] pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-[760px]">
                <span className="inline-flex rounded-full bg-[#e7f1f8] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#246b99]">
                  Console Operacional
                </span>
                <h1 className="mt-4 legacy-condensed text-5xl leading-none text-[#1f4a68] md:text-6xl">
                  Operacoes do BFF de migracao
                </h1>
                <p className="mt-4 max-w-[64ch] text-[15px] leading-7 text-[#6f6558]">
                  Esta tela usa os endpoints operacionais do `apps/web` para
                  validar vouchers, cancelar compra e editar venda sem depender
                  do painel Zend. A UI agora abre uma sessao operacional
                  dedicada via cookie HTTP-only antes de liberar os comandos.
                </p>
              </div>

              <div className="grid gap-3 rounded-[26px] border border-[#d7e5ef] bg-[#f7fbfe] p-4 md:grid-cols-4">
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                  {opsSession?.authenticated ? "Sessao operacional" : "Token operacional"}
                  <input
                    value={opsSession?.authenticated ? "Sessao ativa" : tokenInput}
                    onChange={(event) => setTokenInput(event.target.value)}
                    type={opsSession?.authenticated ? "text" : "password"}
                    placeholder={
                      opsSession?.authenticated
                        ? "Sessao operacional ativa"
                        : "INGRESSO_OPERATIONS_API_TOKEN"
                    }
                    disabled={opsSession?.authenticated}
                    className="rounded-2xl border border-[#c7d6e2] bg-white px-4 py-3 text-sm font-normal text-[#3a342d] outline-none ring-0 placeholder:text-[#9aa8b2]"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                  Operador
                  <input
                    value={actorName}
                    onChange={(event) => setActorName(event.target.value)}
                    placeholder="Nome do gestor"
                    className="rounded-2xl border border-[#c7d6e2] bg-white px-4 py-3 text-sm font-normal text-[#3a342d] outline-none ring-0 placeholder:text-[#9aa8b2]"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                  CPF do operador
                  <input
                    value={actorCpf}
                    onChange={(event) => setActorCpf(event.target.value)}
                    placeholder="52998224725"
                    className="rounded-2xl border border-[#c7d6e2] bg-white px-4 py-3 text-sm font-normal text-[#3a342d] outline-none ring-0 placeholder:text-[#9aa8b2]"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={
                      opsSession?.authenticated
                        ? handleSessionLogout
                        : handleSessionLogin
                    }
                    disabled={
                      pendingKey === "ops-session-login" ||
                      pendingKey === "ops-session-logout" ||
                      !sessionReady
                    }
                    className="min-h-[48px] w-full rounded-2xl bg-[#246b99] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {!sessionReady
                      ? "Validando..."
                      : opsSession?.authenticated
                        ? pendingKey === "ops-session-logout"
                          ? "Saindo..."
                          : "Encerrar sessao"
                        : pendingKey === "ops-session-login"
                          ? "Entrando..."
                          : "Entrar"}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#5d7282]">
                <span className="rounded-full border border-[#d7e5ef] bg-white px-3 py-1">
                  papel {opsSession?.role ?? "sem sessao"}
                </span>
                <span className="rounded-full border border-[#d7e5ef] bg-white px-3 py-1 normal-case tracking-normal">
                  permissoes: {(opsSession?.permissions ?? []).join(", ") || "nenhuma"}
                </span>
              </div>
            </div>
            )}

            {isVisible("phase7") ? (
              <article className="rounded-[28px] border border-[#d7e5ef] bg-[#f8fcff] p-5 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="legacy-condensed text-3xl text-[#205a7f]">
                    Fase 7
                  </h2>
                  <p className="mt-2 max-w-[82ch] text-sm leading-6 text-[#6b6a67]">
                    Matriz administrativa de paridade entre o painel Zend e os
                    endpoints Next. O corte de escrita so fica liberado quando
                    nao houver actions pendentes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadPhase7Parity()}
                  disabled={pendingKey !== null || !hasSessionPermission("ops.admin")}
                  className="min-h-[44px] rounded-2xl bg-[#246b99] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pendingKey === "phase-7-parity"
                    ? "Carregando..."
                    : "Carregar matriz"}
                </button>
              </div>

              {phase7Parity ? (
                <div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
                    <div className="rounded-[20px] border border-[#d9e7f1] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6f8798]">
                        conclusao
                      </p>
                      <strong className="mt-2 block text-3xl text-[#205a7f]">
                        {phase7Parity.summary.completionPercent}%
                      </strong>
                    </div>
                    <div className="rounded-[20px] border border-[#d9e7f1] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6f8798]">
                        pendentes
                      </p>
                      <strong className="mt-2 block text-3xl text-[#8f3f31]">
                        {phase7Parity.summary.pending}
                      </strong>
                    </div>
                    <div className="rounded-[20px] border border-[#d9e7f1] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6f8798]">
                        fechadas
                      </p>
                      <strong className="mt-2 block text-3xl text-[#2f6f5d]">
                        {phase7Parity.summary.implemented +
                          phase7Parity.summary.validated +
                          phase7Parity.summary.deprecated}
                      </strong>
                    </div>
                    <div className="rounded-[20px] border border-[#d9e7f1] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6f8798]">
                        corte
                      </p>
                      <strong className="mt-2 block text-xl text-[#205a7f]">
                        {phase7Parity.summary.writeCutoverReady
                          ? "liberado"
                          : "bloqueado"}
                      </strong>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-[#d9e7f1] bg-white p-4">
                    <p className="text-sm font-semibold text-[#35576f]">
                      Proximos bloqueios
                    </p>
                    <div className="mt-3 grid gap-2">
                      {phase7Parity.blockers.slice(0, 6).map((action) => (
                        <div
                          key={`${action.legacyController}-${action.legacyAction}-${action.capability}`}
                          className="rounded-2xl bg-[#f5f9fc] px-3 py-2 text-sm text-[#3a342d]"
                        >
                          <strong className="text-[#205a7f]">
                            {action.legacyController}
                          </strong>{" "}
                          {action.legacyAction} - {action.capability}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
            ) : null}

            {isVisible("admin") ? (
              <article className="rounded-[28px] border border-[#d7e5ef] bg-[#f7fbfe] p-5 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="legacy-condensed text-3xl text-[#205a7f]">
                    Painel Administrativo
                  </h2>
                  <p className="mt-2 max-w-[82ch] text-sm leading-6 text-[#6b6a67]">
                    Superficie inicial da Fase 7. Aqui o `admin` consegue operar
                    os cadastros ja expostos no BFF e editar os parametros
                    `msgper` sem abrir o Zend.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void loadAdminResourceCatalog()}
                    disabled={
                      pendingKey !== null || !hasSessionPermission("ops.admin")
                    }
                    className="rounded-full bg-[#246b99] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pendingKey === "admin-resource-catalog"
                      ? "Carregando catalogo..."
                      : "Carregar catalogo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadAdminParameters()}
                    disabled={
                      pendingKey !== null || !hasSessionPermission("ops.admin")
                    }
                    className="rounded-full bg-[#1f8a70] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pendingKey === "admin-parameters"
                      ? "Carregando parametros..."
                      : "Carregar parametros"}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="grid gap-4 rounded-[22px] border border-[#d9e7f1] bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                      Recurso administrativo
                      <select
                        value={selectedAdminResource}
                        onChange={(event) =>
                          selectAdminResource(event.target.value)
                        }
                        className="rounded-2xl border border-[#c7d6e2] bg-white px-4 py-3 text-sm text-[#3a342d]"
                      >
                        <option value="">Selecione</option>
                        {adminResourceCatalog.map((resource) => (
                          <option key={resource.resource} value={resource.resource}>
                            {resource.label} ({resource.resource})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => void loadAdminResource()}
                      disabled={
                        pendingKey !== null ||
                        !hasSessionPermission("ops.admin") ||
                        !selectedAdminResource.trim()
                      }
                      className="rounded-full bg-[#35576f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {pendingKey === "admin-resource-data"
                        ? "Carregando..."
                        : "Consultar recurso"}
                    </button>
                  </div>

                  {selectedAdminResourceDefinition ? (
                    <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                      <div className="grid gap-3">
                        <div className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] p-3 text-xs leading-5 text-[#5d7282]">
                          <div className="font-semibold text-[#35576f]">
                            {selectedAdminResourceDefinition.label}
                          </div>
                          <div>
                            chave primaria: {selectedAdminResourceDefinition.primaryKey} (
                            {selectedAdminResourceDefinition.primaryKeyType === "text"
                              ? "texto"
                              : "numerica"}
                            )
                          </div>
                          <div>
                            campos:{" "}
                            {selectedAdminResourceDefinition.fields
                              .map((field) => field.name)
                              .join(", ")}
                          </div>
                          <div>
                            acoes:{" "}
                            {selectedAdminResourceDefinition.supportedActions.join(", ")}
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                            {selectedAdminResourceDefinition.primaryKeyType === "text"
                              ? "Chave para editar"
                              : "ID para editar"}
                            <input
                              value={adminEditId}
                              onChange={(event) =>
                                setAdminEditId(event.target.value)
                              }
                              placeholder={
                                canCreateAdminResource
                                  ? "vazio para novo"
                                  : "selecione um registro"
                              }
                              className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                            Motivo da alteracao
                            <input
                              value={adminSaveReason}
                              onChange={(event) =>
                                setAdminSaveReason(event.target.value)
                              }
                              placeholder="Migracao do painel"
                              className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                            />
                          </label>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          {selectedAdminResourceDefinition.fields.map((field) => (
                            <label
                              key={field.name}
                              className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]"
                            >
                              {field.name}
                              {field.allowed ? (
                                <select
                                  value={adminFormValues[field.name] ?? ""}
                                  onChange={(event) =>
                                    setAdminFormValues((current) => ({
                                      ...current,
                                      [field.name]: event.target.value,
                                    }))
                                  }
                                  disabled={!field.editable || pendingKey !== null}
                                  className="rounded-2xl border border-[#c7d6e2] bg-white px-4 py-3 text-sm text-[#3a342d]"
                                >
                                  {!field.required ? (
                                    <option value="">Sem alteracao</option>
                                  ) : null}
                                  {field.allowed.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              ) : field.type === "text" &&
                                (field.name.includes("text") ||
                                  field.name.includes("description")) ? (
                                <textarea
                                  value={adminFormValues[field.name] ?? ""}
                                  onChange={(event) =>
                                    setAdminFormValues((current) => ({
                                      ...current,
                                      [field.name]: event.target.value,
                                    }))
                                  }
                                  rows={4}
                                  disabled={!field.editable || pendingKey !== null}
                                  className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                                />
                              ) : (
                                <input
                                  type={
                                    field.type === "date"
                                      ? "date"
                                      : field.type === "email"
                                        ? "email"
                                        : field.type === "password"
                                          ? "password"
                                          : "text"
                                  }
                                  value={adminFormValues[field.name] ?? ""}
                                  onChange={(event) =>
                                    setAdminFormValues((current) => ({
                                      ...current,
                                      [field.name]: event.target.value,
                                    }))
                                  }
                                  disabled={!field.editable || pendingKey !== null}
                                  placeholder={field.required ? "obrigatorio" : "opcional"}
                                  className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                                />
                              )}
                            </label>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleAdminResourceSave()}
                            disabled={
                              pendingKey !== null ||
                              !hasSessionPermission("ops.admin") ||
                              (!adminEditId.trim()
                                ? !canCreateAdminResource
                                : !canUpdateAdminResource)
                            }
                            className="rounded-full bg-[#1f8a70] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {pendingKey === "admin-resource-create" ||
                            pendingKey === "admin-resource-update"
                              ? "Salvando..."
                              : adminEditId.trim()
                                ? "Salvar edicao"
                                : canCreateAdminResource
                                  ? "Cadastrar"
                                  : "Edicao apenas"}
                          </button>
                          <button
                            type="button"
                            onClick={() => resetAdminEditor()}
                            disabled={pendingKey !== null}
                            className="rounded-full bg-[#e8f1f7] px-5 py-3 text-sm font-semibold text-[#35576f] disabled:opacity-60"
                          >
                            Limpar formulario
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        <div className="rounded-2xl border border-[#ead0d0] bg-[#fffafa] p-4">
                          <div className="font-semibold text-[#8a3f3f]">
                            Excluir registro
                          </div>
                          <div className="mt-3 grid gap-3">
                            <label className="flex flex-col gap-2 text-sm font-semibold text-[#7b4848]">
                              {selectedAdminResourceDefinition.primaryKeyType === "text"
                                ? "Chave para excluir"
                                : "ID para excluir"}
                              <input
                                value={adminDeleteId}
                                onChange={(event) =>
                                  setAdminDeleteId(event.target.value)
                                }
                                placeholder={selectedAdminResourceDefinition.primaryKey}
                                className="rounded-2xl border border-[#e0bcbc] px-4 py-3 text-sm text-[#3a342d]"
                              />
                            </label>
                            <label className="flex flex-col gap-2 text-sm font-semibold text-[#7b4848]">
                              Motivo
                              <input
                                value={adminDeleteReason}
                                onChange={(event) =>
                                  setAdminDeleteReason(event.target.value)
                                }
                                placeholder="Cadastro duplicado"
                                className="rounded-2xl border border-[#e0bcbc] px-4 py-3 text-sm text-[#3a342d]"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => void handleAdminResourceDelete()}
                              disabled={
                                pendingKey !== null ||
                                !hasSessionPermission("ops.admin") ||
                                !canDeleteAdminResource
                              }
                              className="rounded-full bg-[#8a3f3f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              {pendingKey === "admin-resource-delete"
                                ? "Excluindo..."
                                : canDeleteAdminResource
                                  ? "Excluir registro"
                                  : "Exclusao indisponivel"}
                            </button>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] p-4 text-xs leading-5 text-[#5d7282]">
                          <div className="font-semibold text-[#35576f]">
                            Itens carregados
                          </div>
                          <div className="mt-2">
                            {(adminResourceData?.items.length ?? 0)} registro(s)
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] p-4 text-sm text-[#5d7282]">
                      Carregue o catalogo administrativo para abrir o editor.
                    </div>
                  )}

                  {adminResourceData ? (
                    <div className="grid gap-3">
                      <div className="font-semibold text-[#35576f]">
                        Registros carregados
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {adminResourceData.items.slice(0, 8).map((item, index) => (
                          <div
                            key={`${String(item[adminResourceData.primaryKey] ?? "item")}-${index}`}
                            className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] p-4 text-sm text-[#3a342d]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-[#205a7f]">
                                  #{String(item[adminResourceData.primaryKey] ?? "-")}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-[#5d7282]">
                                  {selectedAdminResourceDefinition?.fields
                                    .slice(0, 4)
                                    .map((field) =>
                                      `${field.name}: ${formatAdminValue(item[field.column])}`,
                                    )
                                    .join(" · ")}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => populateAdminEditorFromItem(item)}
                                disabled={pendingKey !== null}
                                className="rounded-full bg-[#246b99] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                Editar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 rounded-[22px] border border-[#ecdcc8] bg-[#fffaf5] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[#7b5f3b]">
                        Parametros `msgper`
                      </div>
                      <div className="mt-1 text-xs leading-5 text-[#8c7357]">
                        Mensagens herdadas do Zend para validacao de codigo de
                        indicacao.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadAdminParameters()}
                      disabled={
                        pendingKey !== null || !hasSessionPermission("ops.admin")
                      }
                      className="rounded-full bg-[#7b5f3b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {pendingKey === "admin-parameters"
                        ? "Carregando..."
                        : "Atualizar"}
                    </button>
                  </div>

                  {adminParameters ? (
                    <div className="grid gap-3">
                      {adminParameters.map((item) => {
                        const key = `${item.group}:${item.id}`;

                        return (
                          <label
                            key={key}
                            className="grid gap-2 rounded-2xl border border-[#ecdcc8] bg-white p-3 text-sm font-semibold text-[#6f5535]"
                          >
                            {item.label} ({item.id})
                            <textarea
                              value={adminParameterValues[key] ?? item.value}
                              onChange={(event) =>
                                setAdminParameterValues((current) => ({
                                  ...current,
                                  [key]: event.target.value,
                                }))
                              }
                              rows={4}
                              className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm font-normal text-[#3a342d]"
                            />
                            <span className="text-xs font-normal leading-5 text-[#8c7357]">
                              {item.description} ·{" "}
                              {item.persisted ? "persistido" : "usando default"}
                            </span>
                          </label>
                        );
                      })}

                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                        Motivo da alteracao
                        <input
                          value={adminParametersReason}
                          onChange={(event) =>
                            setAdminParametersReason(event.target.value)
                          }
                          placeholder="Ajuste das mensagens do painel"
                          className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => void handleAdminParametersSave()}
                        disabled={
                          pendingKey !== null || !hasSessionPermission("ops.admin")
                        }
                        className="rounded-full bg-[#7b5f3b] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "admin-parameters-save"
                          ? "Salvando..."
                          : "Salvar parametros"}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#ecdcc8] bg-white p-4 text-sm text-[#8c7357]">
                      Carregue os parametros para abrir o editor.
                    </div>
                  )}
                </div>
              </div>
            </article>
            ) : null}

            {isVisible("agreements") ? (
              <article className="rounded-[28px] border border-[#d7e5ef] bg-[#f7fbfe] p-5 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="legacy-condensed text-3xl text-[#205a7f]">
                    Conveniados E Compras Convenio
                  </h2>
                  <p className="mt-2 max-w-[82ch] text-sm leading-6 text-[#6b6a67]">
                    CRUD de conveniados por convenio, importacao CSV stateless
                    com validacao e consolidado de compras por convenio em uma
                    superficie interna do BFF.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="grid gap-4 rounded-[22px] border border-[#d9e7f1] bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                      Convenio
                      <input
                        value={agreementMembersAgreementId}
                        onChange={(event) =>
                          setAgreementMembersAgreementId(event.target.value)
                        }
                        placeholder="idconvenio"
                        className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                      Filtro CPF
                      <input
                        value={agreementMembersCpfFilter}
                        onChange={(event) =>
                          setAgreementMembersCpfFilter(event.target.value)
                        }
                        placeholder="52998224725"
                        className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                      Status
                      <select
                        value={agreementMembersStatusFilter}
                        onChange={(event) =>
                          setAgreementMembersStatusFilter(event.target.value)
                        }
                        className="rounded-2xl border border-[#c7d6e2] bg-white px-4 py-3 text-sm text-[#3a342d]"
                      >
                        <option value="">Todos</option>
                        <option value="ati">ati</option>
                        <option value="ina">ina</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void loadAgreementMembers()}
                      disabled={pendingKey !== null || !hasSessionPermission("ops.admin")}
                      className="rounded-full bg-[#246b99] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {pendingKey === "agreement-members"
                        ? "Carregando..."
                        : "Carregar conveniados"}
                    </button>
                    <button
                      type="button"
                      onClick={() => resetAgreementMemberEditor()}
                      disabled={pendingKey !== null}
                      className="rounded-full bg-[#e8f1f7] px-4 py-3 text-sm font-semibold text-[#35576f] disabled:opacity-60"
                    >
                      Limpar editor
                    </button>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                    <div className="grid gap-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                          CPF do conveniado
                          <input
                            value={agreementMemberCpf}
                            onChange={(event) =>
                              setAgreementMemberCpf(event.target.value)
                            }
                            placeholder="52998224725"
                            className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                          Editando CPF
                          <input
                            value={agreementMemberEditCpf}
                            onChange={(event) =>
                              setAgreementMemberEditCpf(event.target.value)
                            }
                            placeholder="vazio para novo"
                            className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                          Qtd. compra por dia
                          <input
                            value={agreementMemberDailyPurchaseLimit}
                            onChange={(event) =>
                              setAgreementMemberDailyPurchaseLimit(event.target.value)
                            }
                            className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                          Status
                          <select
                            value={agreementMemberStatus}
                            onChange={(event) =>
                              setAgreementMemberStatus(event.target.value)
                            }
                            className="rounded-2xl border border-[#c7d6e2] bg-white px-4 py-3 text-sm text-[#3a342d]"
                          >
                            <option value="ati">ati</option>
                            <option value="ina">ina</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                          Data inicio
                          <input
                            type="date"
                            value={agreementMemberStartDate}
                            onChange={(event) =>
                              setAgreementMemberStartDate(event.target.value)
                            }
                            className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                          Data fim
                          <input
                            type="date"
                            value={agreementMemberEndDate}
                            onChange={(event) =>
                              setAgreementMemberEndDate(event.target.value)
                            }
                            className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                      </div>

                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                        Motivo da alteracao
                        <input
                          value={agreementMemberReason}
                          onChange={(event) =>
                            setAgreementMemberReason(event.target.value)
                          }
                          placeholder="Migracao do painel"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => void handleAgreementMemberSave()}
                        disabled={pendingKey !== null || !hasSessionPermission("ops.admin")}
                        className="rounded-full bg-[#1f8a70] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "agreement-member-create" ||
                        pendingKey === "agreement-member-update"
                          ? "Salvando..."
                          : agreementMemberEditCpf.trim()
                            ? "Salvar edicao"
                            : "Cadastrar conveniado"}
                      </button>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-2xl border border-[#ead0d0] bg-[#fffafa] p-4">
                        <div className="font-semibold text-[#8a3f3f]">
                          Excluir conveniado
                        </div>
                        <div className="mt-3 grid gap-3">
                          <label className="flex flex-col gap-2 text-sm font-semibold text-[#7b4848]">
                            CPF
                            <input
                              value={agreementMemberDeleteCpf}
                              onChange={(event) =>
                                setAgreementMemberDeleteCpf(event.target.value)
                              }
                              className="rounded-2xl border border-[#e0bcbc] px-4 py-3 text-sm text-[#3a342d]"
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm font-semibold text-[#7b4848]">
                            Motivo
                            <input
                              value={agreementMemberDeleteReason}
                              onChange={(event) =>
                                setAgreementMemberDeleteReason(event.target.value)
                              }
                              className="rounded-2xl border border-[#e0bcbc] px-4 py-3 text-sm text-[#3a342d]"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => void handleAgreementMemberDelete()}
                            disabled={pendingKey !== null || !hasSessionPermission("ops.admin")}
                            className="rounded-full bg-[#8a3f3f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {pendingKey === "agreement-member-delete"
                              ? "Excluindo..."
                              : "Excluir conveniado"}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] p-4 text-xs leading-5 text-[#5d7282]">
                        <div className="font-semibold text-[#35576f]">
                          Itens carregados
                        </div>
                        <div className="mt-2">
                          {(agreementMembersData?.items.length ?? 0)} registro(s)
                        </div>
                        <div>
                          convenio: {agreementMembersData?.agreementName ?? "-"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {agreementMembersData ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {agreementMembersData.items.slice(0, 8).map((item) => (
                        <div
                          key={item.cpf}
                          className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] p-4 text-sm text-[#3a342d]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-[#205a7f]">
                                {item.cpf}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-[#5d7282]">
                                {item.userName || "Sem usuario"} · qtd/dia{" "}
                                {item.dailyPurchaseLimit} · {item.status || "-"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => populateAgreementMemberEditor(item)}
                              disabled={pendingKey !== null}
                              className="rounded-full bg-[#246b99] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              Editar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-3 rounded-[22px] border border-[#ecdcc8] bg-[#fffaf5] p-4">
                    <div className="font-semibold text-[#7b5f3b]">
                      Importacao CSV
                    </div>
                    <textarea
                      value={agreementMemberImportCsv}
                      onChange={(event) =>
                        setAgreementMemberImportCsv(event.target.value)
                      }
                      rows={8}
                      className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                    />
                    <input
                      value={agreementMemberImportReason}
                      onChange={(event) =>
                        setAgreementMemberImportReason(event.target.value)
                      }
                      className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void previewAgreementMemberImport()}
                        disabled={pendingKey !== null || !hasSessionPermission("ops.admin")}
                        className="rounded-full bg-[#7b5f3b] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "agreement-member-import-preview"
                          ? "Validando..."
                          : "Validar CSV"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void applyAgreementMemberImport()}
                        disabled={pendingKey !== null || !hasSessionPermission("ops.admin")}
                        className="rounded-full bg-[#1f8a70] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "agreement-member-import-apply"
                          ? "Importando..."
                          : "Aplicar importacao"}
                      </button>
                    </div>

                    {agreementMemberImportPreview ? (
                      <div className="rounded-2xl border border-[#ecdcc8] bg-white p-3 text-xs leading-5 text-[#6f5535]">
                        <div>
                          {agreementMemberImportPreview.validRows} validos /{" "}
                          {agreementMemberImportPreview.invalidRows} invalidos
                        </div>
                        {agreementMemberImportPreview.log ? (
                          <pre className="mt-2 overflow-auto whitespace-pre-wrap text-[11px]">
                            {agreementMemberImportPreview.log}
                          </pre>
                        ) : (
                          <div className="mt-2">Nenhum erro de importacao.</div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 rounded-[22px] border border-[#d9e7f1] bg-white p-4">
                    <div className="font-semibold text-[#35576f]">
                      Compras por convenio
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                        Convenio ou SITE
                        <input
                          value={agreementPurchaseReportAgreementName}
                          onChange={(event) =>
                            setAgreementPurchaseReportAgreementName(
                              event.target.value,
                            )
                          }
                          placeholder="SITE ou nome exato"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                        Tipo voucher
                        <input
                          value={agreementPurchaseReportVoucherType}
                          onChange={(event) =>
                            setAgreementPurchaseReportVoucherType(
                              event.target.value,
                            )
                          }
                          placeholder="norma, infan, escol, isent"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                        Visita de
                        <input
                          type="date"
                          value={agreementPurchaseReportVisitDateFrom}
                          onChange={(event) =>
                            setAgreementPurchaseReportVisitDateFrom(
                              event.target.value,
                            )
                          }
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                        Visita ate
                        <input
                          type="date"
                          value={agreementPurchaseReportVisitDateTo}
                          onChange={(event) =>
                            setAgreementPurchaseReportVisitDateTo(
                              event.target.value,
                            )
                          }
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f] md:col-span-2">
                        Status da compra
                        <input
                          value={agreementPurchaseReportPurchaseStatus}
                          onChange={(event) =>
                            setAgreementPurchaseReportPurchaseStatus(
                              event.target.value,
                            )
                          }
                          placeholder="conc, pend, canc"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => void loadAgreementPurchaseReport()}
                      disabled={pendingKey !== null || !hasSessionPermission("ops.admin")}
                      className="rounded-full bg-[#35576f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {pendingKey === "agreement-purchases-report"
                        ? "Carregando..."
                        : "Carregar relatorio"}
                    </button>

                    {agreementPurchaseReport ? (
                      <div className="grid gap-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] p-3 text-sm text-[#35576f]">
                            Passaporte: {agreementPurchaseReport.indicators.qtdnormal} /{" "}
                            {agreementPurchaseReport.indicators.vlnormal}
                          </div>
                          <div className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] p-3 text-sm text-[#35576f]">
                            Total: {agreementPurchaseReport.indicators.qtdconvenio} /{" "}
                            {agreementPurchaseReport.indicators.vlconvenio}
                          </div>
                        </div>
                        <div className="grid gap-2">
                          {agreementPurchaseReport.rows.slice(0, 6).map((row) => (
                            <div
                              key={row.agreementName}
                              className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] p-3 text-sm text-[#3a342d]"
                            >
                              <div className="font-semibold text-[#205a7f]">
                                {row.agreementName}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-[#5d7282]">
                                passaporte {row.adultQuantity} · passaporte infantil{" "}
                                {row.childQuantity} · escolar {row.schoolQuantity} ·
                                total {row.totalQuantity} / {row.totalValue}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
            ) : null}

            {isVisible("clients") ? (
              <article className="rounded-[28px] border border-[#d7e5ef] bg-[#f7fbfe] p-5 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="legacy-condensed text-3xl text-[#205a7f]">
                    Clientes, Turmas E Periodos
                  </h2>
                  <p className="mt-2 max-w-[82ch] text-sm leading-6 text-[#6b6a67]">
                    Recorte incremental da Fase 7 para `ClientesController`:
                    tipos, autocomplete, status, turmas e periodos no painel
                    interno.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void loadClientTypes()}
                    disabled={pendingKey !== null || !hasSessionPermission("ops.admin")}
                    className="rounded-full bg-[#246b99] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pendingKey === "client-types"
                      ? "Carregando tipos..."
                      : "Carregar tipos"}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="grid gap-4 rounded-[22px] border border-[#d9e7f1] bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                      Buscar cliente
                      <input
                        value={clientSearchQuery}
                        onChange={(event) =>
                          setClientSearchQuery(event.target.value)
                        }
                        placeholder="Nome do cliente"
                        className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void searchClients()}
                      disabled={pendingKey !== null || !hasSessionPermission("ops.admin")}
                      className="rounded-full bg-[#35576f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {pendingKey === "client-search" ? "Buscando..." : "Pesquisar"}
                    </button>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="grid gap-3">
                      <div className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] p-3 text-xs leading-5 text-[#5d7282]">
                        <div className="font-semibold text-[#35576f]">
                          Tipos disponiveis
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {clientTypeOptions.length > 0 ? (
                            clientTypeOptions.map((item) => (
                              <span
                                key={item.id}
                                className="rounded-full border border-[#d9e7f1] bg-white px-3 py-1"
                              >
                                {item.name}
                              </span>
                            ))
                          ) : (
                            <span>Carregue os tipos para validar o catalogo.</span>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        {clientSearchResults.length > 0 ? (
                          clientSearchResults.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setSelectedClientId(String(item.id));
                                void loadClientEducation(String(item.id));
                              }}
                              disabled={pendingKey !== null}
                              className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] px-4 py-3 text-left text-sm text-[#3a342d] disabled:opacity-60"
                            >
                              <div className="font-semibold text-[#205a7f]">
                                #{item.id} {item.name}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-[#5d7282]">
                                {item.typeName ?? "sem tipo"}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] p-4 text-sm text-[#5d7282]">
                            Pesquise um cliente para abrir a estrutura.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {clientEducationSummary ? (
                        <>
                          <div className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] p-4 text-sm text-[#3a342d]">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="font-semibold text-[#205a7f]">
                                  #{clientEducationSummary.client.id}{" "}
                                  {clientEducationSummary.client.name}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-[#5d7282]">
                                  tipo {clientEducationSummary.client.typeName ?? "-"} ·{" "}
                                  {clientEducationSummary.client.active
                                    ? "ativo"
                                    : "inativo"} ·{" "}
                                  {clientEducationSummary.client.isSchool
                                    ? "cliente escola"
                                    : "cliente livre"}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => void loadClientEducation()}
                                disabled={pendingKey !== null}
                                className="rounded-full bg-[#246b99] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                Atualizar
                              </button>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                              <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                                Motivo do toggle
                                <input
                                  value={clientStatusReason}
                                  onChange={(event) =>
                                    setClientStatusReason(event.target.value)
                                  }
                                  placeholder="Ajuste operacional"
                                  className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => void handleClientStatusToggle()}
                                disabled={pendingKey !== null || !hasSessionPermission("ops.admin")}
                                className="rounded-full bg-[#1f8a70] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                              >
                                {pendingKey === "client-status-toggle"
                                  ? "Salvando..."
                                  : clientEducationSummary.client.active
                                    ? "Inativar cliente"
                                    : "Ativar cliente"}
                              </button>
                            </div>
                          </div>

                          <div className="grid gap-3 lg:grid-cols-2">
                            {clientEducationSummary.classes.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] p-4 text-sm text-[#3a342d]"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="font-semibold text-[#205a7f]">
                                      Turma #{item.id} · {item.name}
                                    </div>
                                    <div className="mt-1 text-xs leading-5 text-[#5d7282]">
                                      ordem {item.order} · status {item.status} ·{" "}
                                      {item.periods.length} periodo(s)
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => populateClientClassEditor(item)}
                                      disabled={pendingKey !== null}
                                      className="rounded-full bg-[#246b99] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setClientPeriodClassId(String(item.id));
                                        resetClientPeriodEditor();
                                      }}
                                      disabled={pendingKey !== null}
                                      className="rounded-full bg-[#35576f] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                                    >
                                      Periodos
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {item.periods.length > 0 ? (
                                    item.periods.map((period) => (
                                      <button
                                        key={period.id}
                                        type="button"
                                        onClick={() =>
                                          populateClientPeriodEditor(item.id, period)
                                        }
                                        disabled={pendingKey !== null}
                                        className="rounded-full border border-[#c7d6e2] bg-white px-3 py-2 text-xs font-semibold text-[#35576f] disabled:opacity-60"
                                      >
                                        {period.name} ({period.status})
                                      </button>
                                    ))
                                  ) : (
                                    <span className="text-xs text-[#6f8798]">
                                      Sem periodos cadastrados.
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] p-4 text-sm text-[#5d7282]">
                          Selecione um cliente para carregar turmas e periodos.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-3 rounded-[22px] border border-[#d9e7f1] bg-white p-4">
                    <div className="font-semibold text-[#35576f]">Editor de turma</div>
                    {clientEducationSummary?.client.isSchool ? (
                      <div className="rounded-2xl border border-[#ecdcc8] bg-[#fffaf5] p-3 text-xs leading-5 text-[#8c7357]">
                        Clientes do tipo escola usam estrutura padronizada no legado.
                        O painel interno preserva esse bloqueio para criacao e
                        edicao manual de turmas.
                      </div>
                    ) : null}
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                      ID da turma
                      <input
                        value={clientClassEditId}
                        onChange={(event) => setClientClassEditId(event.target.value)}
                        placeholder="vazio para nova"
                        className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                      Nome
                      <input
                        value={clientClassName}
                        onChange={(event) => setClientClassName(event.target.value)}
                        placeholder="Turma A"
                        className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                      />
                    </label>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                        Ordem
                        <input
                          value={clientClassOrder}
                          onChange={(event) => setClientClassOrder(event.target.value)}
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                        Status
                        <select
                          value={clientClassStatus}
                          onChange={(event) => setClientClassStatus(event.target.value)}
                          className="rounded-2xl border border-[#c7d6e2] bg-white px-4 py-3 text-sm text-[#3a342d]"
                        >
                          <option value="ati">ati</option>
                          <option value="ina">ina</option>
                        </select>
                      </label>
                    </div>
                    <div className="grid gap-2">
                      <div className="text-sm font-semibold text-[#35576f]">
                        Periodos padrao
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(clientEducationSummary?.standardPeriodOptions ?? []).map((item) => (
                          <label
                            key={item.slug}
                            className="flex items-center gap-2 rounded-full border border-[#d9e7f1] bg-[#f8fcff] px-3 py-2 text-xs font-semibold text-[#35576f]"
                          >
                            <input
                              type="checkbox"
                              checked={clientClassDefaultPeriods.includes(item.slug)}
                              onChange={() => toggleClientClassDefaultPeriod(item.slug)}
                            />
                            {item.name}
                          </label>
                        ))}
                      </div>
                    </div>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                      Motivo
                      <input
                        value={clientClassReason}
                        onChange={(event) => setClientClassReason(event.target.value)}
                        placeholder="Migracao do painel"
                        className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleClientClassSave()}
                        disabled={
                          pendingKey !== null ||
                          !hasSessionPermission("ops.admin") ||
                          clientEducationSummary?.client.isSchool === true
                        }
                        className="rounded-full bg-[#1f8a70] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "client-class-create" ||
                        pendingKey === "client-class-update"
                          ? "Salvando..."
                          : clientClassEditId.trim()
                            ? "Salvar turma"
                            : "Cadastrar turma"}
                      </button>
                      <button
                        type="button"
                        onClick={() => resetClientClassEditor()}
                        disabled={pendingKey !== null}
                        className="rounded-full bg-[#e8f1f7] px-4 py-3 text-sm font-semibold text-[#35576f] disabled:opacity-60"
                      >
                        Limpar
                      </button>
                    </div>
                    <div className="grid gap-3 rounded-2xl border border-[#ead0d0] bg-[#fffafa] p-4">
                      <div className="font-semibold text-[#8a3f3f]">Excluir turma</div>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#7b4848]">
                        ID
                        <input
                          value={clientClassDeleteId}
                          onChange={(event) =>
                            setClientClassDeleteId(event.target.value)
                          }
                          className="rounded-2xl border border-[#e0bcbc] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#7b4848]">
                        Motivo
                        <input
                          value={clientClassDeleteReason}
                          onChange={(event) =>
                            setClientClassDeleteReason(event.target.value)
                          }
                          placeholder="Cadastro duplicado"
                          className="rounded-2xl border border-[#e0bcbc] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleClientClassDelete()}
                        disabled={
                          pendingKey !== null ||
                          !hasSessionPermission("ops.admin") ||
                          clientEducationSummary?.client.isSchool === true
                        }
                        className="rounded-full bg-[#8a3f3f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "client-class-delete"
                          ? "Excluindo..."
                          : "Excluir turma"}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-[22px] border border-[#d9e7f1] bg-white p-4">
                    <div className="font-semibold text-[#35576f]">Editor de periodo</div>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                      Turma alvo
                      <select
                        value={clientPeriodClassId}
                        onChange={(event) => setClientPeriodClassId(event.target.value)}
                        className="rounded-2xl border border-[#c7d6e2] bg-white px-4 py-3 text-sm text-[#3a342d]"
                      >
                        <option value="">Selecione</option>
                        {(clientEducationSummary?.classes ?? []).map((item) => (
                          <option key={item.id} value={item.id}>
                            #{item.id} {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedClientClass ? (
                      <div className="rounded-2xl border border-[#d9e7f1] bg-[#f8fcff] p-3 text-xs leading-5 text-[#5d7282]">
                        Periodos atuais:{" "}
                        {selectedClientClass.periods.length > 0
                          ? selectedClientClass.periods
                              .map((item) => `${item.name} (${item.status})`)
                              .join(" · ")
                          : "nenhum"}
                      </div>
                    ) : null}
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                      ID do periodo
                      <input
                        value={clientPeriodEditId}
                        onChange={(event) => setClientPeriodEditId(event.target.value)}
                        placeholder="vazio para novo"
                        className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                      Nome
                      <input
                        value={clientPeriodName}
                        onChange={(event) => setClientPeriodName(event.target.value)}
                        placeholder="Manha"
                        className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                      />
                    </label>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                        Ordem
                        <input
                          value={clientPeriodOrder}
                          onChange={(event) => setClientPeriodOrder(event.target.value)}
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                        Status
                        <select
                          value={clientPeriodStatus}
                          onChange={(event) => setClientPeriodStatus(event.target.value)}
                          className="rounded-2xl border border-[#c7d6e2] bg-white px-4 py-3 text-sm text-[#3a342d]"
                        >
                          <option value="ati">ati</option>
                          <option value="ina">ina</option>
                        </select>
                      </label>
                    </div>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                      Motivo
                      <input
                        value={clientPeriodReason}
                        onChange={(event) => setClientPeriodReason(event.target.value)}
                        placeholder="Ajuste do periodo"
                        className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleClientPeriodSave()}
                        disabled={pendingKey !== null || !hasSessionPermission("ops.admin")}
                        className="rounded-full bg-[#1f8a70] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "client-period-create" ||
                        pendingKey === "client-period-update"
                          ? "Salvando..."
                          : clientPeriodEditId.trim()
                            ? "Salvar periodo"
                            : "Cadastrar periodo"}
                      </button>
                      <button
                        type="button"
                        onClick={() => resetClientPeriodEditor()}
                        disabled={pendingKey !== null}
                        className="rounded-full bg-[#e8f1f7] px-4 py-3 text-sm font-semibold text-[#35576f] disabled:opacity-60"
                      >
                        Limpar
                      </button>
                    </div>
                    <div className="grid gap-3 rounded-2xl border border-[#ead0d0] bg-[#fffafa] p-4">
                      <div className="font-semibold text-[#8a3f3f]">Excluir periodo</div>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#7b4848]">
                        ID
                        <input
                          value={clientPeriodDeleteId}
                          onChange={(event) =>
                            setClientPeriodDeleteId(event.target.value)
                          }
                          className="rounded-2xl border border-[#e0bcbc] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#7b4848]">
                        Motivo
                        <input
                          value={clientPeriodDeleteReason}
                          onChange={(event) =>
                            setClientPeriodDeleteReason(event.target.value)
                          }
                          placeholder="Periodo incorreto"
                          className="rounded-2xl border border-[#e0bcbc] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleClientPeriodDelete()}
                        disabled={pendingKey !== null || !hasSessionPermission("ops.admin")}
                        className="rounded-full bg-[#8a3f3f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "client-period-delete"
                          ? "Excluindo..."
                          : "Excluir periodo"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </article>
            ) : null}

            {isVisible("operations") ? (
              <div className="grid gap-5 xl:grid-cols-[1.1fr_1.1fr_0.9fr]">
              <div className="grid gap-5">
                <article className="rounded-[28px] border border-[#d7e5ef] bg-[#f8fcff] p-5 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
                  <h2 className="legacy-condensed text-3xl text-[#205a7f]">
                    Vouchers
                  </h2>
                  <div className="mt-5 grid gap-4">
                    <div className="grid gap-3 rounded-[22px] border border-[#d9e7f1] bg-white p-4">
                      <label className="text-sm font-semibold text-[#3c627a]">
                        Validar por numero
                      </label>
                      <input
                        value={voucherNumber}
                        onChange={(event) => setVoucherNumber(event.target.value)}
                        placeholder="A1234"
                        className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                      />
                      <label className="flex items-center gap-2 text-sm text-[#6b6a67]">
                        <input
                          checked={voucherConfirm}
                          onChange={(event) =>
                            setVoucherConfirm(event.target.checked)
                          }
                          type="checkbox"
                        />
                        Confirmar uso fora da data quando aplicavel
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          sendRequest(
                            "voucher-number",
                            "Validar voucher por numero",
                            "/api/ops/vouchers/validate",
                            {
                              voucherNumber,
                              confirm: voucherConfirm,
                            },
                            "ops.vouchers",
                          )
                        }
                        disabled={pendingKey !== null || !hasSessionPermission("ops.vouchers")}
                        className="rounded-full bg-[#246b99] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "voucher-number"
                          ? "Executando..."
                          : "Validar voucher"}
                      </button>
                    </div>

                    <div className="grid gap-3 rounded-[22px] border border-[#d9e7f1] bg-white p-4">
                      <label className="text-sm font-semibold text-[#3c627a]">
                        Validar por compra
                      </label>
                      <input
                        value={purchaseValidateId}
                        onChange={(event) =>
                          setPurchaseValidateId(event.target.value)
                        }
                        placeholder="321"
                        className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          sendRequest(
                            "voucher-purchase",
                            "Validar vouchers por purchaseId",
                            "/api/ops/vouchers/validate",
                            {
                              purchaseId: Number(purchaseValidateId),
                              confirm: voucherConfirm,
                            },
                            "ops.vouchers",
                          )
                        }
                        disabled={pendingKey !== null || !hasSessionPermission("ops.vouchers")}
                        className="rounded-full bg-[#1f8a70] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "voucher-purchase"
                          ? "Executando..."
                          : "Validar compra"}
                      </button>
                    </div>

                    <div className="grid gap-3 rounded-[22px] border border-[#d9e7f1] bg-white p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#3c627a]">
                        School ID
                        <input
                          value={schoolId}
                          onChange={(event) => setSchoolId(event.target.value)}
                          placeholder="77"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#3c627a]">
                        Agenda ID
                        <input
                          value={agendaId}
                          onChange={(event) => setAgendaId(event.target.value)}
                          placeholder="88"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          sendRequest(
                            "voucher-school",
                            "Validar passeio escolar",
                            "/api/ops/vouchers/validate",
                            {
                              schoolId: Number(schoolId),
                              agendaId: Number(agendaId),
                            },
                            "ops.vouchers",
                          )
                        }
                        disabled={pendingKey !== null || !hasSessionPermission("ops.vouchers")}
                        className="rounded-full bg-[#5c7a2d] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "voucher-school"
                          ? "Executando..."
                          : "Validar passeio"}
                      </button>
                    </div>

                    <div className="grid gap-3 rounded-[22px] border border-[#d9e7f1] bg-white p-4">
                      <label className="text-sm font-semibold text-[#3c627a]">
                        Lote por `voucherIds`
                      </label>
                      <div className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end">
                        <label className="flex flex-col gap-2 text-sm text-[#6b6a67]">
                          Acao
                          <select
                            value={voucherAction}
                            onChange={(event) =>
                              setVoucherAction(
                                event.target.value as
                                  | "validate"
                                  | "unvalidate"
                                  | "invalidate",
                              )
                            }
                            className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                          >
                            <option value="validate">validate</option>
                            <option value="unvalidate">unvalidate</option>
                            <option value="invalidate">invalidate</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-2 text-sm text-[#6b6a67]">
                          IDs separados por virgula
                          <input
                            value={voucherIdsCsv}
                            onChange={(event) =>
                              setVoucherIdsCsv(event.target.value)
                            }
                            placeholder="101, 102, 103"
                            className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            sendRequest(
                              "voucher-batch",
                              `Executar ${voucherAction} em lote`,
                              `/api/ops/vouchers/${voucherAction}`,
                              {
                                voucherIds: parseCsvIds(voucherIdsCsv),
                              },
                              "ops.vouchers",
                            )
                          }
                          disabled={pendingKey !== null || !hasSessionPermission("ops.vouchers")}
                          className="rounded-full bg-[#7b5f3b] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {pendingKey === "voucher-batch"
                            ? "Executando..."
                            : "Executar lote"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              </div>

              <div className="grid gap-5">
                <article className="rounded-[28px] border border-[#eadbc9] bg-[#fffaf5] p-5 shadow-[0_12px_34px_rgba(106,72,34,0.08)]">
                  <h2 className="legacy-condensed text-3xl text-[#7b5f3b]">
                    Compras
                  </h2>

                  <div className="mt-5 grid gap-4">
                    <div className="grid gap-3 rounded-[22px] border border-[#ecdcc8] bg-white p-4">
                      <div className="font-semibold text-[#6f5535]">
                        Registrar venda de bilheteria
                      </div>
                      <div className="grid gap-3 md:grid-cols-[120px_140px_auto]">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Mes
                          <input
                            value={boxOfficeAgendaMonth}
                            onChange={(event) =>
                              setBoxOfficeAgendaMonth(event.target.value)
                            }
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Ano
                          <input
                            value={boxOfficeAgendaYear}
                            onChange={(event) =>
                              setBoxOfficeAgendaYear(event.target.value)
                            }
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void loadBoxOfficeAgendas()}
                          disabled={pendingKey !== null || !hasSessionPermission("ops.read")}
                          className="self-end rounded-full bg-[#246b99] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {pendingKey === "box-office-agendas"
                            ? "Carregando..."
                            : "Carregar agenda"}
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Data da agenda
                          <select
                            value={boxOfficeAgendaId}
                            onChange={(event) =>
                              setBoxOfficeAgendaId(event.target.value)
                            }
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                          >
                            <option value="">Selecione</option>
                            {boxOfficeAgendas.map((agenda) => (
                              <option key={agenda.id} value={agenda.id}>
                                {formatDate(agenda.date)} - #{agenda.id} -{" "}
                                {agenda.type === "promo" ? "Promocional" : "Padrao"}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          CPF opcional
                          <input
                            value={boxOfficeCpf}
                            onChange={(event) => setBoxOfficeCpf(event.target.value)}
                            placeholder="52998224725"
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                      </div>
                      <div className="grid gap-3 rounded-[20px] border border-[#eadbc9] bg-[#fffaf5] p-4 text-sm text-[#6f5535] md:grid-cols-4">
                        <div>
                          <div className="font-semibold">Passaporte</div>
                          <div>{formatCurrency(boxOfficeAdultBasePrice)}</div>
                        </div>
                        <div>
                          <div className="font-semibold">Passaporte Infantil</div>
                          <div>{formatCurrency(boxOfficeChildBasePrice)}</div>
                        </div>
                        <div>
                          <div className="font-semibold">Total calculado</div>
                          <div>{formatCurrency(boxOfficeTotal)}</div>
                        </div>
                        <div>
                          <div className="font-semibold">Pagamentos</div>
                          <div
                            className={
                              Math.abs(boxOfficePaymentDifference) > 0.01
                                ? "text-[#a33a2f]"
                                : "text-[#1f8a70]"
                            }
                          >
                            {formatCurrency(boxOfficePaymentTotal)}
                          </div>
                        </div>
                      </div>
                      <textarea
                        value={boxOfficeReason}
                        onChange={(event) => setBoxOfficeReason(event.target.value)}
                        rows={2}
                        placeholder="Motivo ou observacao da venda"
                        className="rounded-[22px] border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                      />
                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Chave anti-duplicidade
                          <input
                            value={boxOfficeIdempotencyKey}
                            onChange={(event) =>
                              setBoxOfficeIdempotencyKey(event.target.value)
                            }
                            placeholder="Gerada automaticamente ao registrar"
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 font-mono text-xs text-[#3a342d]"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setBoxOfficeIdempotencyKey(
                              createBoxOfficeIdempotencyKey(),
                            )
                          }
                          className="self-end rounded-full border border-[#d9c8b6] px-5 py-3 text-sm font-semibold text-[#6f5535]"
                        >
                          Nova chave
                        </button>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-3">
                        <div className="grid gap-3 rounded-[20px] border border-[#ecdcc8] bg-[#fffdf9] p-4">
                          <div className="font-semibold text-[#6f5535]">
                            Ingressos
                          </div>
                          <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                            Passaportes
                            <input
                              value={boxOfficeAdultQuantity}
                              onChange={(event) =>
                                setBoxOfficeAdultQuantity(event.target.value)
                              }
                              className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                            Desconto passaporte
                            <select
                              value={boxOfficeAdultDiscountId}
                              onChange={(event) =>
                                setBoxOfficeAdultDiscountId(event.target.value)
                              }
                              className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                            >
                              <option value="">Sem desconto</option>
                              {boxOfficeDiscounts.map((discount) => (
                                <option key={discount.id} value={discount.id}>
                                  {discount.name} - {discount.value}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                            Passaportes infantis
                            <input
                              value={boxOfficeChildQuantity}
                              onChange={(event) =>
                                setBoxOfficeChildQuantity(event.target.value)
                              }
                              className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                            Desconto passaporte infantil
                            <select
                              value={boxOfficeChildDiscountId}
                              onChange={(event) =>
                                setBoxOfficeChildDiscountId(event.target.value)
                              }
                              className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                            >
                              <option value="">Sem desconto</option>
                              {boxOfficeDiscounts.map((discount) => (
                                <option key={discount.id} value={discount.id}>
                                  {discount.name} - {discount.value}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                            Isentos
                            <input
                              value={boxOfficeExemptQuantity}
                              onChange={(event) =>
                                setBoxOfficeExemptQuantity(event.target.value)
                              }
                              className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                            />
                          </label>
                        </div>
                        <div className="grid gap-3 rounded-[20px] border border-[#ecdcc8] bg-[#fffdf9] p-4">
                          <div className="font-semibold text-[#6f5535]">
                            Cortesia
                          </div>
                          <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                            Autorizador
                            <select
                              value={boxOfficeCourtesyAuthorId}
                              onChange={(event) =>
                                setBoxOfficeCourtesyAuthorId(event.target.value)
                              }
                              className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                            >
                              <option value="">Sem cortesia</option>
                              {boxOfficeCourtesyAuthors.map((author) => (
                                <option key={author.id} value={author.id}>
                                  {author.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                            Quantidade
                            <input
                              value={boxOfficeCourtesyQuantity}
                              onChange={(event) =>
                                setBoxOfficeCourtesyQuantity(event.target.value)
                              }
                              className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                            Identificacao
                            <input
                              value={boxOfficeCourtesyIdentification}
                              onChange={(event) =>
                                setBoxOfficeCourtesyIdentification(event.target.value)
                              }
                              className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                            Observacao
                            <input
                              value={boxOfficeCourtesyNote}
                              onChange={(event) =>
                                setBoxOfficeCourtesyNote(event.target.value)
                              }
                              className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                            />
                          </label>
                        </div>
                        <div className="grid gap-3 rounded-[20px] border border-[#ecdcc8] bg-[#fffdf9] p-4">
                          <div className="font-semibold text-[#6f5535]">
                            Pagamentos
                          </div>
                          {boxOfficePaymentRows.map((payment) => (
                            <div key={payment.id} className="grid gap-2 md:grid-cols-2">
                              <input
                                value={payment.method}
                                onChange={(event) =>
                                  updateBoxOfficePaymentRow(payment.id, {
                                    method: event.target.value,
                                  })
                                }
                                className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                              />
                              <input
                                value={payment.value}
                                onChange={(event) =>
                                  updateBoxOfficePaymentRow(payment.id, {
                                    value: event.target.value,
                                  })
                                }
                                placeholder="0,00"
                                className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                              />
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setBoxOfficePaymentRows((rows) => [
                                ...rows,
                                {
                                  id: createBoxOfficeIdempotencyKey(),
                                  method: "",
                                  value: "",
                                },
                              ])
                            }
                            className="rounded-full border border-[#d9c8b6] px-4 py-2 text-sm font-semibold text-[#6f5535]"
                          >
                            Adicionar pagamento
                          </button>
                        </div>
                      </div>
                      <details className="rounded-[20px] border border-[#eadbc9] bg-white p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-[#6f5535]">
                          Payload JSON tecnico
                        </summary>
                        <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Ingressos JSON
                          <textarea
                            value={boxOfficeItemsJson}
                            onChange={(event) =>
                              setBoxOfficeItemsJson(event.target.value)
                            }
                            rows={8}
                            className="rounded-[22px] border border-[#d9c8b6] px-4 py-3 font-mono text-xs leading-6 text-[#3a342d]"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Cortesias JSON
                          <textarea
                            value={boxOfficeCourtesiesJson}
                            onChange={(event) =>
                              setBoxOfficeCourtesiesJson(event.target.value)
                            }
                            rows={8}
                            className="rounded-[22px] border border-[#d9c8b6] px-4 py-3 font-mono text-xs leading-6 text-[#3a342d]"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Pagamentos JSON
                          <textarea
                            value={boxOfficePaymentsJson}
                            onChange={(event) =>
                              setBoxOfficePaymentsJson(event.target.value)
                            }
                            rows={8}
                            className="rounded-[22px] border border-[#d9c8b6] px-4 py-3 font-mono text-xs leading-6 text-[#3a342d]"
                          />
                        </label>
                        </div>
                      </details>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const idempotencyKey =
                              boxOfficeIdempotencyKey.trim() ||
                              createBoxOfficeIdempotencyKey();

                            if (!boxOfficeIdempotencyKey.trim()) {
                              setBoxOfficeIdempotencyKey(idempotencyKey);
                            }

                            const structuredPayload =
                              buildStructuredBoxOfficePayload();
                            const fallbackPayload = {
                              items: parseJsonArray(
                                boxOfficeItemsJson,
                                "Ingressos JSON",
                              ),
                              courtesies: parseJsonArray(
                                boxOfficeCourtesiesJson,
                                "Cortesias JSON",
                              ),
                              payments: parseJsonArray(
                                boxOfficePaymentsJson,
                                "Pagamentos JSON",
                              ),
                            };
                            const shouldUseStructuredPayload =
                              structuredPayload.items.length > 0 ||
                              structuredPayload.courtesies.length > 0 ||
                              structuredPayload.payments.length > 0;

                            sendRequest(
                              "box-office-sale",
                              "Registrar venda de bilheteria",
                              "/api/ops/box-office/sales",
                              {
                                agendaId: Number(boxOfficeAgendaId),
                                cpf: boxOfficeCpf,
                                ...(shouldUseStructuredPayload
                                  ? structuredPayload
                                  : fallbackPayload),
                                reason: boxOfficeReason,
                                idempotencyKey,
                              },
                              "ops.purchases",
                            );
                          } catch (error) {
                            setResponseTitle("Registrar venda de bilheteria");
                            setResponseStatus(0);
                            setResponseBody({
                              ok: false,
                              error: {
                                code: "invalid_json_payload",
                                message:
                                  error instanceof Error
                                    ? error.message
                                    : "Falha ao ler os arrays JSON.",
                              },
                            });
                          }
                        }}
                        disabled={pendingKey !== null || !hasSessionPermission("ops.purchases")}
                        className="rounded-full bg-[#1f8a70] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "box-office-sale"
                          ? "Registrando..."
                          : "Registrar venda"}
                      </button>
                    </div>

                    <div className="grid gap-3 rounded-[22px] border border-[#ecdcc8] bg-white p-4">
                      <label className="text-sm font-semibold text-[#6f5535]">
                        Cancelar compra
                      </label>
                      <input
                        value={cancelPurchaseId}
                        onChange={(event) =>
                          setCancelPurchaseId(event.target.value)
                        }
                        placeholder="321"
                        className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                      />
                      <textarea
                        value={cancelReason}
                        onChange={(event) => setCancelReason(event.target.value)}
                        rows={3}
                        placeholder="Motivo do cancelamento operacional"
                        className="rounded-[22px] border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          sendRequest(
                            "purchase-cancel",
                            "Cancelar compra operacional",
                            "/api/ops/purchases/cancel",
                            {
                              purchaseId: Number(cancelPurchaseId),
                              reason: cancelReason,
                            },
                            "ops.purchases",
                          )
                        }
                        disabled={pendingKey !== null || !hasSessionPermission("ops.purchases")}
                        className="rounded-full bg-[#a14f44] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "purchase-cancel"
                          ? "Executando..."
                          : "Cancelar compra"}
                      </button>
                    </div>

                    <div className="grid gap-3 rounded-[22px] border border-[#ecdcc8] bg-white p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Purchase ID
                          <input
                            value={updatePurchaseId}
                            onChange={(event) =>
                              setUpdatePurchaseId(event.target.value)
                            }
                            placeholder="321"
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Data da compra
                          <input
                            value={updateDate}
                            onChange={(event) => setUpdateDate(event.target.value)}
                            placeholder="2026-04-23"
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Status
                          <select
                            value={updateStatus}
                            onChange={(event) => setUpdateStatus(event.target.value)}
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                          >
                            <option value="conc">conc</option>
                            <option value="pend">pend</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          CPF
                          <input
                            value={updateCpf}
                            onChange={(event) => setUpdateCpf(event.target.value)}
                            placeholder="52998224725"
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                      </div>

                      <textarea
                        value={updateReason}
                        onChange={(event) => setUpdateReason(event.target.value)}
                        rows={3}
                        placeholder="Motivo da alteracao operacional"
                        className="rounded-[22px] border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                      />

                      <div className="grid gap-3 lg:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Vouchers JSON
                          <textarea
                            value={updateVouchersJson}
                            onChange={(event) =>
                              setUpdateVouchersJson(event.target.value)
                            }
                            rows={9}
                            className="rounded-[22px] border border-[#d9c8b6] px-4 py-3 font-mono text-xs leading-6 text-[#3a342d]"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Payments JSON
                          <textarea
                            value={updatePaymentsJson}
                            onChange={(event) =>
                              setUpdatePaymentsJson(event.target.value)
                            }
                            rows={9}
                            className="rounded-[22px] border border-[#d9c8b6] px-4 py-3 font-mono text-xs leading-6 text-[#3a342d]"
                          />
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          try {
                            sendRequest(
                              "purchase-update",
                              "Editar compra operacional",
                              "/api/ops/purchases/update",
                              {
                                purchaseId: Number(updatePurchaseId),
                                reason: updateReason,
                                purchaseDate: updateDate,
                                status: updateStatus,
                                cpf: updateCpf,
                                vouchers: parseJsonArray(
                                  updateVouchersJson,
                                  "Vouchers JSON",
                                ),
                                payments: parseJsonArray(
                                  updatePaymentsJson,
                                  "Payments JSON",
                                ),
                              },
                              "ops.purchases",
                            );
                          } catch (error) {
                            setResponseTitle("Editar compra operacional");
                            setResponseStatus(0);
                            setResponseBody({
                              ok: false,
                              error: {
                                code: "invalid_json_payload",
                                message:
                                  error instanceof Error
                                    ? error.message
                                    : "Falha ao ler os arrays JSON.",
                              },
                            });
                          }
                        }}
                        disabled={pendingKey !== null || !hasSessionPermission("ops.purchases")}
                        className="rounded-full bg-[#7b5f3b] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "purchase-update"
                          ? "Executando..."
                          : "Salvar alteracoes"}
                      </button>
                    </div>
                  </div>
                </article>
              </div>

              <aside className="grid gap-5">
                <article className="rounded-[28px] border border-[#d7e5ef] bg-[#f6fbff] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="legacy-condensed text-3xl text-[#205a7f]">
                        Caixa
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[#5f6d77]">
                        Resumo do periodo aberto e lancamentos de fundo ou
                        sangria no proprio BFF.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadCashSummary()}
                      disabled={pendingKey !== null || !hasSessionPermission("ops.read")}
                      className="rounded-full bg-[#246b99] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {pendingKey === "cash-summary"
                        ? "Carregando..."
                        : "Atualizar"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-[#445864]">
                    <div className="rounded-[20px] border border-[#d8e4ec] bg-white p-4">
                      <div className="font-semibold text-[#205a7f]">
                        Periodo #{cashSummary?.period.id ?? "-"}
                      </div>
                      <div className="mt-2 text-xs leading-5 text-[#6f7f89]">
                        aberto em {cashSummary?.period.openedAt ?? "-"}
                      </div>
                      <div className="text-xs leading-5 text-[#6f7f89]">
                        dinheiro de vendas {cashSummary?.totals.cashSales ?? "0.00"} ·
                        em caixa {cashSummary?.totals.cashInDrawer ?? "0.00"}
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-[20px] border border-[#d8e4ec] bg-white p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                          Tipo
                          <select
                            value={cashMovementType}
                            onChange={(event) =>
                              setCashMovementType(
                                event.target.value as "fundo" | "sangria",
                              )
                            }
                            className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                          >
                            <option value="fundo">fundo</option>
                            <option value="sangria">sangria</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                          Valor
                          <input
                            value={cashValue}
                            onChange={(event) => setCashValue(event.target.value)}
                            placeholder="50,00"
                            className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                      </div>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                        Responsavel
                        <input
                          value={cashResponsible}
                          onChange={(event) =>
                            setCashResponsible(event.target.value)
                          }
                          placeholder="Tesouraria"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                        Motivo
                        <textarea
                          value={cashReason}
                          onChange={(event) => setCashReason(event.target.value)}
                          rows={3}
                          placeholder="Reforco do caixa ou retirada autorizada"
                          className="rounded-[22px] border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleCashMovementSubmit()}
                        disabled={pendingKey !== null || !hasSessionPermission("ops.cash")}
                        className="rounded-full bg-[#1f8a70] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "cash-movement"
                          ? "Executando..."
                          : "Registrar lancamento"}
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[20px] border border-[#d8e4ec] bg-white p-4">
                        <strong>{cashSummary?.totals.fund ?? "0.00"}</strong> em
                        fundos
                        <div className="mt-2 text-xs leading-5 text-[#6f7f89]">
                          {(cashSummary?.funds ?? []).slice(-3).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <span>
                                #{item.id} {item.responsible} · {item.value}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setCashEditMovementId(String(item.id));
                                  setCashEditResponsible(item.responsible);
                                  setCashEditValue(item.value);
                                  setCashDeleteMovementId(String(item.id));
                                }}
                                className="rounded-full border border-[#c7d6e2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#246b99]"
                              >
                                Usar
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-[#d8e4ec] bg-white p-4">
                        <strong>{cashSummary?.totals.sangria ?? "0.00"}</strong> em
                        sangrias
                        <div className="mt-2 text-xs leading-5 text-[#6f7f89]">
                          {(cashSummary?.sangrias ?? []).slice(-3).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <span>
                                #{item.id} {item.responsible} · {item.value}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setCashEditMovementId(String(item.id));
                                  setCashEditResponsible(item.responsible);
                                  setCashEditValue(item.value);
                                  setCashDeleteMovementId(String(item.id));
                                }}
                                className="rounded-full border border-[#c7d6e2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#246b99]"
                              >
                                Usar
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-[20px] border border-[#d8e4ec] bg-white p-4">
                      <div className="font-semibold text-[#205a7f]">
                        Editar lancamento
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                          Movement ID
                          <input
                            value={cashEditMovementId}
                            onChange={(event) =>
                              setCashEditMovementId(event.target.value)
                            }
                            placeholder="12"
                            className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                          Responsavel
                          <input
                            value={cashEditResponsible}
                            onChange={(event) =>
                              setCashEditResponsible(event.target.value)
                            }
                            placeholder="Tesouraria"
                            className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                          Valor
                          <input
                            value={cashEditValue}
                            onChange={(event) =>
                              setCashEditValue(event.target.value)
                            }
                            placeholder="50,00"
                            className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                      </div>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
                        Motivo da alteracao
                        <textarea
                          value={cashEditReason}
                          onChange={(event) => setCashEditReason(event.target.value)}
                          rows={3}
                          placeholder="Correcao do responsavel ou do valor"
                          className="rounded-[22px] border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleCashMovementUpdate()}
                        disabled={pendingKey !== null || !hasSessionPermission("ops.cash")}
                        className="rounded-full bg-[#246b99] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "cash-movement-update"
                          ? "Executando..."
                          : "Salvar alteracao"}
                      </button>
                    </div>

                    <div className="grid gap-3 rounded-[20px] border border-[#ecdcc8] bg-white p-4">
                      <div className="font-semibold text-[#7b5f3b]">
                        Excluir lancamento
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Movement ID
                          <input
                            value={cashDeleteMovementId}
                            onChange={(event) =>
                              setCashDeleteMovementId(event.target.value)
                            }
                            placeholder="12"
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Motivo da exclusao
                          <input
                            value={cashDeleteReason}
                            onChange={(event) =>
                              setCashDeleteReason(event.target.value)
                            }
                            placeholder="Lancamento duplicado"
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCashMovementDelete()}
                        disabled={pendingKey !== null || !hasSessionPermission("ops.cash")}
                        className="rounded-full bg-[#a14f44] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "cash-movement-delete"
                          ? "Executando..."
                          : "Excluir lancamento"}
                      </button>
                    </div>

                    <div className="grid gap-3 rounded-[20px] border border-[#d8e4ec] bg-white p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold text-[#205a7f]">
                            Historico de fechamentos
                          </div>
                          <div className="mt-1 text-xs leading-5 text-[#6f7f89]">
                            Lista os ultimos `caixa_fechamentos` disponiveis no banco.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void loadCashClosures()}
                          disabled={pendingKey !== null || !hasSessionPermission("ops.read")}
                          className="rounded-full bg-[#246b99] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {pendingKey === "cash-closures"
                            ? "Carregando..."
                            : "Atualizar"}
                        </button>
                      </div>

                      <div className="grid gap-3 text-xs leading-5 text-[#6f7f89]">
                        {(cashClosureList?.items ?? []).slice(0, 5).map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-[#d8e4ec] bg-[#f8fcff] p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-semibold text-[#205a7f]">
                                  Fechamento #{item.id} · periodo {item.periodId ?? "-"}
                                </div>
                                <div>
                                  {item.openedAt ?? "-"} ate {item.closedAt ?? "-"}
                                </div>
                                <div>
                                  dinheiro {item.totals.cash} · fundo {item.totals.fund} ·
                                  geral {item.totals.overall}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => void loadCashClosureDetail(item.id)}
                                disabled={pendingKey !== null}
                                className="rounded-full border border-[#c7d6e2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#246b99]"
                              >
                                Ver
                              </button>
                            </div>
                            <div className="mt-2">
                              <a
                                href={`/painel/fechamentos/${item.id}/imprimir`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b5f3b]"
                              >
                                Imprimir fechamento
                              </a>
                            </div>
                          </div>
                        ))}
                        <div>
                          {cashClosureList?.meta.total ?? 0} fechamento(s) encontrados
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#d8e4ec] bg-[#f8fcff] p-4">
                        <div className="font-semibold text-[#205a7f]">
                          Detalhe selecionado
                        </div>
                        <div className="mt-2 text-xs leading-5 text-[#6f7f89]">
                          {selectedCashClosure ?
                            `#${selectedCashClosure.id} · periodo ${selectedCashClosure.periodId ?? "-"} · operador ${selectedCashClosure.operator ?? "-"}` :
                            "Nenhum fechamento carregado ainda."}
                        </div>
                        {selectedCashClosure ?
                          <div className="mt-2">
                            <a
                              href={`/painel/fechamentos/${selectedCashClosure.id}/imprimir`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b5f3b]"
                            >
                              Abrir versao de impressao
                            </a>
                          </div> :
                          null}
                        <pre className="mt-3 overflow-x-auto rounded-[18px] bg-white p-4 text-xs leading-6 text-[#3a342d]">
                          {selectedCashClosure ?
                            prettyJson(selectedCashClosure.snapshot) :
                            "{\n  \"snapshot\": null\n}"}
                        </pre>
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-[20px] border border-[#ecdcc8] bg-white p-4">
                      <div className="font-semibold text-[#7b5f3b]">
                        Fechar periodo atual
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Operador do fechamento
                          <input
                            value={cashCloseOperator}
                            onChange={(event) =>
                              setCashCloseOperator(event.target.value)
                            }
                            placeholder="Nome do operador"
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Motivo
                          <input
                            value={cashCloseReason}
                            onChange={(event) =>
                              setCashCloseReason(event.target.value)
                            }
                            placeholder="Fechamento manual do caixa"
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCashClose()}
                        disabled={pendingKey !== null || !hasSessionPermission("ops.cash")}
                        className="rounded-full bg-[#7b5f3b] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "cash-close"
                          ? "Executando..."
                          : "Fechar caixa"}
                      </button>
                    </div>

                    <div className="grid gap-3 rounded-[20px] border border-[#eadbc9] bg-[#fffaf5] p-4">
                      <div className="font-semibold text-[#7b5f3b]">
                        Fechar periodos anteriores
                      </div>
                      <div className="text-xs leading-5 text-[#8c7357]">
                        Fecha automaticamente periodos abertos em dias anteriores e
                        reposiciona o caixa no periodo atual.
                      </div>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                        Motivo
                        <input
                          value={cashAutoCloseReason}
                          onChange={(event) =>
                            setCashAutoCloseReason(event.target.value)
                          }
                          placeholder="Virada do dia operacional"
                          className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleCashAutoClose()}
                        disabled={pendingKey !== null || !hasSessionPermission("ops.cash")}
                        className="rounded-full bg-[#a56a2a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "cash-auto-close"
                          ? "Executando..."
                          : "Fechar pendencias"}
                      </button>
                    </div>
                  </div>
                </article>

                <article className="rounded-[28px] border border-[#d7e5ef] bg-[#f6fbff] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="legacy-condensed text-3xl text-[#205a7f]">
                        Referencias
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[#5f6d77]">
                        Descontos, tipos e autorizadores de cortesia do legado.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        sendReadRequest<ReferenceData>(
                          "reference-data",
                          "Carregar referencias operacionais",
                          "/api/ops/reference-data",
                          setReferenceData,
                          "ops.read",
                        )
                      }
                      disabled={pendingKey !== null || !hasSessionPermission("ops.read")}
                      className="rounded-full bg-[#246b99] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {pendingKey === "reference-data"
                        ? "Carregando..."
                        : "Atualizar"}
                    </button>
                  </div>

                    <div className="mt-4 grid gap-3 text-sm text-[#445864]">
                    <div className="rounded-[20px] border border-[#d8e4ec] bg-white p-4">
                      <strong>{referenceData?.discountTypes.length ?? 0}</strong>{" "}
                      tipos de desconto
                      <div className="mt-2 text-xs leading-5 text-[#6f7f89]">
                        {(referenceData?.discountTypes ?? []).slice(0, 4).map((item) => (
                          <div key={item.id}>
                            #{item.id} {item.description}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-[#d8e4ec] bg-white p-4">
                      <strong>{referenceData?.discounts.length ?? 0}</strong>{" "}
                      descontos
                      <div className="mt-2 text-xs leading-5 text-[#6f7f89]">
                        {(referenceData?.discounts ?? []).slice(0, 4).map((item) => (
                          <div key={item.id}>
                            #{item.id} {item.name} · {item.value} ·{" "}
                            {item.typeDescription ?? "Sem tipo"}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-[#d8e4ec] bg-white p-4">
                      <strong>{referenceData?.courtesyAuthors.length ?? 0}</strong>{" "}
                      autorizadores de cortesia
                      <div className="mt-2 text-xs leading-5 text-[#6f7f89]">
                        {(referenceData?.courtesyAuthors ?? [])
                          .slice(0, 4)
                          .map((item) => (
                            <div key={item.id}>
                              #{item.id} {item.name}
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </article>

                <article className="rounded-[28px] border border-[#eadbc9] bg-[#fffaf5] p-5">
                  <div className="flex flex-col gap-4">
                    <div>
                      <h2 className="legacy-condensed text-3xl text-[#7b5f3b]">
                        Jobs
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[#7a6954]">
                        Runner manual para o cron de pagamento enquanto o
                        agendamento recorrente ainda nao foi ligado no BFF.
                      </p>
                    </div>

                    <div className="grid gap-3 rounded-[20px] border border-[#ecdcc8] bg-white p-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Janela em dias
                          <input
                            value={paymentSyncRecentDays}
                            onChange={(event) =>
                              setPaymentSyncRecentDays(event.target.value)
                            }
                            placeholder="7"
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Cancelar apos
                          <input
                            value={paymentSyncCancelAfterDays}
                            onChange={(event) =>
                              setPaymentSyncCancelAfterDays(event.target.value)
                            }
                            placeholder="5"
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                          Limite
                          <input
                            value={paymentSyncLimit}
                            onChange={(event) => setPaymentSyncLimit(event.target.value)}
                            placeholder="50"
                            className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handlePaymentSync()}
                        disabled={pendingKey !== null || !hasSessionPermission("ops.jobs")}
                        className="rounded-full bg-[#7b5f3b] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "payment-sync"
                          ? "Executando..."
                          : "Reconciliar pagamentos"}
                      </button>
                    </div>

                    <div className="grid gap-3 rounded-[20px] border border-[#ecdcc8] bg-[#fff8ef] p-4">
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                        Motivo do fechamento retroativo
                        <input
                          value={dailyJobsCashReason}
                          onChange={(event) =>
                            setDailyJobsCashReason(event.target.value)
                          }
                          placeholder="Rotina diaria operacional no BFF"
                          className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleDailyJobsRun()}
                        disabled={pendingKey !== null || !hasSessionPermission("ops.jobs")}
                        className="rounded-full bg-[#a56a2a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "daily-jobs-run"
                          ? "Executando..."
                          : "Rodar rotina diaria"}
                      </button>
                    </div>

                    <div className="grid gap-3 rounded-[20px] border border-[#ecdcc8] bg-white p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold text-[#7b5f3b]">
                            Saude do scheduler
                          </div>
                          <div className="mt-1 text-xs leading-5 text-[#8c7357]">
                            Ultima leitura consolidada do job agendado.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void loadJobHealth()}
                          disabled={pendingKey !== null || !hasSessionPermission("ops.read")}
                          className="rounded-full bg-[#a56a2a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {pendingKey === "job-health"
                            ? "Carregando..."
                            : "Saude"}
                        </button>
                      </div>
                      <div className="rounded-2xl border border-[#f0e3d6] bg-[#fffaf5] p-3 text-xs leading-5 text-[#7a6954]">
                        <div className="font-semibold text-[#5f4527]">
                          {jobHealth?.status ?? "sem leitura"} ·{" "}
                          {jobHealth?.healthy ? "saudavel" : "requer atencao"}
                        </div>
                        <div>{jobHealth?.message ?? "Nenhuma verificacao executada ainda."}</div>
                        <div>
                          ultima execucao: {jobHealth?.latestRun?.finishedAt ?? "-"} ·
                          atraso: {jobHealth?.ageMinutes ?? "-"} min
                        </div>
                        <div>
                          ultimo sucesso: {jobHealth?.lastSuccessAt ?? "-"}
                        </div>
                        {jobHealth?.recommendedActions?.length ? (
                          <ul className="mt-2 list-disc pl-4">
                            {jobHealth.recommendedActions.map((action) => (
                              <li key={action}>{action}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-[20px] border border-[#ecdcc8] bg-white p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold text-[#7b5f3b]">
                            Historico de execucoes
                          </div>
                          <div className="mt-1 text-xs leading-5 text-[#8c7357]">
                            Ultimas rodadas registradas para o runner diario.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void loadJobRuns()}
                          disabled={pendingKey !== null || !hasSessionPermission("ops.read")}
                          className="rounded-full bg-[#7b5f3b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {pendingKey === "job-runs"
                            ? "Carregando..."
                            : "Atualizar"}
                        </button>
                      </div>
                      <div className="grid gap-3 text-xs leading-5 text-[#7a6954]">
                        {(jobRunList?.items ?? []).slice(0, 5).map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-[#f0e3d6] bg-[#fffaf5] p-3"
                          >
                            <div className="font-semibold text-[#5f4527]">
                              #{item.id} · {item.status} · {item.triggerSource}
                            </div>
                            <div>{item.message}</div>
                            <div>
                              inicio {item.startedAt ?? "-"} · fim {item.finishedAt ?? "-"}
                            </div>
                            <div>
                              por {item.initiatedBy ?? "-"} · criado em{" "}
                              {item.createdAt ?? "-"}
                            </div>
                          </div>
                        ))}
                        <div>
                          {jobRunList?.meta.total ?? 0} execucao(oes) registradas
                        </div>
                      </div>
                    </div>
                  </div>
                </article>

                <article className="rounded-[28px] border border-[#eadbc9] bg-[#fffaf5] p-5">
                  <div className="flex flex-col gap-4">
                    <div>
                      <h2 className="legacy-condensed text-3xl text-[#7b5f3b]">
                        Auditoria
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[#7a6954]">
                        Consulta de `edicoes_log` para ler as alteracoes ja
                        gravadas pelo legado e pelo BFF.
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                        Filtrar por purchaseId
                        <input
                          value={auditPurchaseId}
                          onChange={(event) =>
                            setAuditPurchaseId(event.target.value)
                          }
                          placeholder="321"
                          className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                        Filtrar por voucherId
                        <input
                          value={auditVoucherId}
                          onChange={(event) =>
                            setAuditVoucherId(event.target.value)
                          }
                          placeholder="9001"
                          className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#6f5535]">
                        Filtrar por agendaId
                        <input
                          value={auditAgendaId}
                          onChange={(event) =>
                            setAuditAgendaId(event.target.value)
                          }
                          placeholder="88"
                          className="rounded-2xl border border-[#d9c8b6] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          sendReadRequest<AuditLogList>(
                            "audit-logs",
                            "Carregar auditoria operacional",
                            `/api/ops/audit-logs?limit=10&offset=0${
                              auditPurchaseId.trim()
                                ? `&purchaseId=${encodeURIComponent(auditPurchaseId.trim())}`
                                : ""
                            }${
                              auditVoucherId.trim()
                                ? `&voucherId=${encodeURIComponent(auditVoucherId.trim())}`
                                : ""
                            }${
                              auditAgendaId.trim()
                                ? `&agendaId=${encodeURIComponent(auditAgendaId.trim())}`
                                : ""
                            }`,
                            setAuditLogList,
                            "ops.read",
                          )
                        }
                        disabled={pendingKey !== null || !hasSessionPermission("ops.read")}
                        className="rounded-full bg-[#7b5f3b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingKey === "audit-logs"
                          ? "Carregando..."
                          : "Consultar log"}
                      </button>
                    </div>

                    <div className="rounded-[22px] border border-[#ecdcc8] bg-white p-4 text-sm text-[#5c5147]">
                      <div className="font-semibold">
                        {auditLogList?.meta.total ?? 0} registros encontrados
                      </div>
                      <div className="mt-2 text-xs leading-5 text-[#736457]">
                        filtros ativos: compra {auditLogList?.meta.purchaseId ?? "-"} · voucher{" "}
                        {auditLogList?.meta.voucherId ?? "-"} · evento{" "}
                        {auditLogList?.meta.agendaId ?? "-"}
                      </div>
                      <div className="mt-3 grid gap-3 text-xs leading-5 text-[#736457]">
                        {(auditLogList?.items ?? []).slice(0, 5).map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-[#f0e3d6] bg-[#fffaf5] p-3"
                          >
                            <div className="font-semibold text-[#5f4527]">
                              #{item.id} · {item.action} · compra{" "}
                              {item.purchaseId ?? "-"}
                            </div>
                            <div>{item.description}</div>
                            <div>Motivo: {item.reason}</div>
                            <div>
                              Operador: {item.userName ?? "-"} · {item.createdAt ?? "-"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-[20px] border border-[#d8e4ec] bg-white p-4">
                    <div className="font-semibold text-[#35576f]">
                      Tipo de desconto
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#3c627a]">
                        ID para editar
                        <input
                          value={discountTypeEditId}
                          onChange={(event) =>
                            setDiscountTypeEditId(event.target.value)
                          }
                          placeholder="vazio para novo"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#3c627a]">
                        Descricao
                        <input
                          value={discountTypeDescription}
                          onChange={(event) =>
                            setDiscountTypeDescription(event.target.value)
                          }
                          placeholder="Meia entrada"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#3c627a]">
                        Motivo
                        <input
                          value={discountTypeReason}
                          onChange={(event) =>
                            setDiscountTypeReason(event.target.value)
                          }
                          placeholder="Ajuste operacional"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDiscountTypeSave()}
                      disabled={pendingKey !== null || !hasSessionPermission("ops.purchases")}
                      className="rounded-full bg-[#6c57a5] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {pendingKey === "reference-discount-type-create" ||
                      pendingKey === "reference-discount-type-update"
                        ? "Salvando..."
                        : discountTypeEditId.trim()
                          ? "Editar tipo"
                          : "Cadastrar tipo"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-[20px] border border-[#d8e4ec] bg-white p-4">
                    <div className="font-semibold text-[#35576f]">
                      Desconto
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#3c627a]">
                        ID para editar
                        <input
                          value={discountEditId}
                          onChange={(event) => setDiscountEditId(event.target.value)}
                          placeholder="vazio para novo"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#3c627a]">
                        Tipo
                        <select
                          value={discountTypeId}
                          onChange={(event) => setDiscountTypeId(event.target.value)}
                          className="rounded-2xl border border-[#c7d6e2] bg-white px-4 py-3 text-sm text-[#3a342d]"
                        >
                          <option value="">Selecione</option>
                          {(referenceData?.discountTypes ?? []).map((item) => (
                            <option key={item.id} value={item.id}>
                              #{item.id} {item.description}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#3c627a]">
                        Nome
                        <input
                          value={discountName}
                          onChange={(event) => setDiscountName(event.target.value)}
                          placeholder="Professor"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#3c627a]">
                        Aplicacao
                        <select
                          value={discountApplicationType}
                          onChange={(event) =>
                            setDiscountApplicationType(
                              event.target.value as "percentual" | "valor_fixo",
                            )
                          }
                          className="rounded-2xl border border-[#c7d6e2] bg-white px-4 py-3 text-sm text-[#3a342d]"
                        >
                          <option value="percentual">Percentual</option>
                          <option value="valor_fixo">Valor fixo</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#3c627a]">
                        Valor
                        <input
                          value={discountValue}
                          onChange={(event) => setDiscountValue(event.target.value)}
                          placeholder="50,00"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#3c627a]">
                        Motivo
                        <input
                          value={discountReason}
                          onChange={(event) => setDiscountReason(event.target.value)}
                          placeholder="Ajuste operacional"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDiscountSave()}
                      disabled={pendingKey !== null || !hasSessionPermission("ops.purchases")}
                      className="rounded-full bg-[#1f8a70] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {pendingKey === "reference-discount-create" ||
                      pendingKey === "reference-discount-update"
                        ? "Salvando..."
                        : discountEditId.trim()
                          ? "Editar desconto"
                          : "Cadastrar desconto"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-[20px] border border-[#d8e4ec] bg-white p-4">
                    <div className="font-semibold text-[#35576f]">
                      Autorizador de cortesia
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#3c627a]">
                        ID para editar
                        <input
                          value={courtesyEditId}
                          onChange={(event) => setCourtesyEditId(event.target.value)}
                          placeholder="vazio para novo"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#3c627a]">
                        Nome
                        <input
                          value={courtesyName}
                          onChange={(event) => setCourtesyName(event.target.value)}
                          placeholder="Diretoria"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#3c627a]">
                        Motivo
                        <input
                          value={courtesyReason}
                          onChange={(event) => setCourtesyReason(event.target.value)}
                          placeholder="Ajuste operacional"
                          className="rounded-2xl border border-[#c7d6e2] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCourtesySave()}
                      disabled={pendingKey !== null || !hasSessionPermission("ops.purchases")}
                      className="rounded-full bg-[#246b99] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {pendingKey === "reference-courtesy-create" ||
                      pendingKey === "reference-courtesy-update"
                        ? "Salvando..."
                        : courtesyEditId.trim()
                          ? "Editar autorizador"
                          : "Cadastrar autorizador"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-[20px] border border-[#ead0d0] bg-[#fffafa] p-4">
                    <div className="font-semibold text-[#8a3f3f]">
                      Excluir referencia
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#7b4848]">
                        Tipo
                        <select
                          value={referenceDeleteResource}
                          onChange={(event) =>
                            setReferenceDeleteResource(
                              event.target.value as
                                | "discount_type"
                                | "discount"
                                | "courtesy_author",
                            )
                          }
                          className="rounded-2xl border border-[#e0bcbc] bg-white px-4 py-3 text-sm text-[#3a342d]"
                        >
                          <option value="discount_type">Tipo de desconto</option>
                          <option value="discount">Desconto</option>
                          <option value="courtesy_author">Autorizador</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#7b4848]">
                        ID
                        <input
                          value={referenceDeleteId}
                          onChange={(event) => setReferenceDeleteId(event.target.value)}
                          placeholder="7"
                          className="rounded-2xl border border-[#e0bcbc] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#7b4848]">
                        Motivo
                        <input
                          value={referenceDeleteReason}
                          onChange={(event) =>
                            setReferenceDeleteReason(event.target.value)
                          }
                          placeholder="Cadastro duplicado"
                          className="rounded-2xl border border-[#e0bcbc] px-4 py-3 text-sm text-[#3a342d]"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleReferenceDelete()}
                      disabled={pendingKey !== null || !hasSessionPermission("ops.purchases")}
                      className="rounded-full bg-[#8a3f3f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {pendingKey === "reference-delete"
                        ? "Excluindo..."
                        : "Excluir referencia"}
                    </button>
                  </div>
                </article>

                <article className="rounded-[28px] border border-[#d7e5ef] bg-[#0f2b3e] p-5 text-[#dcecf7] shadow-[0_18px_44px_rgba(9,34,52,0.28)]">
                  <h2 className="legacy-condensed text-3xl text-white">
                    Resposta
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[#9fb8c9]">
                    Resultado bruto do endpoint executado. Use este painel para
                    conferir warnings, IDs afetados e erros normalizados.
                  </p>

                  <div className="mt-5 rounded-[22px] border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-white">
                        {responseTitle}
                      </h3>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b6d8ed]">
                        {responseStatus === null
                          ? "idle"
                          : responseStatus === 0
                            ? "local"
                            : `http ${responseStatus}`}
                      </span>
                    </div>
                    <pre className="mt-4 overflow-x-auto rounded-[18px] bg-[#081723] p-4 text-xs leading-6 text-[#d8e8f3]">
                      {responseBody
                        ? prettyJson(responseBody)
                        : "{\n  \"ok\": true,\n  \"data\": \"Nenhuma operacao executada ainda.\"\n}"}
                    </pre>
                  </div>
                </article>

                <article className="rounded-[28px] border border-[#d7e5ef] bg-white p-5">
                  <h2 className="legacy-condensed text-3xl text-[#205a7f]">
                    Notas
                  </h2>
                  <ul className="mt-4 grid gap-3 text-sm leading-6 text-[#6f6558]">
                    <li>
                      A console usa sessao operacional HTTP-only; apenas o nome e
                      CPF do operador ficam preservados nesta aba para auditoria.
                    </li>
                    <li>
                      A UI nao substitui permissao de backend: todos os
                      endpoints continuam exigindo bearer token valido.
                    </li>
                    <li>
                      O update de compra agora cobre motivo obrigatorio,
                      `discountId` por voucher editavel e auditoria persistida
                      em `edicoes_log`.
                    </li>
                    <li>
                      Caixa agora ja le o periodo aberto, registra, edita e
                      exclui fundo ou sangria com auditoria minima; o historico e
                      o fechamento manual ja saem do BFF, com pagina propria de
                      impressao; rotinas automaticas ainda seguem pendentes.
                    </li>
                  </ul>
                </article>
              </aside>
            </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

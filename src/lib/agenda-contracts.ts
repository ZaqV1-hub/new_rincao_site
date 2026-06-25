export type PublicAgendaStatus = "abe" | "lot";
export type PublicAgendaType = "padra" | "promo";

export type PublicAgendaMonth = {
  month: number;
  year: number;
};

export type RescheduleAgendaOption = {
  id: number;
  legacyEncodedId: string;
  date: string;
  day: number;
  month: number;
  year: number;
};

export type PublicAgendaEvent = {
  id: number;
  legacyEncodedId: string;
  date: string;
  day: number;
  month: number;
  year: number;
  type: PublicAgendaType;
  status: PublicAgendaStatus;
  statusLabel: string;
  priceTable: {
    id: number | null;
    name: string | null;
    normal: string | null;
    child: string | null;
    gateNormal: string | null;
    gateChild: string | null;
  };
  promotional: {
    name: string | null;
    description: string | null;
  };
};

export type PublicAgendaResponse = {
  ok: true;
  data: {
    month: number;
    year: number;
    events: PublicAgendaEvent[];
  };
};

export type PublicAgendaDetailResponse = {
  ok: true;
  data: PublicAgendaEvent;
};

export type PublicAgendaReservationDetail = PublicAgendaEvent & {
  information: string[];
};

export type BffErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export function normalizeAgendaStatus(status: string): string {
  if (status === "abe") {
    return "Aberto";
  }

  if (status === "lot") {
    return "Lotado";
  }

  return status;
}

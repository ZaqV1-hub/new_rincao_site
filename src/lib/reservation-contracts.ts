export type ReservationAgendaDetail = {
  id: number;
  legacyEncodedId: string;
  date: string;
  day: number;
  month: number;
  year: number;
  status: string;
  statusLabel: string;
  type: string;
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
  information: string[];
};

export type CreateReservationRequest = {
  agendaId: number;
  quantities: {
    normal: number;
    child: number;
    exempt: number;
  };
};

export type CreateReservationResponse = {
  ok: true;
  data: {
    purchaseId: number;
    legacyEncodedId: string;
    totalValue: string;
    voucherCount: number;
  };
};

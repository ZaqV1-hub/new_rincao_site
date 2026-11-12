export type CieloChargebackCase = {
  idCase: string;
  idChargeback: string;
  establishmentNumber: string;
  treatmentDeadline: string;
  transactionAmount: string;
  process?: string;
  transactionDetails: {
    tid: string;
    nsu: string;
    authorization: string;
    transactionDate: string;
    truncatedCard: string;
    cardAssociationName: string;
    currency?: string;
  };
  chargebackDetails: {
    reasonCode: string;
    reasonDescription: string;
    reasonMessage?: string;
    receptionDate?: string;
    replyDate?: string;
  };
  remoteStatus: "PENDING" | "DONE";
  actionTakenCode?: string;
  lifecycle?: { action: string; actionDate: string };
};

export type ChargebackAutomationStatus = {
  enabled: boolean;
  status: "disabled" | "healthy" | "stale" | "failed" | "missing" | "unavailable";
  lastRunAt: string | null;
  lastSuccessAt: string | null;
};

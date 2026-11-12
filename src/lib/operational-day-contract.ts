export type OperationalParkId = "rincao" | "estancia";

export function getOperationalParkId(): OperationalParkId {
  const park = process.env.OPERATIONAL_PARK_ID ?? "rincao";
  if (park !== "rincao" && park !== "estancia") {
    throw new Error("OPERATIONAL_PARK_ID deve ser rincao ou estancia.");
  }
  return park;
}

type CatalogFields = {
  name: string;
  description: string;
  active: boolean;
};

type CatalogVersion = {
  id: number;
  version: number;
};

type ServicePrices = {
  sitePriceCents: number | null;
  gatePriceCents: number;
};

export type OperationalService = CatalogFields & CatalogVersion & ServicePrices;
export type CashLocation = CatalogFields & CatalogVersion;

export type OperationalServiceInput = CatalogFields & ServicePrices & (
  | { id?: never; version?: never; applyToOpenDates?: boolean }
  | (CatalogVersion & { applyToOpenDates?: never })
);

export type CashLocationInput = CatalogFields & (
  | { id?: never; version?: never }
  | CatalogVersion
);

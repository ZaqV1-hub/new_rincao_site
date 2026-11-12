import { listPainelCashLocations, savePainelCashLocation } from "@/lib/painel-cash-locations";
import { runPainelCatalogRoute } from "@/lib/painel-operational-catalog";

const catalog = { resource: "vis_bilhet", list: listPainelCashLocations, save: savePainelCashLocation } as const;

export function GET(request: Request) {
  return runPainelCatalogRoute(request, catalog, "GET");
}

export function POST(request: Request) {
  return runPainelCatalogRoute(request, catalog, "POST");
}

export function PATCH(request: Request) {
  return runPainelCatalogRoute(request, catalog, "PATCH");
}

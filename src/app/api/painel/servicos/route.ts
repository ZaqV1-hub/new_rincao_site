import { runPainelCatalogRoute } from "@/lib/painel-operational-catalog";
import { listPainelServices, savePainelService } from "@/lib/painel-services";

const catalog = { resource: "vis_ingesp", list: listPainelServices, save: savePainelService } as const;

export function GET(request: Request) {
  return runPainelCatalogRoute(request, catalog, "GET");
}

export function POST(request: Request) {
  return runPainelCatalogRoute(request, catalog, "POST");
}

export function PATCH(request: Request) {
  return runPainelCatalogRoute(request, catalog, "PATCH");
}

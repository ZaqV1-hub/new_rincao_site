import { readClientTripPlink } from "@/lib/plink";
import {
  resolveSchoolPurchasePreset,
  type SchoolPurchasePreset,
} from "@/lib/school-purchase-repository";

export async function resolveSchoolPurchasePresetFromPlink(
  plink: string,
): Promise<SchoolPurchasePreset | null> {
  const parsed = readClientTripPlink(plink.trim());

  if (!parsed || parsed.tipo !== "escola") {
    return null;
  }

  return resolveSchoolPurchasePreset(parsed.idcliente, parsed.idagenda);
}

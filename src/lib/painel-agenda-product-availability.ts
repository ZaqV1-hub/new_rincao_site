import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getManagedB2cProducts } from "@/lib/estancia-content-store";

export type PainelAgendaProductAvailability = {
  passportIds: string[];
  addonIds: string[];
};

type AvailabilityStore = Record<string, PainelAgendaProductAvailability>;

const dataDir = join(process.cwd(), ".data");
const dataFile = join(dataDir, "painel-agenda-products.json");

function ensureStore() {
  mkdirSync(dataDir, { recursive: true });

  if (!existsSync(dataFile)) {
    writeFileSync(dataFile, JSON.stringify({}, null, 2), "utf8");
  }
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.map((item) => item.trim()).filter(Boolean))];
}

function readStore(): AvailabilityStore {
  ensureStore();

  try {
    const parsed = JSON.parse(readFileSync(dataFile, "utf8")) as AvailabilityStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: AvailabilityStore) {
  ensureStore();
  writeFileSync(dataFile, JSON.stringify(store, null, 2), "utf8");
}

export async function getDefaultAgendaProductAvailability(): Promise<PainelAgendaProductAvailability> {
  return {
    passportIds: (await getManagedB2cProducts("passport")).map((product) => product.id),
    addonIds: (await getManagedB2cProducts("addon")).map((product) => product.id),
  };
}

export async function normalizeAgendaProductAvailability(
  availability: Partial<PainelAgendaProductAvailability> | null | undefined,
) {
  const defaults = await getDefaultAgendaProductAvailability();
  const availablePassportIds = new Set(defaults.passportIds);
  const availableAddonIds = new Set(defaults.addonIds);

  const passportIds = uniqueIds(
    Array.isArray(availability?.passportIds) ? availability.passportIds : defaults.passportIds,
  ).filter((id) => availablePassportIds.has(id));
  const addonIds = uniqueIds(
    Array.isArray(availability?.addonIds) ? availability.addonIds : defaults.addonIds,
  ).filter((id) => availableAddonIds.has(id));

  return {
    passportIds,
    addonIds,
  } satisfies PainelAgendaProductAvailability;
}

export async function getAgendaProductAvailability(date: string) {
  const store = readStore();
  return normalizeAgendaProductAvailability(store[date]);
}

export async function setAgendaProductAvailability(
  date: string,
  availability: Partial<PainelAgendaProductAvailability> | null | undefined,
) {
  const store = readStore();
  store[date] = await normalizeAgendaProductAvailability(availability);
  writeStore(store);
}

export async function setAgendaProductAvailabilityRange(
  dates: string[],
  availability: Partial<PainelAgendaProductAvailability> | null | undefined,
) {
  const normalized = await normalizeAgendaProductAvailability(availability);
  const store = readStore();

  for (const date of dates) {
    store[date] = normalized;
  }

  writeStore(store);
}

export function removeAgendaProductAvailability(date: string) {
  const store = readStore();
  delete store[date];
  writeStore(store);
}

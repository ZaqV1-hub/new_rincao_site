import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, extname, join, resolve } from "path";
import {
  DEFAULT_B2C_PRODUCTS,
  type B2cProduct,
  type B2cProductType,
  type B2cVoucherType,
} from "@/lib/b2c-catalog-defaults";
import { getIngressoDbPool } from "@/lib/ingresso-db";

export type ManagedHomeImage = {
  id: string;
  desktopSrc: string;
  mobileSrc: string;
  alt: string;
  active: boolean;
  sortOrder: number;
};

export type ManagedAttraction = {
  id: string;
  title: string;
  description: string;
  imageSrc: string;
  active: boolean;
  sortOrder: number;
};

export type ManagedEvent = {
  id: string;
  title: string;
  description: string;
  imageSrc: string;
  href: string;
  buttonLabel: string;
  active: boolean;
  sortOrder: number;
};

export type RincaoContentData = {
  homeImages: ManagedHomeImage[];
  attractions: ManagedAttraction[];
  events: ManagedEvent[];
  products: B2cProduct[];
};

function resolveSiteStorageRoot() {
  const configuredRoot = process.env.RINCAO_SITE_STORAGE_ROOT?.trim();
  const runtimeEntry = process.argv[1] ? dirname(resolve(process.argv[1])) : null;
  const candidates = [
    configuredRoot,
    process.cwd(),
    runtimeEntry,
    runtimeEntry ? dirname(runtimeEntry) : null,
    runtimeEntry ? dirname(dirname(runtimeEntry)) : null,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (existsSync(join(candidate, ".env.local")) || existsSync(join(candidate, "src"))) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "public"))) {
      return candidate;
    }
  }

  return process.cwd();
}

const storageRoot = resolveSiteStorageRoot();
const dataDir = join(storageRoot, ".data");
const dataFile = join(dataDir, "rincao-content.json");
export const siteUploadDir = join(storageRoot, "public", "uploads", "site");
const siteBinaryUploadDir = join(dataDir, "uploads", "site");
const siteContentKey = "main";
const runtimeEntry = process.argv[1] ? dirname(resolve(process.argv[1])) : null;

const EMPTY_HOME_IMAGE: ManagedHomeImage = {
  id: "",
  desktopSrc: "",
  mobileSrc: "",
  alt: "Imagem da home",
  active: true,
  sortOrder: 1,
};

const EMPTY_ATTRACTION: ManagedAttraction = {
  id: "",
  title: "Nova atracao",
  description: "",
  imageSrc: "",
  active: true,
  sortOrder: 1,
};

const EMPTY_EVENT: ManagedEvent = {
  id: "",
  title: "Novo evento",
  description: "",
  imageSrc: "",
  href: "/agenda",
  buttonLabel: "Compre seu ingresso!",
  active: true,
  sortOrder: 1,
};

const legacyDefaultHomeImages: ManagedHomeImage[] = [
  {
    id: "home-1",
    desktopSrc: "/hero/current/banner-site-oficial-1.jpg",
    mobileSrc: "/hero/current/banner-site-oficial-1.jpg",
    alt: "Piscina e area verde da Rincao",
    active: true,
    sortOrder: 1,
  },
  {
    id: "home-2",
    desktopSrc: "/hero/current/banner-onda.jpg",
    mobileSrc: "/hero/current/banner-onda.jpg",
    alt: "Piscina de ondas da Rincao",
    active: true,
    sortOrder: 2,
  },
  {
    id: "home-3",
    desktopSrc: "/hero/current/banner-14-06-2026.jpg",
    mobileSrc: "/hero/current/banner-14-06-2026.jpg",
    alt: "Evento na Rincao",
    active: true,
    sortOrder: 3,
  },
];

const legacyDefaultAttractions: ManagedAttraction[] = [
  {
    id: "piscina-natural",
    title: "Piscina Natural",
    description:
      "Agua, sombra e area verde para aproveitar o dia em familia com conforto.",
    imageSrc: "/photos/estrutura-piscina.jpg",
    active: true,
    sortOrder: 1,
  },
  {
    id: "trilhas-natureza",
    title: "Trilhas e Natureza",
    description:
      "Caminhos ao ar livre, paisagens do parque e contato direto com a natureza.",
    imageSrc: "/photos/day-use.jpg",
    active: true,
    sortOrder: 2,
  },
  {
    id: "piscina-ondas",
    title: "Piscina de Ondas",
    description:
      "Uma das experiencias mais procuradas para quem quer brincar na agua.",
    imageSrc: "/hero/current/banner-onda.jpg",
    active: true,
    sortOrder: 3,
  },
];

const legacyDefaultEvents: ManagedEvent[] = [
  {
    id: "festa-junina",
    title: "Festa Junina",
    description:
      "Comidas tipicas, musica, brincadeiras e lazer ao ar livre em um dia preparado para curtir com a familia na Rincao.",
    imageSrc: "/hero/current/banner-14-06-2026.jpg",
    href: "/agenda?mes=6&ano=2026&date=2026-06-14",
    buttonLabel: "Compre seu ingresso!",
    active: true,
    sortOrder: 1,
  },
];

const defaultContent: RincaoContentData = {
  homeImages: [],
  attractions: [],
  events: [],
  products: DEFAULT_B2C_PRODUCTS,
};

function ensureLocalStore() {
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(siteUploadDir, { recursive: true });
  mkdirSync(siteBinaryUploadDir, { recursive: true });
}

function sortByOrder<T extends { sortOrder?: number; title?: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    return orderDiff || String(a.title ?? "").localeCompare(String(b.title ?? ""));
  });
}

function ensureWebPath(value: string) {
  return value.startsWith("/") ? value : `/${value}`;
}

function repairMojibakeText(value: string | undefined, fallback: string) {
  const raw = value?.trim();

  if (!raw) {
    return fallback;
  }

  if (/[ÃÂ�]/.test(raw)) {
    try {
      const repaired = Buffer.from(raw, "latin1").toString("utf8").trim();

      if (repaired) {
        return repaired.normalize("NFC");
      }
    } catch {
      return raw.normalize("NFC");
    }
  }

  return raw.normalize("NFC");
}

function normalizeManagedImageSrc(src: string | undefined, fallback: string) {
  const raw = (src?.trim() || fallback).replace(/\\/g, "/");
  const lower = raw.toLowerCase();

  if (!raw) {
    return fallback;
  }

  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("data:")
  ) {
    return raw;
  }

  const publicSegmentIndex = lower.lastIndexOf("/public/");
  if (publicSegmentIndex >= 0) {
    return ensureWebPath(raw.slice(publicSegmentIndex + "/public".length));
  }

  if (lower.startsWith("public/")) {
    return ensureWebPath(raw.slice("public".length));
  }

  if (
    lower.startsWith("uploads/") ||
    lower.startsWith("hero/") ||
    lower.startsWith("photos/") ||
    lower.startsWith("theme/")
  ) {
    return ensureWebPath(raw);
  }

  if (raw.startsWith("/")) {
    return raw;
  }

  return fallback;
}

function stripAccents(value: string | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isLegacyHomeImage(item: ManagedHomeImage) {
  return legacyDefaultHomeImages.some(
    (legacyItem) =>
      item.id === legacyItem.id &&
      item.desktopSrc === legacyItem.desktopSrc &&
      item.mobileSrc === legacyItem.mobileSrc &&
      stripAccents(item.alt) === stripAccents(legacyItem.alt),
  );
}

function isLegacyAttraction(item: ManagedAttraction) {
  return legacyDefaultAttractions.some(
    (legacyItem) =>
      item.id === legacyItem.id &&
      item.imageSrc === legacyItem.imageSrc &&
      stripAccents(item.title) === stripAccents(legacyItem.title) &&
      stripAccents(item.description) === stripAccents(legacyItem.description),
  );
}

function isLegacyEvent(item: ManagedEvent) {
  return legacyDefaultEvents.some(
    (legacyItem) =>
      item.id === legacyItem.id &&
      item.imageSrc === legacyItem.imageSrc &&
      item.href === legacyItem.href &&
      stripAccents(item.title) === stripAccents(legacyItem.title) &&
      stripAccents(item.description) === stripAccents(legacyItem.description),
  );
}

function normalizeManagedHomeImage(item: ManagedHomeImage, fallback: ManagedHomeImage) {
  const desktopSrc = normalizeManagedImageSrc(item.desktopSrc, fallback.desktopSrc);
  const mobileSrc = normalizeManagedImageSrc(item.mobileSrc, desktopSrc);

  return {
    ...item,
    alt: repairMojibakeText(item.alt, fallback.alt),
    desktopSrc,
    mobileSrc,
  };
}

function normalizeManagedAttraction(
  item: ManagedAttraction,
  fallback: ManagedAttraction,
) {
  return {
    ...item,
    title: repairMojibakeText(item.title, fallback.title),
    description: repairMojibakeText(item.description, fallback.description),
    imageSrc: normalizeManagedImageSrc(item.imageSrc, fallback.imageSrc),
  };
}

function normalizeManagedEvent(item: ManagedEvent, fallback: ManagedEvent) {
  return {
    ...item,
    title: repairMojibakeText(item.title, fallback.title),
    description: repairMojibakeText(item.description, fallback.description),
    imageSrc: normalizeManagedImageSrc(item.imageSrc, fallback.imageSrc),
    href: item.href?.trim() || fallback.href,
    buttonLabel: repairMojibakeText(item.buttonLabel, fallback.buttonLabel),
  };
}

function normalizeManagedProduct(item: B2cProduct, fallback: B2cProduct) {
  const sitePrice = normalizePrice(item.sitePrice ?? item.fixedPrice ?? fallback.sitePrice);
  const boxOfficePrice = normalizePrice(
    item.boxOfficePrice ?? item.sitePrice ?? item.fixedPrice ?? fallback.boxOfficePrice,
  );

  return {
    ...item,
    title: repairMojibakeText(item.title, fallback.title),
    subtitle: repairMojibakeText(item.subtitle, fallback.subtitle),
    description: repairMojibakeText(item.description, fallback.description),
    imageSrc: normalizeManagedImageSrc(item.imageSrc, fallback.imageSrc),
    sitePrice,
    boxOfficePrice,
    fixedPrice: sitePrice,
    voucherType:
      item.voucherType === "infan" ||
      item.voucherType === "espec" ||
      item.voucherType === "isent"
        ? item.voucherType
        : fallback.voucherType,
    voucherPrefix: item.voucherPrefix?.trim() || fallback.voucherPrefix,
  };
}

function readManagedList<T extends { sortOrder?: number; title?: string }>(
  value: T[] | undefined,
  fallback: T[],
) {
  return Array.isArray(value) ? sortByOrder(value) : sortByOrder(fallback);
}

function normalizeRincaoContent(parsed?: Partial<RincaoContentData> | null) {
  const parsedHomeImages = Array.isArray(parsed?.homeImages)
    ? parsed.homeImages.map((item, index) =>
        normalizeManagedHomeImage(
          item,
          defaultContent.homeImages[index] ?? EMPTY_HOME_IMAGE,
        ),
      )
    : undefined;
  const parsedAttractions = Array.isArray(parsed?.attractions)
    ? parsed.attractions.map((item, index) =>
        normalizeManagedAttraction(
          item,
          defaultContent.attractions[index] ?? EMPTY_ATTRACTION,
        ),
      )
    : undefined;
  const parsedEvents = Array.isArray(parsed?.events)
    ? parsed.events.map((item, index) =>
        normalizeManagedEvent(
          item,
          defaultContent.events[index] ?? EMPTY_EVENT,
        ),
      )
    : undefined;
  const parsedProducts = Array.isArray(parsed?.products)
    ? parsed.products.map((item, index) =>
        normalizeManagedProduct(
          item,
          defaultContent.products[index] ?? defaultContent.products[0],
        ),
      )
    : undefined;

  return {
    homeImages: readManagedList(parsedHomeImages, defaultContent.homeImages),
    attractions: readManagedList(parsedAttractions, defaultContent.attractions),
    events: readManagedList(parsedEvents, defaultContent.events),
    products: readManagedList(parsedProducts, defaultContent.products),
  } satisfies RincaoContentData;
}

function removeLegacyHardcodedContent(data: RincaoContentData) {
  return {
    ...data,
    homeImages: data.homeImages.filter((item) => !isLegacyHomeImage(item)),
    attractions: data.attractions.filter((item) => !isLegacyAttraction(item)),
    events: data.events.filter((item) => !isLegacyEvent(item)),
  } satisfies RincaoContentData;
}

function readLegacyRincaoContent() {
  ensureLocalStore();

  if (!existsSync(dataFile)) {
    return defaultContent;
  }

  try {
    const parsed = JSON.parse(readFileSync(dataFile, "utf8")) as Partial<RincaoContentData>;
    return normalizeRincaoContent(parsed);
  } catch {
    return defaultContent;
  }
}

function writeLegacyRincaoContentBackup(data: RincaoContentData) {
  ensureLocalStore();
  writeFileSync(dataFile, JSON.stringify(data, null, 2), "utf8");
}

function getSiteUploadTargets() {
  const candidates = [
    siteBinaryUploadDir,
    siteUploadDir,
    join(storageRoot, ".next", "standalone", "public", "uploads", "site"),
    join(process.cwd(), "public", "uploads", "site"),
    runtimeEntry ? join(runtimeEntry, "public", "uploads", "site") : null,
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
}

function hasNormalizedDifference(
  raw: Partial<RincaoContentData> | null | undefined,
  normalized: RincaoContentData,
) {
  if (!raw) {
    return false;
  }

  try {
    return JSON.stringify(raw) !== JSON.stringify(normalized);
  } catch {
    return false;
  }
}

function resolveSiteContentDialect() {
  const explicit =
    process.env.INGRESSO_DB_CLIENT ?? process.env.INGRESSO_DB_DIALECT ?? "";
  const normalized = explicit.trim().toLowerCase();

  if (normalized === "mysql") {
    return "mysql";
  }

  if (normalized === "postgres" || normalized === "pg") {
    return "postgres";
  }

  if (process.env.INGRESSO_DATABASE_URL) {
    return "postgres";
  }

  if (
    process.env.WP_DB_HOST ||
    process.env.GROUP_REGISTRATION_MYSQL_HOST ||
    process.env.INGRESSO_DB_HOST?.toLowerCase().includes("mysql")
  ) {
    return "mysql";
  }

  return "postgres";
}

function getSiteContentTableName() {
  return resolveSiteContentDialect() === "mysql"
    ? "rincao_site_content"
    : "public.rincao_site_content";
}

async function persistRincaoContent(data: RincaoContentData) {
  const pool = getIngressoDbPool();
  const tableName = getSiteContentTableName();
  const jsonValue = JSON.stringify(data);

  if (resolveSiteContentDialect() === "mysql") {
    await pool.query(
      `
        INSERT INTO ${tableName} (content_key, content_json, updated_at)
        VALUES ($1, CAST($2 AS JSON), NOW())
        ON DUPLICATE KEY UPDATE
          content_json = VALUES(content_json),
          updated_at = NOW()
      `,
      [siteContentKey, jsonValue],
    );
    return;
  }

  await pool.query(
    `
      INSERT INTO ${tableName} (content_key, content_json, updated_at)
      VALUES ($1, $2::jsonb, now())
      ON CONFLICT (content_key)
      DO UPDATE SET
        content_json = EXCLUDED.content_json,
        updated_at = now()
    `,
    [siteContentKey, jsonValue],
  );
}

async function ensureDatabaseStore() {
  const pool = getIngressoDbPool();
  const tableName = getSiteContentTableName();

  if (resolveSiteContentDialect() === "mysql") {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        content_key VARCHAR(191) PRIMARY KEY,
        content_json JSON NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      content_key text PRIMARY KEY,
      content_json jsonb NOT NULL,
      created_at timestamp without time zone NOT NULL DEFAULT now(),
      updated_at timestamp without time zone NOT NULL DEFAULT now()
    )
  `);
}

async function ensureDatabaseSeeded() {
  await ensureDatabaseStore();

  const pool = getIngressoDbPool();
  const tableName = getSiteContentTableName();
  const existing = await pool.query<{ content_json: RincaoContentData }>(
    `
      SELECT content_json
      FROM ${tableName}
      WHERE content_key = $1
      LIMIT 1
    `,
    [siteContentKey],
  );

  if (existing.rows[0]) {
    return;
  }

  const seededContent = readLegacyRincaoContent();
  const jsonValue = JSON.stringify(seededContent);

  if (resolveSiteContentDialect() === "mysql") {
    await pool.query(
      `
        INSERT IGNORE INTO ${tableName} (content_key, content_json)
        VALUES ($1, CAST($2 AS JSON))
      `,
      [siteContentKey, jsonValue],
    );
    return;
  }

  await pool.query(
    `
      INSERT INTO ${tableName} (content_key, content_json)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (content_key) DO NOTHING
    `,
    [siteContentKey, jsonValue],
  );
}

export async function readRincaoContent() {
  await ensureDatabaseSeeded();

  const pool = getIngressoDbPool();
  const tableName = getSiteContentTableName();
  const result = await pool.query<{ content_json: Partial<RincaoContentData> }>(
    `
      SELECT content_json
      FROM ${tableName}
      WHERE content_key = $1
      LIMIT 1
    `,
    [siteContentKey],
  );

  const storedContent = result.rows[0]?.content_json ?? null;
  const data = removeLegacyHardcodedContent(
    normalizeRincaoContent(storedContent),
  );

  if (hasNormalizedDifference(storedContent, data)) {
    await persistRincaoContent(data);
  }

  writeLegacyRincaoContentBackup(data);
  return data;
}

export async function writeRincaoContent(data: RincaoContentData) {
  await ensureDatabaseSeeded();

  const normalized = normalizeRincaoContent(data);
  await persistRincaoContent(normalized);

  writeLegacyRincaoContentBackup(normalized);
}

export async function getActiveHomeImages() {
  const items = (await readRincaoContent()).homeImages.filter((item) => item.active);
  return items;
}

export async function getActiveAttractions() {
  const items = (await readRincaoContent()).attractions.filter((item) => item.active);
  return items;
}

export async function getActiveEvents() {
  const items = (await readRincaoContent()).events.filter((item) => item.active);
  return items;
}

export async function getManagedB2cProducts(type?: B2cProductType) {
  const products = (await readRincaoContent()).products.filter((product) => product.active);
  return type ? products.filter((product) => product.type === type) : products;
}

export function makeContentId(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `item-${Date.now()}`;
}

export function normalizePrice(value: FormDataEntryValue | null) {
  const raw = String(value ?? "0").trim();

  if (!raw) {
    return "0.00";
  }

  let normalized = raw.replace(/[^\d.,-]/g, "");

  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  } else if (normalized.includes(".")) {
    const decimalMatch = normalized.match(/\.(\d{1,2})$/);

    if (!decimalMatch) {
      normalized = normalized.replace(/\./g, "");
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

export function normalizeVoucherType(value: FormDataEntryValue | null): B2cVoucherType {
  const raw = String(value ?? "").trim();
  return raw === "infan" || raw === "espec" || raw === "isent" ? raw : "norma";
}

export async function saveUploadedSiteImage(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size <= 0) {
    return null;
  }

  ensureLocalStore();

  const sourceName = file.name || "imagem.png";
  const extension = extname(sourceName).toLowerCase() || ".png";
  const fileName = `${Date.now()}-${makeContentId(sourceName.replace(extension, ""))}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  for (const targetDir of getSiteUploadTargets()) {
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, fileName), bytes);
  }

  return `/uploads/site/${fileName}`;
}

export function readUploadedSiteImage(segments: string[]) {
  const safeSegments = segments
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== "." && segment !== "..");

  if (safeSegments.length === 0 || safeSegments.length !== segments.length) {
    return null;
  }

  for (const targetDir of getSiteUploadTargets()) {
    const filePath = join(targetDir, ...safeSegments);

    if (existsSync(filePath)) {
      return {
        filePath,
        bytes: readFileSync(filePath),
      };
    }
  }

  return null;
}

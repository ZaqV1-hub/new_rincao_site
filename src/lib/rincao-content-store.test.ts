import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempRoots: string[] = [];

async function importStoreWithTempRoot() {
  const root = mkdtempSync(join(tmpdir(), "rincao-content-store-"));
  tempRoots.push(root);
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "public", "uploads", "site"), { recursive: true });
  mkdirSync(join(root, ".data", "uploads", "site"), { recursive: true });
  process.env.RINCAO_SITE_STORAGE_ROOT = root;
  vi.resetModules();

  const store = await import("@/lib/rincao-content-store");
  return { root, store };
}

describe("deleteUploadedSiteImage", () => {
  afterEach(() => {
    delete process.env.RINCAO_SITE_STORAGE_ROOT;
    vi.doUnmock("@/lib/ingresso-db");
    vi.resetModules();

    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("deletes a managed upload from all site upload targets", async () => {
    const { root, store } = await importStoreWithTempRoot();
    const publicFile = join(root, "public", "uploads", "site", "banner.jpg");
    const binaryFile = join(root, ".data", "uploads", "site", "banner.jpg");
    writeFileSync(publicFile, "public");
    writeFileSync(binaryFile, "binary");

    store.deleteUploadedSiteImage("/uploads/site/banner.jpg");

    expect(existsSync(publicFile)).toBe(false);
    expect(existsSync(binaryFile)).toBe(false);
  });

  it("ignores external, nested and traversal paths", async () => {
    const { root, store } = await importStoreWithTempRoot();
    const publicFile = join(root, "public", "uploads", "site", "banner.jpg");
    writeFileSync(publicFile, "public");

    store.deleteUploadedSiteImage("/photos/day-use.jpg");
    store.deleteUploadedSiteImage("/uploads/site/nested/banner.jpg");
    store.deleteUploadedSiteImage("/uploads/site/../banner.jpg");
    store.deleteUploadedSiteImage("https://example.com/banner.jpg");

    expect(existsSync(publicFile)).toBe(true);
  });
});

describe("readRincaoContent", () => {
  afterEach(() => {
    delete process.env.RINCAO_SITE_STORAGE_ROOT;
    vi.doUnmock("@/lib/ingresso-db");
    vi.resetModules();

    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("falls back to local content when the database read fails", async () => {
    vi.doMock("@/lib/ingresso-db", () => ({
      getIngressoDbPool: () => ({
        query: vi.fn().mockRejectedValue(new Error("database unavailable")),
      }),
    }));

    const { root, store } = await importStoreWithTempRoot();
    writeFileSync(
      join(root, ".data", "rincao-content.json"),
      JSON.stringify({
        homeImages: [
          {
            id: "fallback-home",
            desktopSrc: "/hero/current/banner-site-oficial-1.jpg",
            mobileSrc: "/hero/current/banner-site-oficial-1.jpg",
            alt: "Banner fallback",
            href: "",
            active: true,
            sortOrder: 1,
          },
        ],
      }),
    );

    await expect(store.getActiveHomeImages()).resolves.toMatchObject([
      { id: "fallback-home" },
    ]);
  });
});

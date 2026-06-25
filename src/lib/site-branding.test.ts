import { describe, expect, it } from "vitest";
import { buildPageMetadata } from "@/lib/site-metadata";
import { contact, getInfoPage } from "@/lib/site-content";

describe("site branding", () => {
  it("uses Rincao in public metadata", () => {
    const metadata = buildPageMetadata("agenda");

    expect(metadata.title).toContain("Rincao");
    expect(metadata.openGraph?.siteName).toContain("Rincao");
    expect(metadata.twitter?.title).toContain("Rincao");
  });

  it("uses Rincao in core public content", () => {
    expect(contact.company).toContain("Rincao");
    expect(contact.email).not.toContain("cluberincao");
    expect(getInfoPage("quem-somos").seoTitle).toContain("Rincao");
  });
});

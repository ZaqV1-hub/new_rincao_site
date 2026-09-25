import { describe, expect, it } from "vitest";
import { buildPageMetadata } from "@/lib/site-metadata";
import { contact, getInfoPage } from "@/lib/site-content";

describe("site branding", () => {
  it("uses Rincão in public metadata", () => {
    const metadata = buildPageMetadata("agenda");

    expect(metadata.title).toContain("Rincão");
    expect(metadata.openGraph?.siteName).toContain("Rincão");
    expect(metadata.twitter?.title).toContain("Rincão");
  });

  it("uses Rincão in core public content", () => {
    expect(contact.company).toContain("Rincão");
    expect(contact.email).toBe("atendimento@cluberincao.com.br");
    expect(getInfoPage("quem-somos").seoTitle).toContain("Rincão");
  });
});

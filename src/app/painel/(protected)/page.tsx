import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PainelHomePage } from "@/components/painel-home-page";
import { getDefaultPainelPath, hasLegacyPanelResource } from "@/lib/painel-access";
import { loadPainelHomePageData } from "@/lib/painel-home";
import { requirePainelSession } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Home | Rincao",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelHomeRoute() {
  const session = await requirePainelSession("/painel");
  if (session.authSource === "panel" && hasLegacyPanelResource(session.legacyResources, "vis_agenda")) {
    redirect("/painel/agenda");
  }
  const defaultPath = getDefaultPainelPath(session.legacyRoleId);

  if (defaultPath !== "/painel") {
    redirect(defaultPath);
    return null;
  }

  const data = await loadPainelHomePageData();

  return (
    <PainelHomePage
      data={data}
      legacyResources={session.legacyResources}
      legacyRoleId={session.legacyRoleId ?? null}
    />
  );
}


import { RincaoHomePage } from "@/components/rincao-home-page";
import { readRincaoContent } from "@/lib/rincao-content-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const content = await readRincaoContent();

  return (
    <RincaoHomePage
      heroImages={content.homeImages.filter((item) => item.active)}
      attractions={content.attractions.filter((item) => item.active)}
      events={content.events.filter((item) => item.active)}
    />
  );
}

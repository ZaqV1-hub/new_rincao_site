import { RincaoHomePage } from "@/components/rincao-home-page";
import {
  getActiveAttractions,
  getActiveEvents,
  getActiveHomeImages,
} from "@/lib/rincao-content-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [heroImages, attractions, events] = await Promise.all([
    getActiveHomeImages(),
    getActiveAttractions(),
    getActiveEvents(),
  ]);

  return (
    <RincaoHomePage
      heroImages={heroImages}
      attractions={attractions}
      events={events}
    />
  );
}

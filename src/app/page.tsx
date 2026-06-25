import { EstanciaHomePage } from "@/components/estancia-home-page";
import {
  getActiveAttractions,
  getActiveEvents,
  getActiveHomeImages,
} from "@/lib/estancia-content-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [heroImages, attractions, events] = await Promise.all([
    getActiveHomeImages(),
    getActiveAttractions(),
    getActiveEvents(),
  ]);

  return (
    <EstanciaHomePage
      heroImages={heroImages}
      attractions={attractions}
      events={events}
    />
  );
}

import { RincaoHomePage } from "@/components/rincao-home-page";
import {
  getActiveAttractions,
  getActiveEvents,
  getActiveHomeImages,
  getManagedB2cProducts,
} from "@/lib/rincao-content-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [heroImages, attractions, events, products] = await Promise.all([
    getActiveHomeImages(),
    getActiveAttractions(),
    getActiveEvents(),
    getManagedB2cProducts("passport"),
  ]);

  return (
    <RincaoHomePage
      heroImages={heroImages}
      attractions={attractions}
      events={events}
      products={products}
    />
  );
}

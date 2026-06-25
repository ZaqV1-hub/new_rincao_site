import type { Metadata } from "next";
import { LegacyEventPage } from "@/components/legacy-event-page";
import {
  buildLegacyEventMetadata,
  getLegacyEvent,
  legacyEvents,
} from "@/lib/legacy-events-content";

type PageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const requestedSlug = slug?.[0];
  const event = requestedSlug ? getLegacyEvent(requestedSlug) : null;

  if (event) {
    return buildLegacyEventMetadata(event);
  }

  return {
    title: "Eventos Legados - Estancia",
    description:
      "Arquivo das URLs legadas de eventos preservadas no novo institucional do Estancia.",
    alternates: {
      canonical: requestedSlug ? `/evento/${requestedSlug}` : "/evento",
    },
  };
}

export function generateStaticParams() {
  return legacyEvents.map((event) => ({ slug: [event.slug] }));
}

export default async function LegacyEventoPage({ params }: PageProps) {
  const { slug } = await params;
  const requestedSlug = slug?.[0] ?? null;
  const event = requestedSlug ? getLegacyEvent(requestedSlug) : null;

  return (
    <LegacyEventPage
      event={event}
      requestedSlug={requestedSlug}
      knownEvents={legacyEvents}
    />
  );
}

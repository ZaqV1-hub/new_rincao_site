import type { Metadata } from "next";
import { RegistrationPage } from "@/components/registration-page";
import { buildRegistrationMetadata, getRegistrationPage } from "@/lib/group-registration-content";

export const metadata: Metadata = buildRegistrationMetadata("grupo-igreja");

export default function GrupoIgrejaPage() {
  return <RegistrationPage page={getRegistrationPage("grupo-igreja")} />;
}

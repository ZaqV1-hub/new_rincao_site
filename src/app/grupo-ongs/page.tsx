import type { Metadata } from "next";
import { RegistrationPage } from "@/components/registration-page";
import { buildRegistrationMetadata, getRegistrationPage } from "@/lib/group-registration-content";

export const metadata: Metadata = buildRegistrationMetadata("grupo-ongs");

export default function GrupoOngsPage() {
  return <RegistrationPage page={getRegistrationPage("grupo-ongs")} />;
}

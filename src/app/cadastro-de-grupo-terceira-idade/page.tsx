import type { Metadata } from "next";
import { RegistrationPage } from "@/components/registration-page";
import { buildRegistrationMetadata, getRegistrationPage } from "@/lib/group-registration-content";

export const metadata: Metadata = buildRegistrationMetadata("cadastro-de-grupo-terceira-idade");

export default function CadastroGrupoTerceiraIdadePage() {
  return <RegistrationPage page={getRegistrationPage("cadastro-de-grupo-terceira-idade")} />;
}

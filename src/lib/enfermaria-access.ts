import type { LegacyPanelResource } from "@/lib/painel-access";

export function restrictEnfermariaResources(resources: readonly LegacyPanelResource[], actorCpf: string | null | undefined): LegacyPanelResource[] {
  const allowed = (process.env.ENFERMARIA_ALLOWED_CPFS ?? "").split(",").map((cpf) => cpf.replace(/\D/g, "")).filter(Boolean);
  const cpf = (actorCpf ?? "").replace(/\D/g, "");
  return allowed.length && !allowed.includes(cpf)
    ? resources.filter((resource) => resource !== "vis_enfermaria")
    : [...resources];
}

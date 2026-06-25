import type { LegacyPanelResource } from "@/lib/painel-access";

export type PainelAdminModule = {
  href: string;
  label: string;
  description: string;
  resources: LegacyPanelResource[];
};

export const painelAdminModules: PainelAdminModule[] = [
  {
    href: "/painel/usuario",
    label: "Usuários",
    description:
      "Usuários internos do painel, perfis de acesso e senha da conta operacional.",
    resources: ["vis_usu"],
  },
  {
    href: "/painel/usuario-site",
    label: "Usuários do site",
    description: "Contas de clientes do site e dados de acesso à área do cliente.",
    resources: ["vis_situsu"],
  },
];

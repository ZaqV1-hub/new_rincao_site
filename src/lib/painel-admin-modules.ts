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
    label: "Usuarios internos",
    description:
      "Gerencie perfis de acesso, permissoes e senha da conta operacional.",
    resources: ["vis_usu"],
  },
  {
    href: "/painel/usuario-site",
    label: "Usuarios do site",
    description: "Gerencie contas de clientes e dados de acesso da area do cliente.",
    resources: ["vis_situsu"],
  },
];

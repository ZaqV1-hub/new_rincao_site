import Link from "next/link";

type PainelBilheteriaLegacyActionsProps = {
  current:
    | "overview"
    | "indicators"
    | "history"
    | "reservations";
  isManager: boolean;
};

const baseItems = [
  {
    key: "overview",
    href: "/painel/bilheteria",
    label: "Validar Voucher",
  },
  {
    key: "reservations",
    href: "/painel/bilheteria/reservas",
    label: "Reservas",
  },
  {
    key: "indicators",
    href: "/painel/bilheteria/indicadores",
    label: "Indicadores",
  },
  {
    key: "cash",
    href: "/painel/bilheteria/fechamento-caixa",
    label: "Caixa",
  },
] as const;

export function PainelBilheteriaLegacyActions({
  current,
  isManager,
}: PainelBilheteriaLegacyActionsProps) {
  const items = [
    ...baseItems,
    ...(isManager
      ? [
          {
            key: "history" as const,
            href: "/painel/bilheteria/historico",
            label: "Historico de Vendas",
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => {
        const active =
          item.key === current ||
          (current === "indicators" &&
            item.key === "overview" &&
            item.href === "/painel/bilheteria");

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-[#246b99] text-white"
                : "border border-[#c9d8e3] bg-white text-[#205a7f] hover:bg-[#edf5fa]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

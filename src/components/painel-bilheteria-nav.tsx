import Link from "next/link";

type PainelBilheteriaNavProps = {
  current:
    | "overview"
    | "indicators"
    | "history"
    | "reservations";
};

const navItems = [
  {
    key: "overview",
    href: "/painel/bilheteria",
    label: "Visao geral",
  },
  {
    key: "indicators",
    href: "/painel/bilheteria/indicadores",
    label: "Indicadores",
  },
  {
    key: "reservations",
    href: "/painel/bilheteria/reservas",
    label: "Reservas",
  },
  {
    key: "history",
    href: "/painel/bilheteria/historico",
    label: "Historico",
  },
] as const;

export function PainelBilheteriaNav({
  current,
}: PainelBilheteriaNavProps) {
  return (
    <nav className="flex flex-wrap gap-3">
      {navItems.map((item) => {
        const active = item.key === current;

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
    </nav>
  );
}

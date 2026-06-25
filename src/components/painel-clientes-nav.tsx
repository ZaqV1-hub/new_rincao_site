import Link from "next/link";

type PainelClientesNavProps = {
  current: "overview" | "trips" | "schoolTrips";
};

const navItems = [
  {
    key: "overview",
    href: "/painel/clientes",
    label: "Visao geral",
  },
  {
    key: "trips",
    href: "/painel/clientes/passeios",
    label: "Passeios",
  },
  {
    key: "schoolTrips",
    href: "/painel/clientes/escolas/passeios",
    label: "Escolas",
  },
] as const;

export function PainelClientesNav({ current }: PainelClientesNavProps) {
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

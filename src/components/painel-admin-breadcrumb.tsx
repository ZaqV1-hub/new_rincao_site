"use client";

import Link from "next/link";

type PainelAdminBreadcrumbItem = {
  href?: string;
  label: string;
};

type PainelAdminBreadcrumbProps = {
  items: PainelAdminBreadcrumbItem[];
};

export function PainelAdminBreadcrumb({ items }: PainelAdminBreadcrumbProps) {
  return (
    <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {item.href ? (
            <Link className="text-[#1d68a2] underline" href={item.href}>
              {item.label}
            </Link>
          ) : (
            <span>{item.label}</span>
          )}
          {index < items.length - 1 ? (
            <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

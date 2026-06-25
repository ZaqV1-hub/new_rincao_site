export type PainelShellNavItem = {
  href: string;
};

export function isPainelShellNavItemActive(
  pathname: string,
  item: PainelShellNavItem,
) {
  if (item.href === "/painel") {
    return pathname === "/painel";
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CustomerAreaNavProps = {
  active: "account" | "tickets";
};

export function CustomerAreaNav({ active }: CustomerAreaNavProps) {
  const router = useRouter();
  const [logoutPending, setLogoutPending] = useState(false);

  async function handleLogout() {
    setLogoutPending(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("customer-logout-failed", error);
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="rounded-[28px] border border-[#d7e4ee] bg-white px-4 py-4 shadow-[0_16px_38px_rgba(17,66,97,0.09)] md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2">
          <Link
            href="/minha-conta"
            className={`legacy-rounded inline-flex rounded-full px-4 py-2 text-[14px] ${
              active === "account"
                ? "bg-[#1d5b80] text-white"
                : "bg-[#eef6fb] text-[#245b7d]"
            }`}
          >
            Minha Conta
          </Link>
          <Link
            href="/meus-ingressos"
            className={`legacy-rounded inline-flex rounded-full px-4 py-2 text-[14px] ${
              active === "tickets"
                ? "bg-[#1d5b80] text-white"
                : "bg-[#eef6fb] text-[#245b7d]"
            }`}
          >
            Meus Ingressos
          </Link>
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          disabled={logoutPending}
          className="legacy-rounded inline-flex min-h-[36px] items-center justify-center rounded-full border border-[#c5d8e6] px-4 text-[14px] text-[#295c7b] hover:bg-[#f3f9fd] disabled:cursor-not-allowed disabled:text-[#94a9ba]"
        >
          {logoutPending ? "Saindo..." : "Sair"}
        </button>
      </div>
    </div>
  );
}

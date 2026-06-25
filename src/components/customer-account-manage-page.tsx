import Link from "next/link";
import { CustomerAccountPanel } from "@/components/customer-account-panel";
import { IngressoShell } from "@/components/ingresso-shell";
import type { AuthUser } from "@/lib/auth-contracts";

type CustomerAccountManagePageProps = {
  mode: "profile" | "password";
  user: AuthUser;
};

export function CustomerAccountManagePage({
  mode,
  user,
}: CustomerAccountManagePageProps) {
  return (
    <IngressoShell active="account" user={user}>
      <div className="mx-auto w-full max-w-[1180px] px-4 pt-6 md:px-6">
        <div className="mt-6">
          <Link
            href="/minha-conta"
            className="legacy-rounded inline-flex rounded-full border border-[#c8d9e5] bg-white px-4 py-2 text-[14px] text-[#285878] shadow-[0_10px_26px_rgba(17,66,97,0.06)] hover:bg-[#f3f9fd]"
          >
            Voltar
          </Link>
        </div>

        <div className="mt-6">
          <CustomerAccountPanel mode={mode} />
        </div>
      </div>
    </IngressoShell>
  );
}

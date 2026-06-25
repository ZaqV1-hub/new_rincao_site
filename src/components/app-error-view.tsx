"use client";

import Link from "next/link";

type AppErrorViewProps = {
  title?: string;
  message?: string;
  showReload?: boolean;
  onReload?: () => void;
};

export function AppErrorView({
  title = "Nao foi possivel carregar esta pagina.",
  message = "Ocorreu um erro inesperado. Atualize a pagina ou volte para continuar a navegacao.",
  showReload = true,
  onReload,
}: AppErrorViewProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f9fc] px-4 py-10">
      <div className="w-full max-w-[720px] rounded-[30px] border border-[#d8e6f0] bg-white p-8 text-center shadow-[0_18px_48px_rgba(17,66,97,0.11)]">
        <p className="legacy-rounded text-[12px] uppercase tracking-[0.28em] text-[#7b94a6]">
          Erro de navegacao
        </p>
        <h1 className="legacy-rounded mt-4 text-[30px] leading-tight text-[#1c5a80]">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-8 text-[#5f768a]">
          {message}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {showReload ? (
            <button
              type="button"
              onClick={onReload}
              className="legacy-rounded inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#3394d6] px-6 py-3 text-[15px] text-white shadow-[2px_2px_4px_rgba(0,0,0,0.2)] transition hover:bg-[#246b99]"
            >
              Tentar novamente
            </button>
          ) : null}
          <Link
            href="/"
            className="legacy-rounded inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#c8d9e5] bg-white px-6 py-3 text-[15px] text-[#285878] shadow-[0_10px_26px_rgba(17,66,97,0.06)] hover:bg-[#f3f9fd]"
          >
            Voltar para o site
          </Link>
        </div>
      </div>
    </div>
  );
}

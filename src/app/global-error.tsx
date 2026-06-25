"use client";

import { useEffect } from "react";
import { AppErrorView } from "@/components/app-error-view";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({
  error,
  reset,
}: GlobalErrorPageProps) {
  useEffect(() => {
    console.error("app-global-error", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <AppErrorView
          title="Nao foi possivel carregar o aplicativo."
          message="Ocorreu um erro inesperado ao montar a pagina. Tente novamente ou volte para o site."
          onReload={reset}
        />
      </body>
    </html>
  );
}

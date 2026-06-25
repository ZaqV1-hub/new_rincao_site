"use client";

import { useEffect } from "react";
import { AppErrorView } from "@/components/app-error-view";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("app-route-error", error);
  }, [error]);

  return (
    <AppErrorView
      title="Nao foi possivel abrir esta area."
      message="Ocorreu um erro inesperado nesta rota. Tente recarregar a pagina ou volte para continuar a navegacao."
      onReload={reset}
    />
  );
}

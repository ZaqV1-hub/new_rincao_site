"use client";

import { EstanciaLogo } from "@/components/estancia-logo";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { IngressoShell } from "@/components/ingresso-shell";
import { formatCpf } from "@/lib/cpf";
import type {
  AuthErrorResponse,
  AuthLoginResponse,
} from "@/lib/auth-contracts";

type CustomerLoginPageProps = {
  redirectTo: string;
  initialError?: string | null;
};

export type CustomerLoginPhase = "idle" | "submitting" | "redirecting";

type CustomerLoginFeedback = {
  buttonLabel: string;
  statusTitle: string;
  statusDescription: string;
};

type CustomerLoginRouter = {
  replace: (href: string) => void;
  refresh?: () => void;
};

async function readResponseBody<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function getCustomerLoginFeedback(
  phase: CustomerLoginPhase,
): CustomerLoginFeedback {
  if (phase === "submitting") {
    return {
      buttonLabel: "Validando acesso...",
      statusTitle: "Entrando na sua conta",
      statusDescription:
        "Estamos validando suas credenciais e preparando a area do cliente.",
    };
  }

  if (phase === "redirecting") {
    return {
      buttonLabel: "Abrindo area do cliente...",
      statusTitle: "Login concluido",
      statusDescription:
        "Redirecionando voce para a pagina solicitada.",
    };
  }

  return {
    buttonLabel: "Entrar",
    statusTitle: "",
    statusDescription: "",
  };
}

export function navigateAfterCustomerLogin(
  router: CustomerLoginRouter,
  redirectTo: string,
) {
  router.replace(redirectTo);
}

export function CustomerLoginPage({
  redirectTo,
  initialError = null,
}: CustomerLoginPageProps) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [phase, setPhase] = useState<CustomerLoginPhase>("idle");
  const activePhase = isNavigating && phase === "idle" ? "redirecting" : phase;
  const feedback = getCustomerLoginFeedback(activePhase);
  const isBusy = activePhase !== "idle";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let keepBusy = false;

    setPhase("submitting");
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          login: cpf,
          senha: password,
        }),
      });

      const payload = await readResponseBody<
        AuthLoginResponse | AuthErrorResponse
      >(response);

      if (!response.ok || !payload?.ok) {
        setError(
          payload && !payload.ok
            ? payload.error.message
            : "Nao foi possivel entrar agora.",
        );
        return;
      }

      keepBusy = true;
      setPhase("redirecting");
      startTransition(() => {
        navigateAfterCustomerLogin(router, redirectTo);
      });
    } catch (requestError) {
      console.error("customer-login-submit-failed", requestError);
      setError("Nao foi possivel entrar agora.");
    } finally {
      if (!keepBusy) {
        setPhase("idle");
      }
    }
  }

  return (
    <IngressoShell active="auth">
      <div className="mx-auto w-full max-w-[760px] px-4 pt-8 md:px-6">
        <div className="estancia-card p-7 text-left md:p-8">
          <EstanciaLogo compact />
          <h2 className="mt-6 text-[32px] font-black leading-tight text-[#17351f]">
            Entrar
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#516956]">
            Acesse sua conta para continuar sua compra e consultar seus ingressos.
          </p>

          <form
            className="mt-6 space-y-4"
            method="post"
            action="/api/auth/login"
            onSubmit={handleSubmit}
            aria-busy={isBusy}
          >
            <label className="block">
              <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#688063]">
                CPF
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="username"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(event) => setCpf(formatCpf(event.target.value))}
                disabled={isBusy}
                className="estancia-field mt-2"
              />
            </label>

            <label className="block">
              <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#688063]">
                Senha
              </span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isBusy}
                className="estancia-field mt-2"
              />
            </label>

            <input type="hidden" name="redirect" value={redirectTo} />

            {isBusy ? (
              <div
                role="status"
                aria-live="polite"
                className="flex items-start gap-3 rounded-[22px] border border-[#dbe7d7] bg-[#f7fbf5] px-4 py-3 text-sm text-[#17351f]"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full border-2 border-[#2b8c46] border-t-transparent animate-spin"
                />
                <div>
                  <p className="font-semibold">{feedback.statusTitle}</p>
                  <p className="mt-1 text-[#516956]">{feedback.statusDescription}</p>
                </div>
              </div>
            ) : null}

            <div className="text-right text-sm">
              <Link href="/login/esqueci" className="font-semibold text-[#2b8c46] underline">
                esqueci minha senha
              </Link>
            </div>

            {error ? (
              <div className="rounded-[20px] border border-[#efc3c3] bg-[#fff3f1] px-4 py-3 text-sm text-[#9f3f36]">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isBusy}
              className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[999px] bg-[#2b8c46] px-5 py-3 text-[15px] font-black text-white shadow-[0_12px_25px_rgba(43,140,70,0.24)] hover:bg-[#1f6b36] disabled:cursor-wait disabled:bg-[#8ebf88]"
            >
              {isBusy ? (
                <span
                  aria-hidden="true"
                  className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"
                />
              ) : null}
              {feedback.buttonLabel}
            </button>
          </form>

          <div className="mt-5 rounded-[22px] border border-[#dbe7d7] bg-[#f7fbf5] px-4 py-4 text-sm text-[#516956]">
            <p>
              Ainda nao tem cadastro?
              {" "}
              <Link
                href={`/cadastro?redirect=${encodeURIComponent(redirectTo)}`}
                className="font-semibold text-[#2b8c46] underline"
              >
                Criar conta
              </Link>
            </p>
          </div>
        </div>
      </div>
    </IngressoShell>
  );
}

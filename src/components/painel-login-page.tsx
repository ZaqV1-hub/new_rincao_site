"use client";

import { EstanciaLogo } from "@/components/estancia-logo";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatCpf, isValidCpf, sanitizeCpf } from "@/lib/cpf";

type PainelLoginPageProps = {
  redirectTo: string;
  recaptchaSiteKey: string | null;
  initialError?: string | null;
};

type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type ApiSuccess = {
  ok: true;
  data: {
    authenticated: boolean;
    actorName: string | null;
    actorCpf: string | null;
    role: string;
    permissions: string[];
    authSource: "panel" | "token";
    legacyRoleId: number | null;
    legacyRoleName: string | null;
    legacyResources: string[];
    defaultRedirect: string;
  };
};

export type PainelLoginPhase = "idle" | "submitting" | "redirecting";

type PainelLoginFeedback = {
  buttonLabel: string;
  statusTitle: string;
  statusDescription: string;
};

type PainelLoginRouter = {
  replace: (href: string) => void;
  refresh?: () => void;
};

declare global {
  interface Window {
    grecaptcha?: {
      ready(callback: () => void): void;
      execute(siteKey: string, options: { action: string }): Promise<string>;
    };
  }
}

async function readResponseBody<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function resolveRecaptchaToken(siteKey: string) {
  if (typeof window === "undefined" || !window.grecaptcha) {
    throw new Error("recaptcha_not_loaded");
  }

  await new Promise<void>((resolve) => {
    window.grecaptcha?.ready(() => resolve());
  });

  return window.grecaptcha.execute(siteKey, {
    action: "login",
  });
}

export function getPainelLoginFeedback(
  phase: PainelLoginPhase,
): PainelLoginFeedback {
  if (phase === "submitting") {
    return {
      buttonLabel: "Validando acesso...",
      statusTitle: "Entrando no painel",
      statusDescription:
        "Estamos validando suas credenciais e preparando a sua sessao.",
    };
  }

  if (phase === "redirecting") {
    return {
      buttonLabel: "Abrindo painel...",
      statusTitle: "Login concluido",
      statusDescription: "Redirecionando voce para a area interna do painel.",
    };
  }

  return {
    buttonLabel: "Entrar",
    statusTitle: "",
    statusDescription: "",
  };
}

export function navigateAfterPainelLogin(
  router: PainelLoginRouter,
  redirectTo: string,
  defaultRedirect: string,
) {
  router.replace(redirectTo === "/painel" ? defaultRedirect : redirectTo);
}

export function PainelLoginPage({
  redirectTo,
  recaptchaSiteKey,
  initialError = null,
}: PainelLoginPageProps) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [phase, setPhase] = useState<PainelLoginPhase>("idle");
  const activePhase = isNavigating && phase === "idle" ? "redirecting" : phase;
  const feedback = getPainelLoginFeedback(activePhase);
  const isBusy = activePhase !== "idle";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCpf = sanitizeCpf(cpf);

    const isPanelSeedLogin = normalizedCpf === "22181922845";
    if ((!isValidCpf(normalizedCpf) && !isPanelSeedLogin) || password.length < 1 || password.length > 20) {
      setError("CPF ou senha invalidos.");
      return;
    }

    let keepBusy = false;

    setPhase("submitting");
    setError(null);

    try {
      const recaptchaToken = recaptchaSiteKey
        ? await resolveRecaptchaToken(recaptchaSiteKey)
        : null;
      const response = await fetch("/api/painel/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          login: normalizedCpf,
          senha: password,
          recaptchaToken,
        }),
      });
      const payload = await readResponseBody<ApiSuccess | ApiError>(response);

      if (!response.ok || !payload?.ok) {
        setError(
          payload && !payload.ok
            ? payload.error.message
            : "Nao foi possivel abrir a sessao do painel agora.",
        );
        return;
      }

      keepBusy = true;
      setPhase("redirecting");
      startTransition(() => {
        navigateAfterPainelLogin(
          router,
          redirectTo,
          payload.data.defaultRedirect,
        );
      });
    } catch (requestError) {
      console.error("painel-login-submit-failed", requestError);
      setError("Nao foi possivel abrir a sessao do painel agora.");
    } finally {
      if (!keepBusy) {
        setPhase("idle");
      }
    }
  }

  return (
    <section className="min-h-screen bg-[linear-gradient(180deg,#f4f8f1_0%,#ffffff_300px)] px-4 py-8 md:px-6">
      {recaptchaSiteKey ? (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(
            recaptchaSiteKey,
          )}`}
          strategy="afterInteractive"
        />
      ) : null}
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[760px] items-center">
        <div className="w-full rounded-[28px] border border-[#dbe7d7] bg-white p-8 shadow-[0_22px_52px_rgba(24,67,34,0.12)] md:p-10">
          <EstanciaLogo compact />
          <h2 className="mt-6 text-[38px] font-black text-[#17351f]">Entrar</h2>
          <p className="mt-2 text-sm leading-6 text-[#516956]">
            Acesse o painel operacional.
          </p>

          <form
            className="mt-6 grid gap-4"
            method="post"
            action="/api/painel/session"
            onSubmit={handleSubmit}
            aria-busy={isBusy}
          >
            <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
              CPF
              <input
                type="text"
                inputMode="numeric"
                autoComplete="username"
                name="login"
                value={cpf}
                onChange={(event) => setCpf(formatCpf(event.target.value))}
                placeholder="000.000.000-00"
                disabled={isBusy}
                className="estancia-field"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-[#35576f]">
              Senha
              <input
                type="password"
                autoComplete="current-password"
                name="senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Sua senha"
                disabled={isBusy}
                className="estancia-field"
              />
            </label>

            <input type="hidden" name="redirect" value={redirectTo} />

            {isBusy ? (
              <div
                role="status"
                aria-live="polite"
                className="flex items-start gap-3 rounded-2xl border border-[#dbe7d7] bg-[#f7fbf5] px-4 py-3 text-sm text-[#17351f]"
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

            {error ? (
              <div className="rounded-xl border border-[#efc3c3] bg-[#fff3f1] px-4 py-3 text-sm text-[#9f3f36]">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isBusy}
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-[#2b8c46] px-5 py-3 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
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

          <div className="mt-4 text-sm">
            <a
              href="/painel/login/esqueci"
              className="font-semibold text-[#2b8c46] hover:text-[#1f6b36]"
            >
              esqueci minha senha
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

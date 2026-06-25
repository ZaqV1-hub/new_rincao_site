"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IngressoShell } from "@/components/ingresso-shell";
import { formatCpf } from "@/lib/cpf";

async function readResponseBody<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export function CustomerForgotPasswordPage() {
  const [cpf, setCpf] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccessEmail(null);

    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          cpf,
        }),
      });
      const payload = await readResponseBody<
        | {
            ok: true;
            data: {
              sent: true;
              email: string;
            };
          }
        | ApiError
      >(response);

      if (!response.ok || !payload?.ok) {
        setError(
          payload && !payload.ok
            ? payload.error.message
            : "Nao foi possivel processar a recuperacao agora.",
        );
        return;
      }

      setSuccessEmail(payload.data.email);
    } catch (requestError) {
      console.error("customer-password-reset-request-submit-failed", requestError);
      setError("Nao foi possivel processar a recuperacao agora.");
    } finally {
      setPending(false);
    }
  }

  return (
    <IngressoShell active="auth">
      <div className="mx-auto w-full max-w-[760px] px-4 pt-8 md:px-6">
        <div className="rounded-[30px] border border-[#d8e6f0] bg-white p-7 text-left shadow-[0_18px_48px_rgba(17,66,97,0.11)]">
          <h2 className="legacy-rounded text-[27px] leading-tight text-[#1c5a80]">
            Esqueci minha senha
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#4d6477]">
            Informe o CPF do cadastro para receber por e-mail um ticket de troca de senha.
          </p>

          {successEmail ? (
            <div className="mt-6 rounded-[20px] border border-[#c9e3c5] bg-[#f3fff1] px-4 py-3 text-sm text-[#3d6940]">
              Uma nova instrucao foi enviada para o e-mail <strong>{successEmail}</strong>.
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                  CPF
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(event) => setCpf(formatCpf(event.target.value))}
                  className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
                />
              </label>

              {error ? (
                <div className="rounded-[20px] border border-[#efc3c3] bg-[#fff3f1] px-4 py-3 text-sm text-[#9f3f36]">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className="legacy-rounded inline-flex min-h-[48px] w-full items-center justify-center rounded-[999px] bg-[#3498db] px-5 py-3 text-[15px] text-white shadow-[0_12px_25px_rgba(52,152,219,0.24)] hover:bg-[#246b99] disabled:cursor-not-allowed disabled:bg-[#8abfe7]"
              >
                {pending ? "Enviando..." : "Enviar"}
              </button>
            </form>
          )}

          <div className="mt-5 rounded-[22px] border border-[#d8e6f0] bg-[#f7fbfe] px-4 py-4 text-sm text-[#4d6477]">
            <Link href="/login" className="font-semibold text-[#246b99] underline">
              retornar para o login
            </Link>
          </div>
        </div>
      </div>
    </IngressoShell>
  );
}

type CustomerResetPasswordPageProps = {
  ticket: string;
  initialValid: boolean;
};

export function CustomerResetPasswordPage({
  ticket,
  initialValid,
}: CustomerResetPasswordPageProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(
    initialValid ? null : "Ticket para troca de senha invalido.",
  );
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!initialValid) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/auth/password-reset/tickets/${encodeURIComponent(ticket)}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            senha: password,
            csenha: confirmPassword,
          }),
        },
      );
      const payload = await readResponseBody<
        | {
            ok: true;
            data: {
              changed: true;
            };
          }
        | ApiError
      >(response);

      if (!response.ok || !payload?.ok) {
        setError(
          payload && !payload.ok
            ? payload.error.message
            : "Nao foi possivel alterar a senha agora.",
        );
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch (requestError) {
      console.error("customer-password-reset-ticket-submit-failed", requestError);
      setError("Nao foi possivel alterar a senha agora.");
    } finally {
      setPending(false);
    }
  }

  return (
    <IngressoShell active="auth">
      <div className="mx-auto w-full max-w-[760px] px-4 pt-8 md:px-6">
        <div className="rounded-[30px] border border-[#d8e6f0] bg-white p-7 text-left shadow-[0_18px_48px_rgba(17,66,97,0.11)]">
          <h2 className="legacy-rounded text-[27px] leading-tight text-[#1c5a80]">
            Trocar senha
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#4d6477]">
            Use o ticket recebido por e-mail para definir uma nova senha de acesso.
          </p>

          {success ? (
            <div className="mt-6 rounded-[20px] border border-[#c9e3c5] bg-[#f3fff1] px-4 py-3 text-sm text-[#3d6940]">
              Sua senha foi alterada com sucesso. Utilize-a para acessar a area do cliente.
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                  Nova senha
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  maxLength={120}
                  className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
                />
              </label>

              <label className="block">
                <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                  Confirmar senha
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  maxLength={120}
                  className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
                />
              </label>

              {error ? (
                <div className="rounded-[20px] border border-[#efc3c3] bg-[#fff3f1] px-4 py-3 text-sm text-[#9f3f36]">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={pending || !initialValid}
                className="legacy-rounded inline-flex min-h-[48px] w-full items-center justify-center rounded-[999px] bg-[#3498db] px-5 py-3 text-[15px] text-white shadow-[0_12px_25px_rgba(52,152,219,0.24)] hover:bg-[#246b99] disabled:cursor-not-allowed disabled:bg-[#8abfe7]"
              >
                {pending ? "Salvando..." : "Salvar nova senha"}
              </button>
            </form>
          )}

          <div className="mt-5 rounded-[22px] border border-[#d8e6f0] bg-[#f7fbfe] px-4 py-4 text-sm text-[#4d6477]">
            <Link href="/login" className="font-semibold text-[#246b99] underline">
              voltar ao login
            </Link>
          </div>
        </div>
      </div>
    </IngressoShell>
  );
}

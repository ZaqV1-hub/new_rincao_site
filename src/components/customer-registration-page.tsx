"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IngressoShell } from "@/components/ingresso-shell";
import type {
  AuthErrorResponse,
  AuthRegistrationResponse,
} from "@/lib/auth-contracts";
import type {
  CustomerRegistrationCepResponse,
  CustomerRegistrationLocationsResponse,
} from "@/lib/customer-registration-contracts";
import { formatCpf } from "@/lib/cpf";

type CustomerRegistrationPageProps = {
  redirectTo: string;
};

type RegistrationFormState = {
  cpf: string;
  password: string;
  confirmPassword: string;
  name: string;
  email: string;
  rg: string;
  birthDate: string;
  sex: string;
  phone: string;
  mobile: string;
  address: string;
  number: string;
  cep: string;
  district: string;
  uf: string;
  cityId: string;
  complement: string;
};

const initialFormState: RegistrationFormState = {
  cpf: "",
  password: "",
  confirmPassword: "",
  name: "",
  email: "",
  rg: "",
  birthDate: "",
  sex: "",
  phone: "",
  mobile: "",
  address: "",
  number: "",
  cep: "",
  district: "",
  uf: "",
  cityId: "",
  complement: "",
};

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

async function readResponseBody<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function readApiError(response: Response, fallback: string) {
  const payload = await readResponseBody<AuthErrorResponse>(response);

  if (payload && !payload.ok) {
    return payload.error.message;
  }

  return fallback;
}

export function CustomerRegistrationPage({
  redirectTo,
}: CustomerRegistrationPageProps) {
  const router = useRouter();
  const [form, setForm] = useState<RegistrationFormState>(initialFormState);
  const [ufs, setUfs] = useState<Array<{ id: string; name: string }>>([]);
  const [cities, setCities] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [cityLoading, setCityLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLocations() {
      setLoading(true);

      try {
        const response = await fetch("/api/auth/registration-data", {
          cache: "no-store",
        });
        const payload =
          await readResponseBody<CustomerRegistrationLocationsResponse>(response);

        if (!response.ok || !payload?.ok) {
          setError(
            await readApiError(
              response,
              "Nao foi possivel carregar os dados de cadastro agora.",
            ),
          );
          return;
        }

        if (!active) {
          return;
        }

        setUfs(payload.data.ufs);
      } catch (requestError) {
        console.error("customer-registration-locations-load-failed", requestError);
        setError("Nao foi possivel carregar os dados de cadastro agora.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadLocations();

    return () => {
      active = false;
    };
  }, []);

  async function loadCities(nextUf: string) {
    if (!nextUf) {
      setCities([]);
      return;
    }

    setCityLoading(true);

    try {
      const response = await fetch(
        `/api/auth/registration-data?uf=${encodeURIComponent(nextUf)}`,
        {
          cache: "no-store",
        },
      );
      const payload =
        await readResponseBody<CustomerRegistrationLocationsResponse>(response);

      if (!response.ok || !payload?.ok) {
        setError(
          await readApiError(
            response,
            "Nao foi possivel carregar as cidades agora.",
          ),
        );
        return;
      }

      setCities(payload.data.cities);
    } catch (requestError) {
      console.error("customer-registration-cities-load-failed", requestError);
      setError("Nao foi possivel carregar as cidades agora.");
    } finally {
      setCityLoading(false);
    }
  }

  async function handleCepLookup(rawCep: string) {
    const normalizedCep = rawCep.replace(/\D/g, "");

    if (normalizedCep.length !== 8) {
      return;
    }

    setCepLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/auth/cep?cep=${encodeURIComponent(normalizedCep)}`,
        {
          cache: "no-store",
        },
      );
      const payload = await readResponseBody<CustomerRegistrationCepResponse>(response);

      if (!response.ok || !payload?.ok) {
        setError(
          await readApiError(
            response,
            "Nao foi possivel consultar o CEP agora.",
          ),
        );
        return;
      }

      setForm((current) => ({
        ...current,
        cep: formatCep(payload.data.cep),
        address: payload.data.address,
        district: payload.data.district,
        uf: payload.data.uf.id,
        cityId: String(payload.data.city.id),
        complement: current.complement || payload.data.complement || "",
      }));
      setUfs((current) => {
        const alreadyIncluded = current.some(
          (option) => option.id === payload.data.uf.id,
        );

        if (alreadyIncluded) {
          return current;
        }

        return [payload.data.uf, ...current].sort((first, second) =>
          first.name.localeCompare(second.name),
        );
      });
      setCities((current) => {
        const alreadyIncluded = current.some(
          (option) => option.id === payload.data.city.id,
        );

        if (alreadyIncluded) {
          return current;
        }

        return [payload.data.city, ...current].sort((first, second) =>
          first.name.localeCompare(second.name),
        );
      });
    } catch (requestError) {
      console.error("customer-registration-cep-lookup-failed", requestError);
      setError("Nao foi possivel consultar o CEP agora.");
    } finally {
      setCepLoading(false);
    }
  }

  function updateField(field: keyof RegistrationFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          cpf: form.cpf.replace(/\D/g, ""),
          cep: form.cep.replace(/\D/g, ""),
          cityId: Number(form.cityId),
        }),
      });
      const payload = await readResponseBody<AuthRegistrationResponse>(response);

      if (!response.ok || !payload?.ok) {
        setError(
          await readApiError(
            response,
            "Nao foi possivel concluir o cadastro agora.",
          ),
        );
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (requestError) {
      console.error("customer-registration-submit-failed", requestError);
      setError("Nao foi possivel concluir o cadastro agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IngressoShell active="auth">
      <div className="mx-auto w-full max-w-[960px] px-4 pt-8 md:px-6">
        <div className="rounded-[30px] border border-[#d8e6f0] bg-white p-7 text-left shadow-[0_18px_48px_rgba(17,66,97,0.11)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="legacy-rounded text-[27px] leading-tight text-[#1c5a80]">
                Cadastro do cliente
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#4d6477]">
                Preencha os mesmos dados pedidos no cadastro legado.
              </p>
            </div>

            <Link
              href={`/login?redirect=${encodeURIComponent(redirectTo)}`}
              className="legacy-rounded text-sm text-[#246b99] underline"
            >
              Ja tenho cadastro
            </Link>
          </div>

          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="block md:col-span-1">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                CPF
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={(event) => updateField("cpf", formatCpf(event.target.value))}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
              />
            </label>

            <label className="block md:col-span-1">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Nome completo
              </span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Senha
              </span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Confirmar senha
              </span>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) => updateField("confirmPassword", event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                E-mail
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                RG
              </span>
              <input
                type="text"
                value={form.rg}
                onChange={(event) => updateField("rg", event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Nascimento
              </span>
              <input
                type="date"
                value={form.birthDate}
                onChange={(event) => updateField("birthDate", event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Sexo
              </span>
              <select
                value={form.sex}
                onChange={(event) => updateField("sex", event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
              >
                <option value="">Selecione</option>
                <option value="f">Feminino</option>
                <option value="m">Masculino</option>
              </select>
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Telefone
              </span>
              <input
                type="text"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Celular
              </span>
              <input
                type="text"
                value={form.mobile}
                onChange={(event) => updateField("mobile", event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Endereco
              </span>
              <input
                type="text"
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Numero
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={form.number}
                onChange={(event) => updateField("number", event.target.value.replace(/\D/g, ""))}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                CEP
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={form.cep}
                onChange={(event) => {
                  const nextCep = formatCep(event.target.value);
                  updateField("cep", nextCep);

                  if (nextCep.replace(/\D/g, "").length !== 8) {
                    return;
                  }

                  void handleCepLookup(nextCep);
                }}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Bairro
              </span>
              <input
                type="text"
                value={form.district}
                onChange={(event) => updateField("district", event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Complemento
              </span>
              <input
                type="text"
                value={form.complement}
                onChange={(event) => updateField("complement", event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb]"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                UF
              </span>
              <select
                value={form.uf}
                disabled={loading || cepLoading}
                onChange={(event) => {
                  const nextUf = event.target.value;
                  updateField("uf", nextUf);
                  updateField("cityId", "");
                  void loadCities(nextUf);
                }}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb] disabled:opacity-60"
              >
                <option value="">Selecione</option>
                {ufs.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Cidade
              </span>
              <select
                value={form.cityId}
                disabled={!form.uf || cityLoading || cepLoading}
                onChange={(event) => updateField("cityId", event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:bg-white focus:ring-2 focus:ring-[#d2ecfb] disabled:opacity-60"
              >
                <option value="">
                  {cityLoading || cepLoading ? "Carregando..." : "Selecione"}
                </option>
                {cities.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            {error ? (
              <div className="rounded-[20px] border border-[#efc3c3] bg-[#fff3f1] px-4 py-3 text-sm text-[#9f3f36] md:col-span-2">
                {error}
              </div>
            ) : null}

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving || loading}
                className="legacy-rounded inline-flex min-h-[48px] w-full items-center justify-center rounded-[999px] bg-[#3498db] px-5 py-3 text-[15px] text-white shadow-[0_12px_25px_rgba(52,152,219,0.24)] hover:bg-[#246b99] disabled:cursor-not-allowed disabled:bg-[#8abfe7]"
              >
                {saving ? "Cadastrando..." : "Criar conta"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </IngressoShell>
  );
}

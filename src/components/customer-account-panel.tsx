"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AuthErrorResponse, AuthUser } from "@/lib/auth-contracts";
import type {
  CustomerProfile,
  CustomerProfileCitiesResponse,
  CustomerProfileResponse,
  CustomerProfileUfOption,
  CustomerProfileCityOption,
  CustomerProfilePasswordResponse,
} from "@/lib/customer-profile-contracts";

type CustomerAccountPanelProps = {
  onProfileSaved?: (user: AuthUser) => void;
  mode?: "all" | "profile" | "password";
};

type ProfileFormState = {
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

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const emptyPasswordState: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function toProfileForm(profile: CustomerProfile): ProfileFormState {
  return {
    name: profile.name,
    email: profile.email ?? "",
    rg: profile.rg ?? "",
    birthDate: profile.birthDate ?? "",
    sex: profile.sex ?? "",
    phone: profile.phone ?? "",
    mobile: profile.mobile ?? "",
    address: profile.address ?? "",
    number: profile.number ?? "",
    cep: profile.cep ?? "",
    district: profile.district ?? "",
    uf: profile.uf ?? "",
    cityId: profile.cityId ? String(profile.cityId) : "",
    complement: profile.complement ?? "",
  };
}

async function readResponseBody<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function readApiError(
  payload:
    | AuthErrorResponse
    | CustomerProfileResponse
    | CustomerProfileCitiesResponse
    | CustomerProfilePasswordResponse
    | null,
  fallback: string,
) {
  if (payload && !payload.ok) {
    return payload.error.message;
  }

  return fallback;
}

export function CustomerAccountPanel({
  onProfileSaved,
  mode = "all",
}: CustomerAccountPanelProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState | null>(null);
  const [ufs, setUfs] = useState<CustomerProfileUfOption[]>([]);
  const [cities, setCities] = useState<CustomerProfileCityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityLoading, setCityLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] =
    useState<PasswordFormState>(emptyPasswordState);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setProfileError(null);

      try {
        const response = await fetch("/api/me/profile", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
          return;
        }

        const payload = await readResponseBody<CustomerProfileResponse>(response);

        if (!response.ok || !payload?.ok) {
          setProfileError(
            readApiError(
              payload,
              "Nao foi possivel consultar o cadastro agora.",
            ),
          );
          return;
        }

        if (!active) {
          return;
        }

        setProfile(payload.data.profile);
        setProfileForm(toProfileForm(payload.data.profile));
        setUfs(payload.data.locations.ufs);
        setCities(payload.data.locations.cities);
      } catch (requestError) {
        if ((requestError as Error).name === "AbortError") {
          return;
        }

        console.error("customer-profile-load-failed", requestError);
        setProfileError("Nao foi possivel consultar o cadastro agora.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
      controller.abort();
    };
  }, [pathname, router]);

  async function loadCities(nextUf: string) {
    if (!nextUf) {
      setCities([]);
      return;
    }

    setCityLoading(true);

    try {
      const response = await fetch(`/api/me/profile/cities?uf=${nextUf}`, {
        cache: "no-store",
      });

      if (response.status === 401) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      const payload =
        await readResponseBody<CustomerProfileCitiesResponse>(response);

      if (!response.ok || !payload?.ok) {
        setProfileError(
          readApiError(
            payload,
            "Nao foi possivel consultar as cidades agora.",
          ),
        );
        return;
      }

      setCities(payload.data.cities);
    } catch (requestError) {
      console.error("customer-profile-cities-load-failed", requestError);
      setProfileError("Nao foi possivel consultar as cidades agora.");
    } finally {
      setCityLoading(false);
    }
  }

  function updateProfileField(
    field: keyof ProfileFormState,
    value: string,
  ) {
    setProfileForm((current) => (current ? { ...current, [field]: value } : current));
  }

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profileForm) {
      return;
    }

    setSaving(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...profileForm,
          cityId: Number(profileForm.cityId),
        }),
      });

      if (response.status === 401) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      const payload = await readResponseBody<CustomerProfileResponse>(response);

      if (!response.ok || !payload?.ok) {
        setProfileError(
          readApiError(
            payload,
            "Nao foi possivel atualizar o cadastro agora.",
          ),
        );
        return;
      }

      setProfile(payload.data.profile);
      setProfileForm(toProfileForm(payload.data.profile));
      setUfs(payload.data.locations.ufs);
      setCities(payload.data.locations.cities);
      setProfileSuccess("Cadastro atualizado com sucesso.");
      onProfileSaved?.({
        name: payload.data.profile.name,
        cpfMasked: payload.data.profile.cpfMasked,
        email: payload.data.profile.email,
      });
    } catch (requestError) {
      console.error("customer-profile-submit-failed", requestError);
      setProfileError("Nao foi possivel atualizar o cadastro agora.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const response = await fetch("/api/me/profile/password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(passwordForm),
      });

      if (response.status === 401) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      const payload =
        await readResponseBody<CustomerProfilePasswordResponse>(response);

      if (!response.ok || !payload?.ok) {
        setPasswordError(
          readApiError(
            payload,
            "Nao foi possivel alterar a senha agora.",
          ),
        );
        return;
      }

      setPasswordForm(emptyPasswordState);
      setPasswordSuccess("Senha alterada com sucesso.");
    } catch (requestError) {
      console.error("customer-profile-password-submit-failed", requestError);
      setPasswordError("Nao foi possivel alterar a senha agora.");
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {mode !== "password" ? (
          <section className="rounded-[28px] border border-[#d6e5ef] bg-white p-6 text-left shadow-[0_12px_30px_rgba(17,66,97,0.07)]">
            <h2 className="legacy-rounded text-[24px] text-[#1d5b80]">
              Meu cadastro
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#587184]">
              Carregando seus dados...
            </p>
          </section>
        ) : null}
        {mode !== "profile" ? (
          <section className="rounded-[28px] border border-[#d6e5ef] bg-white p-6 text-left shadow-[0_12px_30px_rgba(17,66,97,0.07)]">
            <h2 className="legacy-rounded text-[24px] text-[#1d5b80]">
              Alterar senha
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#587184]">
              Carregando seus dados...
            </p>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mode !== "password" ? (
      <section className="rounded-[28px] border border-[#d6e5ef] bg-white p-6 text-left shadow-[0_12px_30px_rgba(17,66,97,0.07)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="legacy-rounded text-[24px] text-[#1d5b80]">
              Meu cadastro
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#587184]">
              Atualize seus dados de cadastro.
            </p>
          </div>
          {profile ? (
            <span className="rounded-full bg-[#eef7fc] px-4 py-2 text-xs uppercase tracking-[0.16em] text-[#5d7c94]">
              CPF {profile.cpfMasked}
            </span>
          ) : null}
        </div>

        {profileError ? (
          <div className="mt-4 rounded-[18px] border border-[#efc3c3] bg-[#fff3f1] px-4 py-3 text-sm text-[#9f3f36]">
            {profileError}
          </div>
        ) : null}

        {profileSuccess ? (
          <div className="mt-4 rounded-[18px] border border-[#cbe9d7] bg-[#eefaf2] px-4 py-3 text-sm text-[#287450]">
            {profileSuccess}
          </div>
        ) : null}

        {profileForm ? (
          <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleProfileSubmit}>
            <label className="block md:col-span-2">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Nome completo
              </span>
              <input
                type="text"
                value={profileForm.name}
                onChange={(event) => updateProfileField("name", event.target.value)}
                className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                E-mail
              </span>
              <input
                type="email"
                value={profileForm.email}
                onChange={(event) => updateProfileField("email", event.target.value)}
                className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                RG
              </span>
              <input
                type="text"
                value={profileForm.rg}
                onChange={(event) => updateProfileField("rg", event.target.value)}
                className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Nascimento
              </span>
              <input
                type="date"
                value={profileForm.birthDate}
                onChange={(event) =>
                  updateProfileField("birthDate", event.target.value)
                }
                className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Sexo
              </span>
              <select
                value={profileForm.sex}
                onChange={(event) => updateProfileField("sex", event.target.value)}
                className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
              >
                <option value="">Selecione</option>
                <option value="m">Masculino</option>
                <option value="f">Feminino</option>
              </select>
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Telefone
              </span>
              <input
                type="text"
                value={profileForm.phone}
                onChange={(event) => updateProfileField("phone", event.target.value)}
                className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Celular
              </span>
              <input
                type="text"
                value={profileForm.mobile}
                onChange={(event) => updateProfileField("mobile", event.target.value)}
                className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Endereco
              </span>
              <input
                type="text"
                value={profileForm.address}
                onChange={(event) =>
                  updateProfileField("address", event.target.value)
                }
                className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Numero
              </span>
              <input
                type="text"
                value={profileForm.number}
                onChange={(event) => updateProfileField("number", event.target.value)}
                className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Complemento
              </span>
              <input
                type="text"
                value={profileForm.complement}
                onChange={(event) =>
                  updateProfileField("complement", event.target.value)
                }
                className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Bairro
              </span>
              <input
                type="text"
                value={profileForm.district}
                onChange={(event) =>
                  updateProfileField("district", event.target.value)
                }
                className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                CEP
              </span>
              <input
                type="text"
                value={profileForm.cep}
                onChange={(event) => updateProfileField("cep", event.target.value)}
                className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
              />
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                UF
              </span>
              <select
                value={profileForm.uf}
                onChange={async (event) => {
                  const nextUf = event.target.value;
                  updateProfileField("uf", nextUf);
                  updateProfileField("cityId", "");
                  setProfileSuccess(null);
                  setProfileError(null);
                  await loadCities(nextUf);
                }}
                className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
              >
                <option value="">Selecione</option>
                {ufs.map((uf) => (
                  <option key={uf.id} value={uf.id}>
                    {uf.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
                Cidade
              </span>
              <select
                value={profileForm.cityId}
                onChange={(event) =>
                  updateProfileField("cityId", event.target.value)
                }
                disabled={cityLoading}
                className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {cityLoading ? "Carregando..." : "Selecione"}
                </option>
                {cities.map((city) => (
                  <option key={city.id} value={String(city.id)}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="md:col-span-2">
              <button type="submit" disabled={saving} className="legacy-button mt-0">
                {saving ? "salvando cadastro..." : "salvar cadastro"}
              </button>
            </div>
          </form>
        ) : null}
      </section>
      ) : null}

      {mode !== "profile" ? (
      <section className="rounded-[28px] border border-[#d6e5ef] bg-white p-6 text-left shadow-[0_12px_30px_rgba(17,66,97,0.07)]">
        <h2 className="legacy-rounded text-[24px] text-[#1d5b80]">
          Alterar senha
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#587184]">
          Defina uma nova senha de acesso.
        </p>

        {passwordError ? (
          <div className="mt-4 rounded-[18px] border border-[#efc3c3] bg-[#fff3f1] px-4 py-3 text-sm text-[#9f3f36]">
            {passwordError}
          </div>
        ) : null}

        {passwordSuccess ? (
          <div className="mt-4 rounded-[18px] border border-[#cbe9d7] bg-[#eefaf2] px-4 py-3 text-sm text-[#287450]">
            {passwordSuccess}
          </div>
        ) : null}

        <form className="mt-5 grid gap-4 md:grid-cols-3" onSubmit={handlePasswordSubmit}>
          <label className="block">
            <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
              Senha atual
            </span>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  currentPassword: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
            />
          </label>

          <label className="block">
            <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
              Nova senha
            </span>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  newPassword: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
            />
          </label>

          <label className="block">
            <span className="legacy-rounded text-[13px] uppercase tracking-[0.16em] text-[#658098]">
              Confirmar senha
            </span>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  confirmPassword: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-[20px] border border-[#c9d7e3] bg-[#f7fbfe] px-4 py-3 text-[15px] text-[#214d6b] outline-none"
            />
          </label>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={passwordSaving}
              className="legacy-button mt-0"
            >
              {passwordSaving ? "alterando senha..." : "alterar senha"}
            </button>
          </div>
        </form>
      </section>
      ) : null}
    </div>
  );
}

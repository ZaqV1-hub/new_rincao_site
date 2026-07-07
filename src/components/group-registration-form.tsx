"use client";

import { useState } from "react";
import { contact } from "@/lib/site-content";
import type { RegistrationFieldName } from "@/lib/group-registration-form-data";

type RegistrationFormProps = {
  slug: string;
  pageTitle: string;
  submitLabel: string;
};

type SubmitState =
  | {
      status: "idle";
      message: null;
      protocol?: never;
    }
  | {
      status: "submitting";
      message: string;
      protocol?: never;
    }
  | {
      status: "success";
      message: string;
      protocol: string;
    }
  | {
      status: "error";
      message: string;
      protocol?: never;
    };

const howHeardOptions = [
  "Internet",
  "Amigos",
  "Familiares",
  "Anuncio em Revista",
  "Anuncio na TV",
  "Anuncio Local",
];

const sexOptions = ["Selecione", "Masculino", "Feminino"];
const visitedParkOptions = [
  "Selecione",
  "Sim",
  "N\u00e3o",
  "N\u00e3o me lembro",
];

type FieldConfig = {
  label: string;
  name: RegistrationFieldName;
  required: boolean;
  type: "text" | "email" | "textarea" | "select";
  format?: "date" | "phone" | "mobile";
  placeholder?: string;
  options?: string[];
  width?: "full" | "half";
};

const groupFields: FieldConfig[] = [
  {
    label: "Nome do grupo",
    name: "groupName",
    required: true,
    type: "text",
    width: "full",
  },
];

const coordinatorFields: FieldConfig[] = [
  {
    label: "Nome do coordenador",
    name: "coordinatorName",
    required: true,
    type: "text",
    width: "full",
  },
  {
    label: "Data de nascimento",
    name: "birthDate",
    required: false,
    type: "text",
    format: "date",
    placeholder: "DD/MM/AAAA",
  },
  {
    label: "Telefone",
    name: "phone",
    required: false,
    type: "text",
    format: "phone",
    placeholder: "(99) 9999-9999",
  },
  {
    label: "Celular",
    name: "mobile",
    required: false,
    type: "text",
    format: "mobile",
    placeholder: "(99) 99999-9999",
  },
  {
    label: "E-mail",
    name: "email",
    required: true,
    type: "email",
  },
  {
    label: "Sexo",
    name: "sex",
    required: false,
    type: "select",
    options: sexOptions,
  },
  {
    label: "Como nos conheceu?",
    name: "howHeard",
    required: false,
    type: "select",
    options: howHeardOptions,
  },
  {
    label: "J\u00e1 veio ao parque?",
    name: "visitedParkBefore",
    required: true,
    type: "select",
    options: visitedParkOptions,
  },
];

const addressFields: FieldConfig[] = [
  {
    label: "Endereco completo",
    name: "address",
    required: true,
    type: "text",
    width: "full",
  },
  {
    label: "Numero",
    name: "number",
    required: true,
    type: "text",
  },
  {
    label: "CEP",
    name: "cep",
    required: true,
    type: "text",
  },
  {
    label: "Bairro",
    name: "district",
    required: true,
    type: "text",
  },
  {
    label: "Complemento",
    name: "complement",
    required: false,
    type: "text",
  },
  {
    label: "Cidade",
    name: "city",
    required: true,
    type: "text",
  },
  {
    label: "Estado",
    name: "state",
    required: true,
    type: "text",
  },
];

const requestFields: FieldConfig[] = [
  {
    label: "Data de interesse",
    name: "interestDate",
    required: false,
    type: "text",
    format: "date",
    placeholder: "DD/MM/AAAA",
  },
  {
    label: "Mensagem",
    name: "message",
    required: true,
    type: "textarea",
    width: "full",
  },
];

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatDateInput(value: string) {
  const digits = digitsOnly(value).slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatPhoneWithLength(value: string, localLength: 8 | 9) {
  const digits = digitsOnly(value).slice(0, localLength + 2);
  const areaCode = digits.slice(0, 2);
  const localNumber = digits.slice(2);

  if (!areaCode) {
    return "";
  }

  if (digits.length <= 2) {
    return `(${areaCode}`;
  }

  const firstChunkLength = localLength === 9 ? 5 : 4;
  const firstChunk = localNumber.slice(0, firstChunkLength);
  const secondChunk = localNumber.slice(firstChunkLength, localLength);

  if (!firstChunk) {
    return `(${areaCode}) `;
  }

  if (!secondChunk) {
    return `(${areaCode}) ${firstChunk}`;
  }

  return `(${areaCode}) ${firstChunk}-${secondChunk}`;
}

function formatPhoneInput(value: string) {
  const digits = digitsOnly(value).slice(0, 11);
  return formatPhoneWithLength(digits, digits.length > 10 ? 9 : 8);
}

function formatMobileInput(value: string) {
  return formatPhoneWithLength(value, 9);
}

function applyFieldFormat(value: string, format?: FieldConfig["format"]) {
  if (!format) {
    return value;
  }

  if (format === "date") {
    return formatDateInput(value);
  }

  if (format === "mobile") {
    return formatMobileInput(value);
  }

  return formatPhoneInput(value);
}

function Field({
  field,
  disabled,
}: {
  field: FieldConfig;
  disabled: boolean;
}) {
  const wrapperClassName = field.width === "full" ? "md:col-span-2" : "";
  const controlClassName =
    "rincao-field min-h-[52px] w-full bg-[#f9fbfd] px-4 text-[14px] text-[#12344f] shadow-none";

  return (
    <div className={wrapperClassName}>
      <label
        htmlFor={field.name}
        className="mb-2 block text-[12px] font-bold uppercase tracking-[0.18em] text-[#5f84a7]"
      >
        {field.label}
        {field.required ? <span className="ml-1 text-[#d25c43]">*</span> : null}
      </label>

      {field.type === "textarea" ? (
        <textarea
          id={field.name}
          name={field.name}
          required={field.required}
          rows={7}
          disabled={disabled}
          placeholder={field.placeholder}
          className={`${controlClassName} min-h-[170px] py-3`}
        />
      ) : field.type === "select" ? (
        <select
          id={field.name}
          name={field.name}
          required={field.required}
          defaultValue={field.options?.[0]}
          disabled={disabled}
          className={`${controlClassName} appearance-none`}
        >
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={field.name}
          name={field.name}
          type={field.type}
          required={field.required}
          placeholder={field.placeholder}
          disabled={disabled}
          inputMode={field.format ? "numeric" : undefined}
          maxLength={field.format === "date" ? 10 : field.format ? 15 : undefined}
          onInput={(event) => {
            event.currentTarget.value = applyFieldFormat(
              event.currentTarget.value,
              field.format,
            );
          }}
          className={controlClassName}
        />
      )}
    </div>
  );
}

function FormSection({
  title,
  description,
  fields,
  disabled,
}: {
  title: string;
  description?: string;
  fields: FieldConfig[];
  disabled: boolean;
}) {
  return (
    <section className="rounded-[24px] border border-[#d8e2eb] bg-[#f6f8fb] p-5 md:p-6">
      <h3 className="font-[var(--font-salsa)] text-[1.7rem] leading-none text-[#12344f]">
        {title}
      </h3>
      {description ? (
        <p className="mt-3 text-[0.95rem] leading-7 text-[#5c7488]">
          {description}
        </p>
      ) : null}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <Field key={field.name} field={field} disabled={disabled} />
        ))}
      </div>
    </section>
  );
}

function buildPayload(formData: FormData, slug: string, pageTitle: string) {
  return {
    slug,
    pageTitle,
    website: String(formData.get("website") ?? ""),
    groupName: String(formData.get("groupName") ?? ""),
    coordinatorName: String(formData.get("coordinatorName") ?? ""),
    birthDate: String(formData.get("birthDate") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    mobile: String(formData.get("mobile") ?? ""),
    email: String(formData.get("email") ?? ""),
    sex: String(formData.get("sex") ?? ""),
    howHeard: String(formData.get("howHeard") ?? ""),
    visitedParkBefore: String(formData.get("visitedParkBefore") ?? ""),
    address: String(formData.get("address") ?? ""),
    number: String(formData.get("number") ?? ""),
    cep: String(formData.get("cep") ?? ""),
    district: String(formData.get("district") ?? ""),
    complement: String(formData.get("complement") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    interestDate: String(formData.get("interestDate") ?? ""),
    message: String(formData.get("message") ?? ""),
  };
}

export function GroupRegistrationForm({
  slug,
  pageTitle,
  submitLabel,
}: RegistrationFormProps) {
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    message: null,
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setSubmitState({
      status: "submitting",
      message: "Registrando sua solicitacao...",
    });

    try {
      const response = await fetch("/api/group-registrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayload(formData, slug, pageTitle)),
      });

      const result = (await response.json()) as {
        ok: boolean;
        error?: string;
        protocol?: string;
      };

      if (!response.ok || !result.ok || !result.protocol) {
        setSubmitState({
          status: "error",
          message:
            result.error ??
            "Nao foi possivel registrar sua solicitacao agora. Tente novamente em instantes.",
        });
        return;
      }

      form.reset();
      setSubmitState({
        status: "success",
        message:
          "Solicitacao registrada com sucesso. Nossa equipe recebeu os dados e pode continuar o atendimento a partir deste protocolo.",
        protocol: result.protocol,
      });
    } catch {
      setSubmitState({
        status: "error",
        message:
          "Nao foi possivel registrar sua solicitacao agora. Tente novamente em instantes.",
      });
    }
  }

  const isSubmitting = submitState.status === "submitting";

  if (submitState.status === "success") {
    return (
      <section className="text-left">
        <div className="rounded-[24px] bg-[#1d6fb8] px-6 py-5 text-center text-[1.35rem] font-bold text-white">
          Solicitacao registrada com sucesso.
        </div>
        <div className="mt-6 rounded-[24px] border border-[#d8e2eb] bg-[#f6f8fb] p-6">
          <h3 className="font-[var(--font-salsa)] text-[1.7rem] leading-none text-[#12344f]">
            Atendimento iniciado
          </h3>
          <p className="mt-4 max-w-[780px] text-[0.98rem] leading-8 text-[#36586f]">
            {submitState.message}
          </p>
          <p className="mt-4 text-[0.98rem] leading-8 text-[#36586f]">
            <strong className="text-[0.92rem] uppercase tracking-[0.16em] text-[#5f84a7]">
              Protocolo:
            </strong>{" "}
            {submitState.protocol}
          </p>
          <p className="text-[0.98rem] leading-8 text-[#36586f]">
            WhatsApp: {contact.whatsapp.replace("https://wa.me/", "+55 ")} · E-mail:{" "}
            {contact.email}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rincao-button-secondary"
            onClick={() =>
              setSubmitState({
                status: "idle",
                message: null,
              })
            }
          >
            Registrar outro grupo
          </button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-left">
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <FormSection
            title="Dados do grupo"
            fields={groupFields}
            disabled={isSubmitting}
          />
          <FormSection
            title="Dados do coordenador"
            fields={coordinatorFields}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-6">
          <FormSection
            title="Endereco do coordenador"
            fields={addressFields}
            disabled={isSubmitting}
          />
          <FormSection
            title="Solicitar orcamento ou tirar duvida"
            description="O envio registra sua solicitacao no atendimento institucional e gera um protocolo para acompanhamento."
            fields={requestFields}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="rounded-[24px] border border-[#d8e2eb] bg-[#f6f8fb] p-5">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rincao-button min-w-[240px] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Registrando..." : submitLabel}
        </button>
        {submitState.status === "error" ? (
          <p className="mt-4 rounded-[18px] bg-[#fde7df] px-4 py-3 text-[0.92rem] leading-7 text-[#8d2a16]">
            {submitState.message}
          </p>
        ) : null}
        {submitState.status === "submitting" ? (
          <p className="mt-4 rounded-[18px] bg-[#e6f1fa] px-4 py-3 text-[0.92rem] leading-7 text-[#1d587e]">
            {submitState.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

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
      whatsappUrl?: never;
    }
  | {
      status: "submitting";
      message: string;
      protocol?: never;
      whatsappUrl?: never;
    }
  | {
      status: "success";
      message: string;
      protocol: string;
      whatsappUrl: string;
    }
  | {
      status: "error";
      message: string;
      protocol?: never;
      whatsappUrl?: never;
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

type FieldConfig = {
  label: string;
  name: RegistrationFieldName;
  required: boolean;
  type: "text" | "email" | "textarea" | "select";
  placeholder?: string;
  options?: string[];
  width?: "full" | "half";
  date?: boolean;
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
    label: "Data nascimento",
    name: "birthDate",
    required: false,
    type: "text",
    placeholder: "DD/MM/AAAA",
    date: true,
  },
  {
    label: "Telefone",
    name: "phone",
    required: false,
    type: "text",
    placeholder: "(99) 9999-9999",
  },
  {
    label: "Celular",
    name: "mobile",
    required: false,
    type: "text",
    placeholder: "(99) 9999-9999",
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
    required: true,
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
    placeholder: "DD/MM/AAAA",
    date: true,
  },
  {
    label: "Mensagem",
    name: "message",
    required: true,
    type: "textarea",
    width: "full",
  },
];

function renderField(field: FieldConfig, disabled: boolean) {
  const isFull = field.width === "full";
  const fieldClassName = [
    "mb-[14px] float-left text-left",
    isFull ? "w-full" : "w-full md:w-1/2",
  ].join(" ");
  const controlClassName = [
    "h-10 rounded border-2 border-white bg-[#ebebeb] px-[5px] text-[13px] text-[#333] shadow-[2px_2px_4px_rgba(0,0,0,0.1)] outline-none transition focus:bg-[#ddd] disabled:cursor-not-allowed disabled:bg-[#f2f2f2]",
    isFull ? "w-full md:w-[97%]" : "w-full md:w-[95%]",
    field.date ? "bg-[url('/theme/calendar.png')] bg-[right_center] bg-no-repeat pr-10" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const label = (
    <label
      htmlFor={field.name}
      className="legacy-condensed float-left w-full text-[14px] font-bold uppercase leading-5 text-[#333]"
    >
      {field.label}
      {field.required ? <em className="ml-1 not-italic text-[#c30]">*</em> : null}
    </label>
  );

  if (field.type === "textarea") {
    return (
      <div key={field.name} className={fieldClassName}>
        {label}
        <textarea
          id={field.name}
          name={field.name}
          required={field.required}
          rows={7}
          disabled={disabled}
          className={`${controlClassName} h-20 min-h-20 py-[5px]`}
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div key={field.name} className={fieldClassName}>
        {label}
        <span
          className={[
            "float-left box-border h-10 rounded border-2 border-white bg-[#ebebeb] px-[10px] pt-1 shadow-[2px_2px_4px_rgba(0,0,0,0.1)]",
            isFull ? "w-full md:w-[97%]" : "w-full md:w-[95%]",
          ].join(" ")}
        >
          <select
            id={field.name}
            name={field.name}
            required={field.required}
            defaultValue={field.options?.[0]}
            disabled={disabled}
            className="float-left h-[30px] w-full appearance-none bg-transparent text-[13px] text-[#333] outline-none disabled:cursor-not-allowed"
          >
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </span>
      </div>
    );
  }

  return (
    <div key={field.name} className={fieldClassName}>
      {label}
      <input
        id={field.name}
        name={field.name}
        type={field.type}
        required={field.required}
        placeholder={field.placeholder}
        disabled={disabled}
        className={controlClassName}
      />
    </div>
  );
}

function FormColumn({
  side,
  children,
}: {
  side: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <section
      className={[
        "float-left box-border w-full py-5",
        side === "left"
          ? "px-4 md:pl-[5%] md:pr-[30px] lg:w-1/2"
          : "px-4 md:pl-[30px] md:pr-[5%] lg:w-1/2",
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function FormHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-[10px] text-left text-[20px] font-normal leading-6 text-[#7b5f3b]">
      {children}
    </h3>
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
        whatsappUrl?: string;
      };

      if (!response.ok || !result.ok || !result.protocol || !result.whatsappUrl) {
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
          "Solicitacao registrada com sucesso. Nossa equipe pode continuar o atendimento a partir deste protocolo.",
        protocol: result.protocol,
        whatsappUrl: result.whatsappUrl,
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

  return (
    <div className="flow-root w-full">
      {submitState.status === "success" ? (
        <section className="float-left w-full px-[5%] py-5 text-left">
          <div className="legacy-condensed box-border w-full bg-[#093] px-5 py-5 text-center text-[22px] font-bold text-white">
            Solicitacao registrada com sucesso.
          </div>
          <div className="mt-5 border-t border-[#eaeaea] pt-5">
            <FormHeading>Atendimento iniciado</FormHeading>
            <p className="max-w-[780px] text-[14px] leading-7 text-[#333]">
              {submitState.message}
            </p>
            <p className="mt-3 text-[14px] leading-7 text-[#333]">
              <strong className="legacy-condensed text-[18px] uppercase text-[#3393d6]">
                Protocolo:
              </strong>{" "}
              {submitState.protocol}
            </p>
            <p className="text-[14px] leading-7 text-[#333]">
              WhatsApp: {contact.whatsapp.replace("https://wa.me/", "+55 ")} · E-mail:{" "}
              {contact.email}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={submitState.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="legacy-button green text-center"
            >
              Continuar no WhatsApp
            </a>
            <button
              type="button"
              className="legacy-button text-center"
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
      ) : (
        <form onSubmit={handleSubmit} className="flow-root w-full text-left">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          <FormColumn side="left">
            <FormHeading>Dados do Grupo</FormHeading>
            <div className="float-left w-full">
              {groupFields.map((field) => renderField(field, isSubmitting))}
            </div>

            <FormHeading>Dados do Coordenador</FormHeading>
            <div className="float-left w-full">
              {coordinatorFields.map((field) => renderField(field, isSubmitting))}
            </div>
          </FormColumn>

          <FormColumn side="right">
            <FormHeading>Endereco do Coordenador</FormHeading>
            <div className="float-left w-full">
              {addressFields.map((field) => renderField(field, isSubmitting))}
            </div>

            <div className="float-left w-full">
              <FormHeading>Solicite um Orcamento / Duvida</FormHeading>
            </div>
            <div className="float-left w-full">
              {requestFields.map((field) => renderField(field, isSubmitting))}
            </div>
          </FormColumn>

          <div className="float-left mt-[10px] box-border w-full border-t border-[#eaeaea] px-[5%] pt-[10px] text-left">
              <button
                type="submit"
                disabled={isSubmitting}
              className="inline-block h-10 cursor-pointer rounded-full border-2 border-white bg-[#1f8a70] px-[15px] text-center font-[var(--font-varela-round)] text-[16px] leading-10 text-white shadow-[2px_2px_5px_rgba(0,0,0,0.2)] transition hover:bg-[#135b49] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Registrando..." : submitLabel}
              </button>
            <p className="mt-3 text-left text-[13px] leading-6 text-[#4d4d4d]">
                O envio registra sua solicitacao no atendimento institucional e gera um
                protocolo antes de qualquer contato por WhatsApp.
              </p>
              {submitState.status === "error" ? (
              <p className="mt-3 box-border w-full bg-[#f6d9cf] px-4 py-3 text-left text-[13px] leading-6 text-[#8d2a16]">
                  {submitState.message}
                </p>
              ) : null}
              {submitState.status === "submitting" ? (
              <p className="mt-3 box-border w-full bg-[#dceee8] px-4 py-3 text-left text-[13px] leading-6 text-[#135b49]">
                  {submitState.message}
                </p>
              ) : null}
          </div>
        </form>
      )}
    </div>
  );
}

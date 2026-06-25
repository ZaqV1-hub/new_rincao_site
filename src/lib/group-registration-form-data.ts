export type RegistrationFieldName =
  | "groupName"
  | "coordinatorName"
  | "birthDate"
  | "phone"
  | "mobile"
  | "email"
  | "sex"
  | "howHeard"
  | "address"
  | "number"
  | "cep"
  | "district"
  | "complement"
  | "city"
  | "state"
  | "interestDate"
  | "message";

export type RegistrationSubmissionInput = {
  slug: string;
  pageTitle: string;
} & Record<RegistrationFieldName, string>;

export const registrationFieldOrder: Array<{
  label: string;
  name: RegistrationFieldName;
}> = [
  { label: "Nome do grupo", name: "groupName" },
  { label: "Nome do coordenador", name: "coordinatorName" },
  { label: "Data nascimento", name: "birthDate" },
  { label: "Telefone", name: "phone" },
  { label: "Celular", name: "mobile" },
  { label: "E-mail", name: "email" },
  { label: "Sexo", name: "sex" },
  { label: "Como nos conheceu", name: "howHeard" },
  { label: "Endereco completo", name: "address" },
  { label: "Numero", name: "number" },
  { label: "CEP", name: "cep" },
  { label: "Bairro", name: "district" },
  { label: "Complemento", name: "complement" },
  { label: "Cidade", name: "city" },
  { label: "Estado", name: "state" },
  { label: "Data de interesse", name: "interestDate" },
  { label: "Mensagem", name: "message" },
];

export const requiredRegistrationFields: RegistrationFieldName[] = [
  "groupName",
  "coordinatorName",
  "email",
  "address",
  "number",
  "cep",
  "district",
  "city",
  "state",
  "message",
];

function normalizeValue(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export function sanitizeRegistrationInput(
  payload: Record<string, unknown>,
): RegistrationSubmissionInput {
  const sanitized = {
    slug: normalizeValue(payload.slug),
    pageTitle: normalizeValue(payload.pageTitle),
  } as RegistrationSubmissionInput;

  for (const field of registrationFieldOrder) {
    const value = normalizeValue(payload[field.name]);
    sanitized[field.name] = value === "Selecione" ? "" : value;
  }

  return sanitized;
}

export function validateRegistrationInput(input: RegistrationSubmissionInput) {
  const missingFields = requiredRegistrationFields.filter((field) => !input[field]);

  const uniqueMissingFields = Array.from(new Set(missingFields));

  const emailIsValid =
    !input.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email);

  return {
    valid:
      uniqueMissingFields.length === 0 &&
      emailIsValid &&
      Boolean(input.slug) &&
      Boolean(input.pageTitle),
    missingFields: uniqueMissingFields,
    emailIsValid,
  };
}

export function buildRegistrationWhatsappMessage(
  input: RegistrationSubmissionInput,
  protocol?: string,
) {
  const lines = registrationFieldOrder
    .map(({ label, name }) => {
      const value = input[name];

      if (!value) {
        return null;
      }

      return `*${label}:* ${value}`;
    })
    .filter(Boolean);

  return [
    "Solicitacao institucional registrada no site.",
    protocol ? `*Protocolo:* ${protocol}` : null,
    `*Pagina:* ${input.pageTitle}`,
    ...lines,
  ]
    .filter(Boolean)
    .join("\n");
}

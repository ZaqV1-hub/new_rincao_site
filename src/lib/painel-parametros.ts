import {
  asOpsAdminParametersError,
  listOpsAdminParameters,
  updateOpsAdminParameters,
} from "@/lib/ops-admin-parameters";

export type PainelParametroItem = {
  id: string;
  label: string;
  description: string;
  input: "textarea" | "password";
  required: boolean;
  value: string;
};

export type PainelParametroGroup = {
  key: "msgper" | "segadm";
  label: string;
  items: PainelParametroItem[];
};

export class PainelParametrosError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelParametrosError";
    this.code = code;
    this.status = status;
  }
}

function groupLabel(group: string) {
  if (group === "msgper") {
    return "Mensagem Personalizada";
  }

  if (group === "segadm") {
    return "Seguranca Administrativa";
  }

  return group;
}

export function asPainelParametrosError(error: unknown) {
  if (error instanceof PainelParametrosError) {
    return error;
  }

  const mapped = asOpsAdminParametersError(error);
  return new PainelParametrosError(mapped.code, mapped.message, mapped.status);
}

export async function listPainelParametros() {
  const parameters = await listOpsAdminParameters();
  const groups = new Map<string, PainelParametroGroup>();

  for (const parameter of parameters) {
    const existing =
      groups.get(parameter.group) ??
      ({
        key: parameter.group,
        label: groupLabel(parameter.group),
        items: [],
      } satisfies PainelParametroGroup);

    existing.items.push({
      id: parameter.id,
      label: parameter.label,
      description: parameter.description,
      input: parameter.input,
      required: parameter.required,
      value: parameter.value,
    });

    groups.set(parameter.group, existing);
  }

  return Array.from(groups.values());
}

export async function savePainelParametros(input: {
  parameters: Array<{ group?: string; id?: string; value?: string }>;
  actor?: {
    name?: string | null;
    cpf?: string | null;
  };
}) {
  return updateOpsAdminParameters({
    actor: input.actor,
    parameters: input.parameters,
  });
}

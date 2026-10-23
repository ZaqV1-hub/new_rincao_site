import { formatCpf, sanitizeCpf } from "@/lib/cpf";

export function formatEnfermariaCpf(value: string) {
  const digits = sanitizeCpf(value);
  return digits.length > 11 ? digits : formatCpf(digits);
}

export function formatEnfermariaPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const area = digits.slice(0, 2);
  const local = digits.slice(2);
  const prefixLength = local.length > 8 ? 5 : 4;
  return `(${area}) ${local.length > prefixLength ? `${local.slice(0, prefixLength)}-${local.slice(prefixLength)}` : local}`;
}

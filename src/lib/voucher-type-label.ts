const voucherTypeLabels: Record<string, string> = {
  norma: "Passaporte",
  infan: "Passaporte Infantil",
  isent: "de 0 a 3 anos",
  corte: "Cortesia",
  espec: "Especial",
  escol: "Escola",
};

export function resolveVoucherTypeLabel({
  description,
  type,
}: {
  description: string | null | undefined;
  type: string | null | undefined;
}) {
  const normalizedDescription = String(description ?? "").trim();

  if (normalizedDescription) {
    return normalizedDescription;
  }

  const normalizedType = String(type ?? "").trim();

  return normalizedType ? voucherTypeLabels[normalizedType] ?? normalizedType : "";
}

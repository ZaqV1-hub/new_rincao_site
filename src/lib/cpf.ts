export function sanitizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string) {
  const cpf = sanitizeCpf(value);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const digits = cpf.split("").map(Number);

  for (let position = 9; position <= 10; position += 1) {
    const sum = digits
      .slice(0, position)
      .reduce((total, digit, index) => total + digit * (position + 1 - index), 0);
    const checkDigit = ((sum * 10) % 11) % 10;

    if (digits[position] !== checkDigit) {
      return false;
    }
  }

  return true;
}

export function formatCpf(value: string) {
  const digits = sanitizeCpf(value).slice(0, 11);
  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 9),
    digits.slice(9, 11),
  ].filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  if (parts.length === 1) {
    return parts[0];
  }

  if (parts.length === 2) {
    return `${parts[0]}.${parts[1]}`;
  }

  if (parts.length === 3) {
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }

  return `${parts[0]}.${parts[1]}.${parts[2]}-${parts[3]}`;
}

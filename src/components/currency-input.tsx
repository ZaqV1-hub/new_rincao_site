"use client";

import { useState } from "react";

type CurrencyInputProps = {
  autoComplete?: string;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  name: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "password";
};

function toCurrencyDigits(value: string) {
  return value.replace(/\D+/g, "");
}

export function formatCurrencyInput(value: string) {
  const digits = toCurrencyDigits(value);
  const normalizedDigits = digits ? digits.replace(/^0+(?=\d)/, "") : "0";
  const cents = normalizedDigits.padStart(3, "0");
  const integerPart = cents.slice(0, -2) || "0";
  const decimalPart = cents.slice(-2);
  const whole = Number(`${integerPart}.${decimalPart}`);

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(whole);
}

export function parseCurrencyInput(value: string) {
  const digits = toCurrencyDigits(value);

  if (!digits) {
    return 0;
  }

  return Number(digits) / 100;
}

export function CurrencyInput({
  autoComplete = "off",
  className,
  defaultValue = "0,00",
  disabled,
  name,
  onValueChange,
  placeholder = "0,00",
  required,
  type = "text",
}: CurrencyInputProps) {
  const [value, setValue] = useState(() => formatCurrencyInput(defaultValue));

  return (
    <input
      autoComplete={autoComplete}
      className={className}
      disabled={disabled}
      inputMode="numeric"
      name={name}
      onChange={(event) => {
        const nextValue = formatCurrencyInput(event.target.value);
        setValue(nextValue);
        onValueChange?.(nextValue);
      }}
      placeholder={placeholder}
      required={required}
      type={type}
      value={value}
    />
  );
}

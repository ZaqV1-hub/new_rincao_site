"use client";

import { useState } from "react";

type DateInputProps = {
  autoComplete?: string;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
};

function toDateDigits(value: string) {
  return value.replace(/\D+/g, "").slice(0, 8);
}

export function formatDateInput(value: string) {
  const digits = toDateDigits(value);

  if (!digits) {
    return "";
  }

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function normalizeDateInputValue(value: string) {
  const digits = toDateDigits(value);

  if (digits.length !== 8) {
    return null;
  }

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCDate() !== day ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCFullYear() !== year
  ) {
    return null;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

export function toDateInputValue(value: string) {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  return formatDateInput(value);
}

export function DateInput({
  autoComplete = "off",
  className,
  defaultValue = "",
  disabled,
  id,
  name,
  onValueChange,
  placeholder = "dd/mm/aaaa",
  required,
}: DateInputProps) {
  const [value, setValue] = useState(() => toDateInputValue(defaultValue));

  return (
    <input
      autoComplete={autoComplete}
      className={className}
      disabled={disabled}
      id={id}
      inputMode="numeric"
      name={name}
      onChange={(event) => {
        const nextValue = formatDateInput(event.target.value);
        setValue(nextValue);
        onValueChange?.(nextValue);
      }}
      placeholder={placeholder}
      required={required}
      type="text"
      value={value}
    />
  );
}

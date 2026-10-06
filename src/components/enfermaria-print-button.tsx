"use client";

export function EnfermariaPrintButton({ label = "Imprimir / Salvar PDF" }: { label?: string }) {
  return <button onClick={() => window.print()} className="rounded-lg bg-[#176b96] px-4 py-2 text-sm font-semibold text-white">{label}</button>;
}

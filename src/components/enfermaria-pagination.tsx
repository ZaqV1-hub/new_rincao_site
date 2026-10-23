"use client";

export function EnfermariaPagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / 10));
  if (total <= 10) return null;
  return <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm" aria-label="Paginação dos atendimentos">
    <span className="text-slate-600">Mostrando {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} de {total} · Página {page} de {pages}</span>
    <div className="flex items-center gap-2">
      <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-[#183e63] disabled:cursor-not-allowed disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button>
      <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-[#183e63] disabled:cursor-not-allowed disabled:opacity-40" disabled={page >= pages} onClick={() => onChange(page + 1)}>Próxima</button>
    </div>
  </nav>;
}

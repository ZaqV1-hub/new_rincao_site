export default function LoadingAgendaDay() {
  return <section aria-busy="true" aria-label="Detalhes da data" className="rounded-xl border border-[#d9e3ee] bg-[#eaf2fb] p-6 text-[#0f2d52]">
    <h1 className="text-xl font-semibold">Abrindo detalhes da data</h1>
    <p role="status" className="mt-2 text-sm">Consultando resumo, passeios, compras, caixas e fechamento…</p>
  </section>;
}

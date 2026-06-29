import { GroupRegistrationForm } from "@/components/group-registration-form";
import type { RegistrationPageConfig } from "@/lib/group-registration-content";

export function RegistrationPage({ page }: { page: RegistrationPageConfig }) {
  return (
    <div className="bg-[#f6f8fb] text-[#12344f]">
      <section className="relative isolate overflow-hidden bg-[#12344f] px-5 pb-18 pt-[118px] text-white md:pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#3b6ea3_0%,#173b63_50%,#0d2234_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(8,18,28,0.18)_0%,rgba(8,18,28,0.08)_48%,rgba(8,18,28,0.22)_100%)]" />

        <div className="relative mx-auto max-w-[1240px] text-left">
          <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-white/64">
            Atendimento consultivo
          </p>
          <h1 className="mt-4 max-w-[760px] font-[var(--font-salsa)] text-[clamp(2.5rem,6vw,5rem)] leading-[0.95] text-white">
            {page.title}
          </h1>
          <p className="mt-6 max-w-[660px] text-[1rem] leading-8 text-white/78 md:text-[1.08rem]">
            {page.summary}
          </p>
        </div>
      </section>

      <section className="px-5 py-16 md:py-20">
        <div className="mx-auto max-w-[1240px]">
          <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-5">
              <div className="rounded-[28px] border border-[#d8e2eb] bg-white p-6 text-left shadow-[0_18px_40px_rgba(18,52,79,0.08)]">
                <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#5f84a7]">
                  Como funciona
                </p>
                <div className="mt-5 space-y-4">
                  <div className="rounded-[18px] bg-[#eef4f9] px-4 py-4">
                    <strong className="block text-[0.95rem] uppercase tracking-[0.16em] text-[#5f84a7]">
                      1. Cadastro
                    </strong>
                    <span className="mt-2 block text-[0.95rem] leading-7 text-[#12344f]">
                      Preencha os dados do grupo e do responsavel.
                    </span>
                  </div>
                  <div className="rounded-[18px] bg-[#eef4f9] px-4 py-4">
                    <strong className="block text-[0.95rem] uppercase tracking-[0.16em] text-[#5f84a7]">
                      2. Protocolo
                    </strong>
                    <span className="mt-2 block text-[0.95rem] leading-7 text-[#12344f]">
                      O sistema registra sua solicitacao antes do contato comercial.
                    </span>
                  </div>
                  <div className="rounded-[18px] bg-[#eef4f9] px-4 py-4">
                    <strong className="block text-[0.95rem] uppercase tracking-[0.16em] text-[#5f84a7]">
                      3. Atendimento
                    </strong>
                    <span className="mt-2 block text-[0.95rem] leading-7 text-[#12344f]">
                      A equipe continua o processo pelo canal certo, inclusive WhatsApp.
                    </span>
                  </div>
                </div>
              </div>
            </aside>

            <div className="rounded-[30px] border border-[#d8e2eb] bg-white p-6 shadow-[0_18px_40px_rgba(18,52,79,0.08)] md:p-8">
              <GroupRegistrationForm
                slug={page.slug}
                pageTitle={page.title}
                submitLabel={page.submitLabel}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

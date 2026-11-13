import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { requirePainelAccess } from '@/lib/painel-session';
export const metadata: Metadata = { title: 'Contagem | Rincão',robots: { index: false,follow: false } };
export const dynamic = 'force-dynamic';
export default async function CountingLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePainelAccess('vis_contagem','/contagem');
  if (session.authSource !== 'panel') redirect('/painel/login?redirect=%2Fcontagem');
  return <div className="min-h-screen bg-[#f5f8fc] text-left text-[#123b63] selection:bg-[#d4e5f6]">
    <header className="border-b border-[#d4dfeb] bg-white px-4 py-4"><div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
      <Link href="/contagem" className="text-lg font-bold">Rincão · Contagem</Link>
      <div className="text-sm"><p>{session.actorName ?? 'Operador'}</p><Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/painel">Voltar ao painel</Link></div>
    </div></header><main className="mx-auto max-w-3xl px-4 py-6 pb-16">{children}</main>
  </div>;
}

import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { requirePainelAccess } from '@/lib/painel-session';
import { CountingAccountMenu } from '@/components/counting-controls';
export const metadata: Metadata = {
  title: 'Contagem | Rincão',robots: { index: false,follow: false },
  manifest: '/contagem/manifest.webmanifest',
  appleWebApp: { capable: true,statusBarStyle: 'default',title: 'Contagem Rincão' },
  icons: { icon: '/contagem/icon-192.png',apple: '/contagem/apple-touch-icon.png' },
};
export const dynamic = 'force-dynamic';
export default async function CountingLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePainelAccess('vis_contagem','/contagem');
  if (session.authSource !== 'panel') redirect('/painel/login?redirect=%2Fcontagem');
  return <div className="min-h-screen bg-[#dfe6ef] text-left text-[#0f2d52] selection:bg-[#d4e5f6]">
    <div className="mx-auto min-h-screen max-w-lg bg-[#f4f7fb] shadow-xl">
      <header className="bg-[#133a62] px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))] text-white"><div className="flex items-center justify-between gap-3">
        <Link href="/contagem" className="inline-flex min-h-11 flex-col items-start" aria-label="Rincão · início da contagem"><Image src="/contagem/logo.webp" width={110} height={45} alt="Clube e Park Rincão" className="h-10 w-auto object-contain" priority/><span className="mt-1 text-[9px] font-semibold tracking-[0.2em] text-[#b9cce2]">CONTAGEM</span></Link>
        <CountingAccountMenu name={session.actorName ?? 'Operador'}/>
      </div></header>
      <main className="px-4 pb-6 pt-5">{children}</main>
    </div>
  </div>;
}

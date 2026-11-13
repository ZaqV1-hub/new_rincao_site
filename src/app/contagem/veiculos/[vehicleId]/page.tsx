import { notFound } from 'next/navigation';
import { CountingVehiclePage } from '@/components/counting-vehicle-page';
import { requirePainelAccess } from '@/lib/painel-session';
export default async function Page({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  if (!/^[1-9]\d*$/.test(vehicleId) || !Number.isSafeInteger(Number(vehicleId))) notFound();
  const session = await requirePainelAccess('vis_contagem',`/contagem/veiculos/${vehicleId}`);
  return <CountingVehiclePage id={Number(vehicleId)} manager={session.legacyRoleId === 1} actorCpf={session.actorCpf ?? ''}/>;
}

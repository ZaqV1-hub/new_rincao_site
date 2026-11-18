import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it,vi } from 'vitest';
import { PainelShell } from './painel-shell';
const state=vi.hoisted(()=>({path:'/painel/agenda'}));
vi.mock('next/navigation',()=>({usePathname:()=>state.path,useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
describe('agenda prototype theme boundary',()=>{
  it.each([
    ['/painel/agenda',true],['/painel/agenda/2026-11-18',true],
    ['/painel/agenda/2026-11-18/editar',false],['/painel/clientes',false],['/painel/bilheteria',false],
  ])('adapts only the verified agenda surfaces: %s',(path,expected)=>{
    state.path=path;
    const html=renderToStaticMarkup(<PainelShell actorName="Operador" actorCpf={null} role="admin" permissions={[]}><p>Conteúdo</p></PainelShell>);
    expect(html.includes('rincao-agenda-theme')).toBe(expected);
  });
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it,vi } from 'vitest';
import { countCategories,emptyCountDraft,normalizeCountDraft,type CountDraft } from '@/lib/trip-counting-contract';
import { countingTotals } from '@/lib/counting-slip-contract';
import { CountingStepper } from './counting-controls';
import { changeCount,countEditorReducer,type CountEditor } from './counting-vehicle-page';

vi.mock('next/navigation',() => ({ useRouter: () => ({ push: vi.fn() }) }));
function zeroDraft(): CountDraft {
  const draft = emptyCountDraft();
  for (const key of countCategories) draft.counts[key] = 0;
  return draft;
}
describe('mobile counting controls',() => {
  it('increments and decrements without going below zero or silently changing other missing counts',() => {
    const draft = emptyCountDraft();
    const first = changeCount(draft,'adult',1);
    expect(first.counts.adult).toBe(1);
    expect(first.counts.child).toBeNull();
    expect(changeCount(changeCount(first,'adult',-1),'adult',-1).counts.adult).toBe(0);
    expect(changeCount(draft,'child',-1).counts.child).toBe(0);
  });
  it('cancels a PCD choice without adding a person and keeps counted details paired on remove',() => {
    const initial = zeroDraft();
    expect(changeCount(initial,'pcdChild',1)).toBe(initial);
    const one = changeCount(initial,'pcdChild',1,'Física');
    const two = changeCount(one,'pcdChild',1,'Física');
    const adult = changeCount(two,'pcdAdult',1,'TEA (autismo)');
    expect(adult.pcdDetails).toEqual([{ category: 'pcdChild',description: 'Física',quantity: 2 },{ category: 'pcdAdult',description: 'TEA (autismo)',quantity: 1 }]);
    const removed = changeCount(adult,'pcdChild',-1,'Física');
    expect(removed.counts.pcdChild).toBe(1);
    expect(removed.pcdDetails[0].quantity).toBe(1);
    const none = changeCount(removed,'pcdChild',-1);
    expect(none.counts.pcdChild).toBe(0);
    expect(none.pcdDetails).toEqual([{ category: 'pcdAdult',description: 'TEA (autismo)',quantity: 1 }]);
    expect(normalizeCountDraft(none,false)).toEqual(none);
  });
  it('keeps participants and team separate and refuses an empty conclusion',() => {
    let draft = zeroDraft();
    draft = changeCount(draft,'adult',1);
    draft = changeCount(draft,'coordinator',1);
    draft = changeCount(draft,'pcdChild',1,'Visual');
    draft = changeCount(draft,'pcdCompanion',1);
    expect(countingTotals(draft)).toEqual({ participants: 2,team: 2,total: 4,pcd: 1 });
    expect(() => normalizeCountDraft(zeroDraft(),true)).toThrow('Conte ao menos uma pessoa');
  });
  it('exposes labeled 44px controls and preserves unknown quantities visibly',() => {
    const html = renderToStaticMarkup(<CountingStepper label="Criança" hint="4 a 9 anos" value={null} disabled={false} onMinus={() => {}} onPlus={() => {}}/>);
    expect(html).toContain('Confirmar zero: Criança');
    expect(html).toContain('Adicionar Criança');
    expect(html).toContain('4 a 9 anos');
    expect(html).toContain('—');
    expect(html).toContain('!h-11 !w-11');
  });
});
describe('serialized draft acknowledgement',() => {
  it('keeps edits made during an in-flight save and uses its returned version for the next save',() => {
    const first = changeCount(zeroDraft(),'adult',1);
    let state: CountEditor = { draft: first,version: 4,dirty: true };
    const submitted = state.draft;
    state = countEditorReducer(state,{ type: 'edit',draft: changeCount(state.draft,'adult',1) });
    state = countEditorReducer(state,{ type: 'saved',submitted,version: 5 });
    expect(state).toMatchObject({ version: 5,dirty: true,draft: { counts: { adult: 2 } } });
    state = countEditorReducer(state,{ type: 'saved',submitted: state.draft,version: 6 });
    expect(state).toMatchObject({ version: 6,dirty: false,draft: { counts: { adult: 2 } } });
  });
  it('preserves notes/contact and null categories through delayed acknowledgement until explicit reload',() => {
    const submitted = emptyCountDraft();
    const edited = { ...submitted,notes: 'Orientação de atendimento',responsible: { name: 'Responsável',phone: '11999990000',confirmed: false } };
    let state: CountEditor = { draft: edited,version: 2,dirty: true };
    state = countEditorReducer(state,{ type: 'saved',submitted,version: 3 });
    expect(state.draft).toEqual(edited);
    expect(state.dirty).toBe(true);
    expect(state.draft.counts.child).toBeNull();
    state = countEditorReducer(state,{ type: 'load',draft: submitted,version: 9 });
    expect(state).toEqual({ draft: submitted,version: 9,dirty: false });
  });
});

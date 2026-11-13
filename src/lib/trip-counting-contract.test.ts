import { describe, expect, it } from 'vitest';
import { COUNT_CATEGORIES, emptyCountDraft, normalizeCountDraft } from './trip-counting-contract';

describe('counting input and existing ages', () => {
  it('keeps missing values distinct from real zeros and uses the current age bands', () => {
    const draft = emptyCountDraft(); expect(Object.values(draft.counts)).toEqual(Array(8).fill(null));
    expect(COUNT_CATEGORIES.adult.label).toContain('10'); expect(COUNT_CATEGORIES.child.label).toContain('4 a 9'); expect(COUNT_CATEGORIES.exempt.label).toContain('3');
    expect(normalizeCountDraft(draft,false)).toEqual(draft);
    expect(() => normalizeCountDraft(draft,true)).toThrow();
  });
  it('requires all categories, confirmed responsible and matching PCD detail before completion', () => {
    const draft = emptyCountDraft(); for (const key of Object.keys(draft.counts) as (keyof typeof draft.counts)[]) draft.counts[key] = 0;
    draft.counts.adult = 20; draft.counts.pcdChild = 2;
    draft.responsible = { name: 'Maria',phone: '(11) 98765-4321',confirmed: true };
    expect(() => normalizeCountDraft(draft,true)).toThrow();
    draft.pcdDetails = [{ category: 'pcdChild',description: 'Física',quantity: 2 }];
    expect(normalizeCountDraft(draft,true).responsible.phone).toBe('5511987654321');
    expect(() => normalizeCountDraft({ ...draft,responsible: { ...draft.responsible,confirmed: false } },true)).toThrow();
  });
  it('accepts the seven fixed PCD types and aggregates repeated entries in a new draft', () => {
    const draft = emptyCountDraft();
    draft.counts.pcdChild = 8;
    draft.pcdDetails = ['Física','Visual','Auditiva','Intelectual','TEA (autismo)','Múltipla','Outra','Física']
      .map(description => ({ category: 'pcdChild',description,quantity: 1 }));
    const saved = normalizeCountDraft(draft,false);
    expect(saved.pcdDetails).toHaveLength(7);
    expect(saved.pcdDetails[0]).toEqual({ category: 'pcdChild',description: 'Física',quantity: 2 });
    expect(() => normalizeCountDraft({ ...draft,counts: { ...draft.counts,pcdChild: 7 } },false)).toThrow();
  });
  it('preserves legacy PCD descriptions on read and requires fixed choices for a new completion', () => {
    const draft = emptyCountDraft(); for (const key of Object.keys(draft.counts) as (keyof typeof draft.counts)[]) draft.counts[key] = 0;
    draft.counts.pcdAdult = 1;
    draft.pcdDetails = [{ category: 'pcdAdult',description: 'Mobilidade reduzida',quantity: 1 }];
    draft.responsible = { name: 'Maria',phone: '5511987654321',confirmed: true };
    expect(normalizeCountDraft(draft,true,{ catalogVersion: 1,reading: true })).toEqual(draft);
    expect(() => normalizeCountDraft(draft,true)).toThrow();
  });
  it('rejects a new completion with zero people while preserving historical zero reads', () => {
    const draft = emptyCountDraft(); for (const key of Object.keys(draft.counts) as (keyof typeof draft.counts)[]) draft.counts[key] = 0;
    draft.responsible = { name: 'Maria',phone: '5511987654321',confirmed: true };
    expect(() => normalizeCountDraft(draft,true)).toThrow('ao menos uma pessoa');
    expect(normalizeCountDraft(draft,true,{ catalogVersion: 1,reading: true })).toEqual(draft);
  });
  it.each([-1,1.1,100001,NaN,Infinity,'2'])('rejects invalid count %s', value => {
    expect(() => normalizeCountDraft({ ...emptyCountDraft(),counts: { ...emptyCountDraft().counts,adult: value } },false)).toThrow();
  });
  it('rejects overflow, extra categories and individual medical records', () => {
    const draft = emptyCountDraft(); draft.counts.adult = 100000; draft.counts.child = 1;
    expect(() => normalizeCountDraft(draft,false)).toThrow();
    expect(() => normalizeCountDraft({ ...emptyCountDraft(),counts: { ...emptyCountDraft().counts,other: 1 } },false)).toThrow();
    expect(() => normalizeCountDraft({ ...emptyCountDraft(),pcdDetails: [{ category: 'pcdChild',description: 'Tipo',quantity: 1,name: 'Aluno' }] },false)).toThrow();
  });
});

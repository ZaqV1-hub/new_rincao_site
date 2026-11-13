import type { TripSettlementCounts } from './trip-settlement-calculation';

export const COUNT_CATEGORIES = {
  coordinator: { label: 'Professor / coordenador',group: 'Modalidade 1' },
  pcdChild: { label: 'Criança PCD',group: 'Modalidades 2 e 3' },
  pcdAdult: { label: 'Adulto PCD',group: 'Modalidades 2 e 3' },
  pcdCompanion: { label: 'Acompanhante PCD',group: 'Modalidades 2 e 3' },
  teacherChild: { label: 'Filho de professor',group: 'Filho de professor' },
  adult: { label: 'Adulto · 10 anos ou mais',group: 'Por idade' },
  child: { label: 'Criança · 4 a 9 anos',group: 'Por idade' },
  exempt: { label: 'Isento · até 3 anos',group: 'Por idade' },
} as const satisfies Record<keyof TripSettlementCounts,{ label: string; group: string }>;
export type CountCategory = keyof typeof COUNT_CATEGORIES;
export const countCategories = Object.keys(COUNT_CATEGORIES) as CountCategory[];
export const PCD_TYPES = ['Física','Visual','Auditiva','Intelectual','TEA (autismo)','Múltipla','Outra'] as const;
export type PcdType = (typeof PCD_TYPES)[number];
export const COUNT_CATALOG_VERSION = 2;
export type CountDraft = {
  counts: Record<CountCategory,number | null>;
  pcdDetails: { category: 'pcdChild' | 'pcdAdult'; description: string; quantity: number }[];
  notes: string;
  responsible: { name: string; phone: string; confirmed: boolean };
};
export type CountingActor = { name: string | null; cpf: string | null; manager: boolean };
export type CountAction = 'start' | 'save' | 'release' | 'takeover' | 'complete' | 'recount';
export type CountingResult = { commandId: string; vehicleId: number; version: number; revisionId: string | null; state: 'waiting' | 'counting' | 'completed'; confirmedAt: string };
export class TripCountingError extends Error {
  constructor(readonly code: string, message: string, readonly status = 409) { super(message); }
}
export function invalidCount(message = 'Confira os dados da contagem.'): never { throw new TripCountingError('count_invalid_input',message,400); }
export function countRecord(value: unknown, keys: string[]): Record<string,unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) return invalidCount();
  return value as Record<string,unknown>;
}
export function countText(value: unknown, max: number) {
  if (typeof value !== 'string' || value.length > max || value.includes('\0')) return invalidCount();
  return value.trim();
}
export function countId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) return invalidCount();
  return value;
}
export function emptyCountDraft(): CountDraft {
  return { counts: Object.fromEntries(countCategories.map(key => [key,null])) as CountDraft['counts'],pcdDetails: [],notes: '',responsible: { name: '',phone: '',confirmed: false } };
}
export function normalizeCountDraft(value: unknown, complete: boolean, context?: { catalogVersion: number; reading: true }): CountDraft {
  const legacy = context?.catalogVersion === 1;
  const data = countRecord(value,['counts','pcdDetails','notes','responsible']);
  const raw = countRecord(data.counts,countCategories), counts = emptyCountDraft().counts;
  for (const key of countCategories) {
    const value = raw[key];
    if (value === null && !complete) { counts[key] = null; continue; }
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100000) return invalidCount('Informe todas as quantidades, inclusive zeros, antes de concluir.');
    counts[key] = value;
  }
  const total = Object.values(counts).reduce<number>((sum,n) => sum+(n ?? 0),0);
  if (total > 100000) return invalidCount('A contagem ultrapassa o limite de registro.');
  if (complete && !legacy && total === 0) return invalidCount('Conte ao menos uma pessoa antes de concluir.');
  if (!Array.isArray(data.pcdDetails) || data.pcdDetails.length > 40) return invalidCount();
  const pcdDetails: CountDraft['pcdDetails'] = [];
  for (const value of data.pcdDetails) {
    const entry = countRecord(value,['category','description','quantity']);
    if (entry.category !== 'pcdChild' && entry.category !== 'pcdAdult') return invalidCount();
    const description = countText(entry.description,120), quantity = countId(entry.quantity);
    if (!description || quantity > 100000) return invalidCount();
    if (!legacy && !PCD_TYPES.some(type => type === description)) return invalidCount('Selecione um dos tipos de PCD disponíveis.');
    const existing = !legacy && pcdDetails.find(item => item.category === entry.category && item.description === description);
    if (existing) existing.quantity += quantity;
    else pcdDetails.push({ category: entry.category,description,quantity });
  }
  if (complete || !legacy) for (const key of ['pcdChild','pcdAdult'] as const) {
    if (pcdDetails.filter(item => item.category === key).reduce((sum,item) => sum+item.quantity,0) !== (counts[key] ?? 0)) return invalidCount('Os detalhes de PCD devem corresponder à quantidade contada.');
  }
  const responsible = countRecord(data.responsible,['name','phone','confirmed']);
  const name = countText(responsible.name,160), rawPhone = countText(responsible.phone,40);
  if (rawPhone && !/^[+\d\s().-]+$/.test(rawPhone)) return invalidCount('Confira o WhatsApp do responsável.');
  let phone = rawPhone.replace(/\D/g,'');
  if (phone.length === 10 || phone.length === 11) phone = '55'+phone;
  if (typeof responsible.confirmed !== 'boolean' || phone.length > 15) return invalidCount();
  if (complete && (name.length < 2 || !/^\d{11,15}$/.test(phone) || !responsible.confirmed)) return invalidCount('Confira nome e WhatsApp com o responsável antes de concluir.');
  return { counts,pcdDetails,notes: countText(data.notes,2000),responsible: { name,phone,confirmed: responsible.confirmed } };
}

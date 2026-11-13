import {describe,expect,it} from 'vitest';
import {ownerPeriod, ownerTotals, ownerChange, type OwnerDay} from './owner-dashboard';
describe('owner periods and incomplete sources',()=>{
 it('compares the current month with the same elapsed days, clamped in February',()=>{
  const p=ownerPeriod('month','2024-03-31','2024-03-31');
  expect(p.current).toEqual({start:'2024-03-01',end:'2024-03-31'});
  expect(p.previous).toEqual({start:'2024-02-01',end:'2024-02-29'});
  expect(p.next).toBeNull();
 });
 it('compares completed months in full and crosses December',()=>{
  const p=ownerPeriod('month','2025-01-09','2026-11-13');
  expect(p.current.end).toBe('2025-01-31');expect(p.previous).toEqual({start:'2024-12-01',end:'2024-12-31'});
 });
 it('clamps leap-day year-to-date and supplies last seven days',()=>{
  expect(ownerPeriod('year','2024-02-29','2024-02-29').previous.end).toBe('2023-02-28');
  expect(ownerPeriod('day','2026-01-02','2026-11-13').chart).toEqual({start:'2025-12-27',end:'2026-01-02'});
 });
 it.each([['week','2026-01-01'],['day','2026-02-30'],['year','1999-01-01'],['day','2027-01-01']])('rejects invalid or future selection %s %s',(mode,date)=>{
  expect(()=>ownerPeriod(mode,date,'2026-11-13')).toThrow();
 });
 it('does not turn a partial source into a total or invent a comparison to zero',()=>{
  const days=[{revenueCents:100,costCents:10,attendance:2,knownRevenueCents:100},{revenueCents:null,costCents:null,attendance:null,knownRevenueCents:50}] as OwnerDay[];
  expect(ownerTotals(days)).toMatchObject({revenueCents:null,knownRevenueCents:150,costCents:null,resultCents:null,attendance:null});
  expect(ownerChange(120,100)).toBe(20);expect(ownerChange(10,0)).toBeNull();expect(ownerChange(null,10)).toBeNull();
 });
});

import {describe,expect,it} from 'vitest';
import ExcelJS from 'exceljs';
import {ownerPeriod,unavailableOwnerDay,type OwnerDashboard} from './owner-dashboard';
import {ownerExportSections,renderOwnerXlsx} from './owner-export';
const data:OwnerDashboard={period:ownerPeriod('month','2026-11-01','2026-11-01'),parks:['rincao','estancia'],generatedAt:'2026-11-01T12:00:00Z',days:[{...unavailableOwnerDay('rincao','2026-11-01',''),state:'closed',source:'Daily closure',revision:2,revenueCents:36998,costCents:1000,resultCents:35998,attendance:3,knownRevenueCents:36998,knownAttendance:3,operating:true},unavailableOwnerDay('estancia','2026-11-01','=HYPERLINK("https://invalid.test")')]};
describe('owners monthly exports',()=>{
 it('uses the screen aggregates and retains unavailable as null',()=>{
  const section=ownerExportSections(data)[0];expect(section.rows[0]).toEqual(['Rincão',1,1,3,369.98,10,359.98]);expect(section.rows[1]).toEqual(['Estância',null,0,null,null,null,null]);
 });
 it('writes numeric amounts, preserves missing cells and neutralizes formulas',async()=>{
  const bytes=await renderOwnerXlsx(data,'=not-a-formula');const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as never);
  expect(book.getWorksheet('Resumo mensal')?.getCell('E4').value).toBe(369.98);expect(book.getWorksheet('Resumo mensal')?.getCell('E5').value).toBeNull();
  expect(book.getWorksheet('Pendências')?.getCell('B5').value).toBe('\'=HYPERLINK("https://invalid.test")');
  expect(book.getWorksheet('Gráficos')?.getImages()).toHaveLength(2);
 });
});

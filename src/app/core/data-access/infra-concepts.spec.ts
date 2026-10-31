import { createHash } from 'node:crypto';

import { BED_CATEGORY_CONCEPTS, bedCategoryCode, CHECKLIST_RESPONSE_CONCEPTS, checklistResponseCode, CURRENCY_CONCEPTS } from './infra-concepts';

/** Copia literal de `deterministicId` de la API (`common/constants/concepts.ts`). */
function deterministicId(key: string): string {
  const ns = Buffer.from('3f2b6c14-9d5e-5a41-b7c2-0a1e9f4d8b60'.replace(/-/g, ''), 'hex');
  const bytes = createHash('sha1').update(ns).update(Buffer.from(key, 'utf8')).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

describe('conceptos de la API leídos por UUID', () => {
  it('las respuestas del check-list son las de CONCEPTS.RESPONSE_*', () => {
    expect(CHECKLIST_RESPONSE_CONCEPTS.CONFIRMED).toBe(deterministicId('periop:response-status:confirmed'));
    expect(CHECKLIST_RESPONSE_CONCEPTS.NOT_APPLICABLE).toBe(deterministicId('periop:response-status:not-applicable'));
    expect(CHECKLIST_RESPONSE_CONCEPTS.EXCEPTION).toBe(deterministicId('periop:response-status:exception'));
  });

  it('las categorías de cama son las de PRAC.BED_CAT_* y la moneda la de CURRENCY_BOB', () => {
    for (const [code, id] of Object.entries(BED_CATEGORY_CONCEPTS)) expect(id).toBe(deterministicId(`practice:${code}`));
    expect(CURRENCY_CONCEPTS['BOB']).toBe(deterministicId('currency:bob'));
  });

  it('traduce concepto → código y acepta el código si la API ya lo manda', () => {
    expect(checklistResponseCode(CHECKLIST_RESPONSE_CONCEPTS.EXCEPTION)).toBe('EXCEPTION');
    expect(checklistResponseCode('CONFIRMED')).toBe('CONFIRMED');
    expect(checklistResponseCode('otro')).toBeNull();
    expect(bedCategoryCode(BED_CATEGORY_CONCEPTS['BED_CAT_ICU']!)).toBe('BED_CAT_ICU');
    expect(bedCategoryCode(null)).toBeNull();
  });
});

/* ============================================================================
    Conceptos de la API que F4/F5 necesitan leer por su UUID.

    La API deriva cada UUID de concepto con `deterministicId(clave)` (UUID v5
    sobre `HEALTH_UUID_NAMESPACE`, `common/constants/concepts.ts`), y para los
    conceptos de módulo la clave es `<módulo>:<NOMBRE>`
    (`common/seed/concept-seed.ts`). Son estables: no dependen del seed ni de la
    base. `infra-concepts.spec.ts` los recalcula con el mismo algoritmo, así que
    una clave mal copiada rompe la prueba y no la pantalla.
    ========================================================================== */

/** Respuesta de un ítem del check-list OMS (`responseStatusConceptId`). */
export const CHECKLIST_RESPONSE_CONCEPTS = {
  CONFIRMED: '428b4c6a-8913-5c1a-9290-c6c8860a4e79',
  NOT_APPLICABLE: 'a5ea9bf6-0f35-5300-b527-18f7b774c270',
  EXCEPTION: 'fa0ef559-68ba-537b-83f6-1f990a447571',
} as const;

export type ChecklistResponseCode = keyof typeof CHECKLIST_RESPONSE_CONCEPTS;

/** El código de una respuesta, desde su concepto (o el código, si la API ya lo manda). */
export function checklistResponseCode(status: string): ChecklistResponseCode | null {
  if (status in CHECKLIST_RESPONSE_CONCEPTS) return status as ChecklistResponseCode;
  const hit = (Object.entries(CHECKLIST_RESPONSE_CONCEPTS) as [ChecklistResponseCode, string][]).find(([, id]) => id === status);
  return hit?.[0] ?? null;
}

/** Moneda de las tarifas (`currencyConceptId`). */
export const CURRENCY_CONCEPTS: Readonly<Record<string, string>> = {
  BOB: 'd2fe4f04-ea13-510a-9a10-dfee2302a98f',
};

/** Categorías de cama del día-cama (`bedCategoryConceptId` → código `BED_CAT_*`). */
export const BED_CATEGORY_CONCEPTS: Readonly<Record<string, string>> = {
  BED_CAT_PRIVATE: '3991e3e6-492f-5a0a-953e-15dfdf5f3ce7',
  BED_CAT_SHARED: 'ff0a07eb-ed18-5e2b-972f-82b49f4d4655',
  BED_CAT_ICU: 'f953bc6b-2392-581e-ba6c-31a713047e07',
  BED_CAT_INTERMEDIATE: '61990225-11df-5454-9922-4fef2b873db0',
  BED_CAT_NEONATAL: '38b082f6-2afd-5605-aca4-26639c6ee774',
};

/** El código `BED_CAT_*` de un concepto de categoría, o `null` si no es uno conocido. */
export function bedCategoryCode(conceptId: string | null): string | null {
  if (conceptId === null) return null;
  return Object.entries(BED_CATEGORY_CONCEPTS).find(([, id]) => id === conceptId)?.[0] ?? null;
}

/** El código de moneda de un concepto, o `null`. */
export function currencyCode(conceptId: string | null | undefined): string | null {
  if (conceptId === null || conceptId === undefined) return null;
  return Object.entries(CURRENCY_CONCEPTS).find(([, id]) => id === conceptId)?.[0] ?? null;
}

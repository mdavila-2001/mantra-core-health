/* Pure helpers for the showcase search notice: no Angular, tested alone. */

import type { TarjetaDeMedicamento } from '@core/data-access/public-marketplace/public-marketplace.types';

/** A brand that matched the search, and its active ingredient. */
export interface BrandMatch {
  readonly marca: string;
  readonly compuesto: string;
}

/**
 * When the patient searched by brand («Kitadol»), which brand matched and its
 * active ingredient («Paracetamol»). Moved here from the listing component.
 */
export function brandMatchOf(
  term: string,
  medications: readonly TarjetaDeMedicamento[],
): BrandMatch | null {
  const q = term.trim().toLowerCase();
  if (q.length < 2) return null;
  for (const med of medications) {
    const brand = med.brands.find((candidate) => candidate.toLowerCase().includes(q));
    if (brand !== undefined) return { marca: brand, compuesto: med.genericName };
  }
  return null;
}

/**
 * The uses that found every result, when the search was by what it is for
 * («dolor abdominal»). Empty if any result came by name: then the person
 * searched a medication, not a symptom.
 */
export function usesMatchedOf(medications: readonly TarjetaDeMedicamento[]): string[] {
  if (medications.length === 0 || medications.some((med) => med.matchedBy !== 'use')) return [];
  return [...new Set(medications.map((med) => med.matchedUse ?? '').filter((use) => use !== ''))];
}

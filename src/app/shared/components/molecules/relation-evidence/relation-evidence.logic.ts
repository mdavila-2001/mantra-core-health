import type {
  GlossaryEvidenceTier,
  GlossaryNeighbor,
  GlossaryRelationFrequency,
} from '@core/data-access/terminology/terminology.types';

/* ============================================================================
    Cómo se dice la evidencia de un vecino (TAREA-41 F1.5 / F5.1).

    La fuerza se muestra como barra Y con palabras: el color o el largo solos no
    alcanzan para leerla. Un hallazgo que la fuente descarta no lleva barra,
    porque no es una relación positiva débil sino una negativa.
   ============================================================================ */

/** Los niveles de evidencia en orden, de T1 a T4 (TAREA-41 §3.1). */
export const EVIDENCE_TIERS: readonly GlossaryEvidenceTier[] = [
  'NATIONAL_STANDARD',
  'CURATED_REFERENCE',
  'COLLABORATIVE_KNOWLEDGE',
  'STATISTICAL_LITERATURE',
];

/** Las frecuencias de la más alta a la más baja; `EXCLUDED` cierra la escala. */
export const RELATION_FREQUENCIES: readonly GlossaryRelationFrequency[] = [
  'OBLIGATE',
  'VERY_FREQUENT',
  'FREQUENT',
  'OCCASIONAL',
  'VERY_RARE',
  'EXCLUDED',
];

export const FREQUENCY_LABEL: Readonly<Record<GlossaryRelationFrequency, string>> = {
  OBLIGATE: 'Siempre presente',
  VERY_FREQUENT: 'Muy frecuente',
  FREQUENT: 'Frecuente',
  OCCASIONAL: 'Ocasional',
  VERY_RARE: 'Muy poco frecuente',
  EXCLUDED: 'La fuente lo descarta',
};

export const EVIDENCE_TIER_LABEL: Readonly<Record<GlossaryEvidenceTier, string>> = {
  NATIONAL_STANDARD: 'Norma nacional',
  CURATED_REFERENCE: 'Referencia curada',
  COLLABORATIVE_KNOWLEDGE: 'Conocimiento colaborativo',
  STATISTICAL_LITERATURE: 'Bibliografía estadística',
};

/** El número del nivel (1 a 4), como lo nombra la ficha TAREA-41. */
export const EVIDENCE_TIER_NUMBER: Readonly<Record<GlossaryEvidenceTier, number>> = {
  NATIONAL_STANDARD: 1,
  CURATED_REFERENCE: 2,
  COLLABORATIVE_KNOWLEDGE: 3,
  STATISTICAL_LITERATURE: 4,
};

/**
 * Qué significa cada nivel, en palabras. Es el texto del globo de ayuda del
 * sello; las fuentes concretas se agregan desde `sourceCodes` cuando llegan.
 */
const EVIDENCE_TIER_DESCRIPTION: Readonly<Record<GlossaryEvidenceTier, string>> = {
  NATIONAL_STANDARD: 'Nivel 1 de 4, el más alto. La relación consta en una norma nacional.',
  CURATED_REFERENCE: 'Nivel 2 de 4. La relación proviene de una referencia revisada por especialistas.',
  COLLABORATIVE_KNOWLEDGE:
    'Nivel 3 de 4. La relación proviene de una base de conocimiento colaborativo. Orienta, pero no constituye una referencia clínica.',
  STATISTICAL_LITERATURE:
    'Nivel 4 de 4. Los dos términos aparecen juntos en la bibliografía médica. Sólo sirve para ordenar; no confirma una relación clínica.',
};

/** Lo que el mapa pinta debajo del nombre de un vecino. */
export interface NeighborEvidenceView {
  /** Ancho de la barra en porcentaje (0–100); `null` si no hay barra. */
  readonly strengthPercent: number | null;
  /** Frecuencia en palabras; `null` si la relación no la trae. */
  readonly frequencyLabel: string | null;
  /** Sello de la fuente; `null` si la relación no trae nivel de evidencia. */
  readonly tierLabel: string | null;
  /** Texto del globo de ayuda del sello: qué fuentes respaldan ese nivel. */
  readonly tierDescription: string | null;
  readonly excluded: boolean;
}

/** Si el vecino no trae ningún dato de evidencia (contrato anterior a F1). */
export function hasNoEvidence(neighbor: GlossaryNeighbor): boolean {
  return (
    neighbor.strength === undefined && neighbor.frequency === undefined && neighbor.evidenceTier === undefined
  );
}

function tierDescriptionOf(neighbor: GlossaryNeighbor): string | null {
  if (neighbor.evidenceTier === undefined) return null;
  const base = EVIDENCE_TIER_DESCRIPTION[neighbor.evidenceTier];
  const sources = neighbor.sourceCodes ?? [];
  return sources.length === 0 ? base : `${base} Fuentes: ${sources.join(', ')}.`;
}

/** La evidencia de un vecino lista para pintar, o `null` si no trae ninguna. */
export function neighborEvidenceView(neighbor: GlossaryNeighbor): NeighborEvidenceView | null {
  if (hasNoEvidence(neighbor)) return null;
  const { strength, frequency, evidenceTier } = neighbor;
  const excluded = frequency === 'EXCLUDED';
  return {
    strengthPercent:
      excluded || strength === undefined ? null : Math.round(Math.min(Math.max(strength, 0), 1) * 100),
    frequencyLabel: frequency === undefined ? null : FREQUENCY_LABEL[frequency],
    tierLabel: evidenceTier === undefined ? null : EVIDENCE_TIER_LABEL[evidenceTier],
    tierDescription: tierDescriptionOf(neighbor),
    excluded,
  };
}

/**
 * Orden de una columna del mapa: la relación más fuerte primero, las que no
 * traen fuerza al final y, entre iguales, por nombre. Sin evidencia cargada el
 * orden es el alfabético de siempre.
 */
export function compareNeighbors(a: GlossaryNeighbor, b: GlossaryNeighbor): number {
  const byStrength = (b.strength ?? -1) - (a.strength ?? -1);
  return byStrength === 0 ? a.display.localeCompare(b.display, 'es') : byStrength;
}

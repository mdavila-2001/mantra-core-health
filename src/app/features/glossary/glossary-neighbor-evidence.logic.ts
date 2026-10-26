import type {
  GlossaryEvidenceTier,
  GlossaryNeighbor,
  GlossaryRelationFrequency,
} from '../../core/data-access/terminology/terminology.types';

/* ============================================================================
    Cómo se dice la evidencia de un vecino (TAREA-41 F1.5 / F5.1).

    La fuerza se muestra como barra Y con palabras: el color o el largo solos no
    alcanzan para leerla. Un hallazgo que la fuente descarta no lleva barra,
    porque no es una relación positiva débil sino una negativa.
   ============================================================================ */

const FREQUENCY_LABEL: Readonly<Record<GlossaryRelationFrequency, string>> = {
  OBLIGATE: 'Siempre presente',
  VERY_FREQUENT: 'Muy frecuente',
  FREQUENT: 'Frecuente',
  OCCASIONAL: 'Ocasional',
  VERY_RARE: 'Muy poco frecuente',
  EXCLUDED: 'La fuente lo descarta',
};

const EVIDENCE_TIER_LABEL: Readonly<Record<GlossaryEvidenceTier, string>> = {
  NATIONAL_STANDARD: 'Norma nacional',
  CURATED_REFERENCE: 'Referencia curada',
  COLLABORATIVE_KNOWLEDGE: 'Conocimiento colaborativo',
  STATISTICAL_LITERATURE: 'Bibliografía estadística',
};

/** Lo que el mapa pinta debajo del nombre de un vecino. */
export interface NeighborEvidenceView {
  /** Ancho de la barra en porcentaje (0–100); `null` si no hay barra. */
  readonly strengthPercent: number | null;
  /** Frecuencia en palabras; `null` si la relación no la trae. */
  readonly frequencyLabel: string | null;
  /** Sello de la fuente; `null` si la relación no trae nivel de evidencia. */
  readonly tierLabel: string | null;
  readonly excluded: boolean;
}

/** La evidencia de un vecino lista para pintar, o `null` si no trae ninguna. */
export function neighborEvidenceView(neighbor: GlossaryNeighbor): NeighborEvidenceView | null {
  const { strength, frequency, evidenceTier } = neighbor;
  if (strength === undefined && frequency === undefined && evidenceTier === undefined) return null;
  const excluded = frequency === 'EXCLUDED';
  return {
    strengthPercent:
      excluded || strength === undefined ? null : Math.round(Math.min(Math.max(strength, 0), 1) * 100),
    frequencyLabel: frequency === undefined ? null : FREQUENCY_LABEL[frequency],
    tierLabel: evidenceTier === undefined ? null : EVIDENCE_TIER_LABEL[evidenceTier],
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

import type { AdtConcept, BedBoardCell, StayBedRef } from '../../../core/data-access/adt/adt.types';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';

export { antiguedadEnPalabras, fechaCorta, fechaYHora, minutosDesde, UMBRAL_DE_ATRASO_MIN } from '../../admin/medical-organization/infrastructure/infrastructure.view';

/* ============================================================================
    Presentación compartida de la internación. Sin Angular: texto y tonos.
    ========================================================================== */

/** Las rutas del módulo; las comparten los enlaces de todas las pantallas. */
export const RUTAS = {
  ingreso: '/inpatient/admissions/new',
  estancia: (encounterId: string): string => `/inpatient/stays/${encodeURIComponent(encounterId)}`,
  censo: '/inpatient/census',
  indicadores: '/inpatient/indicators',
} as const;

/** El resumen HL7 v2-0116 (+R) de una cama, en palabras, tono y glifo. */
export interface EstadoDeCama {
  readonly code: string;
  readonly label: string;
  readonly tone: BadgeVariant;
  /** Nombre del glifo (ver `bed-status.html`). */
  readonly glyph: 'free' | 'occupied' | 'reserved' | 'housekeeping' | 'contaminated' | 'isolated' | 'closed';
}

const ESTADOS: Readonly<Record<string, EstadoDeCama>> = {
  U: { code: 'U', label: 'Libre', tone: 'success', glyph: 'free' },
  O: { code: 'O', label: 'Ocupada', tone: 'primary', glyph: 'occupied' },
  R: { code: 'R', label: 'Reservada', tone: 'info', glyph: 'reserved' },
  H: { code: 'H', label: 'Sucia o en limpieza', tone: 'warning', glyph: 'housekeeping' },
  K: { code: 'K', label: 'Contaminada', tone: 'error', glyph: 'contaminated' },
  I: { code: 'I', label: 'En aislamiento', tone: 'error', glyph: 'isolated' },
  C: { code: 'C', label: 'Cerrada o bloqueada', tone: 'secondary', glyph: 'closed' },
};

export function estadoDeCama(v2Code: string): EstadoDeCama {
  return ESTADOS[v2Code] ?? { code: v2Code, label: v2Code, tone: 'secondary', glyph: 'closed' };
}

/** Por qué una cama no se puede ofrecer, en una frase: es lo que se dice en vez de esconderla. */
export function motivoDeNoAsignable(c: BedBoardCell): string {
  if (c.assignable) return '';
  if (c.lifecycle.code !== 'SPACE_ACTIVE') return `Espacio ${c.lifecycle.display.toLowerCase()}`;
  if (c.availability.code !== 'SPACE_OP_AVAILABLE') {
    return c.availability.reasonText ?? 'No disponible';
  }
  if (c.occupancy.code === 'OCC_OCCUPIED') return 'Ocupada';
  if (c.occupancy.code === 'OCC_RESERVED') return 'Reservada para otra persona';
  if (c.hygiene.terminalRequired) return 'Pide limpieza terminal e inspección';
  if (c.hygiene.code !== 'HYG_INSPECTED' && c.hygiene.code !== 'HYG_CLEAN') return 'Pendiente de limpieza';
  return 'No asignable';
}

export const sexoEnPalabras = (code: string): string => (code === 'SEX_FEMALE' ? 'Mujer' : code === 'SEX_MALE' ? 'Hombre' : 'Sin dato');

export function textoDeCama(bed: StayBedRef | null): string {
  if (bed === null) return 'Pendiente de cama';
  const lugar = bed.path.at(-1)?.name;
  return lugar === undefined ? `Cama ${bed.code}` : `Cama ${bed.code} · ${lugar}`;
}

export function varianteDeNivel(level: AdtConcept): BadgeVariant {
  return level.code.includes('ICU') ? 'error' : level.code.includes('INTERMEDIATE') ? 'warning' : 'secondary';
}

export const varianteDeAislamiento = (c: AdtConcept): BadgeVariant => (c.code === 'ISO_NONE' ? 'secondary' : c.code === 'ISO_AIRBORNE' ? 'error' : 'warning');

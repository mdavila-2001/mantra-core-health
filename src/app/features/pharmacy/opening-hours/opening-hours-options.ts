import type { SelectOption } from '../../../shared/components/atoms/select/select.types';

/** What a site declares about 24 h opening, as the user picks it. */
export type Declaracion24h = 'si' | 'no' | 'sin-declarar';

export const OPCIONES_24H: readonly SelectOption<Declaracion24h>[] = [
  { value: 'si', label: 'Sí, abre las 24 horas' },
  { value: 'no', label: 'No abre las 24 horas' },
  { value: 'sin-declarar', label: 'Sin declarar' },
];

/** Draft of a new shift: typed values survive a failure. */
export interface BorradorDeTurno {
  readonly desdeFecha: string;
  readonly desdeHora: string;
  readonly hastaFecha: string;
  readonly hastaHora: string;
}

export const BORRADOR_VACIO: BorradorDeTurno = {
  desdeFecha: '',
  desdeHora: '',
  hastaFecha: '',
  hastaHora: '',
};

/** Creation errors, per field. */
export interface ErroresDeTurno {
  readonly desde?: string;
  readonly hasta?: string;
}

export function declaracionDe(open24h: boolean | null): Declaracion24h {
  return open24h === true ? 'si' : open24h === false ? 'no' : 'sin-declarar';
}

export function open24hDe(declaracion: Declaracion24h): boolean | null {
  return declaracion === 'si' ? true : declaracion === 'no' ? false : null;
}

import type { Tone } from '../../../../../shared/components/tone/tone.types';
import type { NodoDeRed } from '../red-clinica.types';

/**
 * The status badge's tone in the panel. Every order arrives with the generic
 * «info», which painted «Pendiente» like «Completado»: for a study what
 * decides is whether its result is out (warning while pending, success once
 * released). An explicit tone other than «info» is kept.
 */
export function tonoDelEstado(nodo: NodoDeRed | null): Tone {
  const tono = nodo?.estado?.tono;
  if (nodo?.detalle?.tipo !== 'estudio' || (tono !== undefined && tono !== 'info')) return tono ?? 'info';
  return nodo.detalle.resultado === null ? 'warning' : 'success';
}

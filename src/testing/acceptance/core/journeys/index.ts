export * from './p3.social.journey';
export * from './p6.moderation-reviews.journey';

import { P3_JOURNEYS } from './p3.social.journey';
import { P6_JOURNEYS } from './p6.moderation-reviews.journey';
import type { JourneyId, JourneySpec } from '../contracts/journey.types';

/**
 * El catálogo completo de los carriles de esta máquina.
 *
 * Existe para que un adaptador pueda recorrerlo y para que una prueba de
 * consistencia compruebe que no hay dos journeys con el mismo id — que es el
 * error que rompe la regla de verdad única sin que nadie se entere.
 */
export const JOURNEYS: readonly JourneySpec[] = [...P3_JOURNEYS, ...P6_JOURNEYS];

/** Busca un journey por su id. Falla si no está, en vez de devolver `undefined`. */
export function journey(id: JourneyId): JourneySpec {
  const encontrado = JOURNEYS.find((candidato) => candidato.id === id);
  if (encontrado === undefined) {
    throw new Error(`No existe el journey ${id} en el catálogo.`);
  }
  return encontrado;
}

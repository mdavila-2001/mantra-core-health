import type { GlossaryTermDetail } from '../../core/data-access/terminology/terminology.types';

/** Una licencia no certifica que la imagen represente el concepto clínico. */
export function imagenAprobadaDelTermino(term: GlossaryTermDetail | null) {
  if (term?.properties['image_review_status'] !== 'approved') return undefined;
  return term.image;
}

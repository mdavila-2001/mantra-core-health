import type { StudyDetailRead } from './study-detail.types';

/** Los conceptos del detalle que una pantalla necesita traducir (los que la API no nombró). */
export function studyDetailConceptIds(detail: StudyDetailRead): readonly string[] {
  const ids: (string | undefined)[] = [
    detail.specimenTypeDisplay === undefined ? detail.specimenTypeConceptId : undefined,
    detail.bodySiteDisplay === undefined ? detail.bodySiteConceptId : undefined,
    detail.lateralityDisplay === undefined ? detail.lateralityConceptId : undefined,
    detail.modalityDisplay === undefined ? detail.modalityConceptId : undefined,
    detail.boneTypeDisplay === undefined ? detail.boneTypeConceptId : undefined,
    detail.contrastDisplay === undefined ? detail.contrastConceptId : undefined,
  ];
  return ids.filter((id): id is string => id !== undefined);
}

/**
 * El detalle de una orden en una línea, para la lista del paciente y la del
 * personal: «Muestra: Orina» (laboratorio) o «Región: Mano · Izquierda ·
 * Radiografía · Hueso largo» (imagen). `null` si la orden no lo trae (órdenes
 * anteriores): no se inventa ni se rellena.
 *
 * El nombre sale de la API (`*Display`) o, si no lo mandó, del catálogo
 * (`labelOf`); un concepto sin nombre se omite en vez de mostrar su uuid.
 */
export function studyDetailSummary(
  detail: StudyDetailRead,
  labelOf: (conceptId: string) => string | undefined,
): string | null {
  const name = (display: string | undefined, id: string | undefined): string | undefined =>
    display ?? (id === undefined ? undefined : labelOf(id));
  const specimen = name(detail.specimenTypeDisplay, detail.specimenTypeConceptId);
  if (specimen !== undefined) return `Muestra: ${specimen}`;
  const parts = [
    name(detail.bodySiteDisplay, detail.bodySiteConceptId),
    name(detail.lateralityDisplay, detail.lateralityConceptId),
    name(detail.modalityDisplay, detail.modalityConceptId),
    name(detail.boneTypeDisplay, detail.boneTypeConceptId),
    name(detail.contrastDisplay, detail.contrastConceptId),
  ].filter((part): part is string => part !== undefined);
  if (detail.bodyStructureUberon !== undefined) parts.push('marcada en el cuerpo 3D');
  return parts.length === 0 ? null : `Región: ${parts.join(' · ')}`;
}

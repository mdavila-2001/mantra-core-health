import type { CareEpisode } from '../../../core/data-access/clinical/clinical.types';
import type { InternacionEnFicha } from '../patient-chart/admission-block/admission-block';

/**
 * The patient's care episodes as the admission block shows them (C-23).
 *
 * The person in charge resolves to «mine» or «someone else's» instead of an
 * id: a `practitionerProfileId` on screen is not a name, and naming it would
 * need a profiles read this screen does not make.
 *
 * @param episodes - `careEpisodes` of the clinical summary.
 * @param ownPractitionerId - The signed-in practitioner, or `null`.
 * @param typeLabel - Concept id → words; `undefined` when the episode has no type.
 */
export function admissionsOf(
  episodes: readonly CareEpisode[],
  ownPractitionerId: string | null,
  typeLabel: (conceptId: string) => string,
): readonly InternacionEnFicha[] {
  return episodes.map((episode) => ({
    id: episode.id,
    abierta: episode.endAt === undefined,
    desde: episode.startAt ?? null,
    hasta: episode.endAt ?? null,
    ...(episode.typeConceptId === undefined ? {} : { tipo: typeLabel(episode.typeConceptId) }),
    conResponsable: episode.responsiblePractitionerId !== undefined,
    aMiCargo: ownPractitionerId !== null && episode.responsiblePractitionerId === ownPractitionerId,
    registradaEl: episode.createdAt,
  }));
}

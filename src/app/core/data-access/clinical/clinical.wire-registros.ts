/* ============================================================================
    The clinical record's writes, as their responses travel and as the view
    reads them (`clinical.client.ts`; the reads live in `clinical.wire.ts`).
    ========================================================================== */

import type {
  AllergyIntoleranceRegistration,
  CareEpisodeRegistration,
  ConditionRegistration,
  DiagnosticReportRegistration,
  EncounterRegistration,
  MedicationRequestRegistration,
  ObservationRegistration,
} from './clinical.types';
import {  } from './clinical.wire';

/**
 * El encuentro tal como vuelve de las dos escrituras.
 *
 * Sus tres instantes son `nullable` en el contrato —no ausentes— porque el DTO
 * los declara así: un encuentro recién abierto tiene `endAt: null`, que no es lo
 * mismo que no traer el campo.
 */
export type WireEncounterRegistration = Omit<EncounterRegistration, 'startAt' | 'endAt' | 'createdAt'> & {
  readonly startAt: string | null;
  readonly endAt: string | null;
  readonly createdAt: string;
};

/* ---- las cuatro escrituras del registro clínico ---------------------------
   Las cuatro respuestas comparten forma: identificadores que el servicio
   proyecta con `?? null` —nunca ausentes— y una `createdAt` obligatoria. Por
   eso los `null` de acá se conservan como `null` en vez de borrarse la clave:
   `signedAt: null` **significa** «sin firmar», y es lo que decide si emitir va
   a responder 200 o 422. */

export type WireMedicationRequestRegistration = Omit<
  MedicationRequestRegistration,
  'signedAt' | 'createdAt'
> & {
  readonly signedAt: string | null;
  readonly createdAt: string;
};

export type WireConditionRegistration = Omit<ConditionRegistration, 'createdAt'> & {
  readonly createdAt: string;
};

export type WireAllergyRegistration = Omit<AllergyIntoleranceRegistration, 'createdAt'> & {
  readonly createdAt: string;
};

export type WireObservationRegistration = Omit<ObservationRegistration, 'createdAt'> & {
  readonly createdAt: string;
};

export function toMedicationRequestRegistration({
  signedAt,
  createdAt,
  ...resto
}: WireMedicationRequestRegistration): MedicationRequestRegistration {
  return {
    ...resto,
    signedAt: signedAt === null ? null : new Date(signedAt),
    createdAt: new Date(createdAt),
  };
}

export function toConditionRegistration({
  createdAt,
  ...resto
}: WireConditionRegistration): ConditionRegistration {
  return { ...resto, createdAt: new Date(createdAt) };
}

export function toAllergyRegistration({
  createdAt,
  ...resto
}: WireAllergyRegistration): AllergyIntoleranceRegistration {
  return { ...resto, createdAt: new Date(createdAt) };
}

export type WireDiagnosticReportRegistration = Omit<DiagnosticReportRegistration, 'createdAt'> & {
  readonly createdAt: string;
};

export function toDiagnosticReportRegistration({
  createdAt,
  ...resto
}: WireDiagnosticReportRegistration): DiagnosticReportRegistration {
  return { ...resto, createdAt: new Date(createdAt) };
}

export function toObservationRegistration({
  createdAt,
  ...resto
}: WireObservationRegistration): ObservationRegistration {
  return { ...resto, createdAt: new Date(createdAt) };
}

export function toEncounterRegistration({
  startAt,
  endAt,
  createdAt,
  ...resto
}: WireEncounterRegistration): EncounterRegistration {
  return {
    ...resto,
    startAt: startAt === null ? null : new Date(startAt),
    endAt: endAt === null ? null : new Date(endAt),
    createdAt: new Date(createdAt),
  };
}

/**
 * El episodio tal como vuelve del alta.
 *
 * `startAt` es `nullable` —no ausente— en el contrato, igual que en el
 * encuentro: se conserva el `null` en vez de borrarlo porque significa «el
 * backend no fijó el inicio», que no es lo mismo que «no vino el campo».
 */
export type WireCareEpisodeRegistration = Omit<CareEpisodeRegistration, 'startAt' | 'createdAt'> & {
  readonly startAt: string | null;
  readonly createdAt: string;
};

export function toCareEpisodeRegistration({
  startAt,
  createdAt,
  ...resto
}: WireCareEpisodeRegistration): CareEpisodeRegistration {
  return {
    ...resto,
    startAt: startAt === null ? null : new Date(startAt),
    createdAt: new Date(createdAt),
  };
}

/* ============================================================================
    The clinical contract's transport shapes and their mapping to the view
    types (`clinical.client.ts`).
    ========================================================================== */

import type {
  Allergy,
  CareEpisode,
  CarePlan,
  CarePlanActivity,
  ChartDocument,
  ChartNote,
  ClinicalSummary,
  Condition,
  Encounter,
  MedicationRequest,
  Observation,
  OwnMedicalAspects,
  PatientChart,
} from './clinical.types';
/* ---- formas de transporte ------------------------------------------------
   Todas las fechas llegan como texto ISO; el resto del contrato viaja igual.
   `Fechas<T, K>` declara **qué claves** son fechas en cada tipo, en vez de
   inferirlas: una clave nueva del contrato tiene que obligar a decidir, no
   convertirse sola. */

export type Fechas<T, K extends keyof T> = Omit<T, K> & Partial<Readonly<Record<K, string>>>;

export type WireCondition = Omit<
  Fechas<Condition, 'onsetAt' | 'expectedResolutionAt' | 'resolvedAt'>,
  'createdAt' | 'replacedByConditionId'
> & {
  readonly createdAt: string;
  /** Patch v4291: the contract omits it when null; `null` is tolerated anyway. */
  readonly replacedByConditionId?: string | null;
};

export type WireAllergy = Omit<Allergy, 'createdAt'> & { readonly createdAt: string };

export type WireMedicationRequest = Omit<
  Fechas<MedicationRequest, 'validFrom' | 'validTo' | 'signedAt' | 'issuedAt'>,
  'createdAt'
> & { readonly createdAt: string };

export type WireObservation = Fechas<Observation, 'effectiveStartAt'>;

export type WireEncounter = Fechas<Encounter, 'startAt' | 'endAt'>;

export type WireCareEpisode = Omit<Fechas<CareEpisode, 'startAt' | 'endAt'>, 'createdAt'> & {
  readonly createdAt: string;
};

export interface WireSummary extends Omit<
  ClinicalSummary,
  'conditions' | 'allergies' | 'medicationRequests' | 'observations' | 'encounters' | 'careEpisodes'
> {
  readonly conditions: readonly WireCondition[];
  readonly allergies: readonly WireAllergy[];
  readonly medicationRequests: readonly WireMedicationRequest[];
  readonly observations: readonly WireObservation[];
  readonly encounters: readonly WireEncounter[];
  /** Opcional acá y sólo acá: ver el `?? []` de `getSummary`. */
  readonly careEpisodes?: readonly WireCareEpisode[];
}

export type WireNote = Omit<Fechas<ChartNote, 'signedAt'>, 'createdAt'> & { readonly createdAt: string };

export type WireActivity = Fechas<CarePlanActivity, 'scheduledAt'>;

export type WireCarePlan = Omit<Fechas<CarePlan, 'startDate' | 'endDate'>, 'activities' | 'createdAt'> & {
  readonly activities: readonly WireActivity[];
  readonly createdAt: string;
};

export type WireDocument = Omit<Fechas<ChartDocument, 'documentDate'>, 'createdAt'> & {
  readonly createdAt: string;
};

export interface WireChart extends Omit<PatientChart, 'notes' | 'carePlans' | 'documents'> {
  readonly notes: readonly WireNote[];
  readonly carePlans: readonly WireCarePlan[];
  readonly documents: readonly WireDocument[];
}

export function toCondition({
  onsetAt,
  expectedResolutionAt,
  resolvedAt,
  createdAt,
  replacedByConditionId,
  ...resto
}: WireCondition): Condition {
  return {
    ...resto,
    ...fecha('onsetAt', onsetAt),
    ...fecha('expectedResolutionAt', expectedResolutionAt),
    ...fecha('resolvedAt', resolvedAt),
    ...(replacedByConditionId == null ? {} : { replacedByConditionId }),
    createdAt: new Date(createdAt),
  };
}

export function toAllergy({ createdAt, ...resto }: WireAllergy): Allergy {
  return { ...resto, createdAt: new Date(createdAt) };
}

export function toMedicationRequest({
  validFrom,
  validTo,
  signedAt,
  issuedAt,
  createdAt,
  ...resto
}: WireMedicationRequest): MedicationRequest {
  return {
    ...resto,
    ...fecha('validFrom', validFrom),
    ...fecha('validTo', validTo),
    ...fecha('signedAt', signedAt),
    ...fecha('issuedAt', issuedAt),
    createdAt: new Date(createdAt),
  };
}

export function toObservation({ effectiveStartAt, ...resto }: WireObservation): Observation {
  return { ...resto, ...fecha('effectiveStartAt', effectiveStartAt) };
}

export function toEncounter({ startAt, endAt, ...resto }: WireEncounter): Encounter {
  return { ...resto, ...fecha('startAt', startAt), ...fecha('endAt', endAt) };
}

export function toCareEpisode({ startAt, endAt, createdAt, ...resto }: WireCareEpisode): CareEpisode {
  return {
    ...resto,
    ...fecha('startAt', startAt),
    ...fecha('endAt', endAt),
    createdAt: new Date(createdAt),
  };
}

export function toNote({ signedAt, createdAt, ...resto }: WireNote): ChartNote {
  return { ...resto, ...fecha('signedAt', signedAt), createdAt: new Date(createdAt) };
}

export function toActivity({ scheduledAt, ...resto }: WireActivity): CarePlanActivity {
  return { ...resto, ...fecha('scheduledAt', scheduledAt) };
}

export function toCarePlan({
  startDate,
  endDate,
  activities,
  createdAt,
  ...resto
}: WireCarePlan): CarePlan {
  return {
    ...resto,
    ...fecha('startDate', startDate),
    ...fecha('endDate', endDate),
    activities: activities.map(toActivity),
    createdAt: new Date(createdAt),
  };
}

export function toDocument({ documentDate, createdAt, ...resto }: WireDocument): ChartDocument {
  return {
    ...resto,
    ...fecha('documentDate', documentDate),
    createdAt: new Date(createdAt),
  };
}

/**
 * La clave con su fecha, o nada.
 *
 * Devolver `{}` y esparcirlo —en vez de asignar `undefined`— es lo que deja la
 * clave **ausente** en el objeto resultante. Con `undefined` la clave existe con
 * valor vacío, y `'onsetAt' in condicion` pasaría a decir que sí hay dato.
 */
export function fecha<K extends string>(
  key: K,
  value: string | null | undefined,
): Partial<Record<K, Date>> {
  return value === null || value === undefined
    ? {}
    : ({ [key]: new Date(value) } as Record<K, Date>);
}

/* ---- FT-22 · aspectos médicos --------------------------------------------- */

/** Lo que viaja por el cable: la fecha llega como texto ISO. */
export type WireMedicalAspects = Omit<OwnMedicalAspects, 'updatedAt'> & {
  readonly updatedAt?: string | null;
};

export function toMedicalAspects({ updatedAt, ...resto }: WireMedicalAspects): OwnMedicalAspects {
  return { ...resto, ...fecha('updatedAt', updatedAt) };
}

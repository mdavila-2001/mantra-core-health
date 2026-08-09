import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  Allergy,
  CarePlan,
  CarePlanActivity,
  ChartDocument,
  ChartNote,
  ClinicalSummary,
  Condition,
  Encounter,
  MedicationRequest,
  Observation,
  PatientChart,
} from './clinical.types';

/**
 * Cliente del archivo clínico: `clinical` (M08) y `chart` (M15).
 *
 * ## Un cliente para dos módulos
 *
 * Porque son dos lecturas de lo mismo. El backend las separa por quién las
 * escribe —lo estructurado y lo narrativo se editan en flujos distintos— pero
 * ninguna pantalla quiere media historia clínica. Partirlo en dos clientes
 * obligaría a inyectar los dos en todas partes sin ganar nada.
 *
 * ## Ambas exigen rol clínico
 *
 * `CLINICIAN` o `PRACTITIONER`, declarado a nivel de controlador en el backend.
 * Es PHI: quien no lo tenga recibe `403`, que la capa de errores convierte en el
 * estado S5 sin filtrar si el paciente existe.
 *
 * ## El tope es por bloque, no por respuesta
 *
 * `limit` acota **cada** lista por separado, y la respuesta declara en
 * `truncated` cuáles quedaron cortadas. Se reenvía tal cual a la vista: un
 * expediente al que le faltan notas sin avisar es un expediente que miente.
 */
@Injectable({
  providedIn: 'root',
})
export class ClinicalClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /clinical/patients/:id/summary` — condiciones, alergias, medicación,
   * observaciones y encuentros (UC-39-20).
   *
   * @param patientProfileId - Paciente cuyo historial se lee.
   * @param limit - Tope por bloque. La API aplica 50 si se omite.
   */
  getSummary(patientProfileId: string, limit?: number): Observable<ClinicalSummary> {
    return this.http
      .get<WireSummary>(
        this.url(`/clinical/patients/${encodeURIComponent(patientProfileId)}/summary`),
        { params: topeDe(limit) },
      )
      .pipe(
        map((body) => ({
          ...body,
          conditions: body.conditions.map(toCondition),
          allergies: body.allergies.map(toAllergy),
          medicationRequests: body.medicationRequests.map(toMedicationRequest),
          observations: body.observations.map(toObservation),
          encounters: body.encounters.map(toEncounter),
        })),
      );
  }

  /**
   * `GET /charts/patients/:id/chart` — notas, planes de cuidados y documentos
   * (UC-40-14).
   *
   * @param patientProfileId - Paciente cuyo expediente se lee.
   * @param limit - Tope por bloque. La API aplica 50 si se omite.
   */
  getChart(patientProfileId: string, limit?: number): Observable<PatientChart> {
    return this.http
      .get<WireChart>(this.url(`/charts/patients/${encodeURIComponent(patientProfileId)}/chart`), {
        params: topeDe(limit),
      })
      .pipe(
        map((body) => ({
          ...body,
          notes: body.notes.map(toNote),
          carePlans: body.carePlans.map(toCarePlan),
          documents: body.documents.map(toDocument),
        })),
      );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/** El tope como parámetro, o ninguno: la API tiene su propio valor por omisión. */
function topeDe(limit: number | undefined): HttpParams {
  return limit === undefined ? new HttpParams() : new HttpParams().set('limit', String(limit));
}

/* ---- formas de transporte ------------------------------------------------
   Todas las fechas llegan como texto ISO; el resto del contrato viaja igual.
   `Fechas<T, K>` declara **qué claves** son fechas en cada tipo, en vez de
   inferirlas: una clave nueva del contrato tiene que obligar a decidir, no
   convertirse sola. */

type Fechas<T, K extends keyof T> = Omit<T, K> & Partial<Readonly<Record<K, string>>>;

type WireCondition = Omit<Fechas<Condition, 'onsetAt' | 'resolvedAt'>, 'createdAt'> & {
  readonly createdAt: string;
};

type WireAllergy = Omit<Allergy, 'createdAt'> & { readonly createdAt: string };

type WireMedicationRequest = Omit<
  Fechas<MedicationRequest, 'validFrom' | 'validTo' | 'signedAt' | 'issuedAt'>,
  'createdAt'
> & { readonly createdAt: string };

type WireObservation = Fechas<Observation, 'effectiveStartAt'>;

type WireEncounter = Fechas<Encounter, 'startAt' | 'endAt'>;

interface WireSummary extends Omit<
  ClinicalSummary,
  'conditions' | 'allergies' | 'medicationRequests' | 'observations' | 'encounters'
> {
  readonly conditions: readonly WireCondition[];
  readonly allergies: readonly WireAllergy[];
  readonly medicationRequests: readonly WireMedicationRequest[];
  readonly observations: readonly WireObservation[];
  readonly encounters: readonly WireEncounter[];
}

type WireNote = Omit<Fechas<ChartNote, 'signedAt'>, 'createdAt'> & { readonly createdAt: string };

type WireActivity = Fechas<CarePlanActivity, 'scheduledAt'>;

type WireCarePlan = Omit<Fechas<CarePlan, 'startDate' | 'endDate'>, 'activities' | 'createdAt'> & {
  readonly activities: readonly WireActivity[];
  readonly createdAt: string;
};

type WireDocument = Omit<Fechas<ChartDocument, 'documentDate'>, 'createdAt'> & {
  readonly createdAt: string;
};

interface WireChart extends Omit<PatientChart, 'notes' | 'carePlans' | 'documents'> {
  readonly notes: readonly WireNote[];
  readonly carePlans: readonly WireCarePlan[];
  readonly documents: readonly WireDocument[];
}

function toCondition({ onsetAt, resolvedAt, createdAt, ...resto }: WireCondition): Condition {
  return {
    ...resto,
    ...fecha('onsetAt', onsetAt),
    ...fecha('resolvedAt', resolvedAt),
    createdAt: new Date(createdAt),
  };
}

function toAllergy({ createdAt, ...resto }: WireAllergy): Allergy {
  return { ...resto, createdAt: new Date(createdAt) };
}

function toMedicationRequest({
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

function toObservation({ effectiveStartAt, ...resto }: WireObservation): Observation {
  return { ...resto, ...fecha('effectiveStartAt', effectiveStartAt) };
}

function toEncounter({ startAt, endAt, ...resto }: WireEncounter): Encounter {
  return { ...resto, ...fecha('startAt', startAt), ...fecha('endAt', endAt) };
}

function toNote({ signedAt, createdAt, ...resto }: WireNote): ChartNote {
  return { ...resto, ...fecha('signedAt', signedAt), createdAt: new Date(createdAt) };
}

function toActivity({ scheduledAt, ...resto }: WireActivity): CarePlanActivity {
  return { ...resto, ...fecha('scheduledAt', scheduledAt) };
}

function toCarePlan({
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

function toDocument({ documentDate, createdAt, ...resto }: WireDocument): ChartDocument {
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
function fecha<K extends string>(
  key: K,
  value: string | null | undefined,
): Partial<Record<K, Date>> {
  return value === null || value === undefined
    ? {}
    : ({ [key]: new Date(value) } as Record<K, Date>);
}

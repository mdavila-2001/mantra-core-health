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
  EncounterRegistration,
  MedicationRequest,
  NewEncounter,
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
 *
 * ## Las dos escrituras que sí están
 *
 * El check-in y el cierre de un encuentro, y ninguna más. No es una lista
 * arbitraria: son las dos únicas escrituras del módulo cuyo resultado **se
 * vuelve a leer** desde el propio expediente —aparecen en el bloque
 * «Encuentros» de `getSummary`—. Diagnosticar, indicar medicación o firmar una
 * nota se escriben con endpoints que existen, pero el registro no se refleja en
 * ninguna lectura que la pantalla tenga: construirlos sería ofrecer un
 * formulario que traga el dato y no lo muestra.
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

  /**
   * `POST /clinical/encounters/check-in` — abre el encuentro (UC-08-02).
   *
   * El backend le pone la hora de inicio, lo deja «en curso» y, si no se
   * declara clase, lo clasifica como ambulatorio. No hace falta abrir antes un
   * episodio de cuidado: `episodeId` es opcional y el encuentro vive sin él.
   *
   * @param encuentro - Paciente, organización y lo opcional que se haya cargado.
   * @returns El encuentro abierto, con su identificador y su hora de inicio.
   */
  checkInEncounter(encuentro: NewEncounter): Observable<EncounterRegistration> {
    return this.http
      .post<WireEncounterRegistration>(
        this.url('/clinical/encounters/check-in'),
        // Sin las claves ausentes: el backend valida con `forbidNonWhitelisted`
        // y un opcional en `undefined` viaja como clave declarada.
        sinAusentes(encuentro),
      )
      .pipe(map(toEncounterRegistration));
  }

  /**
   * `POST /clinical/encounters/:id/close` — cierra el encuentro en curso
   * (UC-08-14).
   *
   * Cierra también los periodos abiertos de participantes y ubicaciones, y el
   * backend rechaza con `422` un encuentro que ya no esté en curso: cerrar dos
   * veces no es idempotente y la pantalla tiene que mostrarlo como tal.
   *
   * @param encounterId - Encuentro a cerrar.
   * @param expectedRowVersion - Versión esperada, para el bloqueo optimista.
   * @returns El encuentro cerrado, con su hora de fin.
   */
  closeEncounter(
    encounterId: string,
    expectedRowVersion?: number,
  ): Observable<EncounterRegistration> {
    return this.http
      .post<WireEncounterRegistration>(
        this.url(`/clinical/encounters/${encodeURIComponent(encounterId)}/close`),
        expectedRowVersion === undefined ? {} : { expectedRowVersion },
      )
      .pipe(map(toEncounterRegistration));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/**
 * El mismo objeto sin las claves cuyo valor es `undefined`.
 *
 * `JSON.stringify` ya las omitiría, pero depender de eso ata el cuerpo enviado a
 * un detalle del serializador: acá se declara la intención, que es la que el
 * `forbidNonWhitelisted` del backend está mirando.
 */
function sinAusentes<T extends object>(valor: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(valor).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
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

/**
 * El encuentro tal como vuelve de las dos escrituras.
 *
 * Sus tres instantes son `nullable` en el contrato —no ausentes— porque el DTO
 * los declara así: un encuentro recién abierto tiene `endAt: null`, que no es lo
 * mismo que no traer el campo.
 */
type WireEncounterRegistration = Omit<
  EncounterRegistration,
  'startAt' | 'endAt' | 'createdAt'
> & {
  readonly startAt: string | null;
  readonly endAt: string | null;
  readonly createdAt: string;
};

function toEncounterRegistration({
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

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  Allergy,
  AllergyIntoleranceRegistration,
  CareEpisode,
  CareEpisodeRegistration,
  CarePlan,
  CarePlanActivity,
  ChartDocument,
  ChartNote,
  ClinicalSummary,
  Condition,
  ConditionRegistration,
  DiagnosticReportRegistration,
  Encounter,
  EncounterRegistration,
  InteractionCheckRequest,
  InteractionCheckResult,
  MedicationRequest,
  MedicationRequestRegistration,
  NewAllergyIntolerance,
  NewCareEpisode,
  NewCondition,
  NewDiagnosticReport,
  NewEncounter,
  NewMedicationRequest,
  NewObservation,
  Observation,
  ObservationRegistration,
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
 * ## Las escrituras: el encuentro y los cuatro registros del expediente
 *
 * Fueron dos durante un tiempo —el check-in y el cierre del encuentro— con un
 * criterio explícito: sólo se ofrece la escritura cuyo resultado la pantalla
 * **vuelve a leer**, para no construir formularios que traguen el dato y no lo
 * muestren. El criterio no cambió; cambió que ahora se cumple para cuatro más.
 * Condiciones, alergias, medicación y observaciones tienen su bloque en
 * `getSummary`, así que lo que se registra acá aparece releyendo el mismo
 * expediente.
 *
 * ## El ciclo de la receta vive en tres llamadas
 *
 * Prescribir deja la receta en **borrador**; firmar y emitir son transiciones
 * aparte (`/sign`, `/issue`) y no parámetros del alta. Es el contrato, y es
 * también el acto: una receta emitida es inmutable y compromete a quien la
 * firma, así que el paso tiene que ser deliberado.
 *
 * Emitir sin firmar responde **`422`** cuando la política de firma D-05 rige
 * para el tenant. No es un fallo del cliente: es una precondición del negocio,
 * y la pantalla la cuenta como tal.
 *
 * ## Este archivo lo comparten dos carriles
 *
 * Las seis escrituras nuevas entran juntas —receta, condición, alergia,
 * observación— aunque las use más de una pantalla. El contrato va primero para
 * que nadie espere a nadie, y para que el único archivo compartido del plan se
 * toque una sola vez.
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
          // El único bloque que se lee con `?? []`, y no por descuido: es
          // aditivo al contrato, y frontend y API se despliegan por separado.
          // Contra una API que todavía no lo publica, el expediente entero
          // reventaría por un bloque que esa versión no tiene. El resto de los
          // bloques existen desde el primer día de la lectura y no necesitan
          // esa cortesía.
          careEpisodes: (body.careEpisodes ?? []).map(toCareEpisode),
        })),
      );
  }

  /**
   * `POST /clinical/care-episodes` — da de alta una internación (UC-08-01).
   *
   * ## Por qué esta escritura sí entra
   *
   * El criterio del cliente no cambió: sólo se ofrece la escritura cuyo
   * resultado la pantalla **vuelve a leer**. Hasta ahora el episodio no salía en
   * ninguna lectura, así que abrir una internación desde acá habría sido un
   * formulario que traga el dato. Desde que `getSummary` devuelve
   * `careEpisodes`, lo que se abre aparece releyendo el mismo expediente.
   *
   * ## El `409` es la regla, no un fallo
   *
   * El backend rechaza abrir un segundo episodio activo para el mismo paciente
   * en la misma organización. No es un error del sistema: es que la persona ya
   * está internada, y la salida —el episodio existente— ya está en pantalla.
   *
   * @param episodio - Paciente, organización y lo opcional que se haya cargado.
   * @returns El episodio abierto, con su estado y su inicio.
   */
  createCareEpisode(episodio: NewCareEpisode): Observable<CareEpisodeRegistration> {
    return this.http
      .post<WireCareEpisodeRegistration>(
        this.url('/clinical/care-episodes'),
        sinAusentes({ ...episodio, startAt: instanteDe(episodio.startAt) }),
      )
      .pipe(map(toCareEpisodeRegistration));
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

  /* -- La receta: prescribir, firmar, emitir ------------------------------- */

  /**
   * `POST /clinical/medication-requests` — prescribe una medicación
   * (UC-08-10).
   *
   * La receta nace **en borrador**: no surte efecto hasta emitirla. Aparece de
   * inmediato en el bloque «medicación» de `getSummary`, que es de donde la
   * pantalla la vuelve a leer.
   *
   * @param receta - El medicamento y su indicación. Lo ausente no viaja.
   * @returns La receta en borrador, con `signedAt` en `null`.
   */
  createMedicationRequest(
    receta: NewMedicationRequest,
  ): Observable<MedicationRequestRegistration> {
    return this.http
      .post<WireMedicationRequestRegistration>(
        this.url('/clinical/medication-requests'),
        sinAusentes({
          ...receta,
          validFrom: instanteDe(receta.validFrom),
          validTo: instanteDe(receta.validTo),
        }),
      )
      .pipe(map(toMedicationRequestRegistration));
  }

  /**
   * `POST /clinical/medication-requests/:id/sign` — firma el borrador (D-05).
   *
   * Sin cuerpo: quién firma sale del token, y ofrecerlo como parámetro
   * permitiría firmar en nombre de otro. Es aditivo —firmar dos veces no
   * cambia el instante ya sellado— pero sólo se acepta sobre un borrador: una
   * receta emitida responde `422`.
   *
   * @param medicationRequestId - Receta a firmar.
   * @returns La receta con su `signedAt`.
   */
  signMedicationRequest(medicationRequestId: string): Observable<MedicationRequestRegistration> {
    return this.http
      .post<WireMedicationRequestRegistration>(
        this.url(
          `/clinical/medication-requests/${encodeURIComponent(medicationRequestId)}/sign`,
        ),
        {},
      )
      .pipe(map(toMedicationRequestRegistration));
  }

  /**
   * `POST /clinical/medication-requests/:id/issue` — emite la receta y la
   * vuelve inmutable.
   *
   * ## El `422` no es un fallo, es el contrato
   *
   * Con la política de firma D-05 vigente, emitir una receta sin firmar
   * responde `422 PRECONDITION_FAILED` —la `PreconditionFailedException` del
   * proyecto es 422, **no** 412—. Quien lo llame tiene que contarlo como un
   * paso que falta, no como un error: la salida es firmar y reintentar, y está
   * a un click.
   *
   * Sin política aplicable la emisión no se endurece (el backend es fail-safe),
   * así que el mismo camino puede responder `200` en un tenant sin política.
   *
   * @param medicationRequestId - Receta a emitir.
   * @returns La receta emitida.
   */
  issueMedicationRequest(medicationRequestId: string): Observable<MedicationRequestRegistration> {
    return this.http
      .post<WireMedicationRequestRegistration>(
        this.url(
          `/clinical/medication-requests/${encodeURIComponent(medicationRequestId)}/issue`,
        ),
        {},
      )
      .pipe(map(toMedicationRequestRegistration));
  }

  /* -- Los tres registros de la ficha -------------------------------------- */

  /**
   * `POST /clinical/conditions` — registra un diagnóstico o problema
   * (UC-08-08).
   *
   * El estado clínico y el de verificación **no se mandan**: el backend los
   * fija y los devuelve. Ofrecerlos en el formulario sería pedir un dato que
   * no se usa.
   *
   * @param condicion - El diagnóstico y su contexto.
   */
  createCondition(condicion: NewCondition): Observable<ConditionRegistration> {
    return this.http
      .post<WireConditionRegistration>(
        this.url('/clinical/conditions'),
        sinAusentes({ ...condicion, onsetAt: instanteDe(condicion.onsetAt) }),
      )
      .pipe(map(toConditionRegistration));
  }

  /**
   * `POST /clinical/allergy-intolerances` — registra una alergia con sus
   * reacciones (UC-08-09).
   *
   * Las reacciones van en la misma llamada y no en una segunda: el backend las
   * crea dentro de la transacción y devuelve sus identificadores. Partirlo
   * dejaría alergias sin manifestación cuando la segunda petición falle.
   *
   * @param alergia - La sustancia, su criticidad y las reacciones observadas.
   */
  createAllergyIntolerance(
    alergia: NewAllergyIntolerance,
  ): Observable<AllergyIntoleranceRegistration> {
    return this.http
      .post<WireAllergyRegistration>(
        this.url('/clinical/allergy-intolerances'),
        sinAusentes({
          ...alergia,
          reactions: alergia.reactions?.map((reaccion) => sinAusentes(reaccion)),
        }),
      )
      .pipe(map(toAllergyRegistration));
  }

  /**
   * `POST /clinical/observations` — registra una medición u observación
   * (UC-08-03).
   *
   * El valor viaja por **uno** de los seis caminos excluyentes de la familia
   * (`valueDecimal`, `valueText`, `quantityValue`…): mandar dos no es un
   * promedio, es una observación ambigua. Quien arme el formulario elige el
   * camino según el código de la observación.
   *
   * @param observacion - Qué se midió, cuánto dio y quién la tomó.
   */
  createObservation(observacion: NewObservation): Observable<ObservationRegistration> {
    return this.http
      .post<WireObservationRegistration>(
        this.url('/clinical/observations'),
        sinAusentes({
          ...observacion,
          effectiveStartAt: instanteDe(observacion.effectiveStartAt),
          issuedAt: instanteDe(observacion.issuedAt),
          performers: observacion.performers.map((ejecutante) => sinAusentes(ejecutante)),
          components: observacion.components?.map((componente) => sinAusentes(componente)),
          referenceRanges: observacion.referenceRanges?.map((rango) => sinAusentes(rango)),
        }),
      )
      .pipe(map(toObservationRegistration));
  }

  /* -- El informe diagnóstico: contrato sin pantalla ----------------------- */

  /**
   * `POST /clinical/diagnostic-reports` — emite el informe desde la orden
   * (UC-08-06).
   *
   * **Todavía no lo usa ninguna pantalla**, y no es un olvido: el informe no
   * aparece en `getSummary` ni en `getChart`, y el backend no expone ningún
   * `GET` de reportes. Ver {@link NewDiagnosticReport} — el contrato entra
   * verificado para que, cuando exista la lectura, falte sólo la vista.
   *
   * @param informe - El estudio y su contexto.
   */
  createDiagnosticReport(
    informe: NewDiagnosticReport,
  ): Observable<DiagnosticReportRegistration> {
    return this.http
      .post<WireDiagnosticReportRegistration>(
        this.url('/clinical/diagnostic-reports'),
        sinAusentes(informe),
      )
      .pipe(map(toDiagnosticReportRegistration));
  }

  /**
   * `POST /clinical/diagnostic-reports/:id/release` — libera el resultado
   * (UC-08-07).
   *
   * Liberar es lo que hace visible el resultado para la persona, así que es un
   * acto aparte de emitir: un informe final puede seguir retenido a propósito
   * mientras se lo comunica en consulta.
   *
   * @param diagnosticReportId - Informe a liberar.
   * @param expectedRowVersion - Versión esperada, para el bloqueo optimista.
   */
  releaseDiagnosticReport(
    diagnosticReportId: string,
    expectedRowVersion?: number,
  ): Observable<DiagnosticReportRegistration> {
    return this.http
      .post<WireDiagnosticReportRegistration>(
        this.url(
          `/clinical/diagnostic-reports/${encodeURIComponent(diagnosticReportId)}/release`,
        ),
        expectedRowVersion === undefined ? {} : { expectedRowVersion },
      )
      .pipe(map(toDiagnosticReportRegistration));
  }

  /* -- El chequeo de interacciones: contrato sin pantalla ------------------ */

  /**
   * `POST /cds/check-interactions` — interacciones entre lo que ya toma la
   * persona y lo que se está por prescribir (UC-18-04).
   *
   * **Todavía no lo usa ninguna pantalla**, mismo motivo que el informe
   * diagnóstico de arriba: el contrato entra verificado para que, cuando el
   * bloque de receta lo llame antes de prescribir, falte sólo esa línea.
   *
   * @param chequeo - El paciente y las sustancias a comparar (activas + la nueva).
   */
  checkInteractions(chequeo: InteractionCheckRequest): Observable<InteractionCheckResult> {
    return this.http.post<InteractionCheckResult>(
      this.url('/cds/check-interactions'),
      sinAusentes(chequeo),
    );
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

/**
 * Una fecha como el texto ISO que el contrato pide, o nada.
 *
 * Es el camino de ida de `maybeDate`: los DTO declaran estos campos como
 * `format: 'date-time'` y los validan con `IsDateString`, así que un `Date`
 * crudo dentro del cuerpo llegaría serializado por `JSON.stringify` —que
 * casualmente hace lo mismo— pero sin que nadie lo haya decidido. Acá se
 * decide.
 *
 * Devolver `undefined` —y no `null`— es lo que deja que {@link sinAusentes}
 * borre la clave después.
 */
function instanteDe(value: Date | undefined): string | undefined {
  return value === undefined ? undefined : value.toISOString();
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

type WireCareEpisode = Omit<Fechas<CareEpisode, 'startAt' | 'endAt'>, 'createdAt'> & {
  readonly createdAt: string;
};

interface WireSummary extends Omit<
  ClinicalSummary,
  | 'conditions'
  | 'allergies'
  | 'medicationRequests'
  | 'observations'
  | 'encounters'
  | 'careEpisodes'
> {
  readonly conditions: readonly WireCondition[];
  readonly allergies: readonly WireAllergy[];
  readonly medicationRequests: readonly WireMedicationRequest[];
  readonly observations: readonly WireObservation[];
  readonly encounters: readonly WireEncounter[];
  /** Opcional acá y sólo acá: ver el `?? []` de `getSummary`. */
  readonly careEpisodes?: readonly WireCareEpisode[];
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

/* ---- las cuatro escrituras del registro clínico ---------------------------
   Las cuatro respuestas comparten forma: identificadores que el servicio
   proyecta con `?? null` —nunca ausentes— y una `createdAt` obligatoria. Por
   eso los `null` de acá se conservan como `null` en vez de borrarse la clave:
   `signedAt: null` **significa** «sin firmar», y es lo que decide si emitir va
   a responder 200 o 422. */

type WireMedicationRequestRegistration = Omit<
  MedicationRequestRegistration,
  'signedAt' | 'createdAt'
> & {
  readonly signedAt: string | null;
  readonly createdAt: string;
};

type WireConditionRegistration = Omit<ConditionRegistration, 'createdAt'> & {
  readonly createdAt: string;
};

type WireAllergyRegistration = Omit<AllergyIntoleranceRegistration, 'createdAt'> & {
  readonly createdAt: string;
};

type WireObservationRegistration = Omit<ObservationRegistration, 'createdAt'> & {
  readonly createdAt: string;
};

function toMedicationRequestRegistration({
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

function toConditionRegistration({
  createdAt,
  ...resto
}: WireConditionRegistration): ConditionRegistration {
  return { ...resto, createdAt: new Date(createdAt) };
}

function toAllergyRegistration({
  createdAt,
  ...resto
}: WireAllergyRegistration): AllergyIntoleranceRegistration {
  return { ...resto, createdAt: new Date(createdAt) };
}

type WireDiagnosticReportRegistration = Omit<DiagnosticReportRegistration, 'createdAt'> & {
  readonly createdAt: string;
};

function toDiagnosticReportRegistration({
  createdAt,
  ...resto
}: WireDiagnosticReportRegistration): DiagnosticReportRegistration {
  return { ...resto, createdAt: new Date(createdAt) };
}

function toObservationRegistration({
  createdAt,
  ...resto
}: WireObservationRegistration): ObservationRegistration {
  return { ...resto, createdAt: new Date(createdAt) };
}

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

function toCareEpisode({ startAt, endAt, createdAt, ...resto }: WireCareEpisode): CareEpisode {
  return {
    ...resto,
    ...fecha('startAt', startAt),
    ...fecha('endAt', endAt),
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
type WireCareEpisodeRegistration = Omit<
  CareEpisodeRegistration,
  'startAt' | 'createdAt'
> & {
  readonly startAt: string | null;
  readonly createdAt: string;
};

function toCareEpisodeRegistration({
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

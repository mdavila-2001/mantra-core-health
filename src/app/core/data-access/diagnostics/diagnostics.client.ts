import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { normalizePatientSettlement } from '../insurance/patient-insurance-settlement.types';
import { sinNulos, type ConNulos } from '../wire';
import type {
  DiagnosticOrder,
  DiagnosticOrderCreated,
  DiagnosticReport,
  DiagnosticResultShare,
  DuplicateStudyCheck,
  DuplicateStudyCheckResult,
  ImagingStudy,
  LabWorkOrder,
  LabWorkOrderQuery,
  NewDiagnosticOrder,
  NewDiagnosticResultShare,
  PatientDiagnosticResult,
  PatientDiagnosticResults,
  PatientDiagnostics,
  PatientOrder,
  PatientOwnOrders,
  PreviousStudy,
} from './diagnostics.types';

/**
 * Cliente del circuito diagnóstico: `diagnostics` (M20) y el alta de orden de
 * `clinical` (M08).
 *
 * ## Un cliente para dos módulos, otra vez y por otro motivo
 *
 * En `clinical` son dos módulos porque son dos mitades de un mismo expediente.
 * Acá es porque son dos **momentos** del mismo circuito: la orden se escribe
 * donde viven sus invariantes (`POST /clinical/service-requests`) y se lee donde
 * vive la pregunta (`GET /diagnostics/patients/:id/orders`). Partirlo en dos
 * clientes obligaría a inyectar los dos en toda pantalla que pida un estudio, y
 * a que quien la escriba supiera esa historia para saber cuál usar.
 *
 * ## Todas exigen rol clínico
 *
 * `CLINICIAN` o `PRACTITIONER`, declarado a nivel de controlador en el backend,
 * en los dos módulos. Es PHI: quien no lo tenga recibe `403`, que la capa de
 * errores convierte en el estado S5 sin filtrar si el paciente existe.
 *
 * ## El tope es por bloque, no por respuesta
 *
 * Igual que en el expediente: `limit` acota **cada** lista por separado y la
 * respuesta declara en `truncated` cuáles quedaron cortadas. Se reenvía tal cual
 * a la vista.
 *
 * ## La escritura que sí está, y las que no
 *
 * Sólo el alta de la orden. Es el mismo criterio que rige `ClinicalClient` y no
 * una decisión de alcance: se ofrece la escritura que **esta misma pantalla
 * vuelve a leer**. La orden aparece en el circuito del paciente apenas se crea.
 *
 * Acesionar un espécimen, abrir una corrida de analizador, ingerir un mensaje
 * del LIS o liberar una versión del informe tienen endpoint y no están acá: son
 * actos del laboratorio sobre su propio instrumental, sin lectura que los
 * refleje del lado de quien pide el estudio. Construirlos sería ofrecer un
 * formulario que traga el dato y no lo muestra.
 */
@Injectable({
  providedIn: 'root',
})
export class DiagnosticsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /diagnostics/patients/:id/orders` — órdenes de laboratorio e
   * imagenología del paciente, con sus informes.
   *
   * @param patientProfileId - Paciente cuyo circuito se lee.
   * @param limit - Tope por bloque. La API aplica 50 si se omite.
   */
  getPatientDiagnostics(
    patientProfileId: string,
    limit?: number,
  ): Observable<PatientDiagnostics> {
    return this.http
      .get<WirePatientDiagnostics>(
        this.url(`/diagnostics/patients/${encodeURIComponent(patientProfileId)}/orders`),
        { params: topeDe(limit) },
      )
      .pipe(
        map((body) => ({
          ...body,
          orders: body.orders.map(toOrder),
          reports: body.reports.map(toReport),
        })),
      );
  }

  /**
   * `GET /diagnostics/patients/:id/imaging-studies` — los estudios de imagen
   * que efectivamente se produjeron.
   *
   * Lectura aparte de la del circuito porque responde otra pregunta: la orden
   * dice qué se pidió, el estudio dice qué hay para mirar.
   *
   * @param patientProfileId - Paciente cuyos estudios se leen.
   * @param limit - Tope de filas. La API aplica 50 si se omite.
   * @param offset - Desplazamiento. La API aplica 0 si se omite.
   */
  listImagingStudies(
    patientProfileId: string,
    limit?: number,
    offset?: number,
  ): Observable<readonly ImagingStudy[]> {
    return this.http.get<ImagingStudy[]>(
      this.url(
        `/diagnostics/patients/${encodeURIComponent(patientProfileId)}/imaging-studies`,
      ),
      { params: paginacion(limit, offset) },
    );
  }

  /**
   * `GET /diagnostics/work-orders` — la cola de trabajo del laboratorio.
   *
   * Es la única lectura del módulo que **no** pide un paciente: es la vista del
   * laboratorio sobre su propio trabajo, acotada siempre al tenant del contexto
   * por el backend.
   *
   * @param filtros - Acesión, estado, profesional asignado y paginación.
   */
  listWorkOrders(filtros: LabWorkOrderQuery = {}): Observable<readonly LabWorkOrder[]> {
    return this.http
      .get<WireLabWorkOrder[]>(this.url('/diagnostics/work-orders'), {
        params: filtrosDeCola(filtros),
      })
      .pipe(map((filas) => filas.map(toWorkOrder)));
  }

  /**
   * `POST /clinical/service-requests` — pide un estudio (UC-08-05).
   *
   * Vive en `clinical` y no en `diagnostics` a propósito: una orden diagnóstica
   * es una orden de servicio con categoría, no una entidad aparte. Lo que la
   * vuelve de este circuito es `categoryConceptId`, y es la lectura de
   * `diagnostics` la que filtra por él.
   *
   * @param orden - Paciente, organización, qué se pide y lo opcional que se haya cargado.
   * @returns La orden creada, con su identificador y su estado inicial.
   */
  requestStudy(orden: NewDiagnosticOrder): Observable<DiagnosticOrderCreated> {
    return this.http
      .post<WireOrderCreated>(
        this.url('/clinical/service-requests'),
        // Sin las claves ausentes: el backend valida con `forbidNonWhitelisted`
        // y un opcional en `undefined` viaja como clave declarada.
        sinAusentes(orden),
      )
      .pipe(map(toOrderCreated));
  }

  /**
   * `POST /clinical/service-requests/duplicate-check` — antiduplicación de
   * estudios (v4.2.17, T-26). Se llama ANTES de {@link requestStudy}: si
   * `isDuplicate` es `true`, la ficha tiene que pedirle una decisión al
   * médico —reutilizar el informe previo o justificar la repetición— y
   * recién ahí volver a llamar a `requestStudy` con esa decisión.
   *
   * @param chequeo - Paciente, estudio y el encuentro en curso.
   */
  checkDuplicateStudy(
    chequeo: DuplicateStudyCheck,
  ): Observable<DuplicateStudyCheckResult> {
    return this.http
      .post<WireDuplicateStudyCheckResult>(
        this.url('/clinical/service-requests/duplicate-check'),
        sinAusentes(chequeo),
      )
      .pipe(map(toDuplicateStudyCheckResult));
  }

  /* ---- el portal del paciente ---------------------------------------------
     Las cuatro operaciones de `/diagnostic-results/me`. Cuelgan de un prefijo
     propio y no de `/diagnostics` porque `diagnostics` **es una ruta de la
     aplicación** —la cola clínica— y el proxy compara por primer segmento:
     declararlo como prefijo de API se comería esa pantalla. No llevan identificador de
     paciente en ninguna parte: el backend resuelve al titular por el vínculo de
     su cuenta, así que no hay nada que esta pantalla pueda pedir de otra
     persona. Tampoco exigen rol clínico — exigen `PATIENT`. */

  /**
   * `GET /diagnostic-results/me` — los resultados propios.
   *
   * Sólo llegan las versiones liberadas y visibles para el paciente. Un informe
   * redactado y todavía sin validar no aparece, y la pantalla no tiene que
   * decidir nada al respecto.
   *
   * @param limit - Tope de informes considerados. La API aplica 50 si se omite.
   */
  getOwnResults(limit?: number): Observable<PatientDiagnosticResults> {
    return this.http
      .get<WirePatientResults>(this.url('/diagnostic-results/me'), {
        params: topeDe(limit),
      })
      .pipe(map((body) => ({ ...body, items: body.items.map(toPatientResult) })));
  }

  /**
   * `GET /diagnostic-results/me/orders` — las órdenes propias.
   *
   * Sólo laboratorio e imagenología, y de todas las organizaciones: el estudio
   * que le pidieron en una clínica y el de otra son una sola lista. Cada orden
   * trae su preparación —cuando algún centro la publicó— y si ya hay un
   * resultado liberado que se pueda abrir.
   *
   * @param limit - Tope de órdenes. La API aplica 50 si se omite.
   */
  getOwnOrders(limit?: number): Observable<PatientOwnOrders> {
    return this.http
      .get<WirePatientOrders>(this.url('/diagnostic-results/me/orders'), {
        params: topeDe(limit),
      })
      .pipe(map((body) => ({ ...body, items: body.items.map(toPatientOrder) })));
  }

  /**
   * `GET /diagnostic-results/me/:reportId` — un resultado propio.
   *
   * @param reportId - Informe pedido.
   */
  getOwnResult(reportId: string): Observable<PatientDiagnosticResult> {
    return this.http
      .get<WirePatientResult>(
        this.url(`/diagnostic-results/me/${encodeURIComponent(reportId)}`),
      )
      .pipe(map(toPatientResult));
  }

  /**
   * `GET /diagnostic-results/me/:reportId/shares` — con quién está
   * compartido, vigentes y vencidos.
   *
   * Los vencidos también vuelven, y hay que mostrarlos: quién tuvo acceso a un
   * resultado clínico es exactamente lo que alguien querría poder revisar
   * después.
   *
   * @param reportId - Informe consultado.
   */
  listResultShares(reportId: string): Observable<readonly DiagnosticResultShare[]> {
    return this.http
      .get<WireShares>(
        this.url(`/diagnostic-results/me/${encodeURIComponent(reportId)}/shares`),
      )
      .pipe(map((body) => body.items.map(toShare)));
  }

  /**
   * `POST /diagnostic-results/me/:reportId/shares` — comparte el
   * resultado con un profesional hasta una fecha.
   *
   * @param reportId - Informe que se comparte.
   * @param compartir - Con quién y hasta cuándo.
   */
  shareResult(
    reportId: string,
    compartir: NewDiagnosticResultShare,
  ): Observable<DiagnosticResultShare> {
    return this.http
      .post<WireShare>(
        this.url(`/diagnostic-results/me/${encodeURIComponent(reportId)}/shares`),
        {
          practitionerUserId: compartir.practitionerUserId,
          validUntil: compartir.validUntil.toISOString(),
          ...(compartir.reason === undefined ? {} : { reason: compartir.reason }),
        },
      )
      .pipe(map(toShare));
  }

  /**
   * `POST /diagnostic-results/me/:reportId/shares/:shareId/revoke`
   * — deja de compartir.
   *
   * Es `revoke` y no `DELETE` porque no se borra nada: se cierra la vigencia y
   * el registro de que se compartió sigue existiendo.
   *
   * @param reportId - Informe compartido.
   * @param shareId - Compartido a cerrar.
   */
  revokeResultShare(reportId: string, shareId: string): Observable<DiagnosticResultShare> {
    return this.http
      .post<WireShare>(
        this.url(
          `/diagnostic-results/me/${encodeURIComponent(reportId)}/shares/${encodeURIComponent(shareId)}/revoke`,
        ),
        {},
      )
      .pipe(map(toShare));
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

/** Tope y desplazamiento, cada uno sólo si se pidió. */
function paginacion(limit: number | undefined, offset: number | undefined): HttpParams {
  let params = topeDe(limit);
  if (offset !== undefined) {
    params = params.set('offset', String(offset));
  }
  return params;
}

/** Los filtros de la cola, omitiendo los que no se cargaron. */
function filtrosDeCola(filtros: LabWorkOrderQuery): HttpParams {
  let params = paginacion(filtros.limit, filtros.offset);
  for (const clave of [
    'laboratoryAccessionId',
    'statusConceptId',
    'assignedProfileId',
  ] as const) {
    const valor = filtros[clave];
    if (valor !== undefined && valor !== '') {
      params = params.set(clave, valor);
    }
  }
  return params;
}

/* ---- formas de transporte ------------------------------------------------
   Todas las fechas llegan como texto ISO; el resto del contrato viaja igual.
   `Fechas<T, K>` declara **qué claves** son fechas en cada tipo, en vez de
   inferirlas: una clave nueva del contrato tiene que obligar a decidir, no
   convertirse sola. Mismo criterio —y misma forma— que en `clinical`. */

type Fechas<T, K extends keyof T> = Omit<T, K> & Partial<Readonly<Record<K, string>>>;

// `previousDiagnosticReportId`/`duplicateOverrideReason` (antiduplicación,
// v4.2.17) son columnas nullable: MikroORM hidrata una fila sin valor como
// `null`, no como propiedad ausente, así que el transporte también viaja con
// `null` y hay que normalizarlo en `toOrder` — mismo motivo que el resto de
// este archivo usa `Fechas<T, K>` en vez de confiar en el tipo de la vista.
type WireOrder = Omit<
  DiagnosticOrder,
  'createdAt' | 'previousDiagnosticReportId' | 'duplicateOverrideReason'
> & {
  readonly createdAt: string;
  readonly previousDiagnosticReportId?: string | null;
  readonly duplicateOverrideReason?: string | null;
};

type WireReport = Omit<DiagnosticReport, 'createdAt'> & { readonly createdAt: string };

type WireLabWorkOrder = Fechas<LabWorkOrder, 'scheduledAt' | 'completedAt'>;

type WireOrderCreated = Omit<DiagnosticOrderCreated, 'createdAt'> & {
  readonly createdAt: string;
};

interface WirePatientDiagnostics extends Omit<PatientDiagnostics, 'orders' | 'reports'> {
  readonly orders: readonly WireOrder[];
  readonly reports: readonly WireReport[];
}

function toOrder({
  createdAt,
  previousDiagnosticReportId,
  duplicateOverrideReason,
  ...resto
}: WireOrder): DiagnosticOrder {
  return {
    ...resto,
    createdAt: new Date(createdAt),
    ...(previousDiagnosticReportId == null ? {} : { previousDiagnosticReportId }),
    ...(duplicateOverrideReason == null ? {} : { duplicateOverrideReason }),
  };
}

function toReport({ createdAt, ...resto }: WireReport): DiagnosticReport {
  return { ...resto, createdAt: new Date(createdAt) };
}

function toOrderCreated({ createdAt, ...resto }: WireOrderCreated): DiagnosticOrderCreated {
  return { ...resto, createdAt: new Date(createdAt) };
}

/* ---- antiduplicación de estudios, formas de transporte --------------------
   El backend manda `null` en los opcionales vacíos (previousStudy,
   warningMessage, y dentro del estudio previo conclusionText/
   reportDownloadUrl/serviceRequestId), no los omite: se normaliza con
   `sinNulos`, igual que el resto de los clientes. */

type WirePreviousStudy = ConNulos<Omit<PreviousStudy, 'performedAt'>> & {
  readonly performedAt: string;
};

interface WireDuplicateStudyCheckResult
  extends ConNulos<Omit<DuplicateStudyCheckResult, 'previousStudy'>> {
  readonly previousStudy: WirePreviousStudy | null;
}

function toPreviousStudy({ performedAt, ...resto }: WirePreviousStudy): PreviousStudy {
  return {
    ...sinNulos<Omit<PreviousStudy, 'performedAt'>>(resto),
    // `performedAt` no es opcional en el contrato del backend: siempre viene
    // como texto cuando `previousStudy` no es `null`.
    performedAt: new Date(performedAt),
  };
}

function toDuplicateStudyCheckResult({
  previousStudy,
  ...resto
}: WireDuplicateStudyCheckResult): DuplicateStudyCheckResult {
  return {
    ...sinNulos<Omit<DuplicateStudyCheckResult, 'previousStudy'>>(resto),
    ...(previousStudy === null ? {} : { previousStudy: toPreviousStudy(previousStudy) }),
  };
}

/**
 * Lee `details.previousStudy` de un 422 `DUPLICATE_STUDY_DETECTED` —la carrera
 * entre el chequeo y el alta (antiduplicación de estudios, T-26): alguien
 * liberó el informe entre que se mostró «sin duplicado» y que se mandó el
 * pedido, y el alta lo rechaza con el mismo estudio previo que hubiera dado
 * el chequeo. Es el único punto fuera de este cliente que necesita decodificar
 * la forma de transporte de `PreviousStudy`, así que se expone acá en vez de
 * hacer que quien la usa reimplemente `toPreviousStudy`.
 *
 * Devuelve `null` ante cualquier forma inesperada: no vale la pena fabricar un
 * estudio previo a medias para un diálogo que lo va a mostrar como si fuera
 * un dato real.
 */
export function previousStudyFromErrorDetails(
  details: Record<string, unknown> | undefined,
): PreviousStudy | null {
  const candidato = details?.['previousStudy'];
  if (typeof candidato !== 'object' || candidato === null) {
    return null;
  }
  const wire = candidato as Partial<WirePreviousStudy>;
  if (
    typeof wire.reportId !== 'string' ||
    typeof wire.studyName !== 'string' ||
    typeof wire.providerName !== 'string' ||
    typeof wire.performedAt !== 'string' ||
    typeof wire.daysAgo !== 'number' ||
    typeof wire.resultsAvailable !== 'boolean' ||
    typeof wire.sameOrganization !== 'boolean'
  ) {
    return null;
  }
  return toPreviousStudy(wire as WirePreviousStudy);
}

function toWorkOrder({ scheduledAt, completedAt, ...resto }: WireLabWorkOrder): LabWorkOrder {
  return {
    ...resto,
    ...fecha('scheduledAt', scheduledAt),
    ...fecha('completedAt', completedAt),
  };
}

/**
 * La clave con su fecha, o nada.
 *
 * Devolver `{}` y esparcirlo —en vez de asignar `undefined`— es lo que deja la
 * clave **ausente** en el objeto resultante. Con `undefined` la clave existe con
 * valor vacío, y `'completedAt' in orden` pasaría a decir que sí hay dato.
 */
function fecha<K extends string>(
  key: K,
  value: string | null | undefined,
): Partial<Record<K, Date>> {
  return value === null || value === undefined
    ? {}
    : ({ [key]: new Date(value) } as Record<K, Date>);
}

/* ---- el portal del paciente, formas de transporte ------------------------ */

type WirePatientResult = Fechas<PatientDiagnosticResult, 'issuedAt' | 'releasedAt'> & {
  // `releasedAt` no es opcional en el contrato: un resultado que llega a esta
  // lista está liberado por definición, así que siempre trae cuándo.
  readonly releasedAt: string;
};

interface WirePatientResults extends Omit<PatientDiagnosticResults, 'items'> {
  readonly items: readonly WirePatientResult[];
}

type WirePatientOrder = Fechas<PatientOrder, 'createdAt'> & {
  // Toda orden tiene fecha de pedido: es lo que la ordena en la lista.
  readonly createdAt: string;
};

interface WirePatientOrders extends Omit<PatientOwnOrders, 'items'> {
  readonly items: readonly WirePatientOrder[];
}

type WireShare = Fechas<DiagnosticResultShare, 'validFrom' | 'validTo'> & {
  readonly validFrom: string;
};

interface WireShares {
  readonly reportId: string;
  readonly items: readonly WireShare[];
}

function toPatientResult({
  issuedAt,
  releasedAt,
  ...resto
}: WirePatientResult): PatientDiagnosticResult {
  return { ...resto, ...fecha('issuedAt', issuedAt), releasedAt: new Date(releasedAt) };
}

function toPatientOrder({ createdAt, ...resto }: WirePatientOrder): PatientOrder {
  return { ...resto, ...normalizePatientSettlement(resto), createdAt: new Date(createdAt) };
}

function toShare({ validFrom, validTo, ...resto }: WireShare): DiagnosticResultShare {
  return { ...resto, validFrom: new Date(validFrom), ...fecha('validTo', validTo) };
}

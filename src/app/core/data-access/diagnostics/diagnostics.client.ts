import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { sendIdempotent, SubmissionKeys } from '../idempotency';
import { parseBlobError } from '../files/blob-error';
import { nombreDeContentDisposition } from '../files/content-disposition';
import type { DownloadedFile } from '../files/files.types';
import type {
  DiagnosticOrderCreated,
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
  PatientOwnOrders,
} from './diagnostics.types';
import type { PractitionerDiagnosticResult } from './diagnostics-practitioner-result.types';
import {
  toDuplicateStudyCheckResult,
  toOrder,
  toOrderCreated,
  toPatientOrder,
  toPatientResult,
  toPractitionerResult,
  toReport,
  toShare,
  toWorkOrder,
  type WireDuplicateStudyCheckResult,
  type WireLabWorkOrder,
  type WireOrderCreated,
  type WirePatientDiagnostics,
  type WirePatientOrders,
  type WirePatientResult,
  type WirePatientResults,
  type WirePractitionerResult,
  type WireShare,
  type WireShares,
} from './diagnostics.wire';

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
 * Acesionar un espécimen, cargar una versión del informe o liberarla son actos
 * del laboratorio sobre su propio instrumental: viven en {@link
 * DiagnosticsLabClient} (BR-17, CV-02/CL-47), no acá. Abrir una corrida de
 * analizador o ingerir un mensaje del LIS siguen sin cliente: son del
 * instrumento, no de una persona con un formulario delante.
 */
@Injectable({
  providedIn: 'root',
})
export class DiagnosticsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  /** Claves `Idempotency-Key` por intento de envío (ver `../idempotency`). */
  private readonly submissionKeys = new SubmissionKeys();

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
   * `GET /diagnostics/patients/:patientProfileId/reports/:reportId` — a
   * **released** report, read by the practitioner: values with their range,
   * conclusion and files.
   *
   * Same authorization as `getPatientDiagnostics`. Whatever cannot be read
   * (missing, another person's or organization's, not released) is the same
   * 404, without revealing which.
   */
  getPractitionerResult(patientProfileId: string, reportId: string): Observable<PractitionerDiagnosticResult> {
    return this.http
      .get<WirePractitionerResult>(
        this.url(
          `/diagnostics/patients/${encodeURIComponent(patientProfileId)}/reports/${encodeURIComponent(reportId)}`,
        ),
      )
      .pipe(map(toPractitionerResult));
  }

  /**
   * `GET /diagnostics/patients/:patientProfileId/reports/:reportId/files/:fileId/content`
   * — a released report's file, for the practitioner.
   *
   * `/common/files/:id/content` only serves whoever uploaded the file (the
   * lab): the doctor downloads it here, authorized by the record.
   */
  downloadPractitionerResultFile(
    patientProfileId: string,
    reportId: string,
    fileId: string,
  ): Observable<DownloadedFile> {
    return this.http
      .get(
        this.url(
          `/diagnostics/patients/${encodeURIComponent(patientProfileId)}/reports/${encodeURIComponent(reportId)}/files/${encodeURIComponent(fileId)}/content`,
        ),
        { responseType: 'blob', observe: 'response' },
      )
      .pipe(
        map((respuesta) => {
          const fileName = nombreDeContentDisposition(respuesta.headers.get('Content-Disposition'));
          return { blob: respuesta.body ?? new Blob([]), ...(fileName === undefined ? {} : { fileName }) };
        }),
        parseBlobError(),
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
   * Viaja con `Idempotency-Key`: reintentar el mismo envío no crea dos
   * órdenes del mismo estudio.
   *
   * @param orden - Paciente, organización, qué se pide y lo opcional que se haya cargado.
   * @returns La orden creada, con su identificador y su estado inicial.
   */
  requestStudy(orden: NewDiagnosticOrder): Observable<DiagnosticOrderCreated> {
    // Sin las claves ausentes: el backend valida con `forbidNonWhitelisted`
    // y un opcional en `undefined` viaja como clave declarada.
    const body = sinAusentes(orden);
    return sendIdempotent(this.submissionKeys, 'service-request', body, (headers) =>
      this.http.post<WireOrderCreated>(this.url('/clinical/service-requests'), body, { headers }),
    ).pipe(map(toOrderCreated));
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
   * `GET /diagnostic-results/me/:reportId/files/:fileId/content` — un archivo de
   * un resultado **propio** (CL-40).
   *
   * Baja los bytes por `HttpClient` (con `Authorization`) y **no** pide una URL
   * firmada para abrirla en otra pestaña: esa pestaña sale sin credencial. La
   * ruta autoriza por titularidad y versión liberada —no por quién subió el
   * archivo, que fue el laboratorio— y todo lo que no cumpla responde 404, sin
   * revelar si el archivo existe.
   *
   * @param reportId - Informe del titular.
   * @param fileId - Archivo que cuelga de ese informe.
   */
  downloadOwnResultFile(reportId: string, fileId: string): Observable<DownloadedFile> {
    return this.http
      .get(
        this.url(
          `/diagnostic-results/me/${encodeURIComponent(reportId)}/files/${encodeURIComponent(fileId)}/content`,
        ),
        { responseType: 'blob', observe: 'response' },
      )
      .pipe(
        map((respuesta) => {
          const fileName = nombreDeContentDisposition(respuesta.headers.get('Content-Disposition'));
          return {
            blob: respuesta.body ?? new Blob([]),
            ...(fileName === undefined ? {} : { fileName }),
          };
        }),
        parseBlobError(),
      );
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
          practitionerProfileId: compartir.practitionerProfileId,
          validUntil: compartir.validUntil.toISOString(),
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
    'collectionCareSpaceId',
  ] as const) {
    const valor = filtros[clave];
    if (valor !== undefined && valor !== '') {
      params = params.set(clave, valor);
    }
  }
  return params;
}

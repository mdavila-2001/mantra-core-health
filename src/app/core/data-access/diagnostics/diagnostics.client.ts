import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  DiagnosticOrder,
  DiagnosticOrderCreated,
  DiagnosticReport,
  ImagingStudy,
  LabWorkOrder,
  LabWorkOrderQuery,
  NewDiagnosticOrder,
  PatientDiagnostics,
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

type WireOrder = Omit<DiagnosticOrder, 'createdAt'> & { readonly createdAt: string };

type WireReport = Omit<DiagnosticReport, 'createdAt'> & { readonly createdAt: string };

type WireLabWorkOrder = Fechas<LabWorkOrder, 'scheduledAt' | 'completedAt'>;

type WireOrderCreated = Omit<DiagnosticOrderCreated, 'createdAt'> & {
  readonly createdAt: string;
};

interface WirePatientDiagnostics extends Omit<PatientDiagnostics, 'orders' | 'reports'> {
  readonly orders: readonly WireOrder[];
  readonly reports: readonly WireReport[];
}

function toOrder({ createdAt, ...resto }: WireOrder): DiagnosticOrder {
  return { ...resto, createdAt: new Date(createdAt) };
}

function toReport({ createdAt, ...resto }: WireReport): DiagnosticReport {
  return { ...resto, createdAt: new Date(createdAt) };
}

function toOrderCreated({ createdAt, ...resto }: WireOrderCreated): DiagnosticOrderCreated {
  return { ...resto, createdAt: new Date(createdAt) };
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

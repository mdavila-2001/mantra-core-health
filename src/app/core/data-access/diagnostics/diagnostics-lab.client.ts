import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AccessionCreated,
  AccessionDetail,
  AccessionSpecimenDetail,
  NewAccession,
  NewContainer,
  NewCustodyEvent,
  NewReportVersion,
  NewSpecimen,
  RejectSpecimen,
  ReleaseReportVersion,
  ResourceCreated,
  SpecimenCustodyEvent,
  SpecimenDetail,
} from './diagnostics-lab.types';

/**
 * El circuito del laboratorio propio: acesión, espécimen, versión de informe
 * y liberación (CV-02, CL-47).
 *
 * ## Por qué es un cliente aparte de `DiagnosticsClient`
 *
 * `DiagnosticsClient` documenta, en su propio encabezado, que estos actos
 * «tienen endpoint y no están acá»: son operaciones del laboratorio sobre su
 * propio instrumental (acesionar lo que llegó, cargar una versión, liberarla),
 * sin ninguna lectura del lado de quien pidió el estudio que las reflejara.
 * Ahora sí hay lectura —el detalle de la acesión y del espécimen, CL-47— así
 * que el contrato entra completo, pero sigue siendo un cliente propio: quien
 * pide un estudio nunca acesiona nada, y quien acesiona nunca necesita el
 * cliente del paciente.
 *
 * ## Rol y tenant
 *
 * Todas exigen `CLINICIAN` o `PRACTITIONER`, declarado a nivel de controlador
 * en el backend. Las lecturas (`getAccession`, `getSpecimen`) se acotan al
 * tenant del contexto **del lado del servidor**: este cliente nunca manda un
 * `tenantId` de acompañamiento, y una acesión de otro laboratorio responde
 * 404 sin decir que existe.
 *
 * ## D-E: la liberación
 *
 * `releaseReportVersion` es el **único** camino que hace que un resultado
 * liberado aparezca en «Mis resultados» del paciente (ver
 * `docs/progress/DECISIONS.md`, D-E). El camino que colgaba de
 * `ClinicalClient.releaseDiagnosticReport` quedó deprecado del lado del
 * backend: no se reintroduce acá una segunda forma de liberar.
 */
@Injectable({
  providedIn: 'root',
})
export class DiagnosticsLabClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Soporte: da de alta un espécimen en estado recolectado. */
  createSpecimen(nuevo: NewSpecimen): Observable<ResourceCreated> {
    return this.http.post<ResourceCreated>(this.url('/diagnostics/specimens'), sinAusentes(nuevo));
  }

  /** `POST /diagnostics/accessions` — acesiona especímenes recibidos (UC-20-01). */
  accession(nuevo: NewAccession): Observable<AccessionCreated> {
    return this.http.post<AccessionCreated>(this.url('/diagnostics/accessions'), sinAusentes(nuevo));
  }

  /**
   * `GET /diagnostics/accessions/:id` — detalle con especímenes, contenedor y
   * cadena de custodia (CL-47).
   */
  getAccession(accessionId: string): Observable<AccessionDetail> {
    return this.http
      .get<WireAccessionDetail>(this.url(`/diagnostics/accessions/${encodeURIComponent(accessionId)}`))
      .pipe(map(toAccessionDetail));
  }

  /** `GET /diagnostics/specimens/:id` — detalle con su cadena de custodia (CL-47). */
  getSpecimen(specimenId: string): Observable<SpecimenDetail> {
    return this.http
      .get<WireSpecimenDetail>(this.url(`/diagnostics/specimens/${encodeURIComponent(specimenId)}`))
      .pipe(map(toSpecimenDetail));
  }

  /** `POST /diagnostics/specimens/:id/rejection` — rechaza y pide recolección (UC-20-02). */
  rejectSpecimen(specimenId: string, rechazo: RejectSpecimen): Observable<ResourceCreated> {
    return this.http.post<ResourceCreated>(
      this.url(`/diagnostics/specimens/${encodeURIComponent(specimenId)}/rejection`),
      sinAusentes(rechazo),
    );
  }

  /** Soporte: crea un contenedor para un espécimen. */
  createContainer(specimenId: string, nuevo: NewContainer): Observable<ResourceCreated> {
    return this.http.post<ResourceCreated>(
      this.url(`/diagnostics/specimens/${encodeURIComponent(specimenId)}/containers`),
      sinAusentes(nuevo),
    );
  }

  /** `POST /diagnostics/containers/:id/custody-events` — traslado/custodia (UC-20-03). */
  recordCustodyEvent(containerId: string, evento: NewCustodyEvent): Observable<ResourceCreated> {
    return this.http.post<ResourceCreated>(
      this.url(`/diagnostics/containers/${encodeURIComponent(containerId)}/custody-events`),
      sinAusentes(evento),
    );
  }

  /** `POST /diagnostics/reports/:reportId/versions` — crea o enmienda una versión (UC-20-07). */
  createReportVersion(reportId: string, version: NewReportVersion): Observable<ResourceCreated> {
    return this.http.post<ResourceCreated>(
      this.url(`/diagnostics/reports/${encodeURIComponent(reportId)}/versions`),
      sinAusentes(version),
    );
  }

  /**
   * `POST /diagnostics/reports/:reportId/versions/:versionId/release` (D-E,
   * UC-20-08) — el único camino de liberación (ver el encabezado de la clase).
   */
  releaseReportVersion(
    reportId: string,
    versionId: string,
    liberar: ReleaseReportVersion = {},
  ): Observable<ResourceCreated> {
    return this.http.post<ResourceCreated>(
      this.url(
        `/diagnostics/reports/${encodeURIComponent(reportId)}/versions/${encodeURIComponent(versionId)}/release`,
      ),
      sinAusentes(liberar),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/**
 * El mismo objeto sin las claves cuyo valor es `undefined`.
 *
 * `JSON.stringify` ya las omitiría, pero depender de eso ata el cuerpo enviado
 * a un detalle del serializador: acá se declara la intención, que es la que
 * el `forbidNonWhitelisted` del backend está mirando. Mismo criterio que
 * `DiagnosticsClient`.
 */
function sinAusentes<T extends object>(valor: T): Partial<T> {
  return Object.fromEntries(Object.entries(valor).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/* ---- formas de transporte -------------------------------------------------
   Igual que en `DiagnosticsClient`: las fechas viajan como texto ISO. */

type WireCustodyEvent = Omit<SpecimenCustodyEvent, 'occurredAt'> & { readonly occurredAt: string };

type WireSpecimenDetail = Omit<SpecimenDetail, 'collectedAt' | 'receivedAt' | 'custodyEvents'> & {
  readonly collectedAt?: string;
  readonly receivedAt?: string;
  readonly custodyEvents: readonly WireCustodyEvent[];
};

type WireAccessionSpecimenDetail = Omit<AccessionSpecimenDetail, 'specimen'> & {
  readonly specimen: WireSpecimenDetail;
};

type WireAccessionDetail = Omit<AccessionDetail, 'receivedAt' | 'specimens'> & {
  readonly receivedAt: string;
  readonly specimens: readonly WireAccessionSpecimenDetail[];
};

function toSpecimenDetail({
  collectedAt,
  receivedAt,
  custodyEvents,
  ...resto
}: WireSpecimenDetail): SpecimenDetail {
  return {
    ...resto,
    ...(collectedAt === undefined ? {} : { collectedAt: new Date(collectedAt) }),
    ...(receivedAt === undefined ? {} : { receivedAt: new Date(receivedAt) }),
    custodyEvents: custodyEvents.map((evento) => ({
      ...evento,
      occurredAt: new Date(evento.occurredAt),
    })),
  };
}

function toAccessionDetail(wire: WireAccessionDetail): AccessionDetail {
  return {
    ...wire,
    receivedAt: new Date(wire.receivedAt),
    specimens: wire.specimens.map((item) => ({
      ...item,
      specimen: toSpecimenDetail(item.specimen),
    })),
  };
}

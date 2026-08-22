import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate } from '../wire';
import type {
  CreateVisitRequestBody,
  CreatedResource,
  InformationalMaterial,
  MedicalVisitor,
  PharmaLab,
  PharmaLabStaff,
  PharmaProduct,
  PharmacovigilanceReport,
  PublishedAgenda,
  PutVisitPolicyBody,
  RatingAggregate,
  RegulatoryDocument,
  TransitionResult,
  UnlinkResult,
  VisitRecord,
  VisitRequest,
} from './pharma-lab.types';

/** Forma en la que viajan las fechas de una solicitud de visita. */
type WireVisitRequest = Omit<
  VisitRequest,
  'requestedStartAt' | 'proposedStartAt' | 'confirmedAt'
> & {
  readonly requestedStartAt: string;
  readonly proposedStartAt: string | null;
  readonly confirmedAt: string | null;
};

/** Forma en la que viajan las fechas de un registro de visita. */
type WireVisitRecord = Omit<VisitRecord, 'occurredAt'> & {
  readonly occurredAt: string;
};

/** Forma en la que viaja la fecha de aprobación de un material. */
type WireMaterial = Omit<InformationalMaterial, 'approvedAt'> & {
  readonly approvedAt: string | null;
};

/**
 * Cliente del carril 17: laboratorio farmacéutico, visitadores, visitas,
 * catálogo, farmacovigilancia y documentación regulatoria.
 *
 * Es un cliente y no un servicio de estado: devuelve lo que la API devuelve, con
 * las fechas ya convertidas. Quién guarda qué lo decide cada pantalla.
 */
@Injectable({ providedIn: 'root' })
export class PharmaLabClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* -- Laboratorio y personal -------------------------------------------- */

  /** `GET /pharma-labs` — laboratorios registrados. */
  listLabs(): Observable<readonly PharmaLab[]> {
    return this.http.get<PharmaLab[]>(this.url('/pharma-labs'));
  }

  /** `GET /pharma-labs/:id` — perfil institucional. */
  getLab(pharmaLabId: string): Observable<PharmaLab> {
    return this.http.get<PharmaLab>(this.url(`/pharma-labs/${enc(pharmaLabId)}`));
  }

  /** `GET /pharma-labs/:id/staff` — personal del laboratorio. */
  listStaff(pharmaLabId: string): Observable<readonly PharmaLabStaff[]> {
    return this.http.get<PharmaLabStaff[]>(
      this.url(`/pharma-labs/${enc(pharmaLabId)}/staff`),
    );
  }

  /* -- Visitadores -------------------------------------------------------- */

  /** `GET /pharma-labs/:id/medical-visitors` — visitadores del laboratorio. */
  listVisitors(pharmaLabId: string): Observable<readonly MedicalVisitor[]> {
    return this.http.get<MedicalVisitor[]>(
      this.url(`/pharma-labs/${enc(pharmaLabId)}/medical-visitors`),
    );
  }

  /**
   * `POST /pharma-labs/:id/medical-visitors/:visitorId/unlink` — desvincula al
   * visitador y revoca sus accesos.
   */
  unlinkVisitor(
    pharmaLabId: string,
    medicalVisitorId: string,
    reason: string,
  ): Observable<UnlinkResult> {
    return this.http.post<UnlinkResult>(
      this.url(
        `/pharma-labs/${enc(pharmaLabId)}/medical-visitors/${enc(medicalVisitorId)}/unlink`,
      ),
      { reason },
    );
  }

  /* -- Catálogo y material ------------------------------------------------ */

  /** `GET /pharma-labs/:id/products` — catálogo de medicamentos. */
  listProducts(pharmaLabId: string): Observable<readonly PharmaProduct[]> {
    return this.http.get<PharmaProduct[]>(
      this.url(`/pharma-labs/${enc(pharmaLabId)}/products`),
    );
  }

  /** `GET /pharma-labs/:id/materials` — material informativo. */
  listMaterials(
    pharmaLabId: string,
  ): Observable<readonly InformationalMaterial[]> {
    return this.http
      .get<WireMaterial[]>(this.url(`/pharma-labs/${enc(pharmaLabId)}/materials`))
      .pipe(
        map((rows) =>
          rows.map((row) => ({
            ...row,
            approvedAt: maybeDate(row.approvedAt) ?? null,
          })),
        ),
      );
  }

  /* -- Agenda de visitas -------------------------------------------------- */

  /** `GET /visit-agenda/me` — la propia agenda del doctor. */
  getOwnAgenda(): Observable<PublishedAgenda> {
    return this.http.get<PublishedAgenda>(this.url('/visit-agenda/me'));
  }

  /** `PUT /visit-agenda/me` — configura la agenda de visitas del doctor. */
  putAgenda(body: PutVisitPolicyBody): Observable<TransitionResult> {
    return this.http.put<TransitionResult>(this.url('/visit-agenda/me'), body);
  }

  /** `GET /visit-agenda/doctors/:id` — agenda publicada de un doctor. */
  getDoctorAgenda(doctorUserId: string): Observable<PublishedAgenda> {
    return this.http.get<PublishedAgenda>(
      this.url(`/visit-agenda/doctors/${enc(doctorUserId)}`),
    );
  }

  /* -- Solicitudes de visita ---------------------------------------------- */

  /** `POST /visit-requests` — el visitador solicita una visita. */
  createVisitRequest(
    body: CreateVisitRequestBody,
  ): Observable<CreatedResource> {
    return this.http.post<CreatedResource>(this.url('/visit-requests'), body);
  }

  /** `GET /visit-requests/mine` — solicitudes del visitador de la sesión. */
  listOwnVisitRequests(): Observable<readonly VisitRequest[]> {
    return this.http
      .get<WireVisitRequest[]>(this.url('/visit-requests/mine'))
      .pipe(map((rows) => rows.map(toVisitRequest)));
  }

  /** `GET /visit-requests/inbox` — solicitudes recibidas por el doctor. */
  listDoctorVisitRequests(): Observable<readonly VisitRequest[]> {
    return this.http
      .get<WireVisitRequest[]>(this.url('/visit-requests/inbox'))
      .pipe(map((rows) => rows.map(toVisitRequest)));
  }

  /** `POST /visit-requests/:id/accept` — el doctor acepta la visita. */
  acceptVisit(visitRequestId: string, note?: string): Observable<TransitionResult> {
    return this.http.post<TransitionResult>(
      this.url(`/visit-requests/${enc(visitRequestId)}/accept`),
      note === undefined ? {} : { note },
    );
  }

  /** `POST /visit-requests/:id/reject` — el doctor rechaza la visita. */
  rejectVisit(visitRequestId: string, note?: string): Observable<TransitionResult> {
    return this.http.post<TransitionResult>(
      this.url(`/visit-requests/${enc(visitRequestId)}/reject`),
      note === undefined ? {} : { note },
    );
  }

  /** `POST /visit-requests/:id/cancel` — cancela la visita. */
  cancelVisit(
    visitRequestId: string,
    reason: string,
  ): Observable<TransitionResult> {
    return this.http.post<TransitionResult>(
      this.url(`/visit-requests/${enc(visitRequestId)}/cancel`),
      { reason },
    );
  }

  /* -- Visitas realizadas -------------------------------------------------- */

  /** `GET /visit-records/inbox` — visitas recibidas por el doctor. */
  listDoctorVisitRecords(): Observable<readonly VisitRecord[]> {
    return this.http
      .get<WireVisitRecord[]>(this.url('/visit-records/inbox'))
      .pipe(map((rows) => rows.map(toVisitRecord)));
  }

  /** `GET /visit-records/labs/:id` — historial de visitas del laboratorio. */
  listLabVisitRecords(
    pharmaLabId: string,
  ): Observable<readonly VisitRecord[]> {
    return this.http
      .get<WireVisitRecord[]>(this.url(`/visit-records/labs/${enc(pharmaLabId)}`))
      .pipe(map((rows) => rows.map(toVisitRecord)));
  }

  /** `GET /visit-records/labs/:id/rating-summary` — promedios, no notas sueltas. */
  getRatingSummary(pharmaLabId: string): Observable<RatingAggregate> {
    return this.http.get<RatingAggregate>(
      this.url(`/visit-records/labs/${enc(pharmaLabId)}/rating-summary`),
    );
  }

  /* -- Farmacovigilancia y documentación ---------------------------------- */

  /** `GET /pharma-labs/:id/pharmacovigilance/reports` — reportes del laboratorio. */
  listPharmacovigilanceReports(
    pharmaLabId: string,
  ): Observable<readonly PharmacovigilanceReport[]> {
    return this.http.get<PharmacovigilanceReport[]>(
      this.url(`/pharma-labs/${enc(pharmaLabId)}/pharmacovigilance/reports`),
    );
  }

  /** `GET /pharma-labs/:id/regulatory-documents` — repositorio documental. */
  listRegulatoryDocuments(
    pharmaLabId: string,
  ): Observable<readonly RegulatoryDocument[]> {
    return this.http.get<RegulatoryDocument[]>(
      this.url(`/pharma-labs/${enc(pharmaLabId)}/regulatory-documents`),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function enc(value: string): string {
  return encodeURIComponent(value);
}

function toVisitRequest(row: WireVisitRequest): VisitRequest {
  return {
    ...row,
    requestedStartAt: new Date(row.requestedStartAt),
    proposedStartAt: maybeDate(row.proposedStartAt) ?? null,
    confirmedAt: maybeDate(row.confirmedAt) ?? null,
  };
}

function toVisitRecord(row: WireVisitRecord): VisitRecord {
  return { ...row, occurredAt: new Date(row.occurredAt) };
}

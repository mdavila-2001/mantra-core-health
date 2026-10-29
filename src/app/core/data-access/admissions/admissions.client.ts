import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, switchMap, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AdmissionCoded,
  AdmissionDecisionCommand,
  AdmissionDetail,
  AdmissionDocument,
  AdmissionListQuery,
  AdmissionPage,
  AdmissionStatusCode,
  AdmissionSummary,
  ClaimAdmissionCommand,
  DocumentAccess,
  MyAdmission,
  ReassignAdmissionCommand,
  ReinstateCommand,
  ReleaseAdmissionCommand,
  RequestInfoCommand,
  RequirementReviewCommand,
  RequirementStatusCode,
  RequirementsSummary,
  ResubmitCommand,
  SubmittedFormField,
  SubmittedFormSection,
  SuspendCommand,
  WireAdmissionDetail,
  WireAdmissionPage,
  WireAdmissionSummary,
  WireDocumentAccess,
  WireMyAdmission,
} from './admissions.types';
import { ADMISSION_STATUS_LABELS } from './admissions.types';

const SIN_REQUISITOS: RequirementsSummary = { total: 0, verified: 0, rejected: 0, pending: 0 };

/* ---- vocabulario heredado --------------------------------------------------
   La primera versión del contrato hablaba en español. Se acepta en la frontera
   y se traduce: el resto de la aplicación solo conoce los códigos en inglés. */

const ESTADO_HEREDADO: Readonly<Record<string, AdmissionStatusCode>> = {
  ENVIADA: 'SUBMITTED',
  EN_REVISION: 'IN_REVIEW',
  INFORMACION_REQUERIDA: 'INFO_REQUESTED',
  VERIFICADA: 'VERIFIED',
  RECHAZADA: 'REJECTED',
  SUSPENDIDA: 'SUSPENDED',
  EXPIRADA: 'EXPIRED',
  RETIRADA: 'WITHDRAWN',
};

const REQUISITO_HEREDADO: Readonly<Record<string, RequirementStatusCode>> = {
  PENDIENTE: 'PENDING',
  VERIFICADO: 'VERIFIED',
  RECHAZADO: 'REJECTED',
  INFO_REQUERIDA: 'INFO_REQUIRED',
};

export function normalizeStatusCode(code: string): string {
  return ESTADO_HEREDADO[code] ?? code;
}

function requirementCode(code: string): RequirementStatusCode {
  return (REQUISITO_HEREDADO[code] ?? code) as RequirementStatusCode;
}

function normalizeStatus(status: AdmissionCoded): AdmissionCoded {
  const code = normalizeStatusCode(status.code);
  const known = ADMISSION_STATUS_LABELS[code as AdmissionStatusCode] as string | undefined;
  return { code, label: status.label || known || code };
}

function fecha(valor: string | null | undefined): Date | null {
  return valor === null || valor === undefined ? null : new Date(valor);
}

function toSummary(wire: WireAdmissionSummary): AdmissionSummary {
  return {
    id: wire.id,
    type: wire.type,
    status: normalizeStatus(wire.status),
    practitioner: wire.practitioner,
    itemsSummary: wire.itemsSummary,
    requirementsSummary: wire.requirementsSummary ?? SIN_REQUISITOS,
    submittedAt: new Date(wire.submittedAt),
    dueAt: fecha(wire.dueAt),
    overdue: wire.overdue,
    assignedTo: wire.assignedTo,
    rowVersion: wire.rowVersion,
  };
}

/** La lista plana de documentos, a partir de los requisitos, si la API no la trae. */
function documentosDe(requisitos: AdmissionDetail['requirements']): AdmissionDocument[] {
  return requisitos.flatMap((r) =>
    r.documents.map((d) => ({
      id: `${r.id}:${d.fileId}`,
      requirementCode: r.code,
      fileId: d.fileId,
      name: d.name,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      uploadedAt: null,
      pages: null,
      reviewState: r.status,
    })),
  );
}

/** El formulario enviado, armado con la ficha, si la API no lo trae por secciones. */
function formularioDe(wire: WireAdmissionDetail): SubmittedFormSection[] {
  const campo = (
    key: string,
    label: string,
    value: string | null | undefined,
    required: boolean,
    requirementCode: string | null = null,
  ): SubmittedFormField => ({ key, label, value: value ?? null, required, requirementCode, kind: 'TEXT' });
  const p = wire.practitioner;
  return [
    {
      key: 'personal',
      title: 'Datos personales',
      fields: [
        campo('fullName', 'Nombre completo', p.fullName, true, 'NATIONAL_ID'),
        campo('nationalId', 'Documento de identidad', p.nationalId, true, 'NATIONAL_ID'),
        campo('profession', 'Profesión', p.profession, true),
      ],
    },
    {
      key: 'contact',
      title: 'Contacto',
      fields: [campo('email', 'Correo', p.email, true), campo('phone', 'Teléfono', p.phone, false)],
    },
    {
      key: 'licenses',
      title: 'Matrícula',
      fields: wire.licenses.map((l) =>
        campo(`license-${l.id}`, `Matrícula (${l.jurisdiction})`, l.number, true, 'PROFESSIONAL_LICENSE'),
      ),
    },
    {
      key: 'credentials',
      title: 'Títulos y estudios',
      fields: wire.credentials.map((c) => campo(`credential-${c.id}`, c.title, c.institution, true, 'DEGREE')),
    },
    {
      key: 'specialties',
      title: 'Especialidades',
      fields: wire.specialties.map((e) =>
        campo(`specialty-${e.id}`, 'Especialidad', e.name, false, 'SPECIALTY_CERTIFICATE'),
      ),
    },
  ];
}

function toDetail(wire: WireAdmissionDetail): AdmissionDetail {
  const requirements = (wire.requirements ?? []).map((r) => ({
    ...r,
    status: requirementCode(r.status),
    reviewedAt: fecha(r.reviewedAt),
    source: r.source === null ? null : { ...r.source, consultedAt: fecha(r.source.consultedAt) },
  }));
  return {
    ...toSummary(wire),
    practitioner: { ...wire.practitioner, registeredAt: fecha(wire.practitioner.registeredAt) },
    licenses: wire.licenses.map((l) => ({ ...l, verifiedAt: fecha(l.verifiedAt) })),
    credentials: wire.credentials.map((c) => ({ ...c, verifiedAt: fecha(c.verifiedAt) })),
    specialties: wire.specialties,
    requirements,
    documents:
      wire.documents === undefined
        ? documentosDe(requirements)
        : wire.documents.map((d) => ({
            ...d,
            uploadedAt: fecha(d.uploadedAt),
            reviewState: d.reviewState === null ? null : requirementCode(d.reviewState),
          })),
    submittedForm: wire.submittedForm ?? formularioDe(wire),
    events: wire.events.map((e) => ({ ...e, occurredAt: new Date(e.occurredAt) })),
    infoRequestedText: wire.infoRequestedText,
    infoDueAt: fecha(wire.infoDueAt),
    decisionReasonText: wire.decisionReasonText,
    allowedActions: wire.allowedActions ?? [],
    assignableReviewers: wire.assignableReviewers ?? [],
  };
}

function toMine(wire: WireMyAdmission): MyAdmission {
  return {
    id: wire.id,
    status: normalizeStatus(wire.status),
    submittedAt: new Date(wire.submittedAt),
    dueAt: fecha(wire.dueAt),
    infoDueAt: fecha(wire.infoDueAt),
    infoRequestedText: wire.infoRequestedText,
    decisionReasonText: wire.decisionReasonText,
    resubmissionsRemaining: wire.resubmissionsRemaining ?? null,
    items: wire.items.map((i) => ({ ...i, state: normalizeItemState(i.state) })),
  };
}

function normalizeItemState(state: string): string {
  return REQUISITO_HEREDADO[state] ?? state;
}

function toPage(page: WireAdmissionPage): AdmissionPage {
  const counts: Record<string, number> = {};
  for (const [code, n] of Object.entries(page.counts)) counts[normalizeStatusCode(code)] = n;
  return { items: page.items.map(toSummary), nextCursor: page.nextCursor, counts };
}

/** Los filtros como parámetros de URL; lo vacío no se manda. */
function paramsOf(query: AdmissionListQuery): HttpParams {
  let params = new HttpParams();
  if (query.type) params = params.set('type', query.type);
  if (query.status) params = params.set('status', query.status);
  if (query.assignedTo) params = params.set('assignedTo', query.assignedTo);
  if (query.overdue === true) params = params.set('overdue', 'true');
  if (query.cursor) params = params.set('cursor', query.cursor);
  if (query.limit !== undefined) params = params.set('limit', query.limit);
  return params.set('sort', query.sort ?? 'due_at');
}

/**
 * Admisiones (`/admissions`): la bandeja de quien revisa y resuelve, y la
 * lectura del propio médico (`/profiles/practitioners/me/admission`).
 *
 * La autoridad es la API: cada ruta exige su rol (revisor, aprobador o
 * administrador de seguridad) y las que escriben piden `expectedRowVersion`.
 * Una versión vieja es un 409 `ADMISSION_STALE`; una transición que el estado
 * no admite, un 412. El cliente no los anticipa: los entrega tal cual.
 */
@Injectable({ providedIn: 'root' })
export class AdmissionsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }

  private admission(id: string): string {
    return this.url(`/admissions/${encodeURIComponent(id)}`);
  }

  /**
   * La bandeja, ordenada por vencimiento y con cursor.
   *
   * Sin texto de búsqueda es un `GET /admissions`. Con texto va por
   * `POST /admissions/search`: el documento de una persona no debe quedar en
   * la dirección, que se copia, se guarda en el historial y llega a los
   * registros de los servidores intermedios.
   */
  list(query: AdmissionListQuery = {}): Observable<AdmissionPage> {
    const request =
      query.q === undefined || query.q.trim() === ''
        ? this.http.get<WireAdmissionPage>(this.url('/admissions'), { params: paramsOf(query) })
        : this.http.post<WireAdmissionPage>(this.url('/admissions/search'), {
            q: query.q.trim(),
            ...(query.type ? { type: query.type } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.assignedTo ? { assignedTo: query.assignedTo } : {}),
            ...(query.overdue === true ? { overdue: true } : {}),
            ...(query.cursor ? { cursor: query.cursor } : {}),
            ...(query.limit === undefined ? {} : { limit: query.limit }),
            sort: query.sort ?? 'due_at',
          });
    return request.pipe(map(toPage));
  }

  /** `GET /admissions/:id` — la ficha completa, con requisitos e historial. */
  get(id: string): Observable<AdmissionDetail> {
    return this.http.get<WireAdmissionDetail>(this.admission(id)).pipe(map(toDetail));
  }

  /** `POST /admissions/:id/claim` — tomar la revisión (REVIEWER). */
  claim(id: string, command: ClaimAdmissionCommand): Observable<AdmissionDetail> {
    return this.write(id, 'claim', command);
  }

  /** `POST /admissions/:id/release` — soltar una revisión tomada. */
  release(id: string, command: ReleaseAdmissionCommand): Observable<AdmissionDetail> {
    return this.write(id, 'release', command);
  }

  /** `POST /admissions/:id/reassign` — pasar la revisión a otra persona (APPROVER). */
  reassign(id: string, command: ReassignAdmissionCommand): Observable<AdmissionDetail> {
    return this.write(id, 'reassign', command);
  }

  /** `POST /admissions/:id/request-info` — pedir información (REVIEWER). */
  requestInfo(id: string, command: RequestInfoCommand): Observable<AdmissionDetail> {
    return this.write(id, 'request-info', command);
  }

  /** `POST /admissions/:id/items/:itemId/review` — revisar un requisito (REVIEWER). */
  reviewRequirement(
    id: string,
    requirementId: string,
    command: RequirementReviewCommand,
  ): Observable<AdmissionDetail> {
    return this.write(id, `items/${encodeURIComponent(requirementId)}/review`, command);
  }

  /** `POST /admissions/:id/decision` — la decisión final (APPROVER). */
  decide(id: string, command: AdmissionDecisionCommand): Observable<AdmissionDetail> {
    return this.write(id, 'decision', command);
  }

  /** `POST /admissions/:id/suspend` (APPROVER). */
  suspend(id: string, command: SuspendCommand): Observable<AdmissionDetail> {
    return this.write(id, 'suspend', command);
  }

  /** `POST /admissions/:id/reinstate` (APPROVER). */
  reinstate(id: string, command: ReinstateCommand): Observable<AdmissionDetail> {
    return this.write(id, 'reinstate', command);
  }

  private write(id: string, action: string, command: object): Observable<AdmissionDetail> {
    return this.http
      .post<WireAdmissionDetail>(`${this.admission(id)}/${action}`, command)
      .pipe(map(toDetail));
  }

  /**
   * `GET /admissions/:id/documents/:fileId` — acceso auditado a un documento:
   * la API deja constancia de quién lo pidió y entrega una dirección firmada
   * de vida corta.
   */
  documentAccess(id: string, fileId: string): Observable<DocumentAccess> {
    return this.http
      .get<WireDocumentAccess>(`${this.admission(id)}/documents/${encodeURIComponent(fileId)}`)
      .pipe(map((acceso) => ({ url: acceso.url, expiresAt: new Date(acceso.expiresAt) })));
  }

  /** Pide el acceso y baja los bytes del documento con esa dirección firmada. */
  documentContent(
    id: string,
    fileId: string,
  ): Observable<{ readonly blob: Blob; readonly originalName: string | null }> {
    return this.documentAccess(id, fileId).pipe(
      switchMap((acceso) =>
        this.http.get(/^https?:\/\//i.test(acceso.url) ? acceso.url : this.url(acceso.url), {
          responseType: 'blob',
          observe: 'response',
        }),
      ),
      map((respuesta) => ({
        blob: respuesta.body ?? new Blob([]),
        originalName: nombreDe(respuesta.headers.get('Content-Disposition')),
      })),
    );
  }

  /** `GET /profiles/practitioners/me/admission` — 404 si la persona no tiene admisión. */
  myAdmission(): Observable<MyAdmission> {
    return this.http
      .get<WireMyAdmission>(this.url('/profiles/practitioners/me/admission'))
      .pipe(map(toMine));
  }

  /** `POST /profiles/practitioners/me/admission/resubmit` — corregir y reenviar, con atestación. */
  resubmitMyAdmission(command: ResubmitCommand): Observable<MyAdmission> {
    return this.http
      .post<WireMyAdmission>(this.url('/profiles/practitioners/me/admission/resubmit'), command)
      .pipe(map(toMine));
  }
}

function nombreDe(cabecera: string | null): string | null {
  if (cabecera === null) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cabecera);
  if (utf8?.[1] !== undefined) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      return null;
    }
  }
  return /filename="?([^";]+)"?/i.exec(cabecera)?.[1] ?? null;
}

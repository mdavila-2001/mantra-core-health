import { HttpBackend, HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, from, map, switchMap, throwError, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AdmissionCoded,
  AdmissionDecisionCommand,
  AdmissionDetail,
  AdmissionDocument,
  AdmissionEvent,
  AdmissionListQuery,
  AdmissionPage,
  AdmissionRequirement,
  AdmissionReviewItem,
  AdmissionStatusCode,
  AdmissionSummary,
  ClaimAdmissionCommand,
  DocumentAccess,
  MyAdmission,
  ReassignAdmissionCommand,
  ReasonCode,
  ReinstateCommand,
  ReleaseAdmissionCommand,
  RequestInfoCommand,
  RequirementReviewCommand,
  RequirementsSummary,
  RequirementSource,
  RequirementStateCode,
  RequirementStatusCode,
  ResubmitCommand,
  SourceTypeCode,
  SubmittedFormField,
  SubmittedFormSection,
  SuspendCommand,
  WireAdmissionDetail,
  WireAdmissionPage,
  WireAdmissionSummary,
  WireCoded,
  WireDocumentAccess,
  WireMyAdmission,
  WireRequirement,
  WireReviewItem,
  WireSubmittedForm,
} from './admissions.types';
import { ADMISSION_STATUS_LABELS, SOURCE_TYPE_LABELS } from './admissions.types';

/* ---- vocabulario de la API ---------------------------------------------------
   La API habla en español (`EN_REVISION`, `REGISTRO_MINSALUD`, `ILEGIBLE`). El
   resto de la aplicación conoce códigos estables en inglés: se traduce aquí, en
   la frontera, en los dos sentidos. Un código que no se conoce pasa tal cual
   (la API puede sumar uno sin romper la pantalla). */

const ESTADO_DE_API: Readonly<Record<string, AdmissionStatusCode>> = {
  ENVIADA: 'SUBMITTED',
  EN_REVISION: 'IN_REVIEW',
  INFORMACION_REQUERIDA: 'INFO_REQUESTED',
  VERIFICADA: 'VERIFIED',
  RECHAZADA: 'REJECTED',
  SUSPENDIDA: 'SUSPENDED',
  EXPIRADA: 'EXPIRED',
  RETIRADA: 'WITHDRAWN',
  ABANDONADA: 'ABANDONED',
};

const FUENTE_DE_API: Readonly<Record<string, SourceTypeCode>> = {
  REGISTRO_MINSALUD: 'MINSALUD_REGISTRY',
  COLEGIO_MEDICO: 'MEDICAL_COLLEGE',
  COLEGIO_ODONTOLOGOS: 'DENTAL_COLLEGE',
  SEDES: 'SEDES',
  SEGIP: 'SEGIP',
  DOCUMENTO_APORTADO: 'PROVIDED_DOCUMENT',
  OTRO: 'OTHER',
};

const MOTIVO_DE_API: Readonly<Record<string, ReasonCode>> = {
  ILEGIBLE: 'ILLEGIBLE',
  VENCIDO: 'EXPIRED_DOCUMENT',
  NO_COINCIDE_NOMBRE: 'NAME_MISMATCH',
  NO_FIGURA_EN_REGISTRO: 'NOT_IN_REGISTRY',
  DOCUMENTO_INCOMPLETO: 'INCOMPLETE_DOCUMENT',
  SOSPECHA_DE_FRAUDE: 'SUSPECTED_FRAUD',
  OTRO: 'OTHER',
};

function invertir<T extends string>(mapa: Readonly<Record<string, T>>): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(mapa).map(([api, dominio]) => [dominio, api]));
}

const ESTADO_A_API = invertir(ESTADO_DE_API);
const FUENTE_A_API = invertir(FUENTE_DE_API);
const MOTIVO_A_API = invertir(MOTIVO_DE_API);

const SIN_REQUISITOS: RequirementsSummary = { total: 0, verified: 0, rejected: 0, pending: 0 };

export function normalizeStatusCode(code: string): string {
  return ESTADO_DE_API[code] ?? code;
}

function normalizeStatus(status: WireCoded): AdmissionCoded {
  const code = normalizeStatusCode(status.code);
  const known = ADMISSION_STATUS_LABELS[code as AdmissionStatusCode] as string | undefined;
  // El rótulo es el de la pantalla, no el de la API: «Expirada» vs «Verificación vencida».
  return { code, label: known ?? status.label ?? code };
}

function normalizeReason(code: string | null): string | null {
  return code === null ? null : (MOTIVO_DE_API[code] ?? code);
}

function fecha(valor: string | null | undefined): Date | null {
  return valor === null || valor === undefined ? null : new Date(valor);
}

/** El plazo de respuesta solo corre mientras la admisión espera a quien revisa. */
const CON_PLAZO: readonly string[] = ['SUBMITTED', 'IN_REVIEW'];

function plazo(status: AdmissionCoded, dueAt: string): Date | null {
  return CON_PLAZO.includes(status.code) ? new Date(dueAt) : null;
}

function toSummary(wire: WireAdmissionSummary): AdmissionSummary {
  const status = normalizeStatus(wire.status);
  return {
    id: wire.id,
    type: wire.type,
    status,
    practitioner: wire.practitioner,
    itemsSummary: wire.itemsSummary,
    requirementsSummary: wire.requirementsSummary ?? SIN_REQUISITOS,
    submittedAt: new Date(wire.submittedAt),
    dueAt: plazo(status, wire.dueAt),
    overdue: wire.overdue,
    assignedTo: wire.assignedTo,
    rowVersion: wire.rowVersion,
  };
}

function toSource(item: WireReviewItem): RequirementSource | null {
  const tipo = item.sourceType === null ? null : (FUENTE_DE_API[item.sourceType] ?? 'OTHER');
  // Una revisión antigua solo trae la dirección: se muestra como «otra fuente».
  if (tipo === null && item.verificationSourceUri === null) return null;
  const code = tipo ?? 'OTHER';
  return {
    type: { code, label: SOURCE_TYPE_LABELS[code as SourceTypeCode] },
    ref: item.sourceRef ?? item.verificationSourceUri,
    consultedAt: fecha(item.sourceConsultedAt),
  };
}

function toItem(wire: WireReviewItem): AdmissionReviewItem {
  return {
    id: wire.id,
    itemId: wire.itemId,
    itemType: wire.itemType,
    label: wire.label,
    state: wire.state as RequirementStatusCode,
    fileId: wire.fileId,
    source: toSource(wire),
    reasonCode: normalizeReason(wire.reasonCode),
    reasonText: wire.reasonText,
    internalNote: wire.internalNote,
    reviewedBy: wire.reviewedBy,
    reviewedAt: fecha(wire.reviewedAt),
    evidenceChanged: wire.evidenceChanged,
    evidenceSha256: wire.evidenceSha256,
    rowVersion: wire.rowVersion,
  };
}

function toRequirement(wire: WireRequirement): AdmissionRequirement {
  return {
    code: wire.code,
    label: wire.label,
    description: wire.description,
    mandatory: wire.required,
    evidenceKind: wire.evidenceKind === 'DATA' ? 'DATA' : 'DOCUMENT',
    requiresSource: wire.requiresSource,
    minItems: wire.minItems,
    maxItems: wire.maxItems,
    state: wire.state as RequirementStateCode,
    satisfied: wire.satisfied,
    blockedBy: wire.blockedBy,
    items: wire.items.map(toItem),
  };
}

function toDocument(wire: WireAdmissionDetail['documents'][number]): AdmissionDocument {
  return {
    id: wire.id,
    requirementCode: wire.requirementCode,
    fileId: wire.fileId,
    name: wire.name,
    mimeType: wire.mimeType,
    sizeBytes: wire.sizeBytes,
    uploadedAt: fecha(wire.uploadedAt),
    pages: wire.pages,
    reviewState: wire.reviewState as RequirementStatusCode,
    evidenceSha256: wire.evidenceSha256,
  };
}

function toEvent(wire: WireAdmissionDetail['events'][number]): AdmissionEvent {
  return {
    id: wire.id,
    type: wire.type,
    fromStatus: wire.fromStatus === null ? null : normalizeStatus(wire.fromStatus),
    toStatus: wire.toStatus === null ? null : normalizeStatus(wire.toStatus),
    itemType: wire.itemType,
    itemId: wire.itemId,
    requirementCode: wire.requirementCode,
    sourceUri: wire.verificationSourceUri,
    reasonCode: normalizeReason(wire.reasonCode),
    reasonText: wire.reasonText,
    actor: wire.actor,
    actorRole: wire.actorRole,
    occurredAt: new Date(wire.occurredAt),
  };
}

/* ---- el formulario enviado ---------------------------------------------------
   La API entrega el formulario tal como lo envió el médico (`personal`,
   `contact`, `addresses`, `licenses`…). La pantalla lo lee por secciones, con
   cada campo ligado al requisito que lo respalda. Un campo es obligatorio si
   el requisito que lo respalda lo es. */

function coordenadas(gps: { lat: number; lng: number } | null): string | null {
  return gps === null ? null : `${gps.lat}, ${gps.lng}`;
}

function juntar(...partes: readonly (string | number | null | undefined)[]): string | null {
  const limpias = partes.filter((p): p is string | number => p !== null && p !== undefined && `${p}`.trim() !== '');
  return limpias.length === 0 ? null : limpias.join(' ');
}

function buildForm(form: WireSubmittedForm, requirements: readonly WireRequirement[]): SubmittedFormSection[] {
  const obligatorio = (code: string | null): boolean =>
    code !== null && requirements.some((r) => r.code === code && r.required);
  const campo = (
    key: string,
    label: string,
    value: string | number | null | undefined,
    requirementCode: string | null,
    esClave = false,
    kind: SubmittedFormField['kind'] = 'TEXT',
  ): SubmittedFormField => ({
    key,
    label,
    value: value === null || value === undefined || `${value}`.trim() === '' ? null : `${value}`,
    required: esClave && obligatorio(requirementCode),
    requirementCode,
    kind,
  });
  const p = form.personal;
  const c = form.contact;
  const ci = p.requirementCode;
  const secciones: SubmittedFormSection[] = [
    {
      key: 'personal',
      title: 'Datos personales',
      fields: [
        campo('firstName', 'Nombres', juntar(p.firstName, p.middleName), ci, true),
        campo('paternalLastName', 'Apellido paterno', p.paternalLastName, ci, true),
        campo('maternalLastName', 'Apellido materno', p.maternalLastName, ci),
        campo('nationalId', 'Documento de identidad', juntar(p.nationalId, p.nationalIdIssuer), ci, true),
        campo('birthDate', 'Fecha de nacimiento', p.birthDate, ci, true),
        campo('age', 'Edad', p.age, ci),
        campo('occupation', 'Ocupación', p.occupation, null),
      ],
    },
    {
      key: 'contact',
      title: 'Contacto',
      fields: [
        campo('personalMobile', 'Celular personal', c.personalMobile, null),
        campo('personalEmail', 'Correo personal', c.personalEmail, null),
        campo('workMobile', 'Celular de trabajo', c.workMobile, null),
        campo('workPhone', 'Teléfono de trabajo', c.workPhone, null),
        campo('workEmail', 'Correo de trabajo', c.workEmail, null),
      ],
    },
  ];
  const domicilios: SubmittedFormField[] = [];
  for (const [clave, titulo, dir] of [
    ['home', 'Domicilio', form.addresses.home],
    ['work', 'Lugar de trabajo', form.addresses.work],
  ] as const) {
    domicilios.push(
      campo(`${clave}-address`, titulo, juntar(dir?.lines, dir?.locality, dir?.department), null),
      campo(`${clave}-gps`, `${titulo}: ubicación`, coordenadas(dir?.gps ?? null), null, false, 'COORDINATES'),
    );
  }
  secciones.push({ key: 'addresses', title: 'Direcciones', fields: domicilios });
  if (form.licenses.length > 0) {
    secciones.push({
      key: 'licenses',
      title: 'Matrículas',
      fields: form.licenses.flatMap((l, n) => [
        campo(`license-${l.id}-number`, `Matrícula ${n + 1}: número`, l.number, l.requirementCode, true),
        campo(`license-${l.id}-jurisdiction`, `Matrícula ${n + 1}: jurisdicción`, l.jurisdiction, l.requirementCode),
        campo(`license-${l.id}-authority`, `Matrícula ${n + 1}: autoridad`, l.authority, l.requirementCode),
        campo(`license-${l.id}-validity`, `Matrícula ${n + 1}: vigencia`, juntar(l.validFrom, '→', l.validTo), l.requirementCode),
      ]),
    });
  }
  if (form.education.length > 0) {
    secciones.push({
      key: 'education',
      title: 'Títulos y estudios',
      fields: form.education.flatMap((e, n) => [
        campo(`education-${e.id}-title`, `${e.level} ${n + 1}: título`, e.title, e.requirementCode, true),
        campo(`education-${e.id}-institution`, `${e.level} ${n + 1}: institución`, e.institution, e.requirementCode, true),
        campo(`education-${e.id}-year`, `${e.level} ${n + 1}: año`, e.year, e.requirementCode),
        campo(`education-${e.id}-number`, `${e.level} ${n + 1}: número`, e.number, e.requirementCode),
      ]),
    });
  }
  if (form.specialties.length > 0) {
    secciones.push({
      key: 'specialties',
      title: 'Especialidades',
      fields: form.specialties.map((s) =>
        campo(`specialty-${s.id}`, s.isPrimary ? 'Especialidad principal' : 'Especialidad', s.name, s.requirementCode),
      ),
    });
  }
  if (form.practices.length > 0) {
    secciones.push({
      key: 'practices',
      title: 'Consultorios',
      fields: form.practices.flatMap((x) => [
        campo(`practice-${x.id}-name`, `Consultorio: ${x.name}`, x.address, x.requirementCode, true),
        campo(`practice-${x.id}-gps`, `Consultorio: ${x.name} (ubicación)`, coordenadas(x.gps), x.requirementCode, false, 'COORDINATES'),
      ]),
    });
  }
  return secciones;
}

function toDetail(wire: WireAdmissionDetail): AdmissionDetail {
  return {
    ...toSummary(wire),
    practitioner: wire.practitioner,
    licenses: wire.licenses.map((l) => ({ ...l, verifiedAt: fecha(l.verifiedAt) })),
    credentials: wire.credentials.map((c) => ({ ...c, verifiedAt: fecha(c.verifiedAt) })),
    specialties: wire.specialties,
    requirements: wire.requirements.map(toRequirement),
    blockers: wire.blockers,
    canVerify: wire.canVerify,
    fourEyesRequired: wire.fourEyesRequired,
    documents: wire.documents.map(toDocument),
    submittedForm: buildForm(wire.submittedForm, wire.requirements),
    submittedFormSource: wire.submittedFormSource === 'LIVE' ? 'LIVE' : 'SNAPSHOT',
    events: wire.events.map(toEvent),
    infoRequestedText: wire.infoRequestedText,
    infoDueAt: fecha(wire.infoDueAt),
    decisionReasonText: wire.decisionReasonText,
    decisionReasonCode: normalizeReason(wire.decisionReasonCode),
    internalNote: wire.internalNote,
    validUntil: wire.validUntil,
    resubmissionCount: wire.resubmissionCount,
    attestedAt: fecha(wire.attestedAt),
  };
}

function toMine(wire: WireMyAdmission): MyAdmission {
  const status = normalizeStatus(wire.status);
  return {
    id: wire.id,
    status,
    submittedAt: new Date(wire.submittedAt),
    dueAt: plazo(status, wire.dueAt),
    infoDueAt: fecha(wire.infoDueAt),
    infoRequestedText: wire.infoRequestedText,
    decisionReasonText: wire.decisionReasonText,
    validUntil: wire.validUntil,
    items: wire.items.map((i) => ({ ...i, reasonCode: normalizeReason(i.reasonCode) })),
    resubmissionCount: wire.resubmissionCount,
    canResubmit: wire.canResubmit,
    canWithdraw: wire.canWithdraw,
  };
}

function toPage(page: WireAdmissionPage): AdmissionPage {
  const counts: Record<string, number> = {};
  for (const [code, n] of Object.entries(page.counts)) counts[normalizeStatusCode(code)] = n;
  return { items: page.items.map(toSummary), nextCursor: page.nextCursor, counts };
}

/** El filtro tal como lo espera la API (el estado va en español). */
function filtersOf(query: AdmissionListQuery): Record<string, string | number | boolean> {
  const filtros: Record<string, string | number | boolean> = {};
  if (query.type) filtros['type'] = query.type;
  if (query.status) filtros['status'] = ESTADO_A_API[query.status] ?? query.status;
  if (query.assignedTo) filtros['assignedTo'] = query.assignedTo;
  if (query.overdue === true) filtros['overdue'] = true;
  if (query.cursor) filtros['cursor'] = query.cursor;
  if (query.limit !== undefined) filtros['limit'] = query.limit;
  filtros['sort'] = query.sort ?? 'due_at';
  return filtros;
}

/** Los filtros como parámetros de URL; lo vacío no se manda. */
function paramsOf(query: AdmissionListQuery): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(filtersOf(query))) params = params.set(clave, String(valor));
  return params;
}

/** Los códigos de un comando de revisión, tal como los espera la API. */
function reviewBody(command: RequirementReviewCommand): Record<string, unknown> {
  return {
    decision: command.decision,
    ...(command.sourceType === undefined ? {} : { sourceType: FUENTE_A_API[command.sourceType] ?? command.sourceType }),
    ...(command.sourceRef === undefined ? {} : { sourceRef: command.sourceRef }),
    ...(command.sourceConsultedAt === undefined ? {} : { sourceConsultedAt: command.sourceConsultedAt }),
    ...(command.evidenceSha256 === undefined ? {} : { evidenceSha256: command.evidenceSha256 }),
    ...(command.reasonCode === undefined ? {} : { reasonCode: MOTIVO_A_API[command.reasonCode] ?? command.reasonCode }),
    ...(command.reason === undefined ? {} : { reason: command.reason }),
    ...(command.internalNote === undefined ? {} : { internalNote: command.internalNote }),
    expectedRowVersion: command.expectedRowVersion,
  };
}

/** Un motivo estructurado, con su código en el vocabulario de la API. */
function reasonBody<T extends { reasonCode?: ReasonCode }>(command: T): Omit<T, 'reasonCode'> & { reasonCode?: string } {
  const { reasonCode, ...resto } = command;
  return { ...resto, ...(reasonCode === undefined ? {} : { reasonCode: MOTIVO_A_API[reasonCode] ?? reasonCode }) };
}

/** Dirección absoluta de otro origen que el de la API: no lleva nuestra credencial. */
function isForeignAbsolute(url: string, apiBaseUrl: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  const raiz = apiBaseUrl.replace(/\/+$/, '');
  return !(raiz !== '' && url.startsWith(raiz) && (url.length === raiz.length || '/?#'.includes(url[raiz.length]!)));
}

/** El motivo estable de un error cuyo cuerpo llegó como `Blob` (descarga que falla). */
async function reasonOfBlobError(error: HttpErrorResponse): Promise<string | null> {
  const cuerpo: unknown = error.error;
  if (!(cuerpo instanceof Blob)) return null;
  try {
    const json = JSON.parse(await cuerpo.text()) as { reason?: unknown };
    return typeof json.reason === 'string' ? json.reason : null;
  } catch {
    return null;
  }
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
  /**
   * Un cliente **sin interceptores** para las direcciones firmadas de otro
   * origen: ni `Authorization` ni `X-Tenant-Id` (la credencial es de esta API,
   * no de un almacenamiento de terceros) ni ninguna cabecera propia, que suele
   * invalidar una firma.
   */
  private readonly bare = new HttpClient(inject(HttpBackend));
  private readonly baseUrl = inject(API_BASE_URL);

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
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
            ...filtersOf(query),
          });
    return request.pipe(map(toPage));
  }

  /** `GET /admissions/:id` — la ficha completa, con requisitos e historial. */
  get(id: string): Observable<AdmissionDetail> {
    return this.http
      .get<WireAdmissionDetail>(this.url(`/admissions/${encodeURIComponent(id)}`))
      .pipe(map(toDetail));
  }

  /** `POST /admissions/:id/claim` — tomar la revisión (REVIEWER). */
  claim(id: string, command: ClaimAdmissionCommand): Observable<AdmissionDetail> {
    return this.http
      .post<WireAdmissionDetail>(this.url(`/admissions/${encodeURIComponent(id)}/claim`), command)
      .pipe(map(toDetail));
  }

  /** `POST /admissions/:id/release` — soltar una revisión tomada. */
  release(id: string, command: ReleaseAdmissionCommand): Observable<AdmissionDetail> {
    return this.http
      .post<WireAdmissionDetail>(this.url(`/admissions/${encodeURIComponent(id)}/release`), command)
      .pipe(map(toDetail));
  }

  /** `POST /admissions/:id/reassign` — pasar la revisión a otra persona (APPROVER). */
  reassign(id: string, command: ReassignAdmissionCommand): Observable<AdmissionDetail> {
    return this.http
      .post<WireAdmissionDetail>(this.url(`/admissions/${encodeURIComponent(id)}/reassign`), command)
      .pipe(map(toDetail));
  }

  /** `POST /admissions/:id/request-info` — pedir información (REVIEWER). */
  requestInfo(id: string, command: RequestInfoCommand): Observable<AdmissionDetail> {
    return this.http
      .post<WireAdmissionDetail>(this.url(`/admissions/${encodeURIComponent(id)}/request-info`), reasonBody(command))
      .pipe(map(toDetail));
  }

  /**
   * `POST /admissions/:id/items/:itemId/review` — revisar una ficha (REVIEWER).
   * `itemId` es el id de la revisión de la ficha (`AdmissionReviewItem.id`) y
   * `expectedRowVersion`, el de la ficha.
   */
  reviewRequirement(
    id: string,
    itemId: string,
    command: RequirementReviewCommand,
  ): Observable<AdmissionDetail> {
    return this.http
      .post<WireAdmissionDetail>(
        this.url(`/admissions/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/review`),
        reviewBody(command),
      )
      .pipe(map(toDetail));
  }

  /** `POST /admissions/:id/decision` — la decisión final (APPROVER). */
  decide(id: string, command: AdmissionDecisionCommand): Observable<AdmissionDetail> {
    return this.http
      .post<WireAdmissionDetail>(this.url(`/admissions/${encodeURIComponent(id)}/decision`), reasonBody(command))
      .pipe(map(toDetail));
  }

  /** `POST /admissions/:id/suspend` (APPROVER). */
  suspend(id: string, command: SuspendCommand): Observable<AdmissionDetail> {
    return this.http
      .post<WireAdmissionDetail>(this.url(`/admissions/${encodeURIComponent(id)}/suspend`), reasonBody(command))
      .pipe(map(toDetail));
  }

  /** `POST /admissions/:id/reinstate` (APPROVER). */
  reinstate(id: string, command: ReinstateCommand): Observable<AdmissionDetail> {
    return this.http
      .post<WireAdmissionDetail>(this.url(`/admissions/${encodeURIComponent(id)}/reinstate`), command)
      .pipe(map(toDetail));
  }

  /**
   * `POST /admissions/:id/documents/:fileId/download-url` — acceso auditado a
   * un documento: la API deja constancia de quién lo pidió y entrega una ruta
   * firmada de 2 minutos, atada a quien la pide y a esa admisión.
   */
  documentAccess(id: string, fileId: string): Observable<DocumentAccess> {
    return this.http
      .post<WireDocumentAccess>(
        this.url(`/admissions/${encodeURIComponent(id)}/documents/${encodeURIComponent(fileId)}/download-url`),
        {},
      )
      .pipe(
        map((acceso) => ({
          url: acceso.url,
          expiresAt: new Date(acceso.expiresAt),
          name: acceso.name,
          mimeType: acceso.mimeType,
        })),
      );
  }

  /**
   * Pide el acceso y baja los bytes del documento (`GET .../content`).
   *
   * La ruta firmada es de esta API y va por el cliente normal (con la sesión:
   * la API la ata a quien la pidió). Una dirección absoluta de OTRO origen se
   * baja sin credenciales ni cabeceras propias. Si la firma venció o no sirve
   * (`ADMISSION_DOCUMENT_URL_INVALID`, 410) se lanza
   * {@link DocumentLinkExpiredError}: la pantalla pide una nueva.
   */
  documentContent(
    id: string,
    fileId: string,
  ): Observable<{ readonly blob: Blob; readonly originalName: string | null }> {
    return this.documentAccess(id, fileId).pipe(
      switchMap((acceso) => {
        const externa = isForeignAbsolute(acceso.url, this.baseUrl);
        const cliente = externa ? this.bare : this.http;
        const direccion = /^https?:\/\//i.test(acceso.url) ? acceso.url : this.url(acceso.url);
        return cliente.get(direccion, { responseType: 'blob', observe: 'response' }).pipe(
          catchError((error: unknown) => {
            if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
            return from(reasonOfBlobError(error)).pipe(
              switchMap((motivo) =>
                error.status === 410 ||
                motivo === 'ADMISSION_DOCUMENT_URL_INVALID' ||
                (externa && [401, 403].includes(error.status))
                  ? throwError(() => new DocumentLinkExpiredError(error.status))
                  : throwError(() => error),
              ),
            );
          }),
        );
      }),
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

  /**
   * `POST /profiles/practitioners/me/admission/resubmit` — corregir y reenviar.
   * El sujeto sale de la sesión; el cuerpo lleva la atestación de la persona
   * (`attested: true` y la versión del texto que vio). Sin ella la API
   * responde 412 `ADMISSION_ATTESTATION_REQUIRED`. La API decide además si
   * corresponde (estado y tope de reenvíos) y responde la admisión actualizada.
   */
  resubmitMyAdmission(command: ResubmitCommand): Observable<MyAdmission> {
    return this.http
      .post<WireMyAdmission>(this.url('/profiles/practitioners/me/admission/resubmit'), command)
      .pipe(map(toMine));
  }

  /** `POST /profiles/practitioners/me/admission/withdraw` — retirar la solicitud (enviada o con información pedida). */
  withdrawMyAdmission(): Observable<MyAdmission> {
    return this.http
      .post<WireMyAdmission>(this.url('/profiles/practitioners/me/admission/withdraw'), {})
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

/**
 * La dirección firmada de un documento ya no sirve (venció o fue revocada).
 *
 * Se distingue del 403 de la API porque la salida es otra: pedir una dirección
 * nueva, no «pida acceso».
 */
export class DocumentLinkExpiredError extends Error {
  constructor(readonly status: number) {
    super('El enlace del documento venció.');
    this.name = 'DocumentLinkExpiredError';
  }
}

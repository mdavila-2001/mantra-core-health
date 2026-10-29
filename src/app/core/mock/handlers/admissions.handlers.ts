import type {
  AdmissionAllowedAction,
  RequirementStatusCode,
  WireAdmissionDetail,
  WireAdmissionSummary,
  WireMyAdmission,
} from '../../data-access/admissions/admissions.types';
import { REASON_CODES, SOURCE_TYPE_CODES, SOURCE_TYPE_LABELS } from '../../data-access/admissions/admissions.types';
import { admissionFileDescriptor, registerAdmissionFile } from '../fixtures/admission-files';
import {
  APROBADOR,
  OTRO_REVISOR,
  PLANTILLA_ALTA_DE_DOCTOR,
  PLAZO_INFORMACION_DIAS,
  REVISOR_ADMIN,
  SLA_DIAS_HABILES,
  armarAdmision,
  estado,
  resumenDe,
  sembrarAdmisiones,
  sumarDiasHabiles,
  type FilaAdmision,
  type Persona,
} from '../fixtures/admissions';
import { notFound, reply, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import type { MockUser } from '../mock-session';
import { ahora, Coleccion, contieneSinTildes, cuerpo, nuevoId, paginar } from '../mock-store';

/* ============================================================================
    Admisiones (`/admissions`) y la lectura del propio médico.

    El simulador aplica las MISMAS reglas que el contrato: roles por ruta,
    versión esperada (409), transiciones por estado (412), motivo y fuente
    obligatorios (412) y cuatro ojos (403). Un recorrido en la maqueta tiene
    que fallar donde falla la API.

    Las escrituras sobreviven a F5 (`sessionStorage`): guardar, recargar y
    seguir ahí.
    ========================================================================== */

/** Roles de la bandeja. `SUPERADMIN` es el comodín, como en `RolesGuard`. */
export const ROL_REVISOR = 'ADMISSIONS_REVIEWER';
export const ROL_APROBADOR = 'ADMISSIONS_APPROVER';

const MIN_MOTIVO = 5;
const MAX_MOTIVO = 500;
/** Cuántas veces puede reenviar un médico antes de necesitar a un aprobador. */
export const MAX_REENVIOS = 3;
const TEXTO_DE_ATESTACION = '2026-10';

const filas = new Coleccion<FilaAdmision>([]);

function cargar(): void {
  for (const f of sembrarAdmisiones()) filas.agregar(f);
}
cargar();
filas.persistirEn('mock.admissions');

/* Los archivos de las filas guardadas hay que volver a registrarlos tras una
   recarga: el registro vive en memoria y las filas, en `sessionStorage`. Los
   sembrados ya los registró `sembrarAdmisiones`. */
for (const fila of filas.todos()) {
  for (const r of fila.requirements ?? []) {
    for (const d of r.documents) {
      if (admissionFileDescriptor(d.fileId) === undefined) {
        registerAdmissionFile({
          id: d.fileId,
          name: d.name,
          kind: d.mimeType === 'image/png' ? 'png' : 'pdf',
          ownerUserId: fila.practitionerUserId,
          title: r.label,
        });
      }
    }
  }
}

/**
 * Crea la admisión que nace cuando un médico se registra: `SUBMITTED`, con
 * todos sus requisitos pendientes. La llama el alta pública del médico.
 */
export function crearAdmisionDeAltaDeDoctor(datos: {
  readonly userId: string;
  readonly profileId: string;
  readonly displayName: string;
  readonly nationalId?: string;
  readonly email?: string;
  readonly matricula?: string;
}): void {
  const p: Persona = {
    id: datos.profileId,
    userId: datos.userId,
    displayName: datos.displayName,
    nationalId: datos.nationalId ?? '',
    matricula: datos.matricula ?? '',
    professionalTitle: 'Médico',
    email: datos.email ?? '',
    phone: '',
    ciudad: '',
    especialidades: [],
    name: datos.displayName.split(' ')[0] ?? '',
    lastName: datos.displayName.split(' ')[1] ?? '',
    motherLastName: '',
    birthDate: '',
    lat: 0,
    lng: 0,
    direccion: '',
    organizacion: '',
  };
  const fila = armarAdmision(p, `nueva-${datos.userId}`, {
    status: 'SUBMITTED',
    requisitos: ['PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING'],
    asignado: null,
    dias: 0,
  });
  filas.agregar({ ...fila, id: nuevoId('adm') });
}

/** Para las pruebas: vuelve a la semilla. */
export function reiniciarAdmisiones(): void {
  for (const f of filas.todos()) filas.borrar(f.id);
  cargar();
}

/* ---- reglas ---------------------------------------------------------------- */

const ESTADOS_ABIERTOS = ['SUBMITTED', 'IN_REVIEW'];

function conRol(user: MockUser | null, ...roles: string[]): boolean {
  if (user === null) return false;
  return user.roles.includes('SUPERADMIN') || user.roles.some((r) => roles.includes(r));
}

function vencida(fila: FilaAdmision): boolean {
  return fila.dueAt !== null && ESTADOS_ABIERTOS.includes(fila.status.code) && Date.parse(fila.dueAt) < Date.now();
}

function rolFaltante(rol: string, mensaje: string): MockReply {
  return reply(403, {
    statusCode: 403, code: 'FORBIDDEN', message: mensaje, error: 'Forbidden',
    details: { reason: 'ADMISSION_ROLE_REQUIRED', requiredRole: rol },
  });
}

function prohibido(reason: string, message: string): MockReply {
  return reply(403, { statusCode: 403, code: 'FORBIDDEN', error: 'Forbidden', message, details: { reason } });
}

function rechazo(status: 409 | 412, reason: string, message: string, extra: Record<string, unknown> = {}): MockReply {
  return reply(status, {
    statusCode: status,
    code: status === 409 ? 'CONFLICT' : 'PRECONDITION_FAILED',
    message,
    error: status === 409 ? 'Conflict' : 'Precondition Failed',
    details: { reason, ...extra },
  });
}

/** Quién revisó algún requisito de esta admisión (incluida quien la tomó). */
function revisores(fila: FilaAdmision): Set<string> {
  const ids = new Set((fila.requirements ?? []).map((r) => r.reviewedBy?.id).filter((id): id is string => id !== undefined));
  if (fila.claimedById !== null) ids.add(fila.claimedById);
  return ids;
}

/** Cuatro ojos: quien decide no revisó nada de la admisión ni es el propio médico. */
function violaCuatroOjos(fila: FilaAdmision, user: MockUser): boolean {
  return revisores(fila).has(user.id) || user.id === fila.practitionerUserId;
}

/** Lo que la persona que mira puede hacer, y por qué no cuando no puede. */
function accionesPara(fila: FilaAdmision, user: MockUser): AdmissionAllowedAction[] {
  const estadoActual = fila.status.code;
  const esRevisor = conRol(user, ROL_REVISOR);
  const esAprobador = conRol(user, ROL_APROBADOR);
  const dueno = fila.claimedById === user.id;
  const rol = (permitido: boolean, requerido: string): Pick<AdmissionAllowedAction, 'allowed' | 'reasonCode' | 'message'> | null =>
    permitido ? null : { allowed: false, reasonCode: 'ROLE', message: `Requiere el rol ${requerido}.` };
  const estadoNo = (ok: boolean, texto: string): Pick<AdmissionAllowedAction, 'allowed' | 'reasonCode' | 'message'> | null =>
    ok ? null : { allowed: false, reasonCode: 'STATE', message: texto };
  const acc = (code: AdmissionAllowedAction['code'], motivo: Pick<AdmissionAllowedAction, 'allowed' | 'reasonCode' | 'message'> | null): AdmissionAllowedAction =>
    ({ code, ...(motivo ?? { allowed: true }) });
  const enRevision = estadoActual === 'IN_REVIEW';
  const noDueno = esRevisor && !dueno ? { allowed: false, reasonCode: 'NOT_ASSIGNED', message: 'Solo quien tomó la revisión puede hacerlo.' } : null;
  return [
    acc('CLAIM', rol(esRevisor, '«Revisión de admisiones»') ?? estadoNo(estadoActual === 'SUBMITTED', 'La admisión ya fue tomada.')),
    acc('RELEASE', rol(esRevisor || esAprobador, '«Revisión de admisiones»') ?? estadoNo(enRevision, 'No hay una revisión tomada.') ?? (esAprobador || dueno ? null : noDueno)),
    acc('REASSIGN', rol(esAprobador, '«Aprobación de admisiones»') ?? estadoNo(enRevision, 'No hay una revisión tomada.')),
    acc('REQUEST_INFO', rol(esRevisor, '«Revisión de admisiones»') ?? estadoNo(enRevision, 'La admisión no está en revisión.') ?? noDueno),
    acc('REVIEW_REQUIREMENT', rol(esRevisor, '«Revisión de admisiones»') ?? estadoNo(enRevision, 'La admisión no está en revisión.') ?? noDueno),
    acc(
      'DECIDE',
      rol(esAprobador, '«Aprobación de admisiones»') ??
        estadoNo(enRevision, 'La admisión no está en revisión.') ??
        (violaCuatroOjos(fila, user)
          ? { allowed: false, reasonCode: 'FOUR_EYES', message: 'Otra persona debe aprobar: usted revisó esta admisión o es el propio profesional.' }
          : null),
    ),
    acc('SUSPEND', rol(esAprobador, '«Aprobación de admisiones»') ?? estadoNo(estadoActual === 'VERIFIED', 'Solo se suspende una admisión verificada.')),
    acc('REINSTATE', rol(esAprobador, '«Aprobación de admisiones»') ?? estadoNo(estadoActual === 'SUSPENDED', 'Solo se repone una admisión suspendida.')),
  ];
}

function aResumen(fila: FilaAdmision): WireAdmissionSummary {
  return {
    id: fila.id,
    type: fila.type,
    status: fila.status,
    practitioner: {
      id: fila.practitioner.id,
      fullName: fila.practitioner.fullName,
      profession: fila.practitioner.profession,
      maskedNationalId: fila.practitioner.maskedNationalId,
    },
    itemsSummary: fila.itemsSummary,
    requirementsSummary: fila.requirementsSummary,
    submittedAt: fila.submittedAt,
    dueAt: fila.dueAt,
    overdue: vencida(fila),
    assignedTo: fila.assignedTo,
    rowVersion: fila.rowVersion,
  };
}

function aDetalle(fila: FilaAdmision, user: MockUser): WireAdmissionDetail {
  const { practitionerUserId: _u, practitionerProfileId: _p, claimedById: _c, resubmissionCount: _r, ...resto } = fila;
  const estados = new Map((fila.requirements ?? []).map((r) => [r.code, r.status] as const));
  return {
    ...resto,
    overdue: vencida(fila),
    documents: (fila.documents ?? []).map((d) => ({ ...d, reviewState: estados.get(d.requirementCode) ?? d.reviewState })),
    allowedActions: accionesPara(fila, user),
    assignableReviewers: conRol(user, ROL_APROBADOR) ? [REVISOR_ADMIN, OTRO_REVISOR] : [],
  };
}

/** Lo que lee el propio médico: sin notas internas ni códigos reservados al personal. */
function aMia(fila: FilaAdmision): WireMyAdmission {
  return {
    id: fila.id,
    status: fila.status,
    submittedAt: fila.submittedAt,
    dueAt: fila.dueAt,
    infoDueAt: fila.infoDueAt ?? null,
    infoRequestedText: fila.infoRequestedText,
    decisionReasonText: fila.decisionReasonText,
    resubmissionsRemaining: Math.max(0, MAX_REENVIOS - fila.resubmissionCount),
    items: (fila.requirements ?? []).map((r) => ({
      type: 'REQUIREMENT',
      id: r.id,
      label: r.label,
      state: r.status,
      reasonText: r.reasonText,
    })),
  };
}

function motivoValido(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio.length >= MIN_MOTIVO && limpio.length <= MAX_MOTIVO ? limpio : null;
}

function notaValida(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim().slice(0, MAX_MOTIVO) : null;
}

function codigoDeMotivo(valor: unknown): string | null {
  return typeof valor === 'string' && (REASON_CODES as readonly string[]).includes(valor) ? valor : null;
}

interface Contexto {
  readonly fila: FilaAdmision;
  readonly body: Record<string, unknown>;
}

/** Resuelve fila + cuerpo, o la respuesta de error que corresponde. */
function contexto(request: MockRequest): Contexto | MockReply {
  const fila = filas.get(request.params['id']!);
  if (fila === undefined) return notFound('No encontrado');
  return { fila, body: cuerpo<Record<string, unknown>>(request) };
}

function esRespuesta(valor: Contexto | MockReply): valor is MockReply {
  return 'status' in valor && 'body' in valor;
}

function obsoleta(c: Contexto): MockReply | null {
  const esperada = c.body['expectedRowVersion'];
  if (typeof esperada !== 'number') {
    return rechazo(412, 'ADMISSION_VERSION_REQUIRED', 'Falta la versión que usted vio de la admisión.');
  }
  return esperada === c.fila.rowVersion
    ? null
    : rechazo(409, 'ADMISSION_STALE', 'Otra persona modificó esta admisión mientras usted la revisaba.', {
        currentRowVersion: c.fila.rowVersion,
      });
}

function transicion(fila: FilaAdmision, permitidos: readonly string[], accion: string): MockReply | null {
  return permitidos.includes(fila.status.code)
    ? null
    : rechazo(412, 'ADMISSION_INVALID_TRANSITION', `No se puede ${accion} una admisión en estado «${fila.status.label}».`, {
        status: fila.status.code,
      });
}

type Evento = WireAdmissionDetail['events'][number];

function guardar(
  fila: FilaAdmision,
  cambios: Partial<FilaAdmision>,
  ev: Pick<Evento, 'type' | 'actor'> & Partial<Omit<Evento, 'id' | 'occurredAt'>>,
  subeVersion = true,
): FilaAdmision {
  const requisitos = cambios.requirements ?? fila.requirements ?? [];
  const siguiente: FilaAdmision = {
    ...fila,
    ...cambios,
    requirementsSummary: resumenDe(requisitos),
    rowVersion: subeVersion ? fila.rowVersion + 1 : fila.rowVersion,
    events: [
      ...fila.events,
      {
        fromStatus: null, toStatus: null, itemType: null, itemId: null, sourceLabel: null,
        reasonCode: null, reasonText: null, internalNote: null,
        ...ev,
        id: nuevoId('adm-ev'),
        occurredAt: ahora(),
      },
    ],
  };
  filas.agregar(siguiente);
  return siguiente;
}

const actorDe = (user: MockUser): { id: string; name: string } => ({ id: user.id, name: user.displayName });

function validarFuente(body: Record<string, unknown>): { type: string; ref: string | null } | MockReply {
  const type = body['sourceType'];
  if (typeof type !== 'string' || !(SOURCE_TYPE_CODES as readonly string[]).includes(type)) {
    return rechazo(412, 'ADMISSION_ITEM_REQUIRES_SOURCE', 'Indique de dónde obtuvo el dato (tipo de fuente).');
  }
  const ref = typeof body['sourceRef'] === 'string' && body['sourceRef'].trim() !== '' ? body['sourceRef'].trim() : null;
  if (type === 'OTHER' && ref === null) {
    return rechazo(412, 'ADMISSION_ITEM_REQUIRES_SOURCE', 'Describa la fuente que consultó.');
  }
  if (ref !== null && ref.length > 300) {
    return rechazo(412, 'ADMISSION_ITEM_REQUIRES_SOURCE', 'La referencia de la fuente admite hasta 300 caracteres.');
  }
  return { type, ref };
}

function validarMotivo(body: Record<string, unknown>, conCodigo: boolean): { code: string | null; text: string; note: string | null } | MockReply {
  const text = motivoValido(body['reason']);
  if (text === null) {
    return rechazo(412, 'ADMISSION_REASON_REQUIRED', `Explique el motivo, entre ${MIN_MOTIVO} y ${MAX_MOTIVO} caracteres.`);
  }
  const code = codigoDeMotivo(body['reasonCode']);
  if (conCodigo && code === null) {
    return rechazo(412, 'ADMISSION_REASON_CODE_REQUIRED', 'Elija el motivo de la lista.');
  }
  return { code, text, note: notaValida(body['internalNote']) };
}

const esMotivo = (valor: unknown): valor is { code: string | null; text: string; note: string | null } =>
  typeof valor === 'object' && valor !== null && 'text' in valor;

/* ---- rutas ----------------------------------------------------------------- */

export function registrarAdmisiones(router: MockRouter): void {
  const listar = (request: MockRequest, q: string, filtros: URLSearchParams): MockReply | unknown => {
    if (!conRol(request.user, ROL_REVISOR, ROL_APROBADOR, 'SECURITY_ADMIN')) {
      return rolFaltante(ROL_REVISOR, 'Su cuenta no puede ver las admisiones.');
    }
    const tipo = filtros.get('type');
    const asignado = filtros.get('assignedTo');
    const soloVencidas = filtros.get('overdue') === 'true';
    const base = filas.todos().filter((f) => {
      if (tipo !== null && tipo !== '' && f.type.code !== tipo) return false;
      if (asignado === 'none' && f.assignedTo !== null) return false;
      if (asignado !== null && asignado !== '' && asignado !== 'none' && f.assignedTo?.id !== asignado) return false;
      if (soloVencidas && !vencida(f)) return false;
      if (q !== '') {
        const campos = [f.practitioner.fullName, f.practitioner.nationalId, f.practitioner.maskedNationalId, ...f.licenses.map((l) => l.number)];
        if (!campos.some((c) => contieneSinTildes(c, q))) return false;
      }
      return true;
    });
    const counts: Record<string, number> = {};
    for (const f of base) counts[f.status.code] = (counts[f.status.code] ?? 0) + 1;
    const estadoPedido = filtros.get('status');
    const visibles = base
      .filter((f) => estadoPedido === null || estadoPedido === '' || f.status.code === estadoPedido)
      .sort((a, b) => {
        const da = a.dueAt === null ? Number.POSITIVE_INFINITY : Date.parse(a.dueAt);
        const db = b.dueAt === null ? Number.POSITIVE_INFINITY : Date.parse(b.dueAt);
        return da - db || Date.parse(a.submittedAt) - Date.parse(b.submittedAt);
      });
    const pagina = paginar(visibles, filtros, 25);
    return { items: pagina.items.map(aResumen), nextCursor: pagina.nextCursor, counts };
  };

  router.get('/admissions', (request) => listar(request, '', request.query));

  // La búsqueda con texto va por POST: el documento no se escribe en la dirección.
  router.post('/admissions/search', (request) => {
    const body = cuerpo<Record<string, unknown>>(request);
    const filtros = new URLSearchParams();
    for (const [clave, valor] of Object.entries(body)) {
      if (clave !== 'q' && (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean')) {
        filtros.set(clave, String(valor));
      }
    }
    return listar(request, typeof body['q'] === 'string' ? body['q'].trim() : '', filtros);
  });

  router.get('/admissions/:id', (request) => {
    if (!conRol(request.user, ROL_REVISOR, ROL_APROBADOR, 'SECURITY_ADMIN')) {
      return rolFaltante(ROL_REVISOR, 'Su cuenta no puede ver las admisiones.');
    }
    const c = contexto(request);
    return esRespuesta(c) ? c : aDetalle(c.fila, request.user!);
  });

  // Acceso auditado a un documento: deja constancia y entrega una dirección de vida corta.
  router.get('/admissions/:id/documents/:fileId', (request) => {
    if (!conRol(request.user, ROL_REVISOR, ROL_APROBADOR, 'SECURITY_ADMIN')) {
      return rolFaltante(ROL_REVISOR, 'Su cuenta no puede ver los documentos.');
    }
    const c = contexto(request);
    if (esRespuesta(c)) return c;
    const fileId = request.params['fileId']!;
    const doc = (c.fila.documents ?? []).find((d) => d.fileId === fileId);
    if (doc === undefined) return notFound('No encontrado');
    // La lectura queda en la bitácora; no es un cambio de la admisión, así que no sube la versión.
    guardar(c.fila, {}, { type: 'DOCUMENT_VIEWED', actor: actorDe(request.user!), itemType: 'DOCUMENT', itemId: doc.id, reasonText: doc.name }, false);
    return { url: `/common/files/${encodeURIComponent(fileId)}/content`, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
  });

  router.post('/admissions/:id/claim', (request) => {
    if (!conRol(request.user, ROL_REVISOR)) {
      return rolFaltante(ROL_REVISOR, 'Tomar una revisión requiere el rol «Revisión de admisiones».');
    }
    const c = contexto(request);
    if (esRespuesta(c)) return c;
    const stale = obsoleta(c);
    if (stale !== null) return stale;
    const mala = transicion(c.fila, ['SUBMITTED'], 'tomar');
    if (mala !== null) return mala;
    const user = request.user!;
    if (user.id === c.fila.practitionerUserId) return prohibido('ADMISSION_FOUR_EYES', 'No puede revisar su propia admisión.');
    return aDetalle(
      guardar(c.fila, { status: estado('IN_REVIEW'), assignedTo: actorDe(user), claimedById: user.id }, {
        type: 'CLAIMED', fromStatus: 'SUBMITTED', toStatus: 'IN_REVIEW', actor: actorDe(user),
      }),
      user,
    );
  });

  router.post('/admissions/:id/release', (request) => {
    if (!conRol(request.user, ROL_REVISOR, ROL_APROBADOR)) {
      return rolFaltante(ROL_REVISOR, 'Soltar una revisión requiere el rol «Revisión de admisiones».');
    }
    const c = contexto(request);
    if (esRespuesta(c)) return c;
    const user = request.user!;
    const stale = obsoleta(c);
    if (stale !== null) return stale;
    const mala = transicion(c.fila, ['IN_REVIEW'], 'soltar');
    if (mala !== null) return mala;
    if (c.fila.claimedById !== user.id && !conRol(user, ROL_APROBADOR)) {
      return prohibido('ADMISSION_NOT_ASSIGNED', 'Solo quien tomó la revisión, o un aprobador, puede soltarla.');
    }
    return aDetalle(
      guardar(c.fila, { status: estado('SUBMITTED'), assignedTo: null, claimedById: null }, {
        type: 'RELEASED', fromStatus: 'IN_REVIEW', toStatus: 'SUBMITTED', actor: actorDe(user),
        reasonText: typeof c.body['reason'] === 'string' ? c.body['reason'].trim().slice(0, MAX_MOTIVO) || null : null,
      }),
      user,
    );
  });

  router.post('/admissions/:id/reassign', (request) => {
    if (!conRol(request.user, ROL_APROBADOR)) {
      return rolFaltante(ROL_APROBADOR, 'Reasignar una revisión requiere el rol «Aprobación de admisiones».');
    }
    const c = contexto(request);
    if (esRespuesta(c)) return c;
    const user = request.user!;
    const stale = obsoleta(c);
    if (stale !== null) return stale;
    const mala = transicion(c.fila, ['IN_REVIEW'], 'reasignar');
    if (mala !== null) return mala;
    const destino = [REVISOR_ADMIN, OTRO_REVISOR].find((r) => r.id === c.body['assigneeId']);
    if (destino === undefined) return rechazo(412, 'ADMISSION_ASSIGNEE_INVALID', 'Elija a una persona con el rol de revisión.');
    return aDetalle(
      guardar(c.fila, { assignedTo: destino, claimedById: destino.id }, {
        type: 'REASSIGNED', fromStatus: 'IN_REVIEW', toStatus: 'IN_REVIEW', actor: actorDe(user),
        reasonText: `Asignada a ${destino.name}`,
      }),
      user,
    );
  });

  router.post('/admissions/:id/request-info', (request) => {
    if (!conRol(request.user, ROL_REVISOR)) {
      return rolFaltante(ROL_REVISOR, 'Pedir información requiere el rol «Revisión de admisiones».');
    }
    const c = contexto(request);
    if (esRespuesta(c)) return c;
    const user = request.user!;
    const stale = obsoleta(c);
    if (stale !== null) return stale;
    const mala = transicion(c.fila, ['IN_REVIEW'], 'pedir información en');
    if (mala !== null) return mala;
    if (c.fila.claimedById !== user.id) return prohibido('ADMISSION_NOT_ASSIGNED', 'Solo quien tomó la revisión puede pedir información.');
    const motivo = validarMotivo(c.body, true);
    if (!esMotivo(motivo)) return motivo;
    // El reloj del SLA se pausa; el médico tiene un plazo propio para responder.
    return aDetalle(
      guardar(c.fila, {
        status: estado('INFO_REQUESTED'), infoRequestedText: motivo.text, dueAt: null,
        infoDueAt: new Date(Date.now() + PLAZO_INFORMACION_DIAS * 86_400_000).toISOString(),
      }, {
        type: 'INFO_REQUESTED', fromStatus: 'IN_REVIEW', toStatus: 'INFO_REQUESTED', actor: actorDe(user),
        reasonCode: motivo.code, reasonText: motivo.text, internalNote: motivo.note,
      }),
      user,
    );
  });

  router.post('/admissions/:id/items/:itemId/review', (request) => {
    if (!conRol(request.user, ROL_REVISOR)) {
      return rolFaltante(ROL_REVISOR, 'Revisar un requisito requiere el rol «Revisión de admisiones».');
    }
    const c = contexto(request);
    if (esRespuesta(c)) return c;
    const user = request.user!;
    const requisito = (c.fila.requirements ?? []).find((r) => r.id === request.params['itemId']);
    if (requisito === undefined) return notFound('No encontrado');
    const stale = obsoleta(c);
    if (stale !== null) return stale;
    const mala = transicion(c.fila, ['IN_REVIEW'], 'revisar los requisitos de');
    if (mala !== null) return mala;
    if (c.fila.claimedById !== user.id) return prohibido('ADMISSION_NOT_ASSIGNED', 'Solo quien tomó la revisión puede revisar sus requisitos.');
    const decision = c.body['decision'];
    if (decision !== 'VERIFIED' && decision !== 'REJECTED' && decision !== 'INFO_REQUIRED') {
      return rechazo(412, 'ADMISSION_INVALID_DECISION', 'La decisión sobre el requisito no es válida.');
    }
    let cambios: Partial<(typeof requisito)>;
    let sourceLabel: string | null = null;
    if (decision === 'VERIFIED') {
      const fuente = validarFuente(c.body);
      if ('status' in fuente) return fuente;
      const consulta = typeof c.body['sourceConsultedAt'] === 'string' ? new Date(`${c.body['sourceConsultedAt']}T12:00:00`) : new Date();
      sourceLabel = (SOURCE_TYPE_LABELS as Record<string, string>)[fuente.type] ?? fuente.type;
      cambios = {
        status: 'VERIFIED',
        source: { type: { code: fuente.type, label: sourceLabel }, ref: fuente.ref, consultedAt: (Number.isNaN(consulta.getTime()) ? new Date() : consulta).toISOString() },
        reasonCode: null, reasonText: null, internalNote: notaValida(c.body['internalNote']),
      };
    } else {
      const motivo = validarMotivo(c.body, true);
      if (!esMotivo(motivo)) return motivo;
      cambios = {
        status: decision === 'REJECTED' ? 'REJECTED' : 'INFO_REQUIRED',
        source: null, reasonCode: motivo.code, reasonText: motivo.text, internalNote: motivo.note,
      };
    }
    const nuevo = { ...requisito, ...cambios, reviewedAt: ahora(), reviewedBy: actorDe(user) };
    const requisitos = (c.fila.requirements ?? []).map((r) => (r.id === requisito.id ? nuevo : r));
    return aDetalle(
      guardar(c.fila, { requirements: requisitos }, {
        type: decision === 'VERIFIED' ? 'ITEM_VERIFIED' : decision === 'REJECTED' ? 'ITEM_REJECTED' : 'ITEM_INFO_REQUIRED',
        itemType: 'REQUIREMENT', itemId: requisito.id, sourceLabel,
        reasonCode: nuevo.reasonCode, reasonText: nuevo.reasonText, internalNote: nuevo.internalNote, actor: actorDe(user),
      }),
      user,
    );
  });

  router.post('/admissions/:id/decision', (request) => {
    if (!conRol(request.user, ROL_APROBADOR)) {
      return rolFaltante(ROL_APROBADOR, 'La decisión final requiere el rol «Aprobación de admisiones».');
    }
    const c = contexto(request);
    if (esRespuesta(c)) return c;
    const user = request.user!;
    const stale = obsoleta(c);
    if (stale !== null) return stale;
    if (violaCuatroOjos(c.fila, user)) {
      return prohibido('ADMISSION_FOUR_EYES', 'Otra persona debe aprobar: usted revisó requisitos de esta admisión o es el propio profesional.');
    }
    const mala = transicion(c.fila, ['IN_REVIEW'], 'resolver');
    if (mala !== null) return mala;
    const decision = c.body['decision'];
    if (decision !== 'VERIFIED' && decision !== 'REJECTED') {
      return rechazo(412, 'ADMISSION_INVALID_DECISION', 'La decisión final no es válida.');
    }
    let motivo: { code: string | null; text: string; note: string | null } = { code: null, text: '', note: notaValida(c.body['internalNote']) };
    if (decision === 'REJECTED') {
      const m = validarMotivo(c.body, true);
      if (!esMotivo(m)) return m;
      motivo = m;
    } else {
      // El servidor deriva el estado de cada ítem de las revisiones por requisito.
      const faltantes = (c.fila.requirements ?? []).filter((r) => r.mandatory && r.status !== 'VERIFIED');
      if (faltantes.length > 0) {
        return rechazo(412, 'ADMISSION_REQUIREMENTS_PENDING', `Faltan ${faltantes.length} requisito(s) obligatorio(s) por verificar.`, {
          requirementIds: faltantes.map((r) => r.id),
        });
      }
    }
    const final = decision === 'VERIFIED' ? 'VERIFIED' : 'REJECTED';
    return aDetalle(
      guardar(c.fila, {
        status: estado(final), decisionReasonText: decision === 'REJECTED' ? motivo.text : null,
        dueAt: null, infoRequestedText: null, infoDueAt: null,
      }, {
        type: final, fromStatus: 'IN_REVIEW', toStatus: final, actor: actorDe(user),
        reasonCode: motivo.code, reasonText: motivo.text || null, internalNote: motivo.note,
      }),
      user,
    );
  });

  for (const [ruta, desde, hacia, tipo, verbo, conCodigo] of [
    ['suspend', 'VERIFIED', 'SUSPENDED', 'SUSPENDED', 'suspender', true],
    ['reinstate', 'SUSPENDED', 'VERIFIED', 'REINSTATED', 'reponer', false],
  ] as const) {
    router.post(`/admissions/:id/${ruta}`, (request) => {
      if (!conRol(request.user, ROL_APROBADOR)) {
        return rolFaltante(ROL_APROBADOR, `Para ${verbo} una admisión hace falta el rol «Aprobación de admisiones».`);
      }
      const c = contexto(request);
      if (esRespuesta(c)) return c;
      const stale = obsoleta(c);
      if (stale !== null) return stale;
      const mala = transicion(c.fila, [desde], verbo);
      if (mala !== null) return mala;
      const motivo = validarMotivo(c.body, conCodigo);
      if (!esMotivo(motivo)) return motivo;
      return aDetalle(
        guardar(c.fila, { status: estado(hacia), decisionReasonText: ruta === 'suspend' ? motivo.text : null }, {
          type: tipo, fromStatus: desde, toStatus: hacia, actor: actorDe(request.user!),
          reasonCode: motivo.code, reasonText: motivo.text, internalNote: motivo.note,
        }),
        request.user!,
      );
    });
  }

  /* ---- lo que ve el propio médico ------------------------------------------ */

  const propia = (user: MockUser | null): FilaAdmision | undefined =>
    user === null
      ? undefined
      : filas.todos().find((f) => f.practitionerUserId === user.id || (user.practitionerProfileId !== undefined && f.practitionerProfileId === user.practitionerProfileId));

  router.get('/profiles/practitioners/me/admission', ({ user }) => {
    const fila = propia(user);
    return fila === undefined ? notFound('No tiene una admisión') : aMia(fila);
  });

  router.post('/profiles/practitioners/me/admission/resubmit', (request) => {
    const fila = propia(request.user);
    if (fila === undefined) return notFound('No tiene una admisión');
    const mala = transicion(fila, ['INFO_REQUESTED', 'REJECTED'], 'reenviar');
    if (mala !== null) return mala;
    const body = cuerpo<Record<string, unknown>>(request);
    if (body['attested'] !== true || typeof body['attestationVersion'] !== 'string') {
      return rechazo(412, 'ADMISSION_ATTESTATION_REQUIRED', 'Debe declarar que los datos y documentos son verídicos.');
    }
    if (fila.resubmissionCount >= MAX_REENVIOS) {
      return rechazo(412, 'ADMISSION_RESUBMISSION_LIMIT', 'Llegó al máximo de reenvíos. Escriba al equipo de soporte para reabrir su solicitud.');
    }
    const requisitos = (fila.requirements ?? []).map((r) =>
      r.status === 'REJECTED' || r.status === 'INFO_REQUIRED'
        ? { ...r, status: 'PENDING' as RequirementStatusCode, reasonCode: null, reasonText: null, source: null }
        : r,
    );
    return aMia(
      guardar(fila, {
        status: estado('SUBMITTED'), requirements: requisitos, assignedTo: null, claimedById: null, infoRequestedText: null,
        decisionReasonText: null, infoDueAt: null, resubmissionCount: fila.resubmissionCount + 1,
        dueAt: sumarDiasHabiles(new Date(), SLA_DIAS_HABILES).toISOString(),
      }, {
        type: 'RESUBMITTED', fromStatus: fila.status.code, toStatus: 'SUBMITTED',
        actor: { id: fila.practitionerUserId, name: fila.practitioner.fullName },
        reasonText: `Atestación ${TEXTO_DE_ATESTACION}`,
      }),
    );
  });
}

export { APROBADOR, PLANTILLA_ALTA_DE_DOCTOR };

import type {
  AdmissionItemType,
  WireAdmissionDetail,
  WireAdmissionSummary,
  WireCoded,
  WireDocument,
  WireEvent,
  WireMyAdmission,
  WireRequirement,
  WireReviewItem,
} from '../../data-access/admissions/admissions.types';
import { admissionFileDescriptor, admissionFileBlob, registerAdmissionFile } from '../fixtures/admission-files';
import {
  APROBADOR,
  ESTADOS_CON_PLAZO,
  MAX_REENVIOS,
  OTRO_REVISOR,
  PLAZO_INFORMACION_DIAS,
  REVISOR_ADMIN,
  REVISORES,
  SLA_DIAS_HABILES,
  VIGENCIA_MESES,
  armarAdmision,
  enmascarar,
  estado,
  estadoEfectivo,
  evaluarChecklist,
  evaluarRequisito,
  evidenciaCambio,
  huella,
  sembrarAdmisiones,
  sumarDiasHabiles,
  type Actor,
  type FichaFila,
  type FilaAdmision,
  type Persona,
} from '../fixtures/admissions';
import { reply, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import type { MockUser } from '../mock-session';
import { ahora, Coleccion, contieneSinTildes, cuerpo, nuevoId, paginar } from '../mock-store';

/* ============================================================================
    Admisiones (`/admissions`) y la lectura del propio médico.

    El simulador aplica las MISMAS reglas que el contrato real: roles por ruta,
    versión esperada (409 `ADMISSION_STALE`, por ficha en la revisión de un
    ítem), transiciones por estado (412), motivo y fuente obligatorios (412),
    huella de la evidencia (409 `ADMISSION_EVIDENCE_CHANGED`), cuatro ojos
    (403) y nadie sobre su propia admisión (403 `ADMISSION_SELF_ACCESS`). Un
    recorrido en la maqueta tiene que fallar donde falla la API.

    Los errores llevan el motivo estable en `reason`, como el servidor real.

    Las escrituras sobreviven a F5 (`sessionStorage`): guardar, recargar y
    seguir ahí.
    ========================================================================== */

/** Roles de la bandeja. `SUPERADMIN` es el comodín, como en `RolesGuard`. */
export const ROL_REVISOR = 'ADMISSIONS_REVIEWER';
export const ROL_APROBADOR = 'ADMISSIONS_APPROVER';

const MIN_MOTIVO = 1;
const MAX_MOTIVO = 500;
/** Vida de una dirección firmada de documento: dos minutos, como la API. */
const VIDA_ENLACE_MS = 2 * 60_000;

const FUENTES = ['REGISTRO_MINSALUD', 'COLEGIO_MEDICO', 'COLEGIO_ODONTOLOGOS', 'SEDES', 'SEGIP', 'DOCUMENTO_APORTADO', 'OTRO'];
const MOTIVOS = ['ILEGIBLE', 'VENCIDO', 'NO_COINCIDE_NOMBRE', 'NO_FIGURA_EN_REGISTRO', 'DOCUMENTO_INCOMPLETO', 'SOSPECHA_DE_FRAUDE', 'OTRO'];
const ETIQUETA_DE_FICHA: Readonly<Record<string, string>> = {
  PENDING: 'Pendiente',
  VERIFIED: 'Verificado',
  REJECTED: 'Rechazado',
  INFO_REQUIRED: 'Información requerida',
};

const filas = new Coleccion<FilaAdmision>([]);

function cargar(): void {
  for (const f of sembrarAdmisiones()) filas.agregar(f);
}
cargar();
filas.persistirEn('mock.admissions');

/* Los archivos de las filas guardadas hay que volver a registrarlos tras una
   recarga: el registro vive en memoria y las filas, en `sessionStorage`. Los
   sembrados ya los registró `sembrarAdmisiones`. */
function registrarArchivos(): void {
  for (const fila of filas.todos()) {
    for (const r of fila.requisitos) {
      for (const f of r.items) {
        if (f.archivo !== null && admissionFileDescriptor(f.archivo.fileId) === undefined) {
          registerAdmissionFile({ id: f.archivo.fileId, name: f.archivo.name, kind: f.archivo.kind, ownerUserId: fila.practitionerUserId, title: f.label });
        }
      }
    }
  }
}
registrarArchivos();

/** Si es `true`, las direcciones firmadas nacen vencidas (para ver «el enlace venció»). */
let enlacesVencidos = false;

/**
 * Crea la admisión que nace cuando un médico se registra: `ENVIADA`, con
 * todas sus fichas pendientes. La llama el alta pública del médico.
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
  const fila = armarAdmision(p, `nueva-${datos.userId}`, { status: 'ENVIADA', fichas: {}, asignado: null, dias: 0 });
  filas.agregar({ ...fila, id: nuevoId('adm') });
}

/**
 * Para las pruebas y las demostraciones: el médico reemplaza el archivo de un
 * requisito mientras el revisor lo mira. Cambia la huella VIVA sin subir la
 * versión de la ficha, que es justo el caso que la huella existe para detectar.
 */
export function reemplazarEvidencia(admissionId: string, requirementCode: string): boolean {
  const fila = filas.get(admissionId);
  if (fila === undefined) return false;
  const sig = structuredClone(fila);
  const requisito = sig.requisitos.find((r) => r.code === requirementCode);
  if (requisito === undefined) return false;
  for (const ficha of requisito.items) ficha.evidenceSha256 = huella(ficha.evidenceSha256, ahora(), 'reemplazo');
  filas.agregar(sig);
  return true;
}

/**
 * Para las demostraciones: sube la versión de una admisión y de sus fichas
 * como si otra persona las hubiera modificado, para ver el aviso de «otra
 * persona modificó esta admisión» (409) sin necesitar dos sesiones.
 */
export function tocarVersion(admissionId: string): boolean {
  const fila = filas.get(admissionId);
  if (fila === undefined) return false;
  const sig = structuredClone(fila);
  sig.rowVersion += 1;
  for (const r of sig.requisitos) for (const f of r.items) if (f.rowVersion !== null) f.rowVersion += 1;
  filas.agregar(sig);
  return true;
}

/** Para las demostraciones: las direcciones firmadas de documentos nacen vencidas. */
export function vencerEnlaces(activo: boolean): void {
  enlacesVencidos = activo;
}

/** Para las pruebas: vuelve a la semilla. */
export function reiniciarAdmisiones(): void {
  for (const f of filas.todos()) filas.borrar(f.id);
  cargar();
  enlacesVencidos = false;
}

/* ---- reglas ---------------------------------------------------------------- */

function conRol(user: MockUser | null, ...roles: string[]): boolean {
  if (user === null) return false;
  return user.roles.includes('SUPERADMIN') || user.roles.some((r) => roles.includes(r));
}

const LECTORES = [ROL_REVISOR, ROL_APROBADOR, 'SECURITY_ADMIN'];

function vencida(fila: FilaAdmision): boolean {
  return ESTADOS_CON_PLAZO.includes(fila.status.code) && Date.parse(fila.dueAt) < Date.now();
}

/** El cuerpo de error del servidor: código genérico, mensaje y motivo estable. */
function falla(status: number, code: string, reason: string, message: string, details: Record<string, unknown> = {}): MockReply {
  return reply(status, { statusCode: status, code, error: code, message, reason, details });
}

function rolFaltante(rol: string, mensaje: string): MockReply {
  return falla(403, 'FORBIDDEN', 'ADMISSION_ROLE_REQUIRED', mensaje, { requiredRole: rol });
}

function prohibido(reason: string, message: string): MockReply {
  return falla(403, 'FORBIDDEN', reason, message);
}

function rechazo(status: 409 | 412, reason: string, message: string, details: Record<string, unknown> = {}): MockReply {
  return falla(status, status === 409 ? 'CONFLICT' : 'PRECONDITION_FAILED', reason, message, details);
}

function fichas(fila: FilaAdmision): FichaFila[] {
  return fila.requisitos.flatMap((r) => r.items);
}

/** Quién revisó alguna ficha de esta admisión (incluida quien la tomó). */
function revisores(fila: FilaAdmision): Set<string> {
  const ids = new Set(fichas(fila).map((f) => f.reviewedBy?.id).filter((id): id is string => id !== undefined));
  if (fila.assignedTo !== null) ids.add(fila.assignedTo.id);
  return ids;
}

/** Cuatro ojos: quien decide no revisó nada de la admisión ni es el propio médico. */
function violaCuatroOjos(fila: FilaAdmision, user: MockUser): boolean {
  return revisores(fila).has(user.id) || user.id === fila.practitionerUserId;
}

/** Quien tiene rol de admisiones y es el propio profesional no revisa su solicitud. */
const esPropia = (fila: FilaAdmision, user: MockUser | null): boolean =>
  user !== null && fila.practitionerUserId === user.id;

const AUTOACCESO = 'No puede revisar su propia solicitud.';

const tipoCredencial = (t: AdmissionItemType): boolean => t === 'CREDENTIAL';

function codificada(f: FichaFila): WireCoded {
  const code = estadoEfectivo(f);
  return { code, label: ETIQUETA_DE_FICHA[code] ?? code };
}

function aResumen(fila: FilaAdmision): WireAdmissionSummary {
  const todas = fichas(fila);
  const evaluacion = evaluarChecklist(fila.requisitos);
  return {
    id: fila.id,
    type: fila.type,
    status: fila.status,
    practitioner: {
      id: fila.practitioner.id,
      fullName: fila.practitioner.fullName,
      profession: fila.practitioner.profession,
      maskedNationalId: enmascarar(fila.practitioner.nationalId ?? ''),
    },
    itemsSummary: {
      licenses: todas.filter((f) => f.itemType === 'LICENSE').length,
      credentials: todas.filter((f) => tipoCredencial(f.itemType)).length,
      specialties: todas.filter((f) => f.itemType === 'SPECIALTY').length,
    },
    requirementsSummary: evaluacion.summary,
    submittedAt: fila.submittedAt,
    dueAt: fila.dueAt,
    overdue: vencida(fila),
    assignedTo: fila.assignedTo,
    rowVersion: fila.rowVersion,
  };
}

function aFicha(f: FichaFila): WireReviewItem {
  return {
    id: f.reviewId,
    itemId: f.itemId,
    itemType: f.itemType,
    label: f.label,
    state: estadoEfectivo(f),
    fileId: f.archivo?.fileId ?? null,
    verificationSourceUri: null,
    sourceType: f.sourceType,
    sourceRef: f.sourceRef,
    sourceConsultedAt: f.sourceConsultedAt,
    reasonCode: f.reasonCode,
    reasonText: f.reasonText,
    internalNote: f.internalNote,
    reviewedBy: f.reviewedBy,
    reviewedAt: f.reviewedAt,
    evidenceChanged: evidenciaCambio(f),
    evidenceSha256: f.evidenceSha256,
    rowVersion: f.rowVersion,
  };
}

function aDetalle(fila: FilaAdmision): WireAdmissionDetail {
  const resumen = aResumen(fila);
  const evaluacion = evaluarChecklist(fila.requisitos);
  const requirements: WireRequirement[] = fila.requisitos.map((r) => {
    const e = evaluarRequisito(r);
    return {
      code: r.code,
      label: r.label,
      description: r.description,
      required: r.required,
      evidenceKind: r.evidenceKind,
      requiresSource: r.requiresSource,
      professionGroup: r.code === 'REGISTRO_COLEGIO_MEDICO' ? 'MEDICO' : null,
      minItems: r.minItems,
      maxItems: r.maxItems,
      state: e.state,
      satisfied: e.satisfied,
      blockedBy: e.blockedBy,
      items: r.items.map(aFicha),
    };
  });
  const documents: WireDocument[] = fila.requisitos.flatMap((r) =>
    r.items.flatMap((f) =>
      f.archivo === null
        ? []
        : [{
            id: f.reviewId ?? f.itemId,
            requirementCode: r.code,
            fileId: f.archivo.fileId,
            name: f.archivo.name,
            mimeType: f.archivo.mimeType,
            sizeBytes: f.archivo.sizeBytes,
            uploadedAt: f.archivo.uploadedAt,
            pages: f.archivo.pages,
            reviewState: estadoEfectivo(f),
            evidenceSha256: f.evidenceSha256,
          }],
    ),
  );
  const numero = (id: string): string => fila.form.licenses.find((l) => l.id === id)?.number ?? 'Sin número';
  const jurisdiccion = (id: string): string | null => fila.form.licenses.find((l) => l.id === id)?.jurisdiction ?? null;
  const porCodigo = (f: FichaFila): string => fila.requisitos.find((r) => r.items.includes(f))?.code ?? 'SIN_REQUISITO';
  const todas = fichas(fila);
  const nacional = fila.practitioner.nationalId ?? '';
  return {
    ...resumen,
    practitioner: {
      ...resumen.practitioner,
      maskedNationalId: enmascarar(nacional),
      nationalId: fila.practitioner.nationalId,
      nationalIdIssuer: fila.practitioner.nationalIdIssuer,
      birthDate: fila.practitioner.birthDate,
      age: fila.practitioner.age,
      occupation: fila.practitioner.occupation,
      personalMobile: fila.practitioner.personalMobile,
      personalEmail: fila.practitioner.personalEmail,
      workMobile: fila.practitioner.workMobile,
      workPhone: fila.practitioner.workPhone,
      workEmail: fila.practitioner.workEmail,
    },
    licenses: todas
      .filter((f) => f.itemType === 'LICENSE')
      .map((f) => ({
        id: f.itemId,
        requirementCode: porCodigo(f),
        number: numero(f.itemId),
        jurisdiction: jurisdiccion(f.itemId),
        state: codificada(f),
        fileId: f.archivo?.fileId ?? null,
        verifiedAt: estadoEfectivo(f) === 'VERIFIED' ? f.reviewedAt : null,
        verificationSourceUri: null,
        rejectionReasonText: estadoEfectivo(f) === 'REJECTED' ? f.reasonText : null,
      })),
    credentials: todas
      .filter((f) => tipoCredencial(f.itemType))
      .map((f) => ({
        id: f.itemId,
        requirementCode: porCodigo(f),
        level: fila.requisitos.find((r) => r.items.includes(f))?.label ?? 'Título',
        title: f.label,
        institution: fila.form.education.find((e) => e.id === f.itemId)?.institution ?? null,
        state: codificada(f),
        fileId: f.archivo?.fileId ?? null,
        verifiedAt: estadoEfectivo(f) === 'VERIFIED' ? f.reviewedAt : null,
        verificationSourceUri: null,
        rejectionReasonText: estadoEfectivo(f) === 'REJECTED' ? f.reasonText : null,
      })),
    specialties: todas
      .filter((f) => f.itemType === 'SPECIALTY')
      .map((f) => ({ id: f.itemId, requirementCode: porCodigo(f), name: f.label, state: codificada(f), supportingCredentialId: null })),
    events: fila.events,
    infoRequestedText: fila.infoRequestedText,
    infoDueAt: fila.infoDueAt,
    decisionReasonText: fila.decisionReasonText,
    decisionReasonCode: fila.decisionReasonCode,
    internalNote: fila.internalNote,
    validUntil: fila.validUntil,
    resubmissionCount: fila.resubmissionCount,
    attestedAt: fila.attestedAt,
    fourEyesRequired: true,
    requirements,
    blockers: [...evaluacion.blockers],
    canVerify: evaluacion.canVerify,
    documents,
    submittedForm: fila.form,
    submittedFormSource: 'SNAPSHOT',
  };
}

const REENVIABLES = ['INFORMACION_REQUERIDA', 'RECHAZADA', 'EXPIRADA', 'ABANDONADA'];
const RETIRABLES = ['ENVIADA', 'INFORMACION_REQUERIDA'];

/** Lo que lee el propio médico: sin notas internas ni códigos reservados al personal. */
function aMia(fila: FilaAdmision): WireMyAdmission {
  return {
    id: fila.id,
    status: fila.status,
    submittedAt: fila.submittedAt,
    dueAt: fila.dueAt,
    infoRequestedText: fila.infoRequestedText,
    infoDueAt: fila.infoDueAt,
    decisionReasonText: fila.decisionReasonText,
    validUntil: fila.validUntil,
    items: fichas(fila).map((f) => {
      const efectivo = estadoEfectivo(f);
      const observado = efectivo === 'REJECTED' || efectivo === 'INFO_REQUIRED';
      return {
        type: f.itemType,
        id: f.itemId,
        label: f.label,
        state: efectivo,
        reasonText: observado ? f.reasonText : null,
        // La sospecha de fraude es solo del personal: al médico se le muestra «Otro».
        reasonCode: observado ? (f.reasonCode === 'SOSPECHA_DE_FRAUDE' ? 'OTRO' : f.reasonCode) : null,
      };
    }),
    resubmissionCount: fila.resubmissionCount,
    canResubmit: REENVIABLES.includes(fila.status.code) && fila.resubmissionCount < MAX_REENVIOS,
    canWithdraw: RETIRABLES.includes(fila.status.code),
  };
}

function motivoValido(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio.length >= MIN_MOTIVO && limpio.length <= MAX_MOTIVO ? limpio : null;
}

function notaValida(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim().slice(0, 1000) : null;
}

function codigoDeMotivo(valor: unknown): string | null {
  return typeof valor === 'string' && MOTIVOS.includes(valor) ? valor : null;
}

interface Contexto {
  readonly fila: FilaAdmision;
  readonly body: Record<string, unknown>;
}

function esRespuesta(valor: Contexto | MockReply): valor is MockReply {
  return 'status' in valor && 'body' in valor;
}

/** Resuelve fila + cuerpo, o la respuesta de error que corresponde. */
function contexto(request: MockRequest): Contexto | MockReply {
  const fila = filas.get(request.params['id']!);
  if (fila === undefined) return falla(404, 'NOT_FOUND', 'ADMISSION_NOT_FOUND', 'Admisión no encontrada');
  if (esPropia(fila, request.user)) return prohibido('ADMISSION_SELF_ACCESS', AUTOACCESO);
  return { fila, body: cuerpo<Record<string, unknown>>(request) };
}

function obsoleta(esperada: unknown, actual: number): MockReply | null {
  if (typeof esperada !== 'number') {
    return rechazo(412, 'ADMISSION_VERSION_REQUIRED', 'Falta la versión que usted vio.');
  }
  return esperada === actual
    ? null
    : rechazo(409, 'ADMISSION_STALE', 'Otra persona modificó esta admisión: recargue para ver los cambios', { currentRowVersion: actual });
}

function transicion(fila: FilaAdmision, permitidos: readonly string[], accion: string): MockReply | null {
  return permitidos.includes(fila.status.code)
    ? null
    : rechazo(412, 'ADMISSION_INVALID_TRANSITION', `No se puede ${accion} una admisión en estado «${fila.status.label}».`, { status: fila.status.code });
}

/** Solo quien tomó la revisión actúa sobre sus fichas. */
function soloAsignada(fila: FilaAdmision, user: MockUser, accion: string): MockReply | null {
  return fila.assignedTo?.id === user.id
    ? null
    : prohibido('ADMISSION_NOT_ASSIGNED_TO_ACTOR', `Solo quien tomó la revisión puede ${accion}.`);
}

const actorDe = (user: MockUser): Actor => ({ id: user.id, name: user.displayName });

function rolDeActor(user: MockUser): string {
  if (user.roles.includes(ROL_APROBADOR)) return ROL_APROBADOR;
  if (user.roles.includes(ROL_REVISOR)) return ROL_REVISOR;
  return user.roles[0] ?? 'SECURITY_ADMIN';
}

/**
 * Aplica un cambio sobre una copia de la fila y la guarda con su evento.
 * `subeVersion` es la versión de la ADMISIÓN: la revisión de una ficha sube la
 * de la ficha, no la de la admisión.
 */
function editar(
  fila: FilaAdmision,
  cambiar: (copia: FilaAdmision) => void,
  ev: Pick<WireEvent, 'type'> & Partial<Omit<WireEvent, 'id' | 'occurredAt'>>,
  subeVersion = true,
): FilaAdmision {
  const copia = structuredClone(fila);
  cambiar(copia);
  if (subeVersion) copia.rowVersion += 1;
  copia.events.push({
    fromStatus: null, toStatus: null, itemType: null, itemId: null, requirementCode: null,
    verificationSourceUri: null, reasonCode: null, reasonText: null, actor: null, actorRole: null,
    ...ev,
    id: nuevoId('adm-ev'),
    occurredAt: ahora(),
  });
  filas.agregar(copia);
  return copia;
}

function validarFuente(body: Record<string, unknown>): { type: string; ref: string | null } | MockReply {
  const type = body['sourceType'];
  if (typeof type !== 'string' || !FUENTES.includes(type)) {
    return rechazo(412, 'ADMISSION_ITEM_REQUIRES_SOURCE', 'Verificar este ítem exige declarar la fuente consultada');
  }
  const ref = typeof body['sourceRef'] === 'string' && body['sourceRef'].trim() !== '' ? body['sourceRef'].trim() : null;
  if (type === 'OTRO' && ref === null) {
    return rechazo(412, 'ADMISSION_ITEM_REQUIRES_SOURCE', 'Describa la fuente que consultó.');
  }
  return { type, ref };
}

function validarMotivo(body: Record<string, unknown>): { code: string; text: string; note: string | null } | MockReply {
  const text = motivoValido(body['reason']);
  if (text === null) return rechazo(412, 'ADMISSION_REASON_REQUIRED', 'Esta acción exige un motivo');
  return { code: codigoDeMotivo(body['reasonCode']) ?? 'OTRO', text, note: notaValida(body['internalNote']) };
}

const esMotivo = (valor: unknown): valor is { code: string; text: string; note: string | null } =>
  typeof valor === 'object' && valor !== null && 'text' in valor;

/** Las revisiones se materializan (con su versión) al tomar la admisión. */
function materializar(copia: FilaAdmision): void {
  for (const f of fichas(copia)) {
    if (f.reviewId === null) {
      f.reviewId = nuevoId('adm-review');
      f.rowVersion = 1;
    }
  }
}

function firmar(userId: string, admissionId: string, fileId: string, expires: number): string {
  return huella(userId, admissionId, fileId, String(expires), 'firma');
}

/* ---- rutas ----------------------------------------------------------------- */

export function registrarAdmisiones(router: MockRouter): void {
  // Solo en el simulador y solo en el navegador: palancas para recorrer a mano
  // los conflictos (versión vieja, evidencia cambiada, enlace vencido).
  if (typeof window !== 'undefined') {
    (window as unknown as { __mockAdmisiones?: unknown }).__mockAdmisiones = { reemplazarEvidencia, tocarVersion, vencerEnlaces };
  }
  const listar = (request: MockRequest, q: string, filtros: URLSearchParams): MockReply | unknown => {
    if (!conRol(request.user, ...LECTORES)) {
      return rolFaltante(ROL_REVISOR, 'Su cuenta no puede ver las admisiones.');
    }
    const tipo = filtros.get('type');
    const asignado = filtros.get('assignedTo');
    const soloVencidas = filtros.get('overdue') === 'true';
    const base = filas.todos().filter((f) => {
      // Su propia solicitud no aparece en su bandeja.
      if (esPropia(f, request.user)) return false;
      if (tipo !== null && tipo !== '' && f.type.code !== tipo) return false;
      if (asignado === 'none' && f.assignedTo !== null) return false;
      if (asignado === 'me' && f.assignedTo?.id !== request.user?.id) return false;
      if (asignado !== null && !['', 'none', 'me'].includes(asignado) && f.assignedTo?.id !== asignado) return false;
      if (soloVencidas && !vencida(f)) return false;
      if (q !== '') {
        const campos = [f.practitioner.fullName, f.practitioner.nationalId, enmascarar(f.practitioner.nationalId ?? ''), ...f.form.licenses.map((l) => l.number)];
        if (!campos.some((c) => contieneSinTildes(c, q))) return false;
      }
      return true;
    });
    const counts: Record<string, number> = {};
    for (const f of base) counts[f.status.code] = (counts[f.status.code] ?? 0) + 1;
    const estadoPedido = filtros.get('status');
    const visibles = base
      .filter((f) => estadoPedido === null || estadoPedido === '' || f.status.code === estadoPedido)
      .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || Date.parse(a.submittedAt) - Date.parse(b.submittedAt));
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
    if (!conRol(request.user, ...LECTORES)) {
      return rolFaltante(ROL_REVISOR, 'Su cuenta no puede ver las admisiones.');
    }
    const c = contexto(request);
    return esRespuesta(c) ? c : aDetalle(c.fila);
  });

  /* ---- documentos: dirección firmada y contenido ---------------------------- */

  router.post('/admissions/:id/documents/:fileId/download-url', (request) => {
    if (!conRol(request.user, ...LECTORES)) {
      return rolFaltante(ROL_REVISOR, 'Su cuenta no puede ver los documentos.');
    }
    const c = contexto(request);
    if (esRespuesta(c)) return c;
    const user = request.user!;
    const fileId = request.params['fileId']!;
    const ficha = fichas(c.fila).find((f) => f.archivo?.fileId === fileId);
    // El archivo debe ser de ESTA admisión: uno ajeno se trata como inexistente.
    if (ficha?.archivo == null) return falla(404, 'NOT_FOUND', 'ADMISSION_DOCUMENT_NOT_FOUND', 'Documento no encontrado');
    const expires = enlacesVencidos ? Date.now() - 1_000 : Date.now() + VIDA_ENLACE_MS;
    // El acceso queda en la bitácora de accesos del servidor; no es un cambio de la admisión.
    return reply(201, {
      url: `/admissions/${encodeURIComponent(c.fila.id)}/documents/${encodeURIComponent(fileId)}/content?expires=${expires}&signature=${firmar(user.id, c.fila.id, fileId, expires)}`,
      expiresAt: new Date(expires).toISOString(),
      name: ficha.archivo.name,
      mimeType: ficha.archivo.mimeType,
    });
  });

  router.get('/admissions/:id/documents/:fileId/content', (request) => {
    if (!conRol(request.user, ...LECTORES)) {
      return rolFaltante(ROL_REVISOR, 'Su cuenta no puede ver los documentos.');
    }
    const c = contexto(request);
    if (esRespuesta(c)) return c;
    const user = request.user!;
    const fileId = request.params['fileId']!;
    const expires = Number(request.query.get('expires'));
    const firma = request.query.get('signature');
    if (!Number.isFinite(expires) || firma === null || firma !== firmar(user.id, c.fila.id, fileId, expires)) {
      return prohibido('ADMISSION_DOCUMENT_URL_INVALID', 'La dirección del documento no es válida.');
    }
    if (expires < Date.now()) {
      return falla(410, 'GONE', 'ADMISSION_DOCUMENT_URL_INVALID', 'La dirección del documento venció.');
    }
    const ficha = fichas(c.fila).find((f) => f.archivo?.fileId === fileId);
    const descriptor = admissionFileDescriptor(fileId);
    if (ficha?.archivo == null || descriptor === undefined) {
      return falla(404, 'NOT_FOUND', 'ADMISSION_DOCUMENT_NOT_FOUND', 'Documento no encontrado');
    }
    return {
      status: 200,
      body: admissionFileBlob(descriptor),
      headers: {
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(ficha.archivo.name)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    };
  });

  /* ---- tomar, soltar, reasignar --------------------------------------------- */

  router.post('/admissions/:id/claim', (request) => {
    if (!conRol(request.user, ROL_REVISOR)) {
      return rolFaltante(ROL_REVISOR, 'Tomar una revisión requiere el rol «Revisión de admisiones».');
    }
    const c = contexto(request);
    if (esRespuesta(c)) return c;
    const user = request.user!;
    // Repetir la toma por quien ya la tiene es un 200.
    if (c.fila.status.code === 'EN_REVISION' && c.fila.assignedTo?.id === user.id) return aDetalle(c.fila);
    const stale = obsoleta(c.body['expectedRowVersion'], c.fila.rowVersion);
    if (stale !== null) return stale;
    const mala = transicion(c.fila, ['ENVIADA'], 'tomar');
    if (mala !== null) return mala;
    return aDetalle(
      editar(c.fila, (copia) => {
        copia.status = estado('EN_REVISION');
        copia.assignedTo = actorDe(user);
        materializar(copia);
      }, { type: 'CLAIMED', fromStatus: estado('ENVIADA'), toStatus: estado('EN_REVISION'), actor: actorDe(user), actorRole: ROL_REVISOR }),
    );
  });

  router.post('/admissions/:id/release', (request) => {
    if (!conRol(request.user, ...LECTORES)) {
      return rolFaltante(ROL_REVISOR, 'Soltar una revisión requiere el rol «Revisión de admisiones».');
    }
    const c = contexto(request);
    if (esRespuesta(c)) return c;
    const user = request.user!;
    const stale = obsoleta(c.body['expectedRowVersion'], c.fila.rowVersion);
    if (stale !== null) return stale;
    const mala = transicion(c.fila, ['EN_REVISION'], 'soltar');
    if (mala !== null) return mala;
    // El dueño de la revisión la suelta; un aprobador puede soltar la de otro.
    if (c.fila.assignedTo?.id !== user.id && !conRol(user, ROL_APROBADOR)) {
      return prohibido('ADMISSION_NOT_ASSIGNED_TO_ACTOR', 'Solo quien tomó la revisión, o un aprobador, puede soltarla.');
    }
    return aDetalle(
      editar(c.fila, (copia) => {
        copia.status = estado('ENVIADA');
        copia.assignedTo = null;
      }, { type: 'RELEASED', fromStatus: estado('EN_REVISION'), toStatus: estado('ENVIADA'), actor: actorDe(user), actorRole: rolDeActor(user) }),
    );
  });

  router.post('/admissions/:id/reassign', (request) => {
    if (!conRol(request.user, ROL_APROBADOR)) {
      return rolFaltante(ROL_APROBADOR, 'Reasignar una revisión requiere el rol «Aprobación de admisiones».');
    }
    const c = contexto(request);
    if (esRespuesta(c)) return c;
    const user = request.user!;
    const stale = obsoleta(c.body['expectedRowVersion'], c.fila.rowVersion);
    if (stale !== null) return stale;
    const mala = transicion(c.fila, ['EN_REVISION'], 'reasignar');
    if (mala !== null) return mala;
    const destino = REVISORES.find((r) => r.id === c.body['toUserId']);
    if (destino === undefined) {
      return rechazo(412, 'ADMISSION_ASSIGNEE_INVALID', 'Esa cuenta no puede recibir la revisión: debe tener el rol de revisión.');
    }
    return aDetalle(
      editar(c.fila, (copia) => {
        copia.assignedTo = destino;
      }, { type: 'REASSIGNED', fromStatus: estado('EN_REVISION'), toStatus: estado('EN_REVISION'), actor: actorDe(user), actorRole: ROL_APROBADOR, reasonText: `Asignada a ${destino.name}` }),
    );
  });

  /* ---- pedir información ------------------------------------------------------- */

  router.post('/admissions/:id/request-info', (request) => {
    if (!conRol(request.user, ROL_REVISOR)) {
      return rolFaltante(ROL_REVISOR, 'Pedir información requiere el rol «Revisión de admisiones».');
    }
    const c = contexto(request);
    if (esRespuesta(c)) return c;
    const user = request.user!;
    const stale = obsoleta(c.body['expectedRowVersion'], c.fila.rowVersion);
    if (stale !== null) return stale;
    const mala = transicion(c.fila, ['EN_REVISION'], 'pedir información en');
    if (mala !== null) return mala;
    const noEsDueno = soloAsignada(c.fila, user, 'pedir información');
    if (noEsDueno !== null) return noEsDueno;
    const motivo = validarMotivo(c.body);
    if (!esMotivo(motivo)) return motivo;
    const refs = Array.isArray(c.body['items']) ? (c.body['items'] as { id?: unknown }[]) : [];
    // El reloj del SLA se pausa; el médico tiene un plazo propio para responder.
    return aDetalle(
      editar(c.fila, (copia) => {
        copia.status = estado('INFORMACION_REQUERIDA');
        copia.infoRequestedText = motivo.text;
        copia.infoDueAt = new Date(Date.now() + PLAZO_INFORMACION_DIAS * 86_400_000).toISOString();
        for (const f of fichas(copia)) {
          if (refs.some((r) => r.id === f.itemId)) {
            f.state = 'INFO_REQUIRED';
            f.reasonCode = motivo.code;
            f.reasonText = motivo.text;
            f.reviewedSha256 = f.evidenceSha256;
            f.reviewedBy = actorDe(user);
            f.reviewedAt = ahora();
            if (f.rowVersion !== null) f.rowVersion += 1;
          }
        }
      }, {
        type: 'INFO_REQUESTED', fromStatus: estado('EN_REVISION'), toStatus: estado('INFORMACION_REQUERIDA'),
        actor: actorDe(user), actorRole: ROL_REVISOR, reasonCode: motivo.code, reasonText: motivo.text,
      }),
    );
  });

  /* ---- revisar una ficha ---------------------------------------------------------- */

  router.post('/admissions/:id/items/:itemId/review', (request) => {
    if (!conRol(request.user, ROL_REVISOR)) {
      return rolFaltante(ROL_REVISOR, 'Revisar un requisito requiere el rol «Revisión de admisiones».');
    }
    const fila = filas.get(request.params['id']!);
    if (fila === undefined) return falla(404, 'NOT_FOUND', 'ADMISSION_NOT_FOUND', 'Admisión no encontrada');
    const user = request.user!;
    const reviewId = request.params['itemId']!;
    const ficha = fichas(fila).find((f) => f.reviewId === reviewId);
    // Una ficha de OTRA admisión se trata como inexistente.
    if (ficha === undefined) return falla(404, 'NOT_FOUND', 'ADMISSION_ITEM_NOT_FOUND', 'Ítem de la admisión no encontrado');
    if (esPropia(fila, user)) return prohibido('ADMISSION_SELF_ACCESS', AUTOACCESO);
    const body = cuerpo<Record<string, unknown>>(request);
    const decision = body['decision'];
    if (decision !== 'VERIFIED' && decision !== 'REJECTED' && decision !== 'INFO_REQUIRED') {
      return rechazo(412, 'ADMISSION_INVALID_DECISION', 'La decisión sobre el ítem no es válida.');
    }
    // Idempotencia: repetir la misma revisión no escribe ni duplica el evento.
    if (ficha.state === decision && ficha.reviewedSha256 === ficha.evidenceSha256 && body['evidenceSha256'] === ficha.evidenceSha256) {
      return aDetalle(fila);
    }
    const stale = obsoleta(body['expectedRowVersion'], ficha.rowVersion ?? 0);
    if (stale !== null) return stale;
    const mala = transicion(fila, ['EN_REVISION'], 'revisar los requisitos de');
    if (mala !== null) return mala;
    const noEsDueno = soloAsignada(fila, user, 'revisar sus requisitos');
    if (noEsDueno !== null) return noEsDueno;
    // La huella de lo que el revisor tenía en pantalla: obligatoria al verificar.
    const vista = body['evidenceSha256'];
    const movida =
      decision === 'VERIFIED'
        ? vista !== ficha.evidenceSha256
        : typeof vista === 'string' && vista !== ficha.evidenceSha256;
    if (decision === 'VERIFIED' && (typeof vista !== 'string' || !/^[0-9a-f]{64}$/.test(vista))) {
      return rechazo(412, 'ADMISSION_EVIDENCE_REQUIRED', 'Falta la huella de la evidencia que revisó.');
    }
    if (movida) {
      // El médico cambió el dato o el archivo mientras se lo miraba: no se decide a ciegas.
      return rechazo(409, 'ADMISSION_EVIDENCE_CHANGED', 'La evidencia del ítem cambió desde que la revisó: vuelva a abrirla', { currentEvidenceSha256: ficha.evidenceSha256 });
    }
    const requisito = fila.requisitos.find((r) => r.items.some((i) => i.reviewId === reviewId))!;
    let fuente: { type: string; ref: string | null } | null = null;
    let motivo: { code: string; text: string; note: string | null } | null = null;
    if (decision === 'VERIFIED') {
      const declarada = validarFuente(body);
      if ('status' in declarada) {
        // Una fuente es obligatoria si el requisito la exige; si no, se acepta sin ella.
        if (requisito.requiresSource) return declarada;
      } else {
        fuente = declarada;
      }
    } else {
      const m = validarMotivo(body);
      if (!esMotivo(m)) return m;
      motivo = m;
    }
    const consulta = typeof body['sourceConsultedAt'] === 'string' ? new Date(String(body['sourceConsultedAt']).length === 10 ? `${body['sourceConsultedAt']}T12:00:00` : String(body['sourceConsultedAt'])) : new Date();
    const consultada = (Number.isNaN(consulta.getTime()) ? new Date() : consulta).toISOString();
    return aDetalle(
      editar(fila, (copia) => {
        const f = fichas(copia).find((x) => x.reviewId === reviewId)!;
        f.state = decision;
        f.reviewedSha256 = f.evidenceSha256;
        f.reviewedBy = actorDe(user);
        f.reviewedAt = ahora();
        f.rowVersion = (f.rowVersion ?? 0) + 1;
        f.sourceType = fuente?.type ?? null;
        f.sourceRef = fuente?.ref ?? null;
        f.sourceConsultedAt = fuente === null ? null : consultada;
        f.reasonCode = motivo?.code ?? null;
        f.reasonText = motivo?.text ?? null;
        f.internalNote = motivo?.note ?? notaValida(body['internalNote']);
      }, {
        type: decision === 'VERIFIED' ? 'ITEM_VERIFIED' : decision === 'REJECTED' ? 'ITEM_REJECTED' : 'ITEM_INFO_REQUIRED',
        itemType: ficha.itemType, itemId: ficha.itemId, requirementCode: requisito.code,
        verificationSourceUri: fuente?.ref ?? null, reasonCode: motivo?.code ?? null, reasonText: motivo?.text ?? null,
        actor: actorDe(user), actorRole: ROL_REVISOR,
      }, false),
    );
  });

  /* ---- decisión final y suspensión ----------------------------------------------- */

  router.post('/admissions/:id/decision', (request) => {
    if (!conRol(request.user, ROL_APROBADOR)) {
      return rolFaltante(ROL_APROBADOR, 'La decisión final requiere el rol «Aprobación de admisiones».');
    }
    const c = contexto(request);
    if (esRespuesta(c)) return c;
    const user = request.user!;
    if (Array.isArray(c.body['items']) && c.body['items'].length > 0) {
      return rechazo(412, 'ADMISSION_DECISION_ITEMS_NOT_ACCEPTED', 'La resolución no recibe ítems: se revisan uno por uno en .../items/:itemId/review');
    }
    const decision = c.body['decision'];
    if (decision !== 'VERIFIED' && decision !== 'REJECTED') {
      return rechazo(412, 'ADMISSION_INVALID_DECISION', 'La decisión final no es válida.');
    }
    const destino = decision === 'VERIFIED' ? 'VERIFICADA' : 'RECHAZADA';
    // Repetir la misma resolución sobre una admisión ya resuelta es un 200.
    if (c.fila.status.code === destino) return aDetalle(c.fila);
    const stale = obsoleta(c.body['expectedRowVersion'], c.fila.rowVersion);
    if (stale !== null) return stale;
    const mala = transicion(c.fila, ['EN_REVISION'], 'resolver');
    if (mala !== null) return mala;
    if (violaCuatroOjos(c.fila, user)) {
      return prohibido('ADMISSION_FOUR_EYES_REQUIRED', 'Otra persona debe aprobar: usted revisó requisitos de esta admisión o es el propio profesional.');
    }
    let motivo: { code: string; text: string; note: string | null } | null = null;
    const evaluacion = evaluarChecklist(c.fila.requisitos);
    if (decision === 'VERIFIED') {
      if (!evaluacion.canVerify) {
        return rechazo(412, 'ADMISSION_CHECKLIST_INCOMPLETE', 'El checklist no está completo: hay requisitos sin verificar o rechazados', { blockers: evaluacion.blockers });
      }
    } else {
      const m = validarMotivo(c.body);
      if (!esMotivo(m)) return m;
      motivo = m;
    }
    const vigencia = new Date();
    vigencia.setMonth(vigencia.getMonth() + VIGENCIA_MESES);
    return aDetalle(
      editar(c.fila, (copia) => {
        copia.status = estado(destino);
        copia.decisionReasonText = motivo?.text ?? null;
        copia.decisionReasonCode = motivo?.code ?? null;
        copia.internalNote = notaValida(c.body['internalNote']);
        copia.infoRequestedText = null;
        copia.infoDueAt = null;
        copia.validUntil = decision === 'VERIFIED' ? vigencia.toISOString().slice(0, 10) : null;
      }, {
        type: decision === 'VERIFIED' ? 'VERIFIED' : 'REJECTED', fromStatus: estado('EN_REVISION'), toStatus: estado(destino),
        actor: actorDe(user), actorRole: ROL_APROBADOR, reasonCode: motivo?.code ?? null, reasonText: motivo?.text ?? null,
      }),
    );
  });

  const cambiarEstado = (
    desde: string,
    hacia: string,
    tipo: string,
    verbo: string,
  ) => (request: MockRequest): MockReply | unknown => {
    if (!conRol(request.user, ROL_APROBADOR)) {
      return rolFaltante(ROL_APROBADOR, `Para ${verbo} una admisión hace falta el rol «Aprobación de admisiones».`);
    }
    const c = contexto(request);
    if (esRespuesta(c)) return c;
    const stale = obsoleta(c.body['expectedRowVersion'], c.fila.rowVersion);
    if (stale !== null) return stale;
    const mala = transicion(c.fila, [desde], verbo);
    if (mala !== null) return mala;
    if (tipo === 'REINSTATED' && c.fila.validUntil !== null && c.fila.validUntil < new Date().toISOString().slice(0, 10)) {
      return rechazo(412, 'ADMISSION_VALIDITY_LAPSED', 'La vigencia de esta verificación ya terminó: no se puede reponer.');
    }
    const motivo = validarMotivo(c.body);
    if (!esMotivo(motivo)) return motivo;
    return aDetalle(
      editar(c.fila, (copia) => {
        copia.status = estado(hacia);
        copia.decisionReasonText = tipo === 'SUSPENDED' ? motivo.text : null;
        copia.decisionReasonCode = tipo === 'SUSPENDED' ? motivo.code : null;
      }, {
        type: tipo, fromStatus: estado(desde), toStatus: estado(hacia), actor: actorDe(request.user!), actorRole: ROL_APROBADOR,
        reasonCode: motivo.code, reasonText: motivo.text,
      }),
    );
  };

  router.post('/admissions/:id/suspend', cambiarEstado('VERIFICADA', 'SUSPENDIDA', 'SUSPENDED', 'suspender'));
  router.post('/admissions/:id/reinstate', cambiarEstado('SUSPENDIDA', 'VERIFICADA', 'REINSTATED', 'reponer'));

  /* ---- lo que ve el propio médico ------------------------------------------ */

  const propia = (user: MockUser | null): FilaAdmision | undefined =>
    user === null
      ? undefined
      : filas.todos().find((f) => f.practitionerUserId === user.id || (user.practitionerProfileId !== undefined && f.practitionerProfileId === user.practitionerProfileId));

  router.get('/profiles/practitioners/me/admission', ({ user }) => {
    const fila = propia(user);
    return fila === undefined ? falla(404, 'NOT_FOUND', 'ADMISSION_NOT_FOUND', 'No tiene una admisión') : aMia(fila);
  });

  router.post('/profiles/practitioners/me/admission/resubmit', (request) => {
    const fila = propia(request.user);
    if (fila === undefined) return falla(404, 'NOT_FOUND', 'ADMISSION_NOT_FOUND', 'No tiene una admisión');
    const mala = transicion(fila, REENVIABLES, 'reenviar');
    if (mala !== null) return mala;
    const cuerpoReenvio = cuerpo<Record<string, unknown>>(request);
    if (cuerpoReenvio['attested'] !== true || typeof cuerpoReenvio['attestationVersion'] !== 'string' || cuerpoReenvio['attestationVersion'] === '') {
      return rechazo(412, 'ADMISSION_ATTESTATION_REQUIRED', 'Debe declarar que los datos y documentos son verídicos.');
    }
    if (fila.resubmissionCount >= MAX_REENVIOS) {
      return rechazo(412, 'ADMISSION_RESUBMISSION_LIMIT', 'Llegó al máximo de reenvíos. Escriba al equipo de soporte para reabrir su solicitud.');
    }
    return aMia(
      editar(fila, (copia) => {
        copia.status = estado('ENVIADA');
        copia.assignedTo = null;
        copia.infoRequestedText = null;
        copia.infoDueAt = null;
        copia.decisionReasonText = null;
        copia.decisionReasonCode = null;
        copia.resubmissionCount += 1;
        copia.dueAt = sumarDiasHabiles(new Date(), SLA_DIAS_HABILES).toISOString();
        // Lo observado vuelve a pendiente; lo verificado se conserva.
        for (const f of fichas(copia)) {
          if (f.state === 'REJECTED' || f.state === 'INFO_REQUIRED') {
            f.state = 'PENDING';
            f.reasonCode = null;
            f.reasonText = null;
            f.internalNote = null;
            f.reviewedSha256 = null;
          }
        }
      }, {
        type: 'RESUBMITTED', fromStatus: fila.status, toStatus: estado('ENVIADA'),
        actor: { id: fila.practitionerUserId, name: fila.practitioner.fullName }, actorRole: 'PRACTITIONER',
      }),
    );
  });

  router.post('/profiles/practitioners/me/admission/withdraw', (request) => {
    const fila = propia(request.user);
    if (fila === undefined) return falla(404, 'NOT_FOUND', 'ADMISSION_NOT_FOUND', 'No tiene una admisión');
    const mala = transicion(fila, RETIRABLES, 'retirar');
    if (mala !== null) return mala;
    return aMia(
      editar(fila, (copia) => {
        copia.status = estado('RETIRADA');
        copia.assignedTo = null;
      }, {
        type: 'WITHDRAWN', fromStatus: fila.status, toStatus: estado('RETIRADA'),
        actor: { id: fila.practitionerUserId, name: fila.practitioner.fullName }, actorRole: 'PRACTITIONER',
      }),
    );
  });
}

export { APROBADOR, OTRO_REVISOR, REVISOR_ADMIN };

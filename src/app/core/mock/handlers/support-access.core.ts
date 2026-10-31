import { camposDeGobierno } from './support-access.governance.view';
import { SUPPORT_ACTION_CODES, SUPPORT_ACTION_LABELS, SUPPORT_ROLE_TEMPLATE_CODES, SUPPORT_TARGET_KINDS, type LocationNode, type SupportActionCode, type SupportAgenda, type SupportAgendaItem, type SupportCatalog, type SupportEngagement, type SupportEngagementRequest, type SupportGrant, type SupportScopeTarget, type SupportTargetKind } from '../../data-access/support-access/support-access.types';
import { GRACE_DAYS } from '../../data-access/support-access/support-recertification';
import { actionsFor, contextsOf, evaluateAction, indexLocations, isWithin, previewCoverage, type AppointmentContext, type CoverageGrant } from '../../data-access/support-access/support-coverage';
import { patientById } from '../fixtures/people';
import { accesosClinicos, ajustesDeAgenda, bitacora, CATALOGOS, delegadoId, delegados, DOCTORES_POR_TENANT, esperasDeApoyo, invitaciones, permisos, vinculos, type DoctorSimulado, type FilaDelegado, type FilaPermiso, type FilaSolicitud, type FilaVinculo } from '../fixtures/support-hospital';
import { agendaDePartida, filaDeAgenda, recursoDeAgenda } from '../fixtures/support-hospital-agenda';
import { forbidden, notFound, type MockReply, type MockRequest } from '../mock-router';
import { esEtiquetaReservada } from './support-access.reserved';
import { denegadoGenerico } from './support-access.errors';
import { TENANT_NAMES, type MockUser } from '../mock-session';
import { ahora, nuevoId, uuid } from '../mock-store';


/* ============================================================================
    Piezas compartidas del backend simulado del personal de apoyo: identidad,
    permisos efectivos, vistas, bitácora y delegados. Sin rutas: las rutas viven
    en los `support-access.*.handlers.ts`. La decisión de «puede o no puede» sale
    de `evaluateAction` / `actionsFor` (en la API real, `SupportAccessPolicy`).
    Dos reglas se hacen cumplir acá: las acciones salen de la **suma** de los
    permisos vigentes, y un permiso que nombra a un doctor **no rige** hasta que
    ese doctor acepta a la persona.
   ========================================================================== */

export const QUINCE_DIAS = 15;

export const TIPOS_CON_DOCTOR: readonly SupportTargetKind[] = ['PRACTITIONER', 'PRACTITIONER_SERVICE', 'PRACTITIONER_LOCATION'];

/* ---- identidad ----------------------------------------------------------------- */

/** El tenant del contexto: `X-Tenant-Id` o, sin él, la primera organización de la cuenta. */
export function tenantDe(request: MockRequest): string | null {
  return request.headers.get('X-Tenant-Id') ?? request.user?.tenants[0] ?? null;
}

/** La cuenta de la organización (o la plataforma) con autoridad sobre ese tenant. */
export function esCuentaDeLaOrganizacion(user: MockUser | null, tenantId: string | null): boolean {
  if (user === null || tenantId === null || CATALOGOS[tenantId] === undefined) return false;
  if (user.roles.includes('SUPERADMIN')) return true;
  // Como la API: la cuenta de la organización **y** el rol `SECURITY_ADMIN` en `/org/*`.
  return user.accountKind === 'ORGANIZATION' && user.roles.includes('SECURITY_ADMIN') && user.tenants.includes(tenantId);
}

export function soloOrganizacion(request: MockRequest): { tenantId: string } | MockReply {
  const tenantId = tenantDe(request);
  if (request.user === null) return { status: 401, body: { statusCode: 401, code: 'UNAUTHENTICATED', message: 'Sin sesión', error: 'Unauthorized' } };
  if (!esCuentaDeLaOrganizacion(request.user, tenantId)) {
    return forbidden('Solo la cuenta de la organización administra a su personal de apoyo.');
  }
  return { tenantId: tenantId! };
}

export function esRespuesta(valor: { tenantId: string } | MockReply): valor is MockReply {
  return 'status' in valor;
}

export function doctorDe(user: MockUser | null): DoctorSimulado | undefined {
  if (user === null) return undefined;
  return Object.values(DOCTORES_POR_TENANT)
    .flat()
    .find((d) => d.userId === user.id);
}

export function doctorPorId(doctorId: string): DoctorSimulado | undefined {
  return Object.values(DOCTORES_POR_TENANT)
    .flat()
    .find((d) => d.id === doctorId);
}

/* ---- permisos efectivos -------------------------------------------------------- */

export function doctorDelPermiso(p: SupportScopeTarget): string | undefined {
  return TIPOS_CON_DOCTOR.includes(p.targetKind) ? p.practitionerRoleAssignmentId : undefined;
}

/** Un permiso que nombra a un doctor rige solo si ese doctor aceptó a la persona. */
export function rige(permiso: FilaPermiso): boolean {
  if (permiso.status !== 'ACTIVE') return false;
  const doctorId = doctorDelPermiso(permiso);
  if (doctorId === undefined) return true;
  const delegado = delegados.get(delegadoId(permiso.engagementId, doctorId));
  return delegado === undefined || delegado.status === 'ACTIVE';
}

/**
 * Suspende los vínculos que pasaron su recertificación más de 15 días sin
 * confirmarse. En la API real lo hace un barrido programado; acá se aplica al
 * leer, igual que el vencimiento de las solicitudes. Idempotente.
 */
export function barrerRecertificaciones(ahoraMs: number = Date.now()): void {
  for (const v of vinculos.filtrar((x) => x.status === 'ACTIVE' && new Date(x.nextRecertificationAt).getTime() + GRACE_DAYS * 86_400_000 < ahoraMs)) {
    // Como la API: `suspendedAt` es la fecha en que debió suspenderse (la de recertificación más 15 días), no cuándo se leyó.
    vinculos.actualizar(v.id, { status: 'SUSPENDED', suspendedAt: new Date(new Date(v.nextRecertificationAt).getTime() + GRACE_DAYS * 86_400_000).toISOString() });
    anotar(v.tenantId, TENANT_NAMES[v.tenantId] ?? 'La organización', 'engagement.suspended', `Se suspendió el vínculo de ${v.personName} por no confirmarse a tiempo.`);
  }
}

export function vinculosActivosDe(userId: string, tenantId: string): FilaVinculo[] {
  barrerRecertificaciones();
  return vinculos.filtrar((v) => v.userId === userId && v.tenantId === tenantId && v.status === 'ACTIVE');
}

export function permisosEfectivos(userId: string, tenantId: string): CoverageGrant[] {
  const ids = new Set(vinculosActivosDe(userId, tenantId).map((v) => v.id));
  return permisos.filtrar((p) => ids.has(p.engagementId) && rige(p));
}

export function permisosEfectivosDeVinculo(engagementId: string): CoverageGrant[] {
  return permisos.filtrar((p) => p.engagementId === engagementId && rige(p));
}

/* ---- vistas -------------------------------------------------------------------- */

export function catalogoDe(tenantId: string): SupportCatalog {
  return CATALOGOS[tenantId]!;
}

export function vistaPermiso(p: FilaPermiso, tenantId: string): SupportGrant {
  const catalogo = catalogoDe(tenantId);
  const doctor = catalogo.doctors.find((d) => d.id === p.practitionerRoleAssignmentId);
  const servicio = catalogo.services.find((s) => s.id === p.healthcareServiceId);
  const lugar = catalogo.locations.find((l) => l.id === (p.practiceSiteId ?? p.careSpaceId));
  return {
    id: p.id,
    engagementId: p.engagementId,
    targetKind: p.targetKind,
    expansionMode: p.expansionMode,
    actions: p.actions,
    status: p.status,
    ...(p.practitionerRoleAssignmentId === undefined ? {} : { practitionerRoleAssignmentId: p.practitionerRoleAssignmentId }),
    ...(p.healthcareServiceId === undefined ? {} : { healthcareServiceId: p.healthcareServiceId }),
    ...(p.careSpaceId === undefined ? {} : { careSpaceId: p.careSpaceId }),
    ...(p.practiceSiteId === undefined ? {} : { practiceSiteId: p.practiceSiteId }),
    ...(p.validFrom === undefined ? {} : { validFrom: p.validFrom }),
    ...(p.validTo === undefined ? {} : { validTo: p.validTo }),
    ...camposDeGobierno(p),
    ...(doctor === undefined ? {} : { practitionerName: doctor.name }),
    ...(servicio === undefined ? {} : { serviceName: servicio.name }),
    ...(lugar === undefined ? {} : { locationName: lugar.name }),
  };
}

export function ultimaActividadDe(nombre: string, tenantId: string): string | undefined {
  return bitacora
    .filtrar((b) => b.tenantId === tenantId && b.actorName === nombre)
    .map((b) => b.occurredAt)
    .sort()
    .at(-1);
}

/**
 * Un vínculo tal como sale por la red (`SupportEngagementViewDto`): `roleTemplateCode`, estado
 * de la API (`ACTIVE | SUSPENDED | REVOKED | EXPIRED`), sin `personEmail` ni
 * `reactivationRequestedAt` (la API no los tiene) y con `recertificationDue`. El cliente lo
 * traduce en `support-access.wire.ts`.
 */
export interface VinculoEnLaRed {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly roleTemplateCode: SupportEngagement['roleTemplate'];
  readonly personName: string;
  readonly organizationName: string;
  readonly ownerKind: SupportEngagement['ownerKind'];
  readonly recertifyEveryMonths: 6 | 12;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
  readonly origin: SupportEngagement['origin'];
  readonly validFrom: string;
  readonly validTo?: string;
  readonly nextRecertificationAt: string;
  readonly recertificationDue: boolean;
  readonly endedReason?: string;
  readonly lastActivityAt?: string;
  readonly suspendedAt?: string;
  readonly lastConfirmedAt?: string;
  readonly lastConfirmedBy?: 'PERSON' | 'ORGANIZATION';
  readonly grants: readonly SupportGrant[];
}

/** `EngagementRequestViewDto`: `roleTemplateId` **y** `roleTemplateCode`, `parentAssignmentId`, nombres y fechas. */
export type SolicitudEnLaRed = Omit<SupportEngagementRequest, 'roleTemplate' | 'parentEngagementId'> & {
  readonly roleTemplateId: string;
  readonly roleTemplateCode: SupportEngagement['roleTemplate'];
  readonly parentAssignmentId?: string;
};

export function vistaVinculo(v: FilaVinculo): VinculoEnLaRed {
  const actividad = ultimaActividadDe(v.personName, v.tenantId);
  return {
    id: v.id,
    tenantId: v.tenantId,
    userId: v.userId,
    // Forma de cable de la API: `roleTemplateCode`. El cliente la traduce a `roleTemplate`.
    roleTemplateCode: v.roleTemplate,
    personName: v.personName,
    organizationName: TENANT_NAMES[v.tenantId] ?? 'Organización',
    ownerKind: v.ownerKind,
    recertifyEveryMonths: v.recertifyEveryMonths,
    // La API dice `REVOKED` a lo que la pantalla llama «terminado».
    status: v.status === 'ENDED' ? 'REVOKED' : v.status === 'PENDING' ? 'ACTIVE' : v.status,
    origin: v.origin,
    validFrom: v.validFrom,
    ...(v.validTo === undefined ? {} : { validTo: v.validTo }),
    nextRecertificationAt: v.nextRecertificationAt,
    recertificationDue: v.status === 'ACTIVE' && new Date(v.nextRecertificationAt).getTime() < Date.now(),
    ...(v.endedReason === undefined ? {} : { endedReason: v.endedReason }),
    ...(actividad === undefined ? {} : { lastActivityAt: actividad }),
    ...(v.suspendedAt === undefined ? {} : { suspendedAt: v.suspendedAt }),
    ...(v.lastConfirmedAt === undefined ? {} : { lastConfirmedAt: v.lastConfirmedAt }),
    ...(v.lastConfirmedBy === undefined ? {} : { lastConfirmedBy: v.lastConfirmedBy }),
    grants: permisos.filtrar((p) => p.engagementId === v.id && p.status === 'ACTIVE').map((p) => vistaPermiso(p, v.tenantId)),
  };
}

export function vistaSolicitud(r: FilaSolicitud): SolicitudEnLaRed {
  const catalogo = catalogoDe(r.tenantId);
  const { roleTemplate, parentEngagementId, ...resto } = r;
  return {
    ...resto,
    roleTemplateId: uuid(`plantilla-${roleTemplate}`),
    roleTemplateCode: roleTemplate,
    ...(parentEngagementId === undefined ? {} : { parentAssignmentId: parentEngagementId }),
    organizationName: TENANT_NAMES[r.tenantId] ?? 'Organización',
    items: r.items.map((item) => ({
      ...item,
      ...(catalogo.doctors.find((d) => d.id === item.practitionerRoleAssignmentId) === undefined
        ? {}
        : { practitionerName: catalogo.doctors.find((d) => d.id === item.practitionerRoleAssignmentId)!.name }),
      ...(catalogo.services.find((s) => s.id === item.healthcareServiceId) === undefined
        ? {}
        : { serviceName: catalogo.services.find((s) => s.id === item.healthcareServiceId)!.name }),
      ...(catalogo.locations.find((l) => l.id === (item.practiceSiteId ?? item.careSpaceId)) === undefined
        ? {}
        : { locationName: catalogo.locations.find((l) => l.id === (item.practiceSiteId ?? item.careSpaceId))!.name }),
    })),
  };
}

/* ---- bitácora ------------------------------------------------------------------ */

export function anotar(
  tenantId: string,
  actorName: string,
  action: string,
  summary: string,
  extras: { doctorId?: string; patientLabel?: string } = {},
): void {
  bitacora.agregar({ id: nuevoId('bitacora'), tenantId, occurredAt: ahora(), actorName, action, summary, ...extras });
}

/* ---- delegados ----------------------------------------------------------------- */

export function asegurarDelegado(engagementId: string, doctorId: string): FilaDelegado {
  const id = delegadoId(engagementId, doctorId);
  const actual = delegados.get(id);
  if (actual !== undefined && actual.status !== 'REVOKED') return actual;
  const nuevo: FilaDelegado = {
    id,
    engagementId,
    doctorId,
    status: 'PENDING_ACCEPTANCE',
    mayReplyOnBehalf: false,
    replyDisclosure: 'SHOW',
  };
  if (actual === undefined) delegados.agregar(nuevo);
  else delegados.agregar({ ...actual, status: 'PENDING_ACCEPTANCE', mayReplyOnBehalf: false });
  return delegados.get(id)!;
}

/** Busca la relación persona↔doctor por su id estable, existiera ya la fila o no. */
export function resolverDelegado(id: string): { engagement: FilaVinculo; doctor: DoctorSimulado; fila: FilaDelegado | undefined } | undefined {
  for (const engagement of vinculos.todos()) {
    for (const doctor of DOCTORES_POR_TENANT[engagement.tenantId] ?? []) {
      if (delegadoId(engagement.id, doctor.id) === id) {
        return { engagement, doctor, fila: delegados.get(id) };
      }
    }
  }
  return undefined;
}

/* ---- agenda -------------------------------------------------------------------- */

/**
 * Los doctores en el orden de la API, el mismo en la agenda combinada y en la bandeja: por
 * nombre sin acentos ni mayúsculas y, a igual nombre, por su perfil profesional. De ese
 * orden sale el color de cada doctor, así que tiene que ser idéntico en las dos pantallas.
 */
export function ordenarDoctores<T extends { readonly id: string; readonly name: string }>(tenantId: string, doctores: readonly T[]): T[] {
  const plano = (texto: string): string => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const perfil = (id: string): string => (DOCTORES_POR_TENANT[tenantId] ?? []).find((d) => d.id === id)?.practitionerProfileId ?? id;
  return [...doctores].sort((a, b) => plano(a.name).localeCompare(plano(b.name), 'es') || perfil(a.id).localeCompare(perfil(b.id)));
}

export function elegirLista(query: URLSearchParams, clave: string): readonly string[] {
  const valor = query.get(clave);
  return valor === null || valor === '' ? [] : valor.split(',').filter((s) => s !== '');
}

export function itemDeAgenda(
  fila: ReturnType<typeof agendaDePartida>[number],
  grants: readonly CoverageGrant[],
  catalogo: SupportCatalog,
): SupportAgendaItem {
  const ajuste = ajustesDeAgenda.get(fila.id);
  const status = ajuste?.status ?? fila.status;
  const locations = indexLocations(catalogo.locations);
  const contexto: AppointmentContext = {
    practitionerRoleAssignmentId: fila.doctorId,
    careSpaceId: fila.careSpaceId,
    healthcareServiceId: fila.healthcareServiceId,
  };
  const acciones = actionsFor(grants, contexto, locations);
  const puedeVer = acciones.includes('schedule.view');
  const libre = status === 'FREE';
  const lugar = catalogo.locations.find((l) => l.id === fila.careSpaceId);
  const servicio = catalogo.services.find((s) => s.id === fila.healthcareServiceId);
  const patientLabel = ajuste?.patientLabel ?? fila.patientLabel;
  const reasonLabel = ajuste?.reasonLabel ?? fila.reasonLabel;
  const esperas = puedeVer ? esperasDeApoyo.filtrar((e) => e.slotId === fila.id).length : 0;
  const veredicto = puedeVer ? null : evaluateAction(grants, contexto, 'schedule.view', locations, SUPPORT_ACTION_LABELS['schedule.view']);
  // Sin `schedule.view` un bloque sale **sin** `bookingId` ni `healthcareServiceId` (la API no nombra la cita ni el
  // servicio a quien no puede verla). La clave del bloque es local y estable: no sirve para actuar sobre nada.
  const reveladora = puedeVer || libre;
  // Un paciente reservado (con bandera de restricción) sale como bloque «Reservado»: ocupado, sin paciente ni acciones, con `RESERVED`.
  if (!libre && patientLabel !== undefined && esEtiquetaReservada(patientLabel)) {
    return { id: `bloque:${fila.id.slice(0, 8)}:${fila.start}`, kind: 'BOOKING', start: fila.start, end: fila.end, practitionerRoleAssignmentId: fila.doctorId, careSpaceId: fila.careSpaceId, careSpaceName: lugar?.name ?? '', serviceName: '', resourceId: recursoDeAgenda(fila.doctorId, fila.careSpaceId), status, allowedActions: [], denialReason: 'RESERVED' };
  }
  return {
    id: reveladora ? fila.id : `bloque:${fila.id.slice(0, 8)}:${fila.start}`,
    ...(puedeVer && !libre ? { bookingId: fila.id } : {}),
    kind: libre ? 'SLOT' : 'BOOKING',
    start: fila.start,
    end: fila.end,
    practitionerRoleAssignmentId: fila.doctorId,
    careSpaceId: fila.careSpaceId,
    careSpaceName: lugar?.name ?? '',
    ...(reveladora ? { healthcareServiceId: fila.healthcareServiceId } : {}),
    serviceName: reveladora ? (servicio?.name ?? '') : '',
    resourceId: recursoDeAgenda(fila.doctorId, fila.careSpaceId),
    status,
    ...(esperas === 0 ? {} : { waitlistCount: esperas }),
    ...(puedeVer && !libre && patientLabel !== undefined ? { patientLabel } : {}),
    ...(puedeVer && !libre && reasonLabel !== undefined ? { reasonLabel } : {}),
    allowedActions: acciones,
    ...(veredicto === null ? {} : { denialReason: veredicto.reason }),
  };
}

export function agendaDe(request: MockRequest): MockReply | SupportAgenda {
  const user = request.user;
  const org = request.query.get('tenantId') ?? request.query.get('org');
  if (user === null) return forbidden('Sin sesión.');
  if (org === null || CATALOGOS[org] === undefined) return notFound('Organización no encontrada.');
  const grants = permisosEfectivos(user.id, org);
  // Sin vínculo vigente (nunca lo tuvo, terminó, venció o está suspendido): el mismo 403 genérico. Con vínculo vivo
  // pero **sin ningún permiso de agenda** no es un 403: la lista llega vacía, porque la agenda solo muestra lo que se puede ver.
  if (vinculosActivosDe(user.id, org).length === 0) return denegadoGenerico();
  const catalogo = catalogoDe(org);
  const locations = indexLocations(catalogo.locations);
  const visibles = previewCoverage(grants, catalogo).doctors.map((c) => c.doctor);
  const visiblesIds = new Set(visibles.map((d) => d.id));

  const doctores = elegirLista(request.query, 'doctors');
  const servicios = elegirLista(request.query, 'services');
  const ubicaciones = elegirLista(request.query, 'locations');
  const desde = request.query.get('from') ?? '0000';
  const hasta = request.query.get('to') ?? '9999';

  const items = agendaDePartida()
    .filter(
      (f) =>
        f.tenantId === org &&
        visiblesIds.has(f.doctorId) &&
        f.start >= desde &&
        f.start <= hasta &&
        (doctores.length === 0 || doctores.includes(f.doctorId)) &&
        (servicios.length === 0 || servicios.includes(f.healthcareServiceId)) &&
        (ubicaciones.length === 0 || ubicaciones.some((id) => isWithin(locations.get(f.careSpaceId), locations.get(id)))),
    )
    .map((f) => itemDeAgenda(f, grants, catalogo))
    // Una cita sin NINGUNA acción de agenda permitida no sale ni como bloque (los horarios libres siguen el permiso de crear).
    .filter((i) => i.denialReason === 'RESERVED' || i.allowedActions.some((a) => a.startsWith('schedule.')));

  // Las opciones de filtro son las de lo que **sí** cubre: los lugares y servicios donde
  // alguna de sus filas le da acceso. Un doctor puede verse (atenuado) por otro de sus
  // lugares, pero su piso no entra al árbol de quien no lo cubre.
  const cubiertos = visibles.flatMap((d) =>
    d.placements.filter((p) => actionsFor(grants, { practitionerRoleAssignmentId: d.id, careSpaceId: p.careSpaceId, healthcareServiceId: p.healthcareServiceId }, locations).length > 0),
  );
  const espaciosVisibles = cubiertos.map((p) => locations.get(p.careSpaceId)).filter((n): n is LocationNode => n !== undefined);
  const serviciosVisibles = new Set(cubiertos.map((p) => p.healthcareServiceId));
  return {
    doctors: ordenarDoctores(org, visibles).map((d) => ({ id: d.id, name: d.name, specialty: d.specialty })),
    services: catalogo.services.filter((s) => serviciosVisibles.has(s.id)),
    locations: catalogo.locations.filter((n) => espaciosVisibles.some((espacio) => espacio.path.startsWith(n.path))),
    items,
  };
}

/** Verifica una acción sobre una fila de agenda del hospital; `null` si está permitida. */
export function negarSiNoPuede(user: MockUser | null, fila: NonNullable<ReturnType<typeof filaDeAgenda>>, accion: SupportActionCode): MockReply | null {
  if (user === null) return forbidden('Sin sesión.');
  const catalogo = catalogoDe(fila.tenantId);
  const veredicto = evaluateAction(
    permisosEfectivos(user.id, fila.tenantId),
    { practitionerRoleAssignmentId: fila.doctorId, careSpaceId: fila.careSpaceId, healthcareServiceId: fila.healthcareServiceId },
    accion,
    indexLocations(catalogo.locations),
    SUPPORT_ACTION_LABELS[accion],
  );
  // Un solo 403, el mismo para todo rechazo: la razón concreta (`denialReason`) vive en cada ítem de la agenda, no acá.
  return veredicto.allowed ? null : denegadoGenerico();
}

export function etiquetaDePaciente(pacienteId: string): string {
  const paciente = patientById(pacienteId);
  if (paciente === undefined) return 'Paciente';
  return `${paciente.displayName} · CI ***${paciente.nationalId.slice(-3)}`;
}

/* ---- consulta de acceso -------------------------------------------------------- */

export function contextosDeConsulta(catalogo: SupportCatalog, doctores: readonly DoctorSimulado[], tipo: string, id: string): readonly AppointmentContext[] {
  const locations = indexLocations(catalogo.locations);
  const todos = doctores.flatMap((d) => contextsOf(d));
  if (tipo === 'doctor') return todos.filter((c) => c.practitionerRoleAssignmentId === id);
  if (tipo === 'service') return todos.filter((c) => c.healthcareServiceId === id);
  return todos.filter((c) => isWithin(locations.get(c.careSpaceId), locations.get(id)));
}

/* ---- el registro de rutas ------------------------------------------------------ */

export const PLANTILLAS: readonly string[] = SUPPORT_ROLE_TEMPLATE_CODES;
export const ACCIONES: readonly string[] = SUPPORT_ACTION_CODES;

export function accionesValidas(valor: unknown): readonly SupportActionCode[] | null {
  if (!Array.isArray(valor) || valor.length === 0) return null;
  return valor.every((a) => typeof a === 'string' && ACCIONES.includes(a)) ? (valor as SupportActionCode[]) : null;
}

/** Que el objetivo traiga los identificadores que su tipo exige. */
export function objetivoValido(o: Partial<SupportScopeTarget>): boolean {
  if (o.targetKind === undefined || !(SUPPORT_TARGET_KINDS as readonly string[]).includes(o.targetKind)) return false;
  const doctor = o.practitionerRoleAssignmentId !== undefined;
  const servicio = o.healthcareServiceId !== undefined;
  const lugar = o.careSpaceId !== undefined || o.practiceSiteId !== undefined;
  switch (o.targetKind) {
    case 'PRACTITIONER':
      return doctor;
    case 'SERVICE':
      return servicio;
    case 'LOCATION':
      return lugar;
    case 'PRACTITIONER_SERVICE':
      return doctor && servicio;
    case 'PRACTITIONER_LOCATION':
      return doctor && lugar;
    case 'SERVICE_LOCATION':
      return servicio && lugar;
    default:
      return true;
  }
}

export function soloObjetivo(o: Partial<SupportScopeTarget>): SupportScopeTarget {
  return {
    targetKind: o.targetKind!,
    ...(o.practitionerRoleAssignmentId === undefined ? {} : { practitionerRoleAssignmentId: o.practitionerRoleAssignmentId }),
    ...(o.healthcareServiceId === undefined ? {} : { healthcareServiceId: o.healthcareServiceId }),
    ...(o.careSpaceId === undefined ? {} : { careSpaceId: o.careSpaceId }),
    ...(o.practiceSiteId === undefined ? {} : { practiceSiteId: o.practiceSiteId }),
  };
}

/** Crea el permiso y, si nombra a un doctor, deja pendiente su aceptación. */
export function otorgar(engagement: FilaVinculo, objetivo: SupportScopeTarget, acciones: readonly SupportActionCode[], expansionMode: 'DYNAMIC' | 'FIXED'): FilaPermiso {
  const fila: FilaPermiso = {
    id: nuevoId('permiso'),
    engagementId: engagement.id,
    ...objetivo,
    expansionMode,
    actions: acciones,
    status: 'ACTIVE',
  };
  permisos.agregar(fila);
  const doctorId = doctorDelPermiso(objetivo);
  if (doctorId !== undefined) asegurarDelegado(engagement.id, doctorId);
  return fila;
}


/**
 * Un código de invitación como el de la API: 24 bytes al azar en base64url (32
 * caracteres, 192 bits). **Distingue mayúsculas de minúsculas**; en la API solo se
 * guarda su huella.
 */
export function codigoDeInvitacion(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function invitacionVisible(
  fila: ReturnType<typeof invitaciones.todos>[number],
  conCodigo: boolean,
): Record<string, unknown> {
  const vencida = new Date(fila.expiresAt).getTime() < Date.now() && fila.status === 'ACTIVE';
  return {
    id: fila.id,
    kind: fila.kind,
    maxUses: fila.maxUses,
    usesCount: fila.usesCount,
    expiresAt: fila.expiresAt,
    ...(fila.roleTemplate === undefined ? {} : { roleTemplateCode: fila.roleTemplate }),
    // `AffiliationInvitationViewDto.status`: ACTIVE | EXHAUSTED | EXPIRED | REVOKED.
    status: vencida ? 'EXPIRED' : fila.status === 'USED' ? 'EXHAUSTED' : fila.status,
    createdAt: fila.createdAt,
    // El código en claro sólo sale en la respuesta de la emisión: la API guarda su huella.
    ...(conCodigo ? { code: fila.code } : {}),
  };
}

/**
 * Un integrante del equipo del doctor, con la forma de `SupportTeamMemberDto`: `status` para
 * el doctor (`PENDING_ACCEPTANCE | ACTIVE | REVOKED`) y `delegateStatus` con la delegación
 * tal cual (`ACTIVE | SUSPENDED | REVOKED | EXPIRED`); `roleTemplateCode` y `roleTemplate`.
 */
export function miembroDe(
  v: FilaVinculo,
  doctor: DoctorSimulado,
  fila: FilaDelegado | undefined,
  coverageSummary: string,
  actions: readonly SupportActionCode[],
  delegateStatus: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED' = fila?.status === 'REVOKED' ? 'REVOKED' : 'ACTIVE',
) {
  const ultima = ultimaActividadDe(v.personName, v.tenantId);
  const status = delegateStatus !== 'ACTIVE' ? 'REVOKED' : fila?.status === 'PENDING_ACCEPTANCE' ? 'PENDING_ACCEPTANCE' : 'ACTIVE';
  const aceptada = fila?.acceptedAt !== undefined || fila === undefined;
  return {
    delegateId: delegadoId(v.id, doctor.id),
    userId: v.userId,
    personName: v.personName,
    engagementId: v.id,
    practitionerRoleAssignmentId: doctor.id,
    tenantId: v.tenantId,
    organizationName: TENANT_NAMES[v.tenantId] ?? 'Organización',
    roleTemplateCode: v.roleTemplate,
    roleTemplate: v.roleTemplate,
    status,
    delegateStatus,
    accepted: aceptada,
    ...(fila?.acceptedAt === undefined ? {} : { acceptedAt: fila.acceptedAt }),
    mayReplyOnBehalf: fila?.mayReplyOnBehalf ?? false,
    replyDisclosure: fila?.replyDisclosure ?? 'SHOW',
    actions: [...actions],
    coverageSummary,
    ...(ultima === undefined ? {} : { lastActivityAt: ultima }),
    pendingClinicalRequests: accesosClinicos
      .filtrar((c) => c.doctorId === doctor.id && c.engagementId === v.id && c.status === 'PENDING')
      .map((c) => ({ requestId: c.id, patientLabel: c.patientLabel, reasonText: c.reasonText, requestedAt: c.requestedAt, requestedHours: c.requestedHours })),
  };
}

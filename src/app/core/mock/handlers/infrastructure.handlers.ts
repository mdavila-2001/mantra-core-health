import type {
  CareSpaceDetail,
  CareSpaceNode,
  ClinicalUnitNode,
  ImportRow,
  ImportRowError,
  ImportRowResult,
  RetireBlocker,
  SiteSummary,
  SpaceUnitAssignment,
} from '../../data-access/infrastructure/infrastructure.types';
import {
  descendientesDe,
  expandirPatron,
  MAX_ALTA_MASIVA,
  nombresDelAltaMasiva,
  tipologiaAdmite,
} from '../../data-access/infrastructure/infrastructure.rules';
import {
  CATALOGO_INFRAESTRUCTURA as CATALOGO,
  conceptoDe,
  CONTEO_DE_CAPACIDAD,
  existeCodigo,
  semillaDeCapacidad,
  semillaDeEspacios,
  semillaDeLicencias,
  semillaDeUnidades,
  SITIOS_INFRA,
  type CapacidadDeclaradaSimulada,
  type EspacioSimulado,
  type LicenciaSimulada,
  type SitioSimulado,
  type UnidadSimulada,
} from '../fixtures/infraestructura';
import { reply, noContent, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, isoDia, nuevoId } from '../mock-store';
import { casosFuturosEnQuirofano } from './procedures.handlers';
import { OPS_CATALOG } from '../fixtures/inpatient';

/* ============================================================================
    Infraestructura hospitalaria — franja F1 (§3 de `CONTRATO-F0-F1.md`).

    Lo que el simulador hace igual que la API, porque la pantalla depende de
    eso para verse bien:

    - **aislamiento por tenant**: un establecimiento o espacio de otro tenant
      responde 404, igual que uno inexistente (S6 no filtra existencia);
    - **escritura sólo para quien administra**: `SECURITY_ADMIN` o la persona
      dueña del tenant activo; el resto recibe 403;
    - **`If-Match`** en `PATCH`, `move` y `lifecycle`: 412 si el `rowVersion`
      no coincide;
    - **reglas**: padre→hijo, perfil de función, tipología, código único (409
      `SPACE_CODE_TAKEN`), ciclos (422 `SPACE_CYCLE`), padre no activo (422
      `PARENT_NOT_ACTIVE`), campos inmutables (422 `SPACE_IMMUTABLE_FIELD`),
      retiro bloqueado (409 `SPACE_RETIRE_BLOCKED` con la lista);
    - **recuentos derivados**: camas, hijos y capacidad real se cuentan de las
      filas; ninguno está escrito.
    ========================================================================== */

export const sitiosInfra = new Coleccion<SitioSimulado>(SITIOS_INFRA);
export const espacios = new Coleccion<EspacioSimulado>(semillaDeEspacios());
export const unidades = new Coleccion<UnidadSimulada>(semillaDeUnidades());
const licencias = new Coleccion<LicenciaSimulada>(semillaDeLicencias(isoDia));
const capacidades = new Coleccion<CapacidadDeclaradaSimulada>(semillaDeCapacidad());

interface AsignacionSimulada {
  readonly id: string;
  readonly siteId: string;
  readonly careSpaceId: string;
  readonly clinicalUnitId: string;
  readonly roleCode: string;
  readonly validFrom: string;
  readonly validTo: string | null;
}

const asignaciones = new Coleccion<AsignacionSimulada>([
  ...espacios
    .todos()
    .filter((e) => e.clinicalUnitId !== null)
    .map((e) => ({
      id: `asg-${e.id}`,
      siteId: e.siteId,
      careSpaceId: e.id,
      clinicalUnitId: e.clinicalUnitId!,
      roleCode: 'SPACE_UNIT_ROLE_OWNER',
      validFrom: e.createdAt,
      validTo: null,
    })),
  // La sala de tomografía la comparte Emergencias: el caso que justifica que
  // el vínculo sea N:M y con rol, y no una sola columna.
  ...espacios
    .filtrar((e) => e.code === 'IMG-TC')
    .map((e) => ({
      id: `asg-${e.id}-urg`,
      siteId: e.siteId,
      careSpaceId: e.id,
      clinicalUnitId: unidades.todos().find((u) => u.siteId === e.siteId && u.code === 'URG')!.id,
      roleCode: 'SPACE_UNIT_ROLE_SHARED',
      validFrom: e.createdAt,
      validTo: null,
    })),
]);

interface EventoSimulado {
  readonly id: string;
  readonly careSpaceId: string;
  readonly at: string;
  readonly action: string;
  readonly actorName: string | null;
  readonly reason: string | null;
  readonly summary: string;
  readonly rowVersion: number;
}

const historial = new Coleccion<EventoSimulado>(
  espacios.todos().map((e) => ({
    id: `hist-${e.id}-alta`,
    careSpaceId: e.id,
    at: e.createdAt,
    action: 'created',
    actorName: 'Carga inicial del establecimiento',
    reason: null,
    summary: `Alta de ${e.name} (${e.code}).`,
    rowVersion: 1,
  })),
);

/* ---- errores con el cuerpo común de DomainException ---------------------- */

let secuencia = 0;

/** Un error del formato común: `code` (tipo), `reason` (cuál), `correlationId`. */
function fallo(status: number, code: string, reason: string, message: string, details: Record<string, unknown> = {}): MockReply {
  secuencia += 1;
  return reply(status, {
    statusCode: status,
    code,
    reason,
    message,
    details: { ...details, reason },
    correlationId: `req-infra-${Date.now().toString(36)}-${secuencia}`,
    timestamp: new Date().toISOString(),
    path: '',
  });
}

const noEncontrado = (): MockReply => fallo(404, 'NOT_FOUND', 'NOT_FOUND', 'No encontrado');
const prohibido = (): MockReply =>
  fallo(403, 'FORBIDDEN', 'STRUCTURE_ADMIN_REQUIRED', 'Sólo quien administra la organización o la sucursal puede cambiar su estructura.');
const precondicion = (reason: string, message: string, details: Record<string, unknown> = {}): MockReply =>
  fallo(422, 'PRECONDITION_FAILED', reason, message, details);
const validacion = (violaciones: readonly string[]): MockReply =>
  fallo(422, 'VALIDATION_FAILED', 'VALIDATION_FAILED', 'Error de validación', { violations: violaciones });

/* ---- tenant, permisos y concurrencia -------------------------------------- */

function tenantDe(request: MockRequest): string | null {
  return request.headers.get('X-Tenant-Id');
}

/** El establecimiento, si existe **y** es del tenant activo. */
function sitioVisible(request: MockRequest, siteId: string | undefined): SitioSimulado | null {
  const sitio = siteId === undefined ? undefined : sitiosInfra.get(siteId);
  if (sitio === undefined) return null;
  const tenant = tenantDe(request);
  return tenant === null || tenant === sitio.tenantId ? sitio : null;
}

function espacioVisible(request: MockRequest, id: string | undefined): EspacioSimulado | null {
  const espacio = id === undefined ? undefined : espacios.get(id);
  if (espacio === undefined) return null;
  return sitioVisible(request, espacio.siteId) === null ? null : espacio;
}

/**
 * `SECURITY_ADMIN` o dueña del tenant: el reflejo simulado de §3. El simulador ya
 * no firma `ownTenantId` (TX-11); la organización propia es la primera de las
 * que trae la cuenta (para la médica, su consultorio).
 */
function puedeEscribir(request: MockRequest, sitio: SitioSimulado): boolean {
  const usuario = request.user;
  if (usuario === null) return false;
  return usuario.roles.includes('SECURITY_ADMIN') || usuario.tenants[0] === sitio.tenantId;
}

/** `If-Match` obligatorio y coincidente. */
function versionNoCoincide(request: MockRequest, rowVersion: number): MockReply | null {
  const enviada = request.headers.get('If-Match');
  if (enviada === null) {
    return fallo(428, 'PRECONDITION_FAILED', 'IF_MATCH_REQUIRED', 'Falta la cabecera If-Match.');
  }
  return Number(enviada.replace(/"/g, '')) === rowVersion
    ? null
    : fallo(412, 'CONCURRENCY_CONFLICT', 'ROW_VERSION_MISMATCH', 'Otra persona modificó este espacio mientras lo editabas. Recargá para ver la versión actual.', {
        currentRowVersion: rowVersion,
      });
}

/* ---- proyecciones ---------------------------------------------------------- */

const vivo = (e: EspacioSimulado): boolean => e.statusCode !== 'SPACE_RETIRED';

function hijosDe(id: string): EspacioSimulado[] {
  return espacios.filtrar((e) => e.parentId === id);
}

function nodo(e: EspacioSimulado): CareSpaceNode {
  return {
    id: e.id,
    parentId: e.parentId,
    code: e.code,
    name: e.name,
    form: conceptoDe(e.formCode),
    function: conceptoDe(e.functionCode),
    status: conceptoDe(e.statusCode),
    operationalStatus: conceptoDe(e.operationalStatusCode),
    clinicalUnitId: e.clinicalUnitId,
    capacity: e.capacity,
    rowVersion: e.rowVersion,
    childCount: hijosDe(e.id).filter(vivo).length,
  };
}

function vistaDeAsignacion(a: AsignacionSimulada): SpaceUnitAssignment {
  return {
    id: a.id,
    careSpaceId: a.careSpaceId,
    clinicalUnitId: a.clinicalUnitId,
    role: conceptoDe(a.roleCode),
    validFrom: a.validFrom,
    validTo: a.validTo,
  };
}

function camino(e: EspacioSimulado): CareSpaceDetail['path'] {
  const pasos: CareSpaceDetail['path'][number][] = [];
  let actual: EspacioSimulado | undefined = e;
  const vistos = new Set<string>();
  while (actual !== undefined && !vistos.has(actual.id)) {
    vistos.add(actual.id);
    pasos.unshift({ id: actual.id, code: actual.code, name: actual.name, form: conceptoDe(actual.formCode) });
    actual = actual.parentId === null ? undefined : espacios.get(actual.parentId);
  }
  return pasos;
}

function detalle(e: EspacioSimulado): CareSpaceDetail {
  const todos = espacios.filtrar((x) => x.siteId === e.siteId);
  const bajo = descendientesDe(todos, e.id);
  const camas = todos.filter((x) => (bajo.has(x.id) || x.id === e.id) && x.formCode === 'LOC_FORM_BED' && x.statusCode === 'SPACE_ACTIVE');
  return {
    ...nodo(e),
    siteId: e.siteId,
    description: e.description,
    floorNumber: e.floorNumber,
    areaM2: e.areaM2,
    asepsis: conceptoDe(e.asepsisCode),
    pressure: conceptoDe(e.pressureCode),
    airChangesPerHour: e.airChangesPerHour,
    hvacValidatedOn: e.hvacValidatedOn,
    sexRestriction: conceptoDe(e.sexRestrictionCode),
    ageGroup: conceptoDe(e.ageGroupCode),
    bedCategory: conceptoDe(e.bedCategoryCode),
    censable: e.censable,
    prepMinutes: e.prepMinutes,
    cleanupMinutes: e.cleanupMinutes,
    gln: e.gln,
    validFrom: e.validFrom,
    validTo: e.validTo,
    path: camino(e),
    children: hijosDe(e.id).map(nodo).sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true })),
    assignments: asignaciones.filtrar((a) => a.careSpaceId === e.id && a.validTo === null).map(vistaDeAsignacion),
    derived: {
      beds: camas.length,
      censableBeds: camas.filter((x) => x.censable === true).length,
      activeChildren: hijosDe(e.id).filter((x) => x.statusCode === 'SPACE_ACTIVE').length,
    },
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

function vistaDeUnidad(u: UnidadSimulada): ClinicalUnitNode {
  return {
    id: u.id,
    parentId: u.parentId,
    code: u.code,
    name: u.name,
    type: conceptoDe(u.typeCode),
    status: conceptoDe(u.statusCode),
    description: u.description,
    responsibleUserId: u.responsibleUserId,
    validFrom: u.validFrom,
    validTo: u.validTo,
    rowVersion: u.rowVersion,
  };
}

function resumenDeSitio(s: SitioSimulado): SiteSummary {
  return {
    id: s.id,
    practiceId: s.practiceId,
    branchId: s.branchId,
    code: s.code,
    name: s.name,
    status: { code: 'SITE_ACTIVE', display: 'Activa' },
    timeZone: s.timeZone,
    regulatory: {
      snisCode: s.snisCode,
      subsector: conceptoDe(s.subsectorCode),
      careLevel: conceptoDe(s.careLevelCode),
      typology: conceptoDe(s.typologyCode),
      managingEntityName: s.managingEntityName,
      healthNetworkName: s.healthNetworkName,
      sedes: conceptoDe(s.sedesCode),
      municipalityName: s.municipalityName,
    },
    rowVersion: s.rowVersion,
  };
}

function registrar(e: EspacioSimulado, action: string, summary: string, request: MockRequest, reason: string | null = null): void {
  historial.agregar({
    id: nuevoId('hist'),
    careSpaceId: e.id,
    at: ahora(),
    action,
    actorName: request.user?.displayName ?? null,
    reason,
    summary,
    rowVersion: e.rowVersion,
  });
}

/* ---- validación de alta (compartida por alta, masiva e importación) ------ */

interface AltaPropuesta {
  readonly code: string;
  readonly name: string;
  readonly formCode: string;
  readonly functionCode: string;
  readonly parentId: string | null;
}

interface PadreConocido {
  readonly formCode: string;
  readonly statusCode: string;
}

/**
 * Las reglas de alta, como lista de `{field, reason}`.
 *
 * `padre` se pasa resuelto porque en la importación puede ser una fila
 * anterior del mismo archivo, que todavía no está en la colección.
 */
function erroresDeAlta(
  sitio: SitioSimulado,
  alta: AltaPropuesta,
  padre: PadreConocido | null,
  codigosOcupados: ReadonlySet<string>,
): ImportRowError[] {
  const errores: ImportRowError[] = [];
  if (!alta.code.trim()) errores.push({ field: 'code', reason: 'REQUIRED' });
  if (!alta.name.trim()) errores.push({ field: 'name', reason: 'REQUIRED' });
  if (alta.code.trim() && codigosOcupados.has(alta.code.trim().toUpperCase())) {
    errores.push({ field: 'code', reason: 'SPACE_CODE_TAKEN' });
  }
  if (!existeCodigo(alta.formCode, CATALOGO.forms)) {
    errores.push({ field: 'formCode', reason: 'UNKNOWN_FORM' });
    return errores;
  }
  const perfil = CATALOGO.functions.find((f) => f.code === alta.functionCode);
  if (perfil === undefined) {
    errores.push({ field: 'functionCode', reason: 'UNKNOWN_FUNCTION' });
  } else if (!perfil.forms.includes(alta.formCode)) {
    errores.push({ field: 'functionCode', reason: 'FUNCTION_FORM_MISMATCH' });
  } else if (!tipologiaAdmite(CATALOGO, sitio.typologyCode, alta.functionCode)) {
    errores.push({ field: 'functionCode', reason: 'TYPOLOGY_NOT_ALLOWED' });
  }
  const formaDelPadre = padre?.formCode ?? null;
  if (alta.parentId !== null && padre === null) {
    errores.push({ field: 'parentCode', reason: 'PARENT_NOT_FOUND' });
  } else if (!CATALOGO.parentRules.some((r) => r.parent === formaDelPadre && r.child === alta.formCode)) {
    errores.push({ field: 'parentCode', reason: 'SPACE_PARENT_RULE' });
  } else if (padre !== null && padre.statusCode !== 'SPACE_ACTIVE' && padre.statusCode !== 'SPACE_PLANNED') {
    errores.push({ field: 'parentCode', reason: 'PARENT_NOT_ACTIVE' });
  }
  return errores;
}

const MENSAJE_DE_ERROR: Readonly<Record<string, string>> = {
  REQUIRED: 'Es obligatorio.',
  SPACE_CODE_TAKEN: 'Ya hay un espacio con ese código en el establecimiento.',
  UNKNOWN_FORM: 'La forma no existe en el catálogo.',
  UNKNOWN_FUNCTION: 'La función no existe en el catálogo.',
  FUNCTION_FORM_MISMATCH: 'Esa función no admite esa forma.',
  TYPOLOGY_NOT_ALLOWED: 'La tipología del establecimiento no admite esa función.',
  PARENT_NOT_FOUND: 'El padre no existe en el establecimiento.',
  SPACE_PARENT_RULE: 'Esa forma no puede colgar de ese padre.',
  PARENT_NOT_ACTIVE: 'El padre está suspendido o retirado.',
};

/** El primer error de alta como respuesta HTTP. Código ocupado es 409; el resto, 422. */
function respuestaDeAlta(errores: readonly ImportRowError[]): MockReply {
  const primero = errores[0]!;
  if (primero.reason === 'REQUIRED') {
    return validacion(errores.filter((e) => e.reason === 'REQUIRED').map((e) => `${e.field} should not be empty`));
  }
  const mensaje = MENSAJE_DE_ERROR[primero.reason] ?? primero.reason;
  return primero.reason === 'SPACE_CODE_TAKEN'
    ? fallo(409, 'CONFLICT', 'SPACE_CODE_TAKEN', mensaje, { field: primero.field })
    : precondicion(primero.reason, mensaje, { field: primero.field });
}

function codigosDe(siteId: string): Set<string> {
  // Código inmutable y nunca reutilizado (§1.1): los retirados también ocupan.
  return new Set(espacios.filtrar((e) => e.siteId === siteId).map((e) => e.code.toUpperCase()));
}

type Atributos = Pick<EspacioSimulado,
  'description' | 'capacity' | 'floorNumber' | 'areaM2' | 'asepsisCode' | 'pressureCode' | 'airChangesPerHour' |
  'hvacValidatedOn' | 'sexRestrictionCode' | 'ageGroupCode' | 'bedCategoryCode' | 'censable' | 'prepMinutes' |
  'cleanupMinutes' | 'gln' | 'clinicalUnitId'>;

const CLAVES_DE_ATRIBUTO: readonly (keyof Atributos)[] = [
  'description', 'capacity', 'floorNumber', 'areaM2', 'asepsisCode', 'pressureCode', 'airChangesPerHour',
  'hvacValidatedOn', 'sexRestrictionCode', 'ageGroupCode', 'bedCategoryCode', 'censable', 'prepMinutes',
  'cleanupMinutes', 'gln', 'clinicalUnitId',
];

function atributosDe(origen: Record<string, unknown>, sitio: SitioSimulado): { atributos: Partial<Atributos>; error: MockReply | null } {
  const atributos: Record<string, unknown> = {};
  for (const clave of CLAVES_DE_ATRIBUTO) {
    if (clave in origen) atributos[clave] = origen[clave] === '' ? null : origen[clave];
  }
  const familias: readonly [keyof Atributos, readonly { code: string }[]][] = [
    ['asepsisCode', CATALOGO.attributes.asepsis],
    ['pressureCode', CATALOGO.attributes.pressure],
    ['sexRestrictionCode', CATALOGO.attributes.sex],
    ['ageGroupCode', CATALOGO.attributes.ageGroup],
    ['bedCategoryCode', CATALOGO.attributes.bedCategory],
  ];
  for (const [clave, familia] of familias) {
    const valor = atributos[clave];
    if (typeof valor === 'string' && !familia.some((k) => k.code === valor)) {
      return { atributos: {}, error: validacion([`${clave} must be one of the catalog codes`]) };
    }
  }
  for (const clave of ['capacity', 'floorNumber', 'areaM2', 'airChangesPerHour', 'prepMinutes', 'cleanupMinutes'] as const) {
    const valor = atributos[clave];
    if (valor !== undefined && valor !== null && (typeof valor !== 'number' || !Number.isFinite(valor) || (clave !== 'floorNumber' && valor < 0))) {
      return { atributos: {}, error: validacion([`${clave} must be a positive number`]) };
    }
  }
  const unidad = atributos['clinicalUnitId'];
  if (typeof unidad === 'string' && !unidades.filtrar((u) => u.siteId === sitio.id).some((u) => u.id === unidad)) {
    return { atributos: {}, error: precondicion('UNIT_NOT_FOUND', 'La unidad no es de este establecimiento.', { field: 'clinicalUnitId' }) };
  }
  if (typeof atributos['gln'] === 'string' && !/^\d{13}$/.test(atributos['gln'])) {
    return { atributos: {}, error: validacion(['gln must be 13 digits']) };
  }
  return { atributos: atributos as Partial<Atributos>, error: null };
}

function nuevoEspacio(sitio: SitioSimulado, alta: AltaPropuesta, atributos: Partial<Atributos>, activo: boolean): EspacioSimulado {
  const instante = ahora();
  const perfil = CATALOGO.functions.find((f) => f.code === alta.functionCode);
  return {
    id: nuevoId('space'),
    siteId: sitio.id,
    tenantId: sitio.tenantId,
    parentId: alta.parentId,
    code: alta.code.trim(),
    name: alta.name.trim(),
    formCode: alta.formCode,
    functionCode: alta.functionCode,
    statusCode: activo ? 'SPACE_ACTIVE' : 'SPACE_PLANNED',
    operationalStatusCode: alta.formCode === 'LOC_FORM_BED' || alta.formCode === 'LOC_FORM_ROOM' ? 'SPACE_OP_AVAILABLE' : null,
    clinicalUnitId: null,
    capacity: null,
    description: null,
    floorNumber: null,
    areaM2: null,
    asepsisCode: null,
    pressureCode: null,
    airChangesPerHour: null,
    hvacValidatedOn: null,
    sexRestrictionCode: null,
    ageGroupCode: null,
    bedCategoryCode: null,
    // Una cama nace censable si su función interna lo es, salvo que se diga otra cosa.
    censable: alta.formCode === 'LOC_FORM_BED' ? (perfil?.inpatient ?? false) : null,
    prepMinutes: null,
    cleanupMinutes: null,
    gln: null,
    validFrom: instante,
    validTo: null,
    createdAt: instante,
    updatedAt: instante,
    rowVersion: 1,
    ...atributos,
  };
}

function vincularDueña(e: EspacioSimulado): void {
  if (e.clinicalUnitId === null) return;
  asignaciones.agregar({
    id: nuevoId('asg'),
    siteId: e.siteId,
    careSpaceId: e.id,
    clinicalUnitId: e.clinicalUnitId,
    roleCode: 'SPACE_UNIT_ROLE_OWNER',
    validFrom: e.createdAt,
    validTo: null,
  });
}

/* ---- bloqueos de retiro ---------------------------------------------------- */

function bloqueosDe(e: EspacioSimulado): RetireBlocker[] {
  const bloqueos: RetireBlocker[] = [];
  const hijos = hijosDe(e.id).filter(vivo);
  const detalleDe = `/administration/medical-organization/spaces/${e.id}`;
  if (hijos.length > 0) {
    bloqueos.push({ kind: 'ACTIVE_CHILDREN', count: hijos.length, sampleIds: hijos.slice(0, 3).map((h) => h.id), nextAction: { label: 'Retirar o mover los espacios hijos', route: `${detalleDe}?tab=children` } });
  }
  if (e.occupied === true) {
    bloqueos.push({ kind: 'ACTIVE_ENCOUNTER', count: 1, sampleIds: [], nextAction: { label: 'Dar el alta o trasladar al paciente internado' } });
  }
  const cirugias = casosFuturosEnQuirofano(e.id);
  if (cirugias.length > 0) {
    bloqueos.push({ kind: 'FUTURE_PROCEDURE', count: cirugias.length, sampleIds: cirugias.slice(0, 3), nextAction: { label: 'Reprogramar las intervenciones en otro quirófano', route: '/interventions' } });
  }
  if ((e.futureBookings ?? 0) > 0) {
    bloqueos.push({ kind: 'FUTURE_BOOKING', count: e.futureBookings!, sampleIds: [], nextAction: { label: 'Reubicar las citas futuras', route: '/schedule' } });
  }
  if (e.schedulableResource === true) {
    bloqueos.push({ kind: 'SCHEDULABLE_RESOURCE', count: 1, sampleIds: [], nextAction: { label: 'Dar de baja el recurso de agenda del espacio', route: '/schedule' } });
  }
  if (e.stock === true) {
    bloqueos.push({ kind: 'INVENTORY_LOCATION', count: 1, sampleIds: [], nextAction: { label: 'Trasladar el stock a otro depósito' } });
  }
  if ((e.equipment ?? 0) > 0) {
    bloqueos.push({ kind: 'EQUIPMENT', count: e.equipment!, sampleIds: [], nextAction: { label: 'Reubicar o dar de baja los equipos instalados' } });
  }
  return bloqueos;
}

/* ---- capacidad ------------------------------------------------------------- */

function capacidadDerivada(siteId: string): { kindCode: string; quantity: number }[] {
  const activos = espacios.filtrar((e) => e.siteId === siteId && e.statusCode === 'SPACE_ACTIVE');
  return Object.entries(CONTEO_DE_CAPACIDAD).map(([kindCode, regla]) => ({
    kindCode,
    quantity: activos.filter(
      (e) => regla.funciones.includes(e.functionCode) && (regla.censable === undefined || (e.censable === true) === regla.censable),
    ).length,
  }));
}

function vistaDeLicencia(l: LicenciaSimulada) {
  // «Vencida» se calcula al leer (§3), no se guarda: el día que vence nadie
  // tiene que acordarse de cambiarle el estado.
  const vencida = l.expiresOn !== null && l.expiresOn < isoDia(0) && l.statusCode === 'LIC_VALID';
  const { tenantId: _t, statusCode, ...resto } = l;
  return { ...resto, status: conceptoDe(vencida ? 'LIC_EXPIRED' : statusCode) };
}

/* ---- consola de la organización (lectura vieja, ahora coherente) ---------- */

/**
 * Las tres listas de infraestructura de `GET /practices/:id/organization`,
 * **derivadas** de lo que siembra F1: recuentos contados, `branchId` real y
 * códigos de estado que la consola sabe pintar.
 */
export function infraestructuraDeLaConsola(practiceId: string) {
  const sitios = sitiosInfra.filtrar((s) => s.practiceId === practiceId);
  const ids = new Set(sitios.map((s) => s.id));
  const espaciosVivos = espacios.filtrar((e) => ids.has(e.siteId) && vivo(e));
  const unidadesVivas = unidades.filtrar((u) => ids.has(u.siteId) && u.statusCode !== 'UNIT_RETIRED');
  return {
    sites: sitios.map((s, i) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      type: i === 0 ? { code: 'SITE_TYPE_MAIN', display: 'Sede principal' } : { code: 'SITE_TYPE_BRANCH', display: 'Sucursal' },
      physicalType: { code: 'SITE_PHYS_BUILDING', display: 'Edificio' },
      operationalStatus: { code: 'SITE_OP_OPEN', display: 'Operativa' },
      status: { code: 'SITE_ACTIVE', display: 'Activa' },
      timeZone: s.timeZone,
      branchId: s.branchId,
      clinicalUnitCount: unidadesVivas.filter((u) => u.siteId === s.id).length,
      careSpaceCount: espaciosVivos.filter((e) => e.siteId === s.id).length,
    })),
    clinicalUnits: unidadesVivas.map((u) => ({
      id: u.id,
      siteId: u.siteId,
      parentUnitId: u.parentId,
      code: u.code,
      name: u.name,
      type: conceptoDe(u.typeCode),
      serviceMode: null,
      status: conceptoDe(u.statusCode),
    })),
    careSpaces: espaciosVivos.map((e) => ({
      id: e.id,
      siteId: e.siteId,
      clinicalUnitId: e.clinicalUnitId,
      parentSpaceId: e.parentId,
      code: e.code,
      name: e.name,
      type: conceptoDe(e.functionCode),
      capacity: e.capacity,
      operationalStatus: conceptoDe(e.operationalStatusCode),
      status: conceptoDe(e.statusCode),
    })),
  };
}

/** El tenant de una práctica, según sus establecimientos. */
export function tenantDePractica(practiceId: string): string | null {
  return sitiosInfra.todos().find((s) => s.practiceId === practiceId)?.tenantId ?? null;
}

/* ---- rutas ----------------------------------------------------------------- */

export function registrarInfraestructura(router: MockRouter): void {
  // F2 suma sus ejes, motivos y el mapa v2-0116 al mismo catálogo (§F2.3).
  router.get('/practice/infrastructure-catalog', () => ({ ...CATALOGO, ...OPS_CATALOG }));

  router.get('/sites/:siteId/structure', (request) => {
    const sitio = sitioVisible(request, request.params['siteId']);
    if (sitio === null) return noEncontrado();
    return {
      site: resumenDeSitio(sitio),
      spaces: espacios.filtrar((e) => e.siteId === sitio.id).map(nodo),
      units: unidades.filtrar((u) => u.siteId === sitio.id).map(vistaDeUnidad),
      assignments: asignaciones.filtrar((a) => a.siteId === sitio.id && a.validTo === null).map(vistaDeAsignacion),
      asOf: new Date().toISOString(),
    };
  });

  router.get('/care-spaces/:id', (request) => {
    const espacio = espacioVisible(request, request.params['id']);
    return espacio === null ? noEncontrado() : detalle(espacio);
  });

  router.get('/care-spaces/:id/history', (request) => {
    const espacio = espacioVisible(request, request.params['id']);
    if (espacio === null) return noEncontrado();
    return historial
      .filtrar((h) => h.careSpaceId === espacio.id)
      .sort((a, b) => b.at.localeCompare(a.at))
      .map(({ careSpaceId: _c, ...resto }) => resto);
  });

  router.post('/sites/:siteId/care-spaces', (request) => {
    const sitio = sitioVisible(request, request.params['siteId']);
    if (sitio === null) return noEncontrado();
    if (!puedeEscribir(request, sitio)) return prohibido();
    const datos = cuerpo<Record<string, unknown>>(request) as Record<string, unknown>;
    const parentId = typeof datos['parentSpaceId'] === 'string' && datos['parentSpaceId'] !== '' ? datos['parentSpaceId'] : null;
    const padre = parentId === null ? null : (espacios.get(parentId) ?? null);
    const alta: AltaPropuesta = {
      code: String(datos['code'] ?? ''),
      name: String(datos['name'] ?? ''),
      formCode: String(datos['formCode'] ?? ''),
      functionCode: String(datos['functionCode'] ?? ''),
      parentId,
    };
    const padreDelSitio = padre !== null && padre.siteId === sitio.id ? padre : null;
    const errores = erroresDeAlta(sitio, alta, padreDelSitio, codigosDe(sitio.id));
    if (errores.length > 0) return respuestaDeAlta(errores);
    const { atributos, error } = atributosDe(datos, sitio);
    if (error !== null) return error;
    const creado = espacios.agregar(nuevoEspacio(sitio, alta, atributos, datos['activate'] === true));
    vincularDueña(creado);
    registrar(creado, 'created', `Alta de ${creado.name} (${creado.code}).`, request);
    return reply(201, detalle(creado));
  });

  router.post('/sites/:siteId/care-spaces/bulk', (request) => {
    const sitio = sitioVisible(request, request.params['siteId']);
    if (sitio === null) return noEncontrado();
    if (!puedeEscribir(request, sitio)) return prohibido();
    const datos = cuerpo<Record<string, unknown>>(request) as Record<string, unknown>;
    const codigos = expandirPatron(String(datos['codePattern'] ?? ''));
    if (!codigos.ok) return precondicion('BULK_PATTERN_INVALID', codigos.error, { field: 'codePattern' });
    if (codigos.valores.length > MAX_ALTA_MASIVA) return precondicion('BULK_TOO_MANY', `Máximo ${MAX_ALTA_MASIVA}.`);
    const nombres = nombresDelAltaMasiva(String(datos['codePattern']), String(datos['namePattern'] ?? ''));
    if (!nombres.ok) return precondicion('BULK_PATTERN_INVALID', nombres.error, { field: 'namePattern' });
    const parentId = String(datos['parentSpaceId'] ?? '');
    const padre = espacios.get(parentId);
    const padreDelSitio = padre !== undefined && padre.siteId === sitio.id ? padre : null;
    const ocupados = codigosDe(sitio.id);
    // Todo o nada: se valida cada uno antes de escribir el primero.
    for (const [i, code] of codigos.valores.entries()) {
      const errores = erroresDeAlta(
        sitio,
        { code, name: nombres.valores[i]!, formCode: String(datos['formCode'] ?? ''), functionCode: String(datos['functionCode'] ?? ''), parentId },
        padreDelSitio,
        ocupados,
      );
      if (errores.length > 0) return respuestaDeAlta(errores);
      ocupados.add(code.toUpperCase());
    }
    const { atributos, error } = atributosDe(datos, sitio);
    if (error !== null) return error;
    const creados = codigos.valores.map((code, i) => {
      const creado = espacios.agregar(
        nuevoEspacio(sitio, { code, name: nombres.valores[i]!, formCode: String(datos['formCode']), functionCode: String(datos['functionCode']), parentId }, atributos, false),
      );
      vincularDueña(creado);
      registrar(creado, 'created', `Alta masiva: ${creado.name} (${creado.code}).`, request);
      return creado;
    });
    return reply(201, { created: creados.map(detalle) });
  });

  router.post('/sites/:siteId/care-spaces/import', (request) => {
    const sitio = sitioVisible(request, request.params['siteId']);
    if (sitio === null) return noEncontrado();
    if (!puedeEscribir(request, sitio)) return prohibido();
    const dryRun = request.query.get('dryRun') !== 'false';
    const filas = (cuerpo<{ rows: ImportRow[] }>(request).rows ?? []) as ImportRow[];
    if (filas.length === 0) return validacion(['rows should not be empty']);
    if (filas.length > MAX_ALTA_MASIVA) return precondicion('IMPORT_TOO_MANY', `Máximo ${MAX_ALTA_MASIVA} filas por importación.`);

    const existentes = new Map(espacios.filtrar((e) => e.siteId === sitio.id).map((e) => [e.code.toUpperCase(), e] as const));
    const delArchivo = new Map<string, { formCode: string; statusCode: string }>();
    const ocupados = codigosDe(sitio.id);
    const resultados: ImportRowResult[] = filas.map((fila) => {
      const codigoPadre = fila.parentCode?.trim().toUpperCase() ?? null;
      const padre: PadreConocido | null =
        codigoPadre === null || codigoPadre === ''
          ? null
          : (existentes.get(codigoPadre) ?? delArchivo.get(codigoPadre) ?? null);
      const errores = erroresDeAlta(
        sitio,
        { code: fila.code ?? '', name: fila.name ?? '', formCode: fila.formCode ?? '', functionCode: fila.functionCode ?? '', parentId: codigoPadre || null },
        padre,
        ocupados,
      ).map((e) => ({ field: e.field, reason: MENSAJE_DE_ERROR[e.reason] ?? e.reason }));
      const atributos = atributosDe(fila as unknown as Record<string, unknown>, sitio);
      if (atributos.error !== null) errores.push({ field: 'atributos', reason: 'Algún atributo no es válido.' });
      if (errores.length === 0) {
        ocupados.add(fila.code.trim().toUpperCase());
        delArchivo.set(fila.code.trim().toUpperCase(), { formCode: fila.formCode, statusCode: 'SPACE_PLANNED' });
      }
      return { line: fila.line, status: errores.length === 0 ? 'ok' : 'error', errors: errores };
    });
    const ok = resultados.every((r) => r.status === 'ok');
    if (dryRun || !ok) return { ok, rows: resultados };

    const creadosPorCodigo = new Map<string, EspacioSimulado>();
    for (const fila of filas) {
      const codigoPadre = fila.parentCode?.trim().toUpperCase() ?? '';
      const padre = codigoPadre === '' ? null : (creadosPorCodigo.get(codigoPadre) ?? existentes.get(codigoPadre) ?? null);
      const { atributos } = atributosDe(fila as unknown as Record<string, unknown>, sitio);
      const creado = espacios.agregar(
        nuevoEspacio(sitio, { code: fila.code, name: fila.name, formCode: fila.formCode, functionCode: fila.functionCode, parentId: padre?.id ?? null }, atributos, false),
      );
      vincularDueña(creado);
      registrar(creado, 'created', `Importación CSV (línea ${fila.line}): ${creado.name}.`, request);
      creadosPorCodigo.set(creado.code.toUpperCase(), creado);
    }
    return { ok: true, rows: resultados, created: creadosPorCodigo.size };
  });

  router.patch('/care-spaces/:id', (request) => {
    const espacio = espacioVisible(request, request.params['id']);
    if (espacio === null) return noEncontrado();
    const sitio = sitiosInfra.get(espacio.siteId)!;
    if (!puedeEscribir(request, sitio)) return prohibido();
    const conflicto = versionNoCoincide(request, espacio.rowVersion);
    if (conflicto !== null) return conflicto;
    const datos = cuerpo<Record<string, unknown>>(request) as Record<string, unknown>;
    const cambios: { -readonly [K in keyof EspacioSimulado]?: EspacioSimulado[K] } = {};

    const codigo = typeof datos['code'] === 'string' ? datos['code'].trim() : undefined;
    const forma = typeof datos['formCode'] === 'string' ? datos['formCode'] : undefined;
    const activo = espacio.statusCode !== 'SPACE_PLANNED';
    if ((codigo !== undefined && codigo !== espacio.code) || (forma !== undefined && forma !== espacio.formCode)) {
      if (activo) {
        return precondicion('SPACE_IMMUTABLE_FIELD', 'El código y la forma no se cambian una vez que el espacio estuvo activo.', {
          field: codigo !== undefined && codigo !== espacio.code ? 'code' : 'formCode',
        });
      }
      if (codigo !== undefined && codigo !== espacio.code) {
        if (codigosDe(espacio.siteId).has(codigo.toUpperCase())) {
          return fallo(409, 'CONFLICT', 'SPACE_CODE_TAKEN', MENSAJE_DE_ERROR['SPACE_CODE_TAKEN']!, { field: 'code' });
        }
        cambios.code = codigo;
      }
      if (forma !== undefined) cambios.formCode = forma;
    }
    if (typeof datos['name'] === 'string') {
      if (datos['name'].trim() === '') return validacion(['name should not be empty']);
      cambios.name = datos['name'].trim();
    }
    if (typeof datos['functionCode'] === 'string') cambios.functionCode = datos['functionCode'];
    const formaFinal = cambios.formCode ?? espacio.formCode;
    const funcionFinal = cambios.functionCode ?? espacio.functionCode;
    const perfil = CATALOGO.functions.find((f) => f.code === funcionFinal);
    if (perfil === undefined || !perfil.forms.includes(formaFinal)) {
      return precondicion('FUNCTION_FORM_MISMATCH', MENSAJE_DE_ERROR['FUNCTION_FORM_MISMATCH']!, { field: 'functionCode' });
    }
    if (!tipologiaAdmite(CATALOGO, sitio.typologyCode, funcionFinal)) {
      return precondicion('TYPOLOGY_NOT_ALLOWED', MENSAJE_DE_ERROR['TYPOLOGY_NOT_ALLOWED']!, { field: 'functionCode' });
    }
    const { atributos, error } = atributosDe(datos, sitio);
    if (error !== null) return error;
    const unidadAnterior = espacio.clinicalUnitId;
    const actualizado = espacios.actualizar(espacio.id, {
      ...cambios,
      ...atributos,
      rowVersion: espacio.rowVersion + 1,
      updatedAt: ahora(),
    })!;
    if ('clinicalUnitId' in atributos && atributos.clinicalUnitId !== unidadAnterior) {
      for (const a of asignaciones.filtrar((x) => x.careSpaceId === espacio.id && x.roleCode === 'SPACE_UNIT_ROLE_OWNER' && x.validTo === null)) {
        asignaciones.actualizar(a.id, { validTo: ahora() });
      }
      vincularDueña(actualizado);
    }
    registrar(actualizado, 'updated', `Edición: ${Object.keys({ ...cambios, ...atributos }).join(', ') || 'sin cambios'}.`, request);
    return detalle(actualizado);
  });

  router.post('/care-spaces/:id/move', (request) => {
    const espacio = espacioVisible(request, request.params['id']);
    if (espacio === null) return noEncontrado();
    const sitio = sitiosInfra.get(espacio.siteId)!;
    if (!puedeEscribir(request, sitio)) return prohibido();
    const conflicto = versionNoCoincide(request, espacio.rowVersion);
    if (conflicto !== null) return conflicto;
    const destino = cuerpo<{ parentSpaceId: string | null }>(request).parentSpaceId ?? null;
    const padre = destino === null ? null : (espacios.get(destino) ?? null);
    if (destino !== null && (padre === null || padre.siteId !== espacio.siteId)) {
      return precondicion('PARENT_NOT_FOUND', MENSAJE_DE_ERROR['PARENT_NOT_FOUND']!, { field: 'parentSpaceId' });
    }
    if (destino !== null && (destino === espacio.id || descendientesDe(espacios.filtrar((e) => e.siteId === espacio.siteId), espacio.id).has(destino))) {
      return precondicion('SPACE_CYCLE', 'No se puede mover un espacio dentro de sí mismo o de uno de sus hijos.', { field: 'parentSpaceId' });
    }
    const formaDelPadre = padre?.formCode ?? null;
    if (!CATALOGO.parentRules.some((r) => r.parent === formaDelPadre && r.child === espacio.formCode)) {
      return precondicion('SPACE_PARENT_RULE', MENSAJE_DE_ERROR['SPACE_PARENT_RULE']!, { field: 'parentSpaceId' });
    }
    if (padre !== null && !vivo(padre)) {
      return precondicion('PARENT_NOT_ACTIVE', MENSAJE_DE_ERROR['PARENT_NOT_ACTIVE']!, { field: 'parentSpaceId' });
    }
    const anterior = espacio.parentId === null ? 'la raíz' : (espacios.get(espacio.parentId)?.name ?? 'otro padre');
    const movido = espacios.actualizar(espacio.id, { parentId: destino, rowVersion: espacio.rowVersion + 1, updatedAt: ahora() })!;
    registrar(movido, 'moved', `Movido de ${anterior} a ${padre?.name ?? 'la raíz'}.`, request);
    return detalle(movido);
  });

  router.get('/care-spaces/:id/retire-check', (request) => {
    const espacio = espacioVisible(request, request.params['id']);
    return espacio === null ? noEncontrado() : { blockers: bloqueosDe(espacio) };
  });

  router.post('/care-spaces/:id/lifecycle', (request) => {
    const espacio = espacioVisible(request, request.params['id']);
    if (espacio === null) return noEncontrado();
    const sitio = sitiosInfra.get(espacio.siteId)!;
    if (!puedeEscribir(request, sitio)) return prohibido();
    const conflicto = versionNoCoincide(request, espacio.rowVersion);
    if (conflicto !== null) return conflicto;
    const { action, reason } = cuerpo<{ action: string; reason?: string }>(request);
    const motivo = typeof reason === 'string' ? reason.trim() : '';
    const transiciones: Readonly<Record<string, { desde: readonly string[]; hacia: string; motivo: boolean }>> = {
      activate: { desde: ['SPACE_PLANNED'], hacia: 'SPACE_ACTIVE', motivo: false },
      suspend: { desde: ['SPACE_ACTIVE'], hacia: 'SPACE_SUSPENDED', motivo: true },
      reactivate: { desde: ['SPACE_SUSPENDED'], hacia: 'SPACE_ACTIVE', motivo: false },
      retire: { desde: ['SPACE_PLANNED', 'SPACE_ACTIVE', 'SPACE_SUSPENDED'], hacia: 'SPACE_RETIRED', motivo: true },
    };
    const transicion = action === undefined ? undefined : transiciones[action];
    if (transicion === undefined) return validacion(['action must be one of activate, suspend, reactivate, retire']);
    if (transicion.motivo && motivo === '') return validacion(['reason should not be empty']);
    if (!transicion.desde.includes(espacio.statusCode)) {
      return precondicion('SPACE_INVALID_TRANSITION', `No se puede «${action}» un espacio en estado ${conceptoDe(espacio.statusCode).display.toLowerCase()}.`);
    }
    if (transicion.hacia === 'SPACE_ACTIVE' && espacio.parentId !== null) {
      const padre = espacios.get(espacio.parentId);
      if (padre !== undefined && padre.statusCode !== 'SPACE_ACTIVE') {
        return precondicion('PARENT_NOT_ACTIVE', `Primero activá ${padre.name}: un espacio no puede estar más activo que su padre.`, { parentId: padre.id });
      }
    }
    if (action === 'retire') {
      const bloqueos = bloqueosDe(espacio);
      if (bloqueos.length > 0) {
        return fallo(409, 'CONFLICT', 'SPACE_RETIRE_BLOCKED', 'El espacio tiene dependencias que impiden retirarlo.', { blockers: bloqueos });
      }
    }
    const actualizado = espacios.actualizar(espacio.id, {
      statusCode: transicion.hacia,
      operationalStatusCode: transicion.hacia === 'SPACE_RETIRED' ? 'SPACE_OP_CLOSED' : espacio.operationalStatusCode,
      validTo: transicion.hacia === 'SPACE_RETIRED' ? ahora() : espacio.validTo,
      rowVersion: espacio.rowVersion + 1,
      updatedAt: ahora(),
    })!;
    registrar(actualizado, `lifecycle.${action}`, `Pasó a ${conceptoDe(transicion.hacia).display.toLowerCase()}.`, request, motivo || null);
    return detalle(actualizado);
  });

  router.post('/care-spaces/:id/unit-assignments', (request) => {
    const espacio = espacioVisible(request, request.params['id']);
    if (espacio === null) return noEncontrado();
    const sitio = sitiosInfra.get(espacio.siteId)!;
    if (!puedeEscribir(request, sitio)) return prohibido();
    const { clinicalUnitId, roleCode } = cuerpo<{ clinicalUnitId: string; roleCode: string }>(request);
    const unidad = clinicalUnitId === undefined ? undefined : unidades.get(clinicalUnitId);
    if (unidad === undefined || unidad.siteId !== espacio.siteId) {
      return precondicion('UNIT_NOT_FOUND', 'La unidad no es de este establecimiento.', { field: 'clinicalUnitId' });
    }
    if (roleCode === undefined || !existeCodigo(roleCode, CATALOGO.attributes.unitRole)) {
      return validacion(['roleCode must be one of the catalog codes']);
    }
    const vigentes = asignaciones.filtrar((a) => a.careSpaceId === espacio.id && a.validTo === null);
    if (vigentes.some((a) => a.clinicalUnitId === unidad.id)) {
      return fallo(409, 'CONFLICT', 'ASSIGNMENT_EXISTS', 'Esa unidad ya está vinculada al espacio.', { field: 'clinicalUnitId' });
    }
    if (roleCode === 'SPACE_UNIT_ROLE_OWNER' && vigentes.some((a) => a.roleCode === 'SPACE_UNIT_ROLE_OWNER')) {
      return fallo(409, 'CONFLICT', 'SPACE_OWNER_TAKEN', 'El espacio ya tiene una unidad propietaria vigente: desvinculala primero.', { field: 'roleCode' });
    }
    const creada = asignaciones.agregar({
      id: nuevoId('asg'),
      siteId: espacio.siteId,
      careSpaceId: espacio.id,
      clinicalUnitId: unidad.id,
      roleCode,
      validFrom: ahora(),
      validTo: null,
    });
    if (roleCode === 'SPACE_UNIT_ROLE_OWNER') espacios.actualizar(espacio.id, { clinicalUnitId: unidad.id, rowVersion: espacio.rowVersion + 1 });
    registrar(espacios.get(espacio.id)!, 'unit.assigned', `Vinculado a ${unidad.name} como ${conceptoDe(roleCode).display.toLowerCase()}.`, request);
    return reply(201, vistaDeAsignacion(creada));
  });

  router.delete('/care-spaces/:id/unit-assignments/:assignmentId', (request) => {
    const espacio = espacioVisible(request, request.params['id']);
    if (espacio === null) return noEncontrado();
    const sitio = sitiosInfra.get(espacio.siteId)!;
    if (!puedeEscribir(request, sitio)) return prohibido();
    const asignacion = asignaciones.get(request.params['assignmentId']!);
    if (asignacion === undefined || asignacion.careSpaceId !== espacio.id || asignacion.validTo !== null) return noEncontrado();
    // Sin borrado físico (invariante 6): el vínculo se cierra con su vigencia.
    asignaciones.actualizar(asignacion.id, { validTo: ahora() });
    if (asignacion.roleCode === 'SPACE_UNIT_ROLE_OWNER') {
      espacios.actualizar(espacio.id, { clinicalUnitId: null, rowVersion: espacio.rowVersion + 1 });
    }
    const unidad = unidades.get(asignacion.clinicalUnitId);
    registrar(espacios.get(espacio.id)!, 'unit.unassigned', `Desvinculado de ${unidad?.name ?? 'una unidad'}.`, request);
    return noContent();
  });

  /* ---- unidades ----------------------------------------------------------- */

  router.get('/sites/:siteId/clinical-units', (request) => {
    const sitio = sitioVisible(request, request.params['siteId']);
    return sitio === null ? noEncontrado() : unidades.filtrar((u) => u.siteId === sitio.id).map(vistaDeUnidad);
  });

  const unidadVisible = (request: MockRequest): UnidadSimulada | null => {
    const unidad = unidades.get(request.params['id']!);
    return unidad === undefined || sitioVisible(request, unidad.siteId) === null ? null : unidad;
  };

  router.get('/clinical-units/:id', (request) => {
    const unidad = unidadVisible(request);
    return unidad === null ? noEncontrado() : vistaDeUnidad(unidad);
  });

  router.patch('/clinical-units/:id', (request) => {
    const unidad = unidadVisible(request);
    if (unidad === null) return noEncontrado();
    if (!puedeEscribir(request, sitiosInfra.get(unidad.siteId)!)) return prohibido();
    const conflicto = versionNoCoincide(request, unidad.rowVersion);
    if (conflicto !== null) return conflicto;
    const datos = cuerpo<{ name: string; description: string | null; responsibleUserId: string | null }>(request);
    if (datos.name !== undefined && datos.name.trim() === '') return validacion(['name should not be empty']);
    return vistaDeUnidad(unidades.actualizar(unidad.id, { ...datos, rowVersion: unidad.rowVersion + 1 })!);
  });

  router.post('/clinical-units/:id/lifecycle', (request) => {
    const unidad = unidadVisible(request);
    if (unidad === null) return noEncontrado();
    if (!puedeEscribir(request, sitiosInfra.get(unidad.siteId)!)) return prohibido();
    const conflicto = versionNoCoincide(request, unidad.rowVersion);
    if (conflicto !== null) return conflicto;
    const { action, reason } = cuerpo<{ action: string; reason?: string }>(request);
    const hacia: Readonly<Record<string, string>> = { activate: 'UNIT_ACTIVE', suspend: 'UNIT_SUSPENDED', reactivate: 'UNIT_ACTIVE', retire: 'UNIT_RETIRED' };
    if (action === undefined || hacia[action] === undefined) return validacion(['action must be one of activate, suspend, reactivate, retire']);
    if ((action === 'suspend' || action === 'retire') && !reason?.trim()) return validacion(['reason should not be empty']);
    if (action === 'retire') {
      const hijas = unidades.filtrar((u) => u.parentId === unidad.id && u.statusCode !== 'UNIT_RETIRED');
      const espaciosPropios = asignaciones.filtrar((a) => a.clinicalUnitId === unidad.id && a.validTo === null);
      if (hijas.length > 0 || espaciosPropios.length > 0) {
        return fallo(409, 'CONFLICT', 'UNIT_RETIRE_BLOCKED', 'La unidad tiene sub-unidades o espacios vigentes.', {
          blockers: [
            ...(hijas.length > 0 ? [{ kind: 'ACTIVE_CHILDREN', count: hijas.length, sampleIds: hijas.slice(0, 3).map((h) => h.id), nextAction: { label: 'Retirar o reubicar las sub-unidades' } }] : []),
            ...(espaciosPropios.length > 0 ? [{ kind: 'SCHEDULABLE_RESOURCE', count: espaciosPropios.length, sampleIds: espaciosPropios.slice(0, 3).map((a) => a.careSpaceId), nextAction: { label: 'Desvincular sus espacios' } }] : []),
          ],
        });
      }
    }
    return vistaDeUnidad(unidades.actualizar(unidad.id, { statusCode: hacia[action]!, rowVersion: unidad.rowVersion + 1 })!);
  });

  /* ---- establecimiento ---------------------------------------------------- */

  router.patch('/sites/:siteId/regulatory', (request) => {
    const sitio = sitioVisible(request, request.params['siteId']);
    if (sitio === null) return noEncontrado();
    if (!puedeEscribir(request, sitio)) return prohibido();
    const datos = cuerpo<Record<string, string | null>>(request) as Record<string, string | null>;
    const familias: readonly [string, readonly { code: string }[]][] = [
      ['subsectorCode', CATALOGO.regulatory.subsector],
      ['careLevelCode', CATALOGO.regulatory.careLevel],
      ['typologyCode', CATALOGO.regulatory.typology],
      ['sedesCode', CATALOGO.regulatory.sedes],
    ];
    for (const [clave, familia] of familias) {
      const valor = datos[clave];
      if (typeof valor === 'string' && valor !== '' && !familia.some((k) => k.code === valor)) {
        return validacion([`${clave} must be one of the catalog codes`]);
      }
    }
    const snis = datos['snisCode'];
    if (typeof snis === 'string' && snis !== '' && !/^\d{6,12}$/.test(snis)) {
      return validacion(['snisCode must be 6 to 12 digits']);
    }
    if (typeof snis === 'string' && snis !== '' && sitiosInfra.todos().some((s) => s.id !== sitio.id && s.snisCode === snis)) {
      // Genérico a propósito (Desvíos del modelo v4.2.67b): no dice de quién es
      // el código ni si existe en otro tenant.
      return fallo(409, 'CONFLICT', 'SNIS_CODE_UNAVAILABLE', 'Ese código SNIS no está disponible.', { field: 'snisCode' });
    }
    const tipologia = datos['typologyCode'] ?? null;
    if (tipologia !== null && tipologia !== sitio.typologyCode) {
      const conflictos = espacios
        .filtrar((e) => e.siteId === sitio.id && vivo(e))
        .filter((e) => !tipologiaAdmite(CATALOGO, tipologia, e.functionCode))
        .map((e) => ({ spaceId: e.id, code: e.code, name: e.name, function: conceptoDe(e.functionCode) }));
      if (conflictos.length > 0) {
        return fallo(409, 'CONFLICT', 'TYPOLOGY_CONFLICT', `La tipología elegida no admite ${conflictos.length} espacio(s) existentes.`, { conflicts: conflictos });
      }
    }
    const vacio = (v: string | null | undefined) => (v === undefined || v === '' ? null : v);
    const actualizado = sitiosInfra.actualizar(sitio.id, {
      snisCode: vacio(datos['snisCode']),
      subsectorCode: vacio(datos['subsectorCode']),
      careLevelCode: vacio(datos['careLevelCode']),
      typologyCode: vacio(datos['typologyCode']),
      managingEntityName: vacio(datos['managingEntityName']),
      healthNetworkName: vacio(datos['healthNetworkName']),
      sedesCode: vacio(datos['sedesCode']),
      municipalityName: vacio(datos['municipalityName']),
      rowVersion: sitio.rowVersion + 1,
    })!;
    return resumenDeSitio(actualizado);
  });

  router.get('/sites/:siteId/licenses', (request) => {
    const sitio = sitioVisible(request, request.params['siteId']);
    return sitio === null
      ? noEncontrado()
      : licencias.filtrar((l) => l.siteId === sitio.id).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn)).map(vistaDeLicencia);
  });

  const camposDeLicencia = (datos: Record<string, unknown>, sitio: SitioSimulado, parcial: boolean): MockReply | null => {
    const faltan = ['authorityName', 'resolutionNumber', 'issuedOn', 'statusCode'].filter(
      (k) => (!parcial || k in datos) && (typeof datos[k] !== 'string' || (datos[k] as string).trim() === ''),
    );
    if (faltan.length > 0) return validacion(faltan.map((k) => `${k} should not be empty`));
    if (typeof datos['statusCode'] === 'string' && !existeCodigo(datos['statusCode'], CATALOGO.regulatory.licenseStatus)) {
      return validacion(['statusCode must be one of the catalog codes']);
    }
    if (typeof datos['expiresOn'] === 'string' && datos['expiresOn'] !== '' && typeof datos['issuedOn'] === 'string' && datos['expiresOn'] < datos['issuedOn']) {
      return validacion(['expiresOn must be after issuedOn']);
    }
    const unidad = datos['clinicalUnitId'];
    if (typeof unidad === 'string' && unidad !== '' && !unidades.filtrar((u) => u.siteId === sitio.id).some((u) => u.id === unidad)) {
      return precondicion('UNIT_NOT_FOUND', 'La unidad no es de este establecimiento.', { field: 'clinicalUnitId' });
    }
    return null;
  };

  router.post('/sites/:siteId/licenses', (request) => {
    const sitio = sitioVisible(request, request.params['siteId']);
    if (sitio === null) return noEncontrado();
    if (!puedeEscribir(request, sitio)) return prohibido();
    const datos = cuerpo<Record<string, unknown>>(request) as Record<string, unknown>;
    const error = camposDeLicencia(datos, sitio, false);
    if (error !== null) return error;
    const creada = licencias.agregar({
      id: nuevoId('lic'),
      siteId: sitio.id,
      tenantId: sitio.tenantId,
      authorityName: String(datos['authorityName']).trim(),
      resolutionNumber: String(datos['resolutionNumber']).trim(),
      issuedOn: String(datos['issuedOn']),
      expiresOn: typeof datos['expiresOn'] === 'string' && datos['expiresOn'] !== '' ? datos['expiresOn'] : null,
      statusCode: String(datos['statusCode']),
      clinicalUnitId: typeof datos['clinicalUnitId'] === 'string' && datos['clinicalUnitId'] !== '' ? datos['clinicalUnitId'] : null,
      healthcareServiceId: null,
      documentFileId: null,
      notes: typeof datos['notes'] === 'string' && datos['notes'] !== '' ? datos['notes'] : null,
      rowVersion: 1,
    });
    return reply(201, vistaDeLicencia(creada));
  });

  router.patch('/site-licenses/:id', (request) => {
    const licencia = licencias.get(request.params['id']!);
    const sitio = licencia === undefined ? null : sitioVisible(request, licencia.siteId);
    if (licencia === undefined || sitio === null) return noEncontrado();
    if (!puedeEscribir(request, sitio)) return prohibido();
    const datos = cuerpo<Record<string, unknown>>(request) as Record<string, unknown>;
    const error = camposDeLicencia(datos, sitio, true);
    if (error !== null) return error;
    const { siteId: _s, tenantId: _t, id: _i, ...permitidos } = datos as Partial<LicenciaSimulada>;
    return vistaDeLicencia(licencias.actualizar(licencia.id, { ...permitidos, rowVersion: licencia.rowVersion + 1 })!);
  });

  router.get('/sites/:siteId/capacity', (request) => {
    const sitio = sitioVisible(request, request.params['siteId']);
    if (sitio === null) return noEncontrado();
    const declarada = capacidades.filtrar((k) => k.siteId === sitio.id);
    const derivada = capacidadDerivada(sitio.id);
    const tipos = new Set([...declarada.map((d) => d.kindCode)]);
    return {
      declared: declarada.map(({ kindCode, quantity, asOf, resolutionNumber }) => ({ kindCode, quantity, asOf, resolutionNumber })),
      derived: derivada,
      gaps: [...tipos]
        .map((kindCode) => ({
          kindCode,
          declared: declarada.find((d) => d.kindCode === kindCode)?.quantity ?? 0,
          derived: derivada.find((d) => d.kindCode === kindCode)?.quantity ?? 0,
        }))
        .filter((g) => g.declared !== g.derived),
    };
  });

  router.post('/sites/:siteId/declared-capacities', (request) => {
    const sitio = sitioVisible(request, request.params['siteId']);
    if (sitio === null) return noEncontrado();
    if (!puedeEscribir(request, sitio)) return prohibido();
    const datos = cuerpo<{ kindCode: string; quantity: number; asOf: string; resolutionNumber?: string | null }>(request);
    if (datos.kindCode === undefined || !existeCodigo(datos.kindCode, CATALOGO.regulatory.capacityKind)) {
      return validacion(['kindCode must be one of the catalog codes']);
    }
    if (typeof datos.quantity !== 'number' || !Number.isInteger(datos.quantity) || datos.quantity < 0) {
      return validacion(['quantity must be a non-negative integer']);
    }
    if (typeof datos.asOf !== 'string' || datos.asOf === '') return validacion(['asOf should not be empty']);
    // Una declaración nueva del mismo tipo reemplaza a la anterior: la
    // habilitación vigente es una sola.
    for (const previa of capacidades.filtrar((k) => k.siteId === sitio.id && k.kindCode === datos.kindCode)) {
      capacidades.borrar(previa.id);
    }
    const creada = capacidades.agregar({
      id: nuevoId('cap'),
      siteId: sitio.id,
      tenantId: sitio.tenantId,
      kindCode: datos.kindCode,
      quantity: datos.quantity,
      asOf: datos.asOf,
      resolutionNumber: datos.resolutionNumber ?? null,
    });
    const { kindCode, quantity, asOf, resolutionNumber } = creada;
    return reply(201, { kindCode, quantity, asOf, resolutionNumber });
  });
}

/* Sobreviven a F5 dentro de la pestaña: así se puede recorrer
   UI → petición → respuesta → persistencia → recarga → UI con la maqueta. */
sitiosInfra.persistirEn('mock.infra.sitios');
espacios.persistirEn('mock.infra.espacios');
unidades.persistirEn('mock.infra.unidades');
asignaciones.persistirEn('mock.infra.asignaciones');
licencias.persistirEn('mock.infra.licencias');
capacidades.persistirEn('mock.infra.capacidades');
historial.persistirEn('mock.infra.historial');

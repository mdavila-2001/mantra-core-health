import type {
  AvailabilityCode,
  BedBoardCell,
  BedBoardCounts,
  BedPatient,
  BlockKindCode,
  CareSpaceBlock,
  CareSpaceStatusEvent,
  CleaningOrder,
  CleaningPriorityCode,
  CleaningStatusCode,
  CleaningTransition,
  CleaningTriggerCode,
  CleaningTypeCode,
  FutureCommitmentConflict,
  HygieneCode,
  InfraAction,
  InfraRoleCode,
  IsolationCode,
  OccupancyCode,
  StatusAxisCode,
  StatusSourceCode,
  V2Code,
} from '../../data-access/infrastructure-ops/infrastructure-ops.types';
import { bedStatusV2, isAssignable } from '../../data-access/infrastructure-ops/bed-status-v2';
import { descendientesDe } from '../../data-access/infrastructure/infrastructure.rules';
import type { EspacioSimulado, SitioSimulado } from '../fixtures/infraestructura';
import { conceptoDe } from '../fixtures/infraestructura';
import {
  actionsOf,
  BLOCK_REASONS,
  INFRA_POLICY,
  INFRA_SETTINGS,
  INPATIENT_USERS,
  opsConcept,
  seedAssignments,
  type InfraAssignment,
} from '../fixtures/inpatient';
import { reply, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { MOCK_USERS } from '../mock-session';
import { Coleccion, cuerpo, nuevoId } from '../mock-store';
import { espacios, sitiosInfra, unidades } from './infrastructure.handlers';
import { casosFuturosEnQuirofano } from './procedures.handlers';

/* ============================================================================
    Operación de camas y salas — franja F2 (§F2.3 de `CONTRATO-F2-F5.md`).

    Lo que el simulador hace igual que la API:

    - **tenant**: sede o espacio de otro tenant → 404 (nunca 403);
    - **ABAC**: cada acción se evalúa contra `INFRA_POLICY` con los roles que el
      actor tiene en la sede (`organization_user_assignments`); sin la acción,
      403 `INFRA_ACTION_NOT_ALLOWED` con `details.requiredRoles`;
    - **concurrencia**: `If-Match-Ops` en los ejes (412 `OPS_VERSION_MISMATCH`)
      e `If-Match` en las órdenes de limpieza;
    - **ejes ortogonales**: la disponibilidad vive en
      `espacios.operationalStatusCode` (la columna de F1); higiene y
      aislamiento acá; la ocupación la **deriva** F3 (`registerOccupancyProvider`);
    - **A20**: cada cambio de eje deja un evento append-only con la letra v2
      resultante, la fuente y el `requestId`;
    - **máquina de higiene**: sólo una orden de limpieza o ADT la mueven, y
      quien inspecciona no es quien limpió.
    ========================================================================== */

/* ---- estado ---------------------------------------------------------------- */

export interface OpsRow {
  readonly id: string;
  readonly tenantId: string;
  readonly siteId: string;
  readonly hygieneCode: HygieneCode;
  readonly hygieneChangedAt: string | null;
  readonly terminalCleaningRequired: boolean;
  readonly isolationCode: IsolationCode;
  readonly isolationOrganism: string | null;
  readonly isolationChangedAt: string | null;
  readonly availabilityReasonCode: string | null;
  readonly availabilityReasonText: string | null;
  readonly availabilityExpectedUntil: string | null;
  readonly availabilityChangedAt: string | null;
  readonly opsVersion: number;
  readonly lastEventAt: string | null;
}

export interface BlockRow {
  readonly id: string;
  readonly tenantId: string;
  readonly careSpaceId: string;
  readonly kindCode: BlockKindCode;
  readonly reasonCode: string;
  readonly reasonText: string | null;
  readonly startsAt: string;
  readonly expectedEndAt: string | null;
  readonly endedAt: string | null;
  readonly endedByUserId: string | null;
  readonly endNote: string | null;
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
  readonly createdByName: string | null;
  readonly workOrderRef: string | null;
  /** Bloqueo de cohorte puesto por el aislamiento de otra cama (para levantarlo con ella). */
  readonly cohortSourceId: string | null;
}

export interface CleaningRow {
  readonly id: string;
  readonly tenantId: string;
  readonly siteId: string;
  readonly careSpaceId: string;
  readonly clinicalUnitId: string | null;
  readonly typeCode: CleaningTypeCode;
  readonly triggerCode: CleaningTriggerCode;
  readonly sourceRefId: string | null;
  readonly previousOrderId: string | null;
  readonly priorityCode: CleaningPriorityCode;
  readonly statusCode: CleaningStatusCode;
  readonly requestedAt: string;
  readonly dueAt: string | null;
  readonly assignedUserId: string | null;
  readonly startedAt: string | null;
  readonly startedByUserId: string | null;
  readonly finishedAt: string | null;
  readonly finishedByUserId: string | null;
  readonly inspectedAt: string | null;
  readonly inspectedByUserId: string | null;
  readonly inspectionResult: 'PASS' | 'FAIL' | null;
  readonly rejectionReason: string | null;
  readonly cancelReason: string | null;
  readonly note: string | null;
  readonly rowVersion: number;
}

export interface StatusEventRow {
  readonly id: string;
  readonly tenantId: string;
  readonly siteId: string;
  readonly careSpaceId: string;
  readonly axisCode: StatusAxisCode;
  readonly fromCode: string | null;
  readonly toCode: string;
  readonly reasonCode: string | null;
  readonly reasonText: string | null;
  readonly expectedUntil: string | null;
  readonly v2Code: V2Code;
  readonly sourceCode: StatusSourceCode;
  readonly sourceRefId: string | null;
  readonly occurredAt: string;
  readonly recordedByUserId: string | null;
  readonly recordedByName: string | null;
  readonly requestId: string;
}

/** Ocupación derivada de `encounter_locations` (la provee F3). */
export interface OccupancyView {
  readonly code: OccupancyCode;
  readonly since: string | null;
  readonly encounterId?: string;
  readonly encounterLocationId?: string;
  readonly patient?: BedPatient & { readonly isolationCode?: string; readonly organism?: string | null };
}

const FREE: OccupancyView = { code: 'OCC_FREE', since: null };
let occupancyProvider: (careSpaceId: string) => OccupancyView = () => FREE;

/** F3 registra de dónde sale la ocupación: así F2 no la escribe nunca. */
export function registerOccupancyProvider(provider: (careSpaceId: string) => OccupancyView): void {
  occupancyProvider = provider;
}

const hace = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();
const sanLucas = (): SitioSimulado => sitiosInfra.todos().find((s) => s.code === 'SANLUCAS')!;
const spaceByCode = (code: string) => espacios.todos().find((e) => e.siteId === sanLucas().id && e.code === code);

const ROOM_OR_BED = (e: EspacioSimulado) => e.formCode === 'LOC_FORM_BED' || e.formCode === 'LOC_FORM_ROOM';

function filaInicial(e: EspacioSimulado, cambios: Partial<OpsRow> = {}): OpsRow {
  return {
    id: e.id,
    tenantId: e.tenantId,
    siteId: e.siteId,
    hygieneCode: 'HYG_INSPECTED',
    hygieneChangedAt: e.createdAt,
    terminalCleaningRequired: false,
    isolationCode: 'ISO_NONE',
    isolationOrganism: null,
    isolationChangedAt: null,
    availabilityReasonCode: null,
    availabilityReasonText: null,
    availabilityExpectedUntil: null,
    availabilityChangedAt: e.createdAt,
    opsVersion: 1,
    lastEventAt: null,
    ...cambios,
  };
}

/** El sembrado: 302-B en mantenimiento; dos puestos de recuperación en la cola. */
function sembrarFilas(): OpsRow[] {
  const especiales: Record<string, Partial<OpsRow>> = {
    '302-B': {
      availabilityReasonCode: 'BLOCK_RSN_EQUIPMENT_FAILURE',
      availabilityReasonText: 'Cabecera eléctrica sin respuesta; espera repuesto.',
      availabilityExpectedUntil: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      availabilityChangedAt: hace(26 * 60),
      lastEventAt: hace(26 * 60),
    },
    'REC-1': { hygieneCode: 'HYG_DIRTY', hygieneChangedAt: hace(35), lastEventAt: hace(35) },
    'REC-2': { hygieneCode: 'HYG_CLEANING', hygieneChangedAt: hace(12), lastEventAt: hace(12) },
  };
  return espacios
    .todos()
    .filter(ROOM_OR_BED)
    .map((e) => filaInicial(e, e.siteId === sanLucas().id ? (especiales[e.code] ?? {}) : {}));
}

function sembrarBloqueos(): BlockRow[] {
  const cama = spaceByCode('302-B');
  if (cama === undefined) return [];
  return [
    {
      id: 'blk-seed-302b', tenantId: cama.tenantId, careSpaceId: cama.id, kindCode: 'BLOCK_MAINTENANCE',
      reasonCode: 'BLOCK_RSN_EQUIPMENT_FAILURE', reasonText: 'Cabecera eléctrica sin respuesta; espera repuesto.',
      startsAt: hace(26 * 60), expectedEndAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), endedAt: null,
      endedByUserId: null, endNote: null, cancelledAt: null, cancelReason: null, createdByName: 'Óscar Suárez Montaño',
      workOrderRef: 'OT-2026-1187', cohortSourceId: null,
    },
  ];
}

function sembrarOrdenes(): CleaningRow[] {
  const r1 = spaceByCode('REC-1');
  const r2 = spaceByCode('REC-2');
  if (r1 === undefined || r2 === undefined) return [];
  const base = (e: EspacioSimulado, cambios: Partial<CleaningRow>): CleaningRow => ({
    id: nuevoId('cln'), tenantId: e.tenantId, siteId: e.siteId, careSpaceId: e.id, clinicalUnitId: e.clinicalUnitId,
    typeCode: 'CLEAN_ROUTINE', triggerCode: 'CLN_TRG_MANUAL', sourceRefId: null, previousOrderId: null,
    priorityCode: 'CLN_PRIO_ROUTINE', statusCode: 'CLN_PENDING', requestedAt: hace(35), dueAt: null, assignedUserId: null,
    startedAt: null, startedByUserId: null, finishedAt: null, finishedByUserId: null, inspectedAt: null,
    inspectedByUserId: null, inspectionResult: null, rejectionReason: null, cancelReason: null, note: null, rowVersion: 1,
    ...cambios,
  });
  // Tres rotaciones tras egreso ya cerradas: alimentan el indicador de rotación de cama.
  const historicas = ([['301-B', 3 * 24 + 5, 25, 40, 15], ['303-A', 5 * 24 + 3, 40, 55, 20], ['302-A', 6 * 24 + 8, 15, 45, 30]] as const)
    .map(([code, horas, espera, limpieza, inspeccion]) => {
      const e = spaceByCode(code);
      if (e === undefined) return null;
      const t0 = Date.now() - horas * 3_600_000;
      const t = (min: number) => new Date(t0 + min * 60_000).toISOString();
      return base(e, {
        id: `cln-seed-hist-${code}`, typeCode: 'CLEAN_DISCHARGE', triggerCode: 'CLN_TRG_DISCHARGE', statusCode: 'CLN_INSPECTED',
        requestedAt: t(0), startedAt: t(espera), startedByUserId: INPATIENT_USERS.limpieza, assignedUserId: INPATIENT_USERS.limpieza,
        finishedAt: t(espera + limpieza), finishedByUserId: INPATIENT_USERS.limpieza, inspectedAt: t(espera + limpieza + inspeccion),
        inspectedByUserId: INPATIENT_USERS.supervisoraLimpieza, inspectionResult: 'PASS', rowVersion: 4,
      });
    })
    .filter((x): x is CleaningRow => x !== null);
  return [
    ...historicas,
    base(r1, { id: 'cln-seed-rec1', priorityCode: 'CLN_PRIO_URGENT', note: 'Recuperación de la cirugía de las 8:00.' }),
    base(r2, {
      id: 'cln-seed-rec2', requestedAt: hace(40), statusCode: 'CLN_IN_PROGRESS', assignedUserId: INPATIENT_USERS.limpieza,
      startedAt: hace(12), startedByUserId: INPATIENT_USERS.limpieza,
    }),
  ];
}

export const opsRows = new Coleccion<OpsRow>(sembrarFilas());
export const blocks = new Coleccion<BlockRow>(sembrarBloqueos());
export const cleaningOrders = new Coleccion<CleaningRow>(sembrarOrdenes());
export const statusEvents = new Coleccion<StatusEventRow>([]);
export const infraAssignments = new Coleccion<InfraAssignment & { readonly id: string }>(
  seedAssignments(sitiosInfra.todos().find((s) => s.code === 'SANLUCAS')!.id).map((a) => ({ ...a, id: `asg-${a.userId}` })),
);

/* ---- errores (cuerpo común de DomainException + requestId) --------------- */

let secuencia = 0;

export function newRequestId(): string {
  secuencia += 1;
  return `req-ops-${Date.now().toString(36)}-${secuencia}`;
}

export function failure(status: number, code: string, reason: string, message: string, details: Record<string, unknown> = {}): MockReply {
  const requestId = newRequestId();
  return reply(status, {
    statusCode: status,
    code,
    reason,
    message,
    details: { ...details, reason },
    correlationId: requestId,
    requestId,
    timestamp: new Date().toISOString(),
    path: '',
  });
}

export const notFoundReply = (): MockReply => failure(404, 'NOT_FOUND', 'NOT_FOUND', 'No encontrado');
export const precondition = (reason: string, message: string, details: Record<string, unknown> = {}): MockReply =>
  failure(422, 'PRECONDITION_FAILED', reason, message, details);
export const conflictReply = (reason: string, message: string, details: Record<string, unknown> = {}): MockReply =>
  failure(409, 'CONFLICT', reason, message, details);

export function forbiddenAction(action: InfraAction, reason = 'INFRA_ACTION_NOT_ALLOWED'): MockReply {
  return failure(403, 'FORBIDDEN', reason, 'Su rol en este establecimiento no permite esta acción.', {
    requiredRoles: INFRA_POLICY[action],
    action,
  });
}

/* ---- tenant y roles ------------------------------------------------------- */

export function siteVisible(request: MockRequest, siteId: string | undefined): SitioSimulado | null {
  const sitio = siteId === undefined ? undefined : sitiosInfra.get(siteId);
  if (sitio === undefined) return null;
  const tenant = request.headers.get('X-Tenant-Id');
  return tenant === null || tenant === sitio.tenantId ? sitio : null;
}

export function spaceVisible(request: MockRequest, id: string | undefined): EspacioSimulado | null {
  const espacio = id === undefined ? undefined : espacios.get(id);
  if (espacio === undefined) return null;
  return siteVisible(request, espacio.siteId) === null ? null : espacio;
}

/** Los roles operativos del actor en la sede (§0.3). */
export function rolesIn(request: MockRequest, site: SitioSimulado): InfraRoleCode[] {
  const u = request.user;
  if (u === null || (!u.tenants.includes(site.tenantId) && !u.roles.includes('SUPERADMIN'))) return [];
  const roles = new Set<InfraRoleCode>(
    infraAssignments.filtrar((a) => a.userId === u.id && a.siteId === site.id).flatMap((a) => a.roles),
  );
  if (u.roles.some((r) => r === 'SUPERADMIN' || r === 'SECURITY_ADMIN' || r === 'PLATFORM_ADMIN')) roles.add('SUPERADMIN');
  // Dueña del tenant (F1): sólo si no es personal con asignaciones operativas.
  const esPersonal = infraAssignments.todos().some((a) => a.userId === u.id);
  if (u.tenants[0] === site.tenantId && !esPersonal && roles.size === 0) roles.add('ORG_ADMIN');
  if (u.roles.includes('BILLING') && u.tenants.includes(site.tenantId)) roles.add('BILLING');
  return [...roles];
}

export function can(request: MockRequest, site: SitioSimulado, action: InfraAction): boolean {
  return INFRA_POLICY[action].some((r) => rolesIn(request, site).includes(r));
}

/** 404 si no se ve, 403 si no puede: en ese orden (S6 antes que S5). */
export function guardSpace(request: MockRequest, id: string | undefined, action: InfraAction): { espacio: EspacioSimulado; sitio: SitioSimulado } | MockReply {
  const espacio = spaceVisible(request, id);
  if (espacio === null) return notFoundReply();
  const sitio = sitiosInfra.get(espacio.siteId)!;
  if (!can(request, sitio, action)) return forbiddenAction(action);
  return { espacio, sitio };
}

export function isReply(x: unknown): x is MockReply {
  return typeof x === 'object' && x !== null && 'status' in x && 'body' in x && !('espacio' in x);
}

function opsVersionMismatch(request: MockRequest, row: OpsRow): MockReply | null {
  const enviada = request.headers.get('If-Match-Ops');
  if (enviada === null) return failure(428, 'PRECONDITION_FAILED', 'IF_MATCH_OPS_REQUIRED', 'Falta la cabecera If-Match-Ops.');
  return Number(enviada.replace(/"/g, '')) === row.opsVersion
    ? null
    : failure(412, 'CONCURRENCY_CONFLICT', 'OPS_VERSION_MISMATCH', 'Otra persona cambió el estado de este espacio. Actualice para ver el estado vigente.', {
        currentOpsVersion: row.opsVersion,
      });
}

/* ---- proyección ----------------------------------------------------------- */

export function opsOf(e: EspacioSimulado): OpsRow {
  return opsRows.get(e.id) ?? opsRows.agregar(filaInicial(e));
}

export function availabilityOf(e: EspacioSimulado): AvailabilityCode {
  return (e.operationalStatusCode as AvailabilityCode | null) ?? 'SPACE_OP_AVAILABLE';
}

export function axesOf(e: EspacioSimulado) {
  const ops = opsOf(e);
  const occ = occupancyProvider(e.id);
  const inForce = e.validTo === null || Date.parse(e.validTo) > Date.now();
  const axes = {
    lifecycleCode: e.statusCode,
    availabilityCode: availabilityOf(e),
    hygieneCode: ops.hygieneCode,
    isolationCode: ops.isolationCode,
    occupancyCode: occ.code,
    terminalCleaningRequired: ops.terminalCleaningRequired,
    inspectionRequired: INFRA_SETTINGS.inspectionRequired,
    inForce,
  };
  return { ops, occ, axes, v2Code: bedStatusV2(axes), assignable: isAssignable(axes) };
}

function pathOf(e: EspacioSimulado): BedBoardCell['path'] {
  const pasos: BedBoardCell['path'][number][] = [];
  let actual: EspacioSimulado | undefined = e;
  while (actual !== undefined && pasos.length < 12) {
    pasos.unshift({ id: actual.id, code: actual.code, name: actual.name, form: actual.formCode });
    actual = actual.parentId === null ? undefined : espacios.get(actual.parentId);
  }
  return pasos;
}

export function openOrderOf(careSpaceId: string): CleaningRow | undefined {
  return cleaningOrders.todos().find((o) => o.careSpaceId === careSpaceId && ['CLN_PENDING', 'CLN_IN_PROGRESS', 'CLN_DONE'].includes(o.statusCode));
}

/** Qué acciones del actor aplican a esta celda ahora (desvío W-F2F3-2). */
function cellActions(viewer: readonly InfraAction[], e: EspacioSimulado, d: ReturnType<typeof axesOf>): InfraAction[] {
  const libre = d.occ.code === 'OCC_FREE';
  const activa = e.statusCode === 'SPACE_ACTIVE';
  const disp = d.axes.availabilityCode;
  const aplica: Partial<Record<InfraAction, boolean>> = {
    'block.clinical': (activa && libre && disp === 'SPACE_OP_AVAILABLE') || disp === 'SPACE_OP_BLOCKED_CLINICAL',
    'block.admin': (activa && libre && disp === 'SPACE_OP_AVAILABLE') || disp === 'SPACE_OP_BLOCKED_ADMIN' || disp === 'SPACE_OP_CLOSED',
    maintenance: (activa && libre && disp === 'SPACE_OP_AVAILABLE') || disp === 'SPACE_OP_MAINTENANCE',
    'hygiene.mark-dirty': openOrderOf(e.id) === undefined && ['HYG_CLEAN', 'HYG_INSPECTED'].includes(d.ops.hygieneCode),
    'hygiene.mark-contaminated': d.ops.hygieneCode !== 'HYG_CONTAMINATED',
    isolation: activa,
    'adt.admit': d.assignable,
    'adt.transfer': d.occ.code === 'OCC_OCCUPIED',
    'adt.discharge': d.occ.code === 'OCC_OCCUPIED',
    'adt.cancel': d.occ.code === 'OCC_RESERVED',
  };
  return viewer.filter((a) => aplica[a] ?? true);
}

export function buildCell(e: EspacioSimulado, viewer: readonly InfraAction[]): BedBoardCell {
  const d = axesOf(e);
  const disponibilidad = d.axes.availabilityCode;
  const showPatient = viewer.includes('board.view-patient');
  const patientView = showPatient && d.occ.patient !== undefined
    ? { initials: d.occ.patient.initials, sexCode: d.occ.patient.sexCode, ageYears: d.occ.patient.ageYears }
    : undefined;
  return {
    id: e.id,
    code: e.code,
    name: e.name,
    path: pathOf(e),
    form: conceptoDe(e.formCode),
    function: conceptoDe(e.functionCode),
    lifecycle: conceptoDe(e.statusCode),
    unitId: e.clinicalUnitId,
    availability: {
      code: disponibilidad,
      display: opsConcept(disponibilidad).display,
      reasonCode: d.ops.availabilityReasonCode,
      reasonText: d.ops.availabilityReasonCode === null ? null : (d.ops.availabilityReasonText ?? opsConcept(d.ops.availabilityReasonCode).display),
      expectedUntil: d.ops.availabilityExpectedUntil,
      since: d.ops.availabilityChangedAt,
    },
    hygiene: { code: d.ops.hygieneCode, display: opsConcept(d.ops.hygieneCode).display, since: d.ops.hygieneChangedAt, terminalRequired: d.ops.terminalCleaningRequired },
    isolation: { code: d.ops.isolationCode, display: opsConcept(d.ops.isolationCode).display, organism: d.ops.isolationOrganism, since: d.ops.isolationChangedAt },
    occupancy: {
      code: d.occ.code,
      display: opsConcept(d.occ.code).display,
      since: d.occ.since,
      // Sin el rol clínico tampoco viaja a qué encuentro pertenece la cama.
      ...(showPatient && d.occ.encounterId !== undefined ? { encounterId: d.occ.encounterId } : {}),
      ...(showPatient && d.occ.encounterLocationId !== undefined ? { encounterLocationId: d.occ.encounterLocationId } : {}),
      ...(patientView === undefined ? {} : { patient: patientView }),
    },
    v2Code: d.v2Code,
    assignable: d.assignable,
    openCleaningOrderId: openOrderOf(e.id)?.id ?? null,
    lastEventAt: d.ops.lastEventAt,
    opsVersion: d.ops.opsVersion,
    actions: cellActions(viewer, e, d),
  };
}

function viewerActions(request: MockRequest, site: SitioSimulado): InfraAction[] {
  return actionsOf(rolesIn(request, site));
}

/* ---- A20 ------------------------------------------------------------------ */

export interface EventContext {
  readonly request: MockRequest;
  readonly requestId: string;
  readonly source: StatusSourceCode;
  readonly sourceRefId?: string | null;
  readonly reasonCode?: string | null;
  readonly reasonText?: string | null;
  readonly expectedUntil?: string | null;
  readonly at?: string;
}

/** Deja el evento append-only **después** de aplicar el cambio: lleva la letra v2 resultante. */
export function recordEvent(e: EspacioSimulado, axis: StatusAxisCode, from: string | null, to: string, ctx: EventContext): void {
  const at = ctx.at ?? new Date().toISOString();
  // Releer la fila: quien llama puede traer la versión de antes del cambio.
  const v2 = axesOf(espacios.get(e.id) ?? e).v2Code;
  statusEvents.agregar({
    id: nuevoId('a20'), tenantId: e.tenantId, siteId: e.siteId, careSpaceId: e.id, axisCode: axis, fromCode: from, toCode: to,
    reasonCode: ctx.reasonCode ?? null, reasonText: ctx.reasonText ?? null, expectedUntil: ctx.expectedUntil ?? null, v2Code: v2,
    sourceCode: ctx.source, sourceRefId: ctx.sourceRefId ?? null, occurredAt: at, recordedByUserId: ctx.request.user?.id ?? null,
    recordedByName: ctx.request.user?.displayName ?? null, requestId: ctx.requestId,
  });
  const ops = opsOf(e);
  opsRows.actualizar(e.id, { lastEventAt: at, opsVersion: ops.opsVersion + 1 });
}

function setHygiene(e: EspacioSimulado, to: HygieneCode, ctx: EventContext, cambios: Partial<OpsRow> = {}): void {
  const antes = opsOf(e).hygieneCode;
  opsRows.actualizar(e.id, { hygieneCode: to, hygieneChangedAt: ctx.at ?? new Date().toISOString(), ...cambios });
  recordEvent(e, 'AXIS_HYGIENE', antes, to, ctx);
}

/* ---- puerto para F3 (`CareSpaceOpsPort`) ---------------------------------- */

/**
 * `markDirtyFromSource`: la cama queda sucia y con su orden **en la misma
 * operación** (INV-34). Con aislamiento o contaminación, la orden es TERMINAL y
 * la bandera de limpieza terminal se enciende.
 */
export function markDirtyFromSource(
  careSpaceId: string,
  opts: { trigger: CleaningTriggerCode; sourceRefId: string; terminal: boolean; ctx: EventContext },
): string {
  const e = espacios.get(careSpaceId)!;
  const ops = opsOf(e);
  const terminal = opts.terminal || ops.terminalCleaningRequired || ops.hygieneCode === 'HYG_CONTAMINATED' || ops.isolationCode !== 'ISO_NONE';
  const abierta = openOrderOf(e.id);
  if (abierta !== undefined) {
    if (terminal && abierta.typeCode !== 'CLEAN_TERMINAL') cleaningOrders.actualizar(abierta.id, { typeCode: 'CLEAN_TERMINAL', rowVersion: abierta.rowVersion + 1 });
    return abierta.id;
  }
  const orden = cleaningOrders.agregar(newOrder(e, {
    typeCode: terminal ? 'CLEAN_TERMINAL' : opts.trigger === 'CLN_TRG_DISCHARGE' ? 'CLEAN_DISCHARGE' : 'CLEAN_ROUTINE',
    triggerCode: opts.trigger,
    sourceRefId: opts.sourceRefId,
    priorityCode: terminal ? 'CLN_PRIO_URGENT' : 'CLN_PRIO_ROUTINE',
    requestedAt: opts.ctx.at ?? new Date().toISOString(),
  }));
  if (ops.hygieneCode !== 'HYG_CONTAMINATED') {
    setHygiene(e, 'HYG_DIRTY', { ...opts.ctx, source: 'SRC_ADT', sourceRefId: opts.sourceRefId }, terminal ? { terminalCleaningRequired: true } : {});
  } else if (terminal) {
    opsRows.actualizar(e.id, { terminalCleaningRequired: true });
  }
  return orden.id;
}

/** `recordOccupancyChange`: el evento A20 del eje derivado (F3 ya cambió la fila). */
export function recordOccupancyChange(careSpaceId: string, from: OccupancyCode, to: OccupancyCode, ctx: EventContext): void {
  const e = espacios.get(careSpaceId);
  if (e !== undefined) recordEvent(e, 'AXIS_OCCUPANCY', from, to, { ...ctx, source: 'SRC_ADT' });
}

function newOrder(e: EspacioSimulado, cambios: Partial<CleaningRow>): CleaningRow {
  return {
    id: nuevoId('cln'), tenantId: e.tenantId, siteId: e.siteId, careSpaceId: e.id, clinicalUnitId: e.clinicalUnitId,
    typeCode: 'CLEAN_ROUTINE', triggerCode: 'CLN_TRG_MANUAL', sourceRefId: null, previousOrderId: null,
    priorityCode: 'CLN_PRIO_ROUTINE', statusCode: 'CLN_PENDING', requestedAt: new Date().toISOString(), dueAt: null,
    assignedUserId: null, startedAt: null, startedByUserId: null, finishedAt: null, finishedByUserId: null, inspectedAt: null,
    inspectedByUserId: null, inspectionResult: null, rejectionReason: null, cancelReason: null, note: null, rowVersion: 1,
    ...cambios,
  };
}

/* ---- vistas --------------------------------------------------------------- */

const nameOf = (userId: string | null): string | null => (userId === null ? null : (MOCK_USERS.find((u) => u.id === userId)?.displayName ?? null));

function inspectionRequired(o: CleaningRow): boolean {
  return INFRA_SETTINGS.inspectionRequired || o.typeCode === 'CLEAN_TERMINAL';
}

const TRANSITIONS: Readonly<Record<CleaningStatusCode, readonly CleaningTransition[]>> = {
  CLN_PENDING: ['assign', 'start', 'cancel'],
  CLN_IN_PROGRESS: ['assign', 'finish', 'cancel'],
  CLN_DONE: ['inspect'],
  CLN_INSPECTED: [],
  CLN_REJECTED: [],
  CLN_CANCELLED: [],
};

const ACTION_OF: Readonly<Record<CleaningTransition, InfraAction>> = {
  assign: 'cleaning.assign',
  start: 'cleaning.work',
  finish: 'cleaning.work',
  inspect: 'cleaning.inspect',
  cancel: 'cleaning.create',
};

export function orderView(o: CleaningRow, viewer: readonly InfraAction[]): CleaningOrder {
  const e = espacios.get(o.careSpaceId);
  const unidad = o.clinicalUnitId === null ? undefined : unidades.get(o.clinicalUnitId);
  return {
    id: o.id,
    siteId: o.siteId,
    careSpaceId: o.careSpaceId,
    careSpaceCode: e?.code ?? '',
    careSpaceName: e?.name ?? '',
    clinicalUnitId: o.clinicalUnitId,
    unitName: unidad?.name ?? null,
    type: { code: o.typeCode, display: opsConcept(o.typeCode).display },
    trigger: { code: o.triggerCode, display: opsConcept(o.triggerCode).display },
    priority: { code: o.priorityCode, display: opsConcept(o.priorityCode).display },
    status: { code: o.statusCode, display: opsConcept(o.statusCode).display },
    previousOrderId: o.previousOrderId,
    requestedAt: o.requestedAt,
    dueAt: o.dueAt,
    assignedUserId: o.assignedUserId,
    assignedName: nameOf(o.assignedUserId),
    startedAt: o.startedAt,
    startedByName: nameOf(o.startedByUserId),
    finishedAt: o.finishedAt,
    finishedByUserId: o.finishedByUserId,
    finishedByName: nameOf(o.finishedByUserId),
    inspectedAt: o.inspectedAt,
    inspectedByName: nameOf(o.inspectedByUserId),
    inspectionResult: o.inspectionResult,
    rejectionReason: o.rejectionReason,
    cancelReason: o.cancelReason,
    inspectionRequired: inspectionRequired(o),
    rowVersion: o.rowVersion,
    allowedTransitions: TRANSITIONS[o.statusCode].filter((t) => viewer.includes(ACTION_OF[t])),
  };
}

function blockView(b: BlockRow): CareSpaceBlock {
  return {
    id: b.id,
    careSpaceId: b.careSpaceId,
    kind: opsConcept(b.kindCode),
    reason: opsConcept(b.reasonCode),
    reasonText: b.reasonText,
    startsAt: b.startsAt,
    expectedEndAt: b.expectedEndAt,
    endedAt: b.endedAt,
    endNote: b.endNote,
    cancelledAt: b.cancelledAt,
    cancelReason: b.cancelReason,
    createdByName: b.createdByName,
    workOrderRef: b.workOrderRef,
  };
}

function eventView(x: StatusEventRow): CareSpaceStatusEvent {
  return {
    id: x.id,
    careSpaceId: x.careSpaceId,
    axis: { code: x.axisCode, display: opsConcept(x.axisCode).display },
    from: x.fromCode === null ? null : opsConcept(x.fromCode),
    to: opsConcept(x.toCode),
    reasonCode: x.reasonCode,
    reasonText: x.reasonText,
    expectedUntil: x.expectedUntil,
    v2Code: x.v2Code,
    source: { code: x.sourceCode, display: opsConcept(x.sourceCode).display },
    occurredAt: x.occurredAt,
    recordedByName: x.recordedByName,
    requestId: x.requestId,
  };
}

const openBlockOf = (careSpaceId: string): BlockRow | undefined =>
  blocks.todos().find((b) => b.careSpaceId === careSpaceId && b.endedAt === null && b.cancelledAt === null && Date.parse(b.startsAt) <= Date.now());

const AVAILABILITY_OF_KIND: Readonly<Record<BlockKindCode, AvailabilityCode>> = {
  BLOCK_CLINICAL: 'SPACE_OP_BLOCKED_CLINICAL',
  BLOCK_ADMIN: 'SPACE_OP_BLOCKED_ADMIN',
  BLOCK_MAINTENANCE: 'SPACE_OP_MAINTENANCE',
  BLOCK_CLOSURE: 'SPACE_OP_CLOSED',
};

const ACTION_OF_KIND: Readonly<Record<BlockKindCode, InfraAction>> = {
  BLOCK_CLINICAL: 'block.clinical',
  BLOCK_ADMIN: 'block.admin',
  BLOCK_MAINTENANCE: 'maintenance',
  BLOCK_CLOSURE: 'block.admin',
};

function futureCommitments(e: EspacioSimulado): FutureCommitmentConflict[] {
  return [
    ...casosFuturosEnQuirofano(e.id).map((id) => ({ kind: 'PROCEDURE_CASE' as const, id, startsAt: null, nextAction: 'Reprogramar la intervención en otro quirófano' })),
    ...Array.from({ length: e.futureBookings ?? 0 }, (_, i) => ({ kind: 'BOOKING' as const, id: `${e.id}-booking-${i + 1}`, startsAt: null, nextAction: 'Reprogramar el turno' })),
  ];
}

/** Termina un bloqueo: vuelve a disponible y, si era mantenimiento, exige limpieza (B.5-25). */
function endBlock(b: BlockRow, request: MockRequest, requestId: string, note: string | null, cancel: string | null): void {
  const e = espacios.get(b.careSpaceId)!;
  const at = new Date().toISOString();
  blocks.actualizar(b.id, cancel === null ? { endedAt: at, endedByUserId: request.user?.id ?? null, endNote: note } : { cancelledAt: at, cancelReason: cancel });
  const antes = availabilityOf(e);
  espacios.actualizar(e.id, { operationalStatusCode: 'SPACE_OP_AVAILABLE', updatedAt: at });
  opsRows.actualizar(e.id, { availabilityReasonCode: null, availabilityReasonText: null, availabilityExpectedUntil: null, availabilityChangedAt: at });
  recordEvent(e, 'AXIS_AVAILABILITY', antes, 'SPACE_OP_AVAILABLE', { request, requestId, source: 'SRC_BLOCK', sourceRefId: b.id, reasonText: note ?? cancel });
  if (b.kindCode === 'BLOCK_MAINTENANCE' && cancel === null) {
    markDirtyFromSource(e.id, { trigger: 'CLN_TRG_MAINTENANCE_END', sourceRefId: b.id, terminal: false, ctx: { request, requestId, source: 'SRC_BLOCK' } });
  }
}

function startBlock(e: EspacioSimulado, kind: BlockKindCode, datos: { reasonCode: string; reasonText: string | null; expectedEndAt: string | null; startsAt: string | null; workOrderRef?: string | null; cohortSourceId?: string | null }, request: MockRequest, requestId: string): BlockRow {
  const ahora = new Date().toISOString();
  const empieza = datos.startsAt ?? ahora;
  const fila = blocks.agregar({
    id: nuevoId('blk'), tenantId: e.tenantId, careSpaceId: e.id, kindCode: kind, reasonCode: datos.reasonCode, reasonText: datos.reasonText,
    startsAt: empieza, expectedEndAt: datos.expectedEndAt, endedAt: null, endedByUserId: null, endNote: null, cancelledAt: null,
    cancelReason: null, createdByName: request.user?.displayName ?? null, workOrderRef: datos.workOrderRef ?? null, cohortSourceId: datos.cohortSourceId ?? null,
  });
  if (Date.parse(empieza) <= Date.now()) {
    const antes = availabilityOf(e);
    const destino = AVAILABILITY_OF_KIND[kind];
    espacios.actualizar(e.id, { operationalStatusCode: destino, updatedAt: ahora });
    opsRows.actualizar(e.id, { availabilityReasonCode: datos.reasonCode, availabilityReasonText: datos.reasonText, availabilityExpectedUntil: datos.expectedEndAt, availabilityChangedAt: ahora });
    recordEvent(e, 'AXIS_AVAILABILITY', antes, destino, { request, requestId, source: 'SRC_BLOCK', sourceRefId: fila.id, reasonCode: datos.reasonCode, reasonText: datos.reasonText, expectedUntil: datos.expectedEndAt });
  }
  return fila;
}

/* ---- aislamiento ---------------------------------------------------------- */

function roomOf(e: EspacioSimulado): EspacioSimulado {
  const padre = e.parentId === null ? undefined : espacios.get(e.parentId);
  return e.formCode === 'LOC_FORM_BED' && padre !== undefined && padre.formCode === 'LOC_FORM_ROOM' ? padre : e;
}

export function isolationMissing(e: EspacioSimulado, code: IsolationCode): string[] {
  const local = roomOf(e);
  const faltan: string[] = [];
  const vigente = local.hvacValidatedOn !== null && Date.now() - Date.parse(local.hvacValidatedOn) <= INFRA_SETTINGS.hvacValidationMaxDays * 86_400_000;
  if (code === 'ISO_AIRBORNE') {
    if (local.functionCode !== 'SPACE_FN_ISOLATION_AIIR') faltan.push('AIIR');
    if (local.pressureCode !== 'PRESSURE_NEGATIVE') faltan.push('NEGATIVE_PRESSURE');
    if (!vigente) faltan.push('HVAC_VALIDATION');
  } else if (code === 'ISO_PROTECTIVE') {
    if (local.functionCode !== 'SPACE_FN_PROTECTIVE_ENV') faltan.push('PROTECTIVE_ENV');
    if (local.pressureCode !== 'PRESSURE_POSITIVE') faltan.push('POSITIVE_PRESSURE');
    if (!vigente) faltan.push('HVAC_VALIDATION');
  }
  return faltan;
}

export function siblingBeds(e: EspacioSimulado): EspacioSimulado[] {
  const local = roomOf(e);
  if (local.id === e.id) return [];
  return espacios.filtrar((x) => x.parentId === local.id && x.id !== e.id && x.formCode === 'LOC_FORM_BED' && x.statusCode !== 'SPACE_RETIRED');
}

/* ---- rutas ---------------------------------------------------------------- */

const PRIORIDAD: Readonly<Record<CleaningPriorityCode, number>> = { CLN_PRIO_STAT: 0, CLN_PRIO_URGENT: 1, CLN_PRIO_ROUTINE: 2 };

export function registerInfrastructureOps(router: MockRouter): void {
  router.get('/practice/infrastructure-access/me', (request) => {
    const tenant = request.headers.get('X-Tenant-Id');
    const sitios = sitiosInfra.filtrar((s) => tenant === null || s.tenantId === tenant);
    return {
      userId: request.user?.id ?? '',
      sites: sitios
        .map((s) => ({ siteId: s.id, code: s.code, name: s.name, timeZone: s.timeZone, roles: rolesIn(request, s), actions: viewerActions(request, s) }))
        .filter((s) => s.roles.length > 0),
    };
  });

  router.get('/sites/:siteId/bed-board', (request) => {
    const sitio = siteVisible(request, request.params['siteId']);
    if (sitio === null) return notFoundReply();
    if (!can(request, sitio, 'board.view')) return forbiddenAction('board.view');
    const viewer = viewerActions(request, sitio);
    const q = request.query;
    const unitId = q.get('unitId');
    const parent = q.get('parentSpaceId');
    const funciones = (q.get('functionCodes') ?? '').split(',').filter(Boolean);
    const letras = (q.get('v2Codes') ?? '').split(',').filter(Boolean);
    const siteSpaces = espacios.filtrar((e) => e.siteId === sitio.id);
    const bajo = parent === null || parent === '' ? null : descendientesDe(siteSpaces, parent);
    const camas = siteSpaces
      .filter((e) => e.formCode === 'LOC_FORM_BED' && e.statusCode !== 'SPACE_RETIRED' && e.statusCode !== 'SPACE_PLANNED')
      .filter((e) => bajo === null || bajo.has(e.id))
      .filter((e) => funciones.length === 0 || funciones.includes(e.functionCode))
      .sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }));
    const celdas = camas.map((e) => buildCell(e, viewer));
    const unitsWithBeds = unidades
      .filtrar((u) => u.siteId === sitio.id && (unitId === null || unitId === '' || u.id === unitId))
      .filter((u) => unitId !== null && unitId !== '' ? true : celdas.some((c) => c.unitId === u.id))
      // Primero las unidades con más camas (internación antes que recuperación).
      .sort((a, b) => celdas.filter((c) => c.unitId === b.id).length - celdas.filter((c) => c.unitId === a.id).length || a.name.localeCompare(b.name, 'es'));
    const ultimo = statusEvents.filtrar((x) => x.siteId === sitio.id).reduce<string | null>((m, x) => (m === null || x.occurredAt > m ? x.occurredAt : m), null);
    const generatedAt = new Date().toISOString();
    const body = {
      siteId: sitio.id,
      generatedAt,
      lastEventAt: ultimo,
      nextCursor: null,
      units: unitsWithBeds.map((u) => {
        const todas = celdas.filter((c) => c.unitId === u.id);
        return {
          unitId: u.id,
          name: u.name,
          counts: countsOf(todas),
          cells: todas.filter((c) => letras.length === 0 || letras.includes(c.v2Code)),
        };
      }),
    };
    return { status: 200, body, headers: { 'X-Data-As-Of': ultimo ?? generatedAt } } satisfies MockReply;
  });

  router.get('/care-spaces/:id/operational-state', (request) => {
    const espacio = spaceVisible(request, request.params['id']);
    if (espacio === null) return notFoundReply();
    const sitio = sitiosInfra.get(espacio.siteId)!;
    if (!can(request, sitio, 'board.view') && !can(request, sitio, 'cleaning.view')) return forbiddenAction('board.view');
    const viewer = viewerActions(request, sitio);
    const orden = openOrderOf(espacio.id);
    return {
      cell: buildCell(espacio, viewer),
      openBlocks: blocks.filtrar((b) => b.careSpaceId === espacio.id && b.endedAt === null && b.cancelledAt === null).map(blockView),
      openCleaningOrder: orden === undefined ? null : orderView(orden, viewer),
    };
  });

  router.post('/care-spaces/:id/availability', (request) => {
    const espacio = spaceVisible(request, request.params['id']);
    if (espacio === null) return notFoundReply();
    const sitio = sitiosInfra.get(espacio.siteId)!;
    const datos = cuerpo<{ action: string; kindCode: BlockKindCode; reasonCode: string; reasonText: string; startsAt: string; expectedEndAt: string; acknowledgeConflicts: boolean }>(request);
    const abierto = openBlockOf(espacio.id);
    const accion = datos.action;
    const kind: BlockKindCode | undefined =
      accion === 'start-maintenance' ? 'BLOCK_MAINTENANCE' : accion === 'close' ? 'BLOCK_CLOSURE' : accion === 'block' ? datos.kindCode : abierto?.kindCode;
    if (kind === undefined || !(kind in ACTION_OF_KIND)) {
      return accion === 'unblock' || accion === 'reopen'
        ? conflictReply('BLOCK_ALREADY_ENDED', 'El espacio no tiene un bloqueo vigente.')
        : precondition('BLOCK_KIND_REQUIRED', 'Indique el tipo de bloqueo.');
    }
    if (!can(request, sitio, ACTION_OF_KIND[kind])) return forbiddenAction(ACTION_OF_KIND[kind]);
    const version = opsVersionMismatch(request, opsOf(espacio));
    if (version !== null) return version;
    const requestId = newRequestId();

    if (accion === 'unblock' || accion === 'reopen') {
      endBlock(abierto!, request, requestId, datos.reasonText ?? null, null);
      return { cell: buildCell(espacios.get(espacio.id)!, viewerActions(request, sitio)), blockId: abierto!.id, requestId };
    }

    if (espacio.statusCode !== 'SPACE_ACTIVE') return precondition('SPACE_NOT_ACTIVE', 'Sólo se bloquea un espacio activo.');
    const reasonRow = BLOCK_REASONS.find((r) => r.code === datos.reasonCode);
    if (datos.reasonCode === undefined || datos.reasonCode === '') return precondition('BLOCK_REASON_REQUIRED', 'Todo bloqueo exige un motivo.', { field: 'reasonCode' });
    if (reasonRow === undefined || !(reasonRow.kinds as readonly string[]).includes(kind)) {
      return precondition('BLOCK_REASON_KIND_MISMATCH', 'Ese motivo no corresponde a este tipo de bloqueo.', { field: 'reasonCode' });
    }
    const texto = typeof datos.reasonText === 'string' ? datos.reasonText.trim() : '';
    if (reasonRow.requiresText && texto === '') return precondition('BLOCK_REASON_TEXT_REQUIRED', 'El motivo «Otro» exige describirlo.', { field: 'reasonText' });
    const fin = typeof datos.expectedEndAt === 'string' && datos.expectedEndAt !== '' ? datos.expectedEndAt : null;
    if (kind === 'BLOCK_MAINTENANCE' && fin === null) return precondition('BLOCK_EXPECTED_END_REQUIRED', 'El mantenimiento exige una fecha estimada de fin.', { field: 'expectedEndAt' });
    if (fin !== null && Date.parse(fin) <= Date.now()) return precondition('BLOCK_EXPECTED_END_IN_PAST', 'La fecha estimada tiene que ser futura.', { field: 'expectedEndAt' });
    if (occupancyProvider(espacio.id).code !== 'OCC_FREE') return conflictReply('SPACE_OCCUPIED', 'No se bloquea ni se cierra una cama ocupada o reservada.');
    if (abierto !== undefined) return conflictReply('BLOCK_OVERLAP', 'El espacio ya tiene un bloqueo vigente.', { blockId: abierto.id });
    const conflictos = futureCommitments(espacio);
    if (conflictos.length > 0 && datos.acknowledgeConflicts !== true) {
      return conflictReply('FUTURE_COMMITMENTS_CONFLICT', 'Hay compromisos en la ventana del bloqueo. Reprográmelos o confirme que los conoce.', { conflicts: conflictos });
    }
    const fila = startBlock(espacio, kind, { reasonCode: reasonRow.code, reasonText: texto === '' ? null : texto, expectedEndAt: fin, startsAt: typeof datos.startsAt === 'string' && datos.startsAt !== '' ? datos.startsAt : null }, request, requestId);
    return { cell: buildCell(espacios.get(espacio.id)!, viewerActions(request, sitio)), blockId: fila.id, requestId, conflicts: conflictos };
  });

  router.get('/care-spaces/:id/blocks', (request) => {
    const g = guardSpace(request, request.params['id'], 'history.view');
    if (isReply(g)) return g;
    const todos = request.query.get('includeEnded') === 'true';
    return blocks
      .filtrar((b) => b.careSpaceId === g.espacio.id && (todos || (b.endedAt === null && b.cancelledAt === null)))
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      .map(blockView);
  });

  const terminarBloqueo = (cancelar: boolean) => (request: MockRequest) => {
    const b = blocks.get(request.params['id']!);
    const espacio = b === undefined ? null : spaceVisible(request, b.careSpaceId);
    if (b === undefined || espacio === null) return notFoundReply();
    const sitio = sitiosInfra.get(espacio.siteId)!;
    if (!can(request, sitio, ACTION_OF_KIND[b.kindCode])) return forbiddenAction(ACTION_OF_KIND[b.kindCode]);
    if (b.endedAt !== null || b.cancelledAt !== null) return conflictReply('BLOCK_ALREADY_ENDED', 'Ese bloqueo ya terminó.');
    const datos = cuerpo<{ note: string; reason: string }>(request);
    const requestId = newRequestId();
    endBlock(b, request, requestId, cancelar ? null : (datos.note ?? null), cancelar ? (datos.reason ?? 'Cancelado') : null);
    return { cell: buildCell(espacios.get(espacio.id)!, viewerActions(request, sitio)), requestId };
  };
  router.post('/care-space-blocks/:id/end', terminarBloqueo(false));
  router.post('/care-space-blocks/:id/cancel', terminarBloqueo(true));

  router.post('/care-spaces/:id/hygiene', (request) => {
    const datos = cuerpo<{ action: 'mark-dirty' | 'mark-contaminated'; reasonText: string }>(request);
    const accion: InfraAction = datos.action === 'mark-contaminated' ? 'hygiene.mark-contaminated' : 'hygiene.mark-dirty';
    const g = guardSpace(request, request.params['id'], accion);
    if (isReply(g)) return g;
    const { espacio, sitio } = g;
    const version = opsVersionMismatch(request, opsOf(espacio));
    if (version !== null) return version;
    const requestId = newRequestId();
    const ctx: EventContext = { request, requestId, source: 'SRC_MANUAL', reasonText: datos.reasonText ?? null };
    const abierta = openOrderOf(espacio.id);
    if (datos.action === 'mark-contaminated') {
      if (abierta !== undefined) cleaningOrders.actualizar(abierta.id, { typeCode: 'CLEAN_TERMINAL', priorityCode: 'CLN_PRIO_URGENT', rowVersion: abierta.rowVersion + 1 });
      const orden = abierta ?? cleaningOrders.agregar(newOrder(espacio, { typeCode: 'CLEAN_TERMINAL', triggerCode: 'CLN_TRG_CONTAMINATION', priorityCode: 'CLN_PRIO_URGENT' }));
      setHygiene(espacio, 'HYG_CONTAMINATED', ctx, { terminalCleaningRequired: true });
      return { cell: buildCell(espacios.get(espacio.id)!, viewerActions(request, sitio)), cleaningOrderId: orden.id, requestId };
    }
    if (abierta !== undefined) return conflictReply('CLEANING_ORDER_ALREADY_OPEN', 'Ya hay una orden de limpieza abierta para este espacio.', { cleaningOrderId: abierta.id });
    const ops = opsOf(espacio);
    const orden = cleaningOrders.agregar(newOrder(espacio, { typeCode: ops.terminalCleaningRequired ? 'CLEAN_TERMINAL' : 'CLEAN_ROUTINE', note: datos.reasonText ?? null }));
    setHygiene(espacio, 'HYG_DIRTY', ctx);
    return { cell: buildCell(espacios.get(espacio.id)!, viewerActions(request, sitio)), cleaningOrderId: orden.id, requestId };
  });

  router.post('/care-spaces/:id/isolation', (request) => {
    const g = guardSpace(request, request.params['id'], 'isolation');
    if (isReply(g)) return g;
    const { espacio, sitio } = g;
    const datos = cuerpo<{ isolationCode: IsolationCode; organismText: string; reasonText: string; cohortApproved: boolean }>(request);
    const code = (datos.isolationCode ?? '') as IsolationCode;
    if (!['ISO_NONE', 'ISO_CONTACT', 'ISO_DROPLET', 'ISO_AIRBORNE', 'ISO_PROTECTIVE'].includes(code)) {
      return failure(422, 'VALIDATION_FAILED', 'VALIDATION_FAILED', 'Código de aislamiento inválido.', { violations: ['isolationCode must be one of the catalog codes'] });
    }
    if (typeof datos.reasonText !== 'string' || datos.reasonText.trim() === '') return precondition('ISOLATION_REASON_REQUIRED', 'Indique el motivo del aislamiento.', { field: 'reasonText' });
    const faltan = isolationMissing(espacio, code);
    if (faltan.length > 0) return precondition('ISOLATION_ROOM_NOT_CAPABLE', 'El local no es apto para este aislamiento.', { missing: faltan });
    // Ninguna cuenta de la maqueta tiene el rol de control de infecciones (§0.3, D4).
    if (datos.cohortApproved === true) return failure(403, 'FORBIDDEN', 'ISOLATION_COHORT_REQUIRES_APPROVAL', 'Avalar una cohorte exige el rol de control de infecciones.');
    const version = opsVersionMismatch(request, opsOf(espacio));
    if (version !== null) return version;
    const requestId = newRequestId();
    const ctx: EventContext = { request, requestId, source: 'SRC_MANUAL', reasonText: datos.reasonText };
    const antes = opsOf(espacio).isolationCode;
    const at = new Date().toISOString();
    const companeros: { careSpaceId: string; blockId: string }[] = [];
    if (code === 'ISO_NONE') {
      opsRows.actualizar(espacio.id, { isolationCode: 'ISO_NONE', isolationOrganism: null, isolationChangedAt: at, terminalCleaningRequired: true });
      recordEvent(espacio, 'AXIS_ISOLATION', antes, 'ISO_NONE', ctx);
      if (antes !== 'ISO_NONE') markDirtyFromSource(espacio.id, { trigger: 'CLN_TRG_ISOLATION_END', sourceRefId: espacio.id, terminal: true, ctx });
      for (const b of blocks.filtrar((x) => x.cohortSourceId === espacio.id && x.endedAt === null && x.cancelledAt === null)) {
        endBlock(b, request, requestId, 'Fin del aislamiento de la cama vecina', null);
      }
    } else {
      opsRows.actualizar(espacio.id, { isolationCode: code, isolationOrganism: datos.organismText?.trim() || null, isolationChangedAt: at });
      recordEvent(espacio, 'AXIS_ISOLATION', antes, code, ctx);
      for (const hermana of siblingBeds(espacio)) {
        if (occupancyProvider(hermana.id).code === 'OCC_FREE' && openBlockOf(hermana.id) === undefined && hermana.statusCode === 'SPACE_ACTIVE') {
          const b = startBlock(hermana, 'BLOCK_CLINICAL', { reasonCode: 'BLOCK_RSN_ISOLATION_COHORT', reasonText: `Aislamiento en ${espacio.code}`, expectedEndAt: null, startsAt: null, cohortSourceId: espacio.id }, request, requestId);
          companeros.push({ careSpaceId: hermana.id, blockId: b.id });
        }
      }
    }
    return { cell: buildCell(espacios.get(espacio.id)!, viewerActions(request, sitio)), companionBlocks: companeros, requestId };
  });

  router.get('/sites/:siteId/cleaning-orders', (request) => {
    const sitio = siteVisible(request, request.params['siteId']);
    if (sitio === null) return notFoundReply();
    if (!can(request, sitio, 'cleaning.view')) return forbiddenAction('cleaning.view');
    const viewer = viewerActions(request, sitio);
    const q = request.query;
    const estados = (q.get('status') ?? 'CLN_PENDING,CLN_IN_PROGRESS,CLN_DONE').split(',').filter(Boolean);
    const unidad = q.get('unitId');
    const prioridad = q.get('priority');
    const mias = q.get('assignedTo') === 'me';
    const items = cleaningOrders
      .filtrar((o) => o.siteId === sitio.id && estados.includes(o.statusCode))
      .filter((o) => unidad === null || unidad === '' || o.clinicalUnitId === unidad)
      .filter((o) => prioridad === null || prioridad === '' || o.priorityCode === prioridad)
      .filter((o) => !mias || o.assignedUserId === request.user?.id)
      .sort((a, b) => PRIORIDAD[a.priorityCode] - PRIORIDAD[b.priorityCode] || a.requestedAt.localeCompare(b.requestedAt))
      .map((o) => orderView(o, viewer));
    return { items, nextCursor: null, generatedAt: new Date().toISOString() };
  });

  router.post('/sites/:siteId/cleaning-orders', (request) => {
    const sitio = siteVisible(request, request.params['siteId']);
    if (sitio === null) return notFoundReply();
    if (!can(request, sitio, 'cleaning.create')) return forbiddenAction('cleaning.create');
    const datos = cuerpo<{ careSpaceId: string; typeCode: CleaningTypeCode; priorityCode: CleaningPriorityCode; note: string }>(request);
    const espacio = spaceVisible(request, datos.careSpaceId);
    if (espacio === null || espacio.siteId !== sitio.id) return notFoundReply();
    const abierta = openOrderOf(espacio.id);
    if (abierta !== undefined) return conflictReply('CLEANING_ORDER_ALREADY_OPEN', 'Ya hay una orden de limpieza abierta para este espacio.', { cleaningOrderId: abierta.id });
    const ops = opsOf(espacio);
    if (ops.terminalCleaningRequired && datos.typeCode !== 'CLEAN_TERMINAL') {
      return precondition('TERMINAL_CLEANING_REQUIRED', 'Este espacio exige una limpieza terminal.', { field: 'typeCode' });
    }
    const requestId = newRequestId();
    const orden = cleaningOrders.agregar(newOrder(espacio, { typeCode: datos.typeCode ?? 'CLEAN_ROUTINE', priorityCode: datos.priorityCode ?? 'CLN_PRIO_ROUTINE', note: datos.note ?? null }));
    if (ops.hygieneCode !== 'HYG_DIRTY' && ops.hygieneCode !== 'HYG_CONTAMINATED') setHygiene(espacio, 'HYG_DIRTY', { request, requestId, source: 'SRC_CLEANING', sourceRefId: orden.id });
    return reply(201, { order: orderView(orden, viewerActions(request, sitio)), requestId });
  });

  router.post('/cleaning-orders/:id/:action', (request) => {
    const orden = cleaningOrders.get(request.params['id']!);
    const espacio = orden === undefined ? null : spaceVisible(request, orden.careSpaceId);
    if (orden === undefined || espacio === null) return notFoundReply();
    const sitio = sitiosInfra.get(espacio.siteId)!;
    const accion = request.params['action'] as CleaningTransition;
    if (!(accion in ACTION_OF)) return notFoundReply();
    if (!can(request, sitio, ACTION_OF[accion])) return forbiddenAction(ACTION_OF[accion]);
    const enviada = request.headers.get('If-Match');
    if (enviada === null) return failure(428, 'PRECONDITION_FAILED', 'IF_MATCH_REQUIRED', 'Falta la cabecera If-Match.');
    if (Number(enviada.replace(/"/g, '')) !== orden.rowVersion) {
      return failure(412, 'CONCURRENCY_CONFLICT', 'ROW_VERSION_MISMATCH', 'Otra persona movió esta orden mientras la miraba. Actualice la cola.', { currentRowVersion: orden.rowVersion });
    }
    if (!TRANSITIONS[orden.statusCode].includes(accion)) {
      return conflictReply('CLEANING_ORDER_INVALID_TRANSITION', 'La orden no admite ese paso en su estado actual.', { from: orden.statusCode, to: accion });
    }
    const datos = cuerpo<{ userId: string | null; note: string; result: 'PASS' | 'FAIL'; reasonText: string; reason: string }>(request);
    const requestId = newRequestId();
    const yo = request.user?.id ?? null;
    const at = new Date().toISOString();
    const ctx: EventContext = { request, requestId, source: 'SRC_CLEANING', sourceRefId: orden.id };
    const sube = { rowVersion: orden.rowVersion + 1 };
    let resultado: CleaningRow = orden;
    switch (accion) {
      case 'assign':
        resultado = cleaningOrders.actualizar(orden.id, { assignedUserId: datos.userId ?? null, ...sube })!;
        break;
      case 'start':
        resultado = cleaningOrders.actualizar(orden.id, { statusCode: 'CLN_IN_PROGRESS', startedAt: at, startedByUserId: yo, assignedUserId: orden.assignedUserId ?? yo, ...sube })!;
        setHygiene(espacio, 'HYG_CLEANING', ctx);
        break;
      case 'finish': {
        const withoutInspection = !inspectionRequired(orden);
        resultado = cleaningOrders.actualizar(orden.id, { statusCode: 'CLN_DONE', finishedAt: at, finishedByUserId: yo, note: datos.note ?? orden.note, ...sube })!;
        setHygiene(espacio, 'HYG_CLEAN', ctx);
        if (withoutInspection) resultado = cleaningOrders.actualizar(orden.id, { statusCode: 'CLN_INSPECTED', inspectedAt: at, inspectionResult: 'PASS' })!;
        break;
      }
      case 'inspect': {
        if (datos.result !== 'PASS' && datos.result !== 'FAIL') {
          return failure(422, 'VALIDATION_FAILED', 'VALIDATION_FAILED', 'Indique el resultado de la inspección.', { violations: ['result must be PASS or FAIL'] });
        }
        if (yo !== null && yo === orden.finishedByUserId) {
          return precondition('INSPECTION_BY_CLEANER_NOT_ALLOWED', 'Quien terminó la limpieza no puede inspeccionarla: la inspecciona otra persona.');
        }
        const supervisor = rolesIn(request, sitio).some((r) => r === 'NURSE_SUPERVISOR' || r === 'HOUSEKEEPING_SUPERVISOR');
        if (orden.typeCode === 'CLEAN_TERMINAL' && !supervisor) return forbiddenAction('cleaning.inspect', 'TERMINAL_INSPECTION_REQUIRES_SUPERVISOR');
        if (datos.result === 'FAIL') {
          const reasonRow = typeof datos.reasonText === 'string' ? datos.reasonText.trim() : '';
          if (reasonRow === '') return precondition('INSPECTION_REASON_REQUIRED', 'Una inspección rechazada exige el motivo.', { field: 'reasonText' });
          resultado = cleaningOrders.actualizar(orden.id, { statusCode: 'CLN_REJECTED', inspectedAt: at, inspectedByUserId: yo, inspectionResult: 'FAIL', rejectionReason: reasonRow, ...sube })!;
          cleaningOrders.agregar(newOrder(espacio, { typeCode: orden.typeCode, triggerCode: 'CLN_TRG_INSPECTION_FAILED', previousOrderId: orden.id, priorityCode: 'CLN_PRIO_URGENT', sourceRefId: orden.id, note: reasonRow }));
          setHygiene(espacio, 'HYG_DIRTY', { ...ctx, reasonText: reasonRow });
        } else {
          resultado = cleaningOrders.actualizar(orden.id, { statusCode: 'CLN_INSPECTED', inspectedAt: at, inspectedByUserId: yo, inspectionResult: 'PASS', ...sube })!;
          const apaga = orden.typeCode === 'CLEAN_TERMINAL' ? { terminalCleaningRequired: false } : {};
          setHygiene(espacio, 'HYG_INSPECTED', ctx, apaga);
        }
        break;
      }
      case 'cancel': {
        const reasonRow = typeof datos.reason === 'string' ? datos.reason.trim() : '';
        if (reasonRow === '') return precondition('CANCEL_REASON_REQUIRED', 'Indique por qué se cancela.', { field: 'reason' });
        resultado = cleaningOrders.actualizar(orden.id, { statusCode: 'CLN_CANCELLED', cancelReason: reasonRow, ...sube })!;
        break;
      }
    }
    return { order: orderView(resultado, viewerActions(request, sitio)), requestId };
  });

  router.get('/care-spaces/:id/status-events', (request) => {
    const g = guardSpace(request, request.params['id'], 'history.view');
    if (isReply(g)) return g;
    const eje = request.query.get('axis');
    // Más reciente primero; a igual instante, el último escrito (append-only).
    const items = statusEvents
      .filtrar((x) => x.careSpaceId === g.espacio.id && (eje === null || eje === '' || x.axisCode === eje))
      .map((x, i) => ({ x, i }))
      .sort((a, b) => b.x.occurredAt.localeCompare(a.x.occurredAt) || b.i - a.i)
      .map(({ x }) => x)
      .slice(0, 100)
      .map(eventView);
    return { items, nextCursor: null };
  });
}

export function countsOf(cells: readonly BedBoardCell[]): BedBoardCounts {
  const n = (f: (c: BedBoardCell) => boolean) => cells.filter(f).length;
  return {
    total: cells.length,
    assignable: n((c) => c.assignable),
    occupied: n((c) => c.occupancy.code === 'OCC_OCCUPIED'),
    reserved: n((c) => c.occupancy.code === 'OCC_RESERVED'),
    blocked: n((c) => c.availability.code === 'SPACE_OP_BLOCKED_CLINICAL' || c.availability.code === 'SPACE_OP_BLOCKED_ADMIN' || c.availability.code === 'SPACE_OP_CLOSED'),
    maintenance: n((c) => c.availability.code === 'SPACE_OP_MAINTENANCE'),
    dirty: n((c) => c.hygiene.code === 'HYG_DIRTY'),
    cleaning: n((c) => c.hygiene.code === 'HYG_CLEANING'),
    isolation: n((c) => c.isolation.code !== 'ISO_NONE'),
    contaminated: n((c) => c.hygiene.code === 'HYG_CONTAMINATED'),
  };
}

/* Sobreviven a F5 dentro de la pestaña: UI → petición → persistencia → recarga → UI. */
opsRows.persistirEn('mock.ops.estados');
blocks.persistirEn('mock.ops.bloqueos');
cleaningOrders.persistirEn('mock.ops.limpiezas');
statusEvents.persistirEn('mock.ops.eventos-a20');
infraAssignments.persistirEn('mock.ops.asignaciones');

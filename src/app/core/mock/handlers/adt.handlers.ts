import type {
  CensusAdjustment,
  CensusCounts,
  CensusDay,
  CensusField,
  CompatibilityRule,
  CompatibilityViolation,
  EncounterLocation,
  InpatientStay,
  LevelOfCareCode,
  LocationStatusCode,
  MovementTypeCode,
  PlacementIncident,
  PlacementOverride,
  StayBed,
  StayPatient,
} from '../../data-access/adt/adt.types';
import { CENSUS_FIELDS } from '../../data-access/adt/adt.types';
import { evaluateCompatibility, overrideProblem } from '../../data-access/adt/bed-compatibility';
import { bedTurnaround, crossCheck, daysBetween, indicatorTotals, stayDays, type TurnaroundSample } from '../../data-access/adt/inpatient-indicators';
import type { OccupancyCode } from '../../data-access/infrastructure-ops/infrastructure-ops.types';
import type { EspacioSimulado, SitioSimulado } from '../fixtures/infraestructura';
import { actionsOf, cutoffOf, INFRA_SETTINGS, opsConcept, shiftDate, siteDate } from '../fixtures/inpatient';
import { patientById, PROFESSIONALS } from '../fixtures/people';
import type { MockReply, MockRequest, MockRouter } from '../mock-router';
import { reply } from '../mock-router';
import { MOCK_USERS } from '../mock-session';
import { Coleccion, cuerpo, nuevoId, uuid } from '../mock-store';
import { espacios, sitiosInfra, unidades } from './infrastructure.handlers';
import {
  axesOf,
  blocks,
  buildCell,
  can,
  cleaningOrders,
  conflictReply,
  failure,
  forbiddenAction,
  isolationMissing,
  markDirtyFromSource,
  newRequestId,
  notFoundReply,
  precondition,
  recordOccupancyChange,
  registerOccupancyProvider,
  rolesIn,
  siblingBeds,
  siteVisible,
  spaceVisible,
  type EventContext,
  type OccupancyView,
} from './infrastructure-ops.handlers';

/* ============================================================================
    Internación / ADT — franja F3 (§F3.3 de `CONTRATO-F2-F5.md`).

    Lo que el simulador hace igual que locA API:

    - locA **ocupación se deriva** de `encounter_locations` y se le presta a F2
      (`registerOccupancyProvider`): nadie locA escribe a mano;
    - **una cama, un paciente** y **un paciente, una cama**: se valida antes de
      escribir (en locA API además lo garantizan los `EXCLUDE`);
    - **traslado e intercambio atómicos**: se valida todo y recién después se
      escribe; el origen queda sucio con su orden de limpieza (puerto de F2);
    - **compatibilidad**: bloqueantes nunca se fuerzan; forzables con
      justificación de 20+ caracteres, rol de supervisión e incidente;
    - **censo**: el día abierto es una vista previa calculada; el cerrado es una
      foto inmutable y los ajustes son filas aparte;
    - **indicadores** sólo con días cerrados y valores ajustados.
    ========================================================================== */

export interface EncounterRow {
  readonly id: string;
  readonly tenantId: string;
  readonly siteId: string;
  readonly patientProfileId: string;
  readonly episodeId: string;
  readonly statusCode: 'IN_PROGRESS' | 'FINISHED';
  readonly levelOfCareCode: LevelOfCareCode;
  readonly admissionSourceCode: string;
  readonly isolationCode: string;
  readonly isolationOrganism: string | null;
  readonly reasonText: string;
  readonly attendingPractitionerId: string;
  readonly expectedDischargeAt: string | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly dispositionCode: string | null;
  readonly rowVersion: number;
}

export interface LocationRow {
  readonly id: string;
  readonly tenantId: string;
  readonly encounterId: string;
  readonly careSpaceId: string;
  readonly isBedAssignment: boolean;
  readonly movementTypeCode: MovementTypeCode;
  readonly previousLocationId: string | null;
  readonly statusCode: LocationStatusCode;
  readonly periodStart: string;
  readonly periodEnd: string | null;
  readonly endReasonCode: string | null;
  readonly bedCategoryCode: string | null;
  readonly placementIncidentId: string | null;
  readonly createdAt: string;
}

interface IncidentRow {
  readonly id: string;
  readonly tenantId: string;
  readonly encounterId: string;
  readonly encounterLocationId: string;
  readonly careSpaceId: string;
  readonly patientProfileId: string;
  readonly violations: readonly { readonly rule: CompatibilityRule; readonly detail: string }[];
  readonly justification: string;
  readonly authorizedByUserId: string | null;
  readonly statusCode: 'PLC_INC_OPEN' | 'PLC_INC_REVIEWED' | 'PLC_INC_CLOSED';
  readonly reviewedByUserId: string | null;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
  readonly createdAt: string;
}

interface CensusDayRow {
  readonly id: string;
  readonly tenantId: string;
  readonly siteId: string;
  readonly unitId: string;
  readonly censusDate: string;
  readonly cutoffAt: string;
  readonly closedAt: string;
  readonly closedByUserId: string | null;
  readonly counts: CensusCounts;
}

interface AdjustmentRow {
  readonly id: string;
  readonly tenantId: string;
  readonly censusDayId: string;
  readonly fieldCode: CensusField;
  readonly previousValue: number;
  readonly newValue: number;
  readonly reasonText: string;
  readonly adjustedByUserId: string | null;
  readonly requestId: string;
  readonly createdAt: string;
}

/* ---- sembrado ------------------------------------------------------------- */

const sanLucas = (): SitioSimulado => sitiosInfra.todos().find((s) => s.code === 'SANLUCAS')!;
const cama = (code: string): EspacioSimulado => espacios.todos().find((e) => e.siteId === sanLucas().id && e.code === code)!;
const haceHoras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const PATIENT = (clave: string) => `pid-${clave}`;

function seedEncounters(): EncounterRow[] {
  const s = sanLucas();
  const e = (clave: string, paciente: string, horas: number, extra: Partial<EncounterRow> = {}): EncounterRow => ({
    id: `enc-seed-${clave}`, tenantId: s.tenantId, siteId: s.id, patientProfileId: paciente, episodeId: `epi-seed-${clave}`,
    statusCode: 'IN_PROGRESS', levelOfCareCode: 'LOC_CARE_GENERAL', admissionSourceCode: 'ADM_SRC_EMERGENCY', isolationCode: 'ISO_NONE',
    isolationOrganism: null, reasonText: 'Ingreso desde emergencias', attendingPractitionerId: PROFESSIONALS[0]!.id,
    expectedDischargeAt: null, startedAt: haceHoras(horas), endedAt: null, dispositionCode: null, rowVersion: 1, ...extra,
  });
  return [
    e('mamani', patientIdOf('p-mamani'), 98, { reasonText: 'Neumonía adquirida en la comunidad', expectedDischargeAt: new Date(Date.now() + 2 * 86_400_000).toISOString() }),
    e('flores', patientIdOf('p-flores'), 50, { reasonText: 'Pielonefritis aguda', admissionSourceCode: 'ADM_SRC_OUTPATIENT' }),
  ];
}

/** El id que `people.ts` le da a un paciente del padrón (`uuid('pid-<clave>')`). */
function patientIdOf(clave: string): string {
  return uuid(PATIENT(clave));
}

function seedLocations(encuentros: readonly EncounterRow[]): LocationRow[] {
  const ubicar = (enc: EncounterRow, codigo: string): LocationRow => ({
    id: `loc-seed-${enc.id}`, tenantId: enc.tenantId, encounterId: enc.id, careSpaceId: cama(codigo).id, isBedAssignment: true,
    movementTypeCode: 'ADT_ADMIT', previousLocationId: null, statusCode: 'LOCATION_ACTIVE', periodStart: enc.startedAt, periodEnd: null,
    endReasonCode: null, bedCategoryCode: cama(codigo).bedCategoryCode, placementIncidentId: null, createdAt: enc.startedAt,
  });
  return [ubicar(encuentros[0]!, '301-A'), ubicar(encuentros[1]!, '302-A')];
}

/** Siete días cerrados con valores conocidos (el fixture de `inpatient-indicators.spec.ts`). */
function seedCensus(): CensusDayRow[] {
  const s = sanLucas();
  const unidad = unidades.todos().find((u) => u.siteId === s.id && u.code === 'MEDINT')!;
  const hoy = siteDate(Date.now());
  const filas: readonly [number, number, number, number, number, number][] = [
    // [días atrás, disponibles, días-paciente, ingresos, egresos, días de estancia de egresos]
    [8, 4, 3, 1, 1, 5],
    [7, 4, 3, 0, 0, 0],
    [6, 4, 4, 1, 0, 0],
    [5, 3, 3, 0, 1, 5],
    [4, 4, 2, 0, 1, 6],
    [3, 4, 3, 1, 0, 0],
    [2, 4, 3, 1, 1, 5],
  ];
  return filas.map(([atras, disponibles, dp, ing, egr, est]) => {
    const day = shiftDate(hoy, -atras);
    return {
      id: `cen-seed-${day}`, tenantId: s.tenantId, siteId: s.id, unitId: unidad.id, censusDate: day, cutoffAt: cutoffOf(day),
      closedAt: new Date(Date.parse(cutoffOf(day)) + 15 * 60_000).toISOString(), closedByUserId: null,
      counts: counts({ beds_censable: 4, beds_available: disponibles, beds_blocked: 4 - disponibles, patients_at_cutoff: dp, admissions: ing, discharges: egr, patient_days: dp, discharge_stay_days: est }),
    };
  });
}

function counts(v: Partial<CensusCounts>): CensusCounts {
  return { ...(Object.fromEntries(CENSUS_FIELDS.map((f) => [f, 0])) as Record<CensusField, number>), ...v };
}

export const encounters = new Coleccion<EncounterRow>(seedEncounters());
export const locations = new Coleccion<LocationRow>(seedLocations(encounters.todos()));
const incidents = new Coleccion<IncidentRow>([]);
const censusDays = new Coleccion<CensusDayRow>(seedCensus());
const adjustments = new Coleccion<AdjustmentRow>([]);

/* ---- ocupación derivada (se locA presta a F2) ------------------------------ */

const bedRowsOf = (careSpaceId: string) =>
  locations.filtrar((l) => l.careSpaceId === careSpaceId && l.isBedAssignment && (l.statusCode === 'LOCATION_ACTIVE' || l.statusCode === 'LOCATION_RESERVED') && l.periodEnd === null);

function patientOf(id: string): StayPatient {
  const p = patientById(id);
  const fullName = p?.displayName ?? 'Paciente';
  const nacimiento = p?.birthDate ?? '1980-01-01';
  const ms = Date.now() - Date.parse(nacimiento);
  return {
    patientProfileId: id,
    displayName: fullName,
    initials: fullName.split(/\s+/).filter(Boolean).slice(0, 3).map((x) => x[0]!.toUpperCase()).join(''),
    sexCode: p?.sexAtBirth ?? 'FEMALE',
    ageYears: Math.floor(ms / (365.25 * 86_400_000)),
  };
}

function ageDaysOf(id: string): number {
  return Math.floor((Date.now() - Date.parse(patientById(id)?.birthDate ?? '1980-01-01')) / 86_400_000);
}

export function occupancyOf(careSpaceId: string): OccupancyView {
  const filas = bedRowsOf(careSpaceId);
  const activa = filas.find((l) => l.statusCode === 'LOCATION_ACTIVE');
  const fila = activa ?? filas[0];
  if (fila === undefined) return { code: 'OCC_FREE', since: null };
  const enc = encounters.get(fila.encounterId)!;
  const p = patientOf(enc.patientProfileId);
  return {
    code: activa === undefined ? 'OCC_RESERVED' : 'OCC_OCCUPIED',
    since: fila.periodStart,
    encounterId: enc.id,
    encounterLocationId: fila.id,
    patient: { initials: p.initials, sexCode: p.sexCode, ageYears: p.ageYears, isolationCode: enc.isolationCode, organism: enc.isolationOrganism },
  };
}

registerOccupancyProvider(occupancyOf);

/* ---- compatibilidad ------------------------------------------------------- */

interface Prospect {
  readonly patientProfileId: string;
  readonly levelOfCareCode: LevelOfCareCode;
  readonly isolationCode: string;
  readonly organism: string | null;
  /** Encuentros que no cuentan como vecinos (el propio, o el del intercambio). */
  readonly ignoreEncounters?: readonly string[];
  /** Al intercambiar, locA cama destino locA deja libre el otro paciente. */
  readonly treatAsFree?: boolean;
}

function compatibility(bed: EspacioSimulado, p: Prospect): CompatibilityViolation[] {
  const d = axesOf(bed);
  const room = bed.parentId === null ? undefined : espacios.get(bed.parentId);
  const local = room !== undefined && room.formCode === 'LOC_FORM_ROOM' ? room : undefined;
  const ignorar = new Set(p.ignoreEncounters ?? []);
  const propia = bedRowsOf(bed.id).every((l) => ignorar.has(l.encounterId));
  const roommates = (local === undefined ? [] : siblingBeds(bed))
    .map((x) => occupancyOf(x.id))
    .filter((o) => o.code !== 'OCC_FREE' && o.encounterId !== undefined && !ignorar.has(o.encounterId))
    .map((o) => ({ sexCode: o.patient!.sexCode, isolationCode: o.patient!.isolationCode ?? 'ISO_NONE', organism: o.patient!.organism ?? null }));
  const hygieneReady = d.axes.hygieneCode === 'HYG_INSPECTED' || (d.axes.hygieneCode === 'HYG_CLEAN' && !INFRA_SETTINGS.inspectionRequired);
  const patient = patientOf(p.patientProfileId);
  return evaluateCompatibility({
    bed: {
      lifecycleCode: bed.statusCode,
      availabilityCode: d.axes.availabilityCode,
      occupancyCode: p.treatAsFree === true || propia ? 'OCC_FREE' : d.occ.code,
      hygieneReady: p.treatAsFree === true || (hygieneReady && !d.ops.terminalCleaningRequired),
      functionCode: bed.functionCode,
      ageGroupCode: bed.ageGroupCode,
    },
    room: {
      functionCode: local?.functionCode ?? null,
      sexRestrictionCode: local?.sexRestrictionCode ?? null,
      ageGroupCode: local?.ageGroupCode ?? null,
      pressureCode: local?.pressureCode ?? null,
      hvacValid: isolationMissing(bed, 'ISO_AIRBORNE').length === 0,
    },
    roommates,
    patient: { sexCode: patient.sexCode, ageYears: patient.ageYears, ageDays: ageDaysOf(p.patientProfileId) },
    encounter: { levelOfCareCode: p.levelOfCareCode, isolationCode: p.isolationCode, organism: p.organism, cohortApproved: false },
  });
}

/** El veredicto de locA API sobre un forzado: 409/422/403, o `null` para seguir. */
function placementReply(request: MockRequest, site: SitioSimulado, violations: readonly CompatibilityViolation[], override: PlacementOverride | undefined): MockReply | null {
  const problema = overrideProblem(violations, override);
  if (problema === 'BED_NOT_ASSIGNABLE') {
    return conflictReply('BED_NOT_ASSIGNABLE', 'La cama no es asignable para este paciente.', { violations: violations.filter((v) => v.severity === 'BLOCKING') });
  }
  if (problema !== null) {
    const mensajes = {
      BED_COMPATIBILITY_OVERRIDE_REQUIRED: 'La cama no es compatible: se puede forzar con justificación y aval de supervisión.',
      OVERRIDE_JUSTIFICATION_TOO_SHORT: 'La justificación tiene que tener al menos 20 caracteres.',
      OVERRIDE_RULE_NOT_OVERRIDABLE: 'Esa regla no se puede forzar.',
    } as const;
    return precondition(problema, mensajes[problema], { violations });
  }
  if (override !== undefined && !can(request, site, 'adt.override')) return forbiddenAction('adt.override');
  return null;
}

/* ---- vistas --------------------------------------------------------------- */

const userNameOf = (id: string | null) => (id === null ? null : (MOCK_USERS.find((u) => u.id === id)?.displayName ?? null));

function bedOf(careSpaceId: string): StayBed {
  const e = espacios.get(careSpaceId)!;
  const u = e.clinicalUnitId === null ? undefined : unidades.get(e.clinicalUnitId);
  return { careSpaceId: e.id, code: e.code, name: e.name, unitId: e.clinicalUnitId, unitName: u?.name ?? null, siteId: e.siteId };
}

const HL7: Readonly<Record<MovementTypeCode, string>> = { ADT_ADMIT: 'A01', ADT_TRANSFER: 'A02', ADT_SWAP: 'A17', ADT_RESERVE: 'A14' };

function locationView(l: LocationRow): EncounterLocation {
  const insideWindow = Date.now() - Date.parse(l.createdAt) <= INFRA_SETTINGS.adtCancelWindowMinutes * 60_000;
  const cancelable =
    l.statusCode === 'LOCATION_RESERVED' ||
    (l.statusCode === 'LOCATION_ACTIVE' && l.movementTypeCode === 'ADT_TRANSFER' && insideWindow);
  return {
    id: l.id,
    encounterId: l.encounterId,
    bed: bedOf(l.careSpaceId),
    movementType: { code: l.movementTypeCode, display: opsConcept(l.movementTypeCode).display },
    status: { code: l.statusCode, display: opsConcept(l.statusCode).display },
    periodStart: l.periodStart,
    periodEnd: l.periodEnd,
    endReason: l.endReasonCode === null ? null : opsConcept(l.endReasonCode),
    previousEncounterLocationId: l.previousLocationId,
    placementIncidentId: l.placementIncidentId,
    cancellable: cancelable,
    hl7Event: l.endReasonCode === 'ADT_END_DISCHARGE' ? `${HL7[l.movementTypeCode]} · A03` : HL7[l.movementTypeCode],
  };
}

function incidentView(i: IncidentRow): PlacementIncident {
  return {
    id: i.id,
    encounterId: i.encounterId,
    careSpaceId: i.careSpaceId,
    bedCode: espacios.get(i.careSpaceId)?.code ?? '',
    violations: i.violations,
    justification: i.justification,
    authorizedByName: userNameOf(i.authorizedByUserId),
    status: { code: i.statusCode, display: opsConcept(i.statusCode).display },
    reviewedByName: userNameOf(i.reviewedByUserId),
    reviewedAt: i.reviewedAt,
    reviewNote: i.reviewNote,
    createdAt: i.createdAt,
  };
}

const lengthOfStay = (enc: EncounterRow) => stayDays(siteDate(enc.startedAt), siteDate(enc.endedAt ?? Date.now()));

function stayView(enc: EncounterRow): InpatientStay {
  const movs = locations.filtrar((l) => l.encounterId === enc.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const actual = movs.find((l) => l.statusCode === 'LOCATION_ACTIVE' && l.periodEnd === null);
  const reserva = movs.find((l) => l.statusCode === 'LOCATION_RESERVED');
  const attending = PROFESSIONALS.find((p) => p.id === enc.attendingPractitionerId);
  return {
    encounterId: enc.id,
    episodeId: enc.episodeId,
    siteId: enc.siteId,
    status: enc.statusCode,
    patient: patientOf(enc.patientProfileId),
    attendingName: attending?.displayName ?? null,
    levelOfCare: opsConcept(enc.levelOfCareCode),
    admissionSource: opsConcept(enc.admissionSourceCode),
    isolation: opsConcept(enc.isolationCode),
    isolationOrganism: enc.isolationOrganism,
    reasonText: enc.reasonText,
    startedAt: enc.startedAt,
    endedAt: enc.endedAt,
    expectedDischargeAt: enc.expectedDischargeAt,
    disposition: enc.dispositionCode === null ? null : opsConcept(enc.dispositionCode),
    currentBed: actual === undefined ? null : bedOf(actual.careSpaceId),
    reservedBed: reserva === undefined ? null : bedOf(reserva.careSpaceId),
    losDays: lengthOfStay(enc),
    movements: movs.map(locationView),
    incidents: incidents.filtrar((i) => i.encounterId === enc.id).map(incidentView),
    rowVersion: enc.rowVersion,
  };
}

/* ---- guardas -------------------------------------------------------------- */

function encounterVisible(request: MockRequest, id: string | undefined): { enc: EncounterRow; sitio: SitioSimulado } | null {
  const enc = id === undefined ? undefined : encounters.get(id);
  if (enc === undefined) return null;
  const sitio = siteVisible(request, enc.siteId);
  return sitio === null ? null : { enc, sitio };
}

function ifMatchEncounter(request: MockRequest, enc: EncounterRow): MockReply | null {
  const enviada = request.headers.get('If-Match');
  if (enviada === null) return failure(428, 'PRECONDITION_FAILED', 'IF_MATCH_REQUIRED', 'Falta la cabecera If-Match.');
  return Number(enviada.replace(/"/g, '')) === enc.rowVersion
    ? null
    : failure(412, 'CONCURRENCY_CONFLICT', 'ROW_VERSION_MISMATCH', 'Otra persona cambió esta internación. Actualice para ver el estado vigente.', { currentRowVersion: enc.rowVersion });
}

const activeBedOf = (encounterId: string) =>
  locations.filtrar((l) => l.encounterId === encounterId && l.isBedAssignment && l.statusCode === 'LOCATION_ACTIVE' && l.periodEnd === null)[0];

const ctxOf = (request: MockRequest, requestId: string, sourceRefId: string, at?: string): EventContext => ({
  request, requestId, source: 'SRC_ADT', sourceRefId, ...(at === undefined ? {} : { at }),
});

function openLocation(enc: EncounterRow, bed: EspacioSimulado, movement: MovementTypeCode, status: LocationStatusCode, at: string, previous: string | null, incidentId: string | null): LocationRow {
  return locations.agregar({
    id: nuevoId('loc'), tenantId: enc.tenantId, encounterId: enc.id, careSpaceId: bed.id, isBedAssignment: bed.formCode === 'LOC_FORM_BED',
    movementTypeCode: movement, previousLocationId: previous, statusCode: status, periodStart: at, periodEnd: null, endReasonCode: null,
    bedCategoryCode: bed.bedCategoryCode, placementIncidentId: incidentId, createdAt: new Date().toISOString(),
  });
}

function recordIncident(request: MockRequest, enc: EncounterRow, location: LocationRow, violations: readonly CompatibilityViolation[], override: PlacementOverride): IncidentRow {
  const fila = incidents.agregar({
    id: nuevoId('plc'), tenantId: enc.tenantId, encounterId: enc.id, encounterLocationId: location.id, careSpaceId: location.careSpaceId,
    patientProfileId: enc.patientProfileId, violations: violations.map((v) => ({ rule: v.rule, detail: v.detail })),
    justification: override.justification.trim(), authorizedByUserId: request.user?.id ?? null, statusCode: 'PLC_INC_OPEN',
    reviewedByUserId: null, reviewedAt: null, reviewNote: null, createdAt: new Date().toISOString(),
  });
  locations.actualizar(location.id, { placementIncidentId: fila.id });
  return fila;
}

const isOverride = (x: unknown): x is PlacementOverride =>
  typeof x === 'object' && x !== null && typeof (x as PlacementOverride).justification === 'string' && Array.isArray((x as PlacementOverride).ruleCodes);

/* ---- censo ---------------------------------------------------------------- */

function censableBeds(siteId: string, unitId: string): EspacioSimulado[] {
  return espacios.filtrar((e) => e.siteId === siteId && e.clinicalUnitId === unitId && e.formCode === 'LOC_FORM_BED' && e.censable === true && e.statusCode === 'SPACE_ACTIVE');
}

function blockedAt(careSpaceId: string, instant: number): boolean {
  return blocks.todos().some((b) => b.careSpaceId === careSpaceId && b.cancelledAt === null && Date.parse(b.startsAt) <= instant && (b.endedAt === null || Date.parse(b.endedAt) > instant));
}

/** La vista previa de un día abierto (no se persiste) — definiciones de F3.3. */
export function previewCensus(siteId: string, unitId: string, date: string): CensusCounts {
  const corte = Date.parse(cutoffOf(date));
  const inicio = corte - 86_400_000;
  const camas = censableBeds(siteId, unitId);
  const ids = new Set(camas.map((c) => c.id));
  const filas = locations.filtrar((l) => ids.has(l.careSpaceId) && l.isBedAssignment && (l.statusCode === 'LOCATION_ACTIVE' || l.statusCode === 'LOCATION_COMPLETED'));
  const dentro = (iso: string | null) => iso !== null && Date.parse(iso) >= inicio && Date.parse(iso) < corte;
  const presentes = filas.filter((l) => Date.parse(l.periodStart) <= corte && (l.periodEnd === null || Date.parse(l.periodEnd) > corte));
  const egresos = filas.filter((l) => l.endReasonCode === 'ADT_END_DISCHARGE' && dentro(l.periodEnd));
  const mismoDia = egresos.filter((l) => dentro(encounters.get(l.encounterId)?.startedAt ?? null));
  const disponibles = camas.filter((c) => !blockedAt(c.id, corte)).length;
  return counts({
    beds_censable: camas.length,
    beds_available: disponibles,
    beds_blocked: camas.length - disponibles,
    patients_at_cutoff: presentes.length,
    admissions: filas.filter((l) => l.movementTypeCode === 'ADT_ADMIT' && dentro(l.periodStart)).length,
    discharges: egresos.length,
    deaths: egresos.filter((l) => encounters.get(l.encounterId)?.dispositionCode === 'DISP_DEATH').length,
    transfers_in: filas.filter((l) => (l.movementTypeCode === 'ADT_TRANSFER' || l.movementTypeCode === 'ADT_SWAP') && dentro(l.periodStart)).length,
    transfers_out: filas.filter((l) => (l.endReasonCode === 'ADT_END_TRANSFER_OUT' || l.endReasonCode === 'ADT_END_SWAP') && dentro(l.periodEnd)).length,
    same_day_stays: mismoDia.length,
    patient_days: presentes.length + mismoDia.length,
    discharge_stay_days: egresos.reduce((acc, l) => acc + stayDays(siteDate(encounters.get(l.encounterId)!.startedAt), siteDate(l.periodEnd!)), 0),
  });
}

function adjusted(day: CensusDayRow): CensusCounts {
  const propios = adjustments.filtrar((a) => a.censusDayId === day.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return propios.reduce<CensusCounts>((acc, a) => ({ ...acc, [a.fieldCode]: a.newValue }), day.counts);
}

function adjustmentView(a: AdjustmentRow): CensusAdjustment {
  return { ...a, adjustedByName: userNameOf(a.adjustedByUserId) };
}

function censusUnits(siteId: string, unitId: string | null) {
  return unidades
    .filtrar((u) => u.siteId === siteId && (unitId === null || unitId === '' || u.id === unitId))
    .filter((u) => censableBeds(siteId, u.id).length > 0 || censusDays.todos().some((d) => d.unitId === u.id));
}

function censusDayView(siteId: string, unit: { id: string; name: string }, date: string): CensusDay {
  const cerrado = censusDays.todos().find((d) => d.siteId === siteId && d.unitId === unit.id && d.censusDate === date);
  if (cerrado === undefined) {
    const previa = previewCensus(siteId, unit.id, date);
    return { id: null, siteId, unitId: unit.id, unitName: unit.name, censusDate: date, cutoffAt: cutoffOf(date), status: 'CENSUS_OPEN', closedAt: null, closedByName: null, counts: previa, adjustments: [], adjustedCounts: previa };
  }
  return {
    id: cerrado.id, siteId, unitId: unit.id, unitName: unit.name, censusDate: date, cutoffAt: cerrado.cutoffAt, status: 'CENSUS_CLOSED',
    closedAt: cerrado.closedAt, closedByName: cerrado.closedByUserId === null ? 'Cierre automático' : userNameOf(cerrado.closedByUserId),
    counts: cerrado.counts, adjustments: adjustments.filtrar((a) => a.censusDayId === cerrado.id).map(adjustmentView), adjustedCounts: adjusted(cerrado),
  };
}

function turnaroundSamples(siteId: string, from: string, to: string): TurnaroundSample[] {
  const min = (a: string | null, b: string | null) => (a === null || b === null ? 0 : Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60_000)));
  return cleaningOrders
    .filtrar((o) => o.siteId === siteId && o.triggerCode === 'CLN_TRG_DISCHARGE' && (o.statusCode === 'CLN_INSPECTED' || o.statusCode === 'CLN_DONE'))
    .filter((o) => siteDate(o.requestedAt) >= from && siteDate(o.requestedAt) <= to)
    .map((o) => {
      const lista = o.inspectedAt ?? o.finishedAt;
      return { total: min(o.requestedAt, lista), waitToStart: min(o.requestedAt, o.startedAt), cleaning: min(o.startedAt, o.finishedAt), inspection: min(o.finishedAt, o.inspectedAt) };
    });
}

/* ---- rutas ---------------------------------------------------------------- */

const VALID = {
  levels: ['LOC_CARE_GENERAL', 'LOC_CARE_INTERMEDIATE', 'LOC_CARE_ICU', 'LOC_CARE_NEONATAL_ICU'],
  sources: ['ADM_SRC_EMERGENCY', 'ADM_SRC_OUTPATIENT', 'ADM_SRC_REFERRAL', 'ADM_SRC_BIRTH', 'ADM_SRC_TRANSFER_IN'],
  dispositions: ['DISP_HOME', 'DISP_TRANSFER', 'DISP_DEATH', 'DISP_AGAINST_ADVICE', 'DISP_OTHER'],
} as const;

const validationFailed = (violations: readonly string[]) => failure(422, 'VALIDATION_FAILED', 'VALIDATION_FAILED', 'Error de validación', { violations });

export function registerAdt(router: MockRouter): void {
  router.post('/clinical/bed-compatibility', (request) => {
    const datos = cuerpo<{ careSpaceId: string; patientProfileId: string; levelOfCareCode: LevelOfCareCode; isolationPrecautionCode: string; isolationOrganismText: string }>(request);
    const bed = spaceVisible(request, datos.careSpaceId);
    if (bed === null || patientById(datos.patientProfileId ?? '') === undefined) return notFoundReply();
    const sitio = sitiosInfra.get(bed.siteId)!;
    if (!can(request, sitio, 'adt.admit')) return forbiddenAction('adt.admit');
    const v = compatibility(bed, { patientProfileId: datos.patientProfileId!, levelOfCareCode: datos.levelOfCareCode ?? 'LOC_CARE_GENERAL', isolationCode: datos.isolationPrecautionCode ?? 'ISO_NONE', organism: datos.isolationOrganismText ?? null });
    return { assignable: v.length === 0, violations: v };
  });

  router.post('/clinical/encounters/:id/bed-compatibility', (request) => {
    const g = encounterVisible(request, request.params['id']);
    const datos = cuerpo<{ careSpaceId: string }>(request);
    const bed = spaceVisible(request, datos.careSpaceId);
    if (g === null || bed === null) return notFoundReply();
    if (!can(request, g.sitio, 'adt.transfer')) return forbiddenAction('adt.transfer');
    const v = compatibility(bed, { patientProfileId: g.enc.patientProfileId, levelOfCareCode: g.enc.levelOfCareCode, isolationCode: g.enc.isolationCode, organism: g.enc.isolationOrganism, ignoreEncounters: [g.enc.id] });
    return { assignable: v.length === 0, violations: v };
  });

  router.post('/clinical/admissions', (request) => {
    const d = cuerpo<{
      patientProfileId: string; practiceSiteId: string; episodeId: string; attendingPractitionerId: string; levelOfCareCode: LevelOfCareCode;
      admissionSourceCode: string; isolationPrecautionCode: string; isolationOrganismText: string; reasonText: string; expectedDischargeAt: string;
      bed: { careSpaceId: string; mode: 'ASSIGN' | 'RESERVE' }; override: unknown;
    }>(request);
    const sitio = siteVisible(request, d.practiceSiteId);
    if (sitio === null) return notFoundReply();
    if (!can(request, sitio, 'adt.admit')) return forbiddenAction('adt.admit');
    const faltan: string[] = [];
    if (!d.patientProfileId) faltan.push('patientProfileId should not be empty');
    if (!d.attendingPractitionerId) faltan.push('attendingPractitionerId should not be empty');
    if (!d.levelOfCareCode || !(VALID.levels as readonly string[]).includes(d.levelOfCareCode)) faltan.push('levelOfCareCode must be one of the catalog codes');
    if (!d.admissionSourceCode || !(VALID.sources as readonly string[]).includes(d.admissionSourceCode)) faltan.push('admissionSourceCode must be one of the catalog codes');
    if (typeof d.reasonText !== 'string' || d.reasonText.trim() === '') faltan.push('reasonText should not be empty');
    if (faltan.length > 0) return validationFailed(faltan);
    if (patientById(d.patientProfileId!) === undefined) return notFoundReply();
    const yaInternado = encounters.todos().find((e) => e.patientProfileId === d.patientProfileId && e.tenantId === sitio.tenantId && e.statusCode === 'IN_PROGRESS');
    if (yaInternado !== undefined) return conflictReply('PATIENT_ALREADY_ADMITTED', 'Esta persona ya tiene una internación en curso.', { encounterId: yaInternado.id });
    const isolation = d.isolationPrecautionCode ?? 'ISO_NONE';
    const override = isOverride(d.override) ? d.override : undefined;
    let bed: EspacioSimulado | null = null;
    let violations: CompatibilityViolation[] = [];
    if (d.bed !== undefined && d.bed !== null) {
      bed = spaceVisible(request, d.bed.careSpaceId);
      if (bed === null || bed.siteId !== sitio.id) return notFoundReply();
      if (bed.formCode !== 'LOC_FORM_BED') return precondition('SPACE_NOT_A_BED', 'El espacio elegido no es una cama.');
      violations = compatibility(bed, { patientProfileId: d.patientProfileId!, levelOfCareCode: d.levelOfCareCode!, isolationCode: isolation, organism: d.isolationOrganismText ?? null });
      const veredicto = placementReply(request, sitio, violations, override);
      if (veredicto !== null) return veredicto;
    }
    const requestId = newRequestId();
    const at = new Date().toISOString();
    const enc = encounters.agregar({
      id: nuevoId('enc'), tenantId: sitio.tenantId, siteId: sitio.id, patientProfileId: d.patientProfileId!, episodeId: d.episodeId ?? nuevoId('epi'),
      statusCode: 'IN_PROGRESS', levelOfCareCode: d.levelOfCareCode!, admissionSourceCode: d.admissionSourceCode!, isolationCode: isolation,
      isolationOrganism: d.isolationOrganismText?.trim() || null, reasonText: d.reasonText!.trim(), attendingPractitionerId: d.attendingPractitionerId!,
      expectedDischargeAt: d.expectedDischargeAt ?? null, startedAt: at, endedAt: null, dispositionCode: null, rowVersion: 1,
    });
    if (bed === null) return reply(201, { episodeId: enc.episodeId, encounterId: enc.id, requestId });
    const reserva = d.bed!.mode === 'RESERVE';
    const loc = openLocation(enc, bed, reserva ? 'ADT_RESERVE' : 'ADT_ADMIT', reserva ? 'LOCATION_RESERVED' : 'LOCATION_ACTIVE', at, null, null);
    const incidente = override !== undefined && violations.length > 0 ? recordIncident(request, enc, loc, violations, override) : null;
    recordOccupancyChange(bed.id, 'OCC_FREE', reserva ? 'OCC_RESERVED' : 'OCC_OCCUPIED', ctxOf(request, requestId, loc.id));
    return reply(201, {
      episodeId: enc.episodeId, encounterId: enc.id, encounterLocationId: loc.id, cell: buildCell(espacios.get(bed.id)!, actionsOf(rolesIn(request, sitio))),
      ...(incidente === null ? {} : { incidentId: incidente.id }), requestId,
    });
  });

  router.post('/clinical/encounters/:id/bed-assignment', (request) => {
    const g = encounterVisible(request, request.params['id']);
    if (g === null) return notFoundReply();
    const { enc, sitio } = g;
    if (!can(request, sitio, 'adt.admit')) return forbiddenAction('adt.admit');
    const version = ifMatchEncounter(request, enc);
    if (version !== null) return version;
    if (enc.statusCode !== 'IN_PROGRESS') return conflictReply('ENCOUNTER_NOT_IN_PROGRESS', 'La internación ya terminó.');
    if (activeBedOf(enc.id) !== undefined) return conflictReply('ENCOUNTER_ALREADY_HAS_BED', 'La internación ya tiene cama: use el traslado.');
    const d = cuerpo<{ careSpaceId: string; mode: 'ASSIGN' | 'RESERVE'; override: unknown }>(request);
    const bed = spaceVisible(request, d.careSpaceId);
    if (bed === null || bed.siteId !== sitio.id) return notFoundReply();
    if (bed.formCode !== 'LOC_FORM_BED') return precondition('SPACE_NOT_A_BED', 'El espacio elegido no es una cama.');
    const override = isOverride(d.override) ? d.override : undefined;
    const violations = compatibility(bed, { patientProfileId: enc.patientProfileId, levelOfCareCode: enc.levelOfCareCode, isolationCode: enc.isolationCode, organism: enc.isolationOrganism, ignoreEncounters: [enc.id] });
    const veredicto = placementReply(request, sitio, violations, override);
    if (veredicto !== null) return veredicto;
    const requestId = newRequestId();
    const at = new Date().toISOString();
    const reservaPropia = locations.filtrar((l) => l.encounterId === enc.id && l.statusCode === 'LOCATION_RESERVED')[0];
    const reserva = d.mode === 'RESERVE';
    if (reservaPropia !== undefined) {
      const cerrar = reservaPropia.careSpaceId === bed.id && !reserva
        ? { statusCode: 'LOCATION_COMPLETED' as const, endReasonCode: 'ADT_END_RESERVATION_CONVERTED' }
        : { statusCode: 'LOCATION_CANCELLED' as const, endReasonCode: 'ADT_END_RESERVATION_CANCELLED' };
      locations.actualizar(reservaPropia.id, { ...cerrar, periodEnd: at });
      if (reservaPropia.careSpaceId !== bed.id) recordOccupancyChange(reservaPropia.careSpaceId, 'OCC_RESERVED', 'OCC_FREE', ctxOf(request, requestId, reservaPropia.id));
    }
    const loc = openLocation(enc, bed, reserva ? 'ADT_RESERVE' : 'ADT_ADMIT', reserva ? 'LOCATION_RESERVED' : 'LOCATION_ACTIVE', at, reservaPropia?.id ?? null, null);
    const incidente = override !== undefined && violations.length > 0 ? recordIncident(request, enc, loc, violations, override) : null;
    const antes: OccupancyCode = reservaPropia?.careSpaceId === bed.id ? 'OCC_RESERVED' : 'OCC_FREE';
    recordOccupancyChange(bed.id, antes, reserva ? 'OCC_RESERVED' : 'OCC_OCCUPIED', ctxOf(request, requestId, loc.id));
    encounters.actualizar(enc.id, { rowVersion: enc.rowVersion + 1 });
    return { encounterLocationId: loc.id, cell: buildCell(espacios.get(bed.id)!, actionsOf(rolesIn(request, sitio))), ...(incidente === null ? {} : { incidentId: incidente.id }), requestId };
  });

  router.post('/clinical/encounters/:id/transfer', (request) => {
    const g = encounterVisible(request, request.params['id']);
    if (g === null) return notFoundReply();
    const { enc, sitio } = g;
    if (!can(request, sitio, 'adt.transfer')) return forbiddenAction('adt.transfer');
    const version = ifMatchEncounter(request, enc);
    if (version !== null) return version;
    const d = cuerpo<{ toCareSpaceId: string; occurredAt: string; reasonCode: string; override: unknown }>(request);
    const origen = activeBedOf(enc.id);
    if (enc.statusCode !== 'IN_PROGRESS' || origen === undefined) return conflictReply('ENCOUNTER_HAS_NO_BED', 'La internación no tiene una cama ocupada.');
    const destino = spaceVisible(request, d.toCareSpaceId);
    if (destino === null || destino.siteId !== sitio.id) return notFoundReply();
    if (destino.id === origen.careSpaceId) return precondition('TRANSFER_TO_SAME_BED', 'El destino es la misma cama.');
    if (destino.formCode !== 'LOC_FORM_BED') return precondition('SPACE_NOT_A_BED', 'El espacio elegido no es una cama.');
    const t = typeof d.occurredAt === 'string' && d.occurredAt !== '' ? d.occurredAt : new Date().toISOString();
    if (Date.parse(t) > Date.now() + 60_000) return precondition('OCCURRED_AT_IN_FUTURE', 'El traslado no puede ser en el futuro.');
    if (Date.parse(t) < Date.parse(origen.periodStart)) return precondition('OCCURRED_AT_BEFORE_CURRENT_START', 'El traslado no puede ser anterior al inicio de la cama actual.');
    const override = isOverride(d.override) ? d.override : undefined;
    const violations = compatibility(destino, { patientProfileId: enc.patientProfileId, levelOfCareCode: enc.levelOfCareCode, isolationCode: enc.isolationCode, organism: enc.isolationOrganism, ignoreEncounters: [enc.id] });
    const veredicto = placementReply(request, sitio, violations, override);
    if (veredicto !== null) return veredicto;
    // Validado todo: recién ahora se escribe, todo junto (en locA API, una transacción).
    const requestId = newRequestId();
    locations.actualizar(origen.id, { statusCode: 'LOCATION_COMPLETED', periodEnd: t, endReasonCode: 'ADT_END_TRANSFER_OUT' });
    const created = openLocation(enc, destino, 'ADT_TRANSFER', 'LOCATION_ACTIVE', t, origen.id, null);
    if (override !== undefined && violations.length > 0) recordIncident(request, enc, created, violations, override);
    const ctx = ctxOf(request, requestId, created.id, t);
    recordOccupancyChange(origen.careSpaceId, 'OCC_OCCUPIED', 'OCC_FREE', ctx);
    recordOccupancyChange(destino.id, 'OCC_FREE', 'OCC_OCCUPIED', ctx);
    const orden = markDirtyFromSource(origen.careSpaceId, { trigger: 'CLN_TRG_TRANSFER', sourceRefId: origen.id, terminal: enc.isolationCode !== 'ISO_NONE', ctx });
    encounters.actualizar(enc.id, { rowVersion: enc.rowVersion + 1 });
    return { fromLocationId: origen.id, toLocationId: created.id, cleaningOrderId: orden, requestId };
  });

  router.post('/clinical/bed-swaps', (request) => {
    const d = cuerpo<{ encounterAId: string; encounterBId: string; occurredAt: string; reasonText: string; override: unknown }>(request);
    const a = encounterVisible(request, d.encounterAId);
    const b = encounterVisible(request, d.encounterBId);
    if (a === null || b === null) return notFoundReply();
    if (!can(request, a.sitio, 'adt.transfer')) return forbiddenAction('adt.transfer');
    if (a.enc.id === b.enc.id) return conflictReply('SWAP_SAME_ENCOUNTER', 'Elija dos internaciones distintas.');
    const locA = activeBedOf(a.enc.id);
    const locB = activeBedOf(b.enc.id);
    if (locA === undefined || locB === undefined || a.enc.siteId !== b.enc.siteId) return conflictReply('SWAP_REQUIRES_TWO_OCCUPIED_BEDS', 'El intercambio exige dos camas ocupadas del mismo establecimiento.');
    if (typeof d.reasonText !== 'string' || d.reasonText.trim() === '') return validationFailed(['reasonText should not be empty']);
    const ambos = [a.enc.id, b.enc.id];
    const camaA = espacios.get(locA.careSpaceId)!;
    const camaB = espacios.get(locB.careSpaceId)!;
    const violations = [
      ...compatibility(camaB, { patientProfileId: a.enc.patientProfileId, levelOfCareCode: a.enc.levelOfCareCode, isolationCode: a.enc.isolationCode, organism: a.enc.isolationOrganism, ignoreEncounters: ambos, treatAsFree: true }),
      ...compatibility(camaA, { patientProfileId: b.enc.patientProfileId, levelOfCareCode: b.enc.levelOfCareCode, isolationCode: b.enc.isolationCode, organism: b.enc.isolationOrganism, ignoreEncounters: ambos, treatAsFree: true }),
    ];
    const override = isOverride(d.override) ? d.override : undefined;
    const veredicto = placementReply(request, a.sitio, violations, override);
    if (veredicto !== null) return veredicto;
    const requestId = newRequestId();
    const t = typeof d.occurredAt === 'string' && d.occurredAt !== '' ? d.occurredAt : new Date().toISOString();
    locations.actualizar(locA.id, { statusCode: 'LOCATION_COMPLETED', periodEnd: t, endReasonCode: 'ADT_END_SWAP' });
    locations.actualizar(locB.id, { statusCode: 'LOCATION_COMPLETED', periodEnd: t, endReasonCode: 'ADT_END_SWAP' });
    const na = openLocation(a.enc, camaB, 'ADT_SWAP', 'LOCATION_ACTIVE', t, locA.id, null);
    const nb = openLocation(b.enc, camaA, 'ADT_SWAP', 'LOCATION_ACTIVE', t, locB.id, null);
    if (override !== undefined && violations.length > 0) recordIncident(request, a.enc, na, violations, override);
    const ctx = ctxOf(request, requestId, na.id, t);
    recordOccupancyChange(camaA.id, 'OCC_OCCUPIED', 'OCC_OCCUPIED', ctx);
    recordOccupancyChange(camaB.id, 'OCC_OCCUPIED', 'OCC_OCCUPIED', ctx);
    if (INFRA_SETTINGS.swapRequiresCleaning) {
      markDirtyFromSource(camaA.id, { trigger: 'CLN_TRG_TRANSFER', sourceRefId: locA.id, terminal: false, ctx });
      markDirtyFromSource(camaB.id, { trigger: 'CLN_TRG_TRANSFER', sourceRefId: locB.id, terminal: false, ctx });
    }
    encounters.actualizar(a.enc.id, { rowVersion: a.enc.rowVersion + 1 });
    encounters.actualizar(b.enc.id, { rowVersion: b.enc.rowVersion + 1 });
    return { locations: [locA.id, locB.id, na.id, nb.id].map((id) => locationView(locations.get(id)!)), requestId };
  });

  router.post('/clinical/encounters/:id/discharge', (request) => {
    const g = encounterVisible(request, request.params['id']);
    if (g === null) return notFoundReply();
    const { enc, sitio } = g;
    if (!can(request, sitio, 'adt.discharge')) return forbiddenAction('adt.discharge');
    const version = ifMatchEncounter(request, enc);
    if (version !== null) return version;
    if (enc.statusCode !== 'IN_PROGRESS') return conflictReply('ENCOUNTER_NOT_IN_PROGRESS', 'La internación ya terminó.');
    const d = cuerpo<{ dischargeDispositionCode: string; occurredAt: string; reasonText: string }>(request);
    if (!d.dischargeDispositionCode || !(VALID.dispositions as readonly string[]).includes(d.dischargeDispositionCode)) {
      return precondition('DISCHARGE_DISPOSITION_REQUIRED', 'Indique el tipo de egreso.', { field: 'dischargeDispositionCode' });
    }
    const t = typeof d.occurredAt === 'string' && d.occurredAt !== '' ? d.occurredAt : new Date().toISOString();
    if (Date.parse(t) > Date.now() + 60_000) return precondition('OCCURRED_AT_IN_FUTURE', 'El egreso no puede ser en el futuro.');
    const requestId = newRequestId();
    const actual = activeBedOf(enc.id);
    let orden: string | null = null;
    for (const r of locations.filtrar((l) => l.encounterId === enc.id && l.statusCode === 'LOCATION_RESERVED')) {
      locations.actualizar(r.id, { statusCode: 'LOCATION_CANCELLED', periodEnd: t, endReasonCode: 'ADT_END_RESERVATION_CANCELLED' });
      recordOccupancyChange(r.careSpaceId, 'OCC_RESERVED', 'OCC_FREE', ctxOf(request, requestId, r.id, t));
    }
    encounters.actualizar(enc.id, { statusCode: 'FINISHED', endedAt: t, dispositionCode: d.dischargeDispositionCode!, rowVersion: enc.rowVersion + 1 });
    if (actual !== undefined) {
      locations.actualizar(actual.id, { statusCode: 'LOCATION_COMPLETED', periodEnd: t, endReasonCode: 'ADT_END_DISCHARGE' });
      const ctx = ctxOf(request, requestId, actual.id, t);
      recordOccupancyChange(actual.careSpaceId, 'OCC_OCCUPIED', 'OCC_FREE', ctx);
      orden = markDirtyFromSource(actual.careSpaceId, { trigger: 'CLN_TRG_DISCHARGE', sourceRefId: actual.id, terminal: enc.isolationCode !== 'ISO_NONE', ctx });
    }
    return { encounterId: enc.id, cleaningOrderId: orden, requestId };
  });

  router.post('/clinical/encounter-locations/:id/cancel', (request) => {
    const loc = locations.get(request.params['id']!);
    const g = loc === undefined ? null : encounterVisible(request, loc.encounterId);
    if (loc === undefined || g === null) return notFoundReply();
    if (!can(request, g.sitio, 'adt.cancel')) return forbiddenAction('adt.cancel');
    const d = cuerpo<{ reasonText: string }>(request);
    if (typeof d.reasonText !== 'string' || d.reasonText.trim() === '') return validationFailed(['reasonText should not be empty']);
    const requestId = newRequestId();
    const at = new Date().toISOString();
    if (loc.statusCode === 'LOCATION_RESERVED') {
      locations.actualizar(loc.id, { statusCode: 'LOCATION_CANCELLED', periodEnd: at, endReasonCode: 'ADT_END_RESERVATION_CANCELLED' });
      recordOccupancyChange(loc.careSpaceId, 'OCC_RESERVED', 'OCC_FREE', ctxOf(request, requestId, loc.id));
      return { requestId };
    }
    if (loc.statusCode !== 'LOCATION_ACTIVE' || loc.movementTypeCode !== 'ADT_TRANSFER' || loc.previousLocationId === null) {
      return conflictReply('LOCATION_NOT_CANCELLABLE', 'Sólo se cancela una reserva o un traslado reciente.');
    }
    if (Date.now() - Date.parse(loc.createdAt) > INFRA_SETTINGS.adtCancelWindowMinutes * 60_000) {
      return conflictReply('ADT_CANCEL_WINDOW_EXPIRED', 'Pasó la ventana para cancelar el traslado.');
    }
    const previa = locations.get(loc.previousLocationId)!;
    const camaPrevia = espacios.get(previa.careSpaceId)!;
    const d0 = axesOf(camaPrevia);
    if (d0.occ.code !== 'OCC_FREE' || d0.axes.availabilityCode !== 'SPACE_OP_AVAILABLE') {
      return conflictReply('PREVIOUS_BED_NO_LONGER_AVAILABLE', 'La cama anterior ya no está libre.');
    }
    locations.actualizar(loc.id, { statusCode: 'LOCATION_CANCELLED', periodEnd: at, endReasonCode: 'ADT_END_TRANSFER_CANCELLED' });
    locations.actualizar(previa.id, { statusCode: 'LOCATION_ACTIVE', periodEnd: null, endReasonCode: null });
    recordOccupancyChange(loc.careSpaceId, 'OCC_OCCUPIED', 'OCC_FREE', ctxOf(request, requestId, loc.id));
    recordOccupancyChange(previa.careSpaceId, 'OCC_FREE', 'OCC_OCCUPIED', ctxOf(request, requestId, previa.id));
    encounters.actualizar(g.enc.id, { rowVersion: g.enc.rowVersion + 1 });
    return { requestId };
  });

  router.get('/sites/:siteId/inpatients', (request) => {
    const sitio = siteVisible(request, request.params['siteId']);
    if (sitio === null) return notFoundReply();
    if (!can(request, sitio, 'board.view-patient')) return forbiddenAction('board.view-patient');
    const unidad = request.query.get('unitId');
    const items = encounters
      .filtrar((e) => e.siteId === sitio.id && e.statusCode === 'IN_PROGRESS')
      .map((e) => ({ e, l: activeBedOf(e.id) }))
      .filter(({ l }) => unidad === null || unidad === '' || (l !== undefined && espacios.get(l.careSpaceId)?.clinicalUnitId === unidad))
      .map(({ e, l }) => ({
        encounterId: e.id, patient: patientOf(e.patientProfileId), bed: l === undefined ? null : bedOf(l.careSpaceId), since: l?.periodStart ?? e.startedAt,
        levelOfCare: opsConcept(e.levelOfCareCode), isolation: opsConcept(e.isolationCode), expectedDischargeAt: e.expectedDischargeAt, losDays: lengthOfStay(e), rowVersion: e.rowVersion,
      }));
    return { items, nextCursor: null };
  });

  router.get('/clinical/encounters/:id/stay', (request) => {
    const g = encounterVisible(request, request.params['id']);
    if (g === null) return notFoundReply();
    if (!can(request, g.sitio, 'board.view-patient')) return forbiddenAction('board.view-patient');
    return stayView(g.enc);
  });

  router.patch('/clinical/placement-incidents/:id', (request) => {
    const inc = incidents.get(request.params['id']!);
    const g = inc === undefined ? null : encounterVisible(request, inc.encounterId);
    if (inc === undefined || g === null) return notFoundReply();
    if (!can(request, g.sitio, 'incident.review')) return forbiddenAction('incident.review');
    const d = cuerpo<{ status: 'PLC_INC_REVIEWED' | 'PLC_INC_CLOSED'; reviewNote: string }>(request);
    if (d.status !== 'PLC_INC_REVIEWED' && d.status !== 'PLC_INC_CLOSED') return validationFailed(['status must be PLC_INC_REVIEWED or PLC_INC_CLOSED']);
    if (typeof d.reviewNote !== 'string' || d.reviewNote.trim() === '') return validationFailed(['reviewNote should not be empty']);
    return incidentView(incidents.actualizar(inc.id, { statusCode: d.status, reviewNote: d.reviewNote.trim(), reviewedByUserId: request.user?.id ?? null, reviewedAt: new Date().toISOString() })!);
  });

  router.get('/clinical/patients/:id/inpatient-stay', (request) => {
    const tenant = request.headers.get('X-Tenant-Id');
    const enc = encounters.todos().find((e) => e.patientProfileId === request.params['id'] && e.statusCode === 'IN_PROGRESS' && (tenant === null || e.tenantId === tenant));
    if (enc === undefined) return null;
    const sitio = sitiosInfra.get(enc.siteId)!;
    const l = activeBedOf(enc.id);
    return { encounterId: enc.id, siteId: sitio.id, siteName: sitio.name, bed: l === undefined ? null : bedOf(l.careSpaceId), since: l?.periodStart ?? enc.startedAt, levelOfCare: opsConcept(enc.levelOfCareCode) };
  });

  router.get('/sites/:siteId/attending-practitioners', (request) => {
    const sitio = siteVisible(request, request.params['siteId']);
    if (sitio === null) return notFoundReply();
    return PROFESSIONALS.slice(0, 6).map((p) => ({ id: p.id, displayName: p.displayName }));
  });

  router.get('/sites/:siteId/census', (request) => {
    const sitio = siteVisible(request, request.params['siteId']);
    if (sitio === null) return notFoundReply();
    if (!can(request, sitio, 'census.view')) return forbiddenAction('census.view');
    const day = request.query.get('date') ?? shiftDate(siteDate(Date.now()), -1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return validationFailed(['date must be YYYY-MM-DD']);
    return {
      siteId: sitio.id,
      date: day,
      generatedAt: new Date().toISOString(),
      closableFrom: new Date(Date.parse(cutoffOf(day)) + INFRA_SETTINGS.censusCloseGraceMinutes * 60_000).toISOString(),
      days: censusUnits(sitio.id, request.query.get('unitId')).map((u) => censusDayView(sitio.id, u, day)),
    };
  });

  router.post('/sites/:siteId/census/:date/close', (request) => {
    const sitio = siteVisible(request, request.params['siteId']);
    if (sitio === null) return notFoundReply();
    if (!can(request, sitio, 'census.close')) return forbiddenAction('census.close');
    const day = request.params['date']!;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return validationFailed(['date must be YYYY-MM-DD']);
    if (Date.now() < Date.parse(cutoffOf(day)) + INFRA_SETTINGS.censusCloseGraceMinutes * 60_000) {
      return precondition('CENSUS_DATE_NOT_ENDED', 'El día todavía no terminó: se cierra después del corte de medianoche.');
    }
    const d = cuerpo<{ unitIds: string[] }>(request);
    const objetivo = censusUnits(sitio.id, null).filter((u) => d.unitIds === undefined || d.unitIds.includes(u.id));
    const abiertas = objetivo.filter((u) => !censusDays.todos().some((x) => x.unitId === u.id && x.censusDate === day));
    if (abiertas.length === 0) return conflictReply('CENSUS_ALREADY_CLOSED', 'El censo de ese día ya está cerrado.');
    const requestId = newRequestId();
    for (const u of abiertas) {
      censusDays.agregar({
        id: nuevoId('cen'), tenantId: sitio.tenantId, siteId: sitio.id, unitId: u.id, censusDate: day, cutoffAt: cutoffOf(day),
        closedAt: new Date().toISOString(), closedByUserId: request.user?.id ?? null, counts: previewCensus(sitio.id, u.id, day),
      });
    }
    return { closed: abiertas.map((u) => censusDayView(sitio.id, u, day)), requestId };
  });

  router.post('/census-days/:id/adjustments', (request) => {
    const dia = censusDays.get(request.params['id']!);
    const sitio = dia === undefined ? null : siteVisible(request, dia.siteId);
    if (dia === undefined || sitio === null) return notFoundReply();
    if (!can(request, sitio, 'census.adjust')) return forbiddenAction('census.adjust');
    const d = cuerpo<{ fieldCode: CensusField; newValue: number; reasonText: string; entryRefId: string }>(request);
    if (!d.fieldCode || !(CENSUS_FIELDS as readonly string[]).includes(d.fieldCode)) return precondition('ADJUSTMENT_FIELD_INVALID', 'Ese campo del censo no se puede ajustar.', { field: 'fieldCode' });
    if (typeof d.newValue !== 'number' || !Number.isInteger(d.newValue) || d.newValue < 0) return validationFailed(['newValue must be a non-negative integer']);
    if (typeof d.reasonText !== 'string' || d.reasonText.trim() === '') return precondition('ADJUSTMENT_REASON_REQUIRED', 'Todo ajuste exige un motivo.', { field: 'reasonText' });
    const requestId = newRequestId();
    const fila = adjustments.agregar({
      id: nuevoId('adj'), tenantId: dia.tenantId, censusDayId: dia.id, fieldCode: d.fieldCode, previousValue: adjusted(dia)[d.fieldCode],
      newValue: d.newValue, reasonText: d.reasonText.trim(), adjustedByUserId: request.user?.id ?? null, requestId, createdAt: new Date().toISOString(),
    });
    return reply(201, adjustmentView(fila));
  });

  router.get('/sites/:siteId/inpatient-indicators', (request) => {
    const sitio = siteVisible(request, request.params['siteId']);
    if (sitio === null) return notFoundReply();
    if (!can(request, sitio, 'indicators.view')) return forbiddenAction('indicators.view');
    const hoy = siteDate(Date.now());
    const to = request.query.get('to') ?? shiftDate(hoy, -1);
    const from = request.query.get('from') ?? shiftDate(to, -6);
    const dias = daysBetween(from, to);
    if (dias.length === 0) return validationFailed(['from must be before to']);
    if (dias.length > 366) return precondition('INDICATOR_RANGE_TOO_LONG', 'El rango no puede superar los 366 días.');
    const siteUnits = censusUnits(sitio.id, request.query.get('unitId'));
    const cerrados = (unitId: string) => censusDays.filtrar((x) => x.unitId === unitId && dias.includes(x.censusDate));
    const byUnit = siteUnits.map((u) => ({ unitId: u.id, unitName: u.name, ...indicatorTotals(cerrados(u.id).map(adjusted)) }));
    const todos = siteUnits.flatMap((u) => cerrados(u.id));
    // Por día del sitio: se suman las unidades de ese día.
    const byDay = dias
      .map((f) => todos.filter((x) => x.censusDate === f).map(adjusted))
      .filter((l) => l.length > 0)
      .map((l) => l.reduce<CensusCounts>((acc, c) => counts(Object.fromEntries(CENSUS_FIELDS.map((k) => [k, acc[k] + c[k]])) as Partial<CensusCounts>), counts({})));
    const faltan = dias.filter((f) => f < hoy && siteUnits.some((u) => !cerrados(u.id).some((x) => x.censusDate === f)));
    return {
      siteId: sitio.id,
      period: { from, to },
      ...indicatorTotals(byDay),
      bedTurnaroundMinutes: bedTurnaround(turnaroundSamples(sitio.id, from, to)),
      crossCheck: crossCheck(byDay),
      coverage: { daysClosed: byDay.length, daysMissing: faltan },
      byUnit: byUnit,
      generatedAt: new Date().toISOString(),
    };
  });
}

encounters.persistirEn('mock.adt.encuentros');
locations.persistirEn('mock.adt.ubicaciones');
incidents.persistirEn('mock.adt.incidentes');
censusDays.persistirEn('mock.adt.censo');
adjustments.persistirEn('mock.adt.ajustes');


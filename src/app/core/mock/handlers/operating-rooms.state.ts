import { CHECKLIST_PHASES, clippedMinutes, intervalOf, releaseAtOf, reservedWindow, type ChecklistPhaseCode } from '../../data-access/operating-rooms/operating-rooms.rules';
import type { OrBlock, OrBlockOwner } from '../../data-access/operating-rooms/operating-rooms.types';
import { PROFESSIONALS } from '../fixtures/people';
import { reply, type MockReply, type MockRequest } from '../mock-router';
import { Coleccion, fecha, uuid } from '../mock-store';
import { espacios, sitiosInfra } from './infrastructure.handlers';
import { CASE_STATUS, periopCases, type SimulatedCase } from './procedures.handlers';

/* ============================================================================
    Estado compartido de la maqueta de quirófanos (F4): bloques, check-lists y
    tiempos de sala, más las reglas que la API aplica y la pantalla refleja.

    Los quirófanos son los espacios de F1 (`QUIROFANO_1/2` = `QX-01/02` de San
    Lucas), así que el tenant, la sede y la función salen del árbol real del
    simulador y nunca de un id escrito acá.
    ========================================================================== */

export interface SimulatedBlock {
  readonly id: string;
  readonly tenantId: string;
  readonly siteId: string;
  readonly seriesId: string | null;
  readonly operatingRoomId: string;
  readonly ownerKind: 'SERVICE' | 'SURGEON';
  readonly clinicalUnitId: string | null;
  readonly specialtyCode: string | null;
  readonly surgeonProfileId: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly releaseHours: number;
  readonly status: 'ORB_ACTIVE' | 'ORB_RELEASED' | 'ORB_CANCELLED';
  readonly releasedAt: string | null;
  readonly releasedByUserId: string | null;
  readonly releaseReason: string | null;
  readonly releasedMinutes: number | null;
  readonly rowVersion: number;
}

export interface SimulatedChecklist {
  readonly id: string;
  readonly caseId: string;
  /** Respuestas por fase: `itemId → {status, exceptionReason}`. */
  readonly responses: Readonly<Record<string, { status: string; exceptionReason: string | null; respondedAt: string }>>;
  readonly completedAt: Readonly<Record<ChecklistPhaseCode, string | null>>;
}

export interface SimulatedRoomEvent {
  readonly id: string;
  readonly caseId: string;
  readonly eventCode: string;
  readonly occurredAt: string;
  readonly recordedAt: string;
}

/* ---- check-list OMS 2009: Entrada 7 · Pausa 7 · Salida 5 -------------------- */

const PROMPTS: Readonly<Record<ChecklistPhaseCode, readonly string[]>> = {
  SIGN_IN: [
    'El paciente confirmó su identidad, el sitio quirúrgico, el procedimiento y su consentimiento.',
    'El sitio quirúrgico está marcado (o no procede).',
    'Se completó el control de seguridad del equipo y la medicación de anestesia.',
    'El pulsioxímetro está colocado y funciona.',
    'Se verificaron las alergias conocidas del paciente.',
    'Se evaluó la vía aérea difícil o el riesgo de aspiración.',
    'Se evaluó el riesgo de hemorragia mayor a 500 ml (7 ml/kg en niños).',
  ],
  TIME_OUT: [
    'Todos los miembros del equipo se presentaron por su nombre y función.',
    'Cirujano, anestesista y enfermería confirman paciente, sitio y procedimiento.',
    'Se administró la profilaxis antibiótica en los últimos 60 minutos (o no procede).',
    'Cirugía: pasos críticos, duración prevista y pérdida de sangre esperada.',
    'Anestesia: problemas específicos del paciente.',
    'Enfermería: esterilidad confirmada y sin problemas con el instrumental.',
    'Las imágenes diagnósticas esenciales están a la vista (o no procede).',
  ],
  SIGN_OUT: [
    'Se registró el nombre del procedimiento realizado.',
    'El recuento de instrumentos, gasas y agujas es correcto.',
    'Las muestras están etiquetadas con el nombre del paciente.',
    'Se anotaron los problemas del instrumental y los equipos.',
    'Se revisaron los aspectos críticos de la recuperación del paciente.',
  ],
};

export const CHECKLIST_ITEMS: Readonly<Record<ChecklistPhaseCode, readonly { id: string; prompt: string; mandatory: boolean }[]>> = Object.fromEntries(
  CHECKLIST_PHASES.map((phase) => [phase, PROMPTS[phase].map((prompt, i) => ({ id: uuid(`who-2009-${phase}-${i + 1}`), prompt, mandatory: true }))]),
) as Record<ChecklistPhaseCode, { id: string; prompt: string; mandatory: boolean }[]>;

/* ---- errores con el cuerpo común de DomainException ------------------------- */

let sequence = 0;

export function failure(status: number, code: string, reason: string, message: string, details: Record<string, unknown> = {}): MockReply {
  sequence += 1;
  return reply(status, {
    statusCode: status,
    code,
    reason,
    message,
    details: { ...details, reason },
    correlationId: `req-periop-${Date.now().toString(36)}-${sequence}`,
    timestamp: new Date().toISOString(),
    path: '',
  });
}

export const notFoundReply = (): MockReply => failure(404, 'NOT_FOUND', 'NOT_FOUND', 'No encontrado');
export const forbiddenReply = (message: string, requiredRoles: readonly string[]): MockReply =>
  failure(403, 'FORBIDDEN', 'INFRA_ACTION_NOT_ALLOWED', message, { requiredRoles });
export const preconditionReply = (reason: string, message: string, details: Record<string, unknown> = {}): MockReply =>
  failure(422, 'PRECONDITION_FAILED', reason, message, details);
export const conflictReply = (reason: string, message: string, details: Record<string, unknown> = {}): MockReply =>
  failure(409, 'CONFLICT', reason, message, details);

export function hasRole(request: MockRequest, roles: readonly string[]): boolean {
  return roles.some((r) => request.user?.roles.includes(r) ?? false);
}

/** `If-Match` opcional: si viene y no coincide, 412. */
export function versionMismatch(request: MockRequest, rowVersion: number): MockReply | null {
  const sent = request.headers.get('If-Match');
  if (sent === null || Number(sent.replace(/"/g, '')) === rowVersion) return null;
  return failure(412, 'CONCURRENCY_CONFLICT', 'ROW_VERSION_MISMATCH', 'Otra persona modificó este bloque mientras usted lo miraba. Recargue para ver la versión actual.', {
    currentRowVersion: rowVersion,
  });
}

/* ---- salas ------------------------------------------------------------------ */

export const OPERATING_ROOM_FUNCTION = 'SPACE_FN_OPERATING_ROOM';

export const tenantOf = (request: MockRequest): string | null => request.headers.get('X-Tenant-Id');

/** La sede, si existe y es del tenant activo; si no, `null` (→ 404). */
export function visibleSite(request: MockRequest, siteId: string | undefined) {
  const site = siteId === undefined ? undefined : sitiosInfra.get(siteId);
  if (site === undefined) return null;
  const tenant = tenantOf(request);
  return tenant === null || tenant === site.tenantId ? site : null;
}

export function roomOf(id: string | null | undefined) {
  return id === null || id === undefined ? undefined : espacios.get(id);
}

/** «Edificio A › Pabellón Norte › …» hasta el espacio, sin el espacio. */
export function pathOf(id: string): string {
  const steps: string[] = [];
  let current = espacios.get(id);
  while (current !== undefined && current.parentId !== null) {
    current = espacios.get(current.parentId);
    if (current !== undefined) steps.unshift(current.name);
  }
  return steps.join(' › ');
}

export const isLive = (c: SimulatedCase): boolean =>
  c.statusConceptId === CASE_STATUS.PROGRAMADO || c.statusConceptId === CASE_STATUS.PENDIENTE_EQUIPO || c.statusConceptId === CASE_STATUS.EN_CURSO;

/** La preparación y la limpieza del caso: la foto del caso, o las de la sala. */
export function prepCleanupOf(c: SimulatedCase): { prep: number; cleanup: number } {
  const room = roomOf(c.operatingRoomId);
  return { prep: c.prepMinutes ?? room?.prepMinutes ?? 0, cleanup: c.cleanupMinutes ?? room?.cleanupMinutes ?? 0 };
}

export function windowOfCase(c: SimulatedCase) {
  const { prep, cleanup } = prepCleanupOf(c);
  return reservedWindow(c.scheduledStartAt, c.scheduledEndAt, prep, cleanup);
}

/* ---- bloques ---------------------------------------------------------------- */

const SPECIALTY_LABELS: Readonly<Record<string, string>> = {
  TRAUMATOLOGIA: 'Traumatología y Ortopedia',
  CIRUGIA_GENERAL: 'Cirugía General',
  GINECOLOGIA_OBSTETRICIA: 'Ginecología y Obstetricia',
  UROLOGIA: 'Urología',
  OTORRINOLARINGOLOGIA: 'Otorrinolaringología',
};

export function ownerOf(b: SimulatedBlock): OrBlockOwner {
  const surgeon = PROFESSIONALS.find((p) => p.id === b.surgeonProfileId);
  const label =
    b.ownerKind === 'SURGEON'
      ? (surgeon?.displayName ?? 'Cirujano')
      : (SPECIALTY_LABELS[b.specialtyCode ?? ''] ?? b.specialtyCode ?? 'Servicio');
  return { kind: b.ownerKind, clinicalUnitId: b.clinicalUnitId, specialtyCode: b.specialtyCode, surgeonProfileId: b.surgeonProfileId, label };
}

/** ¿El caso es del dueño del bloque? Servicio = especialidad; cirujano = el primario. */
export function ownsBlock(b: SimulatedBlock, c: Pick<SimulatedCase, 'primarySurgeonProfileId'> & { specialtyCode?: string | null }): boolean {
  return b.ownerKind === 'SURGEON' ? b.surgeonProfileId === c.primarySurgeonProfileId : b.specialtyCode !== null && b.specialtyCode === (c.specialtyCode ?? null);
}

function blockSeeds(): SimulatedBlock[] {
  const out: SimulatedBlock[] = [];
  const room1 = espacios.todos().find((e) => e.code === 'QX-01' && e.functionCode === OPERATING_ROOM_FUNCTION);
  const room2 = espacios.todos().find((e) => e.code === 'QX-02' && e.functionCode === OPERATING_ROOM_FUNCTION);
  if (room1 === undefined || room2 === undefined) return out;
  for (let d = -14; d <= 21; d += 1) {
    const day = fecha(d, 8).getDay(); // 0 = domingo
    const base = { tenantId: room1.tenantId, siteId: room1.siteId, releaseHours: 72, releasedAt: null, releasedByUserId: null, releaseReason: null, releasedMinutes: null, rowVersion: 1, clinicalUnitId: null };
    if (day === 1 || day === 3) {
      const released = d === -12;
      out.push({
        ...base,
        id: uuid(`or-block-trauma-${d}`),
        seriesId: uuid('or-series-trauma'),
        operatingRoomId: room1.id,
        ownerKind: 'SERVICE',
        specialtyCode: 'TRAUMATOLOGIA',
        surgeonProfileId: null,
        startsAt: fecha(d, 8).toISOString(),
        endsAt: fecha(d, 14).toISOString(),
        status: released ? 'ORB_RELEASED' : 'ORB_ACTIVE',
        ...(released ? { releasedAt: fecha(d - 4, 10).toISOString(), releaseReason: 'Congreso de la especialidad', releasedMinutes: 360 } : {}),
      });
    }
    if (day === 2 || day === 4) {
      out.push({
        ...base,
        id: uuid(`or-block-cg-${d}`),
        seriesId: uuid('or-series-cg'),
        operatingRoomId: room2.id,
        ownerKind: 'SURGEON',
        specialtyCode: null,
        surgeonProfileId: PROFESSIONALS[10]!.id,
        startsAt: fecha(d, 8).toISOString(),
        endsAt: fecha(d, 12).toISOString(),
        status: 'ORB_ACTIVE',
      });
    }
  }
  return out;
}

export const blocks = new Coleccion<SimulatedBlock>(blockSeeds());

/** El bloque al que pertenece el caso: el guardado o, en los sembrados, el que lo contiene. */
export function blockOfCase(c: SimulatedCase): SimulatedBlock | undefined {
  if (c.blockId !== undefined) return c.blockId === null ? undefined : blocks.get(c.blockId);
  const start = Date.parse(c.scheduledStartAt);
  return blocks
    .todos()
    .find((b) => b.status !== 'ORB_CANCELLED' && b.operatingRoomId === c.operatingRoomId && Date.parse(b.startsAt) <= start && start < Date.parse(b.endsAt) && ownsBlock(b, c));
}

export function casesOfBlock(b: SimulatedBlock): SimulatedCase[] {
  return periopCases.todos().filter((c) => c.statusConceptId !== CASE_STATUS.CANCELADO && blockOfCase(c)?.id === b.id);
}

/**
 * El tick de liberación (`POST /internal/periop/or-blocks-release-tick`): se
 * corre antes de cada lectura para que la maqueta se vea como la API después
 * de su job. Libera los bloques vencidos **sin casos** y aún por empezar.
 */
export function releaseTick(now = Date.now()): void {
  for (const b of blocks.todos()) {
    if (b.status !== 'ORB_ACTIVE' || Date.parse(releaseAtOf(b.startsAt, b.releaseHours)) > now) continue;
    if (Date.parse(b.startsAt) <= now || casesOfBlock(b).length > 0) continue;
    blocks.actualizar(b.id, {
      status: 'ORB_RELEASED',
      releasedAt: new Date(now).toISOString(),
      releasedByUserId: null,
      releaseReason: 'Liberación automática: venció el plazo sin casos.',
      releasedMinutes: Math.round((Date.parse(b.endsAt) - Date.parse(b.startsAt)) / 60_000),
      rowVersion: b.rowVersion + 1,
    });
  }
}

/* ---- tiempos de sala y check-list --------------------------------------------- */

/** Los sembrados ya operados traen sus cinco tiempos (para medir la utilización). */
function roomEventSeeds(): SimulatedRoomEvent[] {
  return periopCases
    .todos()
    .filter((c) => c.statusConceptId === CASE_STATUS.COMPLETADO)
    .flatMap((c, i) => {
      const late = i % 3 === 0 ? 12 : 3;
      const start = Date.parse(c.scheduledStartAt);
      const end = Date.parse(c.scheduledEndAt);
      const at = (ms: number) => new Date(ms).toISOString();
      const offsets: readonly [string, number][] = [
        ['PATIENT_IN_ROOM', start + late * 60_000],
        ['ANESTHESIA_START', start + (late + 10) * 60_000],
        ['INCISION', start + (late + 25) * 60_000],
        ['CLOSURE', end - 20 * 60_000],
        ['PATIENT_OUT_OF_ROOM', end - 5 * 60_000 + (i % 2) * 10 * 60_000],
      ];
      return offsets.map(([eventCode, ms]) => ({ id: uuid(`room-event-${c.id}-${eventCode}`), caseId: c.id, eventCode, occurredAt: at(ms), recordedAt: at(ms) }));
    });
}

export const roomEvents = new Coleccion<SimulatedRoomEvent>(roomEventSeeds());

function checklistSeeds(): SimulatedChecklist[] {
  return periopCases
    .todos()
    .filter((c) => c.statusConceptId === CASE_STATUS.COMPLETADO)
    .map((c) => {
      const at = c.scheduledStartAt;
      const responses = Object.fromEntries(
        CHECKLIST_PHASES.flatMap((p) => CHECKLIST_ITEMS[p].map((item) => [item.id, { status: 'CONFIRMED', exceptionReason: null, respondedAt: at }])),
      );
      return { id: uuid(`checklist-${c.id}`), caseId: c.id, responses, completedAt: { SIGN_IN: at, TIME_OUT: at, SIGN_OUT: c.scheduledEndAt } };
    });
}

export const checklists = new Coleccion<SimulatedChecklist>(checklistSeeds());

export function checklistOfCase(caseId: string): SimulatedChecklist | undefined {
  return checklists.todos().find((k) => k.caseId === caseId);
}

export function eventsOfCase(caseId: string): SimulatedRoomEvent[] {
  return roomEvents.filtrar((e) => e.caseId === caseId).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

/** Minutos de tiempo útil (inicio de anestesia → salida) del caso dentro de `window`. */
export function touchMinutes(caseId: string, window: { start: number; end: number }, from = 'ANESTHESIA_START'): number {
  const events = eventsOfCase(caseId);
  const start = events.find((e) => e.eventCode === from)?.occurredAt;
  const end = events.find((e) => e.eventCode === 'PATIENT_OUT_OF_ROOM')?.occurredAt;
  return start === undefined || end === undefined ? 0 : clippedMinutes(intervalOf(start, end), window);
}

/* ---- vista de bloque ------------------------------------------------------------ */

export function blockView(b: SimulatedBlock): OrBlock {
  const window = intervalOf(b.startsAt, b.endsAt);
  const linked = casesOfBlock(b);
  return {
    id: b.id,
    seriesId: b.seriesId,
    operatingRoomId: b.operatingRoomId,
    owner: ownerOf(b),
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    releaseAt: releaseAtOf(b.startsAt, b.releaseHours),
    status: b.status,
    releasedAt: b.releasedAt,
    releasedByUserId: b.releasedByUserId,
    releaseReason: b.releaseReason,
    releasedMinutes: b.releasedMinutes,
    usedMinutes: linked.reduce((sum, c) => sum + touchMinutes(c.id, window, 'PATIENT_IN_ROOM'), 0),
    cases: linked.map((c) => ({ id: c.id, caseNumber: c.caseNumber })),
    rowVersion: b.rowVersion,
  };
}

/* Sobreviven a F5 dentro de la pestaña: la cadena UI → recarga → UI. */
blocks.persistirEn('mock.periop.blocks');
roomEvents.persistirEn('mock.periop.roomEvents');
checklists.persistirEn('mock.periop.checklists');

/* ---- recambio: la orden de limpieza OR_TURNOVER de cada salida de sala -------- */

export type TurnoverStatus = 'CLN_PENDING' | 'CLN_IN_PROGRESS' | 'CLN_DONE' | 'CLN_INSPECTED';

export interface SimulatedTurnover {
  readonly id: string;
  readonly caseId: string;
  readonly operatingRoomId: string;
  readonly status: TurnoverStatus;
  readonly rowVersion: number;
}

/**
 * La orden de limpieza de quirófano que F2 abre con `markDirtyFromSource
 * (OR_TURNOVER)` al registrar la salida de sala. La maqueta de esta franja
 * sólo lleva las de quirófano; la cola general de limpieza es de F2.
 */
export const turnovers = new Coleccion<SimulatedTurnover>([]);

export function turnoverOfCase(caseId: string): SimulatedTurnover | undefined {
  return turnovers.todos().find((t) => t.caseId === caseId);
}

turnovers.persistirEn('mock.periop.turnovers');

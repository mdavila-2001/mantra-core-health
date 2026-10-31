/* ============================================================================
    Reglas puras de la franja F4 (quirófanos), compartidas por la pantalla y por
    la maqueta. Ninguna decide nada que la API no vuelva a decidir: sirven para
    pintar la ventana reservada, explicar por qué un botón está deshabilitado y
    calcular la utilización con las fórmulas de `CONTRATO-F2-F5.md` §F4.3.
    ========================================================================== */

const MINUTE_MS = 60_000;

/** Un intervalo semiabierto `[start, end)` en milisegundos. */
export interface Interval {
  readonly start: number;
  readonly end: number;
}

/** La ventana que el caso ocupa de verdad: preparación + caso + limpieza. */
export interface ReservedWindow {
  readonly reservedStartAt: string;
  readonly reservedEndAt: string;
}

/**
 * La ventana reservada (INV-38): `[inicio − prep, fin + limpieza)`.
 *
 * En la base la mantiene un trigger; acá se calcula igual para mostrarla antes
 * de enviar y para que la maqueta compruebe el solape como la `EXCLUDE`.
 */
export function reservedWindow(
  scheduledStartAt: string,
  scheduledEndAt: string,
  prepMinutes: number | null | undefined,
  cleanupMinutes: number | null | undefined,
): ReservedWindow {
  const start = Date.parse(scheduledStartAt) - (prepMinutes ?? 0) * MINUTE_MS;
  const end = Date.parse(scheduledEndAt) + (cleanupMinutes ?? 0) * MINUTE_MS;
  return { reservedStartAt: new Date(start).toISOString(), reservedEndAt: new Date(end).toISOString() };
}

/** Solape de dos intervalos semiabiertos: tocarse en el borde no es solaparse. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Un intervalo a partir de dos instantes ISO. */
export function intervalOf(startIso: string, endIso: string): Interval {
  return { start: Date.parse(startIso), end: Date.parse(endIso) };
}

/** Minutos enteros entre dos instantes ISO (puede ser negativo). */
export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((Date.parse(endIso) - Date.parse(startIso)) / MINUTE_MS);
}

/** Minutos de `a` que caen dentro de `b`. */
export function clippedMinutes(a: Interval, b: Interval): number {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return end > start ? Math.round((end - start) / MINUTE_MS) : 0;
}

/** Cuándo se libera un bloque: `startsAt − releaseHours`. */
export function releaseAtOf(startsAt: string, releaseHours: number): string {
  return new Date(Date.parse(startsAt) - releaseHours * 60 * MINUTE_MS).toISOString();
}

/**
 * La primera ventana libre a partir de `desde` para un caso de `duracion`
 * minutos, dadas las ventanas reservadas que ya ocupan la sala.
 *
 * Es lo que el proceso 06 pide en el 409: «con la siguiente ventana libre».
 */
export function nextFreeStart(
  desiredStart: number,
  durationMinutes: number,
  prepMinutes: number,
  cleanupMinutes: number,
  taken: readonly Interval[],
): string {
  const ordered = [...taken].sort((x, y) => x.start - y.start);
  let start = desiredStart;
  for (;;) {
    const window: Interval = {
      start: start - prepMinutes * MINUTE_MS,
      end: start + (durationMinutes + cleanupMinutes) * MINUTE_MS,
    };
    const blocking = ordered.find((t) => overlaps(window, t));
    if (blocking === undefined) return new Date(start).toISOString();
    start = blocking.end + prepMinutes * MINUTE_MS;
  }
}

/** Porcentaje con un decimal, o `null` si el denominador es cero. */
export function percentage(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** Mediana (p50) de una lista; `null` si está vacía. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/** Utilización de bloque: (usado + recambio) ÷ (asignado − liberado). */
export function blockUtilizationPct(
  allocatedMinutes: number,
  releasedMinutes: number,
  usedMinutes: number,
  turnoverMinutes: number,
): number | null {
  return percentage(usedMinutes + turnoverMinutes, allocatedMinutes - releasedMinutes);
}

/* ---- check-list OMS y eventos de sala --------------------------------------- */

/** Las tres fases del check-list de cirugía segura de la OMS (2009). */
export const CHECKLIST_PHASES = ['SIGN_IN', 'TIME_OUT', 'SIGN_OUT'] as const;
export type ChecklistPhaseCode = (typeof CHECKLIST_PHASES)[number];

/** Rótulos de las fases, en el vocabulario de la versión en castellano. */
export const PHASE_LABELS: Readonly<Record<ChecklistPhaseCode, string>> = {
  SIGN_IN: 'Entrada',
  TIME_OUT: 'Pausa quirúrgica',
  SIGN_OUT: 'Salida',
};

/** Los cinco tiempos del caso, en el único orden que la API acepta. */
export const ROOM_EVENT_ORDER = [
  'PATIENT_IN_ROOM',
  'ANESTHESIA_START',
  'INCISION',
  'CLOSURE',
  'PATIENT_OUT_OF_ROOM',
] as const;
export type RoomEventCode = (typeof ROOM_EVENT_ORDER)[number];

export const ROOM_EVENT_LABELS: Readonly<Record<RoomEventCode, string>> = {
  PATIENT_IN_ROOM: 'Entrada a sala',
  ANESTHESIA_START: 'Inicio de anestesia',
  INCISION: 'Incisión',
  CLOSURE: 'Cierre',
  PATIENT_OUT_OF_ROOM: 'Salida de sala',
};

/** Qué fase del check-list exige cada evento (gates OMS de §F4.3). */
export const REQUIRED_PHASE: Readonly<Partial<Record<RoomEventCode, ChecklistPhaseCode>>> = {
  ANESTHESIA_START: 'SIGN_IN',
  INCISION: 'TIME_OUT',
  PATIENT_OUT_OF_ROOM: 'SIGN_OUT',
};

/** El `reason` que la API devuelve cuando falta esa fase. */
export const PHASE_REQUIRED_REASON: Readonly<Record<ChecklistPhaseCode, string>> = {
  SIGN_IN: 'CHECKLIST_SIGN_IN_REQUIRED',
  TIME_OUT: 'CHECKLIST_TIME_OUT_REQUIRED',
  SIGN_OUT: 'CHECKLIST_SIGN_OUT_REQUIRED',
};

/** El próximo evento que corresponde registrar, o `null` si ya están los cinco. */
export function nextRoomEvent(recorded: readonly string[]): RoomEventCode | null {
  return ROOM_EVENT_ORDER.find((code) => !recorded.includes(code)) ?? null;
}

/** La fase que se puede responder ahora, o `null` si las tres están completas. */
export function currentPhase(completed: Readonly<Record<ChecklistPhaseCode, boolean>>): ChecklistPhaseCode | null {
  return CHECKLIST_PHASES.find((phase) => !completed[phase]) ?? null;
}

/**
 * Por qué un evento de sala **no** se puede registrar todavía, o `null` si se
 * puede. Es la explicación del botón deshabilitado; la API vuelve a decidir.
 */
export function roomEventBlockedReason(
  code: RoomEventCode,
  recorded: readonly string[],
  completed: Readonly<Record<ChecklistPhaseCode, boolean>>,
): string | null {
  if (recorded.includes(code)) return 'Ya está registrado.';
  const next = nextRoomEvent(recorded);
  if (next !== code) {
    return next === null ? 'El caso ya registró los cinco tiempos.' : `Antes hay que registrar «${ROOM_EVENT_LABELS[next]}».`;
  }
  const phase = REQUIRED_PHASE[code];
  if (phase !== undefined && !completed[phase]) {
    return `Exige completar la fase «${PHASE_LABELS[phase]}» del check-list.`;
  }
  return null;
}

/* ---- permisos reflejados (la API decide) ------------------------------------ */

const hasAny = (roles: readonly string[], wanted: readonly string[]): boolean =>
  wanted.some((r) => roles.includes(r));

/*
 * Sin el comodín `SUPERADMIN` a propósito en las escrituras: la matriz de §F4.3
 * deja al soporte en lectura (bloques, programación, sala). Sólo lee.
 */

/** Bloques: crear, liberar, cancelar. Sólo jefe de quirófano. */
export function canManageBlocks(roles: readonly string[]): boolean {
  return hasAny(roles, ['PERIOP_ADMIN']);
}

/** Programar un caso (roles existentes del módulo). */
export function canScheduleCases(roles: readonly string[]): boolean {
  return hasAny(roles, ['SURGERY_SCHEDULER', 'SURGEON', 'PERIOP_ADMIN']);
}

/** Check-list y eventos de sala. */
export function canRecordInRoom(roles: readonly string[]): boolean {
  return hasAny(roles, ['PERIOP_NURSE', 'SURGEON', 'ANESTHESIOLOGIST', 'PERIOP_ADMIN']);
}

/** Utilización: jefe de quirófano, facturación y quien administra. */
export function canSeeUtilization(roles: readonly string[]): boolean {
  return hasAny(roles, ['SUPERADMIN', 'PERIOP_ADMIN', 'BILLING', 'SECURITY_ADMIN', 'PLATFORM_ADMIN']);
}

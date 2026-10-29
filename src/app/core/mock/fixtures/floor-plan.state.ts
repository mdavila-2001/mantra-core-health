import { AVAILABILITY, HYGIENE, ISOLATION, LIFECYCLE, OCCUPANCY } from '../../data-access/floor-plan/floor-plan.codes';
import type { PlanRollup, SpaceState } from '../../data-access/floor-plan/floor-plan.types';
import { SEED_SPACES, SEED_SPACE_BY_KEY, spaceId } from './floor-plan.seed';

/* ============================================================================
    Estado operativo del plano de ejemplo (F2 + F3 vistos desde el plano).

    El estado cambia con el tiempo: cada ~30 s de reloj aplica el siguiente
    evento de un guion fijo (alta de limpieza, bloqueo que se levanta, un
    ingreso…), de modo que el sondeo `asOf` del visor muestre cambios sin
    ninguna aleatoriedad. Mismos códigos que el tablero de camas de F2.
    ========================================================================== */

export const STATE_TICK_MS = 30_000;

export interface MutableState {
  lifecycle: string;
  availability: { code: string; reasonCode?: string; reasonText?: string; expectedUntil?: string; sinceMin: number };
  occupancy: { code: string; sinceMin: number; patient?: PatientSeed };
  hygiene: { code: string; sinceMin: number; terminalRequired: boolean };
  isolation: { code: string; organism?: string; sinceMin: number };
  openCleaningOrderId?: string;
  lastEventMs: number;
  opsVersion: number;
}

export interface PatientSeed {
  readonly displayName: string;
  readonly initials: string;
  readonly sexCode: string;
  readonly ageYears: number;
  readonly encounterId: string;
  readonly admittedDaysAgo: number;
  readonly expectedDischargeInDays?: number;
}

/** Pacientes inventados para la maqueta (no son personas reales): se reparten por unidad. */
const FIRST_F = ['Carmen', 'Marta', 'Rosa', 'Elena', 'Lucía', 'Beatriz', 'Ana', 'Teresa', 'Julia', 'Norma', 'Silvia', 'Paola'];
const FIRST_M = ['Luis', 'Jorge', 'Pedro', 'Víctor', 'Raúl', 'Hugo', 'Mario', 'Óscar', 'Daniel', 'Franz', 'Efraín', 'Wilson'];
const KIDS_F = ['Sofía', 'Camila', 'Valentina', 'Noelia'];
const KIDS_M = ['Mateo', 'Diego', 'Santiago', 'Thiago'];
const SURNAMES = ['Quispe Mamani', 'Fernández Rojas', 'Choque Limachi', 'Álvarez Cussi', 'Mendoza Gutiérrez', 'Vargas Condori', 'Ramos Tola', 'Mamani Huanca', 'Gutiérrez Paz', 'Lima Apaza', 'Torrez Sirpa', 'Calle Poma', 'Flores Yujra', 'Nina Colque', 'Salazar Rivera', 'Condori Ticona', 'Apaza Villca', 'Cruz Laura', 'Poma Escobar', 'Rivero Soliz', 'Tarqui Mollo', 'Ortuño Barrón', 'Cáceres Vega', 'Aliaga Suxo'];

let patientCounter = 0;
function makePatient(pool: 'adult' | 'kid' | 'woman'): PatientSeed {
  const n = patientCounter;
  patientCounter += 1;
  const female = pool === 'woman' || (pool !== 'kid' ? n % 2 === 0 : n % 2 === 1);
  const first = pool === 'kid' ? (female ? KIDS_F : KIDS_M)[n % 4]! : (female ? FIRST_F : FIRST_M)[n % 12]!;
  const surname = SURNAMES[(n * 5 + 3) % SURNAMES.length]!;
  const initials = `${first[0]}${surname.split(' ').map((w) => w[0]).join('')}`;
  const age = pool === 'kid' ? 3 + ((n * 4) % 11) : pool === 'woman' ? 20 + ((n * 7) % 20) : 30 + ((n * 13) % 50);
  return {
    displayName: `${first} ${surname}`,
    initials,
    sexCode: female ? 'F' : 'M',
    ageYears: age,
    encounterId: `enc-${String(n + 1).padStart(3, '0')}`,
    admittedDaysAgo: 1 + (n % 8),
    ...(n % 3 === 0 ? { expectedDischargeInDays: 1 + (n % 4) } : {}),
  };
}

function poolFor(key: string): 'adult' | 'kid' | 'woman' {
  const unit = SEED_SPACE_BY_KEY.get(key)?.unit;
  return unit === 'PED' ? 'kid' : unit === 'GIN' ? 'woman' : 'adult';
}

function base(): MutableState {
  return {
    lifecycle: LIFECYCLE.ACTIVE,
    availability: { code: AVAILABILITY.AVAILABLE, sinceMin: 600 },
    occupancy: { code: OCCUPANCY.FREE, sinceMin: 300 },
    hygiene: { code: HYGIENE.INSPECTED, sinceMin: 240, terminalRequired: false },
    isolation: { code: ISOLATION.NONE, sinceMin: 900 },
    lastEventMs: 0,
    opsVersion: 1,
  };
}

/** Configuración inicial por clave de espacio: lo que no figura queda libre, inspeccionado y disponible. */
function initialOverrides(): Record<string, (s: MutableState, key: string) => void> {
  const occupied = (s: MutableState, key: string): void => {
    s.occupancy = { code: OCCUPANCY.OCCUPIED, sinceMin: 60 * (6 + ((patientCounter * 7) % 90)), patient: makePatient(poolFor(key)) };
    s.hygiene = { code: HYGIENE.CLEAN, sinceMin: 60 * 30, terminalRequired: false };
  };
  const dirty = (s: MutableState, minutes = 35): void => {
    s.hygiene = { code: HYGIENE.DIRTY, sinceMin: minutes, terminalRequired: false };
    s.openCleaningOrderId = 'cln-' + Math.abs(minutes * 7919);
  };
  const free = (s: MutableState): void => {
    s.hygiene = { code: HYGIENE.INSPECTED, sinceMin: 90, terminalRequired: false };
  };
  return {
    // Observación (planta baja)
    'PB-OBS-C1': occupied,
    'PB-OBS-C2': free,
    'PB-OBS-C3': (s) => {
      s.occupancy = { code: OCCUPANCY.RESERVED, sinceMin: 12 };
      free(s);
    },
    'PB-OBS-C4': (s) => dirty(s, 48),
    // Medicina
    'P1-101-C1': occupied,
    'P1-101-C2': occupied,
    'P1-102-C1': free,
    'P1-102-C2': (s) => {
      s.hygiene = { code: HYGIENE.CLEANING, sinceMin: 8, terminalRequired: false };
      s.openCleaningOrderId = 'cln-0102';
    },
    'P1-AIS': (s) => {
      s.isolation = { code: ISOLATION.AIRBORNE, organism: 'Tuberculosis pulmonar (sospecha)', sinceMin: 60 * 20 };
    },
    'P1-AIS-C1': (s, key) => {
      occupied(s, key);
      s.isolation = { code: ISOLATION.AIRBORNE, organism: 'Tuberculosis pulmonar (sospecha)', sinceMin: 60 * 20 };
    },
    // Cirugía
    'P1-201-C1': occupied,
    'P1-201-C2': (s) => {
      s.availability = { code: AVAILABILITY.BLOCKED_CLINICAL, reasonCode: 'BLOCK_RSN_PATIENT_CONDITION', reasonText: 'Reserva para posoperatorio inmediato', sinceMin: 150 };
    },
    'P1-202-C1': (s) => {
      s.availability = {
        code: AVAILABILITY.MAINTENANCE, reasonCode: 'BLOCK_RSN_EQUIPMENT_FAILURE', reasonText: 'Falla del riel de la cama',
        expectedUntil: 'PLUS_2_DAYS', sinceMin: 60 * 26,
      };
    },
    'P1-202-C2': free,
    'P1-203-C1': (s) => {
      s.hygiene = { code: HYGIENE.CONTAMINATED, sinceMin: 25, terminalRequired: true };
      s.openCleaningOrderId = 'cln-0203';
    },
    'P1-203-C2': occupied,
    // Pediatría
    'P1-301-C1': occupied,
    'P1-301-C2': free,
    'P1-302-C1': (s, key) => {
      occupied(s, key);
      s.isolation = { code: ISOLATION.CONTACT, organism: 'SAMR', sinceMin: 60 * 30 };
    },
    'P1-302-C2': (s) => {
      s.availability = { code: AVAILABILITY.BLOCKED_ADMIN, reasonCode: 'BLOCK_RSN_ISOLATION_COHORT', reasonText: 'Cohorte de aislamiento por contacto', sinceMin: 60 * 30 };
    },
    'P1-303-C1': occupied,
    'P1-303-C2': (s) => dirty(s, 70),
    // Puerperio
    'P1-401-C1': occupied,
    'P1-401-C2': (s) => {
      s.availability = { code: AVAILABILITY.CLOSED, reasonCode: 'BLOCK_RSN_ADMIN_DECISION', reasonText: 'Cerrada por decisión de la dirección', sinceMin: 60 * 24 * 12 };
    },
    // Recuperación posanestésica
    'P1-REC-C1': free,
    'P1-REC-C2': occupied,
    'P1-REC-C3': (s) => dirty(s, 15),
    // Terapia intermedia
    'P1-UTI-C1': occupied,
    'P1-UTI-C2': occupied,
    'P1-UTI-C3': occupied,
    'P1-UTI-C4': (s) => {
      s.occupancy = { code: OCCUPANCY.RESERVED, sinceMin: 20 };
      free(s);
    },
    // Locales sin camas: en uso / disponibles / fuera de servicio
    'PB-TRI': occupied,
    'PB-SHK': free,
    'PB-BX1': occupied,
    'PB-BX2': (s) => dirty(s, 22),
    'PB-C1': occupied,
    'PB-C2': occupied,
    'PB-C3': free,
    'PB-C5': (s) => {
      s.lifecycle = LIFECYCLE.SUSPENDED;
      s.availability = { code: AVAILABILITY.CLOSED, reasonCode: 'BLOCK_RSN_ADMIN_DECISION', reasonText: 'Consultorio suspendido por reorganización', sinceMin: 60 * 24 * 3 };
    },
    'PB-RX': occupied,
    'PB-ECO': (s) => {
      s.availability = { code: AVAILABILITY.MAINTENANCE, reasonCode: 'BLOCK_RSN_PREVENTIVE_MAINTENANCE', reasonText: 'Mantenimiento preventivo del ecógrafo', expectedUntil: 'PLUS_6_HOURS', sinceMin: 90 };
    },
    'PB-YES': occupied,
    'P1-QX1': occupied,
    'P1-QX2': (s) => dirty(s, 18),
    'P1-PA1': free,
    'P1-PA2': (s) => {
      s.availability = { code: AVAILABILITY.BLOCKED_ADMIN, reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE', reasonText: 'Falta de personal en el turno', sinceMin: 200 };
    },
  };
}

/** Eventos del guion: se aplican uno por cada `STATE_TICK_MS` transcurrido desde que arrancó la maqueta. */
export const STATE_SCRIPT: readonly { readonly key: string; readonly note: string; readonly apply: (s: MutableState) => void }[] = [
  {
    key: 'P1-102-C2', note: 'Termina la limpieza',
    apply: (s) => {
      s.hygiene = { code: HYGIENE.CLEAN, sinceMin: 0, terminalRequired: false };
      delete s.openCleaningOrderId;
    },
  },
  {
    key: 'PB-OBS-C4', note: 'Comienza la limpieza',
    apply: (s) => {
      s.hygiene = { code: HYGIENE.CLEANING, sinceMin: 0, terminalRequired: false };
    },
  },
  {
    key: 'P1-201-C2', note: 'Se levanta el bloqueo clínico',
    apply: (s) => {
      s.availability = { code: AVAILABILITY.AVAILABLE, sinceMin: 0 };
      s.hygiene = { code: HYGIENE.INSPECTED, sinceMin: 0, terminalRequired: false };
    },
  },
  {
    key: 'P1-UTI-C4', note: 'Ingresa un paciente a la cama reservada',
    apply: (s) => {
      s.occupancy = { code: OCCUPANCY.OCCUPIED, sinceMin: 0, patient: makePatient('adult') };
    },
  },
  {
    key: 'P1-303-C2', note: 'Comienza la limpieza',
    apply: (s) => {
      s.hygiene = { code: HYGIENE.CLEANING, sinceMin: 0, terminalRequired: false };
    },
  },
  {
    key: 'P1-REC-C2', note: 'Egreso: queda sucia',
    apply: (s) => {
      s.occupancy = { code: OCCUPANCY.FREE, sinceMin: 0 };
      s.hygiene = { code: HYGIENE.DIRTY, sinceMin: 0, terminalRequired: false };
      s.openCleaningOrderId = 'cln-rec2';
    },
  },
];

/** Claves de espacio con perfil de estado operativo: los locales (ROOM) y las camas. */
export function hasOperationalProfile(key: string): boolean {
  const form = SEED_SPACE_BY_KEY.get(key)?.form;
  return form === 'ROOM' || form === 'BED';
}

export class MockOpsState {
  readonly states = new Map<string, MutableState>();
  private applied = 0;
  private readonly bootMs: number;

  constructor(bootMs: number = Date.now()) {
    this.bootMs = bootMs;
    patientCounter = 0;
    const overrides = initialOverrides();
    for (const space of SEED_SPACES) {
      if (!hasOperationalProfile(space.key)) continue;
      const state = base();
      state.lastEventMs = bootMs;
      this.states.set(space.key, state);
    }
    // Primero los ocupados en orden estable (los pacientes se reparten por el orden de SEED_SPACES).
    for (const space of SEED_SPACES) {
      const apply = overrides[space.key];
      const state = this.states.get(space.key);
      if (apply && state) apply(state, space.key);
    }
  }

  /** Aplica los eventos del guion que ya tocan según el reloj. Devuelve el instante del último evento. */
  advance(nowMs: number): number {
    const due = Math.min(STATE_SCRIPT.length, Math.floor((nowMs - this.bootMs) / STATE_TICK_MS));
    let last = this.bootMs;
    while (this.applied < due) {
      const event = STATE_SCRIPT[this.applied]!;
      const state = this.states.get(event.key);
      if (state) {
        event.apply(state);
        state.opsVersion += 1;
        state.lastEventMs = this.bootMs + (this.applied + 1) * STATE_TICK_MS;
      }
      this.applied += 1;
    }
    for (const s of this.states.values()) last = Math.max(last, s.lastEventMs);
    return last;
  }

  get bootTime(): number {
    return this.bootMs;
  }

  /** Estado de un local con camas: la ocupación y la limpieza se derivan de sus camas (F2). */
  stateOf(key: string, nowMs: number): SpaceState | null {
    const state = this.states.get(key);
    if (!state) return null;
    const bedKeys = SEED_SPACES.filter((s) => s.parent === key && s.form === 'BED').map((s) => s.key);
    let occupancy = state.occupancy;
    if (bedKeys.length > 0) {
      const bedStates = bedKeys.map((k) => this.states.get(k)!);
      const code = bedStates.some((b) => b.occupancy.code === OCCUPANCY.OCCUPIED)
        ? OCCUPANCY.OCCUPIED
        : bedStates.some((b) => b.occupancy.code === OCCUPANCY.RESERVED)
          ? OCCUPANCY.RESERVED
          : OCCUPANCY.FREE;
      occupancy = { code, sinceMin: Math.min(...bedStates.map((b) => b.occupancy.sinceMin)), patient: undefined };
    }
    return toSpaceState(state, occupancy, nowMs, bedKeys.length > 0);
  }
}

const iso = (nowMs: number, minutesAgo: number): string => new Date(nowMs - minutesAgo * 60_000).toISOString();

function resolveExpected(token: string | undefined, nowMs: number): string | undefined {
  if (token === undefined) return undefined;
  const plus = /^PLUS_(\d+)_(DAYS|HOURS)$/.exec(token);
  if (!plus) return token;
  const unit = plus[2] === 'DAYS' ? 86_400_000 : 3_600_000;
  return new Date(nowMs + Number(plus[1]) * unit).toISOString();
}

function toSpaceState(s: MutableState, occupancy: MutableState['occupancy'], nowMs: number, container: boolean): SpaceState {
  const v2 = v2CodeOf(s, occupancy.code);
  const assignable =
    !container &&
    s.lifecycle === LIFECYCLE.ACTIVE &&
    s.availability.code === AVAILABILITY.AVAILABLE &&
    occupancy.code === OCCUPANCY.FREE &&
    s.hygiene.code === HYGIENE.INSPECTED &&
    !s.hygiene.terminalRequired;
  const patient = occupancy.patient
    ? { initials: occupancy.patient.initials, sexCode: occupancy.patient.sexCode, ageYears: occupancy.patient.ageYears }
    : undefined;
  return {
    lifecycle: { code: s.lifecycle },
    availability: {
      code: s.availability.code,
      ...(s.availability.reasonCode ? { reasonCode: s.availability.reasonCode } : {}),
      ...(s.availability.reasonText ? { reasonText: s.availability.reasonText } : {}),
      ...(s.availability.expectedUntil ? { expectedUntil: resolveExpected(s.availability.expectedUntil, nowMs) } : {}),
      since: iso(nowMs, s.availability.sinceMin),
    },
    occupancy: {
      code: occupancy.code as 'OCC_FREE' | 'OCC_RESERVED' | 'OCC_OCCUPIED',
      since: iso(nowMs, occupancy.sinceMin),
      ...(patient ? { patient } : {}),
    },
    hygiene: { code: s.hygiene.code, since: iso(nowMs, s.hygiene.sinceMin), terminalRequired: s.hygiene.terminalRequired },
    isolation: {
      code: s.isolation.code,
      ...(s.isolation.organism ? { organism: s.isolation.organism } : {}),
      since: iso(nowMs, s.isolation.sinceMin),
    },
    v2Code: v2,
    assignable,
    ...(s.openCleaningOrderId ? { openCleaningOrderId: s.openCleaningOrderId } : {}),
    lastEventAt: new Date(s.lastEventMs).toISOString(),
    opsVersion: s.opsVersion,
  };
}

/** Mapeo a HL7 v2-0116 (CONTRATO-F2-F5 §F2.2): la primera regla que aplica. */
export function v2CodeOf(s: MutableState, occupancyCode: string): SpaceState['v2Code'] {
  if (s.availability.code !== AVAILABILITY.AVAILABLE || s.lifecycle !== LIFECYCLE.ACTIVE) return 'C';
  if (s.hygiene.code === HYGIENE.CONTAMINATED) return 'K';
  if (s.isolation.code !== ISOLATION.NONE) return 'I';
  if (occupancyCode === OCCUPANCY.OCCUPIED) return 'O';
  if (occupancyCode === OCCUPANCY.RESERVED) return 'R';
  if (s.hygiene.code === HYGIENE.DIRTY || s.hygiene.code === HYGIENE.CLEANING || s.hygiene.code === HYGIENE.CLEAN || s.hygiene.terminalRequired) return 'H';
  return 'U';
}

/** Recuentos por contenedor, como el tablero de F2: solo cuentan camas (un contenedor sin camas no tiene recuento). */
export function rollupFor(ops: MockOpsState, key: string, nowMs: number): PlanRollup | null {
  const leaves: string[] = [];
  const collect = (k: string): void => {
    if (SEED_SPACE_BY_KEY.get(k)?.form === 'BED') {
      leaves.push(k);
      return;
    }
    for (const child of SEED_SPACES) if (child.parent === k) collect(child.key);
  };
  collect(key);
  const states = leaves.map((k) => ops.stateOf(k, nowMs)).filter((s): s is SpaceState => s !== null);
  if (states.length === 0) return null;
  const count = (predicate: (s: SpaceState) => boolean): number => states.filter(predicate).length;
  return {
    beds: states.length,
    censable: states.length,
    occupied: count((s) => s.occupancy.code === OCCUPANCY.OCCUPIED),
    reserved: count((s) => s.occupancy.code === OCCUPANCY.RESERVED),
    assignable: count((s) => s.assignable),
    blocked: count((s) => s.availability.code === AVAILABILITY.BLOCKED_CLINICAL || s.availability.code === AVAILABILITY.BLOCKED_ADMIN || s.availability.code === AVAILABILITY.CLOSED),
    maintenance: count((s) => s.availability.code === AVAILABILITY.MAINTENANCE),
    dirty: count((s) => s.hygiene.code === HYGIENE.DIRTY),
    cleaning: count((s) => s.hygiene.code === HYGIENE.CLEANING),
    isolation: count((s) => s.isolation.code !== ISOLATION.NONE),
    contaminated: count((s) => s.hygiene.code === HYGIENE.CONTAMINATED),
  };
}

export { spaceId };

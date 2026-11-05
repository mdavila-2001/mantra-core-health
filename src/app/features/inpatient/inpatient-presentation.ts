import type { BedBoardCell, V2Code } from '../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { ageLabel, opsLabel, sexLabel, V2_LABEL } from '../../core/data-access/infrastructure-ops/ops-labels';
import type { BedTileTone, BedTileView } from '../../shared/components/molecules/bed-tile/bed-tile.types';

/* ============================================================================
    Presentación compartida de las pantallas de internación (F2/F3).
    Sólo formato: ningún permiso ni regla de negocio vive acá.
    ========================================================================== */

export const BED_BOARD_ROUTE = '/inpatient/bed-board';
export const CLEANING_ROUTE = '/inpatient/cleaning';
export const ADMISSION_NEW_ROUTE = '/inpatient/admissions/new';
export const CENSUS_ROUTE = '/inpatient/census';
export const INDICATORS_ROUTE = '/inpatient/indicators';
export const stayRoute = (encounterId: string): string => `/inpatient/stays/${encodeURIComponent(encounterId)}`;

/** Sondeo del tablero y de la cola (F2.4). */
export const POLL_INTERVAL_MS = 30_000;
/** Pasado este tiempo sin un dato nuevo, el tablero pasa a S7 (F2.4). */
export const STALE_AFTER_MS = 120_000;
/**
 * Cada cuánto se repinta «Actualizado hace…» (M8): la frase cambia de a
 * decenas de segundos, no hace falta recalcular el tablero cada segundo.
 */
export const CLOCK_TICK_MS = 15_000;

/** Zona de una sede sin zona declarada (Bolivia no tiene horario de verano). */
export const DEFAULT_TIME_ZONE = 'America/La_Paz';

export const V2_TONE: Readonly<Record<V2Code, BedTileTone>> = {
  C: 'unavailable',
  K: 'contaminated',
  I: 'isolation',
  O: 'occupied',
  R: 'reserved',
  H: 'pending',
  U: 'free',
};

/** «hace 12 s», «hace 4 min», «hace 3 h», «hace 2 d». */
export function relativeAge(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (iso === null || iso === undefined) return null;
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (!Number.isFinite(s)) return null;
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 172_800) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86_400)} d`;
}

/** `dd/MM HH:mm` en la hora **de la sede** (M3). */
export function shortDateTime(iso: string | null | undefined, timeZone: string = DEFAULT_TIME_ZONE): string | null {
  if (iso === null || iso === undefined) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const partes = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).formatToParts(d);
  const part = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((x) => x.type === tipo)?.value ?? '';
  return `${part('day')}/${part('month')} ${part('hour')}:${part('minute')}`;
}

/** `dd/MM/AAAA` de una fecha `AAAA-MM-DD`. */
export function shortDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

/** «JMC · M · 67 a»; sin sexo o sin edad, lo dice (M2). */
export function patientShort(p: BedBoardCell['occupancy']['patient']): string | null {
  if (p === undefined) return null;
  return `${p.initials || '—'} · ${sexLabel(p.sexCode, true)} · ${ageLabel(p.ageYears, true)}`;
}

/** «JMC · masculino · 67 años». */
export function patientLong(p: BedBoardCell['occupancy']['patient']): string | null {
  if (p === undefined) return null;
  return `${p.initials || '—'} · ${sexLabel(p.sexCode)} · ${ageLabel(p.ageYears)}`;
}

export function cellToTile(cell: BedBoardCell, now: number = Date.now(), timeZone: string = DEFAULT_TIME_ZONE): BedTileView {
  const disponible = cell.availability.code === 'SPACE_OP_AVAILABLE';
  const lista = cell.hygiene.code === 'HYG_INSPECTED' && !cell.hygiene.terminalRequired;
  const motivo = cell.availability.reasonText ?? (cell.availability.reasonCode === null ? null : opsLabel(cell.availability.reasonCode));
  return {
    code: cell.code,
    statusCode: cell.v2Code,
    statusLabel: V2_LABEL[cell.v2Code],
    tone: V2_TONE[cell.v2Code],
    reason: disponible ? (cell.lifecycle === 'ACTIVE' ? null : opsLabel(cell.lifecycle)) : `${opsLabel(cell.availability.code)} · ${motivo ?? 'sin motivo'}`,
    until: cell.availability.expectedUntil === null || disponible ? null : `hasta ${shortDateTime(cell.availability.expectedUntil, timeZone)}`,
    isolation: cell.isolation.code === 'ISO_NONE' ? null : `Aislamiento: ${opsLabel(cell.isolation.code)}${cell.isolation.organism ? ` (${cell.isolation.organism})` : ''}`,
    patient: patientShort(cell.occupancy.patient),
    hygiene: lista ? null : `${opsLabel(cell.hygiene.code)}${cell.hygiene.terminalRequired ? ' · terminal' : ''}`,
    age: relativeAge(cell.lastEventAt, now),
  };
}

/** La fecha `AAAA-MM-DD` de la sede (M3), `offsetDays` días desde hoy. */
export function siteToday(offsetDays = 0, now: number = Date.now(), timeZone: string = DEFAULT_TIME_ZONE): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  const t = Date.parse(`${partes}T00:00:00Z`) + offsetDays * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Un `Date` del selector → `AAAA-MM-DD` (fecha local del selector). */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** `AAAA-MM-DD` → `Date` a mediodía local (evita saltos de día por zona). */
export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
}

/** `AAAA-MM-DD` válida, o `null` (los `?date`, `?from`, `?to` de la URL). */
export function validDateKey(value: string | null): string | null {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? null : value;
}

/** Desfase de la zona en un instante, en ms (Intl, sin dependencias; como `zoneOffsetMinutes` de la API). */
function zoneOffsetMs(timeZone: string, at: number): number {
  const p = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(at));
  const n = (t: Intl.DateTimeFormatPartTypes) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - at;
}

/** El instante de las 00:00 del día `AAAA-MM-DD` en la zona de la sede. */
export function siteMidnight(date: string, timeZone: string = DEFAULT_TIME_ZONE): Date {
  const t = Date.parse(`${date}T00:00:00Z`);
  return new Date(t - zoneOffsetMs(timeZone, t));
}

/** `AAAA-MM-DD` ± días. */
export function shiftDateKey(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

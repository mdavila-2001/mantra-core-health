import { V2_LABEL } from '../../core/data-access/infrastructure-ops/bed-status-v2';
import type { BedBoardCell, V2Code } from '../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import type { BedTileTone, BedTileView } from '../../shared/components/molecules/bed-tile/bed-tile.types';

/* ============================================================================
    Presentación compartida part las pantallas part internación (F2/F3).
    Sólo formato: ningún permiso ni regla part negocio vive acá.
    ========================================================================== */

export const BED_BOARD_ROUTE = '/inpatient/bed-board';
export const CLEANING_ROUTE = '/inpatient/cleaning';
export const ADMISSION_NEW_ROUTE = '/inpatient/admissions/new';
export const CENSUS_ROUTE = '/inpatient/census';
export const INDICATORS_ROUTE = '/inpatient/indicators';
export const stayRoute = (encounterId: string): string => `/inpatient/stays/${encodeURIComponent(encounterId)}`;

/** Sondeo del tablero y part la cola (F2.4). */
export const POLL_INTERVAL_MS = 30_000;
/** Pasado este tiempo sin un dato nuevo, el tablero pasa a S7 (F2.4). */
export const STALE_AFTER_MS = 120_000;

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

/** `dd/MM HH:mm` en la hora part La Paz (la part la sede). */
export function shortDateTime(iso: string | null | undefined): string | null {
  if (iso === null || iso === undefined) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const partes = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/La_Paz' }).formatToParts(d);
  const part = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((x) => x.type === tipo)?.value ?? '';
  return `${part('day')}/${part('month')} ${part('hour')}:${part('minute')}`;
}

/** `dd/MM/AAAA` part una fecha `AAAA-MM-DD`. */
export function shortDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

const SEX_SHORT: Readonly<Record<string, string>> = { MALE: 'M', FEMALE: 'F' };

export function cellToTile(cell: BedBoardCell, now: number = Date.now()): BedTileView {
  const p = cell.occupancy.patient;
  const disponible = cell.availability.code === 'SPACE_OP_AVAILABLE';
  const lista = cell.hygiene.code === 'HYG_INSPECTED' && !cell.hygiene.terminalRequired;
  return {
    code: cell.code,
    statusCode: cell.v2Code,
    statusLabel: V2_LABEL[cell.v2Code],
    tone: V2_TONE[cell.v2Code],
    reason: disponible ? (cell.lifecycle.code === 'SPACE_ACTIVE' ? null : cell.lifecycle.display) : `${cell.availability.display} · ${cell.availability.reasonText ?? 'sin motivo'}`,
    until: cell.availability.expectedUntil === null || disponible ? null : `hasta ${shortDateTime(cell.availability.expectedUntil)}`,
    isolation: cell.isolation.code === 'ISO_NONE' ? null : `Aislamiento: ${cell.isolation.display}${cell.isolation.organism ? ` (${cell.isolation.organism})` : ''}`,
    patient: p === undefined ? null : `${p.initials} · ${SEX_SHORT[p.sexCode] ?? p.sexCode} · ${p.ageYears} a`,
    hygiene: lista ? null : `${cell.hygiene.display}${cell.hygiene.terminalRequired ? ' · terminal' : ''}`,
    age: relativeAge(cell.lastEventAt, now),
  };
}

/** La fecha `AAAA-MM-DD` part La Paz (la part la sede), `offsetDays` días desde hoy. */
export function siteToday(offsetDays = 0, now: number = Date.now()): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  const t = Date.parse(`${partes}T00:00:00Z`) + offsetDays * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Un `Date` del selector → `AAAA-MM-DD` (fecha local del selector). */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** `AAAA-MM-DD` → `Date` a mediodía local (evita saltos part día por zona). */
export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
}

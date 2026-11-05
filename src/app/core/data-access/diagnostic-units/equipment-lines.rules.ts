import { diaIso, enMinutos } from './center-schedule.rules';
import type { CenterEquipment, CenterSchedule, ScheduleBlock } from './center-schedule.types';
import type { ModalityCode } from './modalidades';

/* ============================================================================
    Each device is a production line (twin of the API's `equipment-lines.ts`):
    it attends one patient per slot while its own shift is open. A device
    without a shift of its own follows its study's block. The capacity of a
    slot is the number of operational lines of the modality open for all of it.
    Local times, like the rest of `center-schedule.rules.ts`.
    ========================================================================== */

/** The own shift of a device, or `null` when it follows its study's block. */
export function turnoPropio(schedule: CenterSchedule, equipmentId: string): ScheduleBlock | null {
  return schedule.equipment?.find((e) => e.equipmentId === equipmentId)?.schedule ?? null;
}

/** Whether a shift has a window that covers `[inicio, fin)` entirely, on the same day. */
export function turnoCubre(block: ScheduleBlock, inicio: Date, fin: Date): boolean {
  const desde = inicio.getHours() * 60 + inicio.getMinutes();
  const hasta = desde + Math.round((fin.getTime() - inicio.getTime()) / 60_000);
  return block.windows.some((w) => {
    const abre = enMinutos(w.startTime);
    const cierra = enMinutos(w.endTime);
    return w.dayOfWeek === diaIso(inicio) && abre !== null && cierra !== null && abre <= desde && hasta <= cierra;
  });
}

/** Operational lines of a modality open for the whole slot. */
export function lineasAbiertas(
  schedule: CenterSchedule,
  equipos: readonly CenterEquipment[],
  modalityCode: ModalityCode,
  inicio: Date,
  fin: Date,
): readonly CenterEquipment[] {
  return equipos.filter((e) => {
    if (e.modalityCode !== modalityCode || e.status !== 'OPERATIONAL') return false;
    const propio = turnoPropio(schedule, e.id);
    return propio === null || turnoCubre(propio, inicio, fin);
  });
}

/** Patients that fit in one slot of a modality: its open lines. */
export function cupoDelTurno(
  schedule: CenterSchedule,
  equipos: readonly CenterEquipment[],
  modalityCode: ModalityCode,
  inicio: Date,
  fin: Date,
): number {
  return lineasAbiertas(schedule, equipos, modalityCode, inicio, fin).length;
}

/** A booking waiting on a line. */
export interface TurnoEnCola {
  readonly id: string;
  readonly inicio: Date;
  readonly fin: Date;
  readonly modalityCode: ModalityCode | null;
}

/**
 * Lays the bookings on the lines, first come first served: each one goes to
 * the first open line of its modality free for its slot. Returns the line of
 * each booking; one no open line can take is left out.
 */
export function asignarALineas(
  schedule: CenterSchedule,
  equipos: readonly CenterEquipment[],
  turnos: readonly TurnoEnCola[],
): ReadonlyMap<string, string> {
  const linea = new Map<string, string>();
  const ocupada = new Map<string, TurnoEnCola[]>();
  const orden = [...turnos].sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.id.localeCompare(b.id));
  for (const turno of orden) {
    if (turno.modalityCode === null) continue;
    const libre = lineasAbiertas(schedule, equipos, turno.modalityCode, turno.inicio, turno.fin).find(
      (e) => !(ocupada.get(e.id) ?? []).some((t) => t.inicio < turno.fin && t.fin > turno.inicio),
    );
    if (libre === undefined) continue;
    ocupada.set(libre.id, [...(ocupada.get(libre.id) ?? []), turno]);
    linea.set(turno.id, libre.id);
  }
  return linea;
}

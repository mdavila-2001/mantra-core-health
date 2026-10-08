import type {
  CenterEquipment,
  CenterSchedule,
  ScheduleBlock,
  ScheduleOrigin,
  ScheduleWindow,
} from './center-schedule.types';
import { modalidad, type ModalityCode } from './modalidades';

/* ============================================================================
    Las reglas del horario de un centro, sin Angular ni red: las usan el editor
    del centro (para el resumen en vivo y las validaciones) y el simulador (para
    calcular los turnos libres). Una sola implementación para que la pantalla y
    los turnos no puedan contar dos historias distintas.

    Resolución de horario, de lo más específico a lo más general:

      1. el estudio tiene horario propio            → ese;
      2. si no, su modalidad tiene horario propio   → ese;
      3. si no                                      → el general.

    Mientras nadie tenga horario propio, el general es «Horario general» y vale
    para todo. En cuanto alguno lo tiene, el general pasa a llamarse «Resto de
    servicios», porque ya no cubre a todos.

    Capacidad: cuántos pacientes entran en la misma franja = equipos
    **operativos** de la modalidad. Un equipo en mantenimiento o fuera de
    servicio no cuenta, así que marcarlo baja el cupo sin tocar el horario.
    ========================================================================== */

export const DIAS_DE_LA_SEMANA: readonly { readonly dayOfWeek: number; readonly label: string; readonly short: string }[] = [
  { dayOfWeek: 1, label: 'Lunes', short: 'Lun' },
  { dayOfWeek: 2, label: 'Martes', short: 'Mar' },
  { dayOfWeek: 3, label: 'Miércoles', short: 'Mié' },
  { dayOfWeek: 4, label: 'Jueves', short: 'Jue' },
  { dayOfWeek: 5, label: 'Viernes', short: 'Vie' },
  { dayOfWeek: 6, label: 'Sábado', short: 'Sáb' },
  { dayOfWeek: 7, label: 'Domingo', short: 'Dom' },
];

export const DURACIONES_DE_TURNO: readonly number[] = [10, 15, 20, 30, 45, 60, 90];

export interface HorarioResuelto {
  readonly block: ScheduleBlock;
  readonly origin: ScheduleOrigin;
}

/** El horario que se aplica a un estudio de una modalidad. */
export function resolverHorario(
  schedule: CenterSchedule,
  studyCode: string,
  modalityCode: ModalityCode,
): HorarioResuelto {
  const propio = schedule.studies.find((s) => s.studyCode === studyCode);
  if (propio !== undefined) return { block: propio.schedule, origin: 'STUDY' };
  const deModalidad = schedule.modalities.find((m) => m.modalityCode === modalityCode);
  if (deModalidad !== undefined) return { block: deModalidad.schedule, origin: 'MODALITY' };
  return { block: schedule.general, origin: 'GENERAL' };
}

/** Si el horario general sigue valiendo para todo o ya es el del resto. */
export function tieneHorariosPropios(schedule: CenterSchedule): boolean {
  return schedule.modalities.length > 0 || schedule.studies.length > 0;
}

/** El nombre del horario general según haya o no horarios propios. */
export function nombreDelHorarioGeneral(schedule: CenterSchedule): string {
  return tieneHorariosPropios(schedule) ? 'Resto de servicios' : 'Horario general';
}

/** Equipos operativos de una modalidad: los pacientes que entran por franja. */
export function capacidadDeModalidad(equipment: readonly CenterEquipment[], modalityCode: ModalityCode): number {
  return equipment.filter((e) => e.modalityCode === modalityCode && e.status === 'OPERATIONAL').length;
}

/** Total de equipos de una modalidad, operativos o no. */
export function equiposDeModalidad(equipment: readonly CenterEquipment[], modalityCode: ModalityCode): number {
  return equipment.filter((e) => e.modalityCode === modalityCode).length;
}

/** `HH:MM` → minutos desde la medianoche; `null` si no es una hora válida. */
export function enMinutos(hora: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hora);
  if (m === null) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Día de la semana ISO (1 = lunes … 7 = domingo) de una fecha local. */
export function diaIso(fecha: Date): number {
  const d = fecha.getDay();
  return d === 0 ? 7 : d;
}

/**
 * Los turnos de un día: por cada franja de ese día, inicios cada
 * `slotMinutes` mientras el turno entero entre antes del cierre.
 */
export function turnosDelDia(block: ScheduleBlock, fecha: Date): readonly { readonly inicio: Date; readonly fin: Date }[] {
  const dia = diaIso(fecha);
  const salida: { inicio: Date; fin: Date }[] = [];
  for (const franja of block.windows) {
    if (franja.dayOfWeek !== dia) continue;
    const desde = enMinutos(franja.startTime);
    const hasta = enMinutos(franja.endTime);
    if (desde === null || hasta === null || block.slotMinutes <= 0) continue;
    for (let m = desde; m + block.slotMinutes <= hasta; m += block.slotMinutes) {
      const inicio = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, m);
      salida.push({ inicio, fin: new Date(inicio.getTime() + block.slotMinutes * 60_000) });
    }
  }
  return salida.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

export interface ProblemaDeHorario {
  /** Qué horario: `general`, un código de modalidad o un código de estudio. */
  readonly donde: string;
  readonly mensaje: string;
}

/** Lo que impide guardar un horario. Vacío si está bien. */
export function validarHorario(schedule: CenterSchedule, nombreDe: (donde: string) => string): readonly ProblemaDeHorario[] {
  const problemas: ProblemaDeHorario[] = [];
  const revisar = (donde: string, block: ScheduleBlock): void => {
    const nombre = nombreDe(donde);
    if (block.windows.length === 0) {
      problemas.push({ donde, mensaje: `${nombre}: marque al menos un día de atención.` });
    }
    for (const franja of block.windows) {
      const desde = enMinutos(franja.startTime);
      const hasta = enMinutos(franja.endTime);
      const dia = DIAS_DE_LA_SEMANA.find((d) => d.dayOfWeek === franja.dayOfWeek)?.label ?? 'Un día';
      if (desde === null || hasta === null) {
        problemas.push({ donde, mensaje: `${nombre}, ${dia}: complete la hora de inicio y de fin.` });
      } else if (hasta <= desde) {
        problemas.push({ donde, mensaje: `${nombre}, ${dia}: la hora de fin tiene que ser posterior a la de inicio.` });
      } else if (hasta - desde < block.slotMinutes) {
        problemas.push({ donde, mensaje: `${nombre}, ${dia}: no entra ni una cita de ${block.slotMinutes} min.` });
      }
    }
  };
  revisar('general', schedule.general);
  for (const m of schedule.modalities) revisar(m.modalityCode, m.schedule);
  for (const s of schedule.studies) revisar(s.studyCode, s.schedule);
  return problemas;
}

/**
 * Un horario en una línea: «Lun a Vie 08:00–12:00 · Sáb 08:00–10:00 · turnos
 * de 30 min». Agrupa los días consecutivos con la misma franja.
 */
export function describirHorario(block: ScheduleBlock): string {
  if (block.windows.length === 0) return 'Sin días de atención';
  const porFranja = new Map<string, number[]>();
  for (const w of [...block.windows].sort((a, b) => a.dayOfWeek - b.dayOfWeek)) {
    const clave = `${w.startTime}–${w.endTime}`;
    porFranja.set(clave, [...(porFranja.get(clave) ?? []), w.dayOfWeek]);
  }
  const partes = [...porFranja.entries()].map(([franja, dias]) => `${agruparDias(dias)} ${franja}`);
  return `${partes.join(' · ')} · citas de ${block.slotMinutes} min`;
}

function agruparDias(dias: readonly number[]): string {
  const corto = (d: number): string => DIAS_DE_LA_SEMANA.find((x) => x.dayOfWeek === d)?.short ?? '';
  const tramos: number[][] = [];
  for (const d of dias) {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo !== undefined && ultimo[ultimo.length - 1] === d - 1) ultimo.push(d);
    else tramos.push([d]);
  }
  return tramos
    .map((t) => (t.length >= 3 ? `${corto(t[0]!)} a ${corto(t[t.length - 1]!)}` : t.map(corto).join(', ')))
    .join(', ');
}

/** Un horario de lunes a viernes con la misma franja, para empezar a editar. */
export function horarioDeSemana(startTime: string, endTime: string, slotMinutes: number, dias: readonly number[] = [1, 2, 3, 4, 5]): ScheduleBlock {
  return {
    windows: dias.map((dayOfWeek): ScheduleWindow => ({ dayOfWeek, startTime, endTime })),
    slotMinutes,
  };
}

/** El nombre de la modalidad, para mensajes. */
export function nombreDeModalidad(code: ModalityCode): string {
  return modalidad(code).label;
}

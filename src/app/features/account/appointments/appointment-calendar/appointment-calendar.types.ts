import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';

/**
 * Un turno tal como lo necesita el calendario.
 *
 * Es **su propio** contrato y no el `TurnoVisible` de la pantalla: el
 * calendario no sabe de cancelaciones ni de reprogramaciones, sabe de cosas que
 * pasan un día a una hora. Atarlo al modelo de la pantalla lo volvería
 * inservible para cualquier otra que quiera pintar turnos —la agenda del
 * profesional, por ejemplo (carril 07)— que es justo lo que se viene.
 */
export interface CalendarAppointment {
  readonly id: string;
  /** Cuándo empieza. `null` si la cita perdió su cupo: el calendario lo aparta. */
  readonly cuando: Date | null;
  readonly hasta: Date | null;
  /** Con quién es, o de qué se trata. Una línea. */
  readonly titulo: string;
  /** El estado en palabras, ya traducido por quien lo pinta. */
  readonly estado: string;
  readonly tono: BadgeVariant;
}

/** Un día del mes dibujado, con lo que cae en él. */
export interface CalendarDay {
  readonly fecha: Date;
  /** Número que se imprime en la celda. */
  readonly numero: number;
  /** El día pertenece al mes que se está mirando, no al relleno de los bordes. */
  readonly delMes: boolean;
  readonly esHoy: boolean;
  readonly turnos: readonly CalendarAppointment[];
  /** Cómo se anuncia la celda entera a un lector de pantalla. */
  readonly etiqueta: string;
}

/** Los días de la semana, empezando el lunes como el calendario local. */
export const DIAS_DE_LA_SEMANA: readonly { corto: string; largo: string }[] = [
  { corto: 'Lun', largo: 'lunes' },
  { corto: 'Mar', largo: 'martes' },
  { corto: 'Mié', largo: 'miércoles' },
  { corto: 'Jue', largo: 'jueves' },
  { corto: 'Vie', largo: 'viernes' },
  { corto: 'Sáb', largo: 'sábado' },
  { corto: 'Dom', largo: 'domingo' },
];

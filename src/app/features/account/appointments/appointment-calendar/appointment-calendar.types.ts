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
  /**
   * Lo que la tarjeta NO muestra y el detalle sí (FT-07-R03/R04).
   *
   * La tarjeta del día tiene alto fijo —es lo que impide que un día con tres
   * citas deforme la fila entera—, así que sólo entra un resumen: la hora y con
   * quién. Todo lo demás —el consultorio, el motivo, el aviso de una demora—
   * viaja acá y se revela al apuntar o al enfocar, sin ocupar lugar en la
   * grilla.
   *
   * Ya redactadas por quien pinta el calendario: éste no sabe de motivos ni de
   * demoras, y armarlas acá lo ataría al modelo de una pantalla.
   */
  readonly detalles?: readonly string[];
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
  /**
   * Si desde este día se puede salir a pedir un turno.
   *
   * Hacia atrás no hay horario que reservar: el día pasado se sigue mirando,
   * pero no ofrece el botón (F-10).
   */
  readonly pedible: boolean;
  /** La fecha en palabras, para nombrar la acción sin leer un número suelto. */
  readonly etiquetaCorta: string;
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

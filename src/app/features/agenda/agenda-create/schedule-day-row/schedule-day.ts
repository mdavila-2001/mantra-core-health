import { FormControl, FormGroup, Validators } from '@angular/forms';

import type { FranjaModo } from '@core/data-access/scheduling/scheduling.types';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';

/* ============================================================================
    Un día de la semana de «Publicar mi agenda»: su formulario, sus opciones y
    lo que su franja declara al publicarse.

    Vive aparte de la pantalla porque lo usan dos piezas —la pantalla, que arma
    la semana y la publica, y la fila de la tabla, que la dibuja— y dos copias
    de los valores por omisión terminan separándose.
    ========================================================================== */

/** Duraciones ofrecidas, en minutos. */
const DURATIONS = [15, 20, 30, 45, 60, 90] as const;

/**
 * Descansos ofrecidos entre un turno y el siguiente, en minutos.
 *
 * Empieza en **cero** y cero viene marcado: la mayoría de las agendas no
 * declara descanso, y obligar a elegir uno convertiría una comodidad en un
 * trámite. Cuando queda en cero no se manda nada — la columna es anulable y
 * «no lo dijo» y «dijo que no hay» no significan lo mismo.
 */
const GAPS = [0, 5, 10, 15, 20, 30] as const;

/** Hora `HH:MM` o `HH:MM:SS`, como la valida el DTO de la franja. */
const TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;

export const DURATION_OPTIONS: readonly SelectOption<number>[] = DURATIONS.map((minutes) => ({
  value: minutes,
  label: `${minutes} min`,
}));

export const GAP_OPTIONS: readonly SelectOption<number>[] = GAPS.map((minutes) => ({
  value: minutes,
  label: minutes === 0 ? 'Sin respiro' : `${minutes} min`,
}));

/**
 * Qué se atiende en cada franja (v4.2.40). «Ambos» comparte el tiempo: el que
 * reserva primero se lo lleva, y una consulta que un servicio pisa deja de
 * ofrecerse hasta que ese servicio se cancele.
 */
export const MODE_OPTIONS: readonly SelectOption<FranjaModo>[] = [
  { value: 'CONSULTATIONS', label: 'Consultas' },
  // «Otros servicios»: lo que el médico ofrece además de la consulta simple
  // —cirugías, toma de muestras, tratamientos— (propietario, 04/10/2026).
  // «Servicios» a secas se leía como sinónimo de consulta.
  { value: 'SERVICES', label: 'Otros servicios' },
  { value: 'MIXED', label: 'Ambos' },
];

/**
 * Las dos respuestas de todo interruptor de esta pantalla.
 *
 * Eran casillas de verificación y el propietario las pidió como botones de
 * «Sí / No» (18/09): una casilla sola no dice qué pasa si no la marcás, y dos
 * botones dicen las dos cosas.
 */
export const YES_NO: readonly SegmentedOption<'si' | 'no'>[] = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
];

/**
 * El paso de los campos de hora: de a 5 minutos.
 *
 * Eran un select de medias horas, y el propietario pidió horarios flexibles
 * (18/09): quien abre a las 08:15 o cierra a las 12:40 no podía decirlo. Un
 * campo de hora acepta cualquier minuto escrito; el paso sólo ordena las
 * flechas del teclado y la rueda del selector nativo.
 */
export const TIME_STEP_SECONDS = 300;

/** Una fila de la semana: el día y, si está activo, su horario. */
export type ScheduleDayForm = FormGroup<{
  activo: FormControl<boolean>;
  desde: FormControl<string>;
  hasta: FormControl<string>;
  duracion: FormControl<number>;
  respiro: FormControl<number>;
  /** Qué admite la franja (v4.2.40). Por omisión, sólo consultas: lo de siempre. */
  modo: FormControl<FranjaModo>;
  /** Si la franja admite teleconsulta. Por omisión no: un horario es presencial. */
  telemedicina: FormControl<boolean>;
  /**
   * Si ese día se atiende sin turnos fijos (v4.2.64): el paciente pide la hora
   * dentro de la franja. Por omisión no: un día es de turnos hasta que se diga.
   */
  flexible: FormControl<boolean>;
}>;

/** Lo que tiene una fila en un momento dado. */
export type ScheduleDayValue = ReturnType<ScheduleDayForm['getRawValue']>;

/** Un campo de la fila que cambió, con su valor ya tipado. */
export type ScheduleDayChange = {
  [Field in keyof ScheduleDayValue]: {
    readonly field: Field;
    readonly value: ScheduleDayValue[Field];
  };
}[keyof ScheduleDayValue];

/** Un día de la semana, apagado y con un horario de mañana por defecto. */
export function createScheduleDay(): ScheduleDayForm {
  return new FormGroup({
    activo: new FormControl(false, { nonNullable: true }),
    desde: new FormControl('09:00', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(TIME_PATTERN)],
    }),
    hasta: new FormControl('13:00', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(TIME_PATTERN)],
    }),
    duracion: new FormControl(30, { nonNullable: true, validators: [Validators.required] }),
    // Sin descanso por omisión: es lo que la agenda hacía antes de que el campo
    // existiera, así que abrir el formulario no cambia nada de lo que ya había.
    respiro: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
    // Sólo consultas por omisión: es lo que toda franja era antes, así que abrir el
    // formulario no cambia el significado de ningún horario ya publicado.
    modo: new FormControl<FranjaModo>('CONSULTATIONS', { nonNullable: true }),
    // Sin telemedicina por omisión: un horario es presencial hasta que el
    // médico diga lo contrario, franja por franja.
    telemedicina: new FormControl(false, { nonNullable: true }),
    flexible: new FormControl(false, { nonNullable: true }),
  });
}

/** Lo que declara la franja de un día de turnos fijos. */
export interface FixedTurnFields {
  readonly slotMinutes: number;
  readonly gapMinutes?: number;
}

/**
 * Lo que declara la franja de un día de turnos fijos: cuánto dura cada turno y,
 * si la eligió, el descanso entre uno y otro.
 *
 * El descanso sólo viaja si eligió alguno: mandar `0` escribiría un cero que
 * nadie declaró, y borraría la diferencia el día que el default cambie.
 */
export function fixedTurnFields(day: Pick<ScheduleDayValue, 'duracion' | 'respiro'>): FixedTurnFields {
  return { slotMinutes: day.duracion, ...(day.respiro > 0 ? { gapMinutes: day.respiro } : {}) };
}

/**
 * Lo que declara la franja de un día flexible (v4.2.64): sólo que lo es.
 *
 * Ni duración, ni descanso, ni capacidad: no hay turnos que medir ni llenar, y
 * la API rechaza la franja flexible que los trae (`assertFlexibleRules`). Lo
 * que se reserva por paciente lo dice la plantilla, una sola vez (P36).
 */
export const FLEXIBLE_DAY_FIELDS = { flexibleHours: true } as const;

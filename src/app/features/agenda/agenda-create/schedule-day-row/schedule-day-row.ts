import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import {
  DURATION_OPTIONS,
  GAP_OPTIONS,
  MODE_OPTIONS,
  TIME_STEP_SECONDS,
  YES_NO,
  type ScheduleDayChange,
  type ScheduleDayValue,
} from './schedule-day';

/**
 * Una fila de la tabla de la semana: un día, su horario y cómo se atiende.
 *
 * Es presentacional: dibuja el valor que recibe y avisa cada cambio con
 * `changed`; la pantalla es la dueña del formulario. Cada día tiene su propio
 * «Horario flexible» (v4.2.64): un lunes de turnos con descanso y un martes
 * sin turnos fijos conviven en la misma semana. El descanso, la duración y la
 * cuenta de horarios se ocultan sólo en la fila flexible.
 *
 * Con toda la semana flexible —el atajo de arriba de la tabla— la fila queda
 * como siempre fue en ese modo: sin columnas de turnos ni interruptor propio.
 */
@Component({
  selector: 'tr[app-schedule-day-row]',
  imports: [Input, Select, Switch, SegmentedControl],
  templateUrl: './schedule-day-row.html',
  styleUrl: './schedule-day-row.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.schedule-day-row--active]': 'value().activo' },
})
export class ScheduleDayRow {
  /** La posición del día en la semana, para los identificadores de prueba. */
  readonly index = input.required<number>();
  /** «Lunes», «Martes»… */
  readonly dayName = input.required<string>();
  readonly value = input.required<ScheduleDayValue>();
  /** Toda la semana flexible: lo declara la plantilla y la fila no pregunta por turnos. */
  readonly weekFlexible = input(false);
  /** Cuántos horarios entran ese día; los calcula la pantalla, con el almuerzo. */
  readonly slots = input(0);

  readonly changed = output<ScheduleDayChange>();

  protected readonly yesNo = YES_NO;
  protected readonly durationOptions = DURATION_OPTIONS;
  protected readonly gapOptions = GAP_OPTIONS;
  protected readonly modeOptions = MODE_OPTIONS;
  protected readonly timeStep = TIME_STEP_SECONDS;

  /** Si este día se atiende sin turnos fijos, por la semana o por su propio interruptor. */
  protected readonly flexible = computed(() => this.weekFlexible() || this.value().flexible);

  /** Una franja sólo de servicios no tiene turnos fijos que contar. */
  protected readonly servicesOnly = computed(() => this.value().modo === 'SERVICES');

  /** Avisa un campo que cambió; un control que se vació no cambia nada. */
  protected set<Field extends keyof ScheduleDayValue>(
    field: Field,
    value: ScheduleDayValue[Field] | null,
  ): void {
    if (value === null) return;
    this.changed.emit({ field, value } as ScheduleDayChange);
  }

  /** Las horas llegan del campo como texto o número; viajan como texto. */
  protected setTime(field: 'desde' | 'hasta', value: string | number | null): void {
    if (value !== null) this.set(field, String(value));
  }
}

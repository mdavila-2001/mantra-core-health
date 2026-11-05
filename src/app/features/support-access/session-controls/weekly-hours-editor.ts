import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import {
  DEFAULT_HOURS,
  DEFAULT_TIME_ZONE,
  HOUR_CHOICES,
  WEEK_ORDER,
  activeDays,
  dayBands,
  dayName,
  dayShort,
  describeHours, hoursProblem,
} from '../../../core/data-access/support-access/session-policy';
import type { AllowedHours } from '../../../core/data-access/support-access/support-access.types';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { AppButton } from '../../../shared/components/atoms/button/button';

/** Una fila de la semana lista para dibujar. */
interface DayRow {
  readonly day: number;
  readonly name: string;
  readonly short: string;
  readonly on: boolean;
  readonly segments: readonly { readonly left: number; readonly width: number }[];
  readonly label: string;
}

const MINUTOS_DEL_DIA = 1440;

/**
 * **Editor del horario laboral**: la semana a la vista, un renglón por día con su
 * franja dibujada sobre las 24 horas.
 *
 * Se parece a lo que la API guarda (`AllowedHoursDto`): **una** franja `desde` –
 * `hasta` y los días en que rige. Cada renglón es un botón: tocarlo habilita o
 * quita ese día, y la franja se mueve con los dos selectores de abajo. Una franja
 * que termina antes de empezar cruza la medianoche —un turno de noche— y se
 * dibuja partida entre el día que empieza y el que sigue.
 *
 * No guarda nada: emite el horario nuevo (o `undefined` si se apaga) y quien lo
 * usa decide cuándo persistirlo.
 */
@Component({
  selector: 'app-weekly-hours-editor',
  imports: [AppButton, Select, Switch],
  templateUrl: './weekly-hours-editor.html',
  styleUrl: './weekly-hours-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeeklyHoursEditor {
  /** El horario actual; `undefined` es «sin restricción». */
  readonly value = input<AllowedHours | undefined>(undefined);
  /** Prefijo para los `data-testid`, para poder tener varios editores. */
  readonly idPrefix = input('horario');
  readonly valueChange = output<AllowedHours | undefined>();

  protected readonly horas: readonly SelectOption<string>[] = HOUR_CHOICES.map((h) => ({ value: h, label: h }));
  protected readonly zona = DEFAULT_TIME_ZONE;

  protected readonly limitado = computed(() => this.value() !== undefined);

  protected readonly resumen = computed(() => describeHours(this.value()));
  /** Por qué esta franja no se podría guardar (misma hora de inicio y fin, o menos de 4 horas); `null` si sirve. */
  protected readonly problema = computed(() => hoursProblem(this.value()));

  protected readonly filas = computed<readonly DayRow[]>(() => {
    const horario = this.value();
    if (horario === undefined) return [];
    const activos = activeDays(horario);
    const bandas = dayBands(horario);
    return WEEK_ORDER.map((day) => {
      const segments = (bandas.find((b) => b.day === day)?.bands ?? []).map((b) => ({ left: (b.from / MINUTOS_DEL_DIA) * 100, width: ((b.to - b.from) / MINUTOS_DEL_DIA) * 100 }));
      const on = activos.includes(day);
      return {
        day,
        name: dayName(day).charAt(0).toLocaleUpperCase('es') + dayName(day).slice(1),
        short: dayShort(day),
        on,
        segments,
        label: on ? `${dayName(day)}: habilitado de ${horario.from} a ${horario.to}` : `${dayName(day)}: sin acceso`,
      };
    });
  });

  protected alternar(limitar: boolean): void {
    this.valueChange.emit(limitar ? DEFAULT_HOURS : undefined);
  }

  protected alternarDia(day: number): void {
    const horario = this.value();
    if (horario === undefined) return;
    const activos = new Set(activeDays(horario));
    if (activos.has(day)) {
      // Siempre queda al menos un día: «ningún día» sería ambiguo (la API lo lee como «todos»).
      if (activos.size === 1) return;
      activos.delete(day);
    } else {
      activos.add(day);
    }
    this.valueChange.emit({ ...horario, days: WEEK_ORDER.filter((d) => activos.has(d)) });
  }

  protected cambiarDesde(from: string | null): void {
    const horario = this.value();
    if (horario === undefined || from === null) return;
    this.valueChange.emit({ ...horario, from });
  }

  protected cambiarHasta(to: string | null): void {
    const horario = this.value();
    if (horario === undefined || to === null) return;
    this.valueChange.emit({ ...horario, to });
  }

  protected oficina(): void {
    this.valueChange.emit(DEFAULT_HOURS);
  }

  protected turnoDeNoche(): void {
    this.valueChange.emit({ days: [...WEEK_ORDER], from: '22:00', to: '06:00', timeZone: this.value()?.timeZone ?? DEFAULT_TIME_ZONE });
  }
}

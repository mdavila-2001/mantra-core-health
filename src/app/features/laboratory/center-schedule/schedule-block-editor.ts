import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import {
  DIAS_DE_LA_SEMANA,
  DURACIONES_DE_TURNO,
} from '../../../core/data-access/diagnostic-units/center-schedule.rules';
import type { ScheduleBlock, ScheduleWindow } from '../../../core/data-access/diagnostic-units/center-schedule.types';
import { Input } from '../../../shared/components/atoms/input/input';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';

/* ============================================================================
    Un horario: qué días se atiende, de qué hora a qué hora y cuánto dura cada
    turno. Es la misma tabla «un día por fila, Sí / No» que usa la agenda del
    médico, recortada a lo que un centro necesita (sin almuerzo ni descanso:
    el turno de un equipo dura lo que dura el estudio).

    No guarda estado propio: recibe el horario y emite el horario nuevo en cada
    cambio, así el padre arma el resumen en vivo con lo mismo que va a guardar.
    ========================================================================== */

const POR_DEFECTO: Pick<ScheduleWindow, 'startTime' | 'endTime'> = { startTime: '08:00', endTime: '12:00' };

@Component({
  selector: 'app-schedule-block-editor',
  imports: [Input, SegmentedControl, Select],
  templateUrl: './schedule-block-editor.html',
  styleUrl: './schedule-block-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleBlockEditor {
  /** El horario que se edita. */
  readonly block = input.required<ScheduleBlock>();
  /** Prefijo de los `data-testid`, para distinguir varios editores en la misma pantalla. */
  readonly testPrefix = input.required<string>();
  /** De qué horario se trata, para las etiquetas accesibles («Ecografía», «Resto de servicios»). */
  readonly nombre = input.required<string>();

  readonly blockChange = output<ScheduleBlock>();

  protected readonly siNo: readonly SegmentedOption<'si' | 'no'>[] = [
    { value: 'si', label: 'Sí' },
    { value: 'no', label: 'No' },
  ];

  /** Siete duraciones no entran en un segmentado a 390 px: van en un desplegable. */
  protected readonly duraciones: readonly SelectOption<string>[] = DURACIONES_DE_TURNO.map((m) => ({
    value: String(m),
    label: `${m} min`,
  }));

  protected readonly dias = computed(() =>
    DIAS_DE_LA_SEMANA.map((d) => {
      const franja = this.block().windows.find((w) => w.dayOfWeek === d.dayOfWeek) ?? null;
      return { ...d, franja };
    }),
  );

  protected fijarDia(dayOfWeek: number, valor: 'si' | 'no'): void {
    const sin = this.block().windows.filter((w) => w.dayOfWeek !== dayOfWeek);
    const anterior = this.block().windows[this.block().windows.length - 1] ?? POR_DEFECTO;
    const windows =
      valor === 'si'
        ? [...sin, { dayOfWeek, startTime: anterior.startTime, endTime: anterior.endTime }]
        : sin;
    this.emitir({ ...this.block(), windows: [...windows].sort((a, b) => a.dayOfWeek - b.dayOfWeek) });
  }

  protected fijarHora(dayOfWeek: number, campo: 'startTime' | 'endTime', valor: string | number | null): void {
    const texto = String(valor ?? '').slice(0, 5);
    this.emitir({
      ...this.block(),
      windows: this.block().windows.map((w) => (w.dayOfWeek === dayOfWeek ? { ...w, [campo]: texto } : w)),
    });
  }

  protected fijarDuracion(valor: string): void {
    this.emitir({ ...this.block(), slotMinutes: Number(valor) });
  }

  private emitir(block: ScheduleBlock): void {
    this.blockChange.emit(block);
  }
}

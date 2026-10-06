import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import {
  DIAS_DE_LA_SEMANA,
  DURACIONES_DE_TURNO,
} from '../../../core/data-access/diagnostic-units/center-schedule.rules';
import type { ScheduleBlock, ScheduleWindow } from '../../../core/data-access/diagnostic-units/center-schedule.types';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';

const HORAS: readonly string[] = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);
const OPCIONES_DE_HORA: readonly SelectOption<string>[] = HORAS.map((h) => ({ value: h, label: h }));

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
  imports: [SegmentedControl, Select],
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

  /**
   * Las horas, de 15 en 15 y en 24 h. Un desplegable y no `<input type=time>`:
   * el nativo sigue el idioma del navegador (en es-BO muestra «08:00 a.m.») y
   * quedaba en otro formato que el resumen «Así queda», que va en 24 h.
   */
  protected horasCon(actual: string): readonly SelectOption<string>[] {
    return HORAS.includes(actual) ? OPCIONES_DE_HORA : [...OPCIONES_DE_HORA, { value: actual, label: actual }].sort((a, b) => a.value.localeCompare(b.value));
  }

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

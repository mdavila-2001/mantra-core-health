import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type { ScheduleBlock } from '../../../core/data-access/diagnostic-units/center-schedule.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { ScheduleDayRow } from '../../agenda/agenda-create/schedule-day-row/schedule-day-row';
import {
  TIME_STEP_SECONDS,
  YES_NO,
  type ScheduleDayChange,
} from '../../agenda/agenda-create/schedule-day-row/schedule-day';
import { CenterWeekPreview } from './week/center-week-preview';
import { WEEK, blockToWeek, slotsOfDay, weekToBlock, type CenterWeek } from './week/center-week';

/* ============================================================================
    One schedule of the center (general, a service, a study or a device),
    edited with the practitioner's week: the same day table (`ScheduleDayRow`),
    «Repetir un horario en todos los días», the lunch break and the same
    preview with the weekly grid. Only the practitioner-only columns are off.

    Stateless: it receives the block and emits the new one on every change,
    so the parent builds «Así queda» from what it is going to save.
    ========================================================================== */

@Component({
  selector: 'app-schedule-block-editor',
  imports: [
    AppButton,
    Input,
    Select,
    FormField,
    SegmentedControl,
    ContentDialog,
    ScheduleDayRow,
    CenterWeekPreview,
  ],
  templateUrl: './schedule-block-editor.html',
  styleUrls: [
    './schedule-block-editor.css',
    '../../agenda/agenda-create/schedule-day-row/schedule-week.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleBlockEditor {
  readonly block = input.required<ScheduleBlock>();
  /** `data-testid` prefix, to tell several editors apart on one screen. */
  readonly testPrefix = input.required<string>();
  /** Which schedule this is, for accessible names («Ecografía», «Resto de servicios»). */
  readonly nombre = input.required<string>();

  readonly blockChange = output<ScheduleBlock>();

  protected readonly siNo = YES_NO;
  protected readonly pasoDeHora = TIME_STEP_SECONDS;

  /** The last week emitted: an inactive day keeps its hours to come back with. */
  private readonly ultima = signal<CenterWeek | null>(null);

  /** The week shown: the one just emitted while the parent echoes it back, else read from the block. */
  protected readonly semana = computed(() => {
    const ultima = this.ultima();
    const block = this.block();
    const igual =
      ultima !== null &&
      JSON.stringify(weekToBlock(ultima, block.slotMinutes)) === JSON.stringify(block);
    return igual ? ultima : blockToWeek(block, ultima);
  });

  protected readonly filas = computed(() =>
    WEEK.map((d, indice) => ({ indice, largo: d.label, value: this.semana().days[indice]! })),
  );

  protected readonly diasActivos = computed(() => this.filas().filter((f) => f.value.activo));

  protected turnos(indice: number): number {
    return slotsOfDay(this.semana().days[indice]!, this.semana().lunch);
  }

  protected fijarDeLaFila(indice: number, cambio: ScheduleDayChange): void {
    const days = this.semana().days.map((d, i) =>
      i === indice ? { ...d, [cambio.field]: cambio.value } : d,
    );
    this.emitir({ ...this.semana(), days });
  }

  // ── Lunch: one for the whole week, as the practitioner's ───────────────────

  protected readonly almuerzo = computed(() => this.semana().lunch);

  protected fijarConAlmuerzo(valor: 'si' | 'no'): void {
    this.emitir({
      ...this.semana(),
      lunch: valor === 'si' ? { from: '12:00', to: '13:00' } : null,
    });
  }

  protected fijarAlmuerzo(campo: 'from' | 'to', valor: string | number | null): void {
    const actual = this.semana().lunch;
    if (actual === null || valor === null) return;
    this.emitir({ ...this.semana(), lunch: { ...actual, [campo]: String(valor).slice(0, 5) } });
  }

  protected readonly almuerzoInvalido = computed(() => {
    const l = this.almuerzo();
    return l !== null && l.to <= l.from;
  });

  // ── «Repetir un horario en todos los días» ─────────────────────────────────

  protected readonly repetirAbierto = signal(false);
  protected readonly filaARepetir = signal<number | null>(null);

  protected readonly opcionesDeFila = computed<readonly SelectOption<number>[]>(() =>
    this.diasActivos().map((f) => ({
      value: f.indice,
      label: `${f.largo} (${f.value.desde} – ${f.value.hasta})`,
    })),
  );

  protected abrirRepetir(): void {
    this.filaARepetir.set(this.diasActivos()[0]?.indice ?? null);
    this.repetirAbierto.set(true);
  }

  /** Copies the chosen row's hours, length and rest onto every enabled day. */
  protected repetirFila(): void {
    const origen = this.semana().days[this.filaARepetir() ?? -1];
    this.repetirAbierto.set(false);
    if (origen === undefined) return;
    const { desde, hasta, duracion, respiro } = origen;
    const days = this.semana().days.map((d) =>
      d.activo ? { ...d, desde, hasta, duracion, respiro } : d,
    );
    this.emitir({ ...this.semana(), days });
  }

  private emitir(semana: CenterWeek): void {
    this.ultima.set(semana);
    this.blockChange.emit(weekToBlock(semana, this.block().slotMinutes));
  }
}

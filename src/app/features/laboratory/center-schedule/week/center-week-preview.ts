import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import type { ScheduleBlock } from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { ScheduleGrid } from '../../../agenda/my-agenda/schedule-grid/schedule-grid';
import { aHora } from '../../../../core/data-access/diagnostic-units/center-schedule.rules';
import { WEEK, appointmentsOfDay, toPublishedRules, type CenterWeek } from './center-week';

/**
 * «Así van a quedar sus horarios» and «Previsualizar horario», as in the
 * practitioner's agenda: the same per-day lines and the same weekly grid
 * (`ScheduleGrid`) that draws a published schedule, never a text imitation.
 */
@Component({
  selector: 'app-center-week-preview',
  imports: [AppButton, ContentDialog, ScheduleGrid],
  templateUrl: './center-week-preview.html',
  styleUrls: ['../../../agenda/agenda-create/schedule-day-row/schedule-week.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CenterWeekPreview {
  readonly block = input.required<ScheduleBlock>();
  readonly semana = input.required<CenterWeek>();
  readonly nombre = input.required<string>();
  readonly testPrefix = input.required<string>();

  protected readonly abierta = signal(false);

  protected readonly dias = computed(() =>
    this.semana()
      .days.map((d, i) => ({ d, i }))
      .filter(({ d }) => d.activo)
      .map(({ d, i }) => {
        const citas = appointmentsOfDay(d, this.semana().lunch);
        // The last appointment's end: the closing time that matters to a patient.
        const fin = citas[citas.length - 1]?.[1];
        return {
          dia: WEEK[i]!.label,
          desde: d.desde,
          hasta: fin === undefined ? null : aHora(fin),
          citas: citas.length,
          duracion: d.duracion,
          respiro: d.respiro,
        };
      }),
  );

  protected readonly total = computed(() => this.dias().reduce((n, d) => n + d.citas, 0));
  protected readonly reglas = computed(() => toPublishedRules(this.block()));
}

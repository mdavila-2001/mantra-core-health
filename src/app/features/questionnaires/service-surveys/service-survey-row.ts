import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type {
  ServiceSurveyRow as Row,
  StandardSurvey,
} from '../../../core/data-access/surveys/surveys-service-assignments.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { questionCount } from './service-surveys.logic';

/**
 * One service and its survey. Presentational: the container does the HTTP.
 * Without its own survey the row says the service base survey is used.
 */
@Component({
  selector: 'li[app-service-survey-row]',
  imports: [AppButton, Badge, DatePipe, NavIcon],
  templateUrl: './service-survey-row.html',
  styleUrl: './service-surveys.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'por-servicio__fila', '[attr.data-testid]': "'service-survey-' + row().serviceId" },
})
export class ServiceSurveyRow {
  readonly row = input.required<Row>();
  /** The catalog template in use, when the catalog has it. */
  readonly entry = input<StandardSurvey | null>(null);
  /** False while the catalog is missing or empty: nothing can be imported. */
  readonly canPick = input(true);
  readonly removing = input(false);

  readonly pick = output<void>();
  readonly remove = output<void>();
  readonly viewQuestions = output<void>();

  protected readonly questionCount = questionCount;
}

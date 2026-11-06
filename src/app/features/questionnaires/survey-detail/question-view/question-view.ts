import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { AnswerType, SurveyQuestion } from '../../../../core/data-access/surveys/surveys.types';
import { Input } from '../../../../shared/components/atoms/input/input';
import { QuestionTypeIcon } from '../../../../shared/components/atoms/question-type-icon/question-type-icon';

/** Readable label of each answer type. */
const TYPE_LABEL: Readonly<Record<AnswerType, string>> = {
  TEXT: 'Texto libre',
  SCALE: 'Escala',
  BOOLEAN: 'Sí / No',
  SINGLE_CHOICE: 'Elección simple',
  MULTIPLE_CHOICE: 'Elección múltiple',
};

const WITH_OPTIONS: ReadonlySet<AnswerType> = new Set(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']);

/**
 * One question of a survey sheet, READ-ONLY (06/11/2026): its text, required
 * mark, type and a disabled sample of how it is answered. Nothing opens or
 * edits it: hand-made surveys are no longer changed.
 */
@Component({
  selector: 'app-question-view',
  imports: [Input, QuestionTypeIcon],
  templateUrl: './question-view.html',
  styleUrl: './question-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionView {
  readonly question = input.required<SurveyQuestion>();

  protected readonly typeLabel = computed(() => TYPE_LABEL[this.question().answerType]);
  protected readonly options = computed(() => this.question().options ?? []);
  protected readonly listsOptions = computed(() => WITH_OPTIONS.has(this.question().answerType) && this.options().length > 0);

  /** The row's summary: up to three options («y N más») or the scale ends. */
  protected readonly detail = computed(() => {
    const q = this.question();
    if (q.answerType === 'SCALE') return `De ${q.scaleMin ?? 1} a ${q.scaleMax ?? 5}`;
    const options = this.options();
    if (options.length === 0) return '';
    const rest = options.length - Math.min(3, options.length);
    return rest > 0 ? `${options.slice(0, 3).join(' · ')} · y ${rest} más` : options.join(' · ');
  });

  /** What the disabled sample says when there is no option list. */
  protected readonly sample = computed(() => {
    const q = this.question();
    if (q.answerType === 'SCALE') return `De ${q.scaleMin ?? 1} a ${q.scaleMax ?? 5}`;
    return q.answerType === 'BOOLEAN' ? 'Sí / No' : 'Respuesta del paciente';
  });
}

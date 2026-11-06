import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { SurveyQuestion } from '../../../../core/data-access/surveys/surveys.types';
import { QuestionTypeIcon } from '../../../../shared/components/atoms/question-type-icon/question-type-icon';
import { answerFormat } from '../../service-surveys/service-surveys.logic';

/**
 * One question of a survey sheet, READ-ONLY (06/11/2026), as read text: the
 * question, its required mark and how it is answered — in the same words as
 * the catalog picker and «Ver preguntas» (`answerFormat`), options listed once.
 */
@Component({
  selector: 'app-question-view',
  imports: [QuestionTypeIcon],
  templateUrl: './question-view.html',
  styleUrl: './question-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionView {
  readonly question = input.required<SurveyQuestion>();

  protected readonly answer = computed(() => {
    const q = this.question();
    return answerFormat({
      text: q.questionText,
      answerType: q.answerType,
      required: q.required,
      ...(q.options === undefined ? {} : { options: q.options }),
      ...(q.scaleMin === undefined ? {} : { scaleMin: q.scaleMin }),
      ...(q.scaleMax === undefined ? {} : { scaleMax: q.scaleMax }),
    });
  });
}

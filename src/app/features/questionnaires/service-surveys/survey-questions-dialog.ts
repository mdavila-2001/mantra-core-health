import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { answerFormat, questionCount, type QuestionsView } from './service-surveys.logic';

/** Read-only, numbered list of a survey's questions, in a modal. Never invents missing texts. */
@Component({
  selector: 'app-survey-questions-dialog',
  imports: [AppButton, ContentDialog],
  templateUrl: './survey-questions-dialog.html',
  styleUrl: './service-surveys.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SurveyQuestionsDialog {
  readonly survey = input.required<QuestionsView>();
  readonly closed = output<void>();

  protected readonly answerFormat = answerFormat;
  protected readonly questionCount = questionCount;
}

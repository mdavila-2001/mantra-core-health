import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

import type { OnboardingDraft } from '../../../../core/onboarding/onboarding-draft.types';
import { AppButton } from '../../atoms/button/button';

@Component({
  selector: 'app-onboarding-draft-banner',
  imports: [DatePipe, AppButton],
  templateUrl: './onboarding-draft-banner.html',
  styleUrl: './onboarding-draft-banner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingDraftBanner {
  readonly draft = input.required<OnboardingDraft | null>();

  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly resume = output<OnboardingDraft>();
  readonly discard = output<void>();

  onResumir(): void {
    const d = this.draft();
    if (d) {
      this.resume.emit(d);
    }
  }

  onDescartar(): void {
    this.discard.emit();
  }
}

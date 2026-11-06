import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { DiagnosticStudy } from '../../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { ServiceIcon } from '../../../../shared/components/atoms/service-icon/service-icon';
import { addsToName, durationText, priceLabel, priceText } from '../study-format';

/**
 * One study of a diagnostic unit, as a card of the shared grid.
 *
 * Reading order follows the patient's questions: what it is, what to do
 * before coming (the preparation is set apart because skipping it means
 * repeating the study), and then how much and how soon.
 */
@Component({
  selector: 'app-lab-study-card',
  imports: [Badge, NavIcon, ServiceIcon],
  templateUrl: './study-card.html',
  styleUrls: ['../../../../shared/styles/card-grid.css', './study-card.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabStudyCard {
  readonly study = input.required<DiagnosticStudy>();

  /** Code and, when present, modality: what tells this card from the next one. */
  protected readonly reference = computed(() => {
    const { code, modality } = this.study();
    return modality?.display ? `${code} · ${modality.display}` : code;
  });

  protected readonly description = computed(() =>
    addsToName(this.study()) ? this.study().description : null,
  );
  protected readonly priceLabel = computed(() => priceLabel(this.study()));
  protected readonly price = computed(() => priceText(this.study()));
  protected readonly turnaround = computed(() =>
    durationText(this.study().expectedTurnaroundMinutes),
  );
}

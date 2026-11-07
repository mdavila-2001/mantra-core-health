import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { LabOrder } from '../../../core/data-access/lab-portal/lab-portal.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';

/** How an order reached the center: a chip for the way, plus who asked, under the patient's name. */
@Component({
  selector: 'app-order-origin',
  imports: [Badge],
  template: `
    @if (chip(); as label) {
      <app-badge size="sm" variant="info" [value]="label" data-testid="lab-order-origin-chip" />
    }
    <span class="line" data-testid="lab-order-origin">{{ line() }}</span>
  `,
  styles: `
    .line {
      display: block;
      color: var(--text-secondary);
      font-size: var(--fs-caption);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderOrigin {
  readonly order = input.required<LabOrder>();

  protected readonly chip = computed(() => {
    switch (this.order().origin) {
      case 'PATIENT_QR':
        return 'QR del paciente';
      case 'DOCTOR_REFERRAL':
        return 'Derivada por médico';
      case 'LAB_OWN':
        return 'Registrada por el centro';
      default:
        return null;
    }
  });

  protected readonly line = computed(() => {
    const { origin, requesterName } = this.order();
    if (origin === 'PATIENT_QR') return `Por el QR del paciente · pidió ${requesterName}`;
    if (origin === 'DOCTOR_REFERRAL') return `Derivada por ${requesterName}, aceptada por el paciente`;
    if (origin === 'LAB_OWN') return `Firmó ${requesterName}`;
    return `Pidió ${requesterName}`;
  });
}

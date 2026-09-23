import { normalizePatientSettlement } from '../../../../core/data-access/insurance/patient-insurance-settlement.types';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type {
  InsuranceSettlementAvailability,
  PatientInsuranceSettlement as Settlement,
} from '../../../../core/data-access/insurance/patient-insurance-settlement.types';
import { Badge } from '../../atoms/badge/badge';

@Component({
  selector: 'app-patient-insurance-settlement',
  imports: [Badge],
  templateUrl: './patient-insurance-settlement.html',
  styleUrl: './patient-insurance-settlement.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientInsuranceSettlement {
  readonly settlement = input<Settlement | null>(null);
  readonly availability = input<InsuranceSettlementAvailability>('NOT_AVAILABLE');
  private readonly normalized = computed(() =>
    normalizePatientSettlement({
      insuranceSettlementAvailability: this.availability(),
      insuranceSettlement: this.settlement(),
    }),
  );
  protected readonly published = computed(() => this.normalized().insuranceSettlement);
  // El texto sale de la disponibilidad YA normalizada, no del input: un AVAILABLE
  // con importes incompletos se degrada a UNDER_REVIEW, y decir «disponible»
  // mientras no se muestra ni un importe sería anunciar un cargo que no hay.
  protected readonly availabilityText = computed(() => {
    const availability = this.normalized().insuranceSettlementAvailability;
    return availability === 'AVAILABLE'
      ? null
      : {
          PENDING_PUBLICATION: 'La aseguradora todavía no publicó la liquidación de este pedido.',
          UNDER_REVIEW:
            'La liquidación está en revisión. El cargo al paciente todavía no está confirmado.',
          NOT_AVAILABLE: 'No hay una liquidación del seguro disponible para este pedido.',
        }[availability];
  });
  protected resultText(result: Settlement['result']): string {
    return {
      APPROVED: 'Aprobado',
      PARTIALLY_APPROVED: 'Aprobado parcialmente',
      DENIED: 'Rechazado por el seguro',
    }[result];
  }
  protected currency(code: string): string {
    return code === 'BOB' ? 'Bs' : code;
  }
}

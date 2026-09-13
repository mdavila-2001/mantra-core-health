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
  protected readonly published = computed(
    () =>
      normalizePatientSettlement({
        insuranceSettlementAvailability: this.availability(),
        insuranceSettlement: this.settlement(),
      }).insuranceSettlement,
  );
  protected readonly availabilityText = computed(
    () =>
      ({
        AVAILABLE: 'Liquidación en revisión',
        PENDING_PUBLICATION: 'La aseguradora todavía no publicó la liquidación de este pedido.',
        UNDER_REVIEW:
          'La liquidación está en revisión. El cargo al paciente todavía no está confirmado.',
        NOT_AVAILABLE: 'No hay una liquidación del seguro disponible para este pedido.',
      })[this.availability()],
  );
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

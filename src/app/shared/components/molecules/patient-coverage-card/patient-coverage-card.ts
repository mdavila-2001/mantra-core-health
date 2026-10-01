import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type {
  CoverageValidity,
  OwnCoverage,
} from '../../../../core/data-access/profiles/profiles.types';
import { dialable, whatsappUrl } from '../../../utils/telephone/telephone';
import { Badge } from '../../atoms/badge/badge';
import { Link } from '../../atoms/link/link';
import { withDisplayCurrency } from '../../../../core/money/display-currency';

@Component({
  selector: 'app-patient-coverage-card',
  imports: [Badge, Link],
  templateUrl: './patient-coverage-card.html',
  styleUrl: './patient-coverage-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientCoverageCard {
  readonly coverage = input.required<OwnCoverage>();
  readonly patientName = input<string>();
  protected readonly benefits = computed(() => this.coverage().benefits ?? []);
  protected readonly whatsapp = computed(() => {
    const coverage = this.coverage();
    if (!coverage.carrierWhatsappNumber) return null;
    return whatsappUrl(
      coverage.carrierWhatsappNumber,
      [
        'Hola, necesito ayuda con mi cobertura.',
        `Paciente: ${this.patientName() ?? 'No informado'}.`,
        `Aseguradora: ${coverage.carrierName}.`,
        ...(coverage.policyIdentifier ? [`Póliza: ${coverage.policyIdentifier}.`] : []),
      ].join(' '),
    );
  });
  protected readonly telephone = computed(() => {
    const phone = this.coverage().carrierCallCenterPhone;
    return phone && dialable(phone) ? `tel:${dialable(phone)}` : null;
  });
  protected statusText(): string {
    const coverage = this.coverage();
    return ['COVERAGE_ACTIVE', 'insurance:COVERAGE_ACTIVE'].includes(coverage.statusCode ?? '') &&
      coverage.validityStatus !== 'CURRENT'
      ? this.validityText(coverage.validityStatus)
      : (coverage.status ?? 'No informado');
  }
  protected validityText(validity?: CoverageValidity): string {
    return {
      CURRENT: 'Vigente',
      UPCOMING: 'Vigencia futura',
      EXPIRED: 'Vencida',
      INACTIVE: 'Inactiva',
      UNKNOWN: 'Vigencia no informada',
    }[validity ?? 'UNKNOWN'];
  }
  protected date(value?: string): string {
    if (!value) return 'No informado';
    const [year, month, day] = value.slice(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : 'No informado';
  }
  protected amount(value?: string): string {
    if (value == null) return 'No informado';
    const code = this.coverage().currencyCode;
    // Sin moneda en el dato se dice así y no «Bs»: la tarjeta no inventa en
    // qué moneda está un tope de cobertura.
    if (code === null || code === undefined) return `${value} (moneda no informada)`;
    return withDisplayCurrency(value, code);
  }

  /**
   * Activa el enlace de WhatsApp con la tecla Espacio (CA-2.1, Tarea 2): un
   * `<a>` nativo sólo responde a Enter.
   */
  protected onWhatsappKeydownSpace(event: Event): void {
    event.preventDefault();
    (event.currentTarget as HTMLAnchorElement).click();
  }
}

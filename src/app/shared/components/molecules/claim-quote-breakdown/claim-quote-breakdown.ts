import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { withDisplayCurrency } from '../../../../core/money/display-currency';
import { Badge } from '../../atoms/badge/badge';
import type { BadgeVariant } from '../../atoms/badge/badge.types';
import type {
  ClaimQuoteAuthorizationStatus,
  ClaimQuoteBreakdownVm,
} from './claim-quote-breakdown.types';

/** Tono del badge de autorización: lo que bloquea se ve distinto de lo que ya está en orden. */
const TONO_DE_AUTORIZACION: Readonly<Record<ClaimQuoteAuthorizationStatus, BadgeVariant>> = {
  NOT_REQUIRED: 'success',
  APPROVED: 'success',
  MISSING: 'warning',
  PENDING: 'warning',
  DENIED: 'error',
  EXPIRED: 'error',
  MISMATCH: 'error',
  AMOUNT_EXCEEDED: 'error',
};

/**
 * **Reparto de un cobro con seguro** (REQ-16-026 y REQ-16-031): cuánto cubre el
 * plan, el copago, lo que paga la persona y lo que paga la aseguradora.
 *
 * Molécula de presentación pura: recibe un vm ya armado y lo pinta. No inyecta
 * servicios, no suma importes y no decide nada de negocio; la misma pieza la
 * usan la pantalla de cobro del médico y el portal del paciente.
 *
 * ```html
 * <app-claim-quote-breakdown [vm]="desglose()" />
 * ```
 */
@Component({
  selector: 'app-claim-quote-breakdown',
  imports: [Badge],
  templateUrl: './claim-quote-breakdown.html',
  styleUrl: './claim-quote-breakdown.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClaimQuoteBreakdown {
  readonly vm = input.required<ClaimQuoteBreakdownVm>();

  protected readonly tonoDe = TONO_DE_AUTORIZACION;

  /** Las cifras de cabecera ya con su moneda; cada cadena sale del servidor sin tocar. */
  protected readonly cifras = computed(() => {
    const { headline, currencyCode } = this.vm();
    return {
      coverage: headline.coverage === null ? null : `${headline.coverage} %`,
      copay: this.conMoneda(headline.copay, currencyCode),
      patient: this.conMoneda(headline.patient, currencyCode),
      insurer: this.conMoneda(headline.insurer, currencyCode),
    };
  });

  protected conMoneda(importe: string | null, codigo: string | null): string | null {
    return importe === null ? null : withDisplayCurrency(importe, codigo);
  }
}

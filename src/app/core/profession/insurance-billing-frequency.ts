import type { InsuranceBillingFrequency } from '../data-access/profiles/profiles.types';

/** Una frecuencia de facturación al seguro, lista para un selector. */
export interface InsuranceBillingFrequencyOption {
  readonly value: InsuranceBillingFrequency;
  readonly label: string;
}

/**
 * Cada cuánto el profesional presenta su facturación a las aseguradoras.
 *
 * Lista cerrada de tres, a pedido del propietario (01/10/2026). Es un código
 * y no un `*_concept_id` porque el modelo todavía no declara el campo ni un
 * value set: cuando exista, esto pasa a ser un mapeo y la vista y el editor
 * lo heredan juntos.
 */
export const INSURANCE_BILLING_FREQUENCY_OPTIONS: readonly InsuranceBillingFrequencyOption[] = [
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quincenal' },
  { value: 'MONTHLY', label: 'Mensual' },
];

/** La etiqueta en palabras, o `''` si no declaró ninguna o el código no se conoce. */
export function insuranceBillingFrequencyLabel(
  value: InsuranceBillingFrequency | undefined,
): string {
  return INSURANCE_BILLING_FREQUENCY_OPTIONS.find((option) => option.value === value)?.label ?? '';
}

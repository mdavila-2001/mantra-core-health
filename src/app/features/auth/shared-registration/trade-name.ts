import { FormControl, Validators } from '@angular/forms';

import type { CampoDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';

/* ============================================================================
    The organization's trade name, asked once and the same way in every
    organization sign-up (imaging, laboratory, pharmacy, medical organization).

    "Mi perfil" and the directory show `tradeName`, so the sign-up has to ask
    for it; the API accepts it for every tenant type (`RegisterOrganizationDetailsDto`).
    It is optional: when left blank the legal name acts as the name, and the
    key does not travel at all (`forbidNonWhitelisted` rejects nothing, and an
    empty string would overwrite nothing).
    ========================================================================== */

/** Same ceiling as the legal name (`legalName`, 300 in the API DTO). */
export const MAX_TRADE_NAME = 300;

/** The optional control: never null, capped like the legal name. */
export function tradeNameControl(): FormControl<string> {
  return new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(MAX_TRADE_NAME)],
  });
}

/** The field as the paginated form draws it, right after the legal name. */
export function tradeNameField(
  testId: string,
  placeholder: string,
  conocidoPor: 'los pacientes' | 'los clientes' = 'los pacientes',
): CampoDeFormulario {
  return {
    key: 'tradeName',
    label: 'Nombre comercial (opcional)',
    hint: `Con el que lo conocen ${conocidoPor}. Es el que se ve en el directorio y en su perfil.`,
    control: 'text',
    icono: 'building',
    placeholder,
    testId,
  };
}

/** What travels in the body: `{ tradeName }` when something was written, nothing otherwise. */
export function tradeNameOf(value: string): { readonly tradeName?: string } {
  const trimmed = value.trim();
  return trimmed === '' ? {} : { tradeName: trimmed };
}

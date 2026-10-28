import type { CampoDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';

/**
 * «Distrito o zona (opcional)»: el campo que aparece junto a la calle en cuanto
 * hay localidad elegida (`padre` es la clave de esa localidad).
 *
 * Viaja aparte de la calle, a su propia columna (ADR-0028 de la API): en el
 * domicilio, en el trabajo y en el consultorio propio.
 */
export function campoDistrito(key: string, testId: string, padre: string): CampoDeFormulario {
  return {
    key,
    label: 'Distrito o zona (opcional)',
    hint: 'El distrito, la zona o el barrio.',
    description: 'El distrito, la zona o el barrio de la dirección.',
    control: 'text',
    placeholder: 'Distrito 5, Zona Norte',
    testId,
    icono: 'pin',
    showWhen: { key: padre, filled: true },
  };
}

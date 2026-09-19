import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/* ============================================================================
    Código de tenant y de aseguradora, derivados de la sigla.

    El alta pedía dos identificadores técnicos a mano —`code` del tenant y
    `carrierCode` de `insurance.insurance_carriers`— además de la sigla, y
    quien se registraba terminaba escribiendo el mismo valor arbitrario en los
    tres. Acá se deriva UNO de la sigla y se usa para los dos: el backend no
    exige que sean distintos (`RegisterOrganizationDetailsDto.code` y
    `PayerProfileDto.carrierCode` son campos independientes, y nada impide que
    valgan igual — de hecho ya era la costumbre de quien completaba el alta a
    mano).

    `code` es el más estricto de los dos: la API exige
    `@MinLength(3) @MaxLength(100)` y `/^[A-Za-z0-9._-]+$/`
    (`register-organization.dto.ts`); `carrierCode` sólo pide 1 a 60
    caracteres libres. Derivar del más estricto y usarlo para ambos deja los
    dos siempre válidos sin duplicar la validación.
    ========================================================================== */

/** La sigla es lo único que la persona ve: de 3 a 20 caracteres, como pide el DTO real de `sigla`. */
export const MIN_SIGLA = 3;
export const MAX_SIGLA = 20;

/** Lo que el backend acepta en `code` (y, por herencia, lo que se manda como `carrierCode`). */
const PATRON_CODIGO_VALIDO = /^[A-Za-z0-9._-]+$/;
const MIN_CODIGO = 3;

/**
 * Al menos un carácter alfanumérico. Punto y guion son parte válida del
 * patrón del backend —separan palabras—, pero una sigla como `"---"` deriva
 * en un código que el patrón acepta sin decir nada: nunca identificaría una
 * organización. Esto es lo que distingue ese caso de uno realmente vacío.
 */
const TIENE_ALFANUMERICO = /[A-Z0-9]/;

/**
 * Deriva el código de plataforma a partir de la sigla: sin diacríticos, en
 * MAYÚSCULAS, con todo lo que no sea letra, dígito, punto o guion vuelto
 * `_`, y sin `_` sobrante en los bordes.
 *
 * `'APT'` → `'APT'` (AC-01 del registro de procesos); `'La Vitalicia'` →
 * `'LA_VITALICIA'`; una sigla de sólo símbolos puede derivar en una cadena
 * vacía o más corta que `MIN_CODIGO` — por eso el validador de abajo, no
 * esta función, es quien decide si el resultado sirve.
 */
export function codigoDesdeSigla(sigla: string): string {
  return sigla
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Que la sigla, una vez derivada a código, sea un `code`/`carrierCode`
 * válido para el backend. Vive en el propio campo de sigla —no hay control
 * de código visible en el que anclar el error— y es lo único que evita
 * mandar una sigla como `"---"` que derivaría en una cadena vacía.
 */
export const siglaDerivaCodigo: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = typeof control.value === 'string' ? control.value : '';
  if (valor.trim() === '') {
    // Cadena vacía: la cubre `Validators.required` del propio control, no
    // esto — evita un doble mensaje de error para el mismo campo vacío.
    return null;
  }

  const codigo = codigoDesdeSigla(valor);
  const valido =
    codigo.length >= MIN_CODIGO &&
    PATRON_CODIGO_VALIDO.test(codigo) &&
    TIENE_ALFANUMERICO.test(codigo);
  return valido ? null : { siglaSinCodigo: true };
};

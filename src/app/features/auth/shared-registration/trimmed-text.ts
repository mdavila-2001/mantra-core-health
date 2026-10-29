import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/* ============================================================================
    Validadores de texto que miran lo que VIAJA, no lo que se escribió.

    `Validators.required` da por bueno `'   '`: tiene tres caracteres. Pero la
    API recibe el valor recortado, y un valor que sale vacío es un 400 que la
    persona no vio venir. Estos validadores comparan después de recortar, y un
    valor de solo espacios cuenta como lo que es: un dato que falta (`required`),
    así el campo dice su mensaje de «falta» y no uno de formato.

    Son para las pantallas que recortan al enviar. No reemplazan a
    `Validators.required`: el vacío de verdad lo sigue diciendo él.
    ========================================================================== */

/** El valor del control como texto, sin los blancos de los extremos. */
function recortado(control: AbstractControl): { crudo: string; texto: string } {
  const crudo = typeof control.value === 'string' ? control.value : String(control.value ?? '');
  return { crudo, texto: crudo.trim() };
}

/**
 * Un valor de solo espacios es un dato que falta. Vacío de verdad no es asunto
 * de este validador (`Validators.required`), ni lo que tiene letras.
 */
export const noSoloEspacios: ValidatorFn = (control): ValidationErrors | null => {
  const { crudo, texto } = recortado(control);
  return crudo !== '' && texto === '' ? { required: true } : null;
};

/**
 * El largo de lo que viaja: entre `min` y `max` caracteres **después de
 * recortar**. Solo espacios es `required`; vacío de verdad lo dice
 * `Validators.required`.
 */
export function largoRecortado(min: number, max: number): ValidatorFn {
  return (control): ValidationErrors | null => {
    const { crudo, texto } = recortado(control);
    if (crudo === '') return null;
    if (texto === '') return { required: true };
    if (texto.length < min) return { minlength: { requiredLength: min, actualLength: texto.length } };
    if (texto.length > max) return { maxlength: { requiredLength: max, actualLength: texto.length } };
    return null;
  };
}

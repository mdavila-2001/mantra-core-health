import { FormArray, FormGroup, type AbstractControl } from '@angular/forms';

/**
 * ¿Hay algo inválido en el formulario, aunque el grupo diga `PENDING`?
 *
 * Angular calcula el estado de un grupo con `PENDING` **por encima** de
 * `INVALID`: mientras un validador asíncrono —la disponibilidad del documento
 * (C-10)— espera respuesta, un grupo con un celular vacío no es `invalid`. Un
 * envío que sólo mira `grupo.invalid` pasaría con datos mal en ese medio
 * segundo. Esto baja a los hijos y responde por lo que ya se sabe.
 *
 * Un control que sólo está esperando no cuenta como inválido: decide la API,
 * que aplica la misma regla.
 */
export function hayAlgoInvalido(control: AbstractControl | null): boolean {
  if (control === null) return false;
  if (control.invalid) return true;
  if (!control.pending) return false;
  if (control.errors !== null) return true;
  if (control instanceof FormGroup) {
    return Object.values(control.controls).some(hayAlgoInvalido);
  }
  if (control instanceof FormArray) {
    return control.controls.some(hayAlgoInvalido);
  }
  return false;
}

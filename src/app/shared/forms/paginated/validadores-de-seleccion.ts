import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Cuántas respuestas hay que marcar en un campo de varias (`checkboxes`).
 *
 * Son las tres reglas de «validación de respuesta» de las casillas de un
 * formulario de encuesta: **al menos** N, **como máximo** N, **exactamente**
 * N. Van juntas en un solo validador y no en dos sueltos porque «exactamente»
 * no es la suma de los otros dos: con mínimo y máximo iguales el mensaje tiene
 * que decir «exactamente 2», no «al menos 2» y después «como máximo 2».
 *
 * Un control vacío no falla acá: si el campo es obligatorio, lo dice
 * `Validators.required`, y si no lo es, no marcar nada es una respuesta
 * válida. Contar un array vacío como «menos de dos» haría obligatorio a un
 * campo que no lo es.
 *
 * Los mensajes los traduce `mensajeDeError`.
 */
export function validadorDeSeleccion(
  minimo: number | undefined,
  maximo: number | undefined,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (!Array.isArray(valor) || valor.length === 0) {
      return null;
    }
    const marcadas = valor.length;

    if (minimo !== undefined && maximo !== undefined && minimo === maximo) {
      return marcadas === minimo
        ? null
        : { exactSelections: { required: minimo, actual: marcadas } };
    }
    if (minimo !== undefined && marcadas < minimo) {
      return { minSelections: { min: minimo, actual: marcadas } };
    }
    if (maximo !== undefined && marcadas > maximo) {
      return { maxSelections: { max: maximo, actual: marcadas } };
    }
    return null;
  };
}

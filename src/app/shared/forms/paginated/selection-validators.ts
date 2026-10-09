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

/**
 * Las restricciones de una cuadrícula: **respuesta en cada fila** y **una sola
 * respuesta por columna**.
 *
 * Son las dos de Google Forms, con la misma redacción, y van juntas por lo
 * mismo que van juntos los topes de las casillas: se declaran sobre el mismo
 * campo y hay que decidir cuál se dice primero cuando las dos fallan. Gana la
 * de la columna repetida, porque es la que la persona acaba de provocar.
 *
 * La de la columna es una **red**, no la defensa principal: el control apaga
 * las celdas de una columna ya usada, así que repetirla no debería llegar a
 * pasar. Se valida igual porque un valor puede venir de un borrador guardado
 * antes de que la restricción existiera.
 *
 * Un control vacío no falla por «una por columna» —no hay nada repetido— pero
 * sí por «cada fila», que es justamente lo que exige.
 */
export function validadorDeCuadricula(
  filas: readonly string[],
  opciones: { readonly requerirCadaFila: boolean; readonly unaPorColumna: boolean },
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = comoRespuestaDeCuadricula(control.value);

    if (opciones.unaPorColumna) {
      const vistas = new Set<string>();
      for (const fila of filas) {
        for (const columna of columnasDe(valor[fila])) {
          if (vistas.has(columna)) {
            return { gridColumnRepeated: { column: columna } };
          }
          vistas.add(columna);
        }
      }
    }

    if (opciones.requerirCadaFila) {
      const faltan = filas.filter((fila) => columnasDe(valor[fila]).length === 0);
      if (faltan.length > 0) {
        return { gridRowMissing: { missing: faltan.length, total: filas.length } };
      }
    }

    return null;
  };
}

/** Lo respondido en una fila, siempre como lista. */
function columnasDe(respuesta: unknown): readonly string[] {
  if (typeof respuesta === 'string' && respuesta !== '') return [respuesta];
  return Array.isArray(respuesta) ? (respuesta as readonly string[]) : [];
}

/** Tolera el `''` con el que nace un `FormControl` sin valor inicial. */
function comoRespuestaDeCuadricula(valor: unknown): Record<string, unknown> {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    return {};
  }
  return valor as Record<string, unknown>;
}

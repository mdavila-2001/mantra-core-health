/* ============================================================================
    Contratos de la cuadrícula de preguntas.
    ========================================================================== */

/** Una fila o una columna de la cuadrícula. */
export interface OpcionDeCuadricula {
  readonly value: string;
  readonly label: string;
}

/**
 * Lo que una cuadrícula guarda: **una entrada por fila respondida**.
 *
 * En la de opción única el valor es la columna elegida; en la de casillas, las
 * columnas marcadas, en el orden en que se ofrecieron. Una fila sin responder
 * **no aparece**: guardarla como cadena vacía o como array vacío obligaría a
 * distinguir dos formas de decir lo mismo en cada sitio que la lea.
 */
export type RespuestaDeCuadricula = Readonly<Record<string, string | readonly string[]>>;

/** Lo respondido en una fila, siempre como lista, para contar sin ramificar. */
export function marcadasDeFila(
  valor: RespuestaDeCuadricula | null | undefined,
  fila: string,
): readonly string[] {
  const respuesta = valor?.[fila];
  if (respuesta === undefined) return [];
  return Array.isArray(respuesta) ? respuesta : [respuesta as string];
}

/**
 * Tolera cualquier cosa que llegue y devuelve una respuesta de cuadrícula.
 *
 * Un `FormControl` recién creado sin valor inicial trae `''`, y leer `''[fila]`
 * devuelve `undefined` sin fallar — pero `null[fila]` sí falla, y un array
 * pasaría por objeto dejando índices donde tendría que haber filas.
 */
export function comoRespuesta(valor: unknown): RespuestaDeCuadricula {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    return {};
  }
  return valor as RespuestaDeCuadricula;
}

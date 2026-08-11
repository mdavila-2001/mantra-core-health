/**
 * Cómo se nombra el estado de un caso **para quien lo revisa**.
 *
 * `case-status.ts` resuelve el estado para el titular, y ahí hay un
 * enmascaramiento deliberado: `CASE_AT_RISK` se muestra como «En revisión»
 * porque *«a la persona verificada no se le revela la marca de riesgo»*.
 *
 * Esa decisión es correcta para el titular y **es incorrecta acá**: el trabajo
 * del revisor es justamente valorar el riesgo, y una cola que le esconde cuál
 * de los casos viene marcado le quita el único dato que cambia su orden de
 * atención. Así que esta pantalla lo desenmascara, y sólo eso — el resto de los
 * estados los sigue nombrando el mapa compartido, para que un estado no se
 * llame de dos formas según quién mire.
 */

/**
 * Código de catálogo del estado marcado por riesgo.
 *
 * Es el **código** y no el UUID a propósito: la interfaz dejó de conocer los
 * identificadores del catálogo justamente porque ese conocimiento caduca sin
 * que nadie se entere. El código es la identidad semántica del concepto; el
 * identificador se deriva de ella.
 */
export const AT_RISK_CODE = 'CASE_AT_RISK';

/**
 * Etiqueta que ve el revisor: la compartida, salvo el caso marcado.
 *
 * @param statusCode - Código del estado, o `null` si el catálogo no resolvió.
 * @param sharedLabel - Cómo nombra ese estado el mapa compartido.
 */
export function toReviewerStatusLabel(
  statusCode: string | null,
  sharedLabel: string,
): string {
  return statusCode === AT_RISK_CODE ? 'Marcado por riesgo' : sharedLabel;
}

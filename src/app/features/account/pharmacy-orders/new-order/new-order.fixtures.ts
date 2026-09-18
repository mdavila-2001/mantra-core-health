/**
 * **Lo que queda del andamiaje de demostración de la orden médica** (T-E1).
 *
 * La pantalla dejó de dibujar datos sin contrato (FAR-REAL-T-E1, `D-R1-1 = A`):
 * se fueron la cabecera de receta inventada, el techo de cantidad de ejemplo,
 * el criterio de aprobación del seguro y las alternativas por renglón. De este
 * archivo sobrevive sólo lo que **otras pantallas todavía usan**:
 *
 * - {@link NOTA_DE_DATOS_DE_EJEMPLO}, el rótulo único con el que el checkout
 *   marca lo suyo que sigue siendo maqueta (territorio de FAR-REAL-T-E3).
 * - {@link AlternativaDeEjemplo}, el tipo que viaja en el traspaso al checkout
 *   (`new-order.handoff.ts`). Desde esta pantalla **siempre va `null`**: no hay
 *   alternativas que elegir hasta que exista la búsqueda real (F2.1.2).
 *
 * Cuando el checkout se integre y el traspaso deje de llevar alternativas, este
 * archivo desaparece.
 */

/** El cartel único: quien mira la pantalla sabe qué parte es maqueta. */
export const NOTA_DE_DATOS_DE_EJEMPLO = 'Datos de ejemplo';

/**
 * Otra marca del mismo genérico, más económica que la recetada.
 *
 * No tiene `productId` a propósito: nunca puede viajar en el cuerpo de un
 * pedido real.
 */
export interface AlternativaDeEjemplo {
  /** Identificador de ejemplo. **No** es un `productId`. */
  readonly id: string;
  readonly nombre: string;
  readonly presentacion: string | null;
  /** Precio unitario, texto exacto. */
  readonly precio: string;
  /** Recetada menos alternativa, por unidad, texto exacto. */
  readonly ahorro: string;
}

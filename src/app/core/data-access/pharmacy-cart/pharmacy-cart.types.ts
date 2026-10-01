/**
 * Tipos del carrito de farmacia (Ola 0, carriles 41 y 46 del plan de
 * `04-farmacia-ecommerce-2026-09-25`). Contrato congelado en el plan maestro
 * §4.2: Justin, Itzan y Marcelo compilan contra esto sin esperar nada más.
 */

/** La sede a la que pertenece el carrito. Un carrito es de una sola sede. */
export interface CartSite {
  readonly pharmacyId: string;
  readonly pharmacyName: string;
  readonly siteId: string;
  readonly siteName: string;
  readonly addressText: string | null;
}

/** Un renglón del carrito, ya en palabras. */
export interface CartLine {
  readonly productId: string;
  readonly name: string;
  readonly presentation: string | null;
  readonly quantity: number;
  readonly unitAmount: string | null;
  readonly currency: string | null;
  readonly requiresPrescription: boolean;
  readonly medicationConceptId: string | null;
}

/** El carrito activo. `null` es "sin carrito", nunca un carrito vacío de líneas. */
export interface CartState {
  readonly site: CartSite;
  readonly requestId: string | null;
  readonly lines: readonly CartLine[];
  readonly updatedAt: string;
}

/**
 * Qué pasó al intentar agregar una línea.
 *
 * `conflict`: la sede del carrito no es la de la línea que se intenta agregar
 * — un carrito es de una sola sede, y no se pisa sin preguntar. `requires-
 * prescription`: el producto exige receta y el carrito no tiene `requestId`.
 */
export type AddOutcome = 'added' | 'conflict' | 'requires-prescription';

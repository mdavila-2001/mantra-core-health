/**
 * **Los datos de ejemplo de «Dónde comprar mi receta»** (T-E2 · F2.2.2).
 *
 * Lo único que la pantalla dibuja sin contrato es **qué renglones de la receta
 * aprueba el seguro**: no existe en el resumen clínico, ni en la disponibilidad,
 * ni en el borrador del pedido — la liquidación real del seguro llega recién
 * sobre un pedido ya creado. Así que no se inventa un campo en `core/`: se
 * declara acá, junto a la pantalla, y la pantalla lo rotula como demostración.
 *
 * Reglas que este archivo respeta:
 *
 * - **No reemplaza la disponibilidad.** Las sedes, sus existencias y sus
 *   precios siguen saliendo de `GET /pharmacy-inventory/availability`; esto
 *   sólo decide sobre qué renglones se evalúa la variante con seguro.
 * - **Se deriva de la posición del renglón, no de un identificador.** Los
 *   conceptos del backend simulado y los de la API real son distintos;
 *   derivar de la posición hace que la demostración funcione con cualquier
 *   receta.
 * - **Es propio de T-E2.** No comparte criterio ni código con los datos de
 *   ejemplo de la orden médica (T-E1): la convergencia F → E del seguro queda
 *   como deuda registrada, no como un contrato común inventado.
 *
 * TODO(seguro real): cuando exista la aprobación por renglón en un contrato,
 * {@link aprobadosPorElSeguroDeEjemplo} se reemplaza por esa lectura.
 */

/** El rótulo único: quien mira la pantalla sabe qué parte es maqueta. */
export const NOTA_DE_DEMOSTRACION = 'Demostración';

/**
 * Los conceptos de la receta que el seguro aprueba, de ejemplo.
 *
 * Criterio: con un solo renglón, está aprobado; con más de uno, el **último**
 * queda a cargo de la persona. Así la variante siempre muestra las dos caras
 * del desglose —aprobado y a tu cargo— sin que ninguna receta quede entera
 * fuera del seguro.
 *
 * Recibe **toda** la receta, no sólo lo tildado: la aprobación es del renglón,
 * y destildar otro medicamento no la cambia.
 */
export function aprobadosPorElSeguroDeEjemplo(conceptIds: readonly string[]): ReadonlySet<string> {
  if (conceptIds.length <= 1) {
    return new Set(conceptIds);
  }
  return new Set(conceptIds.slice(0, -1));
}

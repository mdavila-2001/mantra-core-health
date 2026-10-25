/**
 * Los códigos de la categoría «procedimiento» de una orden.
 *
 * La API devuelve `SR_PROCEDURE`, la maqueta `SRQ-PROCEDURE`, y terminología
 * puede anteponer el módulo (`clinical:SERVICE_REQUEST_CATEGORY_PROCEDURE`).
 * Se aceptan todos (A-8 de `CONTRATO.md`) hasta que CM-04 confirme el real.
 *
 * Qué orden es de procedimiento lo decide CM-10 con `PROCEDURE_CATEGORY_CODES`
 * en `diagnostic-orders.types.ts`. Cuando ese cambio llegue, este archivo se
 * reemplaza por su import.
 */
export const PROCEDURE_CATEGORY_CODES: readonly string[] = [
  'SRQ-PROCEDURE',
  'SR_PROCEDURE',
  'SERVICE_REQUEST_CATEGORY_PROCEDURE',
];

/** Si el código de una categoría es el de procedimiento, con o sin prefijo de módulo. */
export function isProcedureCategory(code: string | undefined): boolean {
  if (code === undefined) {
    return false;
  }
  const simple = code.slice(code.lastIndexOf(':') + 1);
  return PROCEDURE_CATEGORY_CODES.includes(simple);
}

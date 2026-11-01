/**
 * Filtros de lo que se teclea. Se aplican en el `<input>` mismo (ver
 * `Input.inputFilter`), no sólo en el valor del formulario: así el carácter
 * rechazado no llega a pintarse nunca, ni siquiera cuando el valor filtrado
 * coincide con el anterior y ninguna señal cambia.
 */

/**
 * Un nombre o apellido: sólo letras (con tildes y ñ) separadas por un solo espacio,
 * para apellidos compuestos («De La Cruz»). Sin dígitos ni símbolos, sin espacio
 * al inicio ni espacios seguidos. El espacio final se conserva: se va a seguir
 * escribiendo la palabra siguiente.
 */
export function soloLetrasDeNombre(valor: string): string {
  return valor
    .replace(/[^\p{L}\p{M} ]/gu, '')
    .replace(/ {2,}/g, ' ')
    .replace(/^ /, '');
}

/** Un documento: sólo letras y dígitos. Sin espacios ni símbolos. */
export function soloLetrasYNumeros(valor: string): string {
  return valor.replace(/[^\p{L}\p{M}\p{Nd}]/gu, '');
}

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

/** Drops what `prohibidos` matches, leading symbols and every symbol right after another one. */
function tramoDeCorreo(texto: string, prohibidos: RegExp): string {
  return texto
    .replace(prohibidos, '')
    .replace(/^[._-]+/, '')
    .replace(/([._-])[._-]+/g, '$1');
}

/**
 * An email address as it is typed: ASCII letters and digits, with `.`, `_` or
 * `-` only between them (never first, never two in a row), and a single `@`
 * after at least one letter or digit. The domain takes only `.` and `-`.
 * Spaces, accents, `+` and any other symbol never reach the field, not even
 * when pasted: `---++++-++--+++++` leaves it empty.
 */
export function soloCaracteresDeCorreo(valor: string): string {
  const arroba = valor.indexOf('@');
  const local = tramoDeCorreo(arroba < 0 ? valor : valor.slice(0, arroba), /[^A-Za-z0-9._-]/g);
  if (arroba < 0) return local;
  const usuario = local.replace(/[._-]+$/, '');
  if (usuario === '') return '';
  return `${usuario}@${tramoDeCorreo(valor.slice(arroba + 1), /[^A-Za-z0-9.-]/g)}`;
}

/** The typing filter a paginated-form field gets (see `FieldDef.soloLetras`). */
export function filtroDeCampo(campo: {
  control?: string;
  soloLetras?: boolean;
  soloAlfanumerico?: boolean;
}): ((valor: string) => string) | null {
  if (campo.soloLetras) return soloLetrasDeNombre;
  if (campo.soloAlfanumerico) return soloLetrasYNumeros;
  if (campo.control === 'email') return soloCaracteresDeCorreo;
  return null;
}

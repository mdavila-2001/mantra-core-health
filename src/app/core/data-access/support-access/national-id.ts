/**
 * El documento de identidad en una forma comparable: mayúsculas, sin espacios, puntos ni guiones y sin ceros de
 * relleno a la izquierda. «01.234-567» y «1234567» dan lo mismo.
 *
 * Es una normalización **de esta pantalla** (detectar un documento sin contenido, comparar dos escritos distintos).
 * No se verificó que la API la aplique al buscar: la búsqueda de una secretaria por documento
 * (`POST /me/practitioner/support-invitations`) compara el texto tal cual se envía. Una cadena sin contenido
 * —«000000», «.-.-»— queda en `'0'` o vacía.
 */
export function canonicalNationalId(raw: string): string {
  const compact = raw.toUpperCase().replace(/[\s.-]+/g, '');
  const stripped = compact.replace(/^0+/, '');
  return stripped === '' ? '0' : stripped;
}

/** Largo canónico mínimo con el que la API admite un documento en un alta. */
export const MIN_CANONICAL_NATIONAL_ID_LENGTH = 4;

/** Si el documento tiene contenido suficiente para que la API lo admita. */
export function hasNationalIdContent(raw: string): boolean {
  return canonicalNationalId(raw).length >= MIN_CANONICAL_NATIONAL_ID_LENGTH;
}

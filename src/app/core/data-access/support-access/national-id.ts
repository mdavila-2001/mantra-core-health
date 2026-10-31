/**
 * El documento de identidad en su forma canónica, la misma con que la API lo guarda y lo
 * compara (`normalizeNationalId`): mayúsculas, sin espacios, puntos ni guiones y sin ceros
 * de relleno a la izquierda. «01.234-567» y «1234567» son el mismo documento.
 *
 * Una cadena sin contenido —«000000», «.-.-»— queda en `'0'` o vacía: la API la rechaza (400).
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

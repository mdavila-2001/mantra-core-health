/* ============================================================================
    Optional request fields for the agenda wizard: empty values are omitted.

    A form control fed by `app-input type="number"` holds a `number` (or `null`
    when cleared), not a string — calling `.trim()` on it crashed publishing
    with «t.trim is not a function». Every helper accepts both shapes.
    ========================================================================== */

/** What a text or number control can hold. */
export type FieldValue = string | number | null | undefined;

function textOf(value: FieldValue): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

/** The text field, or nothing: `''` is not sent, and `undefined` would be a 400. */
export function opcTexto<K extends string>(key: K, value: FieldValue): Partial<Record<K, string>> {
  const texto = textOf(value);
  return texto === '' ? {} : ({ [key]: texto } as Record<K, string>);
}

/** The integer field, or nothing. Empty is omitted; otherwise it travels as a number. */
export function opcEntero<K extends string>(key: K, value: FieldValue): Partial<Record<K, number>> {
  const texto = textOf(value);
  return texto === '' ? {} : ({ [key]: Number(texto) } as Record<K, number>);
}

/** The date in ISO, or nothing. */
export function opcFecha<K extends string>(key: K, value: Date | null): Partial<Record<K, string>> {
  return value === null ? {} : ({ [key]: value.toISOString() } as Record<K, string>);
}

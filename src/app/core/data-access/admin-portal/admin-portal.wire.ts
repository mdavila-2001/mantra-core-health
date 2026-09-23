/* ============================================================================
    Conversión común del transporte de las APIs del portal administrativo.

    Las APIs de `/admin/*` mandan fechas como ISO y los opcionales como `null`.
    La vista trabaja con `Date` y con claves ausentes (ver `wire.ts`): una
    fecha `null` convertida con `new Date(null)` sería el 1 de enero de 1970.
    ========================================================================== */

/** Campos de fecha: en el transporte son ISO o `null`; en la vista, `Date` o ausentes. */
export type Wire<T, K extends keyof T> = Omit<T, K> & Readonly<Partial<Record<K, string | null>>>;

/**
 * Convierte a `Date` las claves de fecha indicadas y elimina las que llegan
 * vacías. El resto del objeto pasa tal cual.
 */
export function withDates<T, K extends keyof T>(body: Wire<T, K>, keys: readonly K[]): T {
  const out: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const key of keys) {
    const value = out[key as string];
    if (value === null || value === undefined) {
      delete out[key as string];
    } else {
      out[key as string] = new Date(value as string);
    }
  }
  return out as T;
}

/**
 * Parámetros de consulta sin claves vacías: el backend valida con
 * `forbidNonWhitelisted` y una clave enviada como `undefined` vuelve como 400.
 */
export function queryParams(
  query: Readonly<Record<string, string | number | boolean | undefined | null>>,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params[key] = String(value);
  }
  return params;
}

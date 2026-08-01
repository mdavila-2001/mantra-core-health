/* ============================================================================
    Contratos del encabezado de la aplicación.
    ========================================================================== */

/**
 * Lo que el header necesita saber de la persona: cómo nombrarla y qué roles
 * legibles mostrar. Decodificar el JWT es de `core/auth` — acá llega resuelto.
 */
export interface HeaderUser {
  readonly displayName: string;
  readonly roles: readonly string[];
}

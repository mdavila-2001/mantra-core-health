/* ============================================================================
    Tipos de la vista para los consultorios de `practice` (M14).

    Responden una sola pregunta —«¿dónde atiende este profesional?»— que hasta
    ahora el sistema no sabía contestar: la agenda sabía *cuándo*, y el lugar
    había que averiguarlo por fuera.
    ========================================================================== */

/**
 * Una sede donde se atiende.
 *
 * `addressText` viene compuesto desde el backend: la dirección se guarda en
 * piezas (`common.addresses`) y decidir cómo se juntan es del dato, no de cada
 * pantalla que la muestre. `null` cuando la sede no tiene ninguna cargada — es
 * corriente y no es un error.
 */
export interface PracticeSite {
  readonly id: string;
  readonly practiceId: string;
  /** Código único dentro de la práctica. */
  readonly code: string;
  readonly name: string;
  /** Zona horaria IANA de la sede, p. ej. `America/La_Paz`. */
  readonly timeZone: string | null;
  /** Dirección en una línea, o `null` si la sede no tiene ninguna. */
  readonly addressText: string | null;
  readonly status: string;
}

/**
 * Los consultorios de un profesional.
 *
 * Una lista vacía significa «no tiene asignación vigente con sede», no «el
 * profesional no existe»: quien la consuma tiene que tratarla como ausencia de
 * dato y no como error.
 */
export interface PracticeSitePage {
  readonly items: readonly PracticeSite[];
  readonly count: number;
}

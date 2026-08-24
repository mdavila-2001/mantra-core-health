/* ============================================================================
    Los paquetes de contenido de la plataforma.

    Un paquete es material curado que la instalación **puede** querer —el
    nomenclador de procedimientos, las aseguradoras del país, el glosario— y que
    antes se sembraba solo en cada arranque, tuviera sentido o no para quien
    estaba desplegando. Ahora lo aplica quien administra, cuando decide.
    ========================================================================== */

/** Un paquete disponible. */
export interface ContentPack {
  /** Código con el que se aplica. */
  readonly code: string;
  readonly name: string;
  readonly description: string;
  /**
   * Cuántas filas trae, en orden de magnitud.
   *
   * Orientativo a propósito: sirve para saber si la espera va a ser de un
   * segundo o de varios, no para cuadrar contra el resultado.
   */
  readonly approxRows: number;
  /** Si crea cuentas y por eso pide una contraseña. */
  readonly requiresDemoPassword: boolean;
}

/** Lo que dejó aplicar un paquete. */
export interface ContentPackResult {
  readonly code: string;
  /**
   * Filas nuevas que dejó **esta** aplicación.
   *
   * **Cero no es un fallo**: los paquetes convergen, así que aplicar dos veces
   * el mismo devuelve cero la segunda. Ese cero significa «ya estaba».
   */
  readonly inserted: number | null;
  readonly tookMs: number;
  /** Los contadores con la forma propia del paquete, sin agregar. */
  readonly counters: Readonly<Record<string, unknown>>;
}

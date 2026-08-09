/* ============================================================================
    Contratos del Dialog — sistema REDSAT v1.0.

    Se apoya en el `<dialog>` **nativo**: el fondo, la inertización de lo que
    queda atrás y la trampa de foco los da el navegador, y ninguna
    reimplementación en JavaScript le llega ni cerca.
    Extensión propia — pendiente de validación del diseñador.
    ========================================================================== */

/** Lo que se le pide a una confirmación. Todo lo demás tiene default. */
export interface DialogConfig {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  /**
   * La acción borra, anula o es irreversible: el botón va en tono error y el
   * foco inicial se queda en **Cancelar**. Nadie debería confirmar una baja
   * apretando Enter por inercia.
   */
  readonly destructive?: boolean;
  /** Click en el fondo cierra. `false` obliga a decidir con los botones. */
  readonly dismissible?: boolean;
}

export const DEFAULT_CONFIRM_LABEL = 'Confirmar';
export const DEFAULT_CANCEL_LABEL = 'Cancelar';

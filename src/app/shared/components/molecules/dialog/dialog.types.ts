/* ============================================================================
    Contratos del Dialog — sistema ALOVIDA v1.0.

    Se apoya en el `<dialog>` **nativo**: el fondo, la inertización de lo que
    queda atrás y la trampa de foco los da el navegador, y ninguna
    reimplementación en JavaScript le llega ni cerca.
    Extensión propia — pendiente de validación del diseñador.
    ========================================================================== */

/**
 * El campo de motivo de un diálogo que lo exige.
 *
 * Existe porque el backend dejó de aceptar cancelar o reprogramar una cita sin
 * explicar por qué (corrección #14): el motivo viaja al servidor, se persiste
 * con el cambio y la otra parte lo lee. Pedirlo en un diálogo aparte —o peor,
 * mandarlo vacío y mostrar el 422— sería hacerle dar dos pasos a quien ya
 * decidió.
 */
export interface DialogReasonConfig {
  /** Rótulo del campo. Es el que lee un lector de pantalla. */
  readonly label: string;
  readonly placeholder?: string;
  readonly hint?: string;
  /**
   * Mínimo que el servidor acepta. El diálogo no confirma por debajo de esto:
   * mandar algo que se sabe que va a volver rechazado es peor que no mandarlo.
   */
  readonly minLength?: number;
  readonly maxLength?: number;
}

/**
 * Lo que devuelve un diálogo: si se confirmó y, cuando pedía motivo, el texto.
 *
 * Es un objeto y no un booleano porque un diálogo con motivo tiene dos datos
 * que dar, y devolverlos por dos canales distintos obliga a quien lo llama a
 * recomponerlos en el orden correcto.
 */
export interface DialogResult {
  readonly confirmed: boolean;
  /** Lo escrito, ya recortado. Solo cuando se confirmó un diálogo con motivo. */
  readonly reason?: string;
}

/** Lo que se le pide a una confirmación. Todo lo demás tiene default. */
/**
 * Un dato del cuerpo del diálogo: su rótulo y su valor, ya en texto.
 *
 * El diálogo **no formatea nada**: recibe las dos cadenas listas. Fechas,
 * monedas y nombres se arman donde se conoce el dominio, no en una molécula
 * compartida que después tendría que saber de todos.
 */
export interface DialogDetail {
  readonly label: string;
  readonly value: string;
}

export interface DialogConfig {
  readonly title: string;
  readonly message: string;
  /**
   * Datos en pares rótulo/valor, debajo del mensaje.
   *
   * Existe para los diálogos que **muestran** algo además de preguntar —el
   * detalle de una solicitud, la ficha de lo que se va a borrar—. Sin esto, ese
   * contenido tenía que caber dentro de `message`, que es un párrafo: una lista
   * de siete datos metida en una frase no se lee, y un segundo componente modal
   * para lograrlo sería duplicar el foco, el `Escape` y el fondo que
   * `showModal()` ya resuelve.
   *
   * Se omite y el diálogo es exactamente el de siempre.
   */
  readonly details?: readonly DialogDetail[];
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  /**
   * Pide un motivo obligatorio antes de dejar confirmar.
   *
   * Sin esta clave el diálogo es la confirmación de siempre; con ella, el botón
   * de confirmar no cierra hasta que haya texto suficiente.
   */
  readonly reason?: DialogReasonConfig;
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

/**
 * Largo mínimo por defecto de un motivo.
 *
 * Es el mismo que exige el servidor (`MIN_REASON_LENGTH` de
 * `state/booking-transition.ts` en la API): si el diálogo pidiera menos, dejaría
 * mandar algo que vuelve rechazado; si pidiera más, rechazaría lo que el
 * servidor acepta.
 */
export const DEFAULT_REASON_MIN_LENGTH = 5;

/** Tope por defecto, también el del servidor. */
export const DEFAULT_REASON_MAX_LENGTH = 500;

/* ============================================================================
    Contratos del Toast — sistema REDSAT v1.0.
    Los cuatro tipos son los mismos estados semánticos que ya declaran los
    tokens `--st-*` de `styles.css` (success · warning · error · info): el aviso
    no inventa un vocabulario propio de color.

    No hay servicio: la cola la administra quien monta el contenedor. Estas
    piezas son presentacionales — reciben datos y avisan que se las cerró.
    ========================================================================== */

export const TOAST_TYPES = ['success', 'warning', 'error', 'info'] as const;
export type ToastType = (typeof TOAST_TYPES)[number];

/** Un aviso de la cola. `id` es lo único que viaja de vuelta al cerrarlo. */
export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  /** Encabezado corto. Sin él, el mensaje carga solo con la jerarquía. */
  title?: string;
  /** Milisegundos hasta el retiro automático; lo aplica quien tiene la cola. */
  duration?: number;
}

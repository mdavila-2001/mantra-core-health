import type { LifecycleAction } from '../../../../core/data-access/infrastructure/infrastructure.types';

/** Cómo se dice cada acción de ciclo de vida, y si pide motivo (§3: suspender y retirar). */
export interface TextoDeAccion {
  readonly boton: string;
  readonly titulo: string;
  readonly mensaje: (nombre: string) => string;
  readonly confirmar: string;
  readonly pideMotivo: boolean;
  readonly destructiva: boolean;
}

export const TEXTO_DE_ACCION: Readonly<Record<LifecycleAction, TextoDeAccion>> = {
  activate: {
    boton: 'Activar',
    titulo: 'Activar el espacio',
    mensaje: (n) => `${n} queda disponible para usarse. Desde ese momento su código y su forma no se pueden cambiar.`,
    confirmar: 'Activar',
    pideMotivo: false,
    destructiva: false,
  },
  suspend: {
    boton: 'Suspender',
    titulo: 'Suspender el espacio',
    mensaje: (n) => `${n} deja de ofrecerse mientras esté suspendido. Se puede reactivar después.`,
    confirmar: 'Suspender',
    pideMotivo: true,
    destructiva: true,
  },
  reactivate: {
    boton: 'Reactivar',
    titulo: 'Reactivar el espacio',
    mensaje: (n) => `${n} vuelve a estar activo.`,
    confirmar: 'Reactivar',
    pideMotivo: false,
    destructiva: false,
  },
  retire: {
    boton: 'Retirar',
    titulo: 'Retirar el espacio',
    mensaje: (n) =>
      `${n} se clausura de forma definitiva. No se borra: queda en el historial y su código no se vuelve a usar.`,
    confirmar: 'Retirar',
    pideMotivo: true,
    destructiva: true,
  },
};

/** Las pestañas de la ficha, por clave (`?tab=`), en el orden del contrato §4. */
export const PESTANAS_DE_LA_FICHA = ['general', 'technical', 'units', 'children', 'history'] as const;
export type PestanaDeLaFicha = (typeof PESTANAS_DE_LA_FICHA)[number];

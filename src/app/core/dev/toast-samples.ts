import type { ToastMessage, ToastType } from '../../shared/components/molecules/toast/toast.types';

/* ============================================================================
    Avisos de muestra — SOLO desarrollo. No son producto: los consume el panel
    dev y la vitrina de diseño.
    El texto sale del dominio (evolución, receta, orden de laboratorio, turno)
    para ver el componente con la longitud real que va a tener en producción, no
    con «Lorem ipsum».
    ========================================================================== */

export const DEMO_TOASTS: Readonly<Record<ToastType, Omit<ToastMessage, 'id'>>> = {
  success: {
    type: 'success',
    title: 'Evolución registrada',
    message: 'La nota quedó asentada en la historia clínica de Andrea Peña.',
    duration: 4000,
  },
  warning: {
    type: 'warning',
    title: 'Receta por vencer',
    message: 'La prescripción de amoxicilina vence en 24 horas.',
    duration: 6000,
  },
  error: {
    type: 'error',
    title: 'No se pudo firmar',
    message: 'La orden de laboratorio no se firmó: el certificado del profesional expiró.',
    duration: 8000,
  },
  info: {
    type: 'info',
    message: 'El turno de cardiología se reprogramó para el 12/08 a las 09:30.',
    duration: 5000,
  },
};

/**
 * Aviso sin `duration`: se queda hasta que alguien lo cierre. Es el caso de los
 * errores que el usuario tiene que acusar recibo, no los que se van solos.
 */
export const PERSISTENT_DEMO_TOAST: Omit<ToastMessage, 'id'> = {
  type: 'error',
  title: 'Sin conexión con el servidor',
  message: 'Los cambios no se están guardando. Revisá la conexión y reintentá.',
};

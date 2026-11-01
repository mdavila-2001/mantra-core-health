import { errorToViewState } from '../../../core/http/error-to-view-state';

/**
 * Lo que la API dijo cuando una acción falló, en sus palabras.
 *
 * `errorToViewState` reparte el fallo en estados de la interfaz: una validación o un
 * conflicto trae `issues` (y se juntan); un 403, un error inesperado o «sin
 * conexión» traen `message`. Sin esto, «Ese horario ya no está libre» o «Escriba
 * el documento completo» llegaban a la persona como «No pudimos completar la
 * acción», que no dice nada que se pueda hacer.
 */
export function failureMessage(error: unknown, fallback: string): string {
  const state = errorToViewState<unknown>(error);
  switch (state.status) {
    case 'validation': {
      const mensajes = state.issues.map((i) => i.message).filter((m) => m !== '');
      return mensajes.length === 0 ? fallback : [...new Set(mensajes)].join(' ');
    }
    case 'forbidden':
      return state.message !== undefined && state.message !== '' ? state.message : fallback;
    case 'error':
      // S9: qué no se pudo hacer (la pantalla) y por qué (texto fijo del catálogo,
      // nunca el `message` del servidor).
      return state.message !== undefined && state.message !== '' ? `${fallback} ${state.message}` : fallback;
    case 'offline':
      return 'Sin conexión: revise su internet y vuelva a intentarlo.';
    default:
      return fallback;
  }
}

/**
 * Los dos 403 con que la API rechaza lo que la persona de apoyo **declara** al crear una cita
 * (`POST /scheduling/appointments/direct`): el doctor no atiende en ese espacio o no presta ese servicio
 * (también cuando no tiene servicios propios). Son distintos del 403 genérico de apoyo
 * («Su vínculo de apoyo no le permite esta acción.»), que no explica nada a propósito: estos sí, porque
 * lo que se puede hacer es **elegir otro horario, doctor o servicio**.
 */
export const PLACE_REJECTIONS: readonly string[] = ['El doctor no atiende en ese espacio.', 'El doctor no presta ese servicio.'];

/** Si el mensaje de un fallo es uno de los rechazos de lugar o servicio del doctor. */
export function isPlaceRejection(message: string | null): boolean {
  return message !== null && PLACE_REJECTIONS.includes(message.trim());
}

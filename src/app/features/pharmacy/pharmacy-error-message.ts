import { errorToViewState } from '../../core/http/error-to-view-state';

/**
 * El texto de un error de la API del portal de la farmacia, para la persona.
 *
 * Pasa por `errorToViewState`, que ya sabe leer el cuerpo del contrato: un 409
 * trae «Ya existe un producto con ese código en la farmacia», un 403 dice que
 * la sesión no puede publicar y un 5xx trae el identificador de la petición.
 */
export function pharmacyErrorMessage(error: unknown, fallback: string): string {
  const state = errorToViewState<never>(error);
  switch (state.status) {
    case 'validation':
      return state.issues.map((issue) => issue.message).join(' ') || fallback;
    case 'forbidden':
      return state.message ?? 'Su usuario no tiene permiso para cambiar el catálogo de esta farmacia.';
    case 'not-found':
      return 'La farmacia o el producto ya no existen.';
    case 'offline':
      return 'Sin conexión con el servidor. Revise su red y pruebe de nuevo.';
    case 'error':
      return `${state.message ?? fallback} (petición ${state.requestId})`;
    default:
      return fallback;
  }
}

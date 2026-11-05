import { errorToViewState } from '../../../core/http/error-to-view-state';
import { forbidden } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { requestAccessRoute } from '../clinical-record.routes';

/**
 * El 403 de la consulta, dicho a quien atiende (H07).
 *
 * La API responde con un texto pensado para pacientes («Sólo puede consultar su
 * propia historia clínica», `clinical-read.service.ts`), idéntico para un
 * paciente ajeno y para un id inventado. Acá se reemplaza por uno para el
 * profesional, también idéntico en los dos casos: no confirma que la persona
 * exista. Se conserva el código de soporte, y un 403 que ya trae su salida
 * (verificar la identidad) se deja como llegó.
 */
export const CONSULTATION_FORBIDDEN_MESSAGE =
  'Para registrar una consulta necesita una cita confirmada con esta persona o que ella le autorice el acceso a su historia.';

/**
 * El mismo 403, al abrir el expediente. La puerta de la API es la misma
 * (`assertCanReadHistory`) y la salida también; cambia sólo lo que se vino a hacer.
 */
export const CHART_FORBIDDEN_MESSAGE =
  'Para ver este expediente necesita una cita confirmada con esta persona o que ella le autorice el acceso a su historia.';

export const REQUEST_ACCESS_LABEL = 'Pedir acceso a su historia';

export function consultationForbidden<T>(
  state: ViewState<T>,
  profileId: string,
  message: string = CONSULTATION_FORBIDDEN_MESSAGE,
): ViewState<T> {
  if (state.status !== 'forbidden' || state.nextAction !== undefined) {
    return state;
  }
  return forbidden({
    message,
    nextAction: { label: REQUEST_ACCESS_LABEL, route: requestAccessRoute(profileId) },
    ...(state.requestId === undefined ? {} : { requestId: state.requestId }),
  });
}

/** El error de la lectura de la consulta, ya como estado y con el 403 de arriba. */
export function consultationError<T>(error: unknown, profileId: string): ViewState<T> {
  return consultationForbidden(errorToViewState<T>(error), profileId);
}

/** El error de la lectura del expediente, con el 403 dicho para quien lo abre. */
export function chartError<T>(error: unknown, profileId: string): ViewState<T> {
  return consultationForbidden(errorToViewState<T>(error), profileId, CHART_FORBIDDEN_MESSAGE);
}

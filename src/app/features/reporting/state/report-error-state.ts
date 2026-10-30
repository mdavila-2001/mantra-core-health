import { errorToViewState } from '@core/http/error-to-view-state';
import type { ViewState } from '@core/view-state/view-state.types';

const ASK_FOR_ACCESS = 'Pida acceso a quien administra su organización.';

/**
 * Como `errorToViewState`, pero un 403 nunca queda en un muro: el estado «sin permiso» (S5) dice a
 * quién pedir acceso y ofrece volver al inicio. El texto del servidor se conserva si lo trae.
 */
export function reportErrorState<T>(error: unknown): ViewState<T> {
  const state = errorToViewState<T>(error);
  if (state.status !== 'forbidden' || state.nextAction !== undefined) {
    return state;
  }
  const reason = state.message?.trim();
  return {
    ...state,
    message: reason ? `${reason.replace(/[.\s]+$/, '')}. ${ASK_FOR_ACCESS}` : ASK_FOR_ACCESS,
    nextAction: { label: 'Volver al inicio', route: '/' },
  };
}

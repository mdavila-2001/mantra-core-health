import { empty } from '../../../core/view-state/view-state';
import type {
  EmptyViewState,
  ViewStateNextAction,
} from '../../../core/view-state/view-state.types';

/**
 * Next action shared by the "pick whom to book with" empty states. It has no
 * `route` on purpose: the control already sits right above, in the same view,
 * so sending the person to another route would be a detour back to it.
 */
const ELEGIR_AGENDA: ViewStateNextAction = { label: 'Elija una agenda' };

/** Slots list before anyone is chosen. */
export const VACIO_ELEGIR_AGENDA: EmptyViewState = empty(
  ELEGIR_AGENDA,
  'Elija con quién se quiere atender para ver los horarios libres.',
  'Primero elija con quién',
);

/** Laboratory mode: the same prompt, but it asks for a laboratory. */
export const VACIO_ELEGIR_LABORATORIO: EmptyViewState = empty(
  ELEGIR_AGENDA,
  'Elija un laboratorio para ver los horarios libres.',
  'Primero elija un laboratorio',
);

/** The patient has no bookings yet. */
export const VACIO_SIN_CITAS: EmptyViewState = empty(
  ELEGIR_AGENDA,
  'Todavía no pidió ninguna cita.',
  'Todavía no tiene citas',
);

/** The chosen schedule has nothing free in the look-ahead window. */
export const VACIO_SIN_HORARIOS: EmptyViewState = empty(
  { label: 'Pruebe con otra agenda' },
  'No hay horarios libres en las próximas dos semanas.',
  'Sin horarios libres',
);

/** The chosen service has no start times in the look-ahead window. */
export function vacioSinHorariosDeServicio(serviceName: string): EmptyViewState {
  return empty(
    { label: 'Pruebe con otro servicio o profesional' },
    `No hay horarios para ${serviceName} en las próximas dos semanas.`,
    'Sin horarios para este servicio',
  );
}

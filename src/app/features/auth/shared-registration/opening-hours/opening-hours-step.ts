import { FormControl } from '@angular/forms';

import type { SeccionDeFormulario } from '../../../../shared/forms/paginated/paginated-form.types';
import {
  defaultRegistrationHours,
  registrationHoursValidator,
  type RegistrationHours,
} from './opening-hours';

/** The form control every organization sign-up adds: pre-filled, required. */
export function openingHoursControl(): FormControl<RegistrationHours> {
  return new FormControl<RegistrationHours>(defaultRegistrationHours(), {
    nonNullable: true,
    validators: [registrationHoursValidator],
  });
}

/** The «Horario de atención» step, the same in the five sign-ups. */
export function openingHoursSection(withBranches: boolean): SeccionDeFormulario {
  return {
    titulo: 'Horario de atención',
    clave: 'horario',
    icon: 'clock',
    hint: withBranches
      ? 'Cuándo atiende la casa central y cada sucursal. Los pacientes lo ven antes de ir.'
      : 'Cuándo atiende. Los pacientes y los médicos lo ven antes de derivar.',
    campos: [
      {
        key: 'openingHours',
        label: 'Horario de atención',
        control: 'custom',
        required: true,
        mensajeDeError: 'Revise el horario: hay días sin completar o turnos que se cruzan.',
      },
    ],
  };
}

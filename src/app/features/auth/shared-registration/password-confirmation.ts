import { FormControl, Validators, type ValidatorFn } from '@angular/forms';

import type { CampoDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';
import { MESSAGE_SHORT_PASSWORD, passwordValidators } from './password-policy';

/**
 * Password plus its confirmation, shared by every sign-up form.
 *
 * Every account type (patient, practitioner, support staff and each
 * organization type) asks for the password twice, so a typo cannot lock the
 * owner out of an account that was just created. The confirmation never leaves
 * the browser: request bodies only read `password`, and drafts drop
 * `confirmPassword` (`OnboardingDraftService`).
 */

/**
 * Error key set on `confirmPassword` when it differs from `password`. The
 * shared form engine turns it into text (`shared/forms/paginated/error-message.ts`).
 */
export const PASSWORD_MISMATCH = 'passwordMismatch';

/**
 * The `password` and `confirmPassword` controls, already linked. Spread them
 * into the form group (`...passwordWithConfirmation()`).
 *
 * The confirmation is re-validated whenever the password changes: otherwise
 * editing the password after confirming it would leave a stale "valid" mark.
 */
export function passwordWithConfirmation(): {
  readonly password: FormControl<string>;
  readonly confirmPassword: FormControl<string>;
} {
  const password = new FormControl('', { nonNullable: true, validators: [...passwordValidators] });
  const matches: ValidatorFn = (control) =>
    control.value === '' || control.value === password.value ? null : { [PASSWORD_MISMATCH]: true };
  const confirmPassword = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, matches],
  });
  // Both controls share the form's lifetime: no teardown needed.
  password.valueChanges.subscribe(() => confirmPassword.updateValueAndValidity());
  return { password, confirmPassword };
}

/**
 * The password field followed by its confirmation field, which inherits the
 * width, icon, test id (suffixed `-confirm`) and the presence of a
 * placeholder and a description from the password field.
 */
export function withConfirmation(password: CampoDeFormulario): readonly CampoDeFormulario[] {
  return [
    password,
    {
      key: 'confirmPassword',
      label: 'Repita la contraseña',
      hint: 'Escríbala de nuevo para verificar que no tenga errores.',
      description:
        password.description === undefined
          ? undefined
          : 'Si las dos no coinciden, el alta no sigue: así un error de tipeo no le deja sin acceso a su cuenta.',
      control: 'password',
      required: true,
      autocomplete: 'new-password',
      placeholder: password.placeholder === undefined ? undefined : 'Repita su contraseña',
      icono: password.icono,
      ancho: password.ancho,
      testId: password.testId === undefined ? undefined : `${password.testId}-confirm`,
      mensajeSiFalta: 'Repita la contraseña para verificarla.',
    },
  ];
}

/**
 * The standard sign-up password and its confirmation, for forms that do not
 * need their own wording. `extra` overrides any property of the password field.
 */
export function accessPasswordFields(
  testId: string,
  extra: Partial<CampoDeFormulario> = {},
): readonly CampoDeFormulario[] {
  return withConfirmation({
    key: 'password',
    label: 'Contraseña',
    hint: 'Al menos 8 caracteres.',
    control: 'password',
    required: true,
    icono: 'lock',
    autocomplete: 'new-password',
    testId,
    mensajeDeError: MESSAGE_SHORT_PASSWORD,
    ...extra,
  });
}

import { FormControl, type AbstractControl, type FormGroup, type ValidationErrors } from '@angular/forms';
import type {
  CampoDeFormulario,
  SeccionDeFormulario,
} from '../../../shared/forms/paginated/paginated-form.types';
import { MESSAGE_SHORT_PASSWORD, MIN_CHARACTERS_PASSWORD, passwordValidators } from './password-policy';

export const MESSAGE_PASSWORD_MISMATCH = 'Las contraseñas no coinciden.';

/** Error of the confirm control when its value differs from the sibling `password`. */
function matchesPassword(control: AbstractControl): ValidationErrors | null {
  const password = control.parent?.get('password')?.value;
  return control.value === password ? null : { passwordMismatch: true };
}

/** The `password` control shared by every registration form. */
export function passwordControl(): FormControl<string> {
  return new FormControl('', { nonNullable: true, validators: [...passwordValidators] });
}

/** The `confirmPassword` control: required and equal to the sibling `password`. */
export function confirmPasswordControl(): FormControl<string> {
  return new FormControl('', {
    nonNullable: true,
    validators: [...passwordValidators, matchesPassword],
  });
}

/**
 * Re-validates `confirmPassword` whenever `password` changes, so editing the first
 * field after confirming it cannot leave a stale "valid" state. Call once from the
 * form owner; the subscription dies with the form.
 */
export function linkPasswordConfirmation(form: FormGroup): void {
  form.get('password')?.valueChanges.subscribe(() => {
    form.get('confirmPassword')?.updateValueAndValidity({ emitEvent: false });
  });
}

/** Both password fields, in the order the person types them. */
export function passwordFields(testIdPrefix: string): readonly CampoDeFormulario[] {
  return [
    {
      key: 'password',
      label: 'Contraseña',
      hint: `Al menos ${MIN_CHARACTERS_PASSWORD} caracteres.`,
      description:
        'Se guarda cifrada: ni el equipo de AloVida puede verla, y por eso nunca se la vamos a pedir por teléfono ni por correo.',
      control: 'password',
      required: true,
      autocomplete: 'new-password',
      placeholder: 'Su contraseña',
      testId: `${testIdPrefix}-password`,
      icono: 'lock',
      mensajeDeError: MESSAGE_SHORT_PASSWORD,
      ancho: 'mitad',
    },
    {
      key: 'confirmPassword',
      label: 'Confirmar contraseña',
      hint: 'Escríbala otra vez, igual.',
      description: 'La pedimos dos veces para que un error de tipeo no le deje sin poder entrar.',
      control: 'password',
      required: true,
      autocomplete: 'new-password',
      placeholder: 'Repita su contraseña',
      testId: `${testIdPrefix}-confirm-password`,
      icono: 'lock',
      mensajeDeError: MESSAGE_PASSWORD_MISMATCH,
      ancho: 'mitad',
    },
  ];
}

/** The last step of every registration: password and its confirmation, nothing else. */
export function passwordStep(testIdPrefix: string, hint?: string): SeccionDeFormulario {
  return {
    titulo: 'Contraseña',
    clave: 'password',
    icon: 'lock',
    hint: hint ?? 'Con esta contraseña va a entrar a su cuenta.',
    disposicion: 'dos-columnas',
    campos: passwordFields(testIdPrefix),
  };
}

import { FormGroup } from '@angular/forms';

import { mensajeDeError } from '../../../shared/forms/paginated/error-message';
import {
  accessPasswordFields,
  PASSWORD_MISMATCH,
  passwordWithConfirmation,
  withConfirmation,
} from './password-confirmation';

describe('passwordWithConfirmation', () => {
  function form() {
    return new FormGroup({ ...passwordWithConfirmation() });
  }

  it('an empty confirmation is required, not a mismatch', () => {
    const f = form();
    f.controls.password.setValue('secreto12');
    expect(f.controls.confirmPassword.errors).toEqual({ required: true });
    expect(f.valid).toBe(false);
  });

  it('a different confirmation blocks the form', () => {
    const f = form();
    f.controls.password.setValue('secreto12');
    f.controls.confirmPassword.setValue('secreto13');
    expect(f.controls.confirmPassword.hasError(PASSWORD_MISMATCH)).toBe(true);
    expect(f.valid).toBe(false);
  });

  it('the same password twice makes the pair valid', () => {
    const f = form();
    f.controls.password.setValue('secreto12');
    f.controls.confirmPassword.setValue('secreto12');
    expect(f.valid).toBe(true);
  });

  it('editing the password after confirming it invalidates the confirmation again', () => {
    const f = form();
    f.controls.password.setValue('secreto12');
    f.controls.confirmPassword.setValue('secreto12');
    f.controls.password.setValue('otra-clave');
    expect(f.controls.confirmPassword.hasError(PASSWORD_MISMATCH)).toBe(true);
    f.controls.password.setValue('secreto12');
    expect(f.valid).toBe(true);
  });

  it('the mismatch reads as text in the shared form engine', () => {
    const f = form();
    f.controls.password.setValue('secreto12');
    f.controls.confirmPassword.setValue('secreto1');
    f.controls.confirmPassword.markAsTouched();
    expect(mensajeDeError(f.controls.confirmPassword, { label: 'Repita la contraseña' })).toBe(
      'Las contraseñas no coinciden. Escríbala igual en los dos campos.',
    );
  });
});

describe('withConfirmation / accessPasswordFields', () => {
  it('adds the confirmation right after the password, inheriting width, icon and test id', () => {
    const [password, confirm] = withConfirmation({
      key: 'password',
      label: 'Contraseña',
      control: 'password',
      icono: 'lock',
      ancho: 'mitad',
      testId: 'registro-password',
    });
    expect(password!.key).toBe('password');
    expect(confirm).toMatchObject({
      key: 'confirmPassword',
      control: 'password',
      required: true,
      autocomplete: 'new-password',
      icono: 'lock',
      ancho: 'mitad',
      testId: 'registro-password-confirm',
    });
  });

  it('the standard pair keeps the 8-character rule on the password and lets callers override it', () => {
    const [password, confirm] = accessPasswordFields('alta-password', { ancho: 'mitad' });
    expect(password).toMatchObject({ key: 'password', required: true, testId: 'alta-password', ancho: 'mitad' });
    expect(password!.mensajeDeError).toBe('La contraseña necesita al menos 8 caracteres.');
    expect(confirm!.key).toBe('confirmPassword');
  });
});

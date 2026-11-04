import { FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { confirmPasswordControl, linkPasswordConfirmation, passwordControl, passwordStep } from './password-step';

function build(): FormGroup {
  const form = new FormGroup({ password: passwordControl(), confirmPassword: confirmPasswordControl() });
  linkPasswordConfirmation(form);
  return form;
}

describe('password-step', () => {
  it('rejects a confirmation that differs from the password', () => {
    const form = build();
    form.patchValue({ password: 'secreto-123', confirmPassword: 'secreto-124' });
    expect(form.get('confirmPassword')?.hasError('passwordMismatch')).toBe(true);
  });

  it('accepts equal values', () => {
    const form = build();
    form.patchValue({ password: 'secreto-123', confirmPassword: 'secreto-123' });
    expect(form.valid).toBe(true);
  });

  it('re-validates the confirmation when the password changes afterwards', () => {
    const form = build();
    form.patchValue({ password: 'secreto-123', confirmPassword: 'secreto-123' });
    form.get('password')?.setValue('otro-secreto');
    expect(form.get('confirmPassword')?.hasError('passwordMismatch')).toBe(true);
  });

  it('is a two-field step holding only the password pair', () => {
    expect(passwordStep('x').campos.map((c) => c.key)).toEqual(['password', 'confirmPassword']);
  });
});

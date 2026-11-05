import { Directive, effect, forwardRef, input } from '@angular/core';
import { NG_VALIDATORS, type AbstractControl, type ValidationErrors, type Validator } from '@angular/forms';

import { fieldKindValidator, type FieldKind } from './field-kinds';

/**
 * Validates the bound control against its data kind (see `field-kinds.ts`),
 * like native `[email]` does. `app-input` hosts it, so `fieldKind="…"` on an
 * `app-input` filters the typing and validates the form value at once.
 */
@Directive({
  selector: '[appFieldKind]',
  providers: [{ provide: NG_VALIDATORS, useExisting: forwardRef(() => FieldKindDirective), multi: true }],
})
export class FieldKindDirective implements Validator {
  readonly fieldKind = input<FieldKind | null>(null);

  private onChange: (() => void) | null = null;

  constructor() {
    // Revalidate only when the kind changes after binding: the first value is
    // validated on setup, and an extra notification emits a spurious `statusChanges`.
    let previous: FieldKind | null | undefined;
    effect(() => {
      const current = this.fieldKind();
      if (previous !== undefined && current !== previous) this.onChange?.();
      previous = current;
    });
  }

  validate(control: AbstractControl): ValidationErrors | null {
    const kind = this.fieldKind();
    return kind === null ? null : fieldKindValidator(kind)(control);
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onChange = fn;
  }
}

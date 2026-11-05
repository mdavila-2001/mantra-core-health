import {
  FormControl,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';

/** What one licence row (matrícula, SEDES, colegio) needs before the step can advance. */
interface LicenceRowRule {
  /** Key of the sibling control that holds the registration date. */
  readonly dateKey: string;
  /** Whether the backup PDF is attached; read lazily because it lives in a signal. */
  readonly hasFile: () => boolean;
  /** When false, an empty number is allowed (only then the date and file are not asked). */
  readonly numberRequired?: (control: AbstractControl) => boolean;
}

/**
 * Validator for the NUMBER control of a licence row.
 *
 * The three fields of a row (number, registration date, backup) are all
 * mandatory (owner request, 04/11/2026). The step engine only gates on the
 * controls that are page fields, so the number control also answers for its
 * date and file: `licenceDate` and/or `licenceFile` tell the template what is missing.
 *
 * A row that may stay empty (a profession with no known college) is skipped
 * while its number is empty, but once the number is written the other two are
 * required: the API has nowhere to store a number without them.
 */
export function licenceRowValidator(rule: LicenceRowRule): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const number = String(control.value ?? '').trim();
    if (number === '') {
      return (rule.numberRequired?.(control) ?? true) ? { required: true } : null;
    }
    const missing: ValidationErrors = {
      ...(control.parent?.get(rule.dateKey)?.value ? {} : { licenceDate: true }),
      ...(rule.hasFile() ? {} : { licenceFile: true }),
    };
    return Object.keys(missing).length > 0 ? missing : null;
  };
}

/** The number control of a licence row, validated together with its date and backup. */
export function licenceRowControl(
  dateKey: string,
  hasFile: () => boolean,
  numberRequired?: LicenceRowRule['numberRequired'],
): FormControl<string> {
  return new FormControl('', {
    nonNullable: true,
    validators: [licenceRowValidator({ dateKey, hasFile, numberRequired })],
  });
}

import { HttpErrorResponse } from '@angular/common/http';
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { readApiError } from '../../../core/http/api-error';

export const dateRangeValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const from = String(control.get('effectiveFrom')?.value ?? '');
  const to = String(control.get('effectiveTo')?.value ?? '');
  return from !== '' && to !== '' && to < from ? { dateRange: true } : null;
};

export function optional<K extends string>(key: K, value: string): Partial<Record<K, string>> {
  const trimmed = value.trim();
  return trimmed === '' ? {} : ({ [key]: trimmed } as Record<K, string>);
}

/**
 * Una vigencia (`Date` anclada a medianoche **local** por `maybeDateOnly`) como
 * valor de `<input type="date">`. Se arma con los componentes locales y no con
 * `toISOString()`, que pasaría por UTC y retrocedería un día al oeste de
 * Greenwich.
 */
export function dateOnlyInputValue(date: Date | null): string {
  if (date === null) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function nullableDecimal(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return (
      readApiError(error)?.message ?? 'No se pudo guardar. Revisá los datos e intentá de nuevo.'
    );
  }
  return 'No se pudo guardar. Intentá de nuevo.';
}

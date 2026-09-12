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

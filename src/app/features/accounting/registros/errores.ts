import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';

/** El motivo del servidor, o uno genérico. Nunca un código ni una traza. */
export function motivoDelError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return (
      readApiError(error)?.message ?? 'No se pudo guardar. Revise los datos e intente de nuevo.'
    );
  }
  return 'No se pudo guardar. Intente de nuevo.';
}

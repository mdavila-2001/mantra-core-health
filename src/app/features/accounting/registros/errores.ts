import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';

/** El motivo del servidor, o uno genérico. Nunca un código ni una traza. */
export function motivoDelError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return (
      readApiError(error)?.message ?? 'No se pudo guardar. Revisá los datos e intentá de nuevo.'
    );
  }
  return 'No se pudo guardar. Intentá de nuevo.';
}

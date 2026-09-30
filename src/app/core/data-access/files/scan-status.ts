import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../http/api-error';

/**
 * Si el fallo de una lectura de archivo es «todavía en análisis antimalware»
 * (`422` con `details.reason = SCAN_PENDING`, TX-33).
 *
 * Antes ese 422 no traía motivo y la interfaz no podía distinguir un archivo
 * recién subido de uno borrado: todo era «error genérico». Con el motivo, la
 * pantalla dice «en análisis» y la persona sabe que reintentar en un rato sirve.
 */
export function isScanPending(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 422 &&
    readApiError(error)?.details?.['reason'] === 'SCAN_PENDING'
  );
}

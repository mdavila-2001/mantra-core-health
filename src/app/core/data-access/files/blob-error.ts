import { HttpErrorResponse } from '@angular/common/http';
import { catchError, from, map, switchMap, throwError, type Observable, type OperatorFunction } from 'rxjs';

/** Lee un `Blob` como texto. `FileReader` porque existe en todos los entornos. */
function blobToText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(typeof lector.result === 'string' ? lector.result : '');
    lector.onerror = () => reject(lector.error);
    lector.readAsText(blob);
  });
}

/**
 * En una petición con `responseType: 'blob'`, **el cuerpo del error también llega
 * como `Blob`**: `readApiError` no lo reconoce y `details.reason` (`SCAN_PENDING`,
 * `TENANT_REQUIRED`…) se pierde. Este operador lo vuelve a leer como JSON y
 * re-emite un `HttpErrorResponse` con el cuerpo ya parseado, mismo status y
 * cabeceras; si no era JSON, el cuerpo queda en `null` (no se inventa nada).
 */
export function parseBlobError<T>(): OperatorFunction<T, T> {
  return (fuente: Observable<T>) =>
    fuente.pipe(
      catchError((error: unknown) => {
        if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob)) {
          return throwError(() => error);
        }
        return from(blobToText(error.error)).pipe(
          map((texto): unknown => {
            try {
              return JSON.parse(texto);
            } catch {
              return null;
            }
          }),
          switchMap((cuerpo) =>
            throwError(
              () =>
                new HttpErrorResponse({
                  error: cuerpo,
                  headers: error.headers,
                  status: error.status,
                  statusText: error.statusText,
                  ...(error.url === null ? {} : { url: error.url }),
                }),
            ),
          ),
        );
      }),
    );
}

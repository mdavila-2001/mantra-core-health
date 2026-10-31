/**
 * Cuánto se espera antes de revocar la URL de un archivo que acaba de entregarse al navegador (ms).
 *
 * Un minuto sobra para que Safari, Firefox y los navegadores móviles —que inician la descarga de forma asíncrona— lean el
 * `Blob`, y es poco para dejar viva una dirección al contenido (puede ser un dato clínico).
 */
export const OBJECT_URL_RELEASE_MS = 60_000;

/**
 * Revoca una Blob URL **después** de que el navegador tuvo tiempo de iniciar la descarga.
 *
 * `a.click(); URL.revokeObjectURL(url)` en el mismo tick cancela la descarga en Safari y Firefox: la exportación auditada
 * «ya quedó registrada» pero el archivo no baja (F8). Todas las descargas por `<a download>` pasan por aquí.
 *
 * @param url La URL creada con `URL.createObjectURL`.
 * @param revoke Cómo revocarla (por omisión `URL.revokeObjectURL`; las pruebas pasan la suya).
 */
export function releaseObjectUrlLater(
  url: string,
  revoke: (url: string) => void = (u) => URL.revokeObjectURL(u),
): void {
  setTimeout(() => {
    try {
      revoke(url);
    } catch {
      /* ya liberada, o la página se está cerrando: no hay nada que hacer */
    }
  }, OBJECT_URL_RELEASE_MS);
}

import { limpiarEvidencias } from '../../recorrido/support/evidencia';

/**
 * Vacía las evidencias antes de empezar.
 *
 * Va como `globalSetup` y no dentro de una prueba porque tiene que correr **una
 * vez**: hacerlo en un `beforeAll` por archivo borraría las capturas que los
 * archivos anteriores acaban de dejar.
 *
 * La carpeta la elige `EVIDENCIAS_DIR`, que `scripts/run-recorrido-real.mjs`
 * fija en `real` para no pisar el recorrido visual. Si alguien corre Playwright
 * a mano sin esa variable, esto borraría las evidencias del otro recorrido — por
 * eso el script existe y es el camino documentado.
 */
export default function preparar(): void {
  limpiarEvidencias();
}

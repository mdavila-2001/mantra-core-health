import { limpiarEvidencias } from './evidencia';

/**
 * Vacía las evidencias antes de empezar.
 *
 * Va como `globalSetup` y no dentro de una prueba porque tiene que correr
 * **una vez**: hacerlo en un `beforeAll` por archivo borraría las capturas que
 * los archivos anteriores acaban de dejar.
 */
export default function preparar(): void {
  limpiarEvidencias();
}

import { notFound, type MockRouter } from '../mock-router';

/** C0 reserva la ruta; C3 implementará la verificación del diagnóstico. */
export function registerDiagnosisVerification(router: MockRouter): void {
  router.post('/clinical/conditions/:id/verification', () => notFound('Pendiente: carril C3'));
}

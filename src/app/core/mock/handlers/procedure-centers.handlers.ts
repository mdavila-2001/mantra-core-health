import { forbidden, type MockRouter } from '../mock-router';

/**
 * Carril 19 · `GET /clinical/me/procedure-centers`, la pestaña «Centros médicos».
 *
 * La maqueta no siembra órdenes de procedimiento ni oferta de centros: decir
 * «no tiene procedimientos pendientes» es lo honesto, no inventar una lista.
 */
export function registerProcedureCenters(router: MockRouter): void {
  router.get('/clinical/me/procedure-centers', (request) => {
    if (request.user?.patientProfileId === undefined) {
      return forbidden('Esta lectura es del titular de una ficha de paciente');
    }
    const limit = Number(request.query.get('limit') ?? 20) || 20;
    return { procedures: [], centers: [], total: 0, limit };
  });
}

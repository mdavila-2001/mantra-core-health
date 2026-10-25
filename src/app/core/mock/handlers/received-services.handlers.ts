import { RECEIVED_SERVICES } from '../fixtures/received-services';
import { patientById } from '../fixtures/people';
import { forbidden, notFound, type MockRouter } from '../mock-router';
import { puedeLeer } from './clinical.handlers';

/* ============================================================================
    «Servicios recibidos»: `GET /clinical/patients/:id/received-services`.

    Las reglas son las de la API real, no una versión más generosa:

      · mismo acceso que el resumen de la historia (`puedeLeer`);
      · más reciente primero, con tope y `truncated` cuando el tope corta;
      · el personal clínico y el superadministrador leen el servicio SIN
        importes, y la respuesta lo dice (`costsVisible: false`); solo el
        titular o quien lo representa ve el costo;
      · la cobertura del seguro no se expone.
    ========================================================================== */

/** Roles que leen la historia de otra persona: ven el servicio, no el dinero. */
const ROLES_WITHOUT_COSTS: readonly string[] = ['CLINICIAN', 'PRACTITIONER', 'SUPERADMIN'];

export function registerReceivedServices(router: MockRouter): void {
  router.get('/clinical/patients/:id/received-services', (request) => {
    const id = request.params['id']!;
    if (patientById(id) === undefined) return notFound('Paciente no encontrado');
    if (!puedeLeer(request, id)) return forbidden('No tiene cita hoy ni vínculo vigente con esta persona');

    const limit = Number(request.query.get('limit') ?? 50) || 50;
    const costsVisible = !(request.user?.roles ?? []).some((role) => ROLES_WITHOUT_COSTS.includes(role));
    const own = RECEIVED_SERVICES.filter((service) => service.patientProfileId === id).sort((a, b) => b.performedAt.localeCompare(a.performedAt));

    return {
      patientProfileId: id,
      items: own.slice(0, limit).map(({ patientProfileId: _patient, cost, ...service }) => ({
        ...service,
        cost: costsVisible ? cost : null,
      })),
      limit,
      truncated: own.length > limit,
      costsVisible,
    };
  });
}

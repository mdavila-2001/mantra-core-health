import { conflict, forbidden, notFound, reply, validation, type MockRouter } from '../mock-router';
import { ORDER_CATEGORY } from '../fixtures/concepts';
import { orderList } from '../fixtures/clinic';
import { professionalById } from '../fixtures/people';
import { TENANT_CLINICA } from '../mock-session';
import { ahora, cuerpo } from '../mock-store';
import { labInboxOrders, unidadPublicadaDe } from './diagnostics.handlers';
import { esOrdenAbierta, estadosDeOrden } from './lab-orders.handlers';
import { derivaciones, type ReferralStatus } from './referral.store';

/* ============================================================================
    La derivación de una orden a un centro, con aceptación del paciente
    (06/11/2026) — la vía 2 de las tres con las que nace una orden.

      médico  ── POST  /diagnostics/orders/:orderId/referral ──▶ PENDING
      paciente ── POST /diagnostic-results/me/orders/:orderId/referral/accept ──▶ ACCEPTED
                                                                  └─ …/reject ──▶ REJECTED

    Sólo al aceptar la orden entra a la bandeja del centro, en «Borrador», con
    origen `DOCTOR_REFERRAL`. Si el paciente rechaza o no responde, el centro
    no ve nada. La API real no tiene estas rutas.
    ========================================================================== */

const esDeEstudio = (categoryConceptId: string): boolean =>
  categoryConceptId === ORDER_CATEGORY['SRQ-LAB'] || categoryConceptId === ORDER_CATEGORY['SRQ-IMAGING'];

const esClinico = (roles: readonly string[]): boolean =>
  ['CLINICIAN', 'PRACTITIONER', 'SUPERADMIN'].some((r) => roles.includes(r));

export function registrarDerivaciones(router: MockRouter): void {
  router.post('/diagnostics/orders/:orderId/referral', (request) => {
    if (request.user === null || !esClinico(request.user.roles)) {
      return forbidden('Sólo un profesional deriva una orden.');
    }
    const orderId = request.params['orderId']!;
    const orden = orderList.get(orderId);
    if (orden === undefined) return notFound('La orden no existe.');
    if (!esDeEstudio(orden.categoryConceptId)) {
      return validation('Sólo se derivan órdenes de laboratorio o imagenología.');
    }
    if (!esOrdenAbierta(orden.statusConceptId)) {
      return conflict('Esa orden ya no está pendiente: no se puede derivar.');
    }
    const { performerTenantId } = cuerpo<{ performerTenantId?: unknown }>(request);
    const centro = typeof performerTenantId === 'string' ? unidadPublicadaDe(performerTenantId) : undefined;
    if (typeof performerTenantId !== 'string' || centro === undefined) {
      return validation('Elija un laboratorio o centro de imagenología publicado.', [
        { field: 'performerTenantId', message: 'must be a published diagnostic center' },
      ]);
    }
    const previa = derivaciones.get(orderId);
    if (previa !== undefined && previa.status !== 'REJECTED') {
      return conflict(
        previa.status === 'PENDING'
          ? 'La orden ya está derivada y espera la aceptación del paciente.'
          : 'La orden ya fue aceptada por el centro elegido.',
        { currentStatus: previa.status },
      );
    }
    if (labInboxOrders.get(orderId) !== undefined) {
      return conflict('La orden ya está en la bandeja de un centro.');
    }
    const medico = professionalById(request.user.practitionerProfileId ?? orden.requesterProfileId);
    const nueva = derivaciones.agregar({
      id: orderId,
      performerTenantId,
      performerName: centro.name,
      requestedByName: medico?.displayName ?? request.user.displayName,
      status: 'PENDING',
      requestedAt: ahora(),
      decidedAt: null,
    });
    return reply(201, { orderId, status: nueva.status, performerName: nueva.performerName });
  });

  for (const accion of ['accept', 'reject'] as const) {
    router.post(`/diagnostic-results/me/orders/:orderId/referral/${accion}`, (request) => {
      const orderId = request.params['orderId']!;
      const orden = orderList.get(orderId);
      const paciente = request.user?.patientProfileId ?? null;
      // Una orden ajena responde 404, igual que una que no existe: no se revela.
      if (orden === undefined || paciente === null || orden.patientProfileId !== paciente) {
        return notFound('No encontramos esa orden.');
      }
      const derivacion = derivaciones.get(orderId);
      if (derivacion === undefined) return notFound('Esa orden no tiene una derivación.');
      if (derivacion.status !== 'PENDING') {
        return conflict('Esa derivación ya está resuelta.', { currentStatus: derivacion.status });
      }
      const status: ReferralStatus = accion === 'accept' ? 'ACCEPTED' : 'REJECTED';
      if (status === 'ACCEPTED') {
        const yaDirigida = labInboxOrders.get(orderId);
        if (yaDirigida !== undefined && yaDirigida.performerTenantId !== derivacion.performerTenantId) {
          return conflict('Esa orden ya está en la bandeja de otro centro.');
        }
        if (yaDirigida === undefined) {
          labInboxOrders.agregar({
            id: orden.id,
            patientProfileId: orden.patientProfileId,
            codeConceptId: orden.codeConceptId,
            categoryConceptId: orden.categoryConceptId,
            priorityConceptId: orden.priorityConceptId,
            statusConceptId: orden.statusConceptId,
            requesterProfileId: orden.requesterProfileId,
            requestingTenantId: TENANT_CLINICA,
            performerTenantId: derivacion.performerTenantId,
            requestedAt: orden.createdAt,
            origin: 'DOCTOR_REFERRAL',
          });
          estadosDeOrden.agregar({ id: orden.id, status: 'DRAFT', reason: null });
        }
      }
      derivaciones.agregar({ ...derivacion, status, decidedAt: ahora() });
      return { orderId, status, performerName: derivacion.performerName };
    });
  }
}

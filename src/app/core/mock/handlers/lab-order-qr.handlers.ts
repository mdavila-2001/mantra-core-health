import { conflict, forbidden, notFound, reply, validation, type MockRouter } from '../mock-router';
import { orderList } from '../fixtures/clinic';
import { ORDER_CATEGORY, displayOf } from '../fixtures/concepts';
import { TENANT_CLINICA } from '../mock-session';
import { cuerpo } from '../mock-store';
import { orderIdFromQrCode } from '../../data-access/lab-portal/lab-order-qr';
import { labInboxOrders } from './diagnostics.handlers';
import {
  esOrdenAbierta,
  estadosDeOrden,
  ordenDeRespuesta,
  type DependenciasDeOrdenes,
} from './lab-orders.handlers';

/* ============================================================================
    Way 1 of three to create an order: the order QR the patient sends (06/11/2026).
    Simulator-only: the real API has no such route. The center's own registration (way 3) is
    `lab-order-intake.handlers.ts`, which mirrors the real API.
    ========================================================================== */

export function registerLabOrderFromQr(router: MockRouter, deps: DependenciasDeOrdenes): void {
  router.post('/diagnostics/lab/orders/from-qr', (request) => {
    const tenantId = deps.laboratorioDe(request);
    if (tenantId === null) return forbidden('Sólo el personal del laboratorio crea sus órdenes.');
    const { code } = cuerpo<{ code?: unknown }>(request);
    const orderId = typeof code === 'string' ? orderIdFromQrCode(code) : null;
    if (orderId === null) {
      return validation('Ese código no es el de una orden de AloVida.', [{ field: 'code', message: 'must be an order QR code' }]);
    }
    const addressed = labInboxOrders.get(orderId);
    if (addressed !== undefined) {
      return addressed.performerTenantId === tenantId
        ? ordenDeRespuesta(orderId, deps)
        : conflict('Esa orden ya está dirigida a otro centro.');
    }
    const clinical = orderList.get(orderId);
    if (clinical === undefined) return notFound('No encontramos la orden de ese código.');
    const isStudy = clinical.categoryConceptId === ORDER_CATEGORY['SRQ-LAB'] || clinical.categoryConceptId === ORDER_CATEGORY['SRQ-IMAGING'];
    if (!isStudy) return validation('Esa orden no es de laboratorio ni de imagenología.', [{ field: 'code', message: 'must be a laboratory or imaging order' }]);
    if (!esOrdenAbierta(clinical.statusConceptId)) {
      return conflict('Esa orden ya no está pendiente: no se puede dirigir a un centro.', { currentStatus: displayOf(clinical.statusConceptId) });
    }
    labInboxOrders.agregar({
      id: clinical.id,
      patientProfileId: clinical.patientProfileId,
      codeConceptId: clinical.codeConceptId,
      categoryConceptId: clinical.categoryConceptId,
      priorityConceptId: clinical.priorityConceptId,
      statusConceptId: clinical.statusConceptId,
      requesterProfileId: clinical.requesterProfileId,
      requestingTenantId: TENANT_CLINICA,
      performerTenantId: tenantId,
      requestedAt: clinical.createdAt,
      origin: 'PATIENT_QR',
    });
    estadosDeOrden.agregar({ id: clinical.id, status: 'DRAFT', reason: null });
    return reply(201, ordenDeRespuesta(clinical.id, deps));
  });
}

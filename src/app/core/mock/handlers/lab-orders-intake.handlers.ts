import { conflict, forbidden, notFound, reply, validation, type MockRouter } from '../mock-router';
import { orderList } from '../fixtures/clinic';
import { ORDER_CATEGORY, STATUS, displayOf } from '../fixtures/concepts';
import { MEDICAL, PATIENTS, patientById } from '../fixtures/people';
import { TENANT_CLINICA } from '../mock-session';
import { ahora, cuerpo, nuevoId } from '../mock-store';
import { orderIdFromQrCode } from '../../data-access/lab-portal/lab-order-qr';
import { labInboxOrders } from './diagnostics.handlers';
import {
  esOrdenAbierta,
  estadosDeOrden,
  ordenDeRespuesta,
  type DependenciasDeOrdenes,
} from './lab-orders.handlers';

/* ============================================================================
    How an order is born at a laboratory or imaging center (06/11/2026).

    - `POST /diagnostics/lab/patients/lookup` and `POST /diagnostics/lab/orders`
      mirror the REAL API (`diagnostics-lab-portal.controller.ts`): the center
      finds the patient by national id and registers a paper/counter order.
    - `POST /diagnostics/lab/orders/from-qr` is simulator-only: the order QR
      the patient sends (`lab-order-qr.ts`). The real API has no such route.
    ========================================================================== */

const CATEGORY_BY_CODE = { LAB: ORDER_CATEGORY['SRQ-LAB'], IMAGING: ORDER_CATEGORY['SRQ-IMAGING'] } as const;

export function registerLabOrderIntake(router: MockRouter, deps: DependenciasDeOrdenes): void {
  router.post('/diagnostics/lab/patients/lookup', (request) => {
    if (deps.laboratorioDe(request) === null) return forbidden();
    const { nationalId } = cuerpo<{ nationalId?: unknown }>(request);
    const wanted = typeof nationalId === 'string' ? nationalId.trim() : '';
    if (wanted === '') return validation('Escriba el número de documento.');
    const patient = PATIENTS.find((p) => p.nationalId === wanted);
    if (patient === undefined) return notFound('Nadie tiene ese documento.');
    return { patientProfileId: patient.id, displayName: patient.displayName, patientCode: patient.patientCode };
  });

  router.post('/diagnostics/lab/orders', (request) => {
    const tenantId = deps.laboratorioDe(request);
    if (tenantId === null) return forbidden('Sólo el personal del laboratorio crea sus órdenes.');
    const body = cuerpo<Record<string, unknown>>(request);
    const { patientProfileId, codeConceptId, category, externalRequesterName } = body;
    const categoryId = category === 'LAB' || category === 'IMAGING' ? CATEGORY_BY_CODE[category] : undefined;
    if (typeof patientProfileId !== 'string' || patientById(patientProfileId) === undefined) {
      return validation('Elija al paciente con su documento.', [{ field: 'patientProfileId', message: 'must be a known patient' }]);
    }
    if (typeof codeConceptId !== 'string' || codeConceptId === '' || categoryId === undefined) {
      return validation('Elija el estudio.', [{ field: 'codeConceptId', message: 'must be a study of the catalog' }]);
    }
    const requester = typeof externalRequesterName === 'string' ? externalRequesterName.trim() : '';
    const id = nuevoId('lab-own-order');
    labInboxOrders.agregar({
      id,
      patientProfileId,
      codeConceptId,
      categoryConceptId: categoryId,
      priorityConceptId: typeof body['priorityConceptId'] === 'string' ? body['priorityConceptId'] : '',
      statusConceptId: STATUS['ST-ACTIVE']!,
      requesterProfileId: MEDICAL.id,
      requestingTenantId: tenantId,
      performerTenantId: tenantId,
      requestedAt: ahora(),
      origin: 'LAB_OWN',
      ...(requester === '' ? {} : { externalRequesterName: requester }),
    });
    estadosDeOrden.agregar({ id, status: 'DRAFT', reason: null });
    return reply(201, ordenDeRespuesta(id, deps));
  });

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

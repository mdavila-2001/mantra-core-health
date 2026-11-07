import { conflict, forbidden, notFound, unprocessable, validationPipeRejected, type MockRequest, type MockRouter } from '../mock-router';
import { ESTUDIO, ORDER_CATEGORY, PRIORITY, STATUS } from '../fixtures/concepts';
import { patientList } from '../fixtures/people';
import { ahora, Coleccion, cuerpo, nuevoId } from '../mock-store';
import { labInboxOrders } from './diagnostics.handlers';
import type { LabOrder } from '../../data-access/lab-portal/lab-portal.types';
import type { LabOrderIntakeFields, NewLabOrder } from '../../data-access/lab-portal/lab-order-intake.types';

/* ============================================================================
    Orders the laboratory / imaging center enters itself (API v4.2.96), in the
    simulator: patient lookup by exact national id, create, edit before it is
    received. The order goes to `labInboxOrders` like any other, with the
    center as requester and performer; who signed the paper lives here.
    ========================================================================== */

export interface OrdenDelCentro {
  readonly id: string;
  readonly externalRequesterName: string | null;
  readonly externalRequesterLicense: string | null;
}

/** The orders the center entered: only these can be edited or annulled by it. */
export const ordenesDelCentro = new Coleccion<OrdenDelCentro>([]);

const CODE_OF = new Map(Object.entries(ESTUDIO).map(([code, id]) => [id, code]));
const IMAGING = /^STUDY-(RX|ECO|RMN|TAC|MAMOGRAFIA|DENSITOMETRIA)/;

/** The family the study catalog gives a simulated study. */
export function familiaDelEstudio(conceptId: string): string | null {
  const code = CODE_OF.get(conceptId);
  if (code === undefined) return null;
  if (code === 'STUDY-ECG') return 'CARDIO';
  return IMAGING.test(code) ? 'IMAGING' : 'LAB';
}

export interface DependenciasDelCentro {
  readonly laboratorioDe: (request: MockRequest) => string | null;
  /** The order as the list shows it (`ordenDeRespuesta`). */
  readonly responder: (orderId: string) => LabOrder | undefined;
}

/** 400 for a malformed body, 422 for a study outside the catalog or the wrong family. */
function invalido(fields: Partial<LabOrderIntakeFields>) {
  if (typeof fields.codeConceptId !== 'string' || (fields.category !== 'LAB' && fields.category !== 'IMAGING')) {
    return validationPipeRejected('codeConceptId and category (LAB | IMAGING) are required');
  }
  const familia = familiaDelEstudio(fields.codeConceptId);
  if (familia === null) return unprocessable('El estudio no pertenece al catálogo de estudios solicitables.');
  if (familia !== fields.category) return unprocessable('La categoría no corresponde al estudio según el catálogo.');
  return null;
}

const externo = (fields: Partial<LabOrderIntakeFields>): Omit<OrdenDelCentro, 'id'> => ({
  externalRequesterName: fields.externalRequesterName?.trim() || null,
  externalRequesterLicense: fields.externalRequesterLicense?.trim() || null,
});

export function registrarOrdenesDelCentro(router: MockRouter, deps: DependenciasDelCentro): void {
  router.get('/clinical/study-catalog/:conceptId', (request) => {
    const familia = familiaDelEstudio(request.params['conceptId']!);
    return familia === null ? notFound('Estudio no encontrado') : { conceptId: request.params['conceptId'], family: familia };
  });

  router.post('/diagnostics/lab/patients/lookup', (request) => {
    if (deps.laboratorioDe(request) === null) return forbidden();
    const nationalId = (cuerpo<{ nationalId?: string }>(request).nationalId ?? '').trim();
    const encontrados = patientList.filtrar((p) => p.nationalId === nationalId);
    if (encontrados.length === 0) return notFound('No hay ningún paciente registrado con ese documento.');
    if (encontrados.length > 1) return conflict('Ese documento figura en más de un paciente.');
    const [paciente] = encontrados;
    return { patientProfileId: paciente!.id, displayName: paciente!.displayName, patientCode: paciente!.patientCode };
  });

  router.post('/diagnostics/lab/orders', (request) => {
    const tenantId = deps.laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const body = cuerpo<Partial<NewLabOrder>>(request);
    const error = invalido(body);
    if (error !== null) return error;
    if (patientList.get(body.patientProfileId ?? '') === undefined) {
      return unprocessable('No hay ningún paciente registrado con ese documento.');
    }
    const id = nuevoId();
    labInboxOrders.agregar({
      id,
      patientProfileId: body.patientProfileId!,
      codeConceptId: body.codeConceptId!,
      categoryConceptId: ORDER_CATEGORY[body.category === 'IMAGING' ? 'SRQ-IMAGING' : 'SRQ-LAB']!,
      priorityConceptId: body.priorityConceptId ?? PRIORITY['PRI-ROUTINE']!,
      statusConceptId: STATUS['ST-ACTIVE']!,
      requesterProfileId: '',
      requestingTenantId: tenantId,
      performerTenantId: tenantId,
      requestedAt: ahora(),
    });
    ordenesDelCentro.agregar({ id, ...externo(body) });
    return deps.responder(id)!;
  });

  router.put('/diagnostics/lab/orders/:orderId', (request) => {
    const tenantId = deps.laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const orderId = request.params['orderId']!;
    const orden = labInboxOrders.get(orderId);
    if (orden === undefined || orden.performerTenantId !== tenantId) return notFound('Recurso no disponible');
    if (ordenesDelCentro.get(orderId) === undefined || deps.responder(orderId)?.status !== 'DRAFT') {
      return conflict('Sólo se editan las órdenes que cargó el centro y que todavía no se recibieron.');
    }
    const body = cuerpo<Partial<LabOrderIntakeFields>>(request);
    const error = invalido(body);
    if (error !== null) return error;
    labInboxOrders.actualizar(orderId, {
      codeConceptId: body.codeConceptId!,
      categoryConceptId: ORDER_CATEGORY[body.category === 'IMAGING' ? 'SRQ-IMAGING' : 'SRQ-LAB']!,
      priorityConceptId: body.priorityConceptId ?? PRIORITY['PRI-ROUTINE']!,
    });
    ordenesDelCentro.agregar({ id: orderId, ...externo(body) });
    return deps.responder(orderId)!;
  });
}

ordenesDelCentro.persistirEn('mock.lab-portal.ordenes-del-centro');

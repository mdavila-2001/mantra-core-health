import {
  conflict,
  forbidden,
  notFound,
  reply,
  validation,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { ESTUDIO, ORDER_CATEGORY, STATUS, displayOf } from '../fixtures/concepts';
import { orderList } from '../fixtures/clinic';
import { MEDICAL, PATIENTS, patientById } from '../fixtures/people';
import { TENANT_CLINICA, TENANT_LABORATORIO } from '../mock-session';
import { ahora, Coleccion, cuerpo, nuevoId, texto } from '../mock-store';
import { labInboxOrders } from './diagnostics.handlers';
import { orderIdFromQrCode } from '../../data-access/lab-portal/lab-order-qr';
import type {
  LabOrder,
  LabOrderAction,
  LabOrderOrigin,
  LabOrderStatus,
} from '../../data-access/lab-portal/lab-portal.types';

/* ============================================================================
    Las órdenes del laboratorio (31/10/2026) — P52.

    El camino de una orden es Borrador → Recibida → Procesada → Subidos, con
    Cancelada y Rechazada como salidas de una orden recibida. «Subidos» no se
    guarda: es una orden procesada que ya tiene un resultado disponible, así que
    no puede contradecir a «Resultados» del resumen.

    Sólo existe en el simulador: la API real no publica ninguna ruta
    `/diagnostics/lab/*` (ver `LabPortalClient`). Su archivo propio es el que
    el ratchet de tamaño (`check-max-lines`) le pide a `lab-portal.handlers.ts`.
    ========================================================================== */

/**
 * El estado que el laboratorio le dio a una orden de su bandeja. `UPLOADED` no
 * se guarda: es una orden `PROCESSED` que ya tiene un resultado disponible
 * (ver {@link estadoDeOrden}).
 */
export interface EstadoDeOrden {
  /** El id de la orden: una fila por orden. */
  readonly id: string;
  readonly status: Exclude<LabOrderStatus, 'UPLOADED'>;
  readonly reason: string | null;
}

/**
 * Cómo arranca la maqueta: las órdenes con resultado sembrado ya están
 * procesadas, una tiene la muestra recibida, una la anuló quien la pidió y el
 * resto espera como borrador. Así las pestañas muestran de todo.
 */
function ordenesSembradas(): EstadoDeOrden[] {
  const ordenes = labInboxOrders.filtrar((o) => o.performerTenantId === TENANT_LABORATORIO);
  return ordenes.map((orden, i) => {
    if (i <= 4) return { id: orden.id, status: 'PROCESSED' as const, reason: null };
    if (i === 5) return { id: orden.id, status: 'RECEIVED' as const, reason: null };
    if (i === 6) {
      return { id: orden.id, status: 'CANCELLED' as const, reason: 'La anuló quien la pidió.' };
    }
    return { id: orden.id, status: 'DRAFT' as const, reason: null };
  });
}

export const estadosDeOrden = new Coleccion<EstadoDeOrden>(ordenesSembradas());

/** Qué paso admite cada estado, y a cuál lleva. */
const TRANSICIONES: Readonly<
  Record<
    LabOrderAction,
    { readonly desde: readonly EstadoDeOrden['status'][]; readonly a: EstadoDeOrden['status'] }
  >
> = {
  RECEIVE: { desde: ['DRAFT'], a: 'RECEIVED' },
  PROCESS: { desde: ['RECEIVED'], a: 'PROCESSED' },
  CANCEL: { desde: ['DRAFT', 'RECEIVED'], a: 'CANCELLED' },
  REJECT: { desde: ['RECEIVED'], a: 'REJECTED' },
};

/** Lo que estas rutas toman prestado del portal; llega por parámetro para no cruzar imports. */
export interface DependenciasDeOrdenes {
  /** El laboratorio del contexto, o `null` si quien pregunta no es su personal. */
  readonly laboratorioDe: (request: MockRequest) => string | null;
  readonly destinoDeOrden: (
    orderId: string,
  ) => { studyName: string; patientName: string; requesterName: string } | undefined;
  /** Los resultados subidos (`resultadosDeLaboratorio`). */
  readonly archivos: Pick<Coleccion<ArchivoSubido>, 'filtrar'>;
}

/** Lo que de un resultado subido le importa a una orden. */
interface ArchivoSubido {
  readonly id: string;
  readonly orderId: string | null;
  readonly status: 'AVAILABLE' | 'WITHDRAWN';
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly uploadedAt: string;
}

/** Los resultados disponibles de una orden, del más viejo al más nuevo. */
function archivosDe(orderId: string, archivos: DependenciasDeOrdenes['archivos']): ArchivoSubido[] {
  return archivos
    .filtrar((r) => r.orderId === orderId && r.status === 'AVAILABLE')
    .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt) || a.id.localeCompare(b.id));
}

/** El estado visible de una orden: una procesada con resultado disponible está subida. */
function ordenDeRespuesta(orderId: string, deps: DependenciasDeOrdenes): LabOrder | undefined {
  const orden = labInboxOrders.get(orderId);
  const destino = deps.destinoDeOrden(orderId);
  if (orden === undefined || destino === undefined) return undefined;
  const guardado = estadosDeOrden.get(orderId);
  const files = archivosDe(orderId, deps.archivos).map((r) => ({
    id: r.id,
    fileName: r.fileName,
    sizeBytes: r.sizeBytes,
  }));
  const status = guardado?.status ?? 'DRAFT';
  return {
    orderId,
    studyName: destino.studyName,
    patientName: destino.patientName,
    requesterName: destino.requesterName,
    requestedAt: orden.requestedAt,
    origin: (orden.origin ?? 'CLINIC') satisfies LabOrderOrigin,
    status: status === 'PROCESSED' && files.length > 0 ? 'UPLOADED' : status,
    reason: guardado?.reason ?? null,
    files,
  };
}

/**
 * Si una orden admite resultados: sólo una ya procesada. «Subidos» es esa misma
 * orden con archivos, así que también admite más.
 */
export function ordenProcesada(orderId: string): boolean {
  return estadosDeOrden.get(orderId)?.status === 'PROCESSED';
}

export function registrarOrdenesDeLaboratorio(
  router: MockRouter,
  deps: DependenciasDeOrdenes,
): void {
  router.get('/diagnostics/lab/orders', (request) => {
    const tenantId = deps.laboratorioDe(request);
    if (tenantId === null) return forbidden('Sólo el personal del laboratorio ve sus órdenes.');
    const items = labInboxOrders
      .filtrar((o) => o.performerTenantId === tenantId)
      .map((o) => ordenDeRespuesta(o.id, deps)!)
      .sort(
        (a, b) => b.requestedAt.localeCompare(a.requestedAt) || a.orderId.localeCompare(b.orderId),
      );
    return { items, count: items.length };
  });

  /* ---- cómo nace una orden (06/11/2026) -------------------------------------
     Dos de las tres vías de alta: el QR que mandó el paciente y la orden que
     crea el propio centro. La tercera —la derivación del médico, aceptada por
     el paciente— entra a la misma bandeja desde `referral.handlers.ts`. */

  router.get('/diagnostics/lab/patients', (request) => {
    if (deps.laboratorioDe(request) === null) return forbidden();
    const q = (texto(request.query, 'q') ?? '').trim().toLocaleLowerCase('es');
    if (q.length < 2) return validation('Escriba al menos 2 letras para buscar un paciente.');
    const items = PATIENTS.filter(
      (p) =>
        p.displayName.toLocaleLowerCase('es').includes(q) ||
        p.patientCode.toLocaleLowerCase('es').includes(q),
    )
      .slice(0, 10)
      .map((p) => ({
        patientProfileId: p.id,
        displayName: p.displayName,
        patientCode: p.patientCode,
      }));
    return { items, count: items.length };
  });

  router.post('/diagnostics/lab/orders', (request) => {
    const tenantId = deps.laboratorioDe(request);
    if (tenantId === null) return forbidden('Sólo el personal del laboratorio crea sus órdenes.');
    const { patientProfileId, studyName, note } = cuerpo<{
      patientProfileId?: unknown;
      studyName?: unknown;
      note?: unknown;
    }>(request);
    const estudio = typeof studyName === 'string' ? studyName.trim() : '';
    if (estudio === '' || estudio.length > 120) {
      return validation('Indique el estudio (hasta 120 letras).', [
        { field: 'studyName', message: 'must not be empty' },
      ]);
    }
    if (typeof patientProfileId !== 'string' || patientById(patientProfileId) === undefined) {
      return validation('Elija un paciente de la lista.', [
        { field: 'patientProfileId', message: 'must be a known patient' },
      ]);
    }
    if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 500)) {
      return validation('La nota admite hasta 500 letras.', [
        { field: 'note', message: 'must be shorter than or equal to 500 characters' },
      ]);
    }
    const id = nuevoId('lab-own-order');
    labInboxOrders.agregar({
      id,
      patientProfileId,
      codeConceptId: conceptoDe(estudio),
      categoryConceptId: ORDER_CATEGORY['SRQ-LAB']!,
      priorityConceptId: '',
      statusConceptId: '',
      requesterProfileId: MEDICAL.id,
      requestingTenantId: tenantId,
      performerTenantId: tenantId,
      requestedAt: ahora(),
      origin: 'LAB_OWN',
      studyNameOverride: estudio,
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
      return validation('Ese código no es el de una orden de AloVida.', [
        { field: 'code', message: 'must be an order QR code' },
      ]);
    }
    const dirigida = labInboxOrders.get(orderId);
    if (dirigida !== undefined) {
      if (dirigida.performerTenantId !== tenantId) {
        return conflict('Esa orden ya está dirigida a otro centro.');
      }
      return ordenDeRespuesta(orderId, deps);
    }
    const clinica = orderList.get(orderId);
    if (clinica === undefined) return notFound('No encontramos la orden de ese código.');
    const esDeEstudio =
      clinica.categoryConceptId === ORDER_CATEGORY['SRQ-LAB'] ||
      clinica.categoryConceptId === ORDER_CATEGORY['SRQ-IMAGING'];
    if (!esDeEstudio) {
      return validation('Esa orden no es de laboratorio ni de imagenología.', [
        { field: 'code', message: 'must be a laboratory or imaging order' },
      ]);
    }
    if (!esOrdenAbierta(clinica.statusConceptId)) {
      return conflict('Esa orden ya no está pendiente: no se puede dirigir a un centro.', {
        currentStatus: displayOf(clinica.statusConceptId),
      });
    }
    labInboxOrders.agregar({
      id: clinica.id,
      patientProfileId: clinica.patientProfileId,
      codeConceptId: clinica.codeConceptId,
      categoryConceptId: clinica.categoryConceptId,
      priorityConceptId: clinica.priorityConceptId,
      statusConceptId: clinica.statusConceptId,
      requesterProfileId: clinica.requesterProfileId,
      requestingTenantId: TENANT_CLINICA,
      performerTenantId: tenantId,
      requestedAt: clinica.createdAt,
      origin: 'PATIENT_QR',
    });
    estadosDeOrden.agregar({ id: clinica.id, status: 'DRAFT', reason: null });
    return reply(201, ordenDeRespuesta(clinica.id, deps));
  });

  router.post('/diagnostics/lab/orders/:orderId/transitions', (request) => {
    const tenantId = deps.laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const orderId = request.params['orderId']!;
    const orden = labInboxOrders.get(orderId);
    if (orden === undefined || orden.performerTenantId !== tenantId) {
      return notFound('La orden no existe o no es de este laboratorio.');
    }
    const { action, reason } = cuerpo<{ action: LabOrderAction; reason?: string }>(request);
    if (typeof action !== 'string' || !Object.hasOwn(TRANSICIONES, action)) {
      return validation('Ese paso no existe.');
    }
    const paso = TRANSICIONES[action];
    const actual = ordenDeRespuesta(orderId, deps)!;
    if (!paso.desde.includes(actual.status === 'UPLOADED' ? 'PROCESSED' : actual.status)) {
      return conflict('La orden no está en un estado que admita ese paso.', {
        currentStatus: actual.status,
      });
    }
    const motivo = (reason ?? '').trim();
    estadosDeOrden.agregar({
      id: orderId,
      status: paso.a,
      reason: (paso.a === 'CANCELLED' || paso.a === 'REJECTED') && motivo !== '' ? motivo : null,
    });
    return ordenDeRespuesta(orderId, deps)!;
  });
}

/**
 * Si una orden clínica todavía se puede dirigir a un centro: pendiente o activa.
 * Una completada, en curso o anulada ya no: dirigirla de nuevo la duplicaría.
 */
export function esOrdenAbierta(statusConceptId: string): boolean {
  return statusConceptId === STATUS['ST-PENDING'] || statusConceptId === STATUS['ST-ACTIVE'];
}

/**
 * El concepto del catálogo que mejor corresponde al estudio escrito: el de igual
 * nombre, o el primero. El nombre que ve el centro es el que escribió
 * (`studyNameOverride`); el concepto sólo hace falta para no dejar la orden sin código.
 */
function conceptoDe(estudio: string): string {
  const buscado = estudio.toLocaleLowerCase('es');
  const conceptos = Object.values(ESTUDIO) as string[];
  return (
    conceptos.find((id) => displayOf(id).toLocaleLowerCase('es') === buscado) ?? conceptos[0]!
  );
}

estadosDeOrden.persistirEn('mock.lab-portal.ordenes');

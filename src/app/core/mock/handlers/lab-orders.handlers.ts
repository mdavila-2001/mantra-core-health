import {
  conflict,
  forbidden,
  notFound,
  validation,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { TENANT_LABORATORIO } from '../mock-session';
import { Coleccion, cuerpo } from '../mock-store';
import { labInboxOrders } from './diagnostics.handlers';
import type {
  LabOrder,
  LabOrderAction,
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

estadosDeOrden.persistirEn('mock.lab-portal.ordenes');

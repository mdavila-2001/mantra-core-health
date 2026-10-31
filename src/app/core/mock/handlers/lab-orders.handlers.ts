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
import { STATUS, ORDER_CATEGORY } from '../fixtures/concepts';
import { patientById } from '../fixtures/people';
import { familiaDeEstudio } from '../fixtures/study-catalog';
import { TENANT_NAMES } from '../mock-session';
import { decodeInboxCursor, encodeInboxCursor } from './diagnostics-inbox-cursor';
import { labInboxOrders, type LabInboxOrderRecord } from './diagnostics.handlers';
import { camposDeDetalle, resumenDeOrden } from './service-request-detail.mock';
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

/* ---- la bandeja del ejecutor (C6) ------------------------------------------

   `POST /diagnostics/service-requests/worklist` y `GET
   /diagnostics/service-requests/:id`: lo mismo que `/diagnostics/lab/orders`
   pero con la forma de la API real. Las órdenes que el médico dirige a este
   centro (`performerTenantId`) entran a `labInboxOrders` al pedirlas (puente
   B2), así que aparecen acá con su detalle y las transiciones de arriba
   (recibir, procesar, subir resultados) siguen funcionando sobre ellas.

   El `state` se deriva del camino de la orden: Borrador → `PENDING`,
   Recibida → `RECEIVED`, Procesada → `IN_PROCESS`, Subidos → `REPORTED`,
   Cancelada/Rechazada o satisfecha por un informe previo → `CANCELLED`.

   Extensión del simulador, que la API real no manda en la bandeja: `files`
   (resultados subidos) y `reason` (motivo de una cancelación). */

type EstadoDeBandeja = 'PENDING' | 'RECEIVED' | 'IN_PROCESS' | 'REPORTED' | 'CANCELLED';
const ESTADOS_DE_BANDEJA: readonly EstadoDeBandeja[] = ['PENDING', 'RECEIVED', 'IN_PROCESS', 'REPORTED', 'CANCELLED'];

function estadoDeBandeja(orden: LabInboxOrderRecord, visible: LabOrder): EstadoDeBandeja {
  if (orden.statusConceptId === STATUS['ST-SATISFIED-BY-PRIOR']) return 'CANCELLED';
  switch (visible.status) {
    case 'DRAFT':
      return 'PENDING';
    case 'RECEIVED':
      return 'RECEIVED';
    case 'PROCESSED':
      return 'IN_PROCESS';
    case 'UPLOADED':
      return 'REPORTED';
    default:
      return 'CANCELLED';
  }
}

/** Laboratorio o imagen: por la familia explícita del estudio y, si no la tiene, por la categoría. */
function alcanceDe(orden: LabInboxOrderRecord): 'LAB' | 'IMAGING' {
  const familia = familiaDeEstudio(orden.codeConceptId);
  if (familia === 'LAB' || familia === 'IMAGING') return familia;
  return orden.categoryConceptId === ORDER_CATEGORY['SRQ-IMAGING'] ? 'IMAGING' : 'LAB';
}

function plegado(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function itemDeBandeja(orden: LabInboxOrderRecord, deps: DependenciasDeOrdenes) {
  const visible = ordenDeRespuesta(orden.id, deps)!;
  const paciente = patientById(orden.patientProfileId);
  const detalle = camposDeDetalle(orden.id, orden.codeConceptId);
  return {
    serviceRequestId: orden.id,
    patientProfileId: orden.patientProfileId,
    patientDisplayName: paciente?.displayName ?? null,
    patientCode: paciente?.patientCode ?? null,
    codeConceptId: orden.codeConceptId,
    codeDisplay: detalle.codeDisplay || null,
    categoryConceptId: orden.categoryConceptId,
    priorityConceptId: orden.priorityConceptId,
    statusConceptId: orden.statusConceptId,
    requesterProfileId: orden.requesterProfileId,
    requestingTenantId: orden.requestingTenantId,
    requestingTenantName: TENANT_NAMES[orden.requestingTenantId] ?? null,
    requestedAt: orden.requestedAt,
    requisitionId: detalle.requisitionId,
    specimenTypeConceptId: detalle.specimenTypeConceptId,
    specimenTypeDisplay: detalle.specimenTypeDisplay,
    components: detalle.components,
    componentsSpecified: detalle.componentsSpecified,
    imaging: detalle.imaging,
    summary: resumenDeOrden(orden.id, orden.codeConceptId),
    specimens: [],
    state: estadoDeBandeja(orden, visible),
    scope: alcanceDe(orden),
    files: visible.files,
    reason: visible.reason,
  };
}

function registrarBandejaDelEjecutor(router: MockRouter, deps: DependenciasDeOrdenes): void {
  router.post('/diagnostics/service-requests/worklist', (request) => {
    const tenantId = deps.laboratorioDe(request);
    if (tenantId === null) return forbidden('Sólo el personal del centro ve su bandeja.');
    const datos = cuerpo<{ scope: unknown; states: unknown; cursor: unknown; limit: unknown; patientQuery: unknown }>(request);
    if (datos.scope !== 'LAB' && datos.scope !== 'IMAGING') {
      return validation('scope debe ser LAB o IMAGING', [{ field: 'scope', message: 'scope must be one of the following values: LAB, IMAGING' }]);
    }
    const limit = datos.limit === undefined ? 25 : datos.limit;
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return validation('El tope de la bandeja no es válido', [{ field: 'limit', message: 'must not be greater than 100' }]);
    }
    const estados = datos.states;
    if (
      estados !== undefined &&
      (!Array.isArray(estados) || estados.some((e) => !ESTADOS_DE_BANDEJA.includes(e as EstadoDeBandeja)))
    ) {
      return validation('states: valores permitidos PENDING, RECEIVED, IN_PROCESS, REPORTED, CANCELLED');
    }
    const consulta = typeof datos.patientQuery === 'string' ? datos.patientQuery.trim() : datos.patientQuery;
    if (consulta !== undefined && (typeof consulta !== 'string' || consulta.length < 2 || consulta.length > 80)) {
      return validation('La búsqueda por paciente no es válida', [{ field: 'patientQuery', message: 'must be longer than or equal to 2 characters' }]);
    }
    let despues: { requestedAt: string; id: string } | null = null;
    if (datos.cursor !== undefined) {
      despues = typeof datos.cursor === 'string' ? decodeInboxCursor(datos.cursor) : null;
      if (despues === null) return validation('El cursor de paginación no es válido');
    }
    const aguja = typeof consulta === 'string' ? plegado(consulta) : null;
    const todos = labInboxOrders
      .filtrar((o) => o.performerTenantId === tenantId && alcanceDe(o) === datos.scope)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || b.id.localeCompare(a.id))
      .filter((o) => despues === null || o.requestedAt < despues.requestedAt || (o.requestedAt === despues.requestedAt && o.id < despues.id))
      .map((o) => itemDeBandeja(o, deps))
      .filter((i) => estados === undefined || (estados as string[]).includes(i.state))
      .filter(
        (i) =>
          aguja === null ||
          [i.patientDisplayName, i.patientCode].some((v) => v !== null && plegado(v).includes(aguja)),
      );
    const pagina = todos.slice(0, limit);
    const ultimo = pagina.at(-1);
    return {
      items: pagina,
      count: pagina.length,
      limit,
      nextCursor:
        todos.length > limit && ultimo !== undefined
          ? encodeInboxCursor({ requestedAt: ultimo.requestedAt, id: ultimo.serviceRequestId })
          : null,
    };
  });

  router.get('/diagnostics/service-requests/:id', (request) => {
    const tenantId = deps.laboratorioDe(request);
    if (tenantId === null) return forbidden('Sólo el personal del centro ve su bandeja.');
    const orden = labInboxOrders.get(request.params['id']!);
    if (orden === undefined || orden.performerTenantId !== tenantId) {
      return notFound('La orden no existe o no es de este centro.');
    }
    return itemDeBandeja(orden, deps);
  });
}

export function registrarOrdenesDeLaboratorio(
  router: MockRouter,
  deps: DependenciasDeOrdenes,
): void {
  registrarBandejaDelEjecutor(router, deps);

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

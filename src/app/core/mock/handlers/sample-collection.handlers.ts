import type { CollectionPointRef, SampleCollectionPoint } from '../../data-access/diagnostics/sample-collection.types';
import { SITIOS_INFRA } from '../fixtures/infraestructura';
import { TENANT_HOSPITAL } from '../mock-session';
import type { MockReply, MockRequest, MockRouter } from '../mock-router';
import { Coleccion } from '../mock-store';
import { espacios, unidades } from './infrastructure.handlers';
import { notFoundReply, pathOf, preconditionReply, tenantOf } from './operating-rooms.state';

/* ============================================================================
    Puntos de toma de muestra — franja F5b (`CONTRATO-F2-F5.md` §F5b).

    Los puntos son espacios `SAMPLE_COLLECTION` activos y disponibles del árbol
    de F1 (en San Lucas, «Toma de muestras 1» y «2», de la unidad
    Laboratorio). Un punto suspendido o en mantenimiento no se ofrece. La orden
    valida la sugerencia (422 `COLLECTION_POINT_INVALID`) y, sin sugerencia, la
    API elige el primer punto disponible de la sede sugerida.
    ========================================================================== */

const SAMPLE_COLLECTION = 'SPACE_FN_SAMPLE_COLLECTION';

const offered = (siteId: string) =>
  espacios
    .filtrar((e) => e.siteId === siteId && e.functionCode === SAMPLE_COLLECTION && e.statusCode === 'SPACE_ACTIVE')
    .filter((e) => e.operationalStatusCode === null || e.operationalStatusCode === 'SPACE_OP_AVAILABLE')
    .sort((a, b) => a.code.localeCompare(b.code));

export function collectionPointRef(careSpaceId: string | null | undefined): CollectionPointRef | null {
  const e = careSpaceId === null || careSpaceId === undefined ? undefined : espacios.get(careSpaceId);
  return e === undefined ? null : { careSpaceId: e.id, code: e.code, name: e.name };
}

/**
 * La sugerencia de punto de una orden: `{careSpaceId}` válido, un 422, o
 * `null` si no se sugirió nada ni hay sede de donde elegir.
 */
export function resolveSuggestedPoint(request: MockRequest, siteId: string | undefined, careSpaceId: string | undefined): { careSpaceId: string | null } | MockReply {
  if (careSpaceId === undefined) {
    if (siteId === undefined) return { careSpaceId: null };
    return { careSpaceId: offered(siteId)[0]?.id ?? null };
  }
  const space = espacios.get(careSpaceId);
  const tenant = tenantOf(request);
  if (space === undefined || (tenant !== null && tenant !== space.tenantId)) return notFoundReply();
  const valid = space.functionCode === SAMPLE_COLLECTION && (siteId === undefined || space.siteId === siteId) && offered(space.siteId).some((p) => p.id === space.id);
  return valid ? { careSpaceId } : preconditionReply('COLLECTION_POINT_INVALID', `«${space.name}» no es un punto de toma disponible de la sede elegida.`);
}

/* ---- la toma registrada en cada orden de trabajo ------------------------------- */

interface WorkOrderPoint {
  readonly id: string;
  readonly tenantId: string;
  readonly careSpaceId: string;
}

const workOrderPoints = new Coleccion<WorkOrderPoint>([]);
let seeded = false;

/** Las órdenes de trabajo sembradas del hospital se tomaron en sus dos puntos, alternando. */
function seedFor(workOrderIds: readonly string[]): void {
  if (seeded) return;
  seeded = true;
  const points = offered(SITIOS_INFRA[0]!.id);
  if (points.length === 0 || workOrderPoints.tamano > 0) return;
  workOrderIds.forEach((id, i) => {
    if (i % 4 !== 3) workOrderPoints.agregar({ id, tenantId: TENANT_HOSPITAL, careSpaceId: points[i % points.length]!.id });
  });
}

/** El punto donde se tomó la muestra de una orden de trabajo, visto desde el tenant activo. */
export function workOrderCollectionPoint(workOrderId: string, allIds: readonly string[], tenantId: string | null): CollectionPointRef | null {
  seedFor(allIds);
  const row = workOrderPoints.get(workOrderId);
  return row === undefined || (tenantId !== null && tenantId !== row.tenantId) ? null : collectionPointRef(row.careSpaceId);
}

export function registerSampleCollection(router: MockRouter): void {
  router.get('/sites/:siteId/sample-collection-points', (request): SampleCollectionPoint[] | MockReply => {
    const site = SITIOS_INFRA.find((s) => s.id === request.params['siteId']);
    const tenant = tenantOf(request);
    if (site === undefined || (tenant !== null && tenant !== site.tenantId)) return notFoundReply();
    return offered(site.id).map((e) => {
      const unit = e.clinicalUnitId === null ? undefined : unidades.get(e.clinicalUnitId);
      return {
        careSpace: { id: e.id, code: e.code, name: e.name, path: pathOf(e.id) },
        unit: unit === undefined ? null : { id: unit.id, name: unit.name },
        hours: 'Lunes a sábado, 07:00 a 11:00',
      };
    });
  });
}

workOrderPoints.persistirEn('mock.lab.workOrderPoints');

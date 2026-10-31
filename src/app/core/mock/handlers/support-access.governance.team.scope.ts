import { permisos, vinculos } from '../fixtures/support-hospital';
import type { FilaPermiso } from '../fixtures/support-hospital.types';
import { catalogoDe } from './support-access.core';
import { atomosDe } from './support-access.governance.view';

/* ============================================================================
    El **alcance** de una persona que administra (`/org/team/*`): las concesiones suyas con átomos `team.*`, cada una
    con el servicio o la ubicación que cubre. Una concesión de equipo `SERVICE` cubre lo de ese servicio; una `LOCATION`
    cubre esa ubicación y todo lo que cuelga de ella. Aproximación del mock: la API lo decide con su política.
   ========================================================================== */

export interface AlcanceDeAdministracion {
  /** El objetivo tal como la API lo devuelve en `assignScopes[].target`. */
  readonly objetivo: Readonly<Record<string, unknown>>;
  /** ¿Esta concesión de otra persona cae dentro del alcance? */
  readonly cubre: (p: FilaPermiso) => boolean;
  /** ¿Este objetivo (servicio o ubicación) cae dentro del alcance? */
  readonly cubreObjetivo: (o: { readonly healthcareServiceId?: string | undefined; readonly careSpaceId?: string | undefined }) => boolean;
}

export function permisosDelActor(userId: string, tenantId: string): readonly AlcanceDeAdministracion[] {
  const mios = vinculos.filtrar((v) => v.userId === userId && v.tenantId === tenantId && v.status === 'ACTIVE').map((v) => v.id);
  const lugares = catalogoDe(tenantId).locations;
  const descendientes = (raiz: string, id: string): boolean => id === raiz || (lugares.find((l) => l.id === id)?.path.includes(`/${raiz}/`) ?? false);
  return permisos
    .filtrar((p) => mios.includes(p.engagementId) && p.status === 'ACTIVE' && p.effect !== 'DENY' && atomosDe(p).some((a) => a.startsWith('team.')))
    .map((m) => {
      const cubreObjetivo: AlcanceDeAdministracion['cubreObjetivo'] = (o) => (m.healthcareServiceId !== undefined && o.healthcareServiceId === m.healthcareServiceId) || (m.careSpaceId !== undefined && o.careSpaceId !== undefined && descendientes(m.careSpaceId, o.careSpaceId));
      return { objetivo: { targetKind: m.targetKind, ...(m.healthcareServiceId === undefined ? {} : { healthcareServiceId: m.healthcareServiceId }), ...(m.careSpaceId === undefined ? {} : { careSpaceId: m.careSpaceId }) }, cubreObjetivo, cubre: (p) => cubreObjetivo(p) };
    });
}

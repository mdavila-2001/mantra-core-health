import type { InfrastructureAccessMe } from '../../data-access/operating-rooms/site-access.client';
import type { MockRouter, MockRequest } from '../mock-router';
import { sitiosInfra } from './infrastructure.handlers';
import { tenantOf } from './operating-rooms.state';

/**
 * Acciones de sede por rol global, como las concede el evaluador de §0.3 de la
 * API para los roles equivalentes (`OR_MANAGER` ↔ `PERIOP_ADMIN`, `BILLING`,
 * `ACCOUNTING`). Es el **reflejo** que devuelve `/me`; cada endpoint de la
 * maqueta sigue decidiendo por su cuenta.
 */
const ACTIONS_BY_ROLE: Readonly<Record<string, readonly string[]>> = {
  PERIOP_ADMIN: ['f4.or.read', 'f4.or-block.manage', 'f4.utilization.read', 'f5.space.equipment.read'],
  SURGERY_SCHEDULER: ['f4.or.read'],
  PERIOP_NURSE: ['f4.or.read'],
  BILLING: ['f5e.tariff.read', 'f5e.tariff.write', 'f5e.charge.read', 'f5e.charge.write'],
  ACCOUNTING_APPROVER: ['f5f.accounting.read', 'f5f.accounting.write'],
  SECURITY_ADMIN: [
    'f4.or.read', 'f4.or-block.manage', 'f4.utilization.read', 'f5.space.equipment.read', 'f5.space.stock.read',
    'f5e.tariff.read', 'f5e.tariff.write', 'f5e.charge.read', 'f5e.charge.write', 'f5f.accounting.read', 'f5f.accounting.write',
  ],
};

function accessOf(request: MockRequest): InfrastructureAccessMe {
  const tenant = tenantOf(request) ?? request.user?.tenants[0] ?? '';
  const roles = request.user?.roles ?? [];
  const actions = [...new Set(roles.flatMap((r) => ACTIONS_BY_ROLE[r] ?? []))];
  const sites = actions.length === 0 ? [] : sitiosInfra.filtrar((s) => s.tenantId === tenant);
  return {
    userId: request.user?.id ?? '',
    tenantId: tenant,
    sites: sites.map((s) => ({
      siteId: s.id,
      practiceId: s.practiceId,
      code: s.code,
      name: s.name,
      timeZone: s.timeZone,
      roles: [],
      globalRoles: roles.filter((r) => r in ACTIONS_BY_ROLE),
      actions,
      grants: [],
    })),
  };
}

/**
 * `GET /practice/infrastructure-access/me`. Si otro simulador ya la registró
 * (internación, W-F2F3), no se pisa: al integrar las ramas queda la suya.
 */
export function registerSiteAccess(router: MockRouter): void {
  if (router.match('GET', '/practice/infrastructure-access/me') !== null) return;
  router.get('/practice/infrastructure-access/me', accessOf);
}

import { ORGANIZATION_TYPE, STATUS } from './concepts';
import { IDS, TENANT_CESPEDES, TENANT_HOSPITAL_PILOTO, TENANT_LABORATORIO } from '../mock-session';
import { iso, isoDia, uuid } from '../mock-store';
import type { TenantSimulado } from '../handlers/directory.handlers';

/**
 * Lo que el directorio simulado tiene por el **personal de apoyo y la sesión**: el hospital piloto y el consultorio de la Dra.
 * Céspedes como organizaciones, el dueño del hospital y las dos invitaciones que Marcos todavía no aceptó. Vive aparte para que
 * `directory.handlers.ts` no siga creciendo.
 */

export const ROL_TENANT = {
  OWNER: uuid('concept-tenant-role-owner'),
  ADMIN: uuid('concept-tenant-role-admin'),
  STAFF: uuid('concept-tenant-role-staff'),
} as const;

export const ALCANCE_ACCESO = {
  ALL_TENANT: uuid('concept-access-scope-all'),
  BRANCH: uuid('concept-access-scope-branch'),
} as const;

export const TENANTS_DEL_APOYO: readonly TenantSimulado[] = [
  {
    id: TENANT_HOSPITAL_PILOTO,
    code: 'HPMANTRA',
    legalName: 'Hospital Piloto Mantra (ficticio)',
    tradeName: 'Hospital Piloto Mantra',
    tenantTypeConceptId: ORGANIZATION_TYPE['ORG-HOSPITAL']!,
    statusConceptId: STATUS['ST-ACTIVE']!,
    verificationStatusConceptId: STATUS['ST-VERIFIED']!,
    parentTenantId: null,
    createdAt: iso(-500),
    timeZone: 'America/La_Paz',
  },
  {
    id: TENANT_CESPEDES,
    code: 'CESPEDES',
    legalName: 'Consultorio Dra. Paola Céspedes',
    tradeName: 'Consultorio Dra. Paola Céspedes',
    tenantTypeConceptId: ORGANIZATION_TYPE['ORG-CONSULTORIO']!,
    statusConceptId: STATUS['ST-ACTIVE']!,
    verificationStatusConceptId: STATUS['ST-VERIFIED']!,
    parentTenantId: null,
    createdAt: iso(-450),
    timeZone: 'America/La_Paz',
  }
];

export const MEMBRESIAS_DEL_APOYO = [
  // El hospital piloto es una cuenta de organización: su titular es el dueño.
  {
    id: uuid('membership-hospital-piloto-owner'),
    tenantId: TENANT_HOSPITAL_PILOTO,
    userId: IDS.hospitalPiloto.userId,
    tenantRoleConceptId: ROL_TENANT.OWNER,
    statusConceptId: STATUS['ST-ACTIVE']!,
    accessScopeConceptId: ALCANCE_ACCESO.ALL_TENANT,
    primaryBranchId: null,
    startDate: isoDia(-500),
    endDate: null,
    createdAt: iso(-500),
  },
];

export const INVITACIONES_PENDIENTES = [
  // Dos invitaciones que Marcos todavía no aceptó (membresías PENDIENTES): aparecen en «Invitaciones de organizaciones».
  {
    id: uuid('membership-invitacion-cespedes-marcos'),
    tenantId: TENANT_CESPEDES,
    userId: IDS.marcos.userId,
    tenantRoleConceptId: ROL_TENANT.STAFF,
    statusConceptId: STATUS['DIR_MEMBERSHIP_PENDING_ACCEPTANCE']!,
    accessScopeConceptId: ALCANCE_ACCESO.ALL_TENANT,
    primaryBranchId: null,
    startDate: isoDia(-2),
    endDate: null,
    createdAt: iso(-2),
  },
  {
    id: uuid('membership-invitacion-laboratorio-marcos'),
    tenantId: TENANT_LABORATORIO,
    userId: IDS.marcos.userId,
    tenantRoleConceptId: ROL_TENANT.STAFF,
    statusConceptId: STATUS['DIR_MEMBERSHIP_PENDING_ACCEPTANCE']!,
    accessScopeConceptId: ALCANCE_ACCESO.ALL_TENANT,
    primaryBranchId: null,
    startDate: isoDia(-1),
    endDate: null,
    createdAt: iso(-1),
  },
];

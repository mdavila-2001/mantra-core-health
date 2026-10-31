import type { CostCenter, InfrastructureItem } from '../../data-access/accounting/infrastructure-items.types';
import { PRACTICE_SANLUCAS } from '../fixtures/agenda';
import { SITIOS_INFRA } from '../fixtures/infraestructura';
import type { MockRequest, MockRouter } from '../mock-router';
import { Coleccion, texto, uuid } from '../mock-store';
import { espacios, tenantDePractica, unidades } from './infrastructure.handlers';
import { conflictReply, forbiddenReply, hasRole, notFoundReply, pathOf, preconditionReply, tenantOf } from './operating-rooms.state';

/* ============================================================================
    Contabilidad por espacio — franja F5f (`CONTRATO-F2-F5.md` §F5f).

    Los activos de San Lucas se ubican en espacios del árbol de F1 (`location_text`
    queda como lectura heredada) y los centros de costo se ligan a una unidad
    (uno vigente por unidad: `ux_cost_centers_unit_active`). Los cargos de
    día-cama toman de acá el centro de costo de la unidad dueña de la cama.
    Permisos: `ACCOUNTING_APPROVER` y la administración escriben; Facturación lee.
    ========================================================================== */

const WRITE_ROLES = ['ACCOUNTING_APPROVER', 'SECURITY_ADMIN'] as const;
const READ_ROLES = ['ACCOUNTING_APPROVER', 'SECURITY_ADMIN', 'BILLING', 'SUPERADMIN'] as const;
const SAN_LUCAS = SITIOS_INFRA[0]!;

const spaceId = (code: string): string | null => espacios.todos().find((e) => e.siteId === SAN_LUCAS.id && e.code === code)?.id ?? null;
const unitId = (code: string): string | null => unidades.todos().find((u) => u.siteId === SAN_LUCAS.id && u.code === code)?.id ?? null;

interface SimulatedItem {
  readonly id: string;
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  readonly category: string;
  readonly careSpaceId: string | null;
  readonly locationText: string | null;
  readonly bookValue: string;
}

interface SimulatedCostCenter {
  readonly id: string;
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  readonly clinicalUnitId: string | null;
}

const item = (code: string, name: string, category: string, space: string | null, locationText: string | null, value: string): SimulatedItem => ({
  id: uuid(`infra-item-${code}`),
  practiceId: PRACTICE_SANLUCAS,
  code,
  name,
  category,
  careSpaceId: space === null ? null : spaceId(space),
  locationText,
  bookValue: value,
});

const items = new Coleccion<SimulatedItem>([
  item('AF-0101', 'Mesa quirúrgica electrohidráulica', 'Equipo médico', 'QX-01', null, '182000.00'),
  item('AF-0102', 'Máquina de anestesia', 'Equipo médico', 'QX-01', null, '245000.00'),
  item('AF-0103', 'Lámpara cialítica LED', 'Equipo médico', null, 'Quirófano 2 (planilla 2024)', '64000.00'),
  item('AF-0201', 'Autoclave de 250 litros', 'Equipo de esterilización', 'QX-EST', null, '138000.00'),
  item('AF-0301', 'Monitor multiparamétrico', 'Equipo médico', null, 'Piso 3, sala de internación', '28500.00'),
  item('AF-0302', 'Cama eléctrica de tres planos', 'Mobiliario clínico', '301-A', null, '19800.00'),
]);

const costCenters = new Coleccion<SimulatedCostCenter>([
  { id: uuid('cc-sanlucas-medint'), practiceId: PRACTICE_SANLUCAS, code: 'CC-110', name: 'Internación de medicina interna', clinicalUnitId: unitId('MEDINT') },
  { id: uuid('cc-sanlucas-qx'), practiceId: PRACTICE_SANLUCAS, code: 'CC-120', name: 'Bloque quirúrgico', clinicalUnitId: null },
  { id: uuid('cc-sanlucas-lab'), practiceId: PRACTICE_SANLUCAS, code: 'CC-130', name: 'Laboratorio clínico', clinicalUnitId: unitId('LAB') },
  { id: uuid('cc-sanlucas-adm'), practiceId: PRACTICE_SANLUCAS, code: 'CC-900', name: 'Administración general', clinicalUnitId: null },
]);

function itemView(i: SimulatedItem): InfrastructureItem {
  const space = i.careSpaceId === null ? undefined : espacios.get(i.careSpaceId);
  return {
    id: i.id,
    practiceId: i.practiceId,
    code: i.code,
    name: i.name,
    category: i.category,
    careSpace: space === undefined ? null : { id: space.id, code: space.code, name: space.name, path: [pathOf(space.id), space.name].filter(Boolean).join(' › ') },
    locationText: i.locationText,
    bookValue: i.bookValue,
    currencyCode: 'BOB',
  };
}

function costCenterView(c: SimulatedCostCenter): CostCenter {
  const unit = c.clinicalUnitId === null ? undefined : unidades.get(c.clinicalUnitId);
  return {
    id: c.id,
    practiceId: c.practiceId,
    code: c.code,
    name: c.name,
    clinicalUnit: unit === undefined ? null : { id: unit.id, name: unit.name },
    status: { code: 'STATE_ACTIVE', display: 'Vigente' },
  };
}

/** El centro de costo vigente de una unidad, para los cargos (F5e). */
export function costCenterOfUnit(clinicalUnitId: string | null): { id: string; name: string } | null {
  const c = clinicalUnitId === null ? undefined : costCenters.todos().find((x) => x.clinicalUnitId === clinicalUnitId);
  return c === undefined ? null : { id: c.id, name: `${c.code} · ${c.name}` };
}

function practiceVisible(request: MockRequest, practiceId: string | null): boolean {
  const owner = practiceId === null ? null : tenantDePractica(practiceId);
  const tenant = tenantOf(request);
  return owner !== null && (tenant === null || tenant === owner);
}

export function registerInfraAccounting(router: MockRouter): void {
  router.get('/accounting/infrastructure-items', (request) => {
    const practiceId = texto(request.query, 'practiceId');
    if (!practiceVisible(request, practiceId)) return notFoundReply();
    if (!hasRole(request, READ_ROLES)) return forbiddenReply('Su rol no consulta los activos.', READ_ROLES);
    return items.filtrar((i) => i.practiceId === practiceId).sort((a, b) => a.code.localeCompare(b.code)).map(itemView);
  });

  router.patch('/accounting/infrastructure-items/:id', (request) => {
    const i = items.get(request.params['id']!);
    if (i === undefined || !practiceVisible(request, i.practiceId)) return notFoundReply();
    if (!hasRole(request, WRITE_ROLES)) return forbiddenReply('Ubicar un activo es de contabilidad o de la administración.', WRITE_ROLES);
    const careSpaceId = (request.body as { careSpaceId?: string | null } | null)?.careSpaceId ?? null;
    if (careSpaceId !== null) {
      const space = espacios.get(careSpaceId);
      if (space === undefined || space.tenantId !== tenantDePractica(i.practiceId)) return notFoundReply();
      const site = SITIOS_INFRA.find((s) => s.id === space.siteId);
      if (site?.practiceId !== i.practiceId) return preconditionReply('INFRASTRUCTURE_SPACE_PRACTICE_MISMATCH', 'El espacio es de otra práctica que el activo.');
    }
    return itemView(items.actualizar(i.id, { careSpaceId })!);
  });

  router.get('/accounting/cost-centers', (request) => {
    const practiceId = texto(request.query, 'practiceId');
    if (!practiceVisible(request, practiceId)) return notFoundReply();
    if (!hasRole(request, READ_ROLES)) return forbiddenReply('Su rol no consulta los centros de costo.', READ_ROLES);
    return costCenters.filtrar((c) => c.practiceId === practiceId).sort((a, b) => a.code.localeCompare(b.code)).map(costCenterView);
  });

  router.post('/accounting/cost-centers/:id/unit-link', (request) => {
    const c = costCenters.get(request.params['id']!);
    if (c === undefined || !practiceVisible(request, c.practiceId)) return notFoundReply();
    if (!hasRole(request, WRITE_ROLES)) return forbiddenReply('Ligar centros de costo es de contabilidad o de la administración.', WRITE_ROLES);
    const clinicalUnitId = (request.body as { clinicalUnitId?: string } | null)?.clinicalUnitId;
    const unit = clinicalUnitId === undefined ? undefined : unidades.get(clinicalUnitId);
    if (unit === undefined || unit.tenantId !== tenantDePractica(c.practiceId)) return notFoundReply();
    const holder = costCenters.todos().find((x) => x.id !== c.id && x.clinicalUnitId === unit.id);
    if (holder !== undefined) return conflictReply('UNIT_ALREADY_HAS_COST_CENTER', `«${unit.name}» ya tiene el centro de costo ${holder.code}.`, { costCenterId: holder.id });
    return costCenterView(costCenters.actualizar(c.id, { clinicalUnitId: unit.id })!);
  });
}

items.persistirEn('mock.accounting.infrastructureItems');
costCenters.persistirEn('mock.accounting.costCenters');

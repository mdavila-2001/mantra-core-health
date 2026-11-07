import type { BranchCategory } from '../../data-access/directory/branch-category';
import { STATUS } from '../fixtures/concepts';
import { conflict, type MockReply } from '../mock-router';
import {
  TENANT_CLINICA,
  TENANT_FARMACIA,
  TENANT_HOSPITAL,
  TENANT_HOSPITAL_PILOTO,
  TENANT_IMAGEN_SUR,
  TENANT_LABORATORIO,
} from '../mock-session';
import { ahora, Coleccion, iso, nuevoId, uuid } from '../mock-store';

/* ============================================================================
    Simulator branches (`GET/POST/PATCH /tenants/:id/branches` in
    `directory.handlers.ts`), split out on 2026-11-06 when the category
    (head office, branch, default; API v4.2.91) was added.
    ========================================================================== */

export const BRANCH_TYPE = {
  CLINIC: uuid('concept-branch-clinic'),
  OFFICE: uuid('concept-branch-office'),
} as const;

export const branchRows = new Coleccion<{
  id: string;
  tenantId: string;
  code: string;
  name: string;
  branchTypeConceptId: string;
  statusConceptId: string;
  timeZone: string;
  createdAt: string;
  // Lo que la carga masiva de sucursales suma (P54). Opcionales: las
  // sembradas no los traen.
  latitude?: number;
  longitude?: number;
  description?: string;
  locationUrl?: string;
  /** v4.2.91: `default` unless stated; at most one `head_office` per tenant. */
  category: BranchCategory;
}>([
  {
    id: uuid('branch-olivos-central'),
    category: 'head_office',
    tenantId: TENANT_CLINICA,
    code: 'CENTRAL',
    name: 'Sede Central',
    branchTypeConceptId: BRANCH_TYPE.CLINIC,
    statusConceptId: STATUS['ST-ACTIVE']!,
    timeZone: 'America/La_Paz',
    createdAt: iso(-900),
  },
  {
    id: uuid('branch-olivos-equipetrol'),
    category: 'branch',
    tenantId: TENANT_CLINICA,
    code: 'EQUIP',
    name: 'Consultorios Equipetrol',
    branchTypeConceptId: BRANCH_TYPE.OFFICE,
    statusConceptId: STATUS['ST-ACTIVE']!,
    timeZone: 'America/La_Paz',
    createdAt: iso(-400),
  },
  {
    id: uuid('branch-sanlucas-central'),
    category: 'head_office',
    tenantId: TENANT_HOSPITAL,
    code: 'CENTRAL',
    name: 'Hospital central',
    latitude: -17.7834,
    longitude: -63.1812,
    branchTypeConceptId: BRANCH_TYPE.CLINIC,
    statusConceptId: STATUS['ST-ACTIVE']!,
    timeZone: 'America/La_Paz',
    createdAt: iso(-800),
  },
  {
    id: uuid('branch-sanlucas-norte'),
    category: 'branch',
    tenantId: TENANT_HOSPITAL,
    code: 'NORTE',
    name: 'Anexo Norte',
    latitude: -17.7512,
    longitude: -63.1702,
    branchTypeConceptId: BRANCH_TYPE.CLINIC,
    statusConceptId: STATUS['ST-ACTIVE']!,
    timeZone: 'America/La_Paz',
    createdAt: iso(-300),
  },
  // Laboratorio Central: su sede principal, la misma que publica la vitrina
  // (Calle Sucre N.º 210). Antes «Sucursales» del laboratorio no tenía ni una.
  {
    id: uuid('branch-laboratorio-central-principal'),
    category: 'head_office',
    tenantId: TENANT_LABORATORIO,
    code: 'PRINCIPAL',
    name: 'Sede principal',
    branchTypeConceptId: BRANCH_TYPE.OFFICE,
    statusConceptId: STATUS['ST-ACTIVE']!,
    timeZone: 'America/La_Paz',
    createdAt: iso(-900),
    description: 'Toma de muestras y laboratorio · Calle Sucre N.º 210',
    latitude: -17.784,
    longitude: -63.1815,
    locationUrl: 'https://www.openstreetmap.org/?mlat=-17.784&mlon=-63.1815#map=17/-17.784/-63.1815',
  },
  // Imaging center and pilot hospital (2026-11-06): sites with their point so
  // the imaging and medical organization Branches screens show the map and
  // all three labels.
  ...(
    [
      [TENANT_IMAGEN_SUR, 'imagen-sur-matriz', 'MATRIZ', 'Casa matriz', 'Av. Santos Dumont, 3er anillo', -17.8105, -63.1748, 'head_office'],
      [TENANT_HOSPITAL_PILOTO, 'piloto-matriz', 'MATRIZ', 'Hospital piloto · casa matriz', 'Av. Cañoto y Calle Ayacucho', -17.7856, -63.1873, 'head_office'],
      [TENANT_HOSPITAL_PILOTO, 'piloto-norte', 'NORTE', 'Policonsultorio Norte', 'Av. Banzer, 4to anillo', -17.7539, -63.1773, 'branch'],
      [TENANT_HOSPITAL_PILOTO, 'piloto-urubo', 'URUBO', 'Consultorio Urubó', 'Urubó, frente a la plaza', -17.7617, -63.2265, 'default'],
    ] as const
  ).map(([tenantId, key, code, name, description, latitude, longitude, category]) => ({
    id: uuid(`branch-${key}`),
    tenantId,
    category: category as BranchCategory,
    code,
    name,
    branchTypeConceptId: BRANCH_TYPE.CLINIC,
    statusConceptId: STATUS['ST-ACTIVE']!,
    timeZone: 'America/La_Paz',
    createdAt: iso(-300),
    description,
    latitude,
    longitude,
  })),
  // A branch saved by link before the API could read short links: it has the link and no point.
  {
    id: uuid('branch-piloto-legada'),
    tenantId: TENANT_HOSPITAL_PILOTO,
    category: 'branch' as BranchCategory,
    code: 'LEGADA',
    name: 'Sede heredada',
    branchTypeConceptId: BRANCH_TYPE.CLINIC,
    statusConceptId: STATUS['ST-ACTIVE']!,
    timeZone: 'America/La_Paz',
    createdAt: iso(-200),
    description: 'Cargada con un enlace corto de Google Maps',
    locationUrl: 'https://maps.app.goo.gl/uwjxPfc6SYBhtQ3e7',
  },
  // Farmacia Vida: las mismas tres sedes que ofrece la bandeja del mostrador
  // («Sede») en `pharmacy.handlers`. Antes «Sucursales» decía «Todavía no
  // cargaste sucursales» mientras la bandeja ya repartía pedidos entre tres.
  ...(
    [
      ['central', 'CENTRAL', 'Sucursal Central', 'Casa matriz · Av. Alemana N.º 2100', -17.769, -63.165, -700],
      ['equipetrol', 'EQ', 'Sucursal Equipetrol', 'Av. San Martín, Equipetrol', -17.76, -63.199, -420],
      ['plan3000', 'P3', 'Sucursal Plan 3000', 'Av. Paraguá, Plan 3000', -17.814, -63.137, -210],
    ] as const
  ).map(([key, code, name, description, latitude, longitude, days]) => ({
    id: uuid(`branch-farmacia-vida-${key}`),
    tenantId: TENANT_FARMACIA,
    // Central is the head office; Plan 3000 stays unclassified so the demo
    // shows all three labels.
    category: (key === 'central' ? 'head_office' : key === 'plan3000' ? 'default' : 'branch') as BranchCategory,
    code,
    name,
    branchTypeConceptId: BRANCH_TYPE.OFFICE,
    statusConceptId: STATUS['ST-ACTIVE']!,
    timeZone: 'America/La_Paz',
    createdAt: iso(days),
    description,
    latitude,
    longitude,
    locationUrl: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`,
  })),
]);

/**
 * Suma las sucursales que una farmacia declaró en su alta pública, para que
 * «Sucursales» las muestre al entrar: el alta las pide (3.1, «ubicación GPS de
 * cada sucursal») y perderlas obligaba a cargarlas dos veces. Una que ya
 * existe con el mismo nombre no se repite.
 */
export function addRegistrationBranches(
  tenantId: string,
  declaradas: readonly {
    readonly name: string;
    readonly description?: string;
    readonly latitude?: number;
    readonly longitude?: number;
    readonly locationUrl?: string;
  }[],
): void {
  for (const d of declaradas) {
    const existing = branchRows.filtrar((s) => s.tenantId === tenantId);
    if (existing.some((s) => s.name === d.name)) continue;
    const base = d.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const used = new Set(existing.map((s) => s.code));
    const root = base === '' ? 'SUC' : base;
    let code = root;
    for (let n = 2; used.has(code); n++) code = `${root}-${n}`;
    branchRows.agregar({
      id: nuevoId('branch'),
      tenantId,
      code,
      name: d.name,
      branchTypeConceptId: BRANCH_TYPE.OFFICE,
      statusConceptId: STATUS['ST-ACTIVE']!,
      timeZone: 'America/La_Paz',
      createdAt: ahora(),
      category: 'branch',
      ...(d.latitude === undefined ? {} : { latitude: d.latitude }),
      ...(d.longitude === undefined ? {} : { longitude: d.longitude }),
      ...(d.description === undefined ? {} : { description: d.description }),
      ...(d.locationUrl === undefined ? {} : { locationUrl: d.locationUrl }),
    });
  }
}

/** Las sucursales activas de una organización, como las carga «Sucursales». */
export function activeTenantBranches(tenantId: string) {
  return branchRows.filtrar(
    (s) => s.tenantId === tenantId && s.statusConceptId === STATUS['ST-ACTIVE'],
  );
}

/**
 * The API's 409 (`DirectoryBranchesService`, v4.2.91) when a site wants to be
 * the head office and the organization already has one; `null` if allowed.
 *
 * @param tenantBranches - The organization's sites.
 * @param category - Requested category.
 * @param ownId - Site being edited (may stay head office); `null` on create.
 */
export function headOfficeTaken(
  tenantBranches: readonly { readonly id: string; readonly name: string; readonly category: BranchCategory }[],
  category: BranchCategory,
  ownId: string | null,
): MockReply | null {
  if (category !== 'head_office') return null;
  const current = tenantBranches.find((b) => b.category === 'head_office' && b.id !== ownId);
  return current === undefined
    ? null
    : conflict(
        'La organización ya tiene una casa matriz. Cambie primero la categoría de la actual.',
        { headOfficeBranchId: current.id, headOfficeName: current.name },
      );
}

branchRows.persistirEn('mock.directory.sucursales');

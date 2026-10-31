import { aeTitleProblem, type LocatedEquipment } from '../../data-access/diagnostic-units/equipment-location.types';
import type { InventoryLocation } from '../../data-access/pharmacy/inventory-locations.types';
import { FUNCIONES, SITIOS_INFRA } from '../fixtures/infraestructura';
import type { MockRequest, MockRouter } from '../mock-router';
import { Coleccion, cuerpo, nuevoId, uuid } from '../mock-store';
import { espacios, unidades } from './infrastructure.handlers';
import { conflictReply, forbiddenReply, hasRole, notFoundReply, pathOf, preconditionReply, tenantOf } from './operating-rooms.state';

/* ============================================================================
    Integración F5a (equipo en sala, AE Title) y F5c (botiquín por unidad) en la
    maqueta. Equipos y ubicaciones cuelgan de los espacios de F1, así que el
    tenant, la sede y el perfil de función salen del árbol real del simulador.
    ========================================================================== */

const ADMIN_ROLES = ['SECURITY_ADMIN'] as const;
const PHARMACY_ROLES = ['PHARMACY_STAFF', 'SECURITY_ADMIN'] as const;
const SAN_LUCAS = SITIOS_INFRA[0]!;
const space = (code: string) => espacios.todos().find((e) => e.siteId === SAN_LUCAS.id && e.code === code);
const profileOf = (functionCode: string) => FUNCIONES.find((f) => f.code === functionCode);

/* ---- F5a · equipos --------------------------------------------------------------- */

interface SimulatedEquipment {
  readonly id: string;
  readonly tenantId: string;
  readonly siteId: string;
  readonly typeCode: string;
  readonly typeDisplay: string;
  readonly manufacturer: string;
  readonly model: string;
  readonly serialNumber: string;
  readonly modalityCode: string | null;
  readonly statusCode: 'DU_EQ_OPERATIONAL' | 'DU_EQ_MAINTENANCE';
  readonly careSpaceId: string | null;
  readonly aeTitle: string | null;
  readonly stationName: string | null;
  readonly schedulableResourceId: string | null;
}

const MODALITIES: Readonly<Record<string, string>> = { CT: 'Tomografía computada', DX: 'Radiografía digital', US: 'Ecografía' };

function equipmentSeeds(): SimulatedEquipment[] {
  const base = { tenantId: SAN_LUCAS.tenantId, siteId: SAN_LUCAS.id, statusCode: 'DU_EQ_OPERATIONAL' as const };
  return [
    { ...base, id: uuid('equipment-sanlucas-ct'), typeCode: 'EQ_CT', typeDisplay: 'Tomógrafo multicorte', manufacturer: 'Siemens', model: 'Somatom go.Up 64', serialNumber: 'SLC-CT-4471', modalityCode: 'CT', careSpaceId: space('IMG-TC')?.id ?? null, aeTitle: 'SLTC64', stationName: 'TC-PB', schedulableResourceId: uuid('res-equipment-sanlucas-ct') },
    { ...base, id: uuid('equipment-sanlucas-dx'), typeCode: 'EQ_DX', typeDisplay: 'Equipo de rayos X digital', manufacturer: 'Fujifilm', model: 'FDR Smart X', serialNumber: 'SLC-DX-0932', modalityCode: 'DX', careSpaceId: space('IMG-RX')?.id ?? null, aeTitle: 'SLRX01', stationName: 'RX-PB', schedulableResourceId: null },
    { ...base, id: uuid('equipment-sanlucas-us'), typeCode: 'EQ_US', typeDisplay: 'Ecógrafo', manufacturer: 'GE', model: 'Logiq E10', serialNumber: 'SLC-US-1180', modalityCode: 'US', careSpaceId: null, aeTitle: null, stationName: null, schedulableResourceId: null },
    { ...base, id: uuid('equipment-sanlucas-lab'), typeCode: 'EQ_ANALYZER', typeDisplay: 'Analizador de química clínica', manufacturer: 'Roche', model: 'cobas c 311', serialNumber: 'SLC-LB-2201', modalityCode: null, careSpaceId: space('LAB-AN')?.id ?? null, aeTitle: null, stationName: null, schedulableResourceId: null },
  ];
}

const equipment = new Coleccion<SimulatedEquipment>(equipmentSeeds());

function equipmentView(e: SimulatedEquipment): LocatedEquipment {
  const room = e.careSpaceId === null ? undefined : espacios.get(e.careSpaceId);
  return {
    id: e.id,
    siteId: e.siteId,
    diagnosticUnitSiteName: 'Imagenología y laboratorio · San Lucas',
    type: { code: e.typeCode, display: e.typeDisplay },
    manufacturer: e.manufacturer,
    model: e.model,
    serialNumber: e.serialNumber,
    modality: e.modalityCode === null ? null : { code: e.modalityCode, display: MODALITIES[e.modalityCode] ?? e.modalityCode },
    operationalStatus: e.statusCode === 'DU_EQ_OPERATIONAL' ? { code: e.statusCode, display: 'Operativo' } : { code: e.statusCode, display: 'En mantenimiento' },
    careSpace: room === undefined ? null : { id: room.id, code: room.code, name: room.name, path: [pathOf(room.id), room.name].filter(Boolean).join(' › ') },
    aeTitle: e.aeTitle,
    stationName: e.stationName,
    schedulableResourceId: e.schedulableResourceId,
  };
}

const sameTenant = (request: MockRequest, tenantId: string): boolean => {
  const t = tenantOf(request);
  return t === null || t === tenantId;
};

function visibleEquipment(request: MockRequest): SimulatedEquipment | null {
  const e = equipment.get(request.params['id']!);
  return e === undefined || !sameTenant(request, e.tenantId) ? null : e;
}

function updateEquipment(request: MockRequest) {
  const e = visibleEquipment(request);
  if (e === null) return notFoundReply();
  if (!hasRole(request, ADMIN_ROLES)) return forbiddenReply('Ubicar un equipo es de la administración de la organización.', ADMIN_ROLES);
  const body = cuerpo<{ careSpaceId: string | null; aeTitle: string | null; stationName: string | null }>(request);
  const changes: { -readonly [K in keyof SimulatedEquipment]?: SimulatedEquipment[K] } = {};
  if (body.careSpaceId !== undefined) {
    if (body.careSpaceId !== null) {
      const room = espacios.get(body.careSpaceId);
      if (room === undefined || room.tenantId !== e.tenantId || !sameTenant(request, room.tenantId)) return notFoundReply();
      if (room.siteId !== e.siteId) return preconditionReply('EQUIPMENT_SPACE_SITE_MISMATCH', 'La sala es de otra sede que la sucursal del equipo.');
      const profile = profileOf(room.functionCode);
      const needsImaging = e.modalityCode !== null && room.functionCode !== 'SPACE_FN_IMAGING_ROOM';
      if (profile?.hostsEquipment !== true || needsImaging) {
        return preconditionReply('SPACE_CANNOT_HOST_EQUIPMENT', needsImaging ? 'Un equipo de imagen va en una sala de imagenología.' : `«${room.name}» no aloja equipos.`);
      }
    }
    changes.careSpaceId = body.careSpaceId;
  }
  if (body.aeTitle !== undefined) {
    const value = body.aeTitle === null ? null : body.aeTitle;
    const problem = value === null ? null : aeTitleProblem(value);
    if (problem !== null) return preconditionReply('AE_TITLE_INVALID', problem);
    const taken = value !== null && equipment.todos().some((o) => o.id !== e.id && o.siteId === e.siteId && o.aeTitle === value);
    if (taken) return conflictReply('AE_TITLE_TAKEN', `El AE Title «${value}» ya lo usa otro equipo de la sede.`);
    changes.aeTitle = value === '' ? null : value;
  }
  if (body.stationName !== undefined) {
    if (body.stationName !== null && body.stationName.length > 16) return preconditionReply('STATION_NAME_INVALID', 'El nombre de estación admite hasta 16 caracteres.');
    changes.stationName = body.stationName === '' ? null : body.stationName;
  }
  return equipmentView(equipment.actualizar(e.id, changes)!);
}

/* ---- F5c · botiquín por unidad --------------------------------------------------- */

interface SimulatedLocation {
  readonly id: string;
  readonly tenantId: string;
  readonly pharmacySiteId: string;
  readonly code: string;
  readonly name: string;
  readonly typeCode: 'WARD_STOCK' | 'SHELF';
  readonly careSpaceId: string | null;
  readonly clinicalUnitId: string | null;
  readonly lines: InventoryLocation['lines'];
}

const PHARMACY_SITE = { id: uuid('pharmacy-site-sanlucas'), name: 'Farmacia central · San Lucas' };

const line = (productName: string, lot: string, expiry: string, onHand: string, available: string, unit: string) => ({ productName, lotNumber: lot, expiryDate: expiry, onHandQuantity: onHand, availableQuantity: available, unit });

function locationSeeds(): SimulatedLocation[] {
  const base = { tenantId: SAN_LUCAS.tenantId, pharmacySiteId: PHARMACY_SITE.id };
  const bot = space('A-PN-P3-BOT');
  const far = space('FAR');
  const dep = space('DEP');
  return [
    ...(bot === undefined ? [] : [{ ...base, id: uuid('inv-loc-bot-p3'), code: 'BOT-P3', name: 'Botiquín de Medicina interna (piso 3)', typeCode: 'WARD_STOCK' as const, careSpaceId: bot.id, clinicalUnitId: unidades.todos().find((u) => u.siteId === SAN_LUCAS.id && u.code === 'MEDINT')?.id ?? null, lines: [line('Paracetamol 500 mg comprimido', 'L2611', '2027-08-31', '120', '96', 'comprimido'), line('Cloruro de sodio 0,9 % 500 ml', 'S0912', '2027-02-28', '24', '24', 'frasco'), line('Ketorolaco 30 mg/ml ampolla', 'K3301', '2026-12-31', '18', '10', 'ampolla')] }]),
    ...(far === undefined ? [] : [{ ...base, id: uuid('inv-loc-far'), code: 'FAR-EST', name: 'Estantería de farmacia central', typeCode: 'SHELF' as const, careSpaceId: far.id, clinicalUnitId: null, lines: [line('Amoxicilina 500 mg cápsula', 'A5502', '2027-05-31', '600', '540', 'cápsula')] }]),
    ...(dep === undefined ? [] : [{ ...base, id: uuid('inv-loc-dep'), code: 'DEP-GEN', name: 'Depósito general', typeCode: 'SHELF' as const, careSpaceId: dep.id, clinicalUnitId: null, lines: [line('Guantes de examen talla M', 'G1100', '2029-01-31', '40', '40', 'caja')] }]),
  ];
}

const locations = new Coleccion<SimulatedLocation>(locationSeeds());

function locationView(l: SimulatedLocation): InventoryLocation {
  const room = l.careSpaceId === null ? undefined : espacios.get(l.careSpaceId);
  const unit = l.clinicalUnitId === null ? undefined : unidades.get(l.clinicalUnitId);
  return {
    id: l.id,
    pharmacySiteId: l.pharmacySiteId,
    code: l.code,
    name: l.name,
    locationType: l.typeCode === 'WARD_STOCK' ? { code: 'WARD_STOCK', display: 'Botiquín de unidad' } : { code: 'SHELF', display: 'Estantería' },
    careSpace: room === undefined ? null : { id: room.id, code: room.code, name: room.name },
    clinicalUnit: unit === undefined ? null : { id: unit.id, name: unit.name },
    status: { code: 'LOCATION_ACTIVE', display: 'Activa' },
    lines: l.lines,
  };
}

function checkStockPoint(request: MockRequest, careSpaceId: string, tenantId: string) {
  const room = espacios.get(careSpaceId);
  if (room === undefined || room.tenantId !== tenantId || !sameTenant(request, room.tenantId)) return notFoundReply();
  if (room.siteId !== SAN_LUCAS.id) return preconditionReply('STOCK_POINT_SITE_MISMATCH', 'El espacio es de otra sede que la farmacia.');
  if (profileOf(room.functionCode)?.stockPoint !== true) return preconditionReply('SPACE_NOT_STOCK_POINT', `«${room.name}» no es un punto de stock.`);
  return null;
}

/* ---- rutas ----------------------------------------------------------------------- */

export function registerInfraF5Ops(router: MockRouter): void {
  router.get('/sites/:siteId/diagnostic-equipment', (request) => {
    const site = SITIOS_INFRA.find((s) => s.id === request.params['siteId']);
    if (site === undefined || !sameTenant(request, site.tenantId)) return notFoundReply();
    return equipment.filtrar((e) => e.siteId === site.id).map(equipmentView);
  });

  router.get('/care-spaces/:id/equipment', (request) => {
    const room = espacios.get(request.params['id']!);
    if (room === undefined || !sameTenant(request, room.tenantId)) return notFoundReply();
    return equipment.filtrar((e) => e.careSpaceId === room.id).map(equipmentView);
  });

  router.get('/diagnostic-equipment/:id', (request) => {
    const e = visibleEquipment(request);
    return e === null ? notFoundReply() : equipmentView(e);
  });

  router.patch('/diagnostic-equipment/:id', updateEquipment);

  router.post('/diagnostic-equipment/:id/resource', (request) => {
    const e = visibleEquipment(request);
    if (e === null) return notFoundReply();
    if (!hasRole(request, ADMIN_ROLES)) return forbiddenReply('Crear el recurso agendable es de la administración.', ADMIN_ROLES);
    if (e.schedulableResourceId !== null) return conflictReply('RESOURCE_ALREADY_EXISTS_FOR_EQUIPMENT', 'El equipo ya tiene su recurso agendable.');
    const updated = equipment.actualizar(e.id, { schedulableResourceId: nuevoId('res-equipment') })!;
    return { status: 201, body: { resourceId: updated.schedulableResourceId } };
  });

  router.get('/diagnostic-equipment/:id/mwl-station', (request) => {
    const e = visibleEquipment(request);
    if (e === null) return notFoundReply();
    const room = e.careSpaceId === null ? undefined : espacios.get(e.careSpaceId);
    return { scheduledStationAETitle: e.aeTitle, scheduledStationName: e.stationName, spsLocation: room?.code ?? null };
  });

  router.get('/care-spaces/:id/stock', (request) => {
    const room = espacios.get(request.params['id']!);
    if (room === undefined || !sameTenant(request, room.tenantId)) return notFoundReply();
    return {
      pharmacySites: room.siteId === SAN_LUCAS.id ? [PHARMACY_SITE] : [],
      locations: locations.filtrar((l) => l.careSpaceId === room.id).map(locationView),
    };
  });

  router.post('/pharmacy/:siteId/inventory-locations', (request) => {
    if (request.params['siteId'] !== PHARMACY_SITE.id) return notFoundReply();
    if (!sameTenant(request, SAN_LUCAS.tenantId)) return notFoundReply();
    if (!hasRole(request, PHARMACY_ROLES)) return forbiddenReply('Las ubicaciones de inventario las administra Farmacia.', PHARMACY_ROLES);
    const body = cuerpo<{ code: string; name: string; locationTypeCode: 'WARD_STOCK' | 'SHELF'; careSpaceId: string; clinicalUnitId: string }>(request);
    if (body.careSpaceId !== undefined) {
      const problem = checkStockPoint(request, body.careSpaceId, SAN_LUCAS.tenantId);
      if (problem !== null) return problem;
    }
    const type = body.locationTypeCode === 'WARD_STOCK' ? 'WARD_STOCK' : 'SHELF';
    const unitId = body.clinicalUnitId ?? (body.careSpaceId === undefined ? null : espacios.get(body.careSpaceId)?.clinicalUnitId ?? null);
    if (type === 'WARD_STOCK') {
      if (unitId === null) return preconditionReply('WARD_STOCK_UNIT_REQUIRED', 'Un botiquín de unidad necesita su unidad.');
      if (locations.todos().some((l) => l.typeCode === 'WARD_STOCK' && l.clinicalUnitId === unitId)) {
        return conflictReply('WARD_STOCK_ALREADY_EXISTS', 'Esa unidad ya tiene su botiquín: reubíquelo en vez de crear otro.');
      }
    }
    if (!body.code?.trim() || !body.name?.trim()) return preconditionReply('LOCATION_INVALID', 'Indique código y nombre.');
    const created = locations.agregar({ id: nuevoId('inv-loc'), tenantId: SAN_LUCAS.tenantId, pharmacySiteId: PHARMACY_SITE.id, code: body.code.trim(), name: body.name.trim(), typeCode: type, careSpaceId: body.careSpaceId ?? null, clinicalUnitId: unitId, lines: [] });
    return { status: 201, body: locationView(created) };
  });

  router.post('/pharmacy/inventory-locations/:id/relocate', (request) => {
    const l = locations.get(request.params['id']!);
    if (l === undefined || !sameTenant(request, l.tenantId)) return notFoundReply();
    if (!hasRole(request, PHARMACY_ROLES)) return forbiddenReply('Reubicar el stock es de Farmacia.', PHARMACY_ROLES);
    const target = (request.body as { careSpaceId?: string } | null)?.careSpaceId;
    if (target === undefined) return preconditionReply('LOCATION_TARGET_REQUIRED', 'Indique el espacio de destino.');
    const problem = checkStockPoint(request, target, l.tenantId);
    if (problem !== null) return problem;
    return locationView(locations.actualizar(l.id, { careSpaceId: target })!);
  });
}

/* Sobreviven a F5 dentro de la pestaña: la cadena UI → recarga → UI. */
equipment.persistirEn('mock.infra.equipment');
locations.persistirEn('mock.infra.inventoryLocations');

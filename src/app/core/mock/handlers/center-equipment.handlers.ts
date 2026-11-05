import { validarHorario } from '../../data-access/diagnostic-units/center-schedule.rules';
import type {
  CenterSchedule,
  CenterScheduleView,
  EquipmentChanges,
  EquipmentStatus,
  NewEquipment,
  ScheduleBlock,
} from '../../data-access/diagnostic-units/center-schedule.types';
import { deviceDetails, estadosDeEquipos, registeredDevices, turnosDeOrdenes } from '../fixtures/centros';
import { conflict, forbidden, notFound, reply, unprocessable, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, cuerpo, nuevoId } from '../mock-store';
import { assignmentsOf, bookingsOutsideSchedule, devicesOf, EQUIPMENT_TYPES } from './center-devices.mock';
import { UNIDADES, type UnidadSimulada } from './diagnostics.handlers';

/* ============================================================================
    The center's own inventory, mirroring the API (mantra-core-health-api#1342):

      GET    /diagnostic-units/me/equipment-types
      POST   /diagnostic-units/:unitId/equipment
      PATCH  /diagnostic-units/:unitId/equipment/:equipmentId
      DELETE /diagnostic-units/:unitId/equipment/:equipmentId
      PUT    /diagnostic-units/:unitId/equipment/:equipmentId/schedule

    Every write answers with the center's whole view, like the API.
    ========================================================================== */

export interface CenterEquipmentDeps {
  readonly view: (u: UnidadSimulada) => CenterScheduleView;
  readonly scheduleOf: (u: UnidadSimulada) => CenterSchedule;
}

const STATUSES: readonly EquipmentStatus[] = ['OPERATIONAL', 'MAINTENANCE', 'OUT_OF_SERVICE'];

const clean = (value: string | null | undefined): string | null => (value?.trim() ? value.trim() : null);

/** The unit of the path, if the session belongs to it; the error reply otherwise. */
function staffUnit(request: MockRequest): UnidadSimulada | { readonly error: ReturnType<typeof notFound> } {
  const u = UNIDADES.find((x) => x.id === request.params['unitId']);
  if (u === undefined) return { error: notFound('Centro no encontrado') };
  const user = request.user;
  const staff = user !== undefined && user !== null && (user.key === 'superadmin' || user.tenants.includes(u.tenantId));
  return staff ? u : { error: forbidden('Sólo el personal del centro cambia sus equipos.') };
}

/** A serial already used by another device of the center. */
function serialTaken(u: UnidadSimulada, serial: string | null, exceptId?: string): boolean {
  return serial !== null && devicesOf(u).some((d) => d.id !== exceptId && d.serialNumber === serial);
}

export function registerCenterEquipment(router: MockRouter, deps: CenterEquipmentDeps): void {
  router.get('/diagnostic-units/me/equipment-types', () => ({ items: EQUIPMENT_TYPES }));

  router.post('/diagnostic-units/:unitId/equipment', (request) => {
    const u = staffUnit(request);
    if ('error' in u) return u.error;
    const body = cuerpo<Partial<NewEquipment>>(request);
    if (!EQUIPMENT_TYPES.some((t) => t.code === body.typeCode)) return unprocessable('Elija un tipo de equipo del catálogo.');
    const serial = clean(body.serialNumber);
    if (serialTaken(u, serial)) return conflict('Ya existe un equipo con ese número de serie en la sede.', { serialNumber: serial });
    registeredDevices.agregar({
      id: nuevoId('equipment'),
      unitId: u.id,
      typeCode: body.typeCode!,
      manufacturer: clean(body.manufacturer),
      model: clean(body.model),
      serialNumber: serial,
      createdAt: ahora(),
    });
    return reply(201, deps.view(u));
  });

  router.patch('/diagnostic-units/:unitId/equipment/:equipmentId', (request) => {
    const u = staffUnit(request);
    if ('error' in u) return u.error;
    const device = devicesOf(u).find((d) => d.id === request.params['equipmentId']);
    if (device === undefined) return notFound('Equipo no encontrado');
    const changes = cuerpo<EquipmentChanges>(request);
    if (changes.status !== undefined && !STATUSES.includes(changes.status)) {
      return unprocessable('Elija un estado: operativo, en mantenimiento o fuera de servicio.');
    }
    const serial = changes.serialNumber === undefined ? undefined : clean(changes.serialNumber);
    if (serial !== undefined && serialTaken(u, serial, device.id)) {
      return conflict('Ya existe un equipo con ese número de serie en la sede.', { serialNumber: serial });
    }
    if (changes.status !== undefined) estadosDeEquipos.agregar({ id: device.id, status: changes.status, updatedAt: ahora() });
    deviceDetails.agregar({
      ...deviceDetails.get(device.id),
      id: device.id,
      ...(changes.manufacturer !== undefined ? { manufacturer: clean(changes.manufacturer) } : {}),
      ...(changes.model !== undefined ? { model: clean(changes.model) } : {}),
      ...(serial !== undefined ? { serialNumber: serial } : {}),
      updatedAt: ahora(),
    });
    return deps.view(u);
  });

  router.delete('/diagnostic-units/:unitId/equipment/:equipmentId', (request) => {
    const u = staffUnit(request);
    if ('error' in u) return u.error;
    const device = devicesOf(u).find((d) => d.id === request.params['equipmentId']);
    if (device === undefined) return notFound('Equipo no encontrado');
    const assigned = assignmentsOf(u, deps.scheduleOf(u));
    if (turnosDeOrdenes.filtrar((t) => t.equipmentId === device.id || assigned.get(t.id) === device.id).length > 0) {
      return conflict('Este equipo ya atendió turnos y conserva su historia: márquelo fuera de servicio.', { equipmentId: device.id });
    }
    deviceDetails.agregar({ ...deviceDetails.get(device.id), id: device.id, removed: true, updatedAt: ahora() });
    return deps.view(u);
  });

  router.put('/diagnostic-units/:unitId/equipment/:equipmentId/schedule', (request) => {
    const u = staffUnit(request);
    if ('error' in u) return u.error;
    const device = devicesOf(u).find((d) => d.id === request.params['equipmentId']);
    if (device === undefined) return notFound('Equipo no encontrado');
    if (device.modalityCode === null) return unprocessable('Este equipo no da turnos: no tiene horario propio.');
    const block = cuerpo<{ schedule?: ScheduleBlock | null }>(request).schedule ?? null;
    if (block !== null) {
      const problems = validarHorario({ general: block, modalities: [], studies: [] }, () => device.name);
      if (problems.length > 0) {
        return unprocessable('El horario tiene datos incompletos.', problems.map((p) => ({ field: device.id, problem: p.mensaje })));
      }
    }
    // Who attends each slot is fixed before the change, like the API adopts first.
    const assigned = assignmentsOf(u, deps.scheduleOf(u));
    const before = deviceDetails.get(device.id);
    deviceDetails.agregar({ ...before, id: device.id, schedule: block, updatedAt: ahora() });
    const outside = bookingsOutsideSchedule(u, deps.scheduleOf(u), device.id, assigned);
    if (outside > 0) {
      deviceDetails.agregar({ ...before, id: device.id, schedule: before?.schedule ?? null, updatedAt: before?.updatedAt ?? ahora() });
      return conflict(
        outside === 1
          ? 'Hay 1 turno reservado en este equipo que quedaría fuera del horario nuevo.'
          : `Hay ${outside} turnos reservados en este equipo que quedarían fuera del horario nuevo.`,
        { affectedBookings: outside },
      );
    }
    return deps.view(u);
  });
}

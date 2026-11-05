import { HttpHeaders } from '@angular/common/http';
import { beforeEach, describe, expect, it } from 'vitest';

import { horarioDeSemana } from '../../data-access/diagnostic-units/center-schedule.rules';
import type { CenterScheduleView, EquipmentType, StudyAvailability } from '../../data-access/diagnostic-units/center-schedule.types';
import { deviceDetails, estadosDeEquipos, horariosDeCentros, registeredDevices, turnosDeOrdenes } from '../fixtures/centros';
import { orderList } from '../fixtures/clinic';
import { ESTUDIO } from '../fixtures/concepts';
import { PACIENTE } from '../fixtures/people';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { uuid } from '../mock-store';
import { registrarCentros } from './centros.handlers';
import { registrarDiagnostico } from './diagnostics.handlers';

describe('simulator: the center inventory and each device as a production line', () => {
  const router = new MockRouter();
  registrarDiagnostico(router);
  registrarCentros(router);

  const staff = buscarUsuario('imagen@alovida.mock')!;
  const patient = buscarUsuario('paciente')!;
  const UNIT = uuid('unit-imagen-sur');
  const base = `/diagnostic-units/${UNIT}`;

  function call<T = unknown>(method: MockMethod, path: string, who = staff, body: unknown = {}, query = new URLSearchParams()): { status: number; body: T } {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No route ${method} ${path}`);
    const result = match.handler({ method, path, params: match.params, query, body, headers: new HttpHeaders(), user: who });
    if (result !== null && typeof result === 'object' && 'status' in result && 'body' in result) return result as { status: number; body: T };
    return { status: 200, body: result as T };
  }

  const view = (): CenterScheduleView => call<CenterScheduleView>('GET', `${base}/schedule`).body;
  const availability = (studyCode: string): StudyAvailability => {
    const query = new URLSearchParams({ studyCode, from: new Date().toISOString(), to: new Date(Date.now() + 14 * 86_400_000).toISOString() });
    return call<StudyAvailability>('GET', `${base}/study-availability`, patient, {}, query).body;
  };

  beforeEach(() => {
    for (const t of [horariosDeCentros, estadosDeEquipos, turnosDeOrdenes, registeredDevices, deviceDetails] as const) {
      for (const row of t.todos()) t.borrar(row.id);
    }
  });

  it('serves the type catalog and registers a device of the center, operational', () => {
    expect(call<{ items: EquipmentType[] }>('GET', '/diagnostic-units/me/equipment-types').body.items.map((t) => t.code)).toContain('MR');
    const before = view().equipment.filter((e) => e.modalityCode === 'RM').length;
    const r = call<CenterScheduleView>('POST', `${base}/equipment`, staff, { typeCode: 'MR', manufacturer: 'Philips', serialNumber: 'RM-77' });
    expect(r.status).toBe(201);
    const added = r.body.equipment.filter((e) => e.modalityCode === 'RM');
    expect(added).toHaveLength(before + 1);
    expect(added.at(-1)).toMatchObject({ typeCode: 'MR', manufacturer: 'Philips', serialNumber: 'RM-77', status: 'OPERATIONAL' });
    // The scanner in maintenance gave no slots; the new one does.
    expect(availability('STUDY-RMN-RODILLA').items.length).toBeGreaterThan(0);
  });

  it('rejects a type outside the catalog, a repeated serial and a patient', () => {
    expect(call('POST', `${base}/equipment`, staff, { typeCode: 'LASER' }).status).toBe(422);
    call('POST', `${base}/equipment`, staff, { typeCode: 'US', serialNumber: 'X-1' });
    expect(call('POST', `${base}/equipment`, staff, { typeCode: 'US', serialNumber: 'X-1' }).status).toBe(409);
    expect(call('POST', `${base}/equipment`, patient, { typeCode: 'US' }).status).toBe(403);
  });

  it('a device with its own hours offers only those; `null` puts it back on the general schedule', () => {
    const rx = view().equipment.filter((e) => e.modalityCode === 'RX' && e.status === 'OPERATIONAL');
    for (const d of rx) {
      expect(call('PUT', `${base}/equipment/${d.id}/schedule`, staff, { schedule: horarioDeSemana('15:00', '16:00', 30, [1, 2, 3, 4, 5, 6]) }).status).toBe(200);
    }
    const found = availability('STUDY-RX-TORAX');
    expect(found.origin).toBe('EQUIPMENT');
    expect(found.items.every((i) => new Date(i.startAt).getHours() === 15)).toBe(true);
    call('PUT', `${base}/equipment/${rx[0]!.id}/schedule`, staff, { schedule: null });
    expect(view().equipment.find((e) => e.id === rx[0]!.id)?.schedule).toBeNull();
  });

  it('a booking lands on a device; that device keeps its history and cannot be removed', () => {
    const order = orderList.filtrar((o) => o.patientProfileId === PACIENTE.id && o.codeConceptId === ESTUDIO['STUDY-ECO-ABD'])[0]!.id;
    const free = availability('STUDY-ECO-ABD').items[0]!;
    expect(call('POST', `/diagnostic-results/me/orders/${order}/booking`, patient, { unitId: UNIT, startAt: free.startAt }).status).toBe(201);
    const deviceId = turnosDeOrdenes.get(order)!.equipmentId!;
    expect(view().equipment.find((e) => e.id === deviceId)?.modalityCode).toBe('ECO');
    expect(call('DELETE', `${base}/equipment/${deviceId}`).status).toBe(409);
    // Moving the device's hours away from the booked slot is refused too.
    const r = call<{ details: { affectedBookings: number } }>('PUT', `${base}/equipment/${deviceId}/schedule`, staff, {
      schedule: horarioDeSemana('20:00', '21:00', 30, [7]),
    });
    expect(r.status).toBe(409);
    expect(r.body.details.affectedBookings).toBe(1);
  });

  it('removes a device without bookings and edits make, model and serial', () => {
    const added = call<CenterScheduleView>('POST', `${base}/equipment`, staff, { typeCode: 'CT' }).body.equipment.at(-1)!;
    const edited = call<CenterScheduleView>('PATCH', `${base}/equipment/${added.id}`, staff, { model: 'Somatom', serialNumber: 'CT-9' }).body;
    expect(edited.equipment.find((e) => e.id === added.id)).toMatchObject({ model: 'Somatom', serialNumber: 'CT-9' });
    expect(call('DELETE', `${base}/equipment/${added.id}`).status).toBe(200);
    expect(view().equipment.some((e) => e.id === added.id)).toBe(false);
  });
});

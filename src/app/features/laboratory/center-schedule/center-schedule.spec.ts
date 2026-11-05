import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { CenterScheduleClient } from '../../../core/data-access/diagnostic-units/center-schedule.client';
import { horarioDeSemana } from '../../../core/data-access/diagnostic-units/center-schedule.rules';
import type { CenterSchedule, CenterScheduleView } from '../../../core/data-access/diagnostic-units/center-schedule.types';
import { CenterSchedulePage } from './center-schedule';

const VIEW: CenterScheduleView = {
  unitId: 'sur',
  unitName: 'Centro de Imagen Sur',
  kind: 'IMAGING',
  schedule: { general: horarioDeSemana('08:00', '17:00', 30), modalities: [], studies: [] },
  studies: [
    { code: 'STUDY-ECO-ABD', name: 'Ecografía abdominal', modalityCode: 'ECO', price: 340, currency: 'BOB', preparation: null },
    { code: 'STUDY-ECO-OBSTETRICA', name: 'Ecografía obstétrica', modalityCode: 'ECO', price: 300, currency: 'BOB', preparation: null },
    { code: 'STUDY-RX-TORAX', name: 'Radiografía de tórax', modalityCode: 'RX', price: 120, currency: 'BOB', preparation: null },
    { code: 'STUDY-RMN-RODILLA', name: 'Resonancia de rodilla', modalityCode: 'RM', price: 900, currency: 'BOB', preparation: null },
  ],
  equipment: [
    { id: 'eco-1', name: 'Ecógrafo', manufacturer: 'GE', model: 'Logiq', modalityCode: 'ECO', status: 'OPERATIONAL', glossaryConceptId: null },
    { id: 'eco-2', name: 'Ecógrafo portátil', manufacturer: null, model: null, modalityCode: 'ECO', status: 'OUT_OF_SERVICE', glossaryConceptId: null },
    { id: 'rx-1', name: 'Rayos X', manufacturer: null, model: null, modalityCode: 'RX', status: 'OPERATIONAL', glossaryConceptId: null },
  ],
  updatedAt: null,
};

const TYPES = { items: [{ code: 'MR', label: 'Resonador', modalityCode: 'RM' as const }, { code: 'US', label: 'Ecógrafo', modalityCode: 'ECO' as const }] };

async function mount(client: Partial<CenterScheduleClient>) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'administration/center-schedule', component: CenterSchedulePage }]),
      {
        provide: CenterScheduleClient,
        useValue: { getMySchedule: () => of(VIEW), getEquipmentTypes: () => of(TYPES), getMyBookings: () => of({ items: [], count: 0 }), ...client },
      },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/administration/center-schedule');
  harness.fixture.detectChanges();
  const el = harness.routeNativeElement as HTMLElement;
  const click = async (b: HTMLElement): Promise<void> => {
    b.click();
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
  };
  const option = (testid: string, text: string): HTMLElement =>
    [...el.querySelectorAll(`[data-testid="${testid}"] [role="radio"]`)].find((b) => b.textContent?.trim() === text) as HTMLElement;
  const tab = (label: string): HTMLElement => [...el.querySelectorAll('[role="tab"]')].find((t) => t.textContent?.trim() === label) as HTMLElement;
  const pick = async (testid: string, text: string): Promise<void> => {
    await click(el.querySelector<HTMLElement>(`[data-testid="${testid}"] .select-trigger`)!);
    await click([...el.querySelectorAll<HTMLElement>('[role="option"]')].find((o) => o.textContent?.trim() === text)!);
  };
  return { el, click, option, tab, pick, harness };
}

describe('CenterSchedulePage', () => {
  it('el resumen muestra cada equipo como una línea, con el horario que hereda', async () => {
    const { el } = await mount({});
    expect(el.querySelector('[data-testid="centro-horario-general-titulo"]')?.textContent?.trim()).toBe('Horario general');
    const summary = el.querySelector('[data-testid="centro-resumen"]')?.textContent ?? '';
    expect(summary).toContain('Hasta 1 paciente a la vez (1 ecógrafo en línea)');
    expect(summary).toContain('Ecógrafo portátil');
    expect(summary).toContain('Sin resonadores cargados: se reserva con el cupo que declaró el centro');
  });

  it('sólo una modalidad sin equipos ofrece horario propio, y ese horario se publica', async () => {
    const saveSchedule = vi.fn((_unit: string, schedule: CenterSchedule) => of({ ...VIEW, schedule }));
    const { el, click, option } = await mount({ saveSchedule });
    expect(el.querySelector('[data-testid="centro-propio-ECO"]')).toBeNull();
    await click(option('centro-propio-RM', 'Sí'));
    expect(el.querySelector('[data-testid="centro-horario-general-titulo"]')?.textContent?.trim()).toBe('Resto de servicios');
    await click(el.querySelector<HTMLButtonElement>('[data-testid="centro-publicar"]')!);
    expect(saveSchedule.mock.calls[0]![1].modalities.map((m) => m.modalityCode)).toEqual(['RM']);
    expect(el.querySelector('[data-testid="centro-publicado"]')).not.toBeNull();
  });

  it('no publica un horario sin días: muestra qué falta', async () => {
    const saveSchedule = vi.fn();
    const { el, click, option } = await mount({ saveSchedule });
    await click(option('centro-propio-RM', 'Sí'));
    for (const day of [1, 2, 3, 4, 5]) await click(option(`centro-RM-dia-${day}`, 'No'));
    await click(el.querySelector<HTMLButtonElement>('[data-testid="centro-publicar"]')!);
    expect(saveSchedule).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="centro-problemas"]')?.textContent).toContain('Resonancia magnética: marque al menos un día de atención.');
  });

  it('marcar un equipo como operativo lo manda al servidor', async () => {
    const updateEquipment = vi.fn(() => of(VIEW));
    const { click, tab, pick } = await mount({ updateEquipment });
    await click(tab('Equipos'));
    await pick('centro-estado-eco-2', 'Operativo');
    expect(updateEquipment).toHaveBeenCalledWith('sur', 'eco-2', { status: 'OPERATIONAL' });
  });

  it('una modalidad sin equipos ofrece agregarlo, con el tipo ya elegido del catálogo', async () => {
    const withMr = { ...VIEW, equipment: [...VIEW.equipment, { id: 'mr-1', name: 'Resonador Philips', manufacturer: 'Philips', model: null, modalityCode: 'RM' as const, status: 'OPERATIONAL' as const, glossaryConceptId: null }] };
    const addEquipment = vi.fn(() => of(withMr));
    const { el, click, tab } = await mount({ addEquipment });
    await click(tab('Equipos'));
    await click(el.querySelector<HTMLElement>('[data-testid="equipment-empty-RM"] button')!);
    const manufacturer = el.querySelector<HTMLInputElement>('[data-testid="equipment-add-manufacturer"]')!;
    manufacturer.value = 'Philips';
    manufacturer.dispatchEvent(new Event('input'));
    await click(el.querySelector<HTMLButtonElement>('[data-testid="equipment-add-submit"]')!);
    expect(addEquipment).toHaveBeenCalledWith('sur', { typeCode: 'MR', manufacturer: 'Philips', model: undefined, serialNumber: undefined });
    expect(el.querySelector('[data-testid="equipment-add-form"]')).toBeNull();
    expect(el.querySelector('[data-testid="centro-equipo-mr-1"]')).not.toBeNull();
  });

  it('el horario propio de un equipo se guarda en su línea; «No» lo devuelve al general', async () => {
    const saveEquipmentSchedule = vi.fn(() => of(VIEW));
    const { el, click, tab, option } = await mount({ saveEquipmentSchedule });
    await click(tab('Equipos'));
    await click(option('equipment-own-rx-1', 'Sí'));
    await click(option('equipment-rx-1-dia-1', 'No'));
    await click(el.querySelector<HTMLButtonElement>('[data-testid="equipment-save-rx-1"]')!);
    const [, , block] = saveEquipmentSchedule.mock.calls[0]! as unknown as [string, string, { windows: { dayOfWeek: number }[] }];
    expect(block.windows.map((w) => w.dayOfWeek)).toEqual([2, 3, 4, 5]);
  });

  it('quitar un equipo pide confirmación y muestra el motivo si el servidor se niega', async () => {
    const { throwError } = await import('rxjs');
    const { HttpErrorResponse } = await import('@angular/common/http');
    const removeEquipment = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Este equipo ya atendió turnos.' } })));
    const { el, click, tab } = await mount({ removeEquipment });
    await click(tab('Equipos'));
    await click(el.querySelector<HTMLButtonElement>('[data-testid="equipment-remove-rx-1"]')!);
    expect(removeEquipment).not.toHaveBeenCalled();
    await click(el.querySelector<HTMLButtonElement>('[data-testid="equipment-remove-confirm-rx-1"]')!);
    expect(removeEquipment).toHaveBeenCalledWith('sur', 'rx-1');
    expect(el.querySelector('[data-testid="equipment-error-rx-1"]')?.textContent).toContain('Este equipo ya atendió turnos.');
  });

  it('un equipo de una modalidad que el centro no ofrece sigue a la vista, sin línea, y el catálogo sólo ofrece lo que sirve', async () => {
    const withOther = {
      ...VIEW,
      equipment: [...VIEW.equipment, { id: 'mg-1', name: 'Mamógrafo Hologic', manufacturer: 'Hologic', model: null, modalityCode: 'MG' as const, status: 'OPERATIONAL' as const, glossaryConceptId: null }],
    };
    const types = { items: [...TYPES.items, { code: 'MG', label: 'Mamógrafo', modalityCode: 'MG' as const }, { code: 'ANALYZER', label: 'Analizador', modalityCode: null }] };
    const { el, click, tab } = await mount({ getMySchedule: () => of(withOther), getEquipmentTypes: () => of(types) });
    await click(tab('Equipos'));
    expect(el.querySelector('[data-testid="centro-equipo-mg-1"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="equipment-own-mg-1"]')).toBeNull();
    await click(el.querySelector<HTMLButtonElement>('[data-testid="equipment-add-open"]')!);
    await click(el.querySelector<HTMLElement>('[data-testid="equipment-add-type"] .select-trigger')!);
    const offered = [...el.querySelectorAll<HTMLElement>('[role="option"]')].map((o) => o.textContent?.trim());
    expect(offered).toContain('Resonador');
    expect(offered).toContain('Analizador (no da turnos)');
    expect(offered).not.toContain('Mamógrafo');
  });

  it('el horario propio de un equipo se valida antes de mandarlo', async () => {
    const saveEquipmentSchedule = vi.fn(() => of(VIEW));
    const { el, click, tab, option } = await mount({ saveEquipmentSchedule });
    await click(tab('Equipos'));
    await click(option('equipment-own-rx-1', 'Sí'));
    for (const day of [1, 2, 3, 4, 5]) await click(option(`equipment-rx-1-dia-${day}`, 'No'));
    await click(el.querySelector<HTMLButtonElement>('[data-testid="equipment-save-rx-1"]')!);
    expect(saveEquipmentSchedule).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="equipment-problems-rx-1"]')?.textContent).toContain('marque al menos un día de atención');
  });

  it('la ocupación agrupa los turnos del día por equipo y aparta los que no tienen uno', async () => {
    const booking = (bookingId: string, equipmentId: string | null) => ({
      bookingId,
      orderId: null,
      patientName: 'Ana Pérez',
      studyName: 'Ecografía abdominal',
      startsAt: '2026-11-05T12:00:00.000Z',
      endsAt: '2026-11-05T12:30:00.000Z',
      siteName: null,
      equipmentId,
      status: 'BOOKING_CONFIRMED',
    });
    const getMyBookings = vi.fn(() => of({ items: [booking('b1', 'eco-1'), booking('b2', null)], count: 2 }));
    const { el, click, tab } = await mount({ getMyBookings });
    await click(tab('Ocupación'));
    expect(el.querySelector('[data-testid="occupancy-line-eco-1"]')?.textContent).toContain('Ana Pérez');
    expect(el.querySelector('[data-testid="occupancy-line-eco-2"]')?.textContent).toContain('Fuera de línea');
    expect(el.querySelector('[data-testid="occupancy-line-none"]')?.textContent).toContain('Turnos sin equipo asignado');
  });
});

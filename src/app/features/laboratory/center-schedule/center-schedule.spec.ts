import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { CenterScheduleClient } from '../../../core/data-access/diagnostic-units/center-schedule.client';
import { horarioDeSemana } from '../../../core/data-access/diagnostic-units/center-schedule.rules';
import type { CenterSchedule, CenterScheduleView } from '../../../core/data-access/diagnostic-units/center-schedule.types';
import { CenterSchedulePage } from './center-schedule';

const VISTA: CenterScheduleView = {
  unitId: 'sur',
  unitName: 'Centro de Imagen Sur',
  kind: 'IMAGING',
  schedule: { general: horarioDeSemana('08:00', '17:00', 30), modalities: [], studies: [] },
  studies: [
    { code: 'STUDY-ECO-ABD', name: 'Ecografía abdominal', modalityCode: 'ECO', price: 340, currency: 'BOB', preparation: null },
    { code: 'STUDY-ECO-OBSTETRICA', name: 'Ecografía obstétrica', modalityCode: 'ECO', price: 300, currency: 'BOB', preparation: null },
    { code: 'STUDY-RX-TORAX', name: 'Radiografía de tórax', modalityCode: 'RX', price: 120, currency: 'BOB', preparation: null },
  ],
  equipment: [
    { id: 'eco-1', name: 'Ecógrafo', manufacturer: 'GE', model: 'Logiq', modalityCode: 'ECO', status: 'OPERATIONAL', glossaryConceptId: null },
    { id: 'eco-2', name: 'Ecógrafo portátil', manufacturer: null, model: null, modalityCode: 'ECO', status: 'OUT_OF_SERVICE', glossaryConceptId: null },
    { id: 'rx-1', name: 'Rayos X', manufacturer: null, model: null, modalityCode: 'RX', status: 'OPERATIONAL', glossaryConceptId: null },
  ],
  updatedAt: null,
};

async function montar(cliente: Partial<CenterScheduleClient>) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'administration/center-schedule', component: CenterSchedulePage }]),
      { provide: CenterScheduleClient, useValue: cliente },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/administration/center-schedule');
  harness.fixture.detectChanges();
  const el = harness.routeNativeElement as HTMLElement;
  const clic = async (b: HTMLElement): Promise<void> => {
    b.click();
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
  };
  const opcion = (testid: string, texto: string): HTMLElement =>
    [...el.querySelectorAll(`[data-testid="${testid}"] [role="radio"]`)].find((b) => b.textContent?.trim() === texto) as HTMLElement;
  return { el, clic, opcion };
}

describe('CenterSchedulePage', () => {
  it('sin horarios propios, el general se llama «Horario general» y cubre todas las modalidades', async () => {
    const { el } = await montar({ getMySchedule: () => of(VISTA) });
    expect(el.querySelector('[data-testid="centro-horario-general-titulo"]')?.textContent?.trim()).toBe('Horario general');
    expect(el.querySelector('[data-testid="centro-resumen"]')?.textContent).toContain('1 paciente por horario (1 ecógrafo)');
  });

  it('dar horario propio a una modalidad convierte el general en «Resto de servicios» y publica ese horario', async () => {
    const saveSchedule = vi.fn((_unit: string, schedule: CenterSchedule) => of({ ...VISTA, schedule }));
    const { el, clic, opcion } = await montar({ getMySchedule: () => of(VISTA), saveSchedule });
    await clic(opcion('centro-propio-ECO', 'Sí'));
    expect(el.querySelector('[data-testid="centro-horario-general-titulo"]')?.textContent?.trim()).toBe('Resto de servicios');
    await clic(el.querySelector<HTMLButtonElement>('[data-testid="centro-publicar"]')!);
    expect(saveSchedule).toHaveBeenCalledTimes(1);
    const enviado = saveSchedule.mock.calls[0]![1];
    expect(enviado.modalities.map((m) => m.modalityCode)).toEqual(['ECO']);
    expect(el.querySelector('[data-testid="centro-publicado"]')).not.toBeNull();
  });

  it('no publica un horario propio sin días: muestra qué falta', async () => {
    const saveSchedule = vi.fn();
    const { el, clic, opcion } = await montar({ getMySchedule: () => of(VISTA), saveSchedule });
    await clic(opcion('centro-propio-ECO', 'Sí'));
    for (const dia of [1, 2, 3, 4, 5]) {
      await clic(opcion(`centro-ECO-dia-${dia}`, 'No'));
    }
    await clic(el.querySelector<HTMLButtonElement>('[data-testid="centro-publicar"]')!);
    expect(saveSchedule).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="centro-problemas"]')?.textContent).toContain('Ecografía: marque al menos un día de atención.');
  });

  it('marcar un equipo como operativo lo manda al servidor', async () => {
    const setEquipmentStatus = vi.fn(() => of(VISTA));
    const { el, clic } = await montar({ getMySchedule: () => of(VISTA), setEquipmentStatus });
    const pestana = [...el.querySelectorAll('[role="tab"]')].find((t) => t.textContent?.trim() === 'Equipos') as HTMLElement;
    await clic(pestana);
    const estado = el.querySelector('[data-testid="centro-equipo-eco-2"] select') as HTMLSelectElement;
    const operativo = [...estado.options].findIndex((o) => o.textContent?.trim() === 'Operativo');
    estado.selectedIndex = operativo;
    estado.dispatchEvent(new Event('change'));
    await clic(estado);
    expect(setEquipmentStatus).toHaveBeenCalledWith('sur', 'eco-2', 'OPERATIONAL');
  });
});

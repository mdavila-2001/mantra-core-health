import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import { SiteContextStore } from '../../../../core/data-access/operating-rooms/site-context.store';
import { chooseSelectOption, selectOptionLabels } from '../../../../../testing/select';
import { ConsultingRoomSelect } from './consulting-room-select';

/**
 * Elegir el consultorio de una agenda. No pide nada hasta que la persona lo
 * abre; entonces espera la sede activa y ofrece sólo espacios ACTIVOS que son
 * consultorio, sala de procedimientos o de imagen, ordenados por código. Sin
 * ninguno lo dice; «Sin consultorio» devuelve null.
 */

function espacio(code: string, fn: string, estado = 'SPACE_ACTIVE') {
  return { id: `cs-${code}`, code, name: `Sala ${code}`, status: { code: estado }, function: { code: fn, display: fn } };
}

describe('ConsultingRoomSelect', () => {
  let fixture: ComponentFixture<ConsultingRoomSelect>;
  let getStructure: ReturnType<typeof vi.fn>;
  const estado = signal<{ status: string }>({ status: 'loading' });
  const sede = signal<string | null>(null);
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);

  beforeEach(() => {
    estado.set({ status: 'loading' });
    sede.set(null);
    getStructure = vi.fn(() =>
      of({
        spaces: [
          espacio('C2', 'SPACE_FN_CONSULTING_ROOM'),
          espacio('C1', 'SPACE_FN_CONSULTING_ROOM'),
          espacio('P1', 'SPACE_FN_PROCEDURE_ROOM'),
          espacio('B1', 'SPACE_FN_BED'),
          espacio('C9', 'SPACE_FN_CONSULTING_ROOM', 'SPACE_INACTIVE'),
        ],
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: InfrastructureClient, useValue: { getStructure } },
        { provide: SiteContextStore, useValue: { state: estado, siteId: sede, ensure: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(ConsultingRoomSelect);
    fixture.detectChanges();
  });

  async function abrirConSede(siteId: string | null): Promise<void> {
    q('agenda-create-room-open')!.click();
    fixture.detectChanges();
    sede.set(siteId);
    estado.set({ status: 'ready' });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('cerrado no pide nada', () => {
    expect(q('agenda-create-room-open')).not.toBeNull();
    expect(getStructure).not.toHaveBeenCalled();
  });

  it('mientras espera la sede lo anuncia', () => {
    q('agenda-create-room-open')!.click();
    fixture.detectChanges();
    expect(root().querySelector('[role="status"]')?.textContent).toContain('Buscando los consultorios');
  });

  it('ofrece sólo salas activas y de atención, ordenadas por código', async () => {
    await abrirConSede('site-1');
    expect(getStructure).toHaveBeenCalledWith('site-1');
    expect(await selectOptionLabels(fixture, q('agenda-create-room')!)).toEqual([
      'Sin consultorio',
      'C1 · Sala C1',
      'C2 · Sala C2',
      'P1 · Sala P1',
    ]);
  });

  it('elegir una sala actualiza el modelo; «Sin consultorio» lo vuelve null', async () => {
    await abrirConSede('site-1');
    await chooseSelectOption(fixture, q('agenda-create-room')!, 'C2 · Sala C2');
    expect(fixture.componentInstance.careSpaceId()).toBe('cs-C2');
    await chooseSelectOption(fixture, q('agenda-create-room')!, 'Sin consultorio');
    expect(fixture.componentInstance.careSpaceId()).toBeNull();
  });

  it('sin sede activa no consulta la estructura y dice que no hay consultorios', async () => {
    await abrirConSede(null);
    expect(getStructure).not.toHaveBeenCalled();
    expect(q('agenda-create-room-none')).not.toBeNull();
  });
});

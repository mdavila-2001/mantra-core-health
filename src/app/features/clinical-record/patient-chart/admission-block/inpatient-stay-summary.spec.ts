import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AdtClient } from '../../../../core/data-access/adt/adt.client';
import type { InpatientStay } from '../../../../core/data-access/adt/adt.types';
import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import { InpatientAccessStore } from '../../../inpatient/inpatient-access.store';
import { InpatientStaySummary } from './inpatient-stay-summary';

/**
 * El bloque de internación de la historia clínica. Sólo existe en un tenant
 * hospital y con permiso de lectura ADT (la API es la autoridad; esto evita
 * pedir lo que no se va a mostrar). Un 404 no es un error: es «sin
 * internación». Con internación muestra la cama vigente y enlaza a la estadía;
 * sin ella, ofrece internar a quien puede.
 */

function estadia(careSpaceId: string | null): InpatientStay {
  return {
    encounter: { id: 'enc-1', startAt: '2026-10-30T10:00:00Z', levelOfCare: null },
    movements: [
      { periodStart: '2026-10-30T11:00:00Z', periodEnd: null, status: 'LOCATION_ACTIVE', careSpaceId },
    ],
  } as unknown as InpatientStay;
}

describe('InpatientStaySummary', () => {
  let fixture: ComponentFixture<InpatientStaySummary>;
  let getPatientCurrentStay: ReturnType<typeof vi.fn>;
  let getCareSpace: ReturnType<typeof vi.fn>;
  const hospital = signal(true);
  const permisos = signal<readonly string[]>(['f3.adt.read']);

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string) => root().querySelector(`[data-testid="${id}"]`);

  async function pintar(): Promise<void> {
    fixture = TestBed.createComponent(InpatientStaySummary);
    fixture.componentRef.setInput('patientProfileId', 'pac-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    hospital.set(true);
    permisos.set(['f3.adt.read']);
    getPatientCurrentStay = vi.fn(() => of(estadia('cama-1')));
    getCareSpace = vi.fn(() => of({ id: 'cama-1', code: 'B-12', siteId: null }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AdtClient, useValue: { getPatientCurrentStay } },
        { provide: InfrastructureClient, useValue: { getCareSpace } },
        {
          provide: InpatientAccessStore,
          useValue: {
            isHospital: hospital,
            canAnywhere: (accion: string) => permisos().includes(accion),
            ensure: vi.fn(),
            site: () => null,
          },
        },
      ],
    });
  });

  it('fuera de un hospital no pinta nada ni pide la estadía', async () => {
    hospital.set(false);
    await pintar();

    expect(q('inpatient-stay-summary')).toBeNull();
    expect(getPatientCurrentStay).not.toHaveBeenCalled();
  });

  it('sin permiso de lectura ADT tampoco', async () => {
    permisos.set([]);
    await pintar();

    expect(q('inpatient-stay-summary')).toBeNull();
    expect(getPatientCurrentStay).not.toHaveBeenCalled();
  });

  it('con internación: muestra la cama vigente y enlaza a la estadía', async () => {
    await pintar();

    expect(getPatientCurrentStay).toHaveBeenCalledWith('pac-1');
    expect(getCareSpace).toHaveBeenCalledWith('cama-1');
    expect(q('inpatient-stay-summary')?.textContent).toContain('Cama B-12');
    expect(q('inpatient-stay-link')?.getAttribute('href')).toBe('/inpatient/stays/enc-1');
  });

  it('internación sin cama asignada dice «Pendiente de cama»', async () => {
    getPatientCurrentStay.mockReturnValue(of(estadia(null)));
    await pintar();

    expect(q('inpatient-stay-summary')?.textContent).toContain('Pendiente de cama');
    expect(getCareSpace).not.toHaveBeenCalled();
  });

  it('un 404 es «sin internación», y quien puede internar ve el atajo con el paciente', async () => {
    getPatientCurrentStay.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    permisos.set(['f3.adt.read', 'f3.adt.place']);
    await pintar();

    expect(q('inpatient-stay-none')).not.toBeNull();
    expect(q('inpatient-admit')?.getAttribute('href')).toBe('/inpatient/admissions/new?patient=pac-1');
  });

  it('sin permiso de internar no ofrece el atajo', async () => {
    getPatientCurrentStay.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    await pintar();

    expect(q('inpatient-stay-none')).not.toBeNull();
    expect(q('inpatient-admit')).toBeNull();
  });

  it('otro error no se disfraza de «sin internación»', async () => {
    getPatientCurrentStay.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await pintar();

    expect(q('inpatient-stay-none')).toBeNull();
    expect(q('inpatient-stay-link')).toBeNull();
  });
});

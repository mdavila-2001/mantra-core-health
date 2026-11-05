import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError, type Observable } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../../../core/auth/auth.service';
import { AuthzClient } from '../../../../core/data-access/authz/authz.client';
import type { AccessRequestItem } from '../../../../core/data-access/authz/authz.types';
import { MedicalSpecialtiesCatalog } from '../../../../core/data-access/terminology/medical-specialties.service';
import { ChartAccessScope } from './chart-access-scope';

const GRANULAR: AccessRequestItem = {
  id: 'ar-1',
  kind: 'GRANULAR',
  direction: 'SENT',
  counterpart: { profileId: 'p-1', displayName: 'Ana Pérez' },
  requestedAt: new Date('2026-11-01T12:00:00Z'),
  decidedAt: new Date('2026-11-02T12:00:00Z'),
  status: 'ACTIVE',
  requestedSpecialtyConceptIds: ['c-card', 'c-neuro'],
  authorizedSpecialtyConceptIds: ['c-card'],
};

/**
 * El alcance del acceso en el expediente sale del buzón del profesional,
 * porque la API todavía no lo manda con la historia: un granular ACTIVO de
 * este paciente se dice; sin él, no se pinta nada.
 */
describe('ChartAccessScope', () => {
  let fixture: ComponentFixture<ChartAccessScope>;
  let list: ReturnType<typeof vi.fn>;
  let catalog: ReturnType<typeof vi.fn>;

  async function mount(inbox: () => Observable<readonly AccessRequestItem[]>, roles = ['PRACTITIONER']): Promise<void> {
    list = vi.fn(inbox);
    catalog = vi.fn(() => of([{ conceptId: 'c-card', display: 'Cardiología' }]));
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { roles: signal(roles) } },
        { provide: AuthzClient, useValue: { listPractitionerAccessRequests: list } },
        { provide: MedicalSpecialtiesCatalog, useValue: { listar: catalog } },
      ],
    });
    fixture = TestBed.createComponent(ChartAccessScope);
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const notice = (): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector('[data-testid="chart-access-scope"]');

  it('con un granular activo de este paciente dice qué especialidades le autorizó, por nombre', async () => {
    await mount(() => of([GRANULAR]));

    expect(notice()?.textContent).toContain('El paciente le autorizó: Cardiología.');
    expect(text()).not.toContain('c-card');
  });

  it('sin granular activo de este paciente no pinta nada ni pide el catálogo', async () => {
    await mount(() =>
      of([
        { ...GRANULAR, status: 'PENDING', authorizedSpecialtyConceptIds: [] },
        { ...GRANULAR, id: 'ar-2', counterpart: { profileId: 'p-otro', displayName: 'Otra' } },
      ]),
    );

    expect(text().trim()).toBe('');
    expect(catalog).not.toHaveBeenCalled();
  });

  it('una cabecera activa con el paciente abre toda la historia: no se dice «por especialidad»', async () => {
    await mount(() => of([GRANULAR, { ...GRANULAR, id: 'ar-3', kind: 'CABECERA', authorizedSpecialtyConceptIds: [] }]));

    expect(notice()).toBeNull();
  });

  it('una sesión que no es de profesional no pide el buzón', async () => {
    await mount(() => of([GRANULAR]), ['PATIENT']);

    expect(list).not.toHaveBeenCalled();
    expect(text().trim()).toBe('');
  });

  it('si el buzón no se puede leer lo dice en vez de callar', async () => {
    await mount(() => throwError(() => new Error('caída')));

    expect(text()).toContain('No pudimos confirmar el alcance de su acceso a esta historia.');
  });
});

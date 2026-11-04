import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthzClient } from '../../../core/data-access/authz/authz.client';
import { PractitionerAccessClient } from '../../../core/data-access/consent/practitioner-access.client';
import { MedicalSpecialtiesCatalog } from '../../../core/data-access/terminology/medical-specialties.service';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { RequestAccess } from './request-access';

/**
 * Pedir el vínculo de cuidado con un paciente para ver su expediente. Pedir no
 * da acceso (decide el paciente). Se fija el contrato del pedido —tenant
 * activo, paciente de la URL, motivo sólo si se escribió, cabecera o por
 * especialidad— y que cada rechazo de la API tenga su explicación.
 */
describe('RequestAccess', () => {
  let fixture: ComponentFixture<RequestAccess>;
  let requestCareRelationship: ReturnType<typeof vi.fn>;
  let requestAccess: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let success: ReturnType<typeof vi.fn>;
  const tenant = signal<string | null>('t-1');

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const boton = (): HTMLButtonElement =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent?.includes('Pedir vinculación'))!;

  async function pintar(profileId = 'pac-1'): Promise<void> {
    TestBed.overrideProvider(ActivatedRoute, { useValue: { paramMap: of(convertToParamMap({ profileId })) } });
    fixture = TestBed.createComponent(RequestAccess);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function escribirMotivo(texto: string): Promise<void> {
    const area = root().querySelector('textarea')!;
    area.value = texto;
    area.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function pedir(): Promise<void> {
    boton().click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function elegir(alcance: 'CABECERA' | 'GRANULAR'): Promise<void> {
    root().querySelector<HTMLElement>(`[data-testid="segmentado-${alcance}"]`)!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    tenant.set('t-1');
    requestCareRelationship = vi.fn(() => of({}));
    requestAccess = vi.fn(() => of(undefined));
    navigate = vi.fn(async () => true);
    success = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { activeTenantId: tenant } },
        { provide: AuthzClient, useValue: { requestCareRelationship } },
        { provide: PractitionerAccessClient, useValue: { requestAccess } },
        {
          provide: MedicalSpecialtiesCatalog,
          useValue: {
            listar: () => of([{ conceptId: 'c-card', display: 'Cardiología' }, { conceptId: 'c-neuro', display: 'Neurología' }]),
            olvidar: vi.fn(),
          },
        },
        { provide: ProfilesClient, useValue: { getPatient: vi.fn(() => of({ displayName: 'Ana Pérez' })) } },
        { provide: NavigationService, useValue: { breadcrumbs: signal([]) } },
        { provide: ToastService, useValue: { success, error: vi.fn() } },
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ profileId: 'pac-1' })) } },
      ],
    });
  });

  it('nombra al paciente y aclara que pedir no da acceso todavía', async () => {
    await pintar();
    expect(root().textContent).toContain('Va a pedirle a Ana Pérez');
    expect(root().textContent).toContain('Pedir NO le da acceso todavía');
  });

  it('sin elegir qué pide no deja pedir', async () => {
    await pintar();
    expect(boton().getAttribute('aria-disabled')).toBe('true');
    await pedir();
    expect(requestCareRelationship).not.toHaveBeenCalled();
    expect(requestAccess).not.toHaveBeenCalled();
  });

  it('cabecera: envía tenant, paciente y PRIMARY; sin motivo no manda reasonText; vuelve a la historia clínica', async () => {
    await pintar();
    await elegir('CABECERA');
    await pedir();

    expect(requestCareRelationship).toHaveBeenCalledWith({
      tenantId: 't-1',
      patientProfileId: 'pac-1',
      relationshipType: 'PRIMARY',
    });
    expect(requestAccess).not.toHaveBeenCalled();
    expect(success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/medical-records']);
  });

  it('el motivo viaja recortado', async () => {
    await pintar();
    await elegir('CABECERA');
    await escribirMotivo('  seguimiento de una derivación  ');
    await pedir();

    expect(requestCareRelationship).toHaveBeenCalledWith({
      tenantId: 't-1',
      patientProfileId: 'pac-1',
      relationshipType: 'PRIMARY',
      reasonText: 'seguimiento de una derivación',
    });
  });

  it('por especialidad: exige al menos una y manda el pedido granular, no el vínculo', async () => {
    await pintar();
    await elegir('GRANULAR');
    expect(boton().getAttribute('aria-disabled')).toBe('true');

    const casillas = root().querySelectorAll<HTMLInputElement>('[data-testid="request-access-specialties"] input');
    expect(casillas).toHaveLength(2);
    casillas[1]!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    await pedir();

    expect(requestAccess).toHaveBeenCalledWith({ patientProfileId: 'pac-1', specialtyConceptIds: ['c-neuro'] });
    expect(requestCareRelationship).not.toHaveBeenCalled();
    expect(success).toHaveBeenCalledWith('Solicitud enviada. El paciente va a decidir qué especialidades le autoriza.');
    expect(navigate).toHaveBeenCalledWith(['/medical-records']);
  });

  it('sin organización activa no deja pedir y explica qué hacer', async () => {
    tenant.set(null);
    await pintar();
    // With a scope chosen, the only thing missing is the organization.
    await elegir('CABECERA');

    expect(boton().getAttribute('aria-disabled')).toBe('true');
    expect(root().textContent).toContain('Elija una organización');
    await pedir();
    expect(requestCareRelationship).not.toHaveBeenCalled();
  });

  it('sin paciente en la URL no deja pedir', async () => {
    await pintar('');
    await elegir('CABECERA');
    expect(boton().getAttribute('aria-disabled')).toBe('true');
    await pedir();
    expect(requestCareRelationship).not.toHaveBeenCalled();
  });

  it('un 409 no es un error: dice que ya hay un pedido o un vínculo, en tono informativo', async () => {
    requestCareRelationship.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'CONFLICT', message: '' } })),
    );
    await pintar();
    await elegir('CABECERA');
    await pedir();

    expect(root().textContent).toContain('Ya existe una solicitud pendiente o un vínculo activo');
    expect(root().textContent).not.toContain('No se pudo enviar');
    expect(root().querySelector('app-alert[tone="error"]')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    ['CARE_RELATIONSHIP_ALREADY_ACTIVE', 'Ya tiene un vínculo activo con este paciente', 'Ya pidió la vinculación'],
    ['CARE_RELATIONSHIP_REQUEST_ALREADY_PENDING', 'Ya pidió la vinculación', 'Ya tiene un vínculo activo'],
  ])('un 409 con reason %s dice cuál de los dos es, sin error rojo', async (reason, dice, noDice) => {
    requestCareRelationship.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'CONFLICT', message: '', reason } })),
    );
    await pintar();
    await elegir('CABECERA');
    await pedir();

    expect(root().textContent).toContain(dice);
    expect(root().textContent).not.toContain(noDice);
    expect(root().textContent).not.toContain('Ya existe una solicitud pendiente o un vínculo activo');
    expect(root().textContent).not.toContain('No se pudo enviar');
    expect(root().querySelector('app-alert[tone="error"]')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('un reintento tras un 409 borra el aviso anterior', async () => {
    requestCareRelationship
      .mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'CONFLICT', message: '', reason: 'CARE_RELATIONSHIP_REQUEST_ALREADY_PENDING' } })),
      )
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500, error: null })));
    await pintar();
    await elegir('CABECERA');
    await pedir();
    expect(root().textContent).toContain('Ya pidió la vinculación');

    await pedir();
    expect(root().textContent).not.toContain('Ya pidió la vinculación');
    expect(root().textContent).toContain('No se pudo enviar la solicitud.');
  });

  it.each([
    [403, null, 'No tiene permiso para pedir este vínculo.'],
    [422, 'PRECONDITION_FAILED', 'no tiene un perfil profesional propio'],
    [500, null, 'No se pudo enviar la solicitud.'],
  ])('un %s (%s) muestra su explicación y deja reintentar', async (status, code, mensaje) => {
    requestCareRelationship.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status, error: code ? { code, message: '' } : null })),
    );
    await pintar();
    await elegir('CABECERA');
    await pedir();

    expect(root().textContent).toContain(mensaje);
    expect(navigate).not.toHaveBeenCalled();
    expect(boton().getAttribute('aria-disabled')).toBe('false');
  });
});

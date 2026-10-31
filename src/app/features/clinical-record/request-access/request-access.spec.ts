import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthzClient } from '../../../core/data-access/authz/authz.client';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { RequestAccess } from './request-access';

/**
 * Pedir el vínculo de cuidado con un paciente para ver su expediente. Pedir no
 * da acceso (decide el paciente). Se fija el contrato del pedido —tenant
 * activo, paciente de la URL, motivo sólo si se escribió— y que cada rechazo
 * de la API tenga su explicación.
 */
describe('RequestAccess', () => {
  let fixture: ComponentFixture<RequestAccess>;
  let requestCareRelationship: ReturnType<typeof vi.fn>;
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

  beforeEach(() => {
    tenant.set('t-1');
    requestCareRelationship = vi.fn(() => of({}));
    navigate = vi.fn(async () => true);
    success = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { activeTenantId: tenant } },
        { provide: AuthzClient, useValue: { requestCareRelationship } },
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

  it('envía tenant y paciente; sin motivo no manda reasonText; vuelve a la historia clínica', async () => {
    await pintar();
    await pedir();

    expect(requestCareRelationship).toHaveBeenCalledWith({ tenantId: 't-1', patientProfileId: 'pac-1' });
    expect(success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/medical-records']);
  });

  it('el motivo viaja recortado', async () => {
    await pintar();
    await escribirMotivo('  seguimiento de una derivación  ');
    await pedir();

    expect(requestCareRelationship).toHaveBeenCalledWith({
      tenantId: 't-1',
      patientProfileId: 'pac-1',
      reasonText: 'seguimiento de una derivación',
    });
  });

  it('sin organización activa no deja pedir y explica qué hacer', async () => {
    tenant.set(null);
    await pintar();

    expect(boton().getAttribute('aria-disabled')).toBe('true');
    expect(root().textContent).toContain('Elija una organización');
    await pedir();
    expect(requestCareRelationship).not.toHaveBeenCalled();
  });

  it('sin paciente en la URL no deja pedir', async () => {
    await pintar('');
    expect(boton().getAttribute('aria-disabled')).toBe('true');
    await pedir();
    expect(requestCareRelationship).not.toHaveBeenCalled();
  });

  it.each([
    [403, null, 'No tiene permiso para pedir este vínculo.'],
    [409, null, 'Ya existe una solicitud pendiente o un vínculo activo'],
    [422, 'PRECONDITION_FAILED', 'no tiene un perfil profesional propio'],
    [500, null, 'No se pudo enviar la solicitud.'],
  ])('un %s (%s) muestra su explicación y deja reintentar', async (status, code, mensaje) => {
    requestCareRelationship.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status, error: code ? { code, message: '' } : null })),
    );
    await pintar();
    await pedir();

    expect(root().textContent).toContain(mensaje);
    expect(navigate).not.toHaveBeenCalled();
    expect(boton().getAttribute('aria-disabled')).toBe('false');
  });
});

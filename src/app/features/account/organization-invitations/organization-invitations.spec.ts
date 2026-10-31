import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MembershipInvitationsClient } from '../../../core/data-access/directory/membership-invitations.client';
import type { MembershipInvitation } from '../../../core/data-access/directory/membership-invitations.types';
import { TokenRefreshService } from '../../../core/http/token-refresh.service';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { OrganizationInvitations } from './organization-invitations';

const INVITACIONES: MembershipInvitation[] = [
  { id: 'm-1', tenantId: 't-1', tenantName: 'Consultorio Céspedes', role: 'STAFF', invitedAt: new Date('2026-10-28T10:00:00Z') },
  { id: 'm-2', tenantId: 't-2', tenantName: 'Laboratorio Central', role: 'ADMIN', invitedAt: new Date('2026-10-29T10:00:00Z') },
];

describe('OrganizationInvitations', () => {
  let fixture: ComponentFixture<OrganizationInvitations>;
  let pendientes: MembershipInvitation[];
  let list: ReturnType<typeof vi.fn>;
  let accept: ReturnType<typeof vi.fn>;
  let decline: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const refrescar = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const clic = async (el: Element | null): Promise<void> => {
    (el as HTMLElement).click();
    await refrescar();
  };
  const fila = (id: string): HTMLElement => byId(`invitacion-${id}`)!;

  async function abrir(inicial: MembershipInvitation[] = INVITACIONES): Promise<void> {
    pendientes = [...inicial];
    list = vi.fn(() => of([...pendientes]));
    accept = vi.fn((id: string) => {
      pendientes = pendientes.filter((i) => i.id !== id);
      return of({ id, tenantId: 't', status: 'ACTIVE' });
    });
    decline = vi.fn((id: string) => {
      pendientes = pendientes.filter((i) => i.id !== id);
      return of({ id, tenantId: 't', status: 'DECLINED' });
    });
    refresh = vi.fn(() => of({}));
    confirm = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: MembershipInvitationsClient, useValue: { list, accept, decline } },
        { provide: TokenRefreshService, useValue: { refresh } },
        { provide: DialogService, useValue: { confirm } },
      ],
    });
    fixture = TestBed.createComponent(OrganizationInvitations);
    fixture.detectChanges();
    await refrescar();
  }

  it('lista las invitaciones con la organización y el rol, y ofrece aceptar y rechazar cada una', async () => {
    await abrir();
    expect(fila('m-1').textContent).toContain('Consultorio Céspedes');
    expect(fila('m-1').textContent).toContain('equipo');
    expect(fila('m-2').textContent).toContain('administración');
    expect(fila('m-1').querySelector('[data-testid="invitacion-aceptar"]')).not.toBeNull();
    expect(fila('m-1').querySelector('[data-testid="invitacion-rechazar"]')).not.toBeNull();
  });

  it('sin invitaciones lo dice, con qué pasa cuando llegue una', async () => {
    await abrir([]);
    expect(byId('invitaciones-vacio')!.textContent).toContain('No tiene invitaciones pendientes');
    expect(byId('invitaciones-lista')).toBeNull();
  });

  it('aceptar activa la membresía, renueva la sesión para que el token lleve la organización y vuelve a leer la lista', async () => {
    await abrir();
    await clic(fila('m-1').querySelector('[data-testid="invitacion-aceptar"]'));
    expect(accept).toHaveBeenCalledWith('m-1');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(2);
    expect(byId('invitacion-m-1')).toBeNull();
    expect(byId('invitacion-m-2')).not.toBeNull();
    expect(byId('invitaciones-resultado')!.textContent).toContain('Aceptó la invitación de Consultorio Céspedes');
  });

  it('rechazar pide confirmación, descarta la invitación y no renueva la sesión', async () => {
    await abrir();
    await clic(fila('m-2').querySelector('[data-testid="invitacion-rechazar"]'));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
    expect(decline).toHaveBeenCalledWith('m-2');
    expect(refresh).not.toHaveBeenCalled();
    expect(byId('invitacion-m-2')).toBeNull();
    expect(byId('invitaciones-resultado')!.textContent).toContain('Rechazó la invitación de Laboratorio Central');
  });

  it('si cancela la confirmación no se rechaza nada', async () => {
    await abrir();
    confirm.mockResolvedValueOnce(false);
    await clic(fila('m-1').querySelector('[data-testid="invitacion-rechazar"]'));
    expect(decline).not.toHaveBeenCalled();
    expect(byId('invitacion-m-1')).not.toBeNull();
  });

  it('un 404 (ya decidida, retirada o ajena) se dice sin dar más datos y se vuelve a leer lo que hay', async () => {
    await abrir();
    accept.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'NOT_FOUND', message: 'x', timestamp: '', path: '' } })));
    pendientes = pendientes.filter((i) => i.id !== 'm-1');
    await clic(fila('m-1').querySelector('[data-testid="invitacion-aceptar"]'));
    expect(byId('invitaciones-error')!.textContent).toContain('ya no está disponible');
    expect(byId('invitacion-m-1')).toBeNull();
  });

  it('un fallo de red al decidir se dice y deja la invitación para reintentar', async () => {
    await abrir();
    decline.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    await clic(fila('m-1').querySelector('[data-testid="invitacion-rechazar"]'));
    expect(byId('invitaciones-error')!.textContent).toContain('No pudimos guardar su respuesta');
    expect(byId('invitacion-m-1')).not.toBeNull();
  });

  it('si no se pueden leer, ofrece reintentar', async () => {
    list = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: MembershipInvitationsClient, useValue: { list: () => throwError(() => new Error('x')), accept: vi.fn(), decline: vi.fn() } },
        { provide: TokenRefreshService, useValue: { refresh: vi.fn() } },
        { provide: DialogService, useValue: { confirm: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(OrganizationInvitations);
    fixture.detectChanges();
    await refrescar();
    expect(byId('invitaciones-no-cargo')!.textContent).toContain('No pudimos leer');
    expect(byId('invitaciones-reintentar')).not.toBeNull();
  });
});

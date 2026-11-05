import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SessionStore } from '../../../core/auth/session.store';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import { DeniedTenantsBanner } from './denied-tenants-banner';

function token(claims: Record<string, unknown>): string {
  const codificar = (valor: object): string => btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${codificar({ alg: 'none' })}.${codificar({ sub: 'u-1', roles: ['USER'], tenants: ['t-1'], ...claims })}.firma`;
}

describe('DeniedTenantsBanner', () => {
  let fixture: ComponentFixture<DeniedTenantsBanner>;
  let store: SessionStore;
  let listMyOrganizations: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const refrescar = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  function abrir(denegadas: Record<string, string>, nombres: unknown = of([{ id: 't-2', legalName: 'Hospital Sur S.A.', tradeName: 'Hospital Sur' }])): void {
    listMyOrganizations = vi.fn(() => nombres);
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: DirectoryClient, useValue: { listMyOrganizations } }] });
    store = TestBed.inject(SessionStore);
    store.start({ accessToken: token({ deniedTenants: denegadas }), refreshToken: 'r' });
    fixture = TestBed.createComponent(DeniedTenantsBanner);
    fixture.detectChanges();
  }

  it('sin organizaciones que nieguen no dibuja nada ni pide nombres', async () => {
    abrir({});
    await refrescar();
    expect(byId('aviso-organizaciones-negadas')).toBeNull();
    expect(listMyOrganizations).not.toHaveBeenCalled();
  });

  it('dice «La organización X no le permite entrar ahora: motivo», con el nombre que trae GET /tenants/me, y que no cierra la sesión', async () => {
    abrir({ 't-2': 'OUTSIDE_ALLOWED_HOURS' });
    await refrescar();
    const aviso = byId('aviso-negada-t-2')!;
    expect(aviso.textContent).toContain('La organización Hospital Sur no le permite entrar ahora: está fuera del horario');
    expect(aviso.textContent).not.toContain('OUTSIDE_ALLOWED_HOURS');
    expect(byId('aviso-organizaciones-negadas')!.textContent).toContain('no cierra su sesión');
    expect(store.isAuthenticated()).toBe(true);
  });

  it('si no se pudo leer el nombre dice «Una de sus organizaciones», nunca el identificador', async () => {
    abrir({ 't-2': 'OUTSIDE_ALLOWED_NETWORK' }, throwError(() => new Error('x')));
    await refrescar();
    expect(byId('aviso-negada-t-2')!.textContent).toContain('Una de sus organizaciones no le permite entrar ahora');
    expect(host().textContent).not.toContain('t-2');
  });

  it('cada motivo se explica con su indicación', async () => {
    abrir({ 't-2': 'IDLE_TIMEOUT', 't-3': 'MFA_REQUIRED', 't-4': 'OUTSIDE_ALLOWED_NETWORK' });
    await refrescar();
    expect(byId('aviso-negada-t-2')!.textContent).toContain('estuvo inactivo');
    expect(byId('aviso-negada-t-3')!.textContent).toContain('escribiendo el código de su aplicación');
    expect(byId('aviso-negada-t-4')!.textContent).toContain('Conéctese a una red permitida');
  });

  it('por falta del segundo factor ofrece activarlo', async () => {
    abrir({ 't-2': 'MFA_ENROLLMENT_REQUIRED' });
    await refrescar();
    expect(byId('aviso-negada-activar-factor')!.getAttribute('href')).toBe('/my-account/security/mfa');
  });

  it('«Entendido» lo oculta, y vuelve si el token trae otra lista', async () => {
    abrir({ 't-2': 'OUTSIDE_ALLOWED_HOURS' });
    await refrescar();
    (byId('aviso-negada-entendido') as HTMLElement).click();
    await refrescar();
    expect(byId('aviso-organizaciones-negadas')).toBeNull();
    store.renew({ accessToken: token({ deniedTenants: { 't-2': 'OUTSIDE_ALLOWED_HOURS', 't-5': 'IDLE_TIMEOUT' } }), refreshToken: 'r2' });
    await refrescar();
    expect(byId('aviso-organizaciones-negadas')).not.toBeNull();
  });
});

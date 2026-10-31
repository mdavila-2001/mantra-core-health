import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';

import { SessionStore } from '../../../core/auth/session.store';
import { TenantSelection } from './tenant-selection';

function token(claims: Record<string, unknown>): string {
  const codificar = (valor: object): string => btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${codificar({ alg: 'none' })}.${codificar({ sub: 'u-1', roles: ['USER'], ...claims })}.firma`;
}

describe('TenantSelection', () => {
  let component: TenantSelection;
  let fixture: ComponentFixture<TenantSelection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantSelection],
      // La pantalla ya tenía un `Router` inyectado para navegar tras elegir; el
      // estado vacío añadió además un `routerLink` en la plantilla, y ése sí
      // necesita rutas configuradas para resolverse.
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantSelection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * Sin sesión la lista queda vacía, y antes eso era una pantalla muda: ni
   * mensaje ni salida. Quien llegara directo a esta URL no tenía forma de saber
   * qué había pasado.
   */
  it('sin organizaciones explica qué pasó y ofrece volver al login', () => {
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('No encontramos organizaciones');

    const salida = (fixture.nativeElement as HTMLElement).querySelector('a[routerLink="/auth"]');
    expect(salida).not.toBeNull();
  });

  /** El estado vacío se anuncia: es la respuesta que recibe la persona. */
  it('anuncia el estado vacío a un lector de pantalla', () => {
    fixture.detectChanges();

    const vacio = (fixture.nativeElement as HTMLElement).querySelector('.tenant__vacio');
    expect(vacio?.getAttribute('role')).toBe('status');
    expect(vacio?.getAttribute('aria-live')).toBe('polite');
  });
  /**
   * Con acceso a administración Y a reportería, tras elegir organización toca
   * elegir portal; con solo uno, se entra directo a ese portal.
   */
  it.each([
    [['PLATFORM_ADMIN', 'REPORTING_ADMIN'], '/portal-selector'],
    [['SUPERADMIN'], '/portal-selector'],
    // PLATFORM_ADMIN da los dos accesos (reporting-access.spec): también elige.
    [['PLATFORM_ADMIN'], '/portal-selector'],
    [['SECURITY_ADMIN'], '/'],
    [['REPORT_VIEWER'], '/reports'],
    [['PATIENT'], '/'],
  ])('al elegir organización con los roles %j va a %s', (roles, destino) => {
    const auth = TestBed.inject(AuthService);
    vi.spyOn(auth, 'selectTenant').mockImplementation(() => undefined);
    vi.spyOn(auth, 'roles').mockReturnValue(roles);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    component.choose('tenant-1');

    expect(navegar).toHaveBeenCalledWith(destino);
  });

  describe('organizaciones que no dejan entrar ahora', () => {
    let http: HttpTestingController;
    const host = (): HTMLElement => fixture.nativeElement as HTMLElement;

    beforeEach(() => {
      http = TestBed.inject(HttpTestingController);
      TestBed.inject(SessionStore).start({
        accessToken: token({ tenants: ['t-1', 't-2'], tenantNames: { 't-1': 'Clínica Norte', 't-2': 'Farmacia Vida' }, deniedTenants: { 't-3': 'OUTSIDE_ALLOWED_HOURS' } }),
        refreshToken: 'r',
      });
      fixture = TestBed.createComponent(TenantSelection);
      fixture.detectChanges();
    });

    it('las marca deshabilitadas, con su motivo, y no se pueden elegir; las demás siguen eligiéndose', async () => {
      http.expectOne('/tenants/me').flush({ items: [{ id: 't-3', legalName: 'Hospital Sur S.A.', tradeName: 'Hospital Sur' }] });
      http.match('/tenants/me/membership-invitations').forEach((r) => r.flush({ items: [] }));
      await fixture.whenStable();
      fixture.detectChanges();
      const negada = host().querySelector('[data-testid="tenant-opcion-negada"]') as HTMLButtonElement;
      expect(negada.disabled).toBe(true);
      expect(negada.textContent).toContain('Hospital Sur');
      expect(negada.getAttribute('data-reason')).toBe('OUTSIDE_ALLOWED_HOURS');
      expect(host().querySelector('[data-testid="tenant-motivo-negada"]')!.textContent).toContain('fuera del horario');
      expect(host().querySelectorAll('[data-testid="tenant-opcion"]')).toHaveLength(2);
    });

    it('si el nombre no se puede leer, no muestra el identificador: dice «Otra organización de su cuenta»', async () => {
      http.expectOne('/tenants/me').flush({}, { status: 500, statusText: 'x' });
      http.match('/tenants/me/membership-invitations').forEach((r) => r.flush({ items: [] }));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(host().querySelector('[data-testid="tenant-opcion-negada"]')!.textContent).toContain('Otra organización de su cuenta');
      expect(host().textContent).not.toContain('t-3');
    });

    it('avisa de las invitaciones pendientes y lleva a responderlas', async () => {
      http.expectOne('/tenants/me').flush({ items: [] });
      http.match('/tenants/me/membership-invitations').forEach((r) => r.flush({ items: [{ id: 'm-1', tenantId: 't-9', tenantName: 'Lab', role: 'STAFF', invitedAt: '2026-10-29T10:00:00Z' }, { id: 'm-2', tenantId: 't-8', tenantName: 'Otra', role: 'ADMIN', invitedAt: '2026-10-29T10:00:00Z' }] }));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(host().querySelector('[data-testid="tenant-invitaciones"]')!.textContent).toContain('2 invitaciones');
      expect(host().querySelector('[data-testid="tenant-invitaciones-enlace"]')!.getAttribute('href')).toContain('/my-account/security/organization-invitations');
    });

    it('sin invitaciones no muestra ningún aviso', async () => {
      http.expectOne('/tenants/me').flush({ items: [] });
      http.match('/tenants/me/membership-invitations').forEach((r) => r.flush({ items: [] }));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(host().querySelector('[data-testid="tenant-invitaciones"]')).toBeNull();
    });
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { organizacionAdministrableGuard } from './organization-admin.guard';

/**
 * El alta de sucursal y la de membresía las autoriza la API con
 * `assertCanAdminister` (OWNER/ADMIN de la organización, o plataforma). Antes
 * las cerraba el guard de sección con `SECURITY_ADMIN`, y el dueño de una
 * clínica no podía abrir la sucursal de su propia clínica.
 */
@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Pantalla {}

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const RUTA = '/administration/organizations/t-1/branches/new';

describe('organizacionAdministrableGuard', () => {
  let router: Router;
  let http: HttpTestingController;

  function sesion(roles: readonly string[], tenants: readonly string[]): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: 'administration/organizations/:tenantId/branches/new',
            canActivate: [organizacionAdministrableGuard],
            component: Pantalla,
          },
          { path: 'dashboard', component: Pantalla },
        ]),
      ],
    });
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles, tenants }),
      refreshToken: 'r',
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
  }

  afterEach(() => http.verify());

  /** El guard corre después de que el router resuelve la ruta: un turno. */
  function pendiente(): Promise<void> {
    return new Promise((resolver) => setTimeout(resolver));
  }

  function miOrganizacion(canAdminister: boolean) {
    return {
      items: [
        {
          id: 't-1',
          code: 'OLIVOS',
          legalName: 'Clínica Los Olivos',
          tenantTypeConceptId: 'c',
          statusConceptId: 'c',
          verificationStatusConceptId: 'c',
          myRoleConceptId: 'c-rol',
          canAdminister,
          isVerified: true,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
  }

  it('la plataforma pasa sin preguntar', async () => {
    sesion(['SECURITY_ADMIN'], []);
    await router.navigateByUrl(RUTA);
    expect(router.url).toBe(RUTA);
  });

  it('el OWNER/ADMIN de la organización pasa (canAdminister de la API)', async () => {
    sesion(['USER'], ['t-1']);
    const navegacion = router.navigateByUrl(RUTA);
    await pendiente();
    http.expectOne('/tenants/me').flush(miOrganizacion(true));
    await navegacion;
    expect(router.url).toBe(RUTA);
  });

  it('un STAFF de la organización no pasa', async () => {
    sesion(['USER'], ['t-1']);
    const navegacion = router.navigateByUrl(RUTA);
    await pendiente();
    http.expectOne('/tenants/me').flush(miOrganizacion(false));
    await navegacion;
    expect(router.url).toBe('/dashboard');
  });

  it('quien no tiene la organización en su sesión no pasa ni pregunta', async () => {
    sesion(['USER'], ['otra']);
    await router.navigateByUrl(RUTA);
    expect(router.url).toBe('/dashboard');
  });

  it('si /tenants/me falla deja pasar: decide la API', async () => {
    sesion(['USER'], ['t-1']);
    const navegacion = router.navigateByUrl(RUTA);
    await pendiente();
    http.expectOne('/tenants/me').flush(null, { status: 500, statusText: 'Error' });
    await navegacion;
    expect(router.url).toBe(RUTA);
  });
});

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { authGuard } from './auth.guard';
import { SessionEndedRedirect } from './session-ended-redirect';
import { SessionStore } from './session.store';

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Vacia {}

/** Un token por rol: el fallo se veía «en todos los usuarios». */
const TOKENS_POR_ROL: Readonly<Record<string, string>> = {
  paciente: jwt({ sub: 'u-pac', roles: ['PATIENT'], tenants: ['t-1'], pid: 'p-1' }),
  profesional: jwt({ sub: 'u-med', roles: ['PRACTITIONER'], tenants: ['t-1'], hpid: 'h-1' }),
  administración: jwt({ sub: 'u-adm', roles: ['TENANT_ADMIN'], tenants: ['t-1'] }),
};

/**
 * `authGuard` sólo corre al navegar. Cuando la sesión se cerraba con una
 * pantalla privada ya pintada —inactividad, otra pestaña—, la pantalla quedaba
 * en pie sin token y ninguna acción funcionaba.
 */
describe('SessionEndedRedirect', () => {
  let session: SessionStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'auth', component: Vacia },
          { path: 'posts', component: Vacia },
          {
            path: '',
            canActivate: [authGuard],
            children: [{ path: 'dashboard', component: Vacia }],
          },
        ]),
      ],
    });

    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
    TestBed.inject(SessionEndedRedirect);
  });

  async function entrarComo(token: string, url: string): Promise<void> {
    session.start({ accessToken: token, refreshToken: 'r-1' });
    TestBed.tick();
    await router.navigateByUrl(url);
    expect(router.url).toBe(url);
  }

  async function perderSesion(): Promise<void> {
    session.clear();
    TestBed.tick();
    // La navegación que dispara el efecto es asíncrona.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  for (const [rol, token] of Object.entries(TOKENS_POR_ROL)) {
    it(`${rol}: perder la sesión dentro del área privada lleva al login`, async () => {
      await entrarComo(token, '/dashboard');

      await perderSesion();

      expect(router.url).toBe('/auth');
    });
  }

  it('en la superficie pública no expulsa: ahí no hace falta sesión', async () => {
    await entrarComo(TOKENS_POR_ROL['paciente'] ?? '', '/posts');

    await perderSesion();

    expect(router.url).toBe('/posts');
  });

  it('sin sesión previa no navega: no hay nada que se haya perdido', async () => {
    await router.navigateByUrl('/posts');
    const navegar = vi.spyOn(router, 'navigateByUrl');

    TestBed.tick();
    await perderSesion();

    expect(navegar).not.toHaveBeenCalled();
  });

  it('renovar los tokens no cuenta como perder la sesión', async () => {
    await entrarComo(TOKENS_POR_ROL['profesional'] ?? '', '/dashboard');
    const navegar = vi.spyOn(router, 'navigateByUrl');

    session.renew({ accessToken: TOKENS_POR_ROL['profesional'] ?? '', refreshToken: 'r-2' });
    TestBed.tick();

    expect(navegar).not.toHaveBeenCalled();
    expect(router.url).toBe('/dashboard');
  });
});

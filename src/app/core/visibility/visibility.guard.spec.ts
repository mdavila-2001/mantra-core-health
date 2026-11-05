import { ChangeDetectionStrategy, Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type Routes } from '@angular/router';

import { SessionStore } from '../auth/session.store';
import { APP_SECTIONS } from '../navigation/navigation.map';
import { navScreenKey } from './ui-element-keys';
import { PANTALLA_NO_DISPONIBLE_ROUTE, visibilityChildGuard } from './visibility.guard';

@Component({ template: 'x', changeDetection: ChangeDetectionStrategy.OnPush })
class Pantalla {}

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

// Una sección real del registro con hijas, y una ruta que no es sección.
const SECCION = APP_SECTIONS.find((s) => s.path.includes('/'))?.path ?? 'schedule';
const CLAVE_SECCION = navScreenKey(SECCION);

const rutas: Routes = [
  {
    path: '',
    canActivateChild: [visibilityChildGuard],
    children: [
      { path: SECCION, component: Pantalla },
      { path: `${SECCION}/nueva`, component: Pantalla },
      { path: 'otra-cosa', component: Pantalla },
      { path: PANTALLA_NO_DISPONIBLE_ROUTE.slice(1), component: Pantalla },
    ],
  },
];

describe('visibilityChildGuard', () => {
  let router: Router;
  let session: SessionStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(rutas)],
    });
    router = TestBed.inject(Router);
    session = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function abrirSesion(): void {
    session.start({ accessToken: jwt({ sub: 'u-1', roles: ['USER'], tenants: ['t-1'] }), refreshToken: 'r' });
  }

  /** Navega y, cuando la guarda ya pidió las reglas, las contesta. */
  async function irA(url: string, hidden: string[] | 'falla'): Promise<void> {
    const navegacion = router.navigateByUrl(url);
    await vi.waitFor(() => {
      const pedidos = http.match('/me/ui-visibility');
      if (pedidos.length === 0) throw new Error('la guarda todavía no pidió las reglas');
      for (const r of pedidos) {
        if (hidden === 'falla') {
          r.flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'x' });
        } else {
          r.flush({ hiddenKeys: hidden, version: 'v1', generatedAt: '2026-10-31T10:00:00Z' });
        }
      }
    });
    await navegacion;
  }

  it('la pantalla visible se abre', async () => {
    abrirSesion();
    await irA(`/${SECCION}`, []);
    expect(router.url).toBe(`/${SECCION}`);
  });

  it('una pantalla oculta redirige a «No disponible para su perfil»', async () => {
    abrirSesion();
    await irA(`/${SECCION}`, [CLAVE_SECCION]);
    expect(router.url).toBe(PANTALLA_NO_DISPONIBLE_ROUTE);
  });

  it('las pantallas hijas de una sección oculta tampoco se abren (manda la sección)', async () => {
    abrirSesion();
    await irA(`/${SECCION}/nueva`, [CLAVE_SECCION]);
    expect(router.url).toBe(PANTALLA_NO_DISPONIBLE_ROUTE);
  });

  it('falla abierto: si las reglas no se pudieron leer, la pantalla se abre (la API protege)', async () => {
    abrirSesion();
    await irA(`/${SECCION}`, 'falla');
    expect(router.url).toBe(`/${SECCION}`);
  });

  it('una ruta que no es sección del registro pasa, y la propia pantalla de «No disponible» no rebota', async () => {
    abrirSesion();
    // No es una sección: la guarda no tiene nada que preguntar y ni siquiera pide las reglas.
    await router.navigateByUrl('/otra-cosa');
    http.expectNone('/me/ui-visibility');
    expect(router.url).toBe('/otra-cosa');
    await router.navigateByUrl(PANTALLA_NO_DISPONIBLE_ROUTE);
    expect(router.url).toBe(PANTALLA_NO_DISPONIBLE_ROUTE);
  });

  it('sin sesión no decide nada (de eso se ocupa authGuard) y no pide reglas', async () => {
    await router.navigateByUrl(`/${SECCION}`);
    http.expectNone('/me/ui-visibility');
    expect(router.url).toBe(`/${SECCION}`);
  });
});

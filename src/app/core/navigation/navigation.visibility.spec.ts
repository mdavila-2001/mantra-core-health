import { ChangeDetectionStrategy, Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../auth/session.store';
import { UiVisibilityService } from '../visibility/ui-visibility.service';
import { navGroupKey, navScreenKey } from '../visibility/ui-element-keys';
import { NavigationService } from './navigation.service';

/**
 * El menú obedece a las reglas de visibilidad. **Presentación, no seguridad**: ocultar un renglón no cierra la ruta
 * ni la API; quien siga autorizado la alcanza por su dirección.
 */
@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Vacio {}

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

describe('NavigationService + visibilidad', () => {
  let nav: NavigationService;
  let session: SessionStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: '**', component: Vacio }])],
    });
    nav = TestBed.inject(NavigationService);
    session = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(UiVisibilityService).start();
  });

  afterEach(() => http.verify());

  function entrar(sub: string, hiddenKeys: string[], roles: string[] = ['PRACTITIONER']): void {
    session.start({ accessToken: jwt({ sub, roles, tenants: ['t-1'] }), refreshToken: 'r' });
    TestBed.tick();
    http.expectOne('/me/ui-visibility').flush({ hiddenKeys, version: 'v1', generatedAt: '2026-10-31T10:00:00Z' });
  }

  const rutas = (): string[] => [
    ...nav.pinnedItems().map((i) => i.route),
    ...nav.menu().flatMap((g) => g.items.map((i) => i.route)),
  ];

  it('sin reglas el menú es exactamente el de siempre', () => {
    entrar('u-1', []);
    const sinReglas = rutas();
    expect(sinReglas.length).toBeGreaterThan(3);
    expect(sinReglas).toContain('/my-account');
  });

  it('una pantalla oculta sale del menú, de «Tus accesos» (visibleSections) y de los destinos fijos', () => {
    entrar('u-0', []);
    const antes = rutas();
    const visibles = nav.visibleSections().map((s) => s.path);
    const fija = nav.pinnedItems()[0];
    const suelta = nav.menu().flatMap((g) => g.items)[0];
    expect(fija).toBeDefined();
    expect(suelta).toBeDefined();
    const rutaFija = fija!.route.slice(1);
    const rutaSuelta = suelta!.route.slice(1);

    session.clear();
    TestBed.tick();
    entrar('u-1', [navScreenKey(rutaFija), navScreenKey(rutaSuelta)]);

    expect(rutas()).not.toContain(fija!.route);
    expect(rutas()).not.toContain(suelta!.route);
    expect(rutas()).toHaveLength(antes.length - 2);
    expect(nav.visibleSections().map((s) => s.path)).toHaveLength(visibles.length - 2);
  });

  it('otro rol conserva su menú intacto cuando la regla no lo alcanza', () => {
    entrar('u-0', [], ['PATIENT']);
    const delPaciente = rutas();
    session.clear();
    TestBed.tick();

    // Una regla que el servidor aplica a OTROS (no está en las claves ocultas de este usuario) no cambia nada.
    entrar('u-2', [], ['PATIENT']);
    expect(rutas()).toEqual(delPaciente);
  });

  it('un grupo cuyas pantallas quedan todas ocultas desaparece (no queda un rótulo vacío)', () => {
    entrar('u-0', []);
    const grupo = nav.menu()[0];
    expect(grupo).toBeDefined();
    const ocultas = grupo!.items.map((i) => navScreenKey(i.route.slice(1)));
    const etiqueta = grupo!.label;
    session.clear();
    TestBed.tick();
    entrar('u-1', [navGroupKey(etiqueta), ...ocultas]);

    expect(nav.menu().map((g) => g.label)).not.toContain(etiqueta);
  });

  it('si las reglas no se pudieron leer, el menú queda completo (falla abierto)', () => {
    session.start({ accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] }), refreshToken: 'r' });
    TestBed.tick();
    const completo = rutas();
    http.expectOne('/me/ui-visibility').flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'x' });
    expect(rutas()).toEqual(completo);
  });
});

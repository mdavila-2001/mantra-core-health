import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { SessionStore } from '../../core/auth/session.store';
import { NavigationService } from '../../core/navigation/navigation.service';
import { NAV_ICON_NAMES } from '../../core/navigation/navigation.types';
import {
  NAV_ICON_NAMES as NAV_ICON_NAMES_DEL_NAV,
  type NavSection,
} from '../../shared/components/organisms/side-nav/side-nav.types';
import { ShellLayout } from './shell-layout';

/**
 * `ShellLayout` es el layout de **todo lo autenticado** y hasta ahora no tenía
 * prueba. Lo que fija acá es lo que un refactor rompería sin avisar: que el
 * usuario, las organizaciones y el menú **derivan de la sesión**, y que cambiar
 * de organización vuelve al panel.
 */
function jwt(payload: Record<string, unknown>): string {
  /**
   * base64url **sobre UTF-8**, como el token real.
   *
   * `btoa(JSON.stringify(...))` a secas no sirve: es Latin-1, así que un nombre
   * con acentos sale como un byte que no es UTF-8 válido y `decodeAccessToken`
   * —que decodifica con `TextDecoder`, precisamente para que los acentos no se
   * rompan— devuelve un carácter de reemplazo. El defecto sería del doble de
   * prueba, no del código.
   */
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    const binario = String.fromCharCode(...bytes);
    return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

describe('ShellLayout', () => {
  let fixture: ComponentFixture<ShellLayout>;
  let component: ShellLayout;
  let session: SessionStore;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShellLayout],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ShellLayout);
    component = fixture.componentInstance;
    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
  });

  /**
   * Los miembros son `protected`: la plantilla los usa, la prueba también.
   *
   * Los métodos se devuelven **ligados** al componente: extraerlos sueltos
   * dejaría `this` sin definir, y `logout()` fallaría al buscar `this.auth`.
   */
  function interno<T>(nombre: string): T {
    const valor = (component as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(component) : valor) as T;
  }

  function abrirSesion(claims: Record<string, unknown>) {
    session.start({ accessToken: jwt(claims), refreshToken: 'r-1' });
  }

  it('sin sesión no expone usuario', () => {
    expect(interno<() => unknown>('user')()).toBeNull();
  });

  it('el usuario deriva del token', () => {
    abrirSesion({ sub: 'u-1', name: 'Ana Salas', roles: ['PATIENT'], tenants: ['t-1'] });

    const user = interno<() => { displayName: string; roles: readonly string[] } | null>('user')();
    expect(user?.displayName).toBe('Ana Salas');
    expect(user?.roles).toEqual(['PATIENT']);
  });

  it('sin nombre en el token cae al identificador, para que el encabezado no quede vacío', () => {
    abrirSesion({ sub: 'u-1', roles: [], tenants: ['t-1'] });

    expect(interno<() => { displayName: string } | null>('user')()?.displayName).toBe('u-1');
  });

  it('las organizaciones salen del token, con su nombre legible', () => {
    abrirSesion({
      sub: 'u-1',
      roles: [],
      tenants: ['t-1', 't-2'],
      tenantNames: { 't-1': 'Clínica Norte' },
    });

    const tenants = interno<() => readonly { id: string; name: string }[]>('tenants')();
    expect([...tenants]).toEqual([
      { id: 't-1', name: 'Clínica Norte' },
      // Sin nombre declarado cae al identificador: feo, pero preferible a una
      // fila vacía donde debería ir una organización.
      { id: 't-2', name: 't-2' },
    ]);
  });

  function rutasDelMenu(): readonly string[] {
    const secciones =
      interno<() => readonly { items: readonly { route: string }[] }[]>('sections')();
    return secciones.flatMap((s) => [...s.items].map((i) => i.route));
  }

  it('el menú solo ofrece rutas que existen', () => {
    // «un ítem que lleva a una ruta vacía es peor que no tenerlo».
    //
    // Sin sesión los roles son `[]`, así que solo quedan las secciones que no
    // exigen ninguno: el panel y el autoservicio. La vitrina la agrega el
    // armazón porque no es una sección del producto.
    expect(rutasDelMenu()).toEqual([
      '/panel',
      '/mi-cuenta',
      '/mi-cuenta/turnos',
      '/identidad/verificar',
      '/identidad/casos',
      '/design-system',
    ]);
  });

  it('el menú crece con los roles del token, sin que el armazón sepa cuáles hay', () => {
    abrirSesion({ sub: 'u-1', roles: ['SECURITY_ADMIN'], tenants: ['t-1'] });

    // El armazón no nombra ninguna sección: las pide al registro. Esta prueba
    // es la que se rompería si alguien volviera a escribir el menú a mano acá.
    expect(rutasDelMenu()).toContain('/administracion/usuarios');
  });

  it('la vitrina queda al final: es herramienta de quien construye, no del producto', () => {
    expect(rutasDelMenu().at(-1)).toBe('/design-system');
  });

  /**
   * El armazón es **el único lugar que puede ver las dos capas**: `core/` no
   * importa de `shared/` (lo hace cumplir `scripts/check-architecture.mjs`), así
   * que el registro declara sus nombres de ícono y el nav declara los suyos.
   *
   * Que sean dos listas es correcto —una dice qué secciones hay, la otra qué
   * sabe dibujar el componente—, pero si se separan el registro pediría un ícono
   * que el nav no tiene y saldría el de reserva, sin que nada avise. Esta prueba
   * es el punto de encuentro donde eso se detecta.
   */
  it('los nombres de ícono del registro y los del nav no se separaron', () => {
    expect([...NAV_ICON_NAMES]).toEqual([...NAV_ICON_NAMES_DEL_NAV]);
  });

  it('lo que produce el registro encaja en lo que el nav consume', () => {
    // La comprobación de verdad la hace el compilador con esta asignación: si
    // las dos formas dejaran de coincidir, esto no compilaría. El `expect` está
    // para que la prueba tenga un aserto y no parezca vacía.
    const menu: readonly NavSection[] = TestBed.inject(NavigationService).menu();

    expect(Array.isArray(menu)).toBe(true);
  });

  it('cambiar de organización vuelve al panel: es un cambio de contexto de datos', async () => {
    abrirSesion({ sub: 'u-1', roles: [], tenants: ['t-1', 't-2'] });
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    interno<(id: string) => void>('changeTenant')('t-2');

    expect(session.activeTenantId()).toBe('t-2');
    // No se recarga la vista actual: podría ser el detalle de un recurso que en
    // esta organización no existe.
    expect(navegar).toHaveBeenCalledWith('/panel');
  });

  it('cerrar sesión limpia y manda al login', () => {
    abrirSesion({ sub: 'u-1', roles: [], tenants: ['t-1'] });
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    interno<() => void>('logout')();

    expect(navegar).toHaveBeenCalledWith('/auth');
  });
});

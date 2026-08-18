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
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        /* Rutas de mentira con las mismas direcciones que el menú: al armazón
           sólo le importa la URL, no qué componente hay del otro lado. Sin
           ellas `navigateByUrl` rechaza y la marca de «acá estás» no se puede
           comprobar. */
        provideRouter([
          { path: 'my-account', children: [] },
          { path: 'my-account/identity/verify', children: [] },
          { path: 'my-account/appointments/book/:id', children: [] },
        ]),
      ],
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
      '/dashboard',
      // Los tutoriales tampoco exigen rol.
      '/tutorials',
      // Carril P2: la mensajería tampoco exige rol. El filtro real es tener
      // perfil público de `community`, que es un dato de la cuenta.
      '/messaging',
      // La **Guía de profesionales** ya no está: desde la corrección #2 del
      // 15/08/2026 declara `roles: ['PATIENT']` y excluyentes, y una sesión sin
      // roles no es una sesión de paciente. El directorio de laboratorios sí
      // sigue: es oferta publicada, no PHI, y lo consulta cualquiera que
      // necesite un estudio.
      '/laboratory-directory',
      // El glosario tampoco: accesible por cada profesional, no sólo por
      // quien administra.
      '/glossary',
      '/my-account',
      '/my-account/appointments',
      // El archivo clínico del paciente (carril 09). Sin rol por lo mismo que
      // «Mis turnos»: el filtro real es tener perfil de paciente, que es un
      // dato de la cuenta y no un rol.
      '/my-account/medical-record',
      // Los resultados propios no exigen rol por lo mismo que los turnos: el
      // filtro real es tener perfil de paciente, que es un dato de la cuenta.
      '/my-account/diagnostic-results',
      // Los cuestionarios propios tampoco exigen rol: el filtro real es tener
      // perfil de paciente, que es un dato de la cuenta y no un rol.
      '/my-account/questionnaires',
      '/my-account/identity/verify',
      '/my-account/identity/cases',
      '/design-system',
    ]);
  });

  it('el menú crece con los roles del token, sin que el armazón sepa cuáles hay', () => {
    abrirSesion({ sub: 'u-1', roles: ['SECURITY_ADMIN'], tenants: ['t-1'] });

    // El armazón no nombra ninguna sección: las pide al registro. Esta prueba
    // es la que se rompería si alguien volviera a escribir el menú a mano acá.
    expect(rutasDelMenu()).toContain('/administration/users');
  });

  it('la vitrina queda al final: es herramienta de quien construye, no del producto', () => {
    expect(rutasDelMenu().at(-1)).toBe('/design-system');
  });

  function rotulosDelMenu(): readonly string[] {
    const secciones =
      interno<() => readonly { items: readonly { label: string }[] }[]>('sections')();
    return secciones.flatMap((s) => [...s.items].map((i) => i.label));
  }

  it('al paciente no se le ofrece la vitrina; a quien administra, sí', () => {
    // H-07: el paciente nunca ve vocabulario de sistema, y «Sistema de diseño»
    // es una herramienta de desarrollo, no algo de su cuenta.
    abrirSesion({ sub: 'u-1', roles: ['USER', 'PATIENT'], tenants: ['t-1'] });
    expect(rotulosDelMenu()).not.toContain('Sistema de diseño');
    expect(rutasDelMenu()).not.toContain('/design-system');

    abrirSesion({ sub: 'u-2', roles: ['SECURITY_ADMIN'], tenants: ['t-1'] });
    expect(rotulosDelMenu()).toContain('Sistema de diseño');
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
    expect(navegar).toHaveBeenCalledWith('/dashboard');
  });

  /**
   * El armazón dejó de delegar en el organismo `app-shell` y pinta el marco
   * REDSAT directamente. Estas pruebas fijan lo que ese cambio podría romper
   * en silencio: la geometría del marco —que es lo que la hoja de la bóveda
   * espera encontrar— y que el menú siga saliendo del registro de secciones.
   */
  describe('marco REDSAT', () => {
    function raiz(): HTMLElement {
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('monta la geometría que espera la hoja: nav, luego columna con header y contenido', () => {
      const marco = raiz().querySelector('.app-shell');

      expect(marco).not.toBeNull();
      // El orden importa: en REDSAT el nav es columna de altura completa y el
      // header vive DENTRO de la columna de contenido, no encima de las dos.
      expect(marco?.children[0]?.classList.contains('app-side-nav')).toBe(true);
      expect(marco?.children[1]?.classList.contains('app-main')).toBe(true);
      expect(marco?.querySelector('.app-main > .app-header')).not.toBeNull();
      expect(marco?.querySelector('.app-main > .app-main__inner')).not.toBeNull();
    });

    it('el contenido de la ruta se pinta dentro del main, no fuera del marco', () => {
      expect(raiz().querySelector('.app-main__inner router-outlet')).not.toBeNull();
    });

    it('el nav pinta un grupo por sección del registro, con sus destinos', () => {
      const grupos = raiz().querySelectorAll('.app-side-nav__group');
      const secciones = interno<() => readonly { label: string }[]>('sections')();

      expect(grupos.length).toBe(secciones.length);
      // Sin sesión sólo quedan las secciones sin roles, más la vitrina.
      const destinos = [...raiz().querySelectorAll('[data-testid="nav-enlace"]')].map((a) =>
        a.getAttribute('data-route'),
      );
      expect(destinos).toContain('/dashboard');
      expect(destinos).toContain('/design-system');
    });

    /**
     * `aria-current="page"` significa *ésta* es la página. Marcar dos no es un
     * detalle estético: quien navega con lector de pantalla oye dos «acá
     * estás». Es exactamente lo que hace `routerLinkActive`, que compara por
     * prefijo — y por eso el marco no lo usa.
     */
    describe('la marca de «acá estás»', () => {
      async function ir(url: string) {
        await router.navigateByUrl(url);
        fixture.detectChanges();
      }

      function marcadas(): readonly (string | null)[] {
        return [...raiz().querySelectorAll('[data-testid="nav-enlace"][aria-current="page"]')].map(
          (a) => a.getAttribute('data-route'),
        );
      }

      it('en una entrada del menú, se marca esa y sólo esa', async () => {
        await ir('/my-account');

        expect(marcadas()).toEqual(['/my-account']);
      });

      it('en una hija que también está en el menú, gana la hija sobre su padre', async () => {
        await ir('/my-account/identity/verify');

        expect(marcadas()).toEqual(['/my-account/identity/verify']);
      });

      it('en una pantalla que no está en el menú, gana el ancestro más cercano', async () => {
        // La ficha de un paciente no es entrada de menú: si no se marcara
        // ninguna, la sección dejaría de decir dónde está uno.
        await ir('/my-account/appointments/book/turno-1');

        expect(marcadas()).toEqual(['/my-account/appointments']);
      });
    });

    it('el enlace de salto apunta al contenido, que es enfocable por script', () => {
      const salto = raiz().querySelector('.shell__skip-link');
      const contenido = raiz().querySelector('#contenido-principal');

      expect(salto?.getAttribute('href')).toBe('#contenido-principal');
      // `tabindex="-1"` lo hace enfocable sin meterlo en el orden de tabulación.
      expect(contenido?.getAttribute('tabindex')).toBe('-1');
    });

    it('sin sesión el header no ofrece la cuenta: no hay a quién nombrar', () => {
      expect(raiz().querySelector('[data-testid="header-cuenta"]')).toBeNull();
    });

    it('con una sola organización no se ofrece cambiarla', () => {
      abrirSesion({ sub: 'u-1', name: 'Ana Salas', roles: [], tenants: ['t-1'] });

      expect(raiz().querySelector('[data-testid="header-organizacion"]')).toBeNull();
      expect(raiz().querySelector('[data-testid="header-cuenta"]')).not.toBeNull();
    });

    function sesionConDosOrganizaciones() {
      abrirSesion({
        sub: 'u-1',
        name: 'Ana Salas',
        roles: [],
        tenants: ['t-1', 't-2'],
        tenantNames: { 't-1': 'Clínica Norte', 't-2': 'Clínica Sur' },
      });
    }

    function opcionesDeOrganizacion(): readonly Element[] {
      return [...raiz().querySelectorAll('#menu-organizaciones .app-menu-item')];
    }

    it('con varias organizaciones el selector las lista todas, con su nombre legible', () => {
      sesionConDosOrganizaciones();

      expect(raiz().querySelector('[data-testid="header-organizacion"]')).not.toBeNull();
      expect(opcionesDeOrganizacion().map((o) => o.textContent?.trim())).toEqual([
        'Clínica Norte',
        'Clínica Sur',
      ]);
    });

    it('mientras no se elija una, ninguna aparece como activa', () => {
      sesionConDosOrganizaciones();

      // Con varias organizaciones la sesión no elige por su cuenta: marcar una
      // sería afirmar un contexto de datos que la persona no eligió.
      expect(opcionesDeOrganizacion().filter((o) => o.getAttribute('aria-current'))).toHaveLength(0);
    });

    it('elegir una la marca, y sólo a ella', () => {
      sesionConDosOrganizaciones();
      // Elegir organización navega al panel, que en este banco de pruebas no
      // existe: sin este doble, el router deja una promesa rechazada suelta.
      vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      interno<(id: string) => void>('changeTenant')('t-2');

      const marcadas = opcionesDeOrganizacion().filter(
        (o) => o.getAttribute('aria-current') === 'true',
      );
      expect(marcadas).toHaveLength(1);
      expect(marcadas[0].textContent?.trim()).toBe('Clínica Sur');
    });

    it('el avatar lleva las iniciales del nombre, no el nombre entero', () => {
      abrirSesion({ sub: 'u-1', name: 'Rocío Salazar', roles: [], tenants: ['t-1'] });

      expect(raiz().querySelector('[data-testid="header-cuenta"]')?.textContent?.trim()).toBe('RS');
    });

    it('el menú de la cuenta nombra el rol en palabras, nunca con el código del token', () => {
      // H-07: «USER · PATIENT» era vocabulario de sistema a la vista del paciente.
      abrirSesion({ sub: 'u-1', name: 'Ana Salas', roles: ['USER', 'PATIENT'], tenants: ['t-1'] });

      const resumen = raiz().querySelector('.app-header__account-summary')?.textContent ?? '';
      expect(resumen).toContain('Paciente');
      expect(resumen).not.toContain('PATIENT');
      expect(resumen).not.toContain('USER');
    });
  });

  it('cerrar sesión limpia y manda al login', () => {
    abrirSesion({ sub: 'u-1', roles: [], tenants: ['t-1'] });
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    interno<() => void>('logout')();

    expect(navegar).toHaveBeenCalledWith('/auth');
  });
});

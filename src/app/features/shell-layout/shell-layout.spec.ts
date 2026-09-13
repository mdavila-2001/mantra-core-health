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
import { NAV_STORAGE_KEY } from '../../shared/components/organisms/shell/shell-service';
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
          { path: 'my-account/questionnaires', children: [] },
          { path: 'my-account/appointments/book/:id', children: [] },
          { path: 'settings', children: [] },
          // Dos de los cuatro directorios y una ficha: no ocupan renglón desde
          // el 08/09/2026, y son con lo que se comprueba que la portada se
          // marca por ellos.
          { path: 'laboratory-directory', children: [] },
          { path: 'laboratory-directory/:id', children: [] },
          { path: 'clinics-directory', children: [] },
          // El panel: es donde la flecha de volver NO se dibuja.
          { path: 'dashboard', children: [] },
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

  /**
   * Todo lo que la barra ofrece, en el orden en que se dibuja: primero los dos
   * destinos fijos —«Mi perfil» y «Notificaciones», sueltos arriba desde el
   * 07/09/2026— y después los grupos.
   */
  function rutasDelMenu(): readonly string[] {
    const fijos = interno<() => readonly { route: string }[]>('destinosFijos')();
    const secciones =
      interno<() => readonly { items: readonly { route: string }[] }[]>('sections')();
    return [...fijos.map((i) => i.route), ...secciones.flatMap((s) => [...s.items].map((i) => i.route))];
  }

  it('el menú solo ofrece rutas que existen', () => {
    // «un ítem que lleva a una ruta vacía es peor que no tenerlo».
    //
    // Sin sesión los roles son `[]`, así que solo quedan las secciones que no
    // exigen ninguno: el panel y el autoservicio. La vitrina la agrega el
    // armazón porque no es una sección del producto.
    expect(rutasDelMenu()).toEqual([
      // Los dos destinos fijos, sueltos y arriba de todo.
      '/my-account',
      '/notification-center',
      '/dashboard',
      // Los tutoriales tampoco exigen rol.
      '/tutorials',
      // Carril P2: la mensajería tampoco exige rol. El filtro real es tener
      // perfil público de `community`, que es un dato de la cuenta.
      '/messaging',
      // La portada de directorios (FT-18, `roles: [ANY_ROLE]`) tampoco exige
      // rol: no es un directorio en sí, es su índice.
      //
      // **Y desde el 08/09/2026 es la única del bloque que ocupa renglón.**
      // Los cuatro directorios —laboratorios, clínicas, farmacias, médicos—
      // siguen sin exigir rol y se siguen alcanzando; se entra a ellos por
      // esta portada, que es la pantalla que dice qué hay en cada uno. Ver
      // `navigation.map.ts`, sección `directories`.
      '/directories',
      // El glosario ya NO está: desde el 18/08/2026 (feedback de la analista,
      // F-03) declara los roles de quien atiende, y una sesión sin roles no es
      // de nadie que atienda.
      //
      // «Tu organización» tampoco: no pide rol, pero sí membresía
      // (`requiresTenant`, F-31), y esta sesión no pertenece a ninguna.
      //
      // «Mi perfil» ya no aparece en este tramo: encabeza la lista como destino
      // fijo, fuera del grupo.
      '/my-account/appointments',
      // El archivo clínico del paciente (carril 09). Sin rol por lo mismo que
      // «Mis turnos»: el filtro real es tener perfil de paciente, que es un
      // dato de la cuenta y no un rol.
      '/my-account/medical-record',
      // Los resultados propios no exigen rol por lo mismo que los turnos: el
      // filtro real es tener perfil de paciente, que es un dato de la cuenta.
      '/my-account/diagnostic-results',
      // Las órdenes propias, la otra mitad del mismo circuito. Tampoco exigen
      // rol: el filtro real es tener perfil de paciente.
      '/my-account/diagnostic-orders',
      // Los cuestionarios propios tampoco exigen rol: el filtro real es tener
      // perfil de paciente, que es un dato de la cuenta y no un rol.
      '/my-account/questionnaires',
      // El centro de notificaciones tampoco aparece acá: es el otro destino
      // fijo. Sigue sin exigir rol —cualquiera con sesión tiene bandeja—; lo
      // que cambió es dónde se dibuja.
      // «Preferencias de avisos» ya NO está: dejó de ser una sección y pasó a
      // ser un panel de Ajustes. Y Ajustes tampoco ocupa renglón —declara
      // `fueraDelMenuPara: [ANY_ROLE]`—, porque se entra por el ícono del
      // encabezado: configurar no es un destino de trabajo.
      //
      // La verificación de identidad y su historial salieron del menú mientras
      // el producto no la ofrezca: ver `VERIFICACION_DE_IDENTIDAD_OFRECIDA`.
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
   * ALOVIDA directamente. Estas pruebas fijan lo que ese cambio podría romper
   * en silencio: la geometría del marco —que es lo que la hoja de la bóveda
   * espera encontrar— y que el menú siga saliendo del registro de secciones.
   */
  describe('marco ALOVIDA', () => {
    function raiz(): HTMLElement {
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('monta la geometría que espera la hoja: nav, luego columna con header y contenido', () => {
      const marco = raiz().querySelector('.app-shell');

      expect(marco).not.toBeNull();
      // El orden importa: en ALOVIDA el nav es columna de altura completa y el
      // header vive DENTRO de la columna de contenido, no encima de las dos.
      expect(marco?.children[0]?.classList.contains('app-side-nav')).toBe(true);
      expect(marco?.children[1]?.classList.contains('app-main')).toBe(true);
      expect(marco?.querySelector('.app-main > .app-header')).not.toBeNull();
      expect(marco?.querySelector('.app-main > .app-main__inner')).not.toBeNull();
    });

    it('el contenido de la ruta se pinta dentro del main, no fuera del marco', () => {
      expect(raiz().querySelector('.app-main__inner router-outlet')).not.toBeNull();
    });

    /**
     * El único escalón plegable de la barra, y los dominios que no lo tienen.
     *
     * Cincuenta y cinco secciones no entran en una lista, así que el dominio
     * pliega — y **ahí se termina**: adentro van los destinos, no otro
     * desplegable. Lo que estas pruebas cuidan no es el `<details>` —eso lo hace
     * el navegador— sino las tres decisiones que sí son nuestras: que no se
     * anide un segundo escalón, qué se dibuja abierto sin que nadie lo toque, y
     * qué dominios no se dibujan como contenedor en absoluto.
     *
     * Las pruebas de plegado usan una sesión de administración a propósito: el
     * paciente ya no pliega nada —«General» y «Mi cuenta» están aplanados— y
     * probar el plegado con quien no lo ve sería probarlo contra un DOM vacío.
     */
    describe('los desplegables', () => {
      function conSesion(roles: readonly string[]) {
        abrirSesion({ sub: 'u-1', roles, tenants: [] });
        fixture.detectChanges();
      }

      it('cada grupo que se dibuja es un desplegable con su ícono y su rótulo', () => {
        conSesion(['SECURITY_ADMIN']);
        const grupos = [...raiz().querySelectorAll('[data-testid="nav-grupo"]')];

        expect(grupos.length).toBeGreaterThan(0);
        for (const grupo of grupos) {
          expect(grupo.tagName).toBe('DETAILS');
          // El ícono del grupo va en el `summary`, no adentro: es lo único que
          // queda a la vista cuando el grupo está plegado.
          expect(grupo.querySelector('summary app-nav-icon')).not.toBeNull();
          expect(grupo.querySelector('summary .app-side-nav__eyebrow')?.textContent?.trim()).toBe(
            grupo.getAttribute('data-grupo'),
          );
        }
      });

      it('todo destino de la barra lleva ícono: ninguno queda mudo', () => {
        conSesion(['PATIENT']);

        const enlaces = [...raiz().querySelectorAll('[data-testid="nav-enlace"]')];
        expect(enlaces.length).toBeGreaterThan(0);
        for (const enlace of enlaces) {
          expect(enlace.querySelector('app-nav-icon'), enlace.textContent ?? '').not.toBeNull();
        }
      });

      it('ningún desplegable cuelga de otro: un nivel es el tope', () => {
        // El guardia del pedido. Acá hubo un segundo escalón —el bloque de cosas
        // parecidas— y con él entrar a una pantalla costaba tres clics, dos de
        // ellos sobre rótulos que no llevan a ninguna parte.
        //
        // Se comprueba sobre el DOM y con el rol que más secciones ve, que es
        // donde un segundo nivel volvería a aparecer primero. Es una prueba de
        // ausencia a propósito: lo que no se puede permitir no es un bloque en
        // particular sino la forma.
        conSesion(['SECURITY_ADMIN']);

        const plegables = [...raiz().querySelectorAll('details')];
        expect(plegables.length).toBeGreaterThan(0);
        for (const plegable of plegables) {
          const adentro = plegable.querySelector('details');
          expect(adentro, plegable.getAttribute('data-grupo') ?? '').toBeNull();
        }
      });

      it('todo destino está a dos clics: abrir el dominio y elegir', () => {
        // El corolario de lo anterior, dicho desde el lado de quien navega:
        // entre el borde de la barra y cualquier enlace hay, como mucho, un
        // `<details>` que abrir.
        conSesion(['SECURITY_ADMIN']);

        const enlaces = [...raiz().querySelectorAll('[data-testid="nav-enlace"]')];
        expect(enlaces.length).toBeGreaterThan(0);
        for (const enlace of enlaces) {
          let plegables = 0;
          for (let nodo = enlace.parentElement; nodo !== null; nodo = nodo.parentElement) {
            if (nodo === raiz()) {
              break;
            }
            if (nodo.tagName === 'DETAILS') {
              plegables += 1;
            }
          }
          expect(plegables, enlace.getAttribute('data-route') ?? '').toBeLessThanOrEqual(1);
        }
      });

      it('el paciente no abre nada: sus destinos están todos a un clic', () => {
        // «General» y «Mi cuenta» están en `GRUPOS_APLANADOS`, y son los dos
        // únicos dominios que el paciente ve. El resto de los roles abre un
        // dominio y elige; el paciente ni eso.
        conSesion(['PATIENT']);

        expect(raiz().querySelectorAll('[data-testid="nav-grupo"]').length).toBe(0);
        expect(raiz().querySelectorAll('details').length).toBe(0);

        // Y no perdió un solo destino en el camino: los que colgaban de un
        // bloque plegado siguen ahí, ahora sueltos.
        const enlaces = [...raiz().querySelectorAll('[data-testid="nav-enlace"]')].map((a) =>
          a.getAttribute('data-route'),
        );
        expect(enlaces).toContain('/my-account/appointments');
        expect(enlaces).toContain('/my-account/pharmacy-orders');
        expect(enlaces).toContain('/my-account/loyalty');
        expect(enlaces).toContain('/my-account/medical-record');
        expect(enlaces).toContain('/my-account/questionnaires');
        expect(enlaces).toContain('/messaging');
        expect(enlaces).toContain('/directories');
        expect(enlaces).toContain('/nearby-places');
        // Los fijos de arriba no se movieron: siguen siendo los primeros.
        expect(enlaces.slice(0, 2)).toEqual(['/my-account', '/notification-center']);
      });

      function rutasDibujadas(): readonly (string | null)[] {
        return [...raiz().querySelectorAll('[data-testid="nav-enlace"]')].map((a) =>
          a.getAttribute('data-route'),
        );
      }

      /** Si las rutas salieron una detrás de la otra, sin nada en el medio. */
      function seguidas(enlaces: readonly (string | null)[], rutas: readonly string[]): boolean {
        const posiciones = rutas.map((ruta) => enlaces.indexOf(ruta));
        expect(posiciones, rutas.join(', ')).not.toContain(-1);
        return Math.max(...posiciones) - Math.min(...posiciones) === rutas.length - 1;
      }

      it('sin rótulo que las agrupe, las cosas parecidas siguen saliendo seguidas', () => {
        // Sin el rótulo, el orden es lo único que queda diciendo que «Mis
        // citas», «Mis pedidos» y «Mis puntos» son la misma clase de cosa. Por
        // eso la barra recorre los bloques y no la lista plana del grupo: por
        // `items` el orden es el del registro, y ahí las cuatro pantallas
        // clínicas se meten entre las gestiones.
        conSesion(['PATIENT']);

        const enlaces = rutasDibujadas();
        expect(
          seguidas(enlaces, [
            '/my-account/appointments',
            '/my-account/pharmacy-orders',
            '/my-account/loyalty',
          ]),
        ).toBe(true);
        expect(
          seguidas(enlaces, [
            '/my-account/medical-record',
            '/my-account/diagnostic-results',
            '/my-account/diagnostic-orders',
            '/my-account/questionnaires',
          ]),
        ).toBe(true);
      });

      it('y también dentro de un dominio que pliega, que es donde se perdió el rótulo', () => {
        // El caso que nació al retirar el segundo escalón: «Red de salud» era un
        // desplegable con su rótulo, y ahora sus destinos son renglones más de
        // «Administración». Lo único que los mantiene juntos es el recorrido por
        // bloques.
        //
        // Se comprueba contra **todos** los bloques que la barra recibió, y no
        // contra un puñado de rutas escritas acá: qué ve un administrador
        // depende de los roles de cada sección, y una lista a mano se vuelve
        // falsa —o inalcanzable— en cuanto una cambia.
        conSesion(['SECURITY_ADMIN']);

        const enlaces = rutasDibujadas();
        const bloques = interno<
          () => readonly {
            readonly aplanado?: boolean;
            readonly blocks?: readonly { readonly items: readonly { readonly route: string }[] }[];
          }[]
        >('sections')()
          .filter((grupo) => grupo.aplanado !== true)
          .flatMap((grupo) => grupo.blocks ?? [])
          .filter((bloque) => bloque.items.length > 1);

        expect(bloques.length, 'ningún bloque de más de uno se dibujó').toBeGreaterThan(0);
        for (const bloque of bloques) {
          const rutas = bloque.items.map((item) => item.route);
          expect(seguidas(enlaces, rutas)).toBe(true);
        }
      });

      /**
       * El primer dominio plegable que la barra dibujó, y uno de sus destinos.
       *
       * Sale del DOM y no de una constante para que la prueba no dependa de qué
       * secciones ve hoy un administrador: lo que se verifica es la regla —el
       * dominio de la pantalla actual se abre solo—, no el reparto, que tiene
       * sus propias pruebas.
       */
      function primerGrupoDibujado() {
        const grupo = raiz().querySelector('[data-testid="nav-grupo"]');
        const destino = grupo
          ?.querySelector('[data-testid="nav-enlace"]')
          ?.getAttribute('data-route');
        expect(grupo, 'la sesión de prueba no dibujó ningún dominio plegable').not.toBeNull();
        expect(destino, 'el dominio no tiene destinos').toBeTruthy();
        // Las rutas de mentira del banco son un puñado elegido a mano, y el
        // destino de esta prueba sale del menú: se declara la que toque, o
        // `navigateByUrl` rechaza y la prueba falla por el doble, no por el
        // código.
        router.resetConfig([...router.config, { path: (destino ?? '').slice(1), children: [] }]);
        return {
          grupo: grupo?.getAttribute('data-grupo') ?? '',
          destino: destino ?? '',
        };
      }

      it('el grupo de la pantalla actual se dibuja abierto', async () => {
        conSesion(['SECURITY_ADMIN']);
        const { grupo, destino } = primerGrupoDibujado();

        await router.navigateByUrl(destino);
        fixture.detectChanges();

        // Nadie lo desplegó: si no se abriera solo, la barra no diría dónde está
        // uno parado y habría que buscarlo abriendo dominios a mano.
        expect(raiz().querySelector<HTMLDetailsElement>(`[data-grupo="${grupo}"]`)?.open).toBe(true);
      });

      it('lo que la persona pliega a mano gana sobre eso, y navegar no lo reabre', async () => {
        conSesion(['SECURITY_ADMIN']);
        const { grupo, destino } = primerGrupoDibujado();
        await router.navigateByUrl(destino);
        fixture.detectChanges();

        interno<(clave: string, abierto: boolean) => void>('alPlegar')(grupo, false);
        fixture.detectChanges();

        expect(raiz().querySelector<HTMLDetailsElement>(`[data-grupo="${grupo}"]`)?.open).toBe(
          false,
        );

        // Volver a la misma pantalla no le discute la decisión a quien la tomó.
        await router.navigateByUrl(destino);
        fixture.detectChanges();
        expect(raiz().querySelector<HTMLDetailsElement>(`[data-grupo="${grupo}"]`)?.open).toBe(
          false,
        );
      });
    });

    /**
     * Recoger la barra.
     *
     * Es un cambio de ancho, no de contenido: recogida sigue teniendo los
     * mismos destinos, con el mismo nombre, en el mismo orden. Lo que estas
     * pruebas cuidan es justamente eso —que al encogerse no se pierda ni un
     * nombre accesible— más el gesto que la devuelve, que es lo único que no
     * puede hacer la hoja de estilos sola.
     */
    describe('la barra recogida', () => {
      beforeEach(() => {
        // `ShellService` persiste la preferencia en `localStorage` y la lee
        // tras el primer render. Sin limpiarla, el estado de una prueba se
        // filtra a la siguiente y el orden de ejecución pasa a importar.
        try {
          localStorage.removeItem(NAV_STORAGE_KEY);
        } catch {
          // Sin storage no hay nada que limpiar, que es el mismo caso que el
          // servicio ya tolera.
        }
        abrirSesion({ sub: 'u-1', roles: ['SECURITY_ADMIN'], tenants: [] });
        fixture.detectChanges();
      });

      function boton(): HTMLButtonElement {
        const control = raiz().querySelector<HTMLButtonElement>('[data-testid="nav-recoger"]');
        expect(control, 'la barra no dibujó el botón de recoger').not.toBeNull();
        return control as HTMLButtonElement;
      }

      function marco(): HTMLElement {
        return raiz().querySelector('.app-shell') as HTMLElement;
      }

      it('arranca desplegada y el botón lo dice', () => {
        expect(marco().classList.contains('is-nav-recogido')).toBe(false);
        expect(boton().getAttribute('aria-expanded')).toBe('true');
        // Apunta a la barra que encoge, y ese id existe en el marcado: no lo
        // inventa nadie al hidratar.
        expect(boton().getAttribute('aria-controls')).toBe('app-side-nav');
        expect(raiz().querySelector('#app-side-nav')?.classList.contains('app-side-nav')).toBe(
          true,
        );
      });

      it('un clic la recoge y otro la devuelve', () => {
        boton().click();
        fixture.detectChanges();

        expect(marco().classList.contains('is-nav-recogido')).toBe(true);
        expect(boton().getAttribute('aria-expanded')).toBe('false');
        expect(boton().getAttribute('aria-label')).toBe('Desplegar el menú');

        boton().click();
        fixture.detectChanges();

        expect(marco().classList.contains('is-nav-recogido')).toBe(false);
        expect(boton().getAttribute('aria-label')).toBe('Recoger el menú');
      });

      it('recogida no pierde ni un destino, ni el nombre de ninguno', () => {
        const antes = [...raiz().querySelectorAll('[data-testid="nav-enlace"]')].map((a) =>
          a.getAttribute('data-route'),
        );

        boton().click();
        fixture.detectChanges();

        const despues = [...raiz().querySelectorAll('[data-testid="nav-enlace"]')];
        expect(despues.map((a) => a.getAttribute('data-route'))).toEqual(antes);

        // El rótulo no se borra: se esconde de la vista. Un ícono sin nombre es
        // un destino mudo para quien usa lector de pantalla, y `display: none`
        // lo saca del árbol de accesibilidad además de la pantalla.
        for (const enlace of despues) {
          const rotulo = enlace.querySelector('.side-nav__label');
          expect(rotulo?.textContent?.trim(), enlace.getAttribute('data-route') ?? '').toBeTruthy();
          expect(rotulo?.classList.contains('solo-lectores')).toBe(true);
        }
      });

      it('recogida, el rótulo de un dominio la despliega y deja ese dominio abierto', () => {
        // Recogida, el cuerpo del dominio no se dibuja: abrir el `<details>`
        // ahí no mostraría nada. El gesto que sí sirve es desplegar la barra
        // con ese dominio abierto, y es el que el rótulo tiene que hacer.
        const { grupo } = primerGrupoDibujado();
        interno<(clave: string, abierto: boolean) => void>('alPlegar')(grupo, false);
        boton().click();
        fixture.detectChanges();

        const summary = raiz().querySelector<HTMLElement>(`[data-grupo="${grupo}"] > summary`);
        summary?.click();
        fixture.detectChanges();

        expect(marco().classList.contains('is-nav-recogido')).toBe(false);
        expect(raiz().querySelector<HTMLDetailsElement>(`[data-grupo="${grupo}"]`)?.open).toBe(true);
      });

      it('desplegada, el rótulo sigue plegando y nada más', () => {
        const { grupo } = primerGrupoDibujado();
        const antes = raiz().querySelector<HTMLDetailsElement>(`[data-grupo="${grupo}"]`)?.open;

        interno<(evento: Event, grupo: string) => void>('alTocarElDominio')(
          new Event('click', { cancelable: true }),
          grupo,
        );
        fixture.detectChanges();

        // No tocó el ancho ni forzó el estado del dominio: con la barra
        // desplegada el `<details>` se gobierna solo, que es por lo que es un
        // `<details>`.
        expect(marco().classList.contains('is-nav-recogido')).toBe(false);
        expect(raiz().querySelector<HTMLDetailsElement>(`[data-grupo="${grupo}"]`)?.open).toBe(
          antes,
        );
      });

      /** El mismo ayudante de `los desplegables`, que este bloque también usa. */
      function primerGrupoDibujado(): { grupo: string } {
        const grupo = raiz().querySelector('[data-testid="nav-grupo"]');
        expect(grupo, 'la sesión de prueba no dibujó ningún dominio plegable').not.toBeNull();
        return { grupo: grupo?.getAttribute('data-grupo') ?? '' };
      }
    });

    it('el nav pinta un grupo por sección del registro, con sus destinos', () => {
      const grupos = raiz().querySelectorAll('.app-side-nav__group');
      const secciones = interno<() => readonly { label: string; aplanado?: boolean }[]>(
        'sections',
      )();

      // Los aplanados no cuentan: no dibujan contenedor, sueltan sus destinos.
      // Lo que esta prueba cuida es que ninguna sección se quede sin pintar,
      // no que todas se pinten igual.
      expect(grupos.length).toBe(secciones.filter((s) => s.aplanado !== true).length);
      expect(raiz().querySelectorAll('[data-testid="nav-sueltos"]').length).toBe(
        secciones.filter((s) => s.aplanado === true).length,
      );
      // Sin sesión sólo quedan las secciones sin roles, más la vitrina.
      const destinos = [...raiz().querySelectorAll('[data-testid="nav-enlace"]')].map((a) =>
        a.getAttribute('data-route'),
      );
      expect(destinos).toContain('/dashboard');
      expect(destinos).toContain('/design-system');
    });

    /**
     * La flecha de volver, y el único lugar donde no va.
     *
     * El panel es el principio del camino: quien entra, aterriza ahí. No hay
     * paso propio que deshacer, así que `app-back-link` cae a su respaldo… que
     * es el panel. Pulsarla desde el panel no hacía nada o —si el historial del
     * navegador todavía traía el ingreso— devolvía a él, que se lee como haber
     * cerrado la sesión. El cliente lo reportó así el 13/09/2026.
     */
    describe('la flecha de volver', () => {
      async function ir(url: string) {
        await router.navigateByUrl(url);
        fixture.detectChanges();
      }

      function flecha(): Element | null {
        return raiz().querySelector('app-back-link');
      }

      it('no se dibuja en el panel', async () => {
        await ir('/dashboard');
        expect(flecha()).toBeNull();
      });

      it('sí se dibuja en cualquier otra pantalla', async () => {
        await ir('/my-account');
        expect(flecha()).not.toBeNull();
      });

      /** Ir y volver: la flecha reaparece al salir del panel y se va al entrar. */
      it('aparece y desaparece al cruzar el panel', async () => {
        await ir('/dashboard');
        expect(flecha()).toBeNull();

        await ir('/settings');
        expect(flecha()).not.toBeNull();

        await ir('/dashboard');
        expect(flecha()).toBeNull();
      });
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
        await ir('/my-account/questionnaires');

        expect(marcadas()).toEqual(['/my-account/questionnaires']);
      });

      it('en Ajustes no se marca ningún renglón: no ocupa ninguno', async () => {
        // No es un olvido de la marca sino la consecuencia de entrar por el
        // ícono: Ajustes no cuelga de ninguna entrada del menú, así que no hay
        // renglón que decir «acá estás». Marcar «Mi perfil» —su prefijo más
        // cercano no es ninguno— mentiría sobre dónde está uno.
        await ir('/settings');

        expect(marcadas()).toEqual([]);
      });

      it('en una pantalla que no está en el menú, gana el ancestro más cercano', async () => {
        // La ficha de un paciente no es entrada de menú: si no se marcara
        // ninguna, la sección dejaría de decir dónde está uno.
        await ir('/my-account/appointments/book/turno-1');

        expect(marcadas()).toEqual(['/my-account/appointments']);
      });

      it('dentro de un directorio se marca «Directorios», que es por donde se entró', async () => {
        // La otra mitad del cambio del 08/09/2026. Los cuatro directorios
        // dejaron de ocupar renglón y se abren desde su portada; sin
        // `representaEnElMenu` la barra quedaba **entera apagada** mientras se
        // los recorría, que es la única pregunta que la barra contesta
        // siempre. No es un ancestro —`/directories` no es prefijo de
        // `/laboratory-directory`—, es una relación declarada en el registro.
        await ir('/laboratory-directory');
        expect(marcadas()).toEqual(['/directories']);

        // Y sigue siendo una sola marca, que es la regla de todo este bloque.
        await ir('/clinics-directory');
        expect(marcadas()).toEqual(['/directories']);
      });

      it('una hija de lo representado también marca la portada', async () => {
        // El detalle de un laboratorio tampoco tiene renglón. Se compara por
        // prefijo de ruta, igual que con cualquier otro ancestro.
        await ir('/laboratory-directory/lab-1');

        expect(marcadas()).toEqual(['/directories']);
      });
    });

    it('el encabezado ofrece Ajustes como enlace, no como botón', () => {
      // Enlace y no botón porque navega: se abre en otra pestaña y se copia la
      // dirección, que es lo que cualquiera espera de algo que lleva a una
      // pantalla. Y con nombre accesible, porque es un ícono solo.
      const ajustes = raiz().querySelector<HTMLAnchorElement>('[data-testid="header-ajustes"]');

      expect(ajustes?.tagName).toBe('A');
      expect(ajustes?.getAttribute('href')).toBe('/settings');
      expect(ajustes?.getAttribute('aria-label')).toBe('Ajustes');
    });

    it('el conmutador de tema ya no vive suelto en el encabezado', () => {
      // Se mudó a Ajustes. Suelto acá, el tema parecía la única preferencia
      // que el producto tiene; ahora es una de tres y viven juntas.
      expect(raiz().querySelector('[app-theme-toggle]')).toBeNull();
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
      expect(opcionesDeOrganizacion().filter((o) => o.getAttribute('aria-current'))).toHaveLength(
        0,
      );
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

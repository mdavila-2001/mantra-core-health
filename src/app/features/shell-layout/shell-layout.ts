import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { esPaciente, etiquetasDeRoles } from '../../core/auth/role-labels';
import { LOGIN_ROUTE } from '../../core/http/auth.interceptor';
import { Breakpoints } from '../../core/layout/breakpoints';
import { NavigationService } from '../../core/navigation/navigation.service';
import type { HeaderUser } from '../../shared/components/organisms/header/header.types';
import type { NavSection } from '../../shared/components/organisms/side-nav/side-nav.types';
import type { TenantOption } from '../../shared/components/organisms/tenant-switcher/tenant-switcher.types';
import { TutorialOverlay } from '../../shared/components/organisms/tutorial-overlay/tutorial-overlay';
import { TutorialTarget } from '../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';
// Carril P1: la campana. Es propiedad de P1 durante la tanda —el README lo
// declara hotspot— y se monta acá porque el armazón es lo único que existe
// exactamente una vez por sesión con interfaz.
import { NotificationBell } from '../../shared/components/organisms/notification-bell/notification-bell';
import { NavIcon } from '../../shared/components/atoms/nav-icon/nav-icon';
import { Tooltip } from '../../shared/components/atoms/tooltip/tooltip';
import { TutorialRegistry } from '../../core/tutorials/tutorial.registry';
import { TUTORIALS } from '../../core/tutorials/definitions';

/**
 * Si un destino de la barra queda debajo de la URL actual.
 *
 * Prefijo de **ruta**, no de texto: `/administration/patients` no puede ganar
 * con `/administration/patients-archive`. Es la misma comparación que usa la
 * marca de «acá estás», y por eso vive suelta y la usan las dos.
 */
function contiene(ruta: string, url: string): boolean {
  return url === ruta || url.startsWith(`${ruta}/`);
}

/**
 * Armazón de todas las pantallas con sesión.
 *
 * `app-shell` es puro organismo: no conoce usuario, tenant ni rutas, los recibe y los reparte. Este
 * componente es **el que sí sabe**, y existe para que ese conocimiento viva en un solo lugar en vez
 * de en cada pantalla. Las rutas hijas se pintan en el `<router-outlet />` que el shell ya tiene.
 *
 * ## El menú se arma con lo que la sesión permite
 *
 * `sections` se recalcula a partir de los roles del token. **Esconder un ítem no protege nada** —la
 * autoridad es la API, que valida en cada petición—; es no ofrecer una puerta que va a estar
 * cerrada. Quien escriba la URL a mano se topa con el guard primero y con un 403 después.
 *
 * > Nota de la reconciliación (2026-08-01): este componente vino del carril de Pablo y se adaptó a
 * > las superficies que quedaron en el merge — `LOGIN_ROUTE` del interceptor y el `AuthService`
 * > nuestro, del que deriva `user` y `tenants` en vez de pedirle métodos que no tiene.
 */
@Component({
  selector: 'app-shell-layout',
  imports: [
    // Un solo marcado para el destino de la barra, esté suelto o dentro de un
    // bloque: ver la nota de la plantilla `#destino`.
    NgTemplateOutlet,
    RouterLink,
    RouterOutlet,
    TutorialOverlay,
    TutorialTarget,
    NotificationBell,
    NavIcon,
    Tooltip,
  ],
  templateUrl: './shell-layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly breakpoints = inject(Breakpoints);
  private readonly navigation = inject(NavigationService);
  /* Inyectado, no global: bajo SSR no hay `document` y el armazón se renderiza
     igual en el servidor. */
  private readonly document = inject(DOCUMENT);

  protected readonly activeTenantId = this.auth.activeTenantId;

  /**
   * El shell no mide la ventana: la recibe. Sin esto el nav se queda como columna fija de 260 px
   * también en un teléfono, empujando el contenido fuera de la pantalla.
   *
   * Con el marco ALOVIDA el cajón lo resuelve la hoja por `@media`, así que esto
   * ya no gobierna el marcado; se conserva porque sigue siendo la respuesta a
   * «¿estamos en ancho de cajón?» para quien la necesite.
   */
  protected readonly isDrawer = this.breakpoints.isNavDrawer;

  /**
   * Lo que se le anuncia a un lector de pantalla al cambiar de ruta. Navegar en
   * una SPA no dispara ningún aviso del navegador: si esto no existiera, quien
   * navega a ciegas no se enteraría de que la pantalla cambió.
   */
  protected readonly anuncio = signal('');

  /** La URL de la pantalla, sin parámetros de consulta ni fragmento. */
  private readonly urlActual = signal('');

  private readonly tutorials = inject(TutorialRegistry);

  constructor() {
    // El catálogo de tutoriales se registra acá y no en un proveedor de arranque
    // porque el armazón es lo único que existe exactamente una vez por sesión
    // con interfaz. Registrar dos veces es inofensivo —`register` reemplaza, no
    // acumula— pero hacerlo en el arranque lo cargaría también en las pantallas
    // públicas, donde no hay ningún tutorial que ofrecer.
    this.tutorials.register(TUTORIALS);

    this.urlActual.set(this.rutaLimpia());
    this.router.events
      .pipe(
        filter((evento) => evento instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.urlActual.set(this.rutaLimpia());
        this.anuncio.set(
          `${this.navigation.currentSection()?.label ?? 'Pantalla'} cargada`,
        );
      });
  }

  /**
   * La entrada del menú que corresponde a la página actual, o `null`.
   *
   * ## Por qué no alcanza `routerLinkActive`
   *
   * Porque compara **por prefijo**: estando en `/my-account/identity/verify`,
   * tanto esa entrada como su padre `/my-account` quedan activas, y las dos
   * marcadas con `aria-current="page"`. Dos «acá estás» a la vez no es un
   * detalle estético: `aria-current="page"` significa *ésta* es la página, y
   * quien navega con lector de pantalla oye dos.
   *
   * `exact: true` lo rompe por el otro lado: en la ficha de un paciente
   * —`/administration/patients/<id>`, que no es entrada de menú— no se marcaría
   * ninguna, y la sección dejaría de decir dónde está uno.
   *
   * Se elige la coincidencia **más específica**: la entrada más larga que sea
   * prefijo de la URL. La hija gana a su padre cuando existe, y el padre sigue
   * ganando cuando la página no está en el menú. Es la misma regla que traía el
   * organismo `app-side-nav`, y se porta con ella.
   *
   * ## Las rutas que un renglón representa
   *
   * Un renglón se marca además por las rutas que declara `representa`
   * (`representaEnElMenu` en el registro): pantallas que se entran por él y no
   * tienen renglón propio. Nació con «Directorios» (08/09/2026), cuando los
   * cuatro directorios pasaron a abrirse desde su portada — sin esto, estar
   * dentro de uno dejaba la barra entera apagada.
   *
   * **Compiten con la ruta propia, no la pisan**: se mide el largo de la ruta
   * que emparejó, así que una entrada con renglón propio le sigue ganando a la
   * portada que la representa. Hoy no puede pasar —lo representado es
   * justamente lo que no está en el menú— y así sigue siendo cierto si mañana
   * una de las cuatro recupera su renglón.
   */
  protected readonly rutaActiva = computed<string | null>(() => {
    const url = this.urlActual();
    if (url === '') {
      return null;
    }

    // Lo que cada renglón representa se lee del menú del registro y no de
    // `sections()`: ese devuelve el contrato del organismo (`NavItem`), que a
    // propósito no sabe de rutas representadas — dibuja lo que recibe. La
    // vitrina del sistema de diseño, que `sections()` agrega por su cuenta, no
    // representa nada y entra igual por su ruta.
    const representadas = new Map<string, readonly string[]>(
      [...this.destinosFijos(), ...this.navigation.menu().flatMap((seccion) => seccion.items)]
        .filter((item) => item.representa !== undefined)
        .map((item) => [item.route, item.representa ?? []] as const),
    );

    // Los fijos entran en la cuenta: se dibujan fuera de los grupos, pero son
    // destinos del menú igual que el resto, y sin esto «Mi perfil» era la única
    // entrada de la barra que nunca se marcaba al estar parado en ella.
    return (
      [...this.destinosFijos(), ...this.sections().flatMap((seccion) => seccion.items)]
        .flatMap((item) =>
          [item.route, ...(representadas.get(item.route) ?? [])]
            .filter((ruta) => contiene(ruta, url))
            .map((ruta) => ({ renglon: item.route, largo: ruta.length })),
        )
        .reduce<{ renglon: string; largo: number } | null>(
          (mejor, actual) => (mejor === null || actual.largo > mejor.largo ? actual : mejor),
          null,
        )?.renglon ?? null
    );
  });

  private rutaLimpia(): string {
    return this.router.url.split(/[?#]/)[0];
  }

  /* ==========================================================================
      Los desplegables de la barra

      La barra tiene dos escalones plegables: el dominio (`General`, `Atención`,
      …) y, adentro, el bloque de cosas parecidas (`Directorios`, `Mi salud`).
      Los dos se comportan igual, así que los gobierna un solo par de métodos y
      un solo mapa de estado.

      **Lo abierto se calcula, y sólo se recuerda lo que la persona toca.** El
      valor por omisión es «abierto si acá adentro está la pantalla en la que
      estás»: navegar a `/my-account/diagnostic-results` abre «Mi cuenta» y «Mi
      salud» sin que nadie los despliegue, que es lo que hace que la barra
      siempre muestre dónde estás parado. Guardar el estado de los veintiún
      bloques desde el arranque haría lo contrario — congelaría el menú tal como
      quedó en la primera pantalla.
     ========================================================================== */

  /**
   * Lo que la persona plegó o desplegó a mano, por clave de desplegable.
   *
   * Una entrada acá **gana** sobre el cálculo: quien cierra «Mi cuenta**»**
   * estando adentro quiere verla cerrada, y volver a abrirla en el próximo
   * `NavigationEnd` sería pelearle al usuario. Vive en memoria y no en
   * `localStorage` a propósito: es una preferencia de la sesión de trabajo, y
   * persistirla dejaría a alguien con un menú cerrado de hace tres semanas sin
   * saber por qué.
   */
  private readonly plegadosAMano = signal<Readonly<Record<string, boolean>>>({});

  /** Clave estable de un desplegable. El grupo la prefija: hay bloques homónimos. */
  protected clavePlegable(grupo: string, bloque?: string): string {
    return bloque === undefined ? grupo : `${grupo}/${bloque}`;
  }

  /** Si algún destino de la lista es —o contiene— la pantalla actual. */
  protected contieneLaPantalla(items: readonly { route: string }[]): boolean {
    const url = this.urlActual();
    return url !== '' && items.some((item) => contiene(item.route, url));
  }

  /** Si el desplegable se dibuja abierto: lo que la persona dijo, o el cálculo. */
  protected abierto(clave: string, items: readonly { route: string }[]): boolean {
    return this.plegadosAMano()[clave] ?? this.contieneLaPantalla(items);
  }

  /**
   * Registra el pliegue manual.
   *
   * Lo dispara el evento `toggle` del propio `<details>` y no un `(click)`: así
   * queda registrado igual cuando se abre con el teclado o cuando el navegador
   * lo abre solo para buscar texto adentro.
   */
  protected alPlegar(clave: string, abierto: boolean): void {
    this.plegadosAMano.update((estado) => ({ ...estado, [clave]: abierto }));
  }

  protected readonly user = computed<HeaderUser | null>(() => {
    if (!this.auth.isAuthenticated()) {
      return null;
    }
    return {
      // El guard no deja llegar acá sin sesión; el userId es el último recurso
      // para que el header nunca quede sin nombre.
      displayName: this.auth.displayName() ?? this.auth.userId() ?? '',
      roles: this.auth.roles(),
    };
  });

  /** Las organizaciones de la sesión, ya con su nombre legible (claim `tenantNames`). */
  protected readonly tenants = computed<readonly TenantOption[]>(() =>
    this.auth.tenants().map((id) => ({ id, name: this.auth.tenantName(id) })),
  );

  /**
   * El menú del área autenticada, más la vitrina.
   *
   * Los grupos de dominio los arma `NavigationService` desde el registro de secciones, que es
   * también de donde salen las rutas: no hay forma de ofrecer acá un destino que el router no
   * declare —«un ítem que lleva a una ruta vacía es peor que no tenerlo»— porque son la misma
   * lista.
   *
   * La vitrina se agrega aparte porque **no es una sección del producto**: vive fuera del armazón,
   * no tiene módulo del modelo que la respalde y es una herramienta de quien construye. Meterla en
   * el registro la volvería una sección más, con su ficha de vista inexistente. Por lo mismo no se
   * le ofrece al paciente: es una herramienta de desarrollo, no algo de su cuenta.
   */
  protected readonly sections = computed<readonly NavSection[]>(() => {
    const menu = this.navigation.menu();
    const roles = this.auth.roles();
    // El médico tampoco la ve, y por el mismo motivo que el paciente aunque
    // sea otro: su menú es la lista cerrada de ocho del cliente (§4.H del plan
    // de UX), y una novena entrada que además es una herramienta de quien
    // construye la rompe. Quien la usa de verdad —diseño y desarrollo— entra
    // por `/design-system`, que sigue en pie.
    if (esPaciente(roles) || roles.includes('PRACTITIONER')) {
      return menu;
    }
    const vitrina = { label: 'Sistema de diseño', route: '/design-system', icon: 'settings' } as const;
    return [
      ...menu,
      {
        label: 'Herramientas',
        // La llave inglesa del set: es la única entrada del producto que no
        // configura nada ni atiende a nadie — se usa para construirlo.
        icon: 'sliders',
        items: [vitrina],
        // Un bloque de uno, que el marcado dibuja suelto. Se arma igual que los
        // del registro para que la vitrina no sea el caso especial que el
        // marcado tenga que contemplar aparte.
        blocks: [{ label: 'Herramientas', icon: 'sliders', items: [vitrina] }],
      },
    ];
  });

  /**
   * Los dos destinos que van sueltos arriba de la barra: «Mi perfil» y
   * «Notificaciones».
   *
   * Se dibujan con la MISMA plantilla que un ítem dentro de un grupo, así que
   * heredan la marca de «acá estás», el `data-route` de las pruebas y el estado
   * deshabilitado sin que haya que repetirlos. Quién los declara es el registro
   * de secciones (`pinnedTop`), no esta pantalla.
   */
  protected readonly destinosFijos = computed(() => this.navigation.pinnedItems());

  /** Nombre de la organización activa, para el rótulo del selector. */
  protected readonly organizacionActiva = computed(() => {
    const id = this.activeTenantId();
    return id ? this.auth.tenantName(id) : 'Sin organización';
  });

  /** Iniciales para el avatar: dos, que es lo que entra en el círculo. */
  protected readonly iniciales = computed(() =>
    (this.user()?.displayName ?? '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? '')
      .join(''),
  );

  /**
   * Los roles del token, en una línea legible para el menú de la cuenta.
   *
   * Van traducidos por el diccionario: el código crudo (`PATIENT`, `SECURITY_ADMIN`) es
   * vocabulario de sistema, y un rol sin etiqueta se omite antes que pintarse crudo.
   */
  protected readonly rolesLegibles = computed(() =>
    etiquetasDeRoles(this.user()?.roles ?? []).join(' · '),
  );

  /**
   * El enlace de salto mueve el foco al contenido en vez de sólo desplazar la
   * página: sin esto, quien navega con teclado saltaría visualmente pero
   * seguiría tabulando desde el menú.
   */
  protected saltarAlContenido(evento: Event): void {
    evento.preventDefault();
    const destino = this.document.getElementById('contenido-principal');
    destino?.focus();
    destino?.scrollIntoView();
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl(LOGIN_ROUTE);
  }

  /**
   * Cambiar de organización es un **cambio de contexto de datos**: lo que hubiera en pantalla
   * corresponde a la anterior. Se vuelve al panel en vez de recargar la vista actual, que podría
   * ser el detalle de un recurso que en esta organización no existe.
   */
  protected changeTenant(tenantId: string): void {
    this.auth.selectTenant(tenantId);
    void this.router.navigateByUrl('/dashboard');
  }
}

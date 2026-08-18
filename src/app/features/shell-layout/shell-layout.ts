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
import { RedsatThemeToggleDirective } from '../../core/redsat/redsat-theme-toggle.directive';
import type { HeaderUser } from '../../shared/components/organisms/header/header.types';
import type { NavSection } from '../../shared/components/organisms/side-nav/side-nav.types';
import type { TenantOption } from '../../shared/components/organisms/tenant-switcher/tenant-switcher.types';
import { TutorialOverlay } from '../../shared/components/organisms/tutorial-overlay/tutorial-overlay';
import { TutorialTarget } from '../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';
import { TutorialRegistry } from '../../core/tutorials/tutorial.registry';
import { TUTORIALS } from '../../core/tutorials/definitions';

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
    RouterLink,
    RouterOutlet,
    RedsatThemeToggleDirective,
    TutorialOverlay,
    TutorialTarget,
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
   * Con el marco REDSAT el cajón lo resuelve la hoja por `@media`, así que esto
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
   */
  protected readonly rutaActiva = computed<string | null>(() => {
    const url = this.urlActual();
    if (url === '') {
      return null;
    }

    return this.sections()
      .flatMap((seccion) => seccion.items)
      .map((item) => item.route)
      // Prefijo de ruta, no de texto: `/administration/patients` no puede
      // ganar con `/administration/patients-archive`.
      .filter((ruta) => url === ruta || url.startsWith(`${ruta}/`))
      .reduce<string | null>(
        (mejor, ruta) => (mejor === null || ruta.length > mejor.length ? ruta : mejor),
        null,
      );
  });

  private rutaLimpia(): string {
    return this.router.url.split(/[?#]/)[0];
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
    if (esPaciente(this.auth.roles())) {
      return menu;
    }
    return [
      ...menu,
      {
        label: 'Herramientas',
        items: [{ label: 'Sistema de diseño', route: '/design-system', icon: 'settings' }],
      },
    ];
  });

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

import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { esPaciente, etiquetasDeRoles } from '../../core/auth/role-labels';
import { CartStore } from '../../core/data-access/pharmacy-cart/cart.store';
import { LOGIN_ROUTE } from '../../core/http/auth.interceptor';
import { Breakpoints } from '../../core/layout/breakpoints';
import { NavigationService } from '../../core/navigation/navigation.service';
import { PatientContextService } from '../../core/patient-context/patient-context.service';
import type { HeaderUser } from '../../shared/components/organisms/header/header.types';
import type { NavSection } from '../../shared/components/organisms/side-nav/side-nav.types';
import type { TenantOption } from '../../shared/components/organisms/tenant-switcher/tenant-switcher.types';
import { ShellService } from '../../shared/components/organisms/shell/shell-service';
import { TutorialOverlay } from '../../shared/components/organisms/tutorial-overlay/tutorial-overlay';
import { TutorialTarget } from '../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';
// Carril P1: la campana. Es propiedad de P1 durante la tanda —el README lo
// declara hotspot— y se monta acá porque el armazón es lo único que existe
// exactamente una vez por sesión con interfaz.
import { NotificationBell } from '../../shared/components/organisms/notification-bell/notification-bell';
import { BackLink } from '../../shared/components/atoms/back-link/back-link';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { NavIcon } from '../../shared/components/atoms/nav-icon/nav-icon';
import { Tooltip } from '../../shared/components/atoms/tooltip/tooltip';
import { TutorialRegistry } from '../../core/tutorials/tutorial.registry';
import { TUTORIALS } from '../../core/tutorials/definitions';
import { AlovidaThemeToggleDirective } from '../../core/alovida/alovida-theme-toggle.directive';
import { ChatStore } from '../../core/messaging/chat.store';
import { PHARMACY_CART_ROUTE } from '../account/pharmacy/pharmacy.routes';
import { PHARMACY_TESTIDS } from '../account/pharmacy/pharmacy.testids';

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

/** El panel. Constante y no literal suelto: lo miran dos cosas distintas acá. */
const PANEL = '/dashboard';

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
    AlovidaThemeToggleDirective,
    RouterLink,
    RouterOutlet,
    TutorialOverlay,
    TutorialTarget,
    NotificationBell,
    BackLink,
    Badge,
    NavIcon,
    Tooltip,
  ],
  templateUrl: './shell-layout.html',
  styleUrl: './shell-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly breakpoints = inject(Breakpoints);
  private readonly navigation = inject(NavigationService);
  /* El estado de la barra recogida no es de este componente: ya vivía en
     `ShellService`, con su persistencia en `localStorage` y su lectura diferida
     a después del primer render. Acá se consume, no se reimplementa. */
  private readonly shell = inject(ShellService);
  /* Inyectado, no global: bajo SSR no hay `document` y el armazón se renderiza
     igual en el servidor. */
  private readonly document = inject(DOCUMENT);

  protected readonly activeTenantId = this.auth.activeTenantId;

  /* B.1 · por quién se está operando. El armazón es el único lugar que existe
     una vez por sesión con interfaz, así que es donde el conmutador y su aviso
     pueden vivir sin que cada pantalla los repita. */
  private readonly contextoDePaciente = inject(PatientContextService);

  protected readonly dependientes = this.contextoDePaciente.dependents;
  protected readonly pacienteActivo = this.contextoDePaciente.activePatientProfileId;
  protected readonly operandoPorDependiente = this.contextoDePaciente.isActingForDependent;
  protected readonly nombreDelPacienteActivo = this.contextoDePaciente.activePatientName;

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

  /**
   * No leídos de Chats para el ícono de la cabecera (N-01, H4.S1.M2, Q-E4).
   *
   * Es **la misma cuenta** que el título de la pestaña de `Messaging`
   * (`ChatStore.sinLeer`): el armazón no cuenta nada, la lee. Y **no enciende**
   * Chats: `iniciar()` sondea cada minuto y marca actividad, y eso sigue siendo
   * sólo de `/messaging` (`chat.store.ts`, «quien está en la agenda no tiene
   * por qué estar pidiendo conversaciones cada minuto»). Para que el número
   * esté desde la primera pantalla —y no en 0 hasta pasar por Chats— el
   * armazón pide `prepararContador()`: una lectura de la bandeja y el socket,
   * sin sondeo y sin marcar actividad (ver el constructor).
   */
  private readonly chats = inject(ChatStore);
  protected readonly chatsSinLeer = this.chats.sinLeer;

  /** El nombre accesible de Chats: el ícono solo no dice cuántos hay sin leer. */
  protected readonly etiquetaChats = computed(() => {
    const cuantos = this.chatsSinLeer();
    if (cuantos === 0) return 'Chats';
    return `Chats, ${cuantos} ${cuantos === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}`;
  });

  /**
   * El carrito de farmacia (H4.S1, carril 41/46): sólo el paciente lo ve — es
   * su compra, no una herramienta de la médica ni del resto de los roles.
   */
  private readonly cart = inject(CartStore);
  protected readonly unidadesDelCarrito = this.cart.unitCount;
  protected readonly esPacienteDelCarrito = computed(() => esPaciente(this.auth.roles()));
  protected readonly pharmacyCartRoute = PHARMACY_CART_ROUTE;
  protected readonly pharmacyTestids = PHARMACY_TESTIDS;

  /** El nombre accesible del carrito: el número y la farmacia, no sólo «Carrito». */
  protected readonly etiquetaCarrito = computed(() => {
    const unidades = this.unidadesDelCarrito();
    const farmacia = this.cart.cart()?.site.pharmacyName;
    if (unidades === 0 || farmacia === undefined) {
      return 'Carrito';
    }
    const sustantivo = unidades === 1 ? 'unidad' : 'unidades';
    return `Carrito, ${unidades} ${sustantivo} en ${farmacia}`;
  });

  constructor() {
    // El catálogo de tutoriales se registra acá y no en un proveedor de arranque
    // porque el armazón es lo único que existe exactamente una vez por sesión
    // con interfaz. Registrar dos veces es inofensivo —`register` reemplaza, no
    // acumula— pero hacerlo en el arranque lo cargaría también en las pantallas
    // públicas, donde no hay ningún tutorial que ofrecer.
    this.tutorials.register(TUTORIALS);

    /* Los dependientes se piden una sola vez, al montar el armazón: el
       conmutador tiene que estar antes de que la persona lo busque, y pedirlos
       desde cada pantalla los pediría cinco veces. El servicio no hace nada
       bajo SSR ni en una cuenta que no es de un paciente. */
    this.contextoDePaciente.loadDependents();

    /* N-01 · el número de Chats de la cabecera tiene que estar desde cualquier
       pantalla, no sólo después de pasar por `/messaging`. En cuanto hay sesión
       se prepara el contador: una lectura de la bandeja y el socket, sin
       sondeo y sin contar como «estar en Chats» (ver
       `ChatStore.prepararContador`). Es idempotente. */
    effect(() => {
      if (this.user() !== null) {
        untracked(() => this.chats.prepararContador());
      }
    });

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
      El desplegable de la barra

      La barra tiene **un solo** escalón plegable: el dominio (`General`,
      `Atención`, …). Adentro van los destinos, sueltos.

      Hubo un segundo escalón —el bloque de cosas parecidas: «Directorios», «Mi
      salud»— y se retiró (AC-E1-02): con él, entrar a una pantalla costaba tres
      clics y dos caían sobre rótulos que no llevan a ninguna parte. El reparto
      en bloques sigue vivo en `core/navigation`, pero ahora sólo decide el
      **orden** en que salen los destinos, no un renglón que haya que abrir.

      **Lo abierto se calcula, y sólo se recuerda lo que la persona toca.** El
      valor por omisión es «abierto si acá adentro está la pantalla en la que
      estás»: navegar a `/my-account/diagnostic-results` abre «Mi cuenta» sin
      que nadie la despliegue, que es lo que hace que la barra siempre muestre
      dónde estás parado. Guardar el estado de los dominios desde el arranque
      haría lo contrario — congelaría el menú tal como quedó en la primera
      pantalla.
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

  /**
   * Clave estable de un desplegable.
   *
   * Hoy es el rótulo del dominio y nada más —son pocos y no se repiten—. Sigue
   * siendo una función y no el rótulo suelto en la plantilla porque es el único
   * lugar donde se decide de qué está hecha la clave del mapa de plegados: si
   * mañana hiciera falta prefijarla, se prefija acá y no en cada llamada.
   */
  protected clavePlegable(grupo: string): string {
    return grupo;
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

  /* ==========================================================================
      La barra recogida (AC-E1-01)

      Recogerla deja un carril de íconos: la marca sin su palabra, los destinos
      sueltos con su ícono y el rótulo de cada dominio, también sólo su ícono.
      Lo que se va es el texto y el cuerpo de los dominios; lo que se gana es el
      ancho, que en una tabla de nueve columnas se nota.

      **Nada se esconde del lector de pantalla.** Los rótulos no se borran: se
      marcan `solo-lectores`, así el nombre accesible del enlace sigue siendo su
      texto y no hace falta duplicarlo en un `aria-label` que podría separarse
      de él. Para quien mira, el nombre vuelve como globo de ayuda.

      El estado vive en `ShellService` —que ya lo persistía en `localStorage`—
      y sólo manda por encima de 900 px: más abajo la barra es un cajón, y
      recoger un cajón no significa nada.
     ========================================================================== */

  /**
   * Si la barra está recogida a su carril de íconos.
   *
   * Son **dos** preguntas y las dos tienen que decir que sí: que la persona la
   * haya recogido, y que en este ancho exista un carril al que recogerla. Por
   * debajo de 901 px la barra es un cajón sobre el contenido, y un cajón
   * recogido son ocho íconos sin nombre — que es exactamente lo que pasaría
   * con sólo `shell.isCollapsed()`, porque la preferencia se guarda y viaja del
   * escritorio al teléfono.
   */
  protected readonly navRecogido = computed(
    () => this.shell.isCollapsed() && this.breakpoints.canCollapseNav(),
  );

  protected alternarNav(): void {
    this.shell.toggleCollapsed();
  }

  /**
   * Si estamos parados en el panel, que es donde «volver» no tiene a dónde ir.
   *
   * El panel es el principio del camino: quien entra, aterriza acá. No hay paso
   * propio que deshacer, así que `app-back-link` cae a su respaldo… que es el
   * panel. Pulsarlo desde el panel no hace nada, o —si el historial del
   * navegador todavía trae la pantalla de ingreso— devuelve a ella, que se lee
   * como haber cerrado la sesión. El cliente lo reportó así el 13/09/2026.
   *
   * En todas las demás pantallas la flecha se queda: ahí sí deshace un paso.
   */
  protected readonly enElPanel = computed(() => this.urlActual() === PANEL);

  /**
   * Clic sobre el rótulo de un dominio.
   *
   * Con la barra desplegada no hace nada: el `<details>` pliega solo, que es
   * justamente por lo que es un `<details>`.
   *
   * Recogida, el cuerpo del dominio no se dibuja, así que abrirlo no mostraría
   * nada. El clic entonces **despliega la barra** y deja ese dominio abierto,
   * que es lo que la persona estaba pidiendo al tocarlo. Se corta el gesto
   * nativo para que el `<details>` no cambie de estado por el camino y la barra
   * no vuelva con los dominios al revés de como quedaron.
   */
  protected alTocarElDominio(evento: Event, grupo: string): void {
    if (!this.navRecogido()) {
      return;
    }
    evento.preventDefault();
    this.shell.setCollapsed(false);
    this.plegadosAMano.update((estado) => ({ ...estado, [this.clavePlegable(grupo)]: true }));
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

  /**
   * Pasa a operar por un dependiente.
   *
   * No navega, a diferencia del cambio de organización: acá el contenido de la
   * pantalla sigue siendo del mismo tipo —las citas siguen siendo citas— y
   * quien conmuta suele estar mirando justamente eso. Las pantallas que leen el
   * contexto se recargan solas.
   *
   * @param patientProfileId - El dependiente elegido.
   */
  protected elegirPaciente(patientProfileId: string): void {
    this.contextoDePaciente.selectPatient(patientProfileId);
  }

  /** Vuelve a operar por uno mismo. */
  protected volverAMiPerfil(): void {
    this.contextoDePaciente.resetToSelf();
  }
}

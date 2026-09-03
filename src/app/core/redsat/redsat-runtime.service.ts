/* ============================================================================
    REDSAT — comportamientos del marco, portados desde la maqueta.

    Origen: SALUD/Vistas/HTML/_assets/redsat.js en la bóveda. Aquel archivo es
    un IIFE que corre una vez sobre un documento estático; acá el mismo trabajo
    se parte en dos, porque en una SPA el documento no se recarga:

      · `instalar()`  — una sola vez por sesión. Delegación en `document` y
        listeners de ventana: menús de desborde, diálogo con Esc y foco
        atrapado, fondo que responde al puntero.
      · `refrescar()` — en cada navegación. Todo lo que mira el DOM de la
        pantalla actual: secuencia de entrada, aparición por scroll, etiquetas
        de columna de las tablas, cajón de navegación y buscador compacto.

    Lo que NO se porta, y por qué:
      · el conmutador de tema (`[app-theme-toggle]`) lo gobierna ThemeService a
        través de RedsatThemeToggleDirective — dos dueños del mismo atributo se
        pisan;
      · la barra de estados de la maqueta (`.barra-maqueta`) y el selector
        `[data-ir-a-pantalla]` son andamiaje de la maqueta estática, no
        producto: acá cada vista renderiza su estado real.

    Todo es idempotente: `refrescar()` se llama en cada NavigationEnd y no debe
    duplicar el botón del cajón ni volver a animar lo ya animado.
    ========================================================================== */

import { DOCUMENT, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const FOCALIZABLES =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** Último retardo de la secuencia (.74s) + duración (.46s) + margen. */
const ENTRADA_MS = 1250;
const ANCHO_CAJON = '(max-width: 900px)';
const ANCHO_ORG = '(max-width: 640px)';

/**
 * Opacidad del fondo reactivo mientras el puntero está activo, y a la que
 * cae tras quedarse quieto. `redsat.css` usa el mismo `.35` como valor de
 * respaldo de `var(--fondo-presencia, .35)`, para que el primer pintado
 * (antes de que este servicio corra) y el reposo tras mover el mouse pinten
 * exactamente lo mismo.
 */
const PRESENCIA_ACTIVA = '1';
const PRESENCIA_REPOSO = '.35';
/** Cuánto espera sin movimiento antes de volver al reposo. */
const REPOSO_MS = 650;

@Injectable({ providedIn: 'root' })
export class RedsatRuntimeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private instalado = false;
  /** Navs a los que ya se les enganchó el halo del puntero. */
  private readonly navsConHalo = new WeakSet<Element>();
  /** Cancela la espera de la secuencia de entrada si llega otra navegación. */
  private entradaPendiente: ReturnType<typeof setTimeout> | null = null;
  private soltarScroll: (() => void) | null = null;

  private get ventana(): (Window & typeof globalThis) | null {
    return this.document.defaultView;
  }

  /**
   * `matchMedia` no existe en todos los entornos donde este servicio corre —el
   * DOM de las pruebas no lo implementa—, y su ausencia no puede tumbar el
   * marco entero. Cuando falta se responde «no coincide», que es el respaldo
   * correcto: sin poder medir el ancho, se asume el caso de escritorio, que es
   * el que no necesita nada inyectado.
   */
  private consultaDeMedios(consulta: string): MediaQueryList | null {
    const ventana = this.ventana;
    return typeof ventana?.matchMedia === 'function' ? ventana.matchMedia(consulta) : null;
  }

  private prefiereMenosMovimiento(): boolean {
    return this.consultaDeMedios('(prefers-reduced-motion: reduce)')?.matches ?? false;
  }

  // ---------------------------------------------------------------- instalar

  instalar(): void {
    if (!this.isBrowser || this.instalado) {
      return;
    }
    this.instalado = true;

    /* El sistema responsive de la hoja cuelga de `html[data-js]`: sin este
       atributo el nav vuelve al flujo y la tabla rueda en horizontal, que es
       el respaldo sin JavaScript. */
    this.document.documentElement.setAttribute('data-js', 'on');

    /* En la maqueta este hueco lo reserva la barra de estados, que acá no
       existe. Se publica en cero para que el marco no deje un margen muerto
       contra el borde inferior. */
    this.document.documentElement.style.setProperty('--h-barra', '0px');

    this.menusDeDesborde();
    this.dialogoAccesible();
    this.fondoReactivo();
  }

  // --------------------------------------------------------------- refrescar

  refrescar(estado: string | null = null): void {
    const ventana = this.ventana;
    if (!this.isBrowser || !ventana) {
      return;
    }
    /* NavigationEnd llega con la ruta ya activada pero antes de que la vista
       del componente esté pintada: medir el pliegue o leer los `<th>` de una
       tabla ahora daría cero filas. Se espera al cuadro siguiente, que es
       cuando el DOM de la pantalla nueva ya existe. */
    ventana.requestAnimationFrame(() => {
      this.fijarEstado(estado);
      this.entradaUnaVez();
      this.aparicionPorScroll();
      this.etiquetarTablas();
      this.navReactivo();
      this.cajonDeNavegacion();
      this.buscadorCompacto();
    });
  }

  // ------------------------------------------------- arquetipo y estado

  /**
   * La hoja compone distinto según el arquetipo de la pantalla —un formulario
   * respira más que un listado— y esas reglas cuelgan del <body>
   * (`body[data-arquetipo="formulario"] .app-main__inner { gap: … }`). En la
   * maqueta el atributo venía escrito en cada archivo; acá viaja en los datos
   * de la ruta y se estampa al navegar.
   */
  fijarArquetipo(arquetipo: string | null): void {
    if (!this.isBrowser) {
      return;
    }
    const cuerpo = this.document.body;
    if (arquetipo) {
      cuerpo.setAttribute('data-arquetipo', arquetipo);
    } else {
      cuerpo.removeAttribute('data-arquetipo');
    }
  }

  /**
   * Conmuta los bloques de `.app-view-state-host`. Es lo que hace navegable un
   * formulario por etapas: `?estado=paso2` muestra el segundo paso y oculta el
   * resto. Sin parámetro, manda el primer bloque que declare la pantalla, que
   * es su estado de partida.
   */
  fijarEstado(estado: string | null): void {
    if (!this.isBrowser) {
      return;
    }
    this.document.querySelectorAll<HTMLElement>('.app-view-state-host').forEach((host) => {
      const bloques = [...host.children].filter((el): el is HTMLElement =>
        el.hasAttribute('data-estado'),
      );
      if (!bloques.length) {
        return;
      }
      /* Un estado que esta pantalla no declara no apaga sus bloques: cada
         arquetipo tiene los suyos, y el de otra pantalla no significa nada acá. */
      const elegido = bloques.some((b) => b.dataset['estado'] === estado)
        ? estado
        : bloques[0].dataset['estado'];
      bloques.forEach((bloque) => {
        bloque.hidden = bloque.dataset['estado'] !== elegido;
      });
      this.aplicarSoloEstado(elegido ?? '');
    });
  }

  /** Elementos sueltos que sólo existen en ciertos estados de la pantalla. */
  private aplicarSoloEstado(estado: string): void {
    this.document.querySelectorAll<HTMLElement>('[data-solo-estado]').forEach((el) => {
      const estados = (el.dataset['soloEstado'] ?? '').split(',').map((s) => s.trim());
      el.hidden = !estados.includes(estado);
    });
  }

  // ------------------------------------------------------- menús de desborde

  private cerrarMenus(excepto: Element | null): void {
    this.document.querySelectorAll<HTMLElement>('.menu-anclaje .app-menu').forEach((menu) => {
      if (menu === excepto) {
        return;
      }
      menu.hidden = true;
      const disparador = menu.parentElement?.querySelector('[aria-haspopup]');
      disparador?.setAttribute('aria-expanded', 'false');
    });
  }

  private menusDeDesborde(): void {
    this.document.addEventListener('click', (evento) => {
      const objetivo = evento.target as HTMLElement | null;
      const disparador = objetivo?.closest<HTMLElement>("[aria-haspopup='menu']");
      if (disparador) {
        evento.preventDefault();
        const id = disparador.getAttribute('aria-controls');
        const menu = id ? this.document.getElementById(id) : null;
        if (!menu) {
          return;
        }
        const abierto = !menu.hidden;
        this.cerrarMenus(menu);
        menu.hidden = abierto;
        disparador.setAttribute('aria-expanded', String(!abierto));
        if (!menu.hidden) {
          menu.querySelector<HTMLElement>('.app-menu-item')?.focus();
        }
        return;
      }
      if (!objetivo?.closest('.app-menu')) {
        this.cerrarMenus(null);
      }
    });
  }

  // ---------------------------------------------- diálogo: Esc y foco atrapado

  private dialogoActivo(): HTMLElement | null {
    return this.document.querySelector<HTMLElement>('.app-dialog-capa .app-dialog');
  }

  private dialogoAccesible(): void {
    this.document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') {
        this.cerrarMenus(null);
        const capa = this.document.querySelector<HTMLElement>('.app-dialog-capa:not([hidden])');
        if (!capa) {
          return;
        }
        capa.hidden = true;
        const fondo = this.document.querySelector<HTMLElement>('[data-fondo]');
        if (!fondo) {
          return;
        }
        fondo.removeAttribute('aria-hidden');
        fondo.classList.remove('marco-atenuado');
        fondo.querySelectorAll("[tabindex='-1']").forEach((el) => el.removeAttribute('tabindex'));
        fondo.querySelector<HTMLElement>(FOCALIZABLES)?.focus();
        return;
      }

      if (evento.key !== 'Tab') {
        return;
      }
      const dialogo = this.dialogoActivo();
      if (dialogo) {
        this.atraparFoco(evento, dialogo);
      }
    });
  }

  /**
   * Devuelve el tabulador al principio (o al final) del contenedor. Se filtra
   * por `offsetParent` porque un control oculto sigue estando en el DOM y
   * mandaría el foco a algo invisible.
   */
  private atraparFoco(evento: KeyboardEvent, contenedor: HTMLElement): void {
    const focos = Array.from(contenedor.querySelectorAll<HTMLElement>(FOCALIZABLES)).filter(
      (el) => el.offsetParent !== null,
    );
    if (!focos.length) {
      return;
    }
    const primero = focos[0];
    const ultimo = focos[focos.length - 1];
    if (evento.shiftKey && this.document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && this.document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  // ------------------------------------------------- fondo y nav reactivos

  /**
   * Publica la posición del puntero como dos números de 0 a 1. El CSS los usa
   * para desplazar las capas del fondo con distinta inercia: cuando la mano se
   * detiene, el fondo se detiene. No hay bucle ni temporizador.
   *
   * También publica `--fondo-presencia` (TAREA-08, v4.3): en modo claro el
   * fondo descansa en un blanco casi puro —`redsat.css` lo multiplica ahí,
   * `PRESENCIA_REPOSO` es el mismo número que su valor de respaldo, para que
   * la primera pintura bajo SSR y el reposo tras mover el mouse se vean
   * idénticos— y el celeste **aparece** mientras el puntero está activo. Un
   * único `setTimeout` reprogramado en cada movimiento —no un `setInterval`—
   * lo hace descansar nada más quedarse quieto: se cancela y se vuelve a
   * armar, jamás se acumulan dos. En modo oscuro `redsat.css` ignora esta
   * variable a propósito (AC-08-3): el fondo oscuro no se apaga con el
   * reposo, sigue exactamente como hoy.
   */
  private fondoReactivo(): void {
    const ventana = this.ventana;
    if (!ventana || this.prefiereMenosMovimiento()) {
      return;
    }
    const raiz = this.document.documentElement;
    let pedido = false;
    let ultimo: MouseEvent | null = null;
    let reposo: ReturnType<typeof setTimeout> | null = null;

    ventana.addEventListener(
      'mousemove',
      (evento) => {
        ultimo = evento;

        if (reposo !== null) {
          clearTimeout(reposo);
        }
        reposo = setTimeout(() => {
          reposo = null;
          raiz.style.setProperty('--fondo-presencia', PRESENCIA_REPOSO);
        }, REPOSO_MS);

        if (pedido) {
          return;
        }
        pedido = true;
        ventana.requestAnimationFrame(() => {
          pedido = false;
          if (!ultimo) {
            return;
          }
          raiz.style.setProperty('--raton-x', (ultimo.clientX / ventana.innerWidth).toFixed(3));
          raiz.style.setProperty('--raton-y', (ultimo.clientY / ventana.innerHeight).toFixed(3));
          raiz.style.setProperty('--fondo-presencia', PRESENCIA_ACTIVA);
        });
      },
      { passive: true },
    );
  }

  /** Halo del nav que sigue al puntero. Se engancha una vez por elemento nav. */
  private navReactivo(): void {
    const ventana = this.ventana;
    const nav = this.document.querySelector<HTMLElement>('.app-side-nav');
    if (!ventana || !nav || this.navsConHalo.has(nav)) {
      return;
    }
    if (!nav.querySelector('.app-side-nav__brillo')) {
      return;
    }
    this.navsConHalo.add(nav);

    let pendiente = false;
    let ultimo: MouseEvent | null = null;

    nav.addEventListener('mousemove', (evento) => {
      ultimo = evento;
      if (pendiente) {
        return;
      }
      pendiente = true;
      ventana.requestAnimationFrame(() => {
        pendiente = false;
        if (!ultimo) {
          return;
        }
        const caja = nav.getBoundingClientRect();
        const x = ultimo.clientX - caja.left;
        const y = ultimo.clientY - caja.top;
        /* Se publican en el propio nav —no en el halo— porque de ahí las
           heredan las dos capas: el halo en píxeles y la textura, que se corre
           apenas, en una fracción de 0 a 1. */
        nav.style.setProperty('--puntero-x', `${x}px`);
        nav.style.setProperty('--puntero-y', `${y}px`);
        nav.style.setProperty('--puntero-xn', (x / caja.width).toFixed(3));
        nav.style.setProperty('--puntero-yn', (y / caja.height).toFixed(3));
      });
    });

    nav.addEventListener('mouseleave', () => {
      nav.style.setProperty('--puntero-y', '-20%');
      nav.style.setProperty('--puntero-xn', '.5');
      nav.style.setProperty('--puntero-yn', '.5');
    });
  }

  // -------------------------------------------------- animaciones de entrada

  /**
   * La secuencia entera cuelga de la clase `entrando` del <body>. Apenas
   * termina se retira: a partir de ahí ningún elemento tiene propiedades de
   * animación, así que no puede volver a animarse. La clase se REPONE en cada
   * navegación —a diferencia de la maqueta, donde venía escrita en el HTML—
   * porque cada vista de la SPA es una entrada nueva.
   */
  private entradaUnaVez(): void {
    const cuerpo = this.document.body;
    if (this.entradaPendiente !== null) {
      clearTimeout(this.entradaPendiente);
    }
    cuerpo.classList.remove('entrada-hecha');
    cuerpo.classList.add('entrando');
    this.entradaPendiente = setTimeout(() => {
      this.entradaPendiente = null;
      cuerpo.classList.remove('entrando');
      cuerpo.classList.add('entrada-hecha');
    }, ENTRADA_MS);
  }

  /**
   * Lo que al cargar queda por debajo del pliegue no entra con la secuencia:
   * espera a que el usuario llegue. Aparece UNA vez y se queda.
   */
  private aparicionPorScroll(): void {
    const ventana = this.ventana;
    this.soltarScroll?.();
    this.soltarScroll = null;
    if (!ventana || this.prefiereMenosMovimiento()) {
      return;
    }

    const candidatos = this.document.querySelectorAll<HTMLElement>(
      '.app-main__inner > .app-card, .app-main__inner > .app-filter-bar, .pila > .app-card, .pagina-indice > section',
    );
    let pendientes: HTMLElement[] = [];
    candidatos.forEach((el) => {
      /* Sólo lo que empieza fuera de la pantalla: lo visible ya lo cubre la
         secuencia de entrada, y animarlo dos veces se ve como un parpadeo. */
      if (el.getBoundingClientRect().top > ventana.innerHeight) {
        el.setAttribute('data-revelar', '');
        pendientes.push(el);
      }
    });
    if (!pendientes.length) {
      return;
    }

    const revelar = (el: HTMLElement) => {
      el.classList.add('revelado');
      el.addEventListener(
        'transitionend',
        () => {
          el.removeAttribute('data-revelar');
          el.classList.remove('revelado');
        },
        { once: true },
      );
    };

    let pedido = false;
    const revisar = () => {
      pedido = false;
      const limite = ventana.innerHeight * 0.94;
      pendientes = pendientes.filter((el) => {
        if (el.getBoundingClientRect().top < limite) {
          revelar(el);
          return false;
        }
        return true;
      });
      if (!pendientes.length) {
        soltar();
      }
    };
    const agendar = () => {
      if (pedido) {
        return;
      }
      pedido = true;
      ventana.requestAnimationFrame(revisar);
    };

    /* Red de seguridad: si algo impidiera la comprobación, nada puede quedar
       invisible. Pasados 6 s se revela lo que siga pendiente. */
    const red = setTimeout(() => pendientes.splice(0).forEach(revelar), 6000);

    const soltar = () => {
      clearTimeout(red);
      ventana.removeEventListener('scroll', agendar);
      ventana.removeEventListener('resize', agendar);
      this.soltarScroll = null;
    };
    this.soltarScroll = soltar;

    ventana.addEventListener('scroll', agendar, { passive: true });
    ventana.addEventListener('resize', agendar);
    agendar();
  }

  // ------------------------------------------------------------ marco móvil

  private icono(camino: string): string {
    return (
      '<svg class="icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      camino +
      '</svg>'
    );
  }

  /**
   * Por debajo de 900 px el nav de 264 px no puede ser una columna: pasa a
   * cajón. El botón que lo abre y el velo que lo cubre se inyectan acá para
   * que el marco sea idéntico en todas las pantallas.
   */
  private cajonDeNavegacion(): void {
    const ventana = this.ventana;
    const nav = this.document.querySelector<HTMLElement>('.app-side-nav');
    const header = this.document.querySelector<HTMLElement>('.app-header');
    if (!ventana || !nav || !header || header.querySelector('.app-nav-toggle')) {
      return;
    }

    if (!nav.id) {
      nav.id = 'app-side-nav';
    }

    const boton = this.document.createElement('button');
    boton.type = 'button';
    boton.className = 'app-nav-toggle';
    /* Es el mismo control que antes traía el header escrito a mano, así que
       conserva su identificador de prueba: la suite lo busca por ahí. */
    boton.dataset['testid'] = 'header-menu';
    boton.setAttribute('aria-label', 'Abrir el menú de navegación');
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-controls', nav.id);
    boton.innerHTML = this.icono('<path d="M4 7h16M4 12h16M4 17h16"/>');
    header.insertBefore(boton, header.firstChild);

    const velo = this.document.createElement('div');
    velo.className = 'app-nav-velo';
    velo.hidden = false;
    this.document.body.appendChild(velo);

    const raiz = this.document.documentElement;

    const abrir = () => {
      raiz.classList.add('nav-abierto');
      boton.setAttribute('aria-expanded', 'true');
      boton.setAttribute('aria-label', 'Cerrar el menú de navegación');
      nav.querySelector<HTMLElement>(FOCALIZABLES)?.focus();
    };

    const cerrar = (devolverFoco: boolean) => {
      if (!raiz.classList.contains('nav-abierto')) {
        return;
      }
      raiz.classList.remove('nav-abierto');
      boton.setAttribute('aria-expanded', 'false');
      boton.setAttribute('aria-label', 'Abrir el menú de navegación');
      if (devolverFoco) {
        boton.focus();
      }
    };

    boton.addEventListener('click', () =>
      raiz.classList.contains('nav-abierto') ? cerrar(true) : abrir(),
    );
    velo.addEventListener('click', () => cerrar(true));

    /* Elegir un ítem cierra el cajón: si el enlace navega, igual; si es la
       pantalla actual, el cajón no puede quedarse tapando lo que se eligió. */
    nav.addEventListener('click', (evento) => {
      if ((evento.target as HTMLElement | null)?.closest('.app-side-nav__item')) {
        cerrar(false);
      }
    });

    this.document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') {
        cerrar(true);
      }
      if (evento.key !== 'Tab' || !raiz.classList.contains('nav-abierto')) {
        return;
      }
      /* Con el cajón abierto el resto de la página está bajo el velo: el
         tabulador no puede salir de él. */
      this.atraparFoco(evento, nav);
    });

    /* Al ensanchar la ventana el nav vuelve a ser columna: el estado abierto
       dejaría el <body> sin scroll y el velo encendido sobre nada. */
    this.consultaDeMedios(ANCHO_CAJON)?.addEventListener('change', (e) => {
      if (!e.matches) {
        cerrar(false);
      }
    });

    this.mudarSelectorDeOrganizacion(nav);
  }

  /**
   * En un header de 320 px el selector de organización no entra. No se oculta
   * —es el control que dice en qué organización estás— sino que baja al cajón.
   * Se guarda de dónde salió para devolverlo intacto al ensanchar.
   */
  private mudarSelectorDeOrganizacion(nav: HTMLElement): void {
    const ventana = this.ventana;
    const selector = this.document.querySelector<HTMLElement>('.app-header .app-tenant-switcher');
    if (!ventana || !selector) {
      return;
    }
    const casa = selector.parentElement;
    const vecino = selector.nextElementSibling;
    const marca = nav.querySelector('.app-side-nav__marca');

    const ubicar = (angosto: boolean) => {
      if (angosto) {
        if (selector.parentElement === nav) {
          return;
        }
        if (marca?.nextSibling) {
          nav.insertBefore(selector, marca.nextSibling);
        } else {
          nav.appendChild(selector);
        }
        return;
      }
      if (selector.parentElement === casa) {
        return;
      }
      casa?.insertBefore(selector, vecino);
    };

    const consulta = this.consultaDeMedios(ANCHO_ORG);
    ubicar(consulta?.matches ?? false);
    consulta?.addEventListener('change', (e) => ubicar(e.matches));
  }

  /**
   * El buscador del header mide 420 px y no entra al lado de la hamburguesa,
   * el selector de organización y el avatar: se colapsa a icono y baja como
   * fila propia al abrirlo. Sigue siendo el mismo `<input>`.
   */
  private buscadorCompacto(): void {
    const header = this.document.querySelector<HTMLElement>('.app-header');
    const buscador = header?.querySelector<HTMLElement>('.app-header__buscador');
    const derecha = header?.querySelector<HTMLElement>('.app-header__derecha');
    if (!header || !buscador || !derecha || derecha.querySelector('.app-buscar-toggle')) {
      return;
    }

    const boton = this.document.createElement('button');
    boton.type = 'button';
    boton.className = 'app-buscar-toggle';
    boton.setAttribute('aria-label', 'Buscar');
    boton.setAttribute('aria-expanded', 'false');
    boton.innerHTML = this.icono('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>');
    derecha.insertBefore(boton, derecha.firstChild);

    boton.addEventListener('click', () => {
      const abierto = header.classList.toggle('is-buscando');
      boton.setAttribute('aria-expanded', String(abierto));
      if (abierto) {
        buscador.querySelector('input')?.focus();
      }
    });

    this.document.addEventListener('keydown', (evento) => {
      if (evento.key !== 'Escape' || !header.classList.contains('is-buscando')) {
        return;
      }
      header.classList.remove('is-buscando');
      boton.setAttribute('aria-expanded', 'false');
      boton.focus();
    });
  }

  /**
   * Por debajo de 640 px cada fila pasa a ser una tarjeta y cada celda lleva
   * adelante el nombre de su columna. Ese nombre se copia del `<th>` y se
   * guarda en `data-etiqueta`, que la hoja pinta con `::before`. Se hace acá y
   * no en el markup para que no se desincronice al renombrar una columna.
   */
  private etiquetarTablas(): void {
    this.document
      .querySelectorAll<HTMLTableElement>('table.app-data-table, table.indice-tabla')
      .forEach((tabla) => {
        const encabezados = Array.from(tabla.querySelectorAll('thead th')).map((th) =>
          (th.textContent ?? '').trim(),
        );
        if (!encabezados.length) {
          return;
        }
        tabla.querySelectorAll('tbody tr').forEach((fila) => {
          let columna = 0;
          Array.from(fila.children).forEach((celda) => {
            const ancho = (celda as HTMLTableCellElement).colSpan || 1;
            /* Una celda que abarca la tabla entera es el estado vacío o el de
               error: no rotula un dato, así que no lleva etiqueta. */
            if (ancho === 1 && !celda.hasAttribute('data-etiqueta')) {
              const texto = encabezados[columna] ?? '';
              if (texto) {
                celda.setAttribute('data-etiqueta', texto);
              }
            }
            columna += ancho;
          });
        });
      });
  }
}

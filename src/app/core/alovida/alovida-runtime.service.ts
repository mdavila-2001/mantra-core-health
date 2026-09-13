/* ============================================================================
    ALOVIDA — comportamientos del marco, portados desde la maqueta.

    Origen: SALUD/Vistas/HTML/_assets/alovida.js en la bóveda. Aquel archivo es
    un IIFE que corre una vez sobre un documento estático; acá el mismo trabajo
    se parte en dos, porque en una SPA el documento no se recarga:

      · `instalar()`  — una sola vez por sesión. Delegación en `document` y
        listeners de ventana: menús de desborde, controles de la maqueta
        —combo de referencia, chips, paginación, repetidores, acción final del
        formulario—, diálogo con Esc y foco atrapado, fondo que responde al
        puntero.
      · `refrescar()` — en cada navegación. Todo lo que mira el DOM de la
        pantalla actual: secuencia de entrada, aparición por scroll, etiquetas
        de columna de las tablas, cajón de navegación y buscador compacto.

    Lo que NO se porta, y por qué:
      · el conmutador de tema (`[app-theme-toggle]`) lo gobierna ThemeService a
        través de AlovidaThemeToggleDirective — dos dueños del mismo atributo se
        pisan;
      · la barra de estados de la maqueta (`.barra-maqueta`) y el selector
        `[data-ir-a-pantalla]` son andamiaje de la maqueta estática, no
        producto: acá cada vista renderiza su estado real.

    Todo es idempotente: `refrescar()` se llama en cada NavigationEnd y no debe
    duplicar el botón del cajón ni volver a animar lo ya animado.
    ========================================================================== */

import { DOCUMENT, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

const FOCALIZABLES =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** Último retardo de la secuencia (.74s) + duración (.46s) + margen. */
const ENTRADA_MS = 1250;
const ANCHO_CAJON = '(max-width: 900px)';
const ANCHO_ORG = '(max-width: 640px)';

/**
 * Opacidad del fondo reactivo mientras el puntero está activo, y a la que
 * cae tras quedarse quieto. `alovida.css` usa el mismo `.35` como valor de
 * respaldo de `var(--fondo-presencia, .35)`, para que el primer pintado
 * (antes de que este servicio corra) y el reposo tras mover el mouse pinten
 * exactamente lo mismo.
 */
const PRESENCIA_ACTIVA = '1';
const PRESENCIA_REPOSO = '.35';
/** Cuánto espera sin movimiento antes de volver al reposo. */
const REPOSO_MS = 650;

/**
 * Cuánto dura la onda de la gota, en milisegundos.
 *
 * Es el mismo número que la animación `gota-de-agua` de `alovida.css`: pasado
 * ese tiempo el atributo se retira, para que el siguiente clic vuelva a
 * dispararla desde cero. Si los dos se separaran, la onda quedaría cortada
 * (acá más corto) o el clic siguiente no reiniciaría (acá más largo).
 */
const GOTA_MS = 900;

/**
 * Cuántos cuadros espera `refrescar()` a que la pantalla aparezca en el DOM
 * antes de correr igual. A 60 Hz son unos 800 ms: de sobra para que llegue un
 * componente cargado por demanda, y poco para que se note si nunca llega.
 */
const CUADROS_DE_ESPERA = 48;

@Injectable({ providedIn: 'root' })
export class AlovidaRuntimeService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private instalado = false;
  /** Navs a los que ya se les enganchó el halo del puntero. */
  private readonly navsConHalo = new WeakSet<Element>();
  /** Cancela la espera de la secuencia de entrada si llega otra navegación. */
  private entradaPendiente: ReturnType<typeof setTimeout> | null = null;
  private soltarScroll: (() => void) | null = null;
  /** Número del último `refrescar()` pedido: los anteriores se descartan. */
  private refrescoEnCurso = 0;
  /** Estado de pantalla del último `refrescar()`, para poder repetirlo. */
  private ultimoEstado: string | null = null;
  /** La pantalla sobre la que ya se corrió el trabajo del marco. */
  private pantallaAtendida: Element | null = null;

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
    this.controlesDeMaqueta();
    this.vigilarLaPantalla();
    this.dialogoAccesible();
    this.fondoReactivo();
    this.gotaDeAgua();
  }

  // --------------------------------------------------------------- refrescar

  refrescar(estado: string | null = null): void {
    const ventana = this.ventana;
    if (!this.isBrowser || !ventana) {
      return;
    }
    /* NavigationEnd llega con la ruta ya activada pero antes de que la vista
       del componente esté pintada: medir el pliegue o leer los `<th>` de una
       tabla ahora daría cero filas. Se espera al cuadro en el que el DOM de la
       pantalla nueva ya existe. */
    this.ultimoEstado = estado;
    const miTurno = ++this.refrescoEnCurso;
    this.cuandoLaPantallaExista(miTurno, 0, () => {
      this.fijarEstado(estado);
      this.ajustarPaginacion();
      this.entradaUnaVez();
      this.aparicionPorScroll();
      this.etiquetarTablas();
      this.navReactivo();
      this.cajonDeNavegacion();
      this.buscadorCompacto();
    });
  }

  /**
   * Espera al primer cuadro en el que la pantalla está en el DOM.
   *
   * Un solo `requestAnimationFrame` alcanzaba mientras la pantalla llegaba
   * junto con la navegación. Las 126 vistas de la bóveda se cargan **por
   * demanda**, y al entrar por URL directa —una recarga, un enlace pegado— el
   * cuadro siguiente a `NavigationEnd` llega con el `<router-outlet>` todavía
   * vacío: el trabajo corría contra un documento sin pantalla y se perdía
   * entero, sin error. Se veía como que la mitad de las cosas no cargaban —
   * tablas sin rótulo de columna, paginación sin ajustar, cajón sin botón—
   * pero sólo al entrar de una manera, no al navegar por dentro.
   *
   * El techo existe para no girar en una pantalla que de verdad no pinta nada;
   * pasado ese punto se corre igual, que es lo que se hacía antes.
   */
  private cuandoLaPantallaExista(turno: number, intento: number, trabajo: () => void): void {
    const ventana = this.ventana;
    if (!ventana) {
      return;
    }
    ventana.requestAnimationFrame(() => {
      /* Otra navegación ya pidió su propio refresco: este quedó viejo y
         aplicarlo pisaría el estado de la pantalla que sí se está mirando. */
      if (turno !== this.refrescoEnCurso) {
        return;
      }
      /* Se miran TODOS los outlets, no el primero: el de la raíz monta el
         marco y el del marco monta la pantalla. Con sólo el primero, el marco
         recién puesto ya contaba como «pintada» y se volvía a medir en vacío,
         que es el error que esto vino a arreglar. */
      const salidas = [...this.document.querySelectorAll('router-outlet')];
      const pintada = salidas.length === 0 || salidas.every((s) => !!s.nextElementSibling);
      if (!pintada && intento < CUADROS_DE_ESPERA) {
        this.cuandoLaPantallaExista(turno, intento + 1, trabajo);
        return;
      }
      this.pantallaAtendida = this.pantallaActual();
      trabajo();
    });
  }

  /** El elemento que el router puso en la salida más profunda: la pantalla. */
  private pantallaActual(): Element | null {
    const salidas = this.document.querySelectorAll('router-outlet');
    return salidas.length ? (salidas[salidas.length - 1].nextElementSibling ?? null) : null;
  }

  /**
   * Vuelve a correr el trabajo del marco cuando la pantalla del router cambia
   * sin que haya habido navegación.
   *
   * Pasa: entre `NavigationEnd` y el dibujo definitivo, la vista del marco se
   * rehace, y todo lo que `refrescar()` había escrito sobre el DOM anterior se
   * va con él — rótulos de columna, ajuste de la paginación, botón del cajón.
   * Como no hay otra navegación, nada lo volvía a poner: entrando por URL
   * directa la pantalla quedaba a medio armar, y navegando por dentro no,
   * que es por qué el síntoma parecía caprichoso.
   *
   * Se dispara por identidad del nodo, no por cantidad de mutaciones: las que
   * escribe el propio `refrescar()` no cambian qué elemento es la pantalla, así
   * que no puede realimentarse.
   */
  private vigilarLaPantalla(): void {
    if (typeof MutationObserver === 'undefined') {
      return;
    }
    const observador = new MutationObserver(() => {
      const pantalla = this.pantallaActual();
      if (!pantalla || pantalla === this.pantallaAtendida) {
        return;
      }
      this.refrescar(this.ultimoEstado);
    });
    observador.observe(this.document.body, { childList: true, subtree: true });
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
      // Acotado a `.menu-anclaje`: es el envoltorio que sólo trae la maqueta
      // estática (ver el `beforeEach` de "menús de desborde" en el spec). La
      // molécula `app-menu`/`appMenuTrigger` (AC-01-15 a AC-01-18) usa el
      // mismo contrato ARIA —`aria-haspopup="menu"` + `aria-controls`— para
      // su propio disparador, pero gobierna su apertura con una señal, no con
      // el atributo `hidden`. Sin este acotamiento, este oyente global
      // encontraba también ESE disparador, y le imponía `hidden` al panel de
      // Angular por encima de su clase `menu--open` (`alovida.css` lo fuerza
      // con `!important`): el menú de preferencias de una publicación
      // quedaba con `aria-expanded="true"` pero permanentemente invisible.
      const disparador = objetivo?.closest<HTMLElement>(
        ".menu-anclaje [aria-haspopup='menu']",
      );
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

  // ------------------------------------- controles de las pantallas portadas

  /**
   * Los `<button>` de las 126 vistas portadas desde la bóveda.
   *
   * `cablear()` del generador reescribe cada `<a href>` a `routerLink`, pero a
   * los botones no los toca: en la maqueta su comportamiento lo ponía
   * `_assets/alovida.js`, y de ese archivo acá sólo se portaron los menús de
   * desborde, el diálogo y el cajón. El resto quedó pintado y mudo — el combo
   * de referencia no elige, el chip de filtro no se quita, el repetidor no
   * agrega ni saca filas, la paginación no pagina y el botón de guardar no
   * lleva a ningún lado. Son cientos de controles en 126 plantillas, así que
   * no se arregla plantilla por plantilla: se arregla acá, una vez.
   *
   * Un solo oyente delegado, como los menús: las pantallas se cargan por
   * demanda y enganchar control por control en cada navegación sería recorrer
   * el DOM entero cada vez.
   *
   * **Acotado a `[data-alovida-maqueta]`** —la marca que llevan los dos marcos
   * de `features/alovida/shell`— a propósito. Las clases de las que cuelga
   * (`.app-chip`, `.app-form-actions`, `.app-pagination`, `[role="listbox"]`)
   * también las usa el resto de la aplicación, pero allá las gobierna un
   * componente de Angular con su propia señal. Sin el acotamiento este oyente
   * le pisaría el clic, que es exactamente la trampa que documenta
   * `menusDeDesborde`.
   */
  private controlesDeMaqueta(): void {
    this.document.addEventListener('click', (evento) => {
      const objetivo = evento.target as HTMLElement | null;
      if (!objetivo?.closest('[data-alovida-maqueta]')) {
        return;
      }

      /* Un control anunciado como deshabilitado no actúa. El markup de la
         bóveda deshabilita por `aria-disabled` y no por el atributo nativo
         —igual que el botón del sistema— así que el clic llega igual y hay
         que pararlo acá. */
      const inerte = objetivo.closest<HTMLElement>("[aria-disabled='true']");
      if (inerte) {
        evento.preventDefault();
        return;
      }

      const opcion = objetivo.closest<HTMLElement>("[role='listbox'] [role='option']");
      if (opcion) {
        evento.preventDefault();
        this.elegirOpcion(opcion);
        return;
      }

      const quitarChip = objetivo.closest<HTMLElement>('.app-chip button');
      if (quitarChip) {
        evento.preventDefault();
        this.quitarChip(quitarChip);
        return;
      }

      const boton = objetivo.closest<HTMLButtonElement>('button');
      if (!boton) {
        return;
      }
      /* Las 126 vistas portadas escriben `type="button"` en todos sus botones
         —la maqueta no envía formularios—, así que un `submit` bajo este marco
         sólo puede venir de un componente de Angular que alguien montó acá
         adentro. Ese lo maneja su dueño: interceptarlo sería impedir el envío
         del formulario, que es el peor final posible de este oyente. */
      if (boton.type === 'submit') {
        return;
      }
      const texto = (boton.textContent ?? '').trim();

      if (boton.closest('.app-pagination')) {
        evento.preventDefault();
        this.paginar(boton);
        return;
      }
      if (texto === 'Quitar' && boton.closest('.app-card--inset')) {
        evento.preventDefault();
        this.quitarBloqueRepetido(boton);
        return;
      }
      if (/^Agregar (otra|otro|un|una)\b/.test(texto)) {
        evento.preventDefault();
        this.agregarBloqueRepetido(boton);
        return;
      }
      if (texto === 'Reintentar') {
        evento.preventDefault();
        this.irAEstado(null);
        return;
      }
      if (boton.closest('.app-tooltip-panel[title]')) {
        evento.preventDefault();
        this.revelarElTitulo(boton);
        return;
      }
      if (boton.closest('.app-form-actions')) {
        evento.preventDefault();
        this.confirmarFormulario(boton);
      }
    });
  }

  /**
   * Combo de referencia: el markup deja la lista abierta y una opción marcada,
   * porque una maqueta estática no puede mostrar el desplegable de otra forma.
   * Elegir escribe el rótulo en el campo, mueve la marca y recoge la lista,
   * que es lo que un `combobox` promete con su `aria-expanded`.
   */
  private elegirOpcion(opcion: HTMLElement): void {
    const listbox = opcion.closest<HTMLElement>("[role='listbox']");
    if (!listbox) {
      return;
    }
    listbox
      .querySelectorAll<HTMLElement>("[role='option']")
      .forEach((otra) => otra.setAttribute('aria-selected', String(otra === opcion)));

    const campo = listbox.id
      ? this.document.querySelector<HTMLInputElement>(`input[aria-controls='${listbox.id}']`)
      : null;
    if (!campo) {
      return;
    }
    campo.value = this.rotuloDeOpcion(opcion);
    campo.setAttribute('aria-expanded', 'false');
    listbox.hidden = true;
    campo.focus();
  }

  /**
   * El rótulo de la opción es su primera línea; lo que sigue al `<br>` es la
   * aclaración (especialidad, matrícula, sede) y no es lo que se escribe en el
   * campo.
   */
  private rotuloDeOpcion(opcion: HTMLElement): string {
    const envoltorio = opcion.querySelector('span') ?? opcion;
    const primeraLinea = Array.from(envoltorio.childNodes).find(
      (nodo) => nodo.nodeType === 3 && (nodo.textContent ?? '').trim(),
    );
    return ((primeraLinea?.textContent ?? envoltorio.textContent) ?? '').trim();
  }

  /** El chip de un filtro aplicado: su botón lo saca de la lista. */
  private quitarChip(boton: HTMLElement): void {
    const chip = boton.closest<HTMLElement>('.app-chip');
    const lista = chip?.parentElement;
    chip?.remove();
    if (lista?.classList.contains('app-chip-lista') && !lista.querySelector('.app-chip')) {
      lista.hidden = true;
    }
  }

  // ------------------------------------------------------------- paginación

  /** Las filas que la nota de la paginación declara por página. */
  private filasPorPagina(nav: HTMLElement, total: number): number {
    const nota = nav.querySelector('.app-pagination__nota')?.textContent ?? '';
    const declaradas = Number(/(\d+)\s+filas/.exec(nota)?.[1] ?? 0);
    return declaradas > 0 ? declaradas : total;
  }

  private tablaDeLaPaginacion(nav: HTMLElement): HTMLTableSectionElement | null {
    return (
      nav.parentElement?.querySelector<HTMLTableSectionElement>('table.app-data-table tbody') ?? null
    );
  }

  private botonDePaginacion(nav: HTMLElement, atras: boolean): HTMLElement | null {
    return (
      Array.from(nav.querySelectorAll<HTMLElement>('button')).find(
        (b) => /Anteriores/.test(b.textContent ?? '') === atras,
      ) ?? null
    );
  }

  /**
   * La paginación de la maqueta viene con «Siguientes» habilitado en toda
   * pantalla, tenga las filas que tenga: es un dibujo, no una medición. Acá se
   * la hace decir la verdad contra las filas que la tabla realmente trae — si
   * entran todas en una página, los dos botones quedan anunciados como
   * deshabilitados en vez de prometer una página que no existe.
   *
   * Fabricar una segunda página de filas inventadas sería peor que el dibujo:
   * la rama `mockup` está para probar la aplicación, no para mentirle.
   */
  private ajustarPaginacion(): void {
    this.document
      .querySelectorAll<HTMLElement>('[data-alovida-maqueta] .app-pagination')
      .forEach((nav) => {
        const cuerpo = this.tablaDeLaPaginacion(nav);
        if (!cuerpo) {
          return;
        }
        const filas = Array.from(cuerpo.rows);
        const tam = this.filasPorPagina(nav, filas.length);
        this.mostrarPagina(nav, 1, tam, Math.max(1, Math.ceil(filas.length / tam)));
      });
  }

  private paginar(boton: HTMLElement): void {
    const nav = boton.closest<HTMLElement>('.app-pagination');
    const cuerpo = nav ? this.tablaDeLaPaginacion(nav) : null;
    if (!nav || !cuerpo) {
      return;
    }
    const tam = this.filasPorPagina(nav, cuerpo.rows.length);
    const paginas = Math.max(1, Math.ceil(cuerpo.rows.length / tam));
    const actual = Number(nav.dataset['pagina'] ?? '1');
    const atras = /Anteriores/.test(boton.textContent ?? '');
    const destino = Math.min(paginas, Math.max(1, actual + (atras ? -1 : 1)));
    if (destino !== actual) {
      this.mostrarPagina(nav, destino, tam, paginas);
    }
  }

  private mostrarPagina(nav: HTMLElement, pagina: number, tam: number, paginas: number): void {
    const cuerpo = this.tablaDeLaPaginacion(nav);
    if (!cuerpo) {
      return;
    }
    nav.dataset['pagina'] = String(pagina);
    Array.from(cuerpo.rows).forEach((fila, indice) => {
      fila.hidden = Math.floor(indice / tam) + 1 !== pagina;
    });
    this.botonDePaginacion(nav, true)?.setAttribute('aria-disabled', String(pagina === 1));
    this.botonDePaginacion(nav, false)?.setAttribute('aria-disabled', String(pagina === paginas));
  }

  // -------------------------------------------------------- filas repetidas

  /**
   * Las secciones de reglas del formulario son un repetidor: N tarjetas
   * `.app-card--inset` con su «Quitar», y un «Agregar otra…» al final. La
   * maqueta las dibuja; acá se las hace crecer y encoger.
   */
  private quitarBloqueRepetido(boton: HTMLElement): void {
    const bloque = boton.closest<HTMLElement>('.app-card--inset');
    const seccion = bloque?.closest<HTMLElement>('[app-form-section]');
    if (!bloque || !seccion) {
      return;
    }
    /* La última no se saca: una sección de reglas vacía no deja por dónde
       volver a empezar, y el «Agregar otra…» clona a partir de la última. */
    if (seccion.querySelectorAll('.app-card--inset').length <= 1) {
      return;
    }
    bloque.remove();
    this.renumerarBloques(seccion);
  }

  private agregarBloqueRepetido(boton: HTMLElement): void {
    const seccion = boton.closest<HTMLElement>('[app-form-section]');
    const bloques = seccion
      ? Array.from(seccion.querySelectorAll<HTMLElement>('.app-card--inset'))
      : [];
    const ultimo = bloques[bloques.length - 1];
    if (!seccion || !ultimo) {
      return;
    }
    const copia = ultimo.cloneNode(true) as HTMLElement;
    copia.querySelectorAll<HTMLInputElement>('input').forEach((campo) => {
      if (campo.type === 'checkbox' || campo.type === 'radio') {
        campo.checked = false;
      } else {
        campo.value = '';
      }
    });
    copia.querySelectorAll<HTMLTextAreaElement>('textarea').forEach((campo) => {
      campo.value = '';
    });
    copia.querySelectorAll<HTMLSelectElement>('select').forEach((campo) => {
      campo.selectedIndex = 0;
    });
    this.reidentificar(copia, bloques.length + 1);
    ultimo.after(copia);
    this.renumerarBloques(seccion);
    copia.querySelector<HTMLElement>(FOCALIZABLES)?.focus();
  }

  /**
   * Un clon trae los `id` del original, y dos `id` iguales rompen la relación
   * `label[for]`: el rótulo de la fila nueva enfocaría el campo de la vieja.
   * Se les agrega el número de fila y se reescriben las referencias que
   * apuntan adentro del propio bloque.
   */
  private reidentificar(bloque: HTMLElement, indice: number): void {
    const nuevos = new Map<string, string>();
    bloque.querySelectorAll<HTMLElement>('[id]').forEach((el) => {
      const nuevo = `${el.id}-r${indice}`;
      nuevos.set(el.id, nuevo);
      el.id = nuevo;
    });
    const REFERENCIAS = ['for', 'aria-describedby', 'aria-controls', 'aria-labelledby'] as const;
    bloque
      .querySelectorAll<HTMLElement>(REFERENCIAS.map((attr) => `[${attr}]`).join(', '))
      .forEach((el) => {
        REFERENCIAS.forEach((attr) => {
          const valor = el.getAttribute(attr);
          if (!valor) {
            return;
          }
          const reescrito = valor
            .split(/\s+/)
            .map((ref) => nuevos.get(ref) ?? ref)
            .join(' ');
          if (reescrito !== valor) {
            el.setAttribute(attr, reescrito);
          }
        });
      });
  }

  /** «Regla 1», «Regla 2»… El número lo da la posición, no el markup. */
  private renumerarBloques(seccion: HTMLElement): void {
    seccion.querySelectorAll<HTMLElement>('.app-card--inset').forEach((bloque, indice) => {
      const rotulo = bloque.querySelector<HTMLElement>('.app-card__cabecera .overline');
      if (rotulo) {
        rotulo.textContent = (rotulo.textContent ?? '').replace(/\d+\s*$/, String(indice + 1));
      }
    });
  }

  // ------------------------------------------------ el resto de los botones

  /**
   * «Ver el JSON»: el valor está en el `title` del panel que envuelve al
   * botón, que sólo se ve al pasar el mouse. El botón lo baja a la página,
   * donde el teclado y el táctil también llegan.
   */
  private revelarElTitulo(boton: HTMLElement): void {
    const panel = boton.closest<HTMLElement>('.app-tooltip-panel[title]');
    const contenido = panel?.getAttribute('title');
    if (!panel || !contenido) {
      return;
    }
    const abierto = panel.querySelector('.app-titulo-revelado');
    if (abierto) {
      abierto.remove();
      boton.setAttribute('aria-expanded', 'false');
      return;
    }
    const caja = this.document.createElement('pre');
    caja.className = 'app-titulo-revelado app-textarea--mono';
    caja.textContent = contenido;
    panel.append(caja);
    boton.setAttribute('aria-expanded', 'true');
  }

  /**
   * La acción final de un formulario. Los pasos intermedios ya navegan solos
   * —el generador los porta como `routerLink="." [queryParams]="{estado:…}"`—;
   * el que quedaba mudo es el último, el que en el producto guarda.
   *
   * Sin API que llamar, lo honesto es hacer las dos cosas que sí dependen del
   * front: validar lo que el markup declara obligatorio, y volver a donde el
   * propio formulario dice que se vuelve —el destino de su «Cancelar», que es
   * el listado del que se salió—. Inventar un mensaje de «guardado» sería
   * afirmar algo que no pasó.
   */
  private confirmarFormulario(boton: HTMLElement): void {
    const formulario = boton.closest('form');
    if (formulario && !formulario.checkValidity()) {
      formulario.reportValidity();
      formulario.querySelector<HTMLElement>(':invalid')?.focus();
      return;
    }
    /* Se busca en toda la pantalla y no sólo en esta barra: en un formulario
       por etapas el «Cancelar» con destino vive en el primer paso, y la barra
       del último sólo trae «Atrás», que apunta a la etapa anterior. */
    const pantalla =
      boton.closest<HTMLElement>('.app-view-state-host') ??
      boton.closest<HTMLElement>('[data-alovida-maqueta]');
    const enlaces = Array.from(pantalla?.querySelectorAll<HTMLElement>('.app-form-actions a') ?? []);
    /* El atributo se lee a mano y no por selector: el DOM lo guarda en
       minúsculas —`routerlink`— y así da igual con qué caja lo escribió el
       generador. `.` es la etapa anterior del mismo formulario, no la salida. */
    const destino = enlaces
      .map((a) => a.getAttribute('routerLink') ?? a.getAttribute('routerlink'))
      .find((ruta) => !!ruta && ruta !== '.');
    if (destino) {
      void this.router.navigateByUrl(destino);
    }
  }

  /**
   * Mueve el estado de la pantalla por la URL, que es quien lo manda: así el
   * botón «Reintentar» del bloque de error deshace exactamente lo que puso
   * `?estado=error`, y la vuelta atrás del navegador sigue funcionando.
   */
  private irAEstado(estado: string | null): void {
    const [ruta, consulta] = this.router.url.split('?');
    const parametros = new URLSearchParams(consulta ?? '');
    if (estado) {
      parametros.set('estado', estado);
    } else {
      parametros.delete('estado');
    }
    const cadena = parametros.toString();
    void this.router.navigateByUrl(cadena ? `${ruta}?${cadena}` : ruta, { replaceUrl: true });
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
   * fondo descansa en un blanco casi puro —`alovida.css` lo multiplica ahí,
   * `PRESENCIA_REPOSO` es el mismo número que su valor de respaldo, para que
   * la primera pintura bajo SSR y el reposo tras mover el mouse se vean
   * idénticos— y el celeste **aparece** mientras el puntero está activo. Un
   * único `setTimeout` reprogramado en cada movimiento —no un `setInterval`—
   * lo hace descansar nada más quedarse quieto: se cancela y se vuelve a
   * armar, jamás se acumulan dos. En modo oscuro `alovida.css` ignora esta
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

  /**
   * La gota de agua: una onda que se abre donde cae el puntero.
   *
   * TAREA-08 · FT-08-R03. El fondo ya reaccionaba al movimiento —cuatro focos
   * que siguen la mano, `fondoReactivo()`—; esto es lo otro que pidió el
   * registro, «generar efecto gota de agua».
   *
   * ## Por qué el clic y no el movimiento
   *
   * Una onda por cada `mousemove` sería una estela: ruido permanente sobre un
   * fondo que ya se mueve, y trabajo de GPU sostenido. Una gota cae cuando
   * algo toca la superficie, y el clic **es** ese toque — el gesto y la
   * metáfora coinciden.
   *
   * ## Por qué sólo con mouse
   *
   * `pointerdown` trae el tipo de puntero. En táctil el dedo tapa justamente
   * el punto donde nacería la onda, así que no se vería; y en un teléfono cada
   * toque es una navegación, no un gesto sobre el fondo. Se descarta ahí en
   * vez de dibujar algo que nadie va a ver (P-08-6).
   *
   * ## Cómo se reinicia
   *
   * Una animación CSS no vuelve a empezar porque cambie una variable. Se
   * quita el atributo, se fuerza un reflujo leyendo `offsetWidth` —sin eso el
   * navegador agrupa el quita-y-pone y no ve cambio alguno— y se vuelve a
   * poner. El temporizador lo retira al terminar para dejar el DOM como
   * estaba.
   *
   * Quien pidió menos movimiento no engancha nada, igual que el fondo.
   */
  private gotaDeAgua(): void {
    const ventana = this.ventana;
    if (!ventana || this.prefiereMenosMovimiento()) {
      return;
    }
    const raiz = this.document.documentElement;
    let fin: ReturnType<typeof setTimeout> | null = null;

    ventana.addEventListener(
      'pointerdown',
      (evento) => {
        if (evento.pointerType !== 'mouse') {
          return;
        }

        raiz.style.setProperty('--gota-x', `${evento.clientX}px`);
        raiz.style.setProperty('--gota-y', `${evento.clientY}px`);

        raiz.removeAttribute('data-gota');
        // Leer una propiedad de layout obliga al navegador a aplicar la
        // quita antes del pone; sin esto los dos cambios se agrupan y la
        // animación no se reinicia.
        void raiz.offsetWidth;
        raiz.setAttribute('data-gota', '');

        if (fin !== null) {
          clearTimeout(fin);
        }
        fin = setTimeout(() => {
          fin = null;
          raiz.removeAttribute('data-gota');
        }, GOTA_MS);
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

    const esCajon = () => this.consultaDeMedios(ANCHO_CAJON)?.matches ?? false;

    const actualizarBoton = () => {
      const expandido = esCajon()
        ? raiz.classList.contains('nav-abierto')
        : !raiz.classList.contains('nav-collapsed');
      if (expandido) {
        nav.removeAttribute('inert');
      } else {
        nav.setAttribute('inert', '');
      }
      boton.setAttribute('aria-expanded', String(expandido));
      boton.setAttribute(
        'aria-label',
        expandido ? 'Ocultar el menú de navegación' : 'Abrir el menú de navegación',
      );
    };

    const abrir = () => {
      raiz.classList.add('nav-abierto');
      actualizarBoton();
      nav.querySelector<HTMLElement>(FOCALIZABLES)?.focus();
    };

    const cerrar = (devolverFoco: boolean) => {
      if (!raiz.classList.contains('nav-abierto')) {
        return;
      }
      raiz.classList.remove('nav-abierto');
      actualizarBoton();
      if (devolverFoco) {
        boton.focus();
      }
    };

    boton.addEventListener('click', () => {
      if (esCajon()) {
        if (raiz.classList.contains('nav-abierto')) {
          cerrar(true);
        } else {
          abrir();
        }
        return;
      }

      raiz.classList.toggle('nav-collapsed');
      actualizarBoton();
      boton.focus();
    });
    velo.addEventListener('click', () => cerrar(true));

    /* Elegir un ítem cierra el cajón: si el enlace navega, igual; si es la
       pantalla actual, el cajón no puede quedarse tapando lo que se eligió. */
    nav.addEventListener('click', (evento) => {
      if (esCajon() && (evento.target as HTMLElement | null)?.closest('.app-side-nav__item')) {
        cerrar(false);
      }
    });

    this.document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape' && esCajon()) {
        cerrar(true);
      }
      if (evento.key !== 'Tab' || !raiz.classList.contains('nav-abierto')) {
        return;
      }
      /* Con el cajón abierto el resto de la página está bajo el velo: el
         tabulador no puede salir de él. */
      this.atraparFoco(evento, nav);
    });

    /* Al cruzar el punto de quiebre se restablece el estado inicial del modo
       nuevo: evita dejar el velo móvil o el sidebar de escritorio oculto. */
    this.consultaDeMedios(ANCHO_CAJON)?.addEventListener('change', () => {
      raiz.classList.remove('nav-abierto', 'nav-collapsed');
      actualizarBoton();
    });

    actualizarBoton();
    this.mudarSelectorDeOrganizacion(nav);
  }

  /**
   * En un header de 320 px el selector de organización no entra. No se oculta
   * —es el control que dice en qué organización estás— sino que baja al cajón.
   * Se guarda de dónde salió para devolverlo intacto al ensanchar.
   */
  private mudarSelectorDeOrganizacion(nav: HTMLElement): void {
    const ventana = this.ventana;
    const boton = this.document.querySelector<HTMLElement>('.app-header .app-tenant-switcher');
    /* Se muda el anclaje, no el botón: el desplegable de organizaciones cuelga
       de él, y bajando sólo el botón el panel quedaría huérfano en el header,
       abriéndose a un costado de la pantalla en vez de debajo del control. */
    const selector = boton?.closest<HTMLElement>('.app-header__anclaje') ?? boton;
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

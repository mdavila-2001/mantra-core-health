/* ============================================================================
    El runtime de ALOVIDA no tiene estado propio que inspeccionar: lo que hace es
    tocar el DOM. Así que estas pruebas montan el marcado que trae cada maqueta
    —un menú de desborde, un diálogo, una tabla, el header con el nav— y miran
    lo que quedó.

    Lo que se fija acá es lo que rompería sin avisar al portar una vista nueva:
    que el cajón no se duplique al navegar, que la tabla se etiquete sola, y
    que el conmutador de estados obedezca a la URL sin apagar pantallas que no
    declaran ese estado.
    ========================================================================== */

import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AlovidaRuntimeService } from './alovida-runtime.service';

describe('AlovidaRuntimeService', () => {
  let servicio: AlovidaRuntimeService;
  /**
   * El mismo Router que se inyectó el servicio. TestBed rearma su inyector
   * entre pruebas, así que un `TestBed.inject(Router)` de adentro de un `it`
   * devuelve OTRA instancia: espiarla no vería las navegaciones del servicio,
   * que sigue aferrado a la de `beforeAll`.
   */
  let router: Router;

  /**
   * jsdom no implementa `matchMedia`. El servicio ya tolera su ausencia, pero
   * con él ausente nunca se ejercitan las ramas que dependen del ancho; se
   * declara acá, y cada prueba decide qué contesta.
   */
  function declararMatchMedia(coincide = false) {
    const oyentes = new Map<string, (evento: MediaQueryListEvent) => void>();
    window.matchMedia = ((consulta: string) => ({
      matches: coincide,
      media: consulta,
      addEventListener: (_: string, cb: (evento: MediaQueryListEvent) => void) =>
        oyentes.set(consulta, cb),
      removeEventListener: () => oyentes.delete(consulta),
    })) as unknown as typeof window.matchMedia;
    return oyentes;
  }

  /** `refrescar()` espera al cuadro siguiente; acá se resuelve en el acto. */
  function cuadroInmediato() {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  }

  /**
   * Un solo servicio para todo el archivo, a propósito.
   *
   * `instalar()` engancha en `document` y no se desengancha nunca — es correcto
   * en producción, donde el servicio es único y vive lo que vive la aplicación.
   * Pero con una instancia nueva por prueba los oyentes de las anteriores
   * siguen ahí, y un clic en un menú lo abriría y lo cerraría tantas veces
   * como pruebas hubieran corrido antes. Reusar la instancia reproduce lo que
   * pasa de verdad: uno solo, instalado una vez.
   */
  beforeAll(() => {
    /* El servicio mueve el estado de la pantalla por la URL (`?estado=…`), así
       que necesita un Router de verdad; sin rutas declaradas alcanza, porque
       lo que se mide acá es el DOM, no a dónde se llegó. */
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    servicio = TestBed.inject(AlovidaRuntimeService);
    router = TestBed.inject(Router);
    declararMatchMedia(false);
    servicio.instalar();
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    document.documentElement.className = '';
    declararMatchMedia(false);
    cuadroInmediato();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('instalar', () => {
    it('marca que hay JavaScript: de ese atributo cuelga todo el responsive de la hoja', () => {
      expect(document.documentElement.getAttribute('data-js')).toBe('on');
    });

    it('publica el hueco de la barra en cero: acá esa barra no existe', () => {
      // En la maqueta el hueco lo reserva la barra de andamiaje. Sin ponerlo en
      // cero, el marco deja un margen muerto contra el borde inferior.
      expect(document.documentElement.style.getPropertyValue('--h-barra')).toBe('0px');
    });
  });

  describe('arquetipo', () => {
    it('lo estampa en el cuerpo, que es de donde cuelgan las reglas de composición', () => {
      servicio.fijarArquetipo('formulario');

      expect(document.body.getAttribute('data-arquetipo')).toBe('formulario');
    });

    it('sin arquetipo lo retira, en vez de dejar el de la pantalla anterior', () => {
      servicio.fijarArquetipo('listado');
      servicio.fijarArquetipo(null);

      expect(document.body.hasAttribute('data-arquetipo')).toBe(false);
    });
  });

  describe('estados de la pantalla', () => {
    function montarPasos() {
      document.body.innerHTML = `
        <section class="app-view-state-host">
          <div data-estado="paso1">uno</div>
          <div data-estado="paso2" hidden>dos</div>
          <div data-estado="paso3" hidden>tres</div>
        </section>
        <p data-solo-estado="paso2">sólo en el paso 2</p>
      `;
    }

    function visibles(): readonly string[] {
      return [...document.querySelectorAll<HTMLElement>('[data-estado]')]
        .filter((el) => !el.hidden)
        .map((el) => el.dataset['estado'] ?? '');
    }

    it('sin estado en la URL manda el primero que declara la pantalla', () => {
      montarPasos();

      servicio.fijarEstado(null);

      expect(visibles()).toEqual(['paso1']);
    });

    it('el estado de la URL revela su bloque y apaga los demás', () => {
      montarPasos();

      servicio.fijarEstado('paso2');

      expect(visibles()).toEqual(['paso2']);
    });

    it('un estado que esta pantalla no declara no la deja en blanco', () => {
      montarPasos();

      // Cada arquetipo tiene sus propios estados: el de otra pantalla no
      // significa nada acá, y apagarlo todo dejaría la vista vacía.
      servicio.fijarEstado('exito');

      expect(visibles()).toEqual(['paso1']);
    });

    it('los elementos sueltos siguen al estado elegido', () => {
      montarPasos();
      const suelto = document.querySelector<HTMLElement>('[data-solo-estado]');

      servicio.fijarEstado('paso1');
      expect(suelto?.hidden).toBe(true);

      servicio.fijarEstado('paso2');
      expect(suelto?.hidden).toBe(false);
    });
  });

  describe('menús de desborde', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="menu-anclaje">
          <button aria-haspopup="menu" aria-expanded="false" aria-controls="m1">⋮</button>
          <div class="app-menu" id="m1" hidden><button class="app-menu-item">Editar</button></div>
        </div>
        <div class="menu-anclaje">
          <button aria-haspopup="menu" aria-expanded="false" aria-controls="m2">⋮</button>
          <div class="app-menu" id="m2" hidden><button class="app-menu-item">Borrar</button></div>
        </div>
      `;
    });

    const menu = (id: string) => document.getElementById(id) as HTMLElement;
    const disparador = (id: string) =>
      document.querySelector<HTMLElement>(`[aria-controls="${id}"]`) as HTMLElement;

    it('el disparador abre su menú y lo anuncia', () => {
      disparador('m1').click();

      expect(menu('m1').hidden).toBe(false);
      expect(disparador('m1').getAttribute('aria-expanded')).toBe('true');
    });

    it('abrir uno cierra el otro: no quedan dos abiertos a la vez', () => {
      disparador('m1').click();
      disparador('m2').click();

      expect(menu('m1').hidden).toBe(true);
      expect(menu('m2').hidden).toBe(false);
    });

    it('un clic fuera los cierra todos', () => {
      disparador('m1').click();

      document.body.click();

      expect(menu('m1').hidden).toBe(true);
      expect(disparador('m1').getAttribute('aria-expanded')).toBe('false');
    });

    it('Escape también los cierra', () => {
      disparador('m1').click();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(menu('m1').hidden).toBe(true);
    });

    /**
     * AG49-FT01-001/002. `app-menu`/`appMenuTrigger` (el menú de preferencias
     * de una publicación) usa el mismo contrato ARIA que este menú de
     * desborde legado —`aria-haspopup="menu"` + `aria-controls`— pero
     * gobierna su apertura con una señal propia, no con el atributo
     * `hidden`. Sin acotar este oyente a `.menu-anclaje`, un clic en ESE
     * disparador también caía acá, y el `menu.hidden = true` que sigue
     * dejaba el panel de Angular invisible para siempre (`alovida.css` fuerza
     * `display:none` en `[hidden]` con `!important`, por encima de la clase
     * `menu--open`).
     */
    it('un disparador con el mismo contrato ARIA pero fuera de .menu-anclaje no lo toca', () => {
      document.body.insertAdjacentHTML(
        'beforeend',
        `<button aria-haspopup="menu" aria-expanded="false" aria-controls="m-angular">⋮</button>
         <div id="m-angular" role="menu"><button>Ir al perfil del doctor</button></div>`,
      );
      const disparadorAngular = document.querySelector<HTMLElement>(
        '[aria-controls="m-angular"]',
      ) as HTMLElement;
      const menuAngular = document.getElementById('m-angular') as HTMLElement;

      disparadorAngular.click();

      // Ni lo abre a su manera (no le toca `hidden`) ni le cambia el
      // `aria-expanded`: ese contrato es enteramente de Angular acá.
      expect(menuAngular.hidden).toBe(false);
      expect(disparadorAngular.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('diálogo', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div data-fondo class="marco-atenuado" aria-hidden="true">
          <button tabindex="-1">detrás</button>
        </div>
        <div class="app-dialog-capa">
          <div class="app-dialog"><button>Aceptar</button></div>
        </div>
      `;
    });

    it('Escape retira el velo y devuelve el marco a la operación', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      const capa = document.querySelector<HTMLElement>('.app-dialog-capa');
      const fondo = document.querySelector<HTMLElement>('[data-fondo]');
      expect(capa?.hidden).toBe(true);
      expect(fondo?.hasAttribute('aria-hidden')).toBe(false);
      expect(fondo?.classList.contains('marco-atenuado')).toBe(false);
      // El fondo vuelve a ser tabulable: si no, el foco quedaría en el limbo.
      expect(fondo?.querySelector('button')?.hasAttribute('tabindex')).toBe(false);
    });
  });

  describe('etiquetas de columna', () => {
    it('cada celda se lleva adelante el nombre de su columna', () => {
      document.body.innerHTML = `
        <table class="app-data-table">
          <thead><tr><th>Código</th><th>Razón social</th></tr></thead>
          <tbody><tr><td>abc</td><td>Clínica Norte</td></tr></tbody>
        </table>
      `;

      servicio.refrescar();

      const celdas = [...document.querySelectorAll('tbody td')];
      expect(celdas.map((c) => c.getAttribute('data-etiqueta'))).toEqual([
        'Código',
        'Razón social',
      ]);
    });

    it('una celda que abarca la tabla entera no lleva etiqueta: no rotula un dato', () => {
      document.body.innerHTML = `
        <table class="app-data-table">
          <thead><tr><th>Código</th><th>Razón social</th></tr></thead>
          <tbody><tr><td colspan="2">No hay organizaciones todavía</td></tr></tbody>
        </table>
      `;

      servicio.refrescar();

      expect(document.querySelector('tbody td')?.hasAttribute('data-etiqueta')).toBe(false);
    });
  });

  describe('navegación lateral adaptable', () => {
    function montarMarco() {
      document.body.innerHTML = `
        <nav class="app-side-nav"><a class="app-side-nav__item" href="#x">Inicio</a></nav>
        <header class="app-header">
          <label class="app-header__buscador"><input type="search" /></label>
          <div class="app-header__derecha"></div>
        </header>
      `;
    }

    it('inyecta el botón del cajón y el velo, que la maqueta no trae escritos', () => {
      montarMarco();

      servicio.refrescar();

      expect(document.querySelectorAll('.app-nav-toggle')).toHaveLength(1);
      expect(document.querySelectorAll('.app-nav-velo')).toHaveLength(1);
    });

    it('refrescar de nuevo no los duplica: pasa en cada navegación', () => {
      montarMarco();

      servicio.refrescar();
      servicio.refrescar();

      expect(document.querySelectorAll('.app-nav-toggle')).toHaveLength(1);
      expect(document.querySelectorAll('.app-buscar-toggle')).toHaveLength(1);
    });

    it('el botón del cajón lo abre y lo cierra', () => {
      montarMarco();
      declararMatchMedia(true);
      servicio.refrescar();
      const boton = document.querySelector<HTMLElement>('.app-nav-toggle') as HTMLElement;

      boton.click();
      expect(document.documentElement.classList.contains('nav-abierto')).toBe(true);
      expect(boton.getAttribute('aria-expanded')).toBe('true');

      boton.click();
      expect(document.documentElement.classList.contains('nav-abierto')).toBe(false);
    });

    it('en escritorio oculta y restaura la barra con el botón de navegación', () => {
      montarMarco();
      servicio.refrescar();
      const boton = document.querySelector<HTMLElement>('.app-nav-toggle') as HTMLElement;

      boton.click();

      expect(document.documentElement.classList.contains('nav-collapsed')).toBe(true);
      expect(document.querySelector('.app-side-nav')?.hasAttribute('inert')).toBe(true);
      expect(boton.getAttribute('aria-expanded')).toBe('false');
      expect(boton.getAttribute('aria-label')).toBe('Abrir el menú de navegación');

      boton.click();

      expect(document.documentElement.classList.contains('nav-collapsed')).toBe(false);
      expect(document.querySelector('.app-side-nav')?.hasAttribute('inert')).toBe(false);
      expect(boton.getAttribute('aria-expanded')).toBe('true');
      expect(boton.getAttribute('aria-label')).toBe('Ocultar el menú de navegación');
    });

    it('elegir un ítem cierra el cajón: no puede quedar tapando lo que se eligió', () => {
      montarMarco();
      declararMatchMedia(true);
      servicio.refrescar();
      document.querySelector<HTMLElement>('.app-nav-toggle')?.click();

      document.querySelector<HTMLElement>('.app-side-nav__item')?.click();

      expect(document.documentElement.classList.contains('nav-abierto')).toBe(false);
    });

    it('el velo cierra el cajón al tocarlo', () => {
      montarMarco();
      declararMatchMedia(true);
      servicio.refrescar();
      document.querySelector<HTMLElement>('.app-nav-toggle')?.click();

      document.querySelector<HTMLElement>('.app-nav-velo')?.click();

      expect(document.documentElement.classList.contains('nav-abierto')).toBe(false);
    });

    it('el buscador compacto despliega el campo y lo enfoca', () => {
      montarMarco();
      servicio.refrescar();
      const boton = document.querySelector<HTMLElement>('.app-buscar-toggle') as HTMLElement;

      boton.click();

      const header = document.querySelector('.app-header');
      expect(header?.classList.contains('is-buscando')).toBe(true);
      expect(document.activeElement).toBe(document.querySelector('.app-header__buscador input'));
    });

    it('Escape recoge el buscador compacto', () => {
      montarMarco();
      servicio.refrescar();
      document.querySelector<HTMLElement>('.app-buscar-toggle')?.click();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(document.querySelector('.app-header')?.classList.contains('is-buscando')).toBe(false);
    });

    it('en pantalla angosta el selector de organización baja al cajón', () => {
      declararMatchMedia(true);
      document.body.innerHTML = `
        <nav class="app-side-nav"><p class="app-side-nav__marca">AloVida</p></nav>
        <header class="app-header">
          <label class="app-header__buscador"><input type="search" /></label>
          <div class="app-header__derecha">
            <button class="app-tenant-switcher">Clínica Norte</button>
          </div>
        </header>
      `;

      servicio.refrescar();

      // No se oculta —es el control que dice en qué organización estás— sino
      // que cambia de sitio, donde sí entra.
      expect(document.querySelector('.app-side-nav .app-tenant-switcher')).not.toBeNull();
      expect(document.querySelector('.app-header .app-tenant-switcher')).toBeNull();
    });
  });

  describe('secuencia de entrada', () => {
    it('marca el cuerpo al entrar y lo desmarca cuando la animación terminó', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      servicio.refrescar();
      expect(document.body.classList.contains('entrando')).toBe(true);

      vi.advanceTimersByTime(1300);
      expect(document.body.classList.contains('entrando')).toBe(false);
      expect(document.body.classList.contains('entrada-hecha')).toBe(true);

      vi.useRealTimers();
    });

    it('navegar otra vez vuelve a animar: cada pantalla es una entrada nueva', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      servicio.refrescar();
      vi.advanceTimersByTime(1300);
      servicio.refrescar();

      expect(document.body.classList.contains('entrando')).toBe(true);
      expect(document.body.classList.contains('entrada-hecha')).toBe(false);

      vi.useRealTimers();
    });
  });

  /**
   * TAREA-08 (fondo reactivo, v4.3): `--fondo-presencia` es lo que
   * `alovida.css` multiplica sobre la opacidad del fondo en modo claro para
   * que el celeste **aparezca** con el puntero y se retire al quedarse
   * quieto (AC-08-6). El servicio se instaló una sola vez en el `beforeAll`
   * de este archivo —matchMedia sin coincidencias, así que
   * `prefiereMenosMovimiento()` fue `false` al instalar—, y por eso el
   * oyente de `mousemove` de `fondoReactivo()` ya está enganchado: estas
   * pruebas lo ejercitan tal como quedó, sin volver a llamar `instalar()`.
   */
  describe('fondoReactivo', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('mover el puntero publica --raton-x/-y y sube la presencia a 1', () => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 50 }));

      const raiz = document.documentElement.style;
      expect(raiz.getPropertyValue('--raton-x')).not.toBe('');
      expect(raiz.getPropertyValue('--raton-y')).not.toBe('');
      expect(raiz.getPropertyValue('--fondo-presencia')).toBe('1');
    });

    it('al quedarse quieto, la presencia vuelve al mismo número que el respaldo de la hoja', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }));
      expect(document.documentElement.style.getPropertyValue('--fondo-presencia')).toBe('1');

      vi.advanceTimersByTime(650);

      // `.35` es el mismo valor que `var(--fondo-presencia, .35)` en
      // alovida.css: el reposo tras mover el mouse pinta igual que la
      // primera pintura, antes de que este servicio corriera.
      expect(document.documentElement.style.getPropertyValue('--fondo-presencia')).toBe('.35');

      vi.useRealTimers();
    });

    it('mover el puntero de nuevo antes de quedarse quieto reprograma el reposo, no lo acumula', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }));
      vi.advanceTimersByTime(400);
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 20 }));
      vi.advanceTimersByTime(400);

      // Pasaron 800ms desde el primer movimiento —más que los 650 del reposo—
      // pero sólo 400 desde el segundo: un único temporizador reprogramado
      // sigue esperando, no dos que se dispararon por separado.
      expect(document.documentElement.style.getPropertyValue('--fondo-presencia')).toBe('1');

      vi.advanceTimersByTime(250);
      expect(document.documentElement.style.getPropertyValue('--fondo-presencia')).toBe('.35');

      vi.useRealTimers();
    });
  });

  /**
   * TAREA-08 · FT-08-R03, la gota de agua. Mismo montaje que el fondo: el
   * servicio se instaló una vez en el `beforeAll` con `matchMedia` sin
   * coincidencias, así que el oyente de `pointerdown` está enganchado.
   */
  describe('gotaDeAgua', () => {
    afterEach(() => {
      document.documentElement.removeAttribute('data-gota');
      vi.useRealTimers();
    });

    function clic(x: number, y: number, pointerType = 'mouse'): void {
      // `PointerEvent` no existe en jsdom: se despacha un `MouseEvent` con el
      // tipo de puntero agregado, que es lo único que el servicio lee.
      const evento = new MouseEvent('pointerdown', { clientX: x, clientY: y });
      Object.defineProperty(evento, 'pointerType', { value: pointerType });
      window.dispatchEvent(evento);
    }

    it('el clic publica el punto de la gota y enciende la animación', () => {
      clic(120, 80);

      const raiz = document.documentElement;
      expect(raiz.style.getPropertyValue('--gota-x')).toBe('120px');
      expect(raiz.style.getPropertyValue('--gota-y')).toBe('80px');
      expect(raiz.hasAttribute('data-gota')).toBe(true);
    });

    it('al terminar la onda el atributo se retira, y el clic siguiente la reinicia', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      clic(10, 10);
      expect(document.documentElement.hasAttribute('data-gota')).toBe(true);

      // 900ms es lo que dura `gota-de-agua` en alovida.css: el atributo se
      // retira recién ahí, para no cortar la onda a la mitad.
      vi.advanceTimersByTime(900);
      expect(document.documentElement.hasAttribute('data-gota')).toBe(false);

      clic(200, 150);
      expect(document.documentElement.hasAttribute('data-gota')).toBe(true);
      expect(document.documentElement.style.getPropertyValue('--gota-x')).toBe('200px');
    });

    it('un clic durante la onda anterior la reinicia en el punto nuevo, sin dejar dos temporizadores', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      clic(10, 10);
      vi.advanceTimersByTime(500);
      clic(300, 200);

      // Pasaron 900ms desde el primer clic —lo que dura la onda— pero sólo 400
      // desde el segundo: si el primer temporizador siguiera vivo, borraría el
      // atributo en medio de la onda nueva.
      vi.advanceTimersByTime(400);
      expect(document.documentElement.hasAttribute('data-gota')).toBe(true);
      expect(document.documentElement.style.getPropertyValue('--gota-x')).toBe('300px');

      vi.advanceTimersByTime(500);
      expect(document.documentElement.hasAttribute('data-gota')).toBe(false);
    });

    it('el toque en pantalla táctil no dispara la gota', () => {
      // P-08-6: el dedo tapa el punto donde nacería la onda, y cada toque es
      // una navegación. Se descarta en vez de dibujar algo que nadie ve.
      document.documentElement.style.removeProperty('--gota-x');

      clic(50, 60, 'touch');

      expect(document.documentElement.hasAttribute('data-gota')).toBe(false);
      expect(document.documentElement.style.getPropertyValue('--gota-x')).toBe('');
    });
  });

  /* ==========================================================================
     Los botones de las vistas portadas. En la bóveda los movía
     `_assets/alovida.js`; acá los mueve `controlesDeMaqueta`, y lo que se fija
     es que sigan acotados al marco de la maqueta: las clases de las que
     cuelgan las usa también el resto de la aplicación, con sus propios
     componentes de Angular.
     ======================================================================== */
  describe('controles de la maqueta', () => {
    /** Todo va envuelto en la marca del marco: sin ella el oyente no mira. */
    const marco = (interior: string) => {
      document.body.innerHTML = `<div data-alovida-maqueta>${interior}</div>`;
    };
    const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel) as T;

    describe('combo de referencia', () => {
      beforeEach(() => {
        marco(`
          <input id="c-1" role="combobox" aria-expanded="true" aria-controls="c-1-m" value="terceros">
          <div class="app-menu" id="c-1-m" role="listbox">
            <button type="button" role="option" aria-selected="true"><span>Andrea Terceros<br><span class="caption">Pediatría</span></span></button>
            <button type="button" role="option" aria-selected="false"><span>Gabriel Terceros<br><span class="caption">Administración</span></span></button>
          </div>
        `);
      });

      it('elegir una opción la escribe en el campo y recoge la lista', () => {
        $<HTMLElement>("[role='option'][aria-selected='false']").click();

        expect($<HTMLInputElement>('#c-1').value).toBe('Gabriel Terceros');
        expect($('#c-1').getAttribute('aria-expanded')).toBe('false');
        expect($('#c-1-m').hidden).toBe(true);
      });

      it('la marca se mueve: no quedan dos opciones elegidas', () => {
        $<HTMLElement>("[role='option'][aria-selected='false']").click();

        const marcadas = document.querySelectorAll("[role='option'][aria-selected='true']");
        expect(marcadas).toHaveLength(1);
      });

      it('sólo escribe la primera línea: lo de abajo del <br> es la aclaración', () => {
        $<HTMLElement>("[role='option'][aria-selected='true']").click();

        expect($<HTMLInputElement>('#c-1').value).toBe('Andrea Terceros');
      });
    });

    it('el chip de un filtro se quita, y la lista vacía se retira', () => {
      marco(`
        <div class="app-chip-lista">
          <span class="app-chip">Activo<button type="button" aria-label="Quitar el filtro Activo">×</button></span>
        </div>
      `);

      $<HTMLElement>('.app-chip button').click();

      expect(document.querySelector('.app-chip')).toBeNull();
      expect($('.app-chip-lista').hidden).toBe(true);
    });

    describe('paginación', () => {
      const tabla = (filas: number, porPagina: number) =>
        marco(`
          <section>
            <table class="app-data-table"><tbody>${'<tr><td>x</td></tr>'.repeat(filas)}</tbody></table>
            <nav class="app-pagination">
              <p class="app-pagination__nota">${porPagina} filas por página</p>
              <button type="button">Anteriores</button>
              <button type="button">Siguientes</button>
            </nav>
          </section>
        `);
      const siguientes = () => $<HTMLElement>('.app-pagination button:last-of-type');
      const anteriores = () => $<HTMLElement>('.app-pagination button');

      it('con todo en una página los dos botones quedan anunciados sin destino', () => {
        // Es la situación de casi todas las vistas portadas: seis filas y una
        // nota que promete veinticinco por página.
        tabla(6, 25);

        servicio.refrescar(null);

        expect(anteriores().getAttribute('aria-disabled')).toBe('true');
        expect(siguientes().getAttribute('aria-disabled')).toBe('true');
      });

      it('cuando sobran filas, avanzar muestra las que faltaban', () => {
        tabla(5, 2);
        servicio.refrescar(null);
        const filas = () => Array.from(document.querySelectorAll<HTMLTableRowElement>('tbody tr'));
        expect(filas().filter((f) => !f.hidden)).toHaveLength(2);

        siguientes().click();

        expect(filas().findIndex((f) => !f.hidden)).toBe(2);
        expect(anteriores().getAttribute('aria-disabled')).toBe('false');
      });

      it('en la última página «Siguientes» se anuncia sin destino', () => {
        tabla(5, 2);
        servicio.refrescar(null);

        siguientes().click();
        siguientes().click();

        expect(siguientes().getAttribute('aria-disabled')).toBe('true');
        expect($('.app-pagination').dataset['pagina']).toBe('3');
      });
    });

    describe('filas repetidas del formulario', () => {
      beforeEach(() => {
        marco(`
          <fieldset app-form-section>
            <div class="app-card app-card--inset">
              <div class="app-card__cabecera"><p class="overline">Regla 1</p><button type="button">Quitar</button></div>
              <label for="c-1">Entidad</label><input id="c-1" value="patient_profiles">
            </div>
            <div class="app-card app-card--inset">
              <div class="app-card__cabecera"><p class="overline">Regla 2</p><button type="button">Quitar</button></div>
              <label for="c-2">Entidad</label><input id="c-2" value="encounters">
            </div>
            <div><button type="button">Agregar otra regla</button></div>
          </fieldset>
        `);
      });

      const bloques = () => document.querySelectorAll('.app-card--inset');
      const rotulos = () =>
        Array.from(document.querySelectorAll('.overline')).map((el) => el.textContent);

      it('«Quitar» saca la fila y renumera las que quedan', () => {
        $<HTMLElement>('.app-card--inset .app-card__cabecera button').click();

        expect(bloques()).toHaveLength(1);
        expect(rotulos()).toEqual(['Regla 1']);
      });

      it('la última fila no se saca: sin ninguna no hay de dónde clonar', () => {
        $<HTMLElement>('.app-card--inset .app-card__cabecera button').click();
        $<HTMLElement>('.app-card--inset .app-card__cabecera button').click();

        expect(bloques()).toHaveLength(1);
      });

      it('«Agregar otra» clona la última en blanco y la numera', () => {
        $<HTMLElement>('fieldset > div > button').click();

        expect(bloques()).toHaveLength(3);
        expect(rotulos()).toEqual(['Regla 1', 'Regla 2', 'Regla 3']);
        const nuevo = document.querySelectorAll<HTMLInputElement>('.app-card--inset input')[2];
        expect(nuevo.value).toBe('');
      });

      it('el clon no repite los `id`: el rótulo tiene que enfocar SU campo', () => {
        $<HTMLElement>('fieldset > div > button').click();

        const ids = Array.from(document.querySelectorAll('[id]')).map((el) => el.id);
        expect(new Set(ids).size).toBe(ids.length);
        const etiqueta = document.querySelectorAll<HTMLLabelElement>('label')[2];
        expect(etiqueta.getAttribute('for')).toBe('c-2-r3');
      });
    });

    it('«Ver el JSON» baja el título a la página, y otro clic lo recoge', () => {
      marco(`<span class="app-tooltip-panel" title='{ "valor": "lpm" }'><button type="button">Ver el JSON</button></span>`);
      const boton = $<HTMLElement>('button');

      boton.click();
      expect($('.app-titulo-revelado').textContent).toBe('{ "valor": "lpm" }');
      expect(boton.getAttribute('aria-expanded')).toBe('true');

      boton.click();
      expect(document.querySelector('.app-titulo-revelado')).toBeNull();
    });

    describe('acción final del formulario', () => {
      it('con un campo obligatorio vacío no navega: primero avisa', () => {
        marco(`
          <form>
            <input required value="">
            <div class="app-form-actions">
              <a routerLink="/accesos/roles-listado">Cancelar</a>
              <button type="button" app-button data-variante="primario">Guardar</button>
            </div>
          </form>
        `);
        const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
        // jsdom implementa checkValidity pero no reportValidity.
        HTMLFormElement.prototype.reportValidity ??= () => false;

        $<HTMLElement>('.app-form-actions button').click();

        expect(navegar).not.toHaveBeenCalled();
      });

      it('válido, vuelve a donde apunta el «Cancelar» del propio formulario', () => {
        marco(`
          <div class="app-view-state-host">
            <div data-estado="paso1">
              <div class="app-form-actions">
                <a routerLink="/accesos/roles-listado">Cancelar</a>
                <a routerLink=".">Continuar</a>
              </div>
            </div>
            <div data-estado="paso2">
              <form>
                <div class="app-form-actions">
                  <a routerLink=".">Atrás</a>
                  <button type="button" app-button data-variante="primario">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        `);
        const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

        $<HTMLElement>("[data-estado='paso2'] .app-form-actions button").click();

        expect(navegar).toHaveBeenCalledWith('/accesos/roles-listado');
      });
    });

    it('un control anunciado como deshabilitado no actúa', () => {
      marco(`
        <div class="app-chip-lista">
          <span class="app-chip">Activo<button type="button" aria-disabled="true" aria-label="Quitar el filtro Activo">×</button></span>
        </div>
      `);

      $<HTMLElement>('.app-chip button').click();

      expect(document.querySelector('.app-chip')).not.toBeNull();
    });

    it('un `submit` no se intercepta: ese lo maneja el componente que lo montó', () => {
      // Una vista portada no envía formularios; un `type="submit"` bajo este
      // marco sólo puede ser de un componente de Angular, y frenarlo sería
      // impedirle enviar.
      marco(`
        <form>
          <div class="app-form-actions">
            <a routerLink="/accesos/roles-listado">Cancelar</a>
            <button type="submit">Guardar</button>
          </div>
        </form>
      `);
      const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      $<HTMLElement>('.app-form-actions button').click();

      expect(navegar).not.toHaveBeenCalled();
    });

    it('fuera del marco de la maqueta no toca nada: ahí manda el componente', () => {
      // La trampa que ya documenta `menusDeDesborde`: `.app-chip` existe también
      // en las pantallas del producto, y allá la gobierna su propio componente.
      document.body.innerHTML = `
        <div class="app-chip-lista">
          <span class="app-chip">Activo<button type="button" aria-label="Quitar el filtro Activo">×</button></span>
        </div>
      `;

      $<HTMLElement>('.app-chip button').click();

      expect(document.querySelector('.app-chip')).not.toBeNull();
    });
  });
});

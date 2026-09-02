/* ============================================================================
    El runtime de REDSAT no tiene estado propio que inspeccionar: lo que hace es
    tocar el DOM. Así que estas pruebas montan el marcado que trae cada maqueta
    —un menú de desborde, un diálogo, una tabla, el header con el nav— y miran
    lo que quedó.

    Lo que se fija acá es lo que rompería sin avisar al portar una vista nueva:
    que el cajón no se duplique al navegar, que la tabla se etiquete sola, y
    que el conmutador de estados obedezca a la URL sin apagar pantallas que no
    declaran ese estado.
    ========================================================================== */

import { TestBed } from '@angular/core/testing';

import { RedsatRuntimeService } from './redsat-runtime.service';

describe('RedsatRuntimeService', () => {
  let servicio: RedsatRuntimeService;

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
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(RedsatRuntimeService);
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

  describe('marco móvil', () => {
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
      servicio.refrescar();
      const boton = document.querySelector<HTMLElement>('.app-nav-toggle') as HTMLElement;

      boton.click();
      expect(document.documentElement.classList.contains('nav-abierto')).toBe(true);
      expect(boton.getAttribute('aria-expanded')).toBe('true');

      boton.click();
      expect(document.documentElement.classList.contains('nav-abierto')).toBe(false);
    });

    it('elegir un ítem cierra el cajón: no puede quedar tapando lo que se eligió', () => {
      montarMarco();
      servicio.refrescar();
      document.querySelector<HTMLElement>('.app-nav-toggle')?.click();

      document.querySelector<HTMLElement>('.app-side-nav__item')?.click();

      expect(document.documentElement.classList.contains('nav-abierto')).toBe(false);
    });

    it('el velo cierra el cajón al tocarlo', () => {
      montarMarco();
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
   * `redsat.css` multiplica sobre la opacidad del fondo en modo claro para
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
      // redsat.css: el reposo tras mover el mouse pinta igual que la
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
});

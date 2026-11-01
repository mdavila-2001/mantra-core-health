import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AlovidaRuntimeService } from './alovida-runtime.service';

/**
 * Detector de ejecución. Un doble de `window.alert` no sirve en este corredor:
 * jsdom corre los manejadores inline en su propio contexto y llama a SU `alert`,
 * no al del objeto que ven las pruebas (medido: el doble nunca se llamaba).
 * Por eso las cargas, en vez de `alert(1)`, escriben una marca en el DOM
 * —`data-xss` en `<html>`— que se ve desde cualquier contexto.
 */
const MARCA = 'data-xss';
function limpiarMarca(): void {
  document.documentElement.removeAttribute(MARCA);
}
/** Dispara los eventos que activan un manejador inline y dice si alguno corrió. */
function ejecutado(): boolean {
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    const conManejador = el.getAttributeNames().some((a) => /^on/i.test(a));
    for (const tipo of ['error', 'load', 'toggle', 'focus', 'mouseover', 'animationstart', ...(conManejador ? ['click'] : [])]) {
      el.dispatchEvent(new Event(tipo));
    }
  }
  return document.documentElement.hasAttribute(MARCA);
}

/**
 * M-4 / O3-5 — `alovida-runtime.service.ts:1132` y `:1347` escriben `innerHTML`
 * en los dos botones que el runtime inyecta en el marco (cajón de navegación y
 * lupa del buscador). Lo que se fija acá: ese HTML es una constante del código
 * —un `<svg>` con trazos— y **nada** de lo que la página ya trae (textos,
 * identificadores, etiquetas que pudo haber escrito un tercero) entra en él ni
 * se vuelve a parsear como marcado.
 */

const HOSTIL = '<img src=x onerror=document.documentElement.dataset.xss=1><script>document.documentElement.dataset.xss=1</script><svg onload=document.documentElement.dataset.xss=1>';

describe('AlovidaRuntimeService · HTML inyectado (M-4)', () => {
  let servicio: AlovidaRuntimeService;

  function montarMarco(idDelNav: string | null): void {
    document.body.innerHTML = `
      <nav class="app-side-nav"><a class="app-side-nav__item" href="#x">Inicio</a></nav>
      <header class="app-header">
        <span class="app-header__titulo"></span>
        <label class="app-header__buscador"><input type="search" /></label>
        <div class="app-header__derecha"><span class="app-header__usuario"></span></div>
      </header>
    `;
    // El contenido «de terceros» entra como TEXTO y como atributo, igual que lo
    // pintaría Angular con una interpolación: la prueba es que siga siéndolo.
    document.querySelector('.app-header__titulo')!.textContent = HOSTIL;
    document.querySelector('.app-header__usuario')!.textContent = HOSTIL;
    if (idDelNav !== null) document.querySelector('nav')!.id = idDelNav;
  }

  /** El marcado del ícono: sólo `svg`, `path` y `circle`, sin manejadores. */
  function esIconoInerte(boton: Element): void {
    const etiquetas = Array.from(boton.querySelectorAll('*')).map((el) => el.tagName.toLowerCase());
    expect(etiquetas.length).toBeGreaterThan(1);
    expect(etiquetas.every((t) => ['svg', 'path', 'circle'].includes(t))).toBe(true);
    for (const el of Array.from(boton.querySelectorAll('*'))) {
      expect(Array.from(el.attributes).some((a) => /^on/i.test(a.name))).toBe(false);
    }
    expect(boton.textContent).toBe('');
  }

  beforeAll(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    servicio = TestBed.inject(AlovidaRuntimeService);
    servicio.instalar();
  });

  beforeEach(() => {
    limpiarMarca();
    window.matchMedia = ((consulta: string) => ({
      matches: false,
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 30));
    // Un manejador que corre en una tarea posterior (p. ej. `ontoggle`) también cuenta.
    expect(document.documentElement.hasAttribute(MARCA)).toBe(false);
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('alovida-runtime.service.ts:1132 — el botón del cajón lleva sólo su ícono constante', () => {
    montarMarco(null);
    servicio.refrescar();

    const boton = document.querySelector('.app-nav-toggle');
    expect(boton).not.toBeNull();
    esIconoInerte(boton!);
    // El texto hostil de la página no se convirtió en marcado en ningún lado.
    expect(document.querySelector('img, script, [onload], [onerror]')).toBeNull();
    expect(document.querySelector('.app-header__titulo')!.textContent).toBe(HOSTIL);
    expect(ejecutado()).toBe(false);
  });

  it('alovida-runtime.service.ts:1132 — un id de nav hostil viaja como atributo, no como marcado', () => {
    const id = 'x" onfocus="document.documentElement.dataset.xss=1" autofocus="';
    montarMarco(id);
    servicio.refrescar();

    const boton = document.querySelector('.app-nav-toggle')!;
    expect(boton.getAttribute('aria-controls')).toBe(id);
    expect(boton.hasAttribute('onfocus')).toBe(false);
    expect(boton.hasAttribute('autofocus')).toBe(false);
    esIconoInerte(boton);
  });

  it('alovida-runtime.service.ts:1347 — la lupa del buscador lleva sólo su ícono constante', () => {
    montarMarco(null);
    servicio.refrescar();

    const lupa = document.querySelector('.app-buscar-toggle');
    expect(lupa).not.toBeNull();
    esIconoInerte(lupa!);
    expect(document.querySelector('.app-header__usuario')!.textContent).toBe(HOSTIL);
    expect(document.querySelector('img, script')).toBeNull();
    expect(ejecutado()).toBe(false);
  });
});

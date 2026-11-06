import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { RichTextEditor } from './rich-text-editor';
import { ETIQUETAS_DE_ARTICULO } from './rich-text-editor.types';

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
 * M-4 / O3-5 — HTML dinámico: el editor de la historia clínica es el único
 * punto del front que escribe y lee `innerHTML` con texto de terceros
 * (`rich-text-editor.ts:509`, `:545` y `:599`). Cada carga hostil entra por las
 * tres puertas reales —lo tecleado o pegado (`recoger`), lo que se vuelca al
 * montar o con `load()` (`volcar`) y la serialización del saneado (`sanear`)— y
 * se exige lo mismo: ningún elemento ejecutable, ningún manejador `on*`, ningún
 * esquema `javascript:`/`data:` en un enlace, y nada que se ejecute.
 */

const CARGAS: readonly string[] = [
  '<img src=x onerror=document.documentElement.dataset.xss=1>',
  '<script>document.documentElement.dataset.xss=1</script>',
  '<svg onload=document.documentElement.dataset.xss=1><circle r="1"/></svg>',
  '<svg><script>document.documentElement.dataset.xss=1</script></svg>',
  '<a href="javascript:document.documentElement.dataset.xss=1">clic</a>',
  '<a href="  JaVaScRiPt:document.documentElement.dataset.xss=1">clic</a>',
  '<a href="data:text/html,<script>document.documentElement.dataset.xss=1</script>">clic</a>',
  '<iframe src="javascript:document.documentElement.dataset.xss=1"></iframe>',
  '<object data="javascript:document.documentElement.dataset.xss=1"></object>',
  '<embed src="javascript:document.documentElement.dataset.xss=1">',
  '<p onclick="document.documentElement.dataset.xss=1" style="background:url(javascript:document.documentElement.dataset.xss=1)">texto</p>',
  '<details open ontoggle=document.documentElement.dataset.xss=1>x</details>',
  '<form action="javascript:document.documentElement.dataset.xss=1"><button formaction="javascript:document.documentElement.dataset.xss=1">x</button></form>',
  '<math><mtext><table><mglyph><style><img src=x onerror=document.documentElement.dataset.xss=1>',
  '<noscript><p title="</noscript><img src=x onerror=document.documentElement.dataset.xss=1>">',
  '<template><img src=x onerror=document.documentElement.dataset.xss=1></template>',
  '<img src="data:image/svg+xml,<svg onload=document.documentElement.dataset.xss=1>">',
  '<base href="javascript:document.documentElement.dataset.xss=1//">',
  '<meta http-equiv="refresh" content="0;url=javascript:document.documentElement.dataset.xss=1">',
];

const PELIGROSAS = 'script, iframe, object, embed, svg, math, style, form, base, meta, link, template, noscript';

/** Lo que haría ejecutable un fragmento de HTML, en palabras. Vacío = inerte. */
function ejecutableEn(html: string): string[] {
  const plantilla = document.createElement('template');
  plantilla.innerHTML = html;
  const problemas: string[] = [];
  for (const el of Array.from(plantilla.content.querySelectorAll('*'))) {
    if (el.matches(PELIGROSAS)) problemas.push(`<${el.tagName.toLowerCase()}>`);
    for (const atributo of Array.from(el.attributes)) {
      if (/^on/i.test(atributo.name)) problemas.push(`${atributo.name}=`);
      if (atributo.name === 'style') problemas.push('style=');
      if (/^\s*(javascript|vbscript|data):/i.test(atributo.value) && !/^data:image\/(png|jpeg|webp|gif);/.test(atributo.value)) {
        problemas.push(`${atributo.name}=${atributo.value}`);
      }
    }
  }
  return problemas;
}

describe('RichTextEditor · cargas hostiles (M-4)', () => {
  let fixture: ComponentFixture<RichTextEditor>;

  function area(): HTMLElement {
    return fixture.nativeElement.querySelector('[data-testid="editor-area"]') as HTMLElement;
  }

  async function montar(inicial = '', articulo = false): Promise<void> {
    fixture = TestBed.createComponent(RichTextEditor);
    if (articulo) fixture.componentRef.setInput('extraTags', ETIQUETAS_DE_ARTICULO);
    fixture.componentRef.setInput('html', inicial);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    limpiarMarca();
    await TestBed.configureTestingModule({ imports: [RichTextEditor] }).compileComponents();
  });

  afterEach(async () => {
    // Un manejador inline que corre en una tarea posterior (p. ej. `ontoggle`)
    // también cuenta: se lo deja correr antes de mirar la marca.
    await new Promise((r) => setTimeout(r, 30));
    expect(document.documentElement.hasAttribute(MARCA)).toBe(false);
  });

  /** Deja correr lo asincrónico (eventos `toggle`, `load`, `error`) antes de mirar. */
  const tarea = (): Promise<void> => new Promise((r) => setTimeout(r, 30));

  it('control positivo: el detector SÍ ve un manejador inline que corre', () => {
    // Sin esta prueba, un «no se ejecutó» podría ser un detector ciego.
    const vivo = document.createElement('div');
    document.body.appendChild(vivo);
    vivo.innerHTML = '<p onclick="document.documentElement.dataset.xss=1">x</p><img src="x" onerror="document.documentElement.dataset.xss=1">';
    expect(ejecutado()).toBe(true);
    vivo.remove();
    limpiarMarca();
  });

  describe('rich-text-editor.ts:509 — lo escrito o pegado en la hoja (recoger)', () => {
    it.each(CARGAS)('%s sale inerte', async (carga) => {
      await montar();
      area().innerHTML = `<p>antes</p>${carga}<p>después</p>`;
      area().dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const publicado = fixture.componentInstance.html();
      expect(ejecutableEn(publicado)).toEqual([]);
      expect(publicado).toContain('<p>antes</p>');
      // Con `<noscript>` mal cerrado el resto del documento queda DENTRO de él
      // y se descarta entero con su contenido: se pierde texto, no se ejecuta nada.
      if (!carga.startsWith('<noscript>')) expect(publicado).toContain('<p>después</p>');

      // La carga CRUDA la puso la prueba en la hoja (simula lo que trae el
      // navegador al editar): su propio `ontoggle` puede correr. Se la retira, se
      // deja pasar esa tarea y se borra la marca; lo que se juzga es lo PUBLICADO.
      area().innerHTML = '';
      await tarea();
      limpiarMarca();
      const pintado = document.createElement('div');
      document.body.appendChild(pintado);
      pintado.innerHTML = publicado;
      expect(ejecutado()).toBe(false);
      await tarea();
      pintado.remove();
    });

    it('lo que emite `edited` es lo saneado, no lo crudo', async () => {
      await montar();
      const emitidos: string[] = [];
      fixture.componentInstance.edited.subscribe((html) => emitidos.push(html));
      area().innerHTML = '<p onmouseover="document.documentElement.dataset.xss=1">nota</p><img src=x onerror=document.documentElement.dataset.xss=1>';
      area().dispatchEvent(new Event('input'));

      expect(emitidos).toEqual(['<p>nota</p>']);
    });
  });

  describe('rich-text-editor.ts:545 — lo que se vuelca en la hoja (volcar)', () => {
    it.each(CARGAS)('al montar con %s, el DOM de la hoja queda inerte', async (carga) => {
      await montar(`<p>nota</p>${carga}`);
      await tarea();

      expect(ejecutableEn(area().innerHTML)).toEqual([]);
      expect(area().querySelector(PELIGROSAS)).toBeNull();
      expect(area().textContent).toContain('nota');
      expect(ejecutado()).toBe(false);
    });

    it.each(CARGAS)('load() con %s (un borrador recuperado) deja hoja y modelo inertes', async (carga) => {
      await montar();
      fixture.componentInstance.load(`<h2>Borrador</h2>${carga}`);
      await tarea();

      expect(ejecutableEn(area().innerHTML)).toEqual([]);
      expect(ejecutableEn(fixture.componentInstance.html())).toEqual([]);
      expect(ejecutado()).toBe(false);
    });
  });

  describe('rich-text-editor.ts:599 — la serialización del saneado (sanear)', () => {
    it.each(CARGAS)('%s: volver a parsear lo saneado no lo cambia (sin mutación)', async (carga) => {
      // Un saneador que devuelve un HTML distinto al reparsearlo es la puerta
      // del mXSS: lo que se revisó no es lo que el navegador termina armando.
      await montar();
      fixture.componentInstance.load(carga);
      const primera = fixture.componentInstance.html();
      fixture.componentInstance.load(primera);

      expect(fixture.componentInstance.html()).toBe(primera);
      expect(ejecutableEn(primera)).toEqual([]);
    });

    it('con la barra de artículo, un enlace sólo conserva http(s) y ningún otro atributo', async () => {
      await montar('', true);
      fixture.componentInstance.load(
        '<p><a href="https://ok.example/x" target="_blank" onclick="document.documentElement.dataset.xss=1">bueno</a>' +
          '<a href="javascript:document.documentElement.dataset.xss=1">malo</a><a href="data:text/html,x">dato</a>' +
          '<a href="//evil.example">relativo</a></p>',
      );
      const publicado = fixture.componentInstance.html();

      expect(publicado).toBe('<p><a href="https://ok.example/x">bueno</a>malodatorelativo</p>');
      expect(ejecutableEn(publicado)).toEqual([]);
    });

    it('un `<script>` o `<style>` se va con su contenido: no queda código a la vista', async () => {
      await montar();
      fixture.componentInstance.load('<p>a</p><script>robar(document.cookie)</script><style>*{}</style><p>b</p>');

      expect(fixture.componentInstance.html()).toBe('<p>a</p><p>b</p>');
    });
  });
});

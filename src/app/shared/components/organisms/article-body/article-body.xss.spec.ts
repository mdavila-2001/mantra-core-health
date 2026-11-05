import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { ArticleBody } from './article-body';

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
 * M-4 / O3-5 — `article-body.ts:57` («Sin `innerHTML`»): el cuerpo de un
 * artículo lo escribe otra persona y se pinta nodo por nodo. Se comprueba con
 * cargas hostiles en cada construcción que admite el formato —párrafo, título,
 * lista, enlace e imagen— que nada se vuelve marcado activo y que un enlace
 * sólo puede ser `http(s)`.
 */

const CARGA = '<img src=x onerror=document.documentElement.dataset.xss=1><script>document.documentElement.dataset.xss=1</script><svg onload=document.documentElement.dataset.xss=1>';

describe('ArticleBody · cuerpo hostil (M-4)', () => {
  let fixture: ComponentFixture<ArticleBody>;
  let html: HTMLElement;

  function pintar(body: string, images: readonly (string | null)[] = []): void {
    fixture.componentRef.setInput('body', body);
    fixture.componentRef.setInput('images', images);
    fixture.detectChanges();
  }

  /** Abre todas las secciones, para que su contenido esté en el DOM. */
  function abrirTodo(): void {
    for (const boton of Array.from(html.querySelectorAll<HTMLButtonElement>('[aria-expanded="false"]'))) boton.click();
    fixture.detectChanges();
  }

  function sinActivos(): void {
    expect(html.querySelector('script, svg[onload], iframe, object, embed, img[onerror]')).toBeNull();
    for (const el of Array.from(html.querySelectorAll('*'))) {
      expect(el.getAttributeNames().some((a) => /^on/i.test(a))).toBe(false);
    }
    for (const a of Array.from(html.querySelectorAll('a'))) {
      expect(a.getAttribute('href')).toMatch(/^https?:\/\//);
    }
  }

  beforeEach(async () => {
    limpiarMarca();
    await TestBed.configureTestingModule({ imports: [ArticleBody] }).compileComponents();
    fixture = TestBed.createComponent(ArticleBody);
    html = fixture.nativeElement as HTMLElement;
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 30));
    // Un manejador que corre en una tarea posterior (p. ej. `ontoggle`) también cuenta.
    expect(document.documentElement.hasAttribute(MARCA)).toBe(false);
  });

  it('el marcado en introducción, títulos y listas sale como texto literal', () => {
    pintar([`Intro ${CARGA}`, `## Título ${CARGA}`, `- ítem ${CARGA}`, `1. paso ${CARGA}`, `**negrita ${CARGA}**`].join('\n'));
    abrirTodo();

    expect(html.textContent).toContain(CARGA);
    sinActivos();
    expect(ejecutado()).toBe(false);
  });

  it.each([
    '[premio](javascript:document.documentElement.dataset.xss=1)',
    '[premio](JaVaScRiPt:document.documentElement.dataset.xss=1)',
    '[premio](data:text/html,<script>document.documentElement.dataset.xss=1</script>)',
    '[premio](vbscript:msgbox(1))',
  ])('un enlace %s no se vuelve <a>', (enlace) => {
    pintar(`Mirá ${enlace} acá`);

    expect(html.querySelectorAll('a')).toHaveLength(0);
    sinActivos();
  });

  it('un enlace http(s) válido conserva su destino y abre aislado', () => {
    pintar('Mirá [la guía](https://ok.example/guia) acá');

    const a = html.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://ok.example/guia');
    expect(a?.getAttribute('rel')).toContain('noopener');
    sinActivos();
  });

  it('una imagen sólo se pinta desde images[N]; una URL hostil allí no queda ejecutable', () => {
    pintar(['## Sección', `![${CARGA}](imagen:0)`, '![x](javascript:document.documentElement.dataset.xss=1)'].join('\n'), ['javascript:document.documentElement.dataset.xss=1']);
    abrirTodo();

    const imagenes = Array.from(html.querySelectorAll('img'));
    // Angular marca la URL insegura (`unsafe:`) y el alt hostil es texto.
    for (const img of imagenes) {
      expect(img.getAttribute('src')).not.toMatch(/^javascript:/i);
      expect(img.getAttribute('alt')).toBe(CARGA);
    }
    expect(imagenes.length).toBeLessThanOrEqual(1);
    sinActivos();
  });
});

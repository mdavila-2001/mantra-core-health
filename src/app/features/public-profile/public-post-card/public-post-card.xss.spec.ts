import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { PublicPostSummary } from '@core/data-access/public-directory/public-directory.types';

import { PublicPostCard } from './public-post-card';

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
 * M-4 / O3-5 — `public-post-card.ts:302`: el cuerpo de una publicación pública
 * se parte en texto y enlaces «sin pasar por `innerHTML`». El cuerpo lo
 * escribe cualquier prestador y lo lee cualquiera sin sesión, así que se
 * comprueba con cargas hostiles que el marcado queda como texto y que ningún
 * enlace generado puede tener un esquema distinto de `https?:`.
 */

function unPost(bodyText: string): PublicPostSummary {
  return {
    id: 'post-1',
    bodyText,
    publishedAt: new Date('2026-08-14T12:00:00.000Z'),
    mediaUrls: [],
    reactionCount: 0,
    commentCount: 0,
  } as PublicPostSummary;
}

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class RutaVacia {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PublicPostCard],
  template: `<app-public-post-card [post]="post()" slug="dra-lopez" autorNombre="Dra. López" autorIniciales="DL" />`,
})
class HostComponent {
  readonly post = signal<PublicPostSummary>(unPost(''));
}

describe('PublicPostCard · cuerpo hostil (M-4)', () => {
  let fixture: ComponentFixture<HostComponent>;

  const cuerpo = (): HTMLElement => (fixture.nativeElement as HTMLElement).querySelector('.publicacion__cuerpo')!;

  async function pintar(texto: string): Promise<void> {
    fixture.componentInstance.post.set(unPost(texto));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    limpiarMarca();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([{ path: 'p/:slug', component: RutaVacia }])],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 30));
    // Un manejador que corre en una tarea posterior (p. ej. `ontoggle`) también cuenta.
    expect(document.documentElement.hasAttribute(MARCA)).toBe(false);
    fixture.destroy();
  });

  it.each([
    '<img src=x onerror=document.documentElement.dataset.xss=1>',
    '<script>document.documentElement.dataset.xss=1</script>',
    '<svg onload=document.documentElement.dataset.xss=1>',
    '<a href="javascript:document.documentElement.dataset.xss=1">premio</a>',
    '<iframe src="javascript:document.documentElement.dataset.xss=1"></iframe>',
  ])('«%s» en el cuerpo se pinta como texto literal', async (carga) => {
    await pintar(`Hola ${carga} chau`);

    expect(cuerpo()).not.toBeNull();
    expect(cuerpo().textContent).toContain(carga);
    expect(cuerpo().querySelector('img, script, svg, iframe')).toBeNull();
    expect(Array.from(cuerpo().querySelectorAll('a')).every((a) => /^https?:\/\//.test(a.getAttribute('href') ?? ''))).toBe(true);
    expect(ejecutado()).toBe(false);
  });

  it('un esquema peligroso escrito como texto no se vuelve enlace', async () => {
    await pintar('javascript:document.documentElement.dataset.xss=1 data:text/html,<script>document.documentElement.dataset.xss=1</script> vbscript:msgbox(1)');

    expect(cuerpo().querySelectorAll('a')).toHaveLength(0);
  });

  it('una URL con comillas y marcado pegados no rompe el atributo ni agrega otros', async () => {
    await pintar('mirá https://ok.example/"><img/src=x/onerror=document.documentElement.dataset.xss=1> y www.ok.example');

    const enlaces = Array.from(cuerpo().querySelectorAll('a'));
    expect(enlaces).toHaveLength(2);
    for (const enlace of enlaces) {
      expect(enlace.getAttribute('href')).toMatch(/^https:\/\//);
      // Los `_ngcontent-*` son de la encapsulación de estilos de Angular, no del dato.
      expect(enlace.getAttributeNames().filter((a) => !a.startsWith('_ng')).sort()).toEqual(['class', 'href', 'rel', 'target']);
      expect(enlace.getAttribute('rel')).toContain('noopener');
    }
    expect(enlaces[1]!.getAttribute('href')).toBe('https://www.ok.example');
    expect(cuerpo().querySelector('img')).toBeNull();
  });
});

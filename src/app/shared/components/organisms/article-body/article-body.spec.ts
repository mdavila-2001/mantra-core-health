import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { ArticleBody } from './article-body';

describe('ArticleBody', () => {
  let fixture: ComponentFixture<ArticleBody>;
  let html: HTMLElement;

  function pintar(body: string, images: readonly (string | null)[] = []): void {
    fixture.componentRef.setInput('body', body);
    fixture.componentRef.setInput('images', images);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ArticleBody] }).compileComponents();
    fixture = TestBed.createComponent(ArticleBody);
    html = fixture.nativeElement as HTMLElement;
  });

  const ARTICULO = [
    'Una introducción 🙂',
    '## Síntomas',
    '- fiebre',
    '- **tos seca**',
    '### Cuándo consultar',
    '1. si dura más de 3 días',
    '## Tratamiento',
    '![Esquema del tratamiento](imagen:0)',
  ].join('\n');

  it('deja la introducción a la vista y abre sólo la primera sección', () => {
    pintar(ARTICULO, ['blob:http://x/1']);
    expect(html.querySelector('.articulo__intro')?.textContent).toContain('Una introducción 🙂');

    const disparadores = Array.from(html.querySelectorAll<HTMLButtonElement>('[data-testid="article-section"] > h3 > button'));
    expect(disparadores.map((b) => b.textContent?.trim())).toEqual(['Síntomas', 'Tratamiento']);
    expect(disparadores.map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'false']);
  });

  it('respeta la jerarquía: títulos en h3 y subtítulos en h4 por omisión', () => {
    pintar(ARTICULO);
    expect(html.querySelector('[data-testid="article-subsection"] h4')?.textContent).toContain('Cuándo consultar');
  });

  it('una sección cerrada no tiene su contenido en el DOM, y se abre al tocar el título', () => {
    pintar(ARTICULO, ['blob:http://x/1']);
    expect(html.querySelector('img')).toBeNull();

    const tratamiento = html.querySelectorAll<HTMLButtonElement>('[data-testid="article-section"] > h3 > button')[1]!;
    tratamiento.click();
    fixture.detectChanges();
    const img = html.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('Esquema del tratamiento');
    expect(img?.getAttribute('src')).toBe('blob:http://x/1');
    // La primera sigue abierta: leer no es un formulario de una sección por vez.
    expect(html.querySelectorAll('[aria-expanded="true"]').length).toBe(2);
  });

  it('pinta listas y negrita como elementos, no como asteriscos', () => {
    pintar(ARTICULO);
    const lista = html.querySelector('ul');
    expect(lista?.querySelectorAll('li').length).toBe(2);
    expect(lista?.querySelector('strong')?.textContent).toBe('tos seca');
    expect(html.textContent).not.toContain('**');
  });

  it('el HTML del cuerpo sale como texto', () => {
    pintar('<img src=x onerror="robar()"> hola');
    expect(html.querySelector('img')).toBeNull();
    expect(html.textContent).toContain('<img src=x onerror="robar()">');
  });

  it('un post de texto plano se lee igual que siempre, sin secciones', () => {
    pintar('Hoy atiendo hasta las 18\nsaludos');
    expect(html.querySelector('app-accordion')).toBeNull();
    expect(html.querySelectorAll('br').length).toBe(1);
  });

  it('una imagen sin URL no deja un hueco; una que falla muestra su descripción', () => {
    pintar('![Sin url](imagen:3)\n\n![Rota](imagen:0)', ['https://ejemplo/rota.png']);
    expect(html.querySelectorAll('img').length).toBe(1);
    html.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(html.querySelector('.articulo__imagen-fallida')?.textContent).toContain('Rota');
  });

  it('los enlaces abren aparte y sin referer', () => {
    pintar('Guía: https://www.who.int/es');
    const a = html.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://www.who.int/es');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  const COMPLETO = [
    'Intro',
    '## Uno',
    'a',
    '### Uno.a',
    '#### Uno.a.i',
    'fondo',
    '## Dos',
    '> Primum non nocere',
    '---',
    'Esto ~~ya no~~ va. [Guía](https://who.int/guia)',
  ].join('\n');

  it('pinta tres niveles de encabezado anidados (h3 › h4 › h5 por omisión)', () => {
    pintar(COMPLETO);
    (html.querySelector('[data-testid="article-expand-all"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(html.querySelector('h4')?.textContent).toContain('Uno.a');
    expect(html.querySelector('h5')?.textContent).toContain('Uno.a.i');
    expect(html.querySelector('h5')?.closest('app-accordion-panel')?.getAttribute('data-depth')).toBe('2');
  });

  it('expandir todo y contraer todo', () => {
    pintar(COMPLETO);
    const botones = (): HTMLButtonElement[] => Array.from(html.querySelectorAll('button[aria-expanded]'));
    (html.querySelector('[data-testid="article-expand-all"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(botones().every((b) => b.getAttribute('aria-expanded') === 'true')).toBe(true);
    expect(botones()).toHaveLength(4);

    (html.querySelector('[data-testid="article-collapse-all"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(botones().every((b) => b.getAttribute('aria-expanded') === 'false')).toBe(true);
  });

  it('el índice abre la sección elegida con toda su cadena y le da el foco', async () => {
    pintar(COMPLETO);
    const indice = html.querySelector('[data-testid="article-toc"]')!;
    expect(Array.from(indice.querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual([
      'Uno', 'Uno.a', 'Uno.a.i', 'Dos',
    ]);
    (html.querySelector('[data-testid="article-collapse-all"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    (indice.querySelectorAll('button')[2] as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(html.textContent).toContain('fondo');
    expect(document.activeElement?.textContent).toContain('Uno.a.i');
  });

  it('muestra tiempo de lectura y pinta cita, separador, tachado y enlace con texto', () => {
    pintar(COMPLETO);
    expect(html.querySelector('.articulo__lectura')?.textContent).toContain('min de lectura');
    (html.querySelector('[data-testid="article-expand-all"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(html.querySelector('blockquote')?.textContent).toContain('Primum non nocere');
    expect(html.querySelector('hr')).not.toBeNull();
    expect(html.querySelector('s')?.textContent).toBe('ya no');
    const enlace = html.querySelector('a[href="https://who.int/guia"]');
    expect(enlace?.textContent).toBe('Guía');
  });

  it('un artículo de dos secciones no muestra índice (con tres, sí)', () => {
    pintar(ARTICULO);
    expect(html.querySelector('[data-testid="article-toc"]')).not.toBeNull();
    pintar('## A\nuno\n## B\ndos');
    expect(html.querySelector('[data-testid="article-toc"]')).toBeNull();
  });
});

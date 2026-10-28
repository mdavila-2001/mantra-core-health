import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ArticleComposer, ARTICLE_IMAGE_MAX_BYTES } from './article-composer';

describe('ArticleComposer', () => {
  let fixture: ComponentFixture<ArticleComposer>;
  let composer: ArticleComposer;
  let html: HTMLElement;
  let secuencia = 0;

  function escribir(contenido: string): void {
    const area = html.querySelector('[data-testid="editor-area"]') as HTMLElement;
    area.innerHTML = contenido;
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function elegir(...archivos: File[]): void {
    const campo = html.querySelector('[data-testid="article-image-input"]') as HTMLInputElement;
    Object.defineProperty(campo, 'files', { value: archivos, configurable: true });
    campo.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function imagen(nombre = 'foto.png', tipo = 'image/png', bytes = 10): File {
    return new File([new Uint8Array(bytes)], nombre, { type: tipo });
  }

  beforeEach(async () => {
    // jsdom no implementa `URL.createObjectURL`.
    URL.createObjectURL = () => `blob:http://test/${++secuencia}`;
    URL.revokeObjectURL = () => undefined;
    await TestBed.configureTestingModule({ imports: [ArticleComposer] }).compileComponents();
    fixture = TestBed.createComponent(ArticleComposer);
    composer = fixture.componentInstance;
    html = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('convierte lo escrito al formato del artículo', () => {
    escribir('<h2>Síntomas</h2><ul><li>fiebre</li></ul><p><strong>Ojo</strong> 🙂</p>');
    expect(composer.draft().bodyText).toBe('## Síntomas\n\n- fiebre\n\n**Ojo** 🙂');
    expect(composer.ready()).toBe(true);
  });

  it('no ofrece subrayado: el formato guardado no lo puede expresar', () => {
    expect(html.querySelector('[data-testid="herramienta-underline"]')).toBeNull();
    expect(html.querySelector('[data-testid="herramienta-h2"]')).not.toBeNull();
    expect(html.querySelector('[data-testid="herramienta-insertOrderedList"]')).not.toBeNull();
  });

  it('una imagen elegida entra al texto y al borrador, y exige descripción', () => {
    escribir('<p>Texto</p>');
    elegir(imagen());
    expect(html.querySelectorAll('[data-testid="article-image-item"]').length).toBe(1);
    expect(composer.draft().images).toHaveLength(1);
    expect(composer.draft().bodyText).toContain('![](imagen:0)');
    expect(composer.ready()).toBe(false);

    const alt = html.querySelector('[data-testid="article-image-alt-1"]') as HTMLInputElement;
    alt.value = 'Radiografía de tórax';
    alt.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(composer.draft().bodyText).toContain('![Radiografía de tórax](imagen:0)');
    expect(composer.draft().images[0]!.alt).toBe('Radiografía de tórax');
    expect(composer.ready()).toBe(true);
  });

  it('rechaza formatos y pesos que no corresponden, y dice por qué', () => {
    elegir(imagen('doc.pdf', 'application/pdf'), imagen('grande.jpg', 'image/jpeg', ARTICLE_IMAGE_MAX_BYTES + 1));
    expect(composer.draft().images).toHaveLength(0);
    const aviso = html.querySelector('[role="alert"]')?.textContent ?? '';
    expect(aviso).toContain('doc.pdf');
    expect(aviso).toContain('5 MB');
  });

  it('quitar una imagen la saca del texto y del borrador', () => {
    escribir('<p>Texto</p>');
    elegir(imagen('a.png'), imagen('b.png'));
    expect(composer.draft().images).toHaveLength(2);

    (html.querySelector('[aria-label="Quitar la imagen 1"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(composer.draft().images.map((i) => i.file.name)).toEqual(['b.png']);
    expect(composer.draft().bodyText).toContain('(imagen:0)');
    expect(composer.draft().bodyText).not.toContain('(imagen:1)');
  });

  it('una imagen borrada con el teclado tampoco se publica', () => {
    escribir('<p>Texto</p>');
    elegir(imagen());
    escribir('<p>Texto</p>'); // el DOM ya no tiene la imagen
    expect(composer.draft().images).toHaveLength(0);
  });

  it('el botón de emojis abre el panel y Escape lo cierra devolviendo el foco', () => {
    const boton = html.querySelector('[data-testid="article-emoji"]') as HTMLButtonElement;
    boton.click();
    fixture.detectChanges();
    const panel = html.querySelector('#article-emoji-panel') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(boton.getAttribute('aria-expanded')).toBe('true');

    const dentro = document.createElement('button');
    panel.appendChild(dentro);
    dentro.focus();
    dentro.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(html.querySelector('#article-emoji-panel')).toBeNull();
    expect(document.activeElement).toBe(boton);
  });

  it('Escape también cierra el panel con el foco en la hoja, sin sacarlo de ahí', () => {
    (html.querySelector('[data-testid="article-emoji"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const area = html.querySelector('[data-testid="editor-area"]') as HTMLElement;
    area.focus();
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(html.querySelector('#article-emoji-panel')).toBeNull();
    expect(document.activeElement).toBe(area);
  });

  it('reset() deja todo en blanco', () => {
    escribir('<p>Texto</p>');
    elegir(imagen());
    composer.reset();
    fixture.detectChanges();
    expect(composer.draft()).toEqual({ bodyText: '', images: [] });
  });

  it('avisa cuando el texto se pasa del tope', () => {
    fixture.componentRef.setInput('maxLength', 10);
    escribir('<p>un texto bastante más largo</p>');
    expect(composer.ready()).toBe(false);
    expect(html.querySelector('.compositor-articulo__contador--excedido')?.textContent).toContain('se pasó por');
  });

  it('ofrece la barra completa: historial, tachado, tres niveles de título, cita y separador', () => {
    for (const id of ['undo', 'redo', 'strikeThrough', 'h2', 'h3', 'h4', 'blockquote', 'insertHorizontalRule']) {
      expect(html.querySelector(`[data-testid="herramienta-${id}"]`)).not.toBeNull();
    }
  });

  it('Ctrl+K abre el enlace, valida la dirección e inserta el enlace con su texto', async () => {
    escribir('<p>Ver </p>');
    const area = html.querySelector('[data-testid="editor-area"]') as HTMLElement;
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(html.querySelector('#article-link-panel')).not.toBeNull();

    const url = html.querySelector('[data-testid="article-link-url"]') as HTMLInputElement;
    url.value = 'javascript:alert(1)';
    url.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (html.querySelector('[data-testid="article-link-insert"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(html.textContent).toContain('Escriba una dirección web');

    url.value = 'www.who.int/guia';
    url.dispatchEvent(new Event('input'));
    const texto = html.querySelector('[data-testid="article-link-text"]') as HTMLInputElement;
    texto.value = 'la guía';
    texto.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (html.querySelector('[data-testid="article-link-insert"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(html.querySelector('#article-link-panel')).toBeNull();
    expect(composer.draft().bodyText).toContain('[la guía](https://www.who.int/guia)');
  });

  it('la vista previa muestra el artículo como lo verá el lector, sin perder lo escrito', () => {
    escribir('<p>Intro</p><h2>Uno</h2><p>texto</p>');
    (html.querySelector('[data-testid="article-mode-preview"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const vista = html.querySelector('[data-testid="article-preview"]')!;
    expect(vista.querySelector('[data-testid="article-body"]')).not.toBeNull();
    expect(vista.textContent).toContain('Uno');

    (html.querySelector('[data-testid="article-mode-write"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(html.querySelector('[data-testid="article-preview"]')).toBeNull();
    expect(composer.draft().bodyText).toContain('## Uno');
  });

  it('cuenta palabras y minutos de lectura', () => {
    escribir('<p>una dos tres</p>');
    expect(html.querySelector('.compositor-articulo__contador')?.textContent).toContain('3 palabras');
    expect(html.querySelector('.compositor-articulo__contador')?.textContent).toContain('1 min de lectura');
  });

  describe('borrador en el navegador', () => {
    const CLAVE = 'articulo-borrador:prueba';

    afterEach(() => {
      localStorage.removeItem(CLAVE);
      vi.useRealTimers();
    });

    it('guarda lo escrito tras una pausa, sin imágenes', async () => {
      vi.useFakeTimers();
      fixture.componentRef.setInput('draftKey', CLAVE);
      escribir('<h2>Borrador</h2><p>hola<img src="blob:x" alt="" data-image-key="k"></p>');
      vi.advanceTimersByTime(1000);
      const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as { html?: string };
      expect(guardado.html).toContain('<h2>Borrador</h2>');
      expect(guardado.html).not.toContain('<img');
      fixture.detectChanges();
      expect(html.textContent).toContain('Borrador guardado a las');
    });

    it('ofrece recuperar un borrador guardado y lo carga al aceptar', async () => {
      localStorage.setItem(CLAVE, JSON.stringify({ html: '<h2>Recuperado</h2><p>texto</p>', savedAt: '2026-09-30T20:00:00.000Z' }));
      const otro = TestBed.createComponent(ArticleComposer);
      otro.componentRef.setInput('draftKey', CLAVE);
      otro.detectChanges();
      await otro.whenStable();
      otro.detectChanges();
      const raiz = otro.nativeElement as HTMLElement;
      expect(raiz.querySelector('[data-testid="article-draft-offer"]')).not.toBeNull();

      (raiz.querySelector('[data-testid="article-draft-restore"]') as HTMLButtonElement).click();
      otro.detectChanges();
      expect(raiz.querySelector('[data-testid="article-draft-offer"]')).toBeNull();
      expect(otro.componentInstance.draft().bodyText).toBe('## Recuperado\n\ntexto');
    });

    it('con la clave llegando tarde (la vitrina carga después), ofrece el borrador y no lo pisa', async () => {
      localStorage.setItem(CLAVE, JSON.stringify({ html: '<p>tarde</p>', savedAt: '2026-09-30T20:00:00.000Z' }));
      vi.useFakeTimers();
      const otro = TestBed.createComponent(ArticleComposer);
      otro.detectChanges(); // sin clave todavía
      await otro.whenStable();
      otro.componentRef.setInput('draftKey', CLAVE);
      otro.detectChanges();
      vi.advanceTimersByTime(2000);
      otro.detectChanges();
      expect((otro.nativeElement as HTMLElement).querySelector('[data-testid="article-draft-offer"]')).not.toBeNull();
      expect(localStorage.getItem(CLAVE)).toContain('tarde');
    });

    it('descartar borra el borrador guardado', async () => {
      localStorage.setItem(CLAVE, JSON.stringify({ html: '<p>viejo</p>', savedAt: '2026-09-30T20:00:00.000Z' }));
      const otro = TestBed.createComponent(ArticleComposer);
      otro.componentRef.setInput('draftKey', CLAVE);
      otro.detectChanges();
      await otro.whenStable();
      otro.detectChanges();
      (otro.nativeElement.querySelector('[data-testid="article-draft-discard"]') as HTMLButtonElement).click();
      otro.detectChanges();
      expect(localStorage.getItem(CLAVE)).toBeNull();
    });
  });
});

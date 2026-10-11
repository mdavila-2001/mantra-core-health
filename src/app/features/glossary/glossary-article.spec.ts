import { TestBed } from '@angular/core/testing';

import type { GlossaryArticle } from '../../core/data-access/terminology/glossary-article.types';
import { GlossaryArticleView } from './glossary-article';

const BASE = {
  lang: 'es' as const,
  source: 'nlm-medlineplus-es',
  sourceUrl: 'https://medlineplus.gov/spanish/tonsillitis.html',
  license: 'Dominio público (NLM)',
  retrievedAt: '2026-10-09',
  sourceVersion: '2021-08-16',
};

const IMG = {
  url: 'https://upload.wikimedia.org/a.jpg',
  thumbUrl: 'https://upload.wikimedia.org/thumb/a.jpg',
  kind: 'image' as const,
  caption: 'Amígdalas inflamadas',
  altText: 'Amígdalas inflamadas',
  altTextQuality: 'caption' as const,
  author: 'Autora Uno',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  sourcePage: 'https://commons.wikimedia.org/wiki/File:A.jpg',
  retrievedAt: '2026-10-09',
  match: 'name-match' as const,
  enabled: true,
};

const ARTICULO: GlossaryArticle = {
  conceptRef: { system: 'medlineplus-es', code: '6441', slug: 'medlineplus-es-6441' },
  lang: 'es',
  sections: [
    { ...BASE, kind: 'definition', text: 'Las amígdalas son dos masas de tejido.', locator: 'Introducción' },
    {
      ...BASE,
      kind: 'symptoms',
      text: 'Los síntomas incluyen:\n\n• Dolor de garganta\n\n• Fiebre',
      locator: '¿Cuáles son los síntomas de la amigdalitis?',
    },
    {
      ...BASE,
      kind: 'treatment_overview',
      text: 'Texto del tratamiento.',
      locator: 'Tratamiento',
      excerpt: true,
      omitted: [{ reason: 'dose-or-posology', paragraphs: 1 }],
    },
    { ...BASE, kind: 'risks', text: 'Riesgos in english.', lang: 'en', locator: 'Risks' },
  ],
  images: [
    IMG,
    { ...IMG, url: 'https://upload.wikimedia.org/b.jpg', altText: 'No debe verse', match: 'label-match', enabled: false },
  ],
  facts: [
    {
      label: 'Descriptor MeSH',
      value: 'D014069',
      source: 'nlm-medlineplus-es',
      sourceUrl: 'https://medlineplus.gov/tonsillitis.html',
    },
  ],
  references: [
    { title: 'Fuente: MedlinePlus — Amigdalitis', url: 'https://medlineplus.gov/spanish/tonsillitis.html', source: 'nlm-medlineplus-es' },
  ],
};

describe('GlossaryArticleView', () => {
  function montar(articulo: GlossaryArticle) {
    const fixture = TestBed.createComponent(GlossaryArticleView);
    fixture.componentRef.setInput('articulo', articulo);
    fixture.componentRef.setInput('termino', 'Amigdalitis');
    fixture.componentRef.setInput('sinonimos', ['Anginas']);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('dibuja una sección por cada una del artículo, con su título en castellano', () => {
    const el = montar(ARTICULO);
    const titulos = [...el.querySelectorAll('section h2')].map((h) => h.textContent?.trim());
    expect(titulos).toEqual(['Qué es', 'Síntomas', 'Tratamiento', 'Riesgos', 'Imágenes', 'Datos', 'Referencias']);
  });

  it('cada sección lleva su cita con fuente, licencia y fecha de consulta', () => {
    const el = montar(ARTICULO);
    const citas = [...el.querySelectorAll('[data-testid="articulo-cita"]')];
    expect(citas).toHaveLength(4);
    const primera = citas[0]!;
    expect(primera.textContent).toContain('MedlinePlus en español (NLM)');
    expect(primera.textContent).toContain('Dominio público (NLM)');
    expect(primera.textContent).toContain('consultado el 09/10/2026');
    expect(primera.querySelector('a')?.getAttribute('href')).toBe(BASE.sourceUrl);
  });

  it('la lista de viñetas es una lista, no un párrafo', () => {
    const el = montar(ARTICULO);
    expect([...el.querySelectorAll('.articulo__lista li')].map((l) => l.textContent?.trim())).toEqual([
      'Dolor de garganta',
      'Fiebre',
    ]);
  });

  it('marca el extracto con su motivo y el texto en inglés como sin traducción oficial', () => {
    const el = montar(ARTICULO);
    expect(el.textContent).toContain('Extracto');
    expect(el.textContent).toContain('dosis o posología');
    expect(el.textContent).toContain('sin traducción oficial');
  });

  it('la galería muestra autor, licencia con enlace y página de origen; oculta la label-match', () => {
    const el = montar(ARTICULO);
    const figuras = el.querySelectorAll('.articulo__figura');
    expect(figuras).toHaveLength(1);
    const img = figuras[0]!.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('Amígdalas inflamadas');
    const pie = figuras[0]!.querySelector('figcaption')!;
    expect(pie.textContent).toContain('Autora Uno');
    const enlaces = [...pie.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(enlaces).toEqual([IMG.licenseUrl, IMG.sourcePage]);
    expect(el.innerHTML).not.toContain('No debe verse');
  });

  it('la miniatura abre el modal con la imagen entera', () => {
    const fixture = TestBed.createComponent(GlossaryArticleView);
    fixture.componentRef.setInput('articulo', ARTICULO);
    fixture.componentRef.setInput('termino', 'Amigdalitis');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.articulo__miniatura')!.click();
    fixture.detectChanges();
    const grande = el.querySelector<HTMLImageElement>('.articulo__ampliada img');
    expect(grande?.getAttribute('src')).toBe(IMG.url);
    expect(grande?.getAttribute('alt')).toBe('Amígdalas inflamadas');
  });

  it('un artículo sin imágenes, datos ni referencias no dibuja esas secciones ni el índice de ellas', () => {
    const el = montar({ ...ARTICULO, images: [], facts: [], references: [] });
    const titulos = [...el.querySelectorAll('section h2')].map((h) => h.textContent?.trim());
    expect(titulos).toEqual(['Qué es', 'Síntomas', 'Tratamiento', 'Riesgos']);
    const indice = [...el.querySelectorAll('.articulo__indice-enlace')].map((b) => b.textContent?.trim());
    expect(indice).toEqual(['Qué es', 'Síntomas', 'Tratamiento', 'Riesgos']);
  });

  it('el índice tiene nombre accesible y una entrada por sección', () => {
    const el = montar(ARTICULO);
    expect(el.querySelector('nav')?.getAttribute('aria-label')).toBe('Índice del artículo');
    expect(el.querySelectorAll('.articulo__indice-enlace')).toHaveLength(7);
  });
});

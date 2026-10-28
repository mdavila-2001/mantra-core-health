import type {
  GlossaryArticle,
  GlossaryArticleImage,
  GlossaryArticleSection,
} from '../../core/data-access/terminology/glossary-article.types';
import {
  bloquesDeSeccion,
  bloquesDeTexto,
  enlaceSeguro,
  fechaLegible,
  fuentesDeLosDatos,
  imagenesVisibles,
  motivoDeExtracto,
  seccionesPintables,
  TITULO_DE_SECCION,
} from './glossary-article.logic';

function seccion(parcial: Partial<GlossaryArticleSection> = {}): GlossaryArticleSection {
  return {
    kind: 'definition',
    text: 'Texto de la fuente.',
    lang: 'es',
    source: 'nlm-medlineplus-es',
    sourceUrl: 'https://medlineplus.gov/spanish/x.html',
    license: 'Dominio público (NLM)',
    retrievedAt: '2026-10-09',
    sourceVersion: '2021-08-16',
    locator: 'Introducción',
    ...parcial,
  };
}

function imagen(parcial: Partial<GlossaryArticleImage> = {}): GlossaryArticleImage {
  return {
    url: 'https://upload.wikimedia.org/a.jpg',
    thumbUrl: 'https://upload.wikimedia.org/thumb/a.jpg',
    kind: 'image',
    caption: 'Pie',
    altText: 'Pie',
    altTextQuality: 'caption',
    author: 'Autor',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:A.jpg',
    retrievedAt: '2026-10-09',
    match: 'name-match',
    enabled: true,
    ...parcial,
  };
}

describe('glossary-article.logic', () => {
  it('imagenesVisibles descarta las label-match y las apagadas (D3 del 2026-10-09)', () => {
    const visibles = imagenesVisibles([
      imagen({ url: 'https://upload.wikimedia.org/1.jpg' }),
      imagen({ url: 'https://upload.wikimedia.org/2.jpg', match: 'label-match', enabled: true }),
      imagen({ url: 'https://upload.wikimedia.org/3.jpg', enabled: false }),
    ]);
    expect(visibles.map((i) => i.url)).toEqual(['https://upload.wikimedia.org/1.jpg']);
  });

  it('imagenesVisibles no pinta una URL que no es https', () => {
    expect(imagenesVisibles([imagen({ url: 'javascript:alert(1)' })])).toEqual([]);
    expect(imagenesVisibles([imagen({ thumbUrl: 'http://x/y.jpg' })])).toEqual([]);
    // Los enlaces de licencia y de origen van al `href`: tampoco pueden ser `javascript:`.
    expect(imagenesVisibles([imagen({ licenseUrl: 'javascript:alert(1)' })])).toEqual([]);
    expect(imagenesVisibles([imagen({ sourcePage: 'data:text/html,x' })])).toEqual([]);
  });

  describe('ilustraciones propias de AloVida', () => {
    const propia = (parcial: Partial<GlossaryArticleImage> = {}) =>
      imagen({
        url: '/glossary-images/hipertension-arterial.svg',
        thumbUrl: '/glossary-images/hipertension-arterial.svg',
        kind: 'diagram',
        author: 'Equipo AloVida',
        license: 'Ilustración original de AloVida',
        licenseUrl: '',
        sourcePage: '',
        ...parcial,
      });

    it('se pintan aunque no tengan enlace de licencia ni página de origen', () => {
      expect(imagenesVisibles([propia()])).toHaveLength(1);
    });

    it('no se pintan si la ruta sale de la carpeta propia o trae un protocolo', () => {
      for (const ruta of [
        '/otra-carpeta/x.svg',
        '/glossary-images/../secreto.svg',
        '/glossary-images/x.svg?a=1',
        '/glossary-images/Mayuscula.svg',
        '/glossary-images/x.html',
        '//evil.example/glossary-images/x.svg',
        'javascript:alert(1)',
        'data:image/svg+xml,<svg/>',
      ]) {
        expect(imagenesVisibles([propia({ url: ruta })])).toEqual([]);
        expect(imagenesVisibles([propia({ thumbUrl: ruta })])).toEqual([]);
      }
    });

    it('exigen autor y licencia declarados', () => {
      expect(imagenesVisibles([propia({ author: '' })])).toEqual([]);
      expect(imagenesVisibles([propia({ license: '  ' })])).toEqual([]);
    });

    it('una imagen apagada o label-match sigue descartada', () => {
      expect(imagenesVisibles([propia({ enabled: false })])).toEqual([]);
      expect(imagenesVisibles([propia({ match: 'label-match' })])).toEqual([]);
    });
  });

  describe('secciones de un artículo de autoría propia', () => {
    const articulo = (secciones: GlossaryArticleSection[]): GlossaryArticle => ({
      conceptRef: { system: 'alovida-curated', code: 'x', slug: 'x' },
      lang: 'es',
      sections: secciones,
      images: [],
      facts: [],
      references: [],
    });

    it('titulan cada sección con su encabezado y no repiten «En la fuente»', () => {
      const [uno, dos] = seccionesPintables(
        articulo([
          seccion({ source: 'alovida-curated', kind: 'additional_information', locator: 'Historia' }),
          seccion({ source: 'alovida-curated', kind: 'additional_information', locator: 'Fisiopatología' }),
        ]),
      );
      expect(uno?.titulo).toBe('Historia');
      expect(dos?.titulo).toBe('Fisiopatología');
      expect(uno?.encabezadoDeLaFuente).toBeNull();
      expect(uno?.entradaDelIndice).toBe('Historia');
    });

    it('sin encabezado caen al título del kind', () => {
      const [uno] = seccionesPintables(
        articulo([seccion({ source: 'alovida-curated', kind: 'causes', locator: '' })]),
      );
      expect(uno?.titulo).toBe(TITULO_DE_SECCION.causes);
    });

    it('una fuente externa conserva el título del kind y el encabezado de la fuente', () => {
      const [uno] = seccionesPintables(
        articulo([seccion({ kind: 'causes', locator: 'Qué provoca la tos' })]),
      );
      expect(uno?.titulo).toBe(TITULO_DE_SECCION.causes);
      expect(uno?.encabezadoDeLaFuente).toBe('Qué provoca la tos');
    });
  });

  it('enlaceSeguro sólo deja pasar https', () => {
    expect(enlaceSeguro('https://medlineplus.gov')).toBe('https://medlineplus.gov');
    expect(enlaceSeguro('data:text/html,x')).toBeNull();
  });

  it('el extracto dice cuántos párrafos y por qué, sin inventar un motivo', () => {
    expect(motivoDeExtracto(seccion())).toBeNull();
    const dosis = motivoDeExtracto(
      seccion({ excerpt: true, omitted: [{ reason: 'dose-or-posology', paragraphs: 1 }] }),
    );
    expect(dosis).toContain('Se omitió 1 párrafo');
    expect(dosis).toContain('dosis o posología');
    const otro = motivoDeExtracto(
      seccion({ excerpt: true, omitted: [{ reason: 'otro-motivo', paragraphs: 2 }] }),
    );
    expect(otro).toContain('Se omitieron 2 párrafos');
    expect(otro).toContain('«otro-motivo»');
  });

  it('bloquesDeTexto parte en párrafos, viñetas y filas de tabla sin cambiar las palabras', () => {
    const bloques = bloquesDeTexto(
      'Los síntomas incluyen:\n\n• Fiebre\n\n• Tos\n\nCondón | Funda delgada\nPíldora | Pastilla',
    );
    expect(bloques[0]).toEqual({ tipo: 'parrafo', texto: 'Los síntomas incluyen:' });
    expect(bloques[1]).toEqual({ tipo: 'lista', elementos: ['Fiebre'] });
    expect(bloques[2]).toEqual({ tipo: 'lista', elementos: ['Tos'] });
    expect(bloques[3]).toEqual({
      tipo: 'tabla',
      filas: [
        ['Condón', 'Funda delgada'],
        ['Píldora', 'Pastilla'],
      ],
    });
  });

  it('una sección sin texto (notas de clasificación del CDC) se pinta como la lista de sus items', () => {
    const notas = seccion({
      kind: 'classification',
      text: null,
      lang: 'en',
      items: ['Incluye: miscarriage', 'Excluye1: habitual aborter'],
    });
    expect(bloquesDeSeccion(notas)).toEqual([
      { tipo: 'lista', elementos: ['Incluye: miscarriage', 'Excluye1: habitual aborter'] },
    ]);

    const [pintable] = seccionesPintables({ sections: [notas] } as unknown as GlossaryArticle);
    expect(pintable?.bloques).toHaveLength(1);
    expect(pintable?.sinTraduccion).toBe(true);
  });

  it('una sección sin texto ni items no revienta y queda sin bloques', () => {
    expect(bloquesDeSeccion(seccion({ text: null }))).toEqual([]);
    expect(bloquesDeSeccion(seccion({ text: null, items: ['  ', ''] }))).toEqual([]);
  });

  it('con texto, bloquesDeSeccion no cambia el comportamiento de bloquesDeTexto', () => {
    const conTexto = seccion({ text: 'Un párrafo.', items: ['ignorado'] });
    expect(bloquesDeSeccion(conTexto)).toEqual(bloquesDeTexto('Un párrafo.'));
  });

  it('seccionesPintables: título por kind, encabezado de la fuente y desambiguación en el índice', () => {
    const articulo = {
      sections: [
        seccion({ kind: 'definition', locator: '¿Qué es la leucemia?' }),
        seccion({ kind: 'definition', locator: '¿Qué es la leucemia infantil?' }),
        seccion({ kind: 'causes', locator: 'Causas' }),
        seccion({ kind: 'risks', locator: 'Introducción', lang: 'en' }),
      ],
    } as unknown as GlossaryArticle;
    const [a, b, c, d] = seccionesPintables(articulo);
    expect(a?.titulo).toBe(TITULO_DE_SECCION.definition);
    expect(a?.entradaDelIndice).toBe('Qué es · ¿Qué es la leucemia?');
    expect(b?.entradaDelIndice).toBe('Qué es · ¿Qué es la leucemia infantil?');
    expect(c?.encabezadoDeLaFuente).toBeNull();
    expect(c?.entradaDelIndice).toBe('Causas');
    expect(d?.sinTraduccion).toBe(true);
    expect(d?.encabezadoDeLaFuente).toBeNull();
    expect(new Set([a, b, c, d].map((s) => s?.ancla)).size).toBe(4);
  });

  it('un artículo sin secciones no produce secciones: no se rellena nada', () => {
    expect(seccionesPintables({ sections: [] } as unknown as GlossaryArticle)).toEqual([]);
  });

  it('fechaLegible y fuentesDeLosDatos', () => {
    expect(fechaLegible('2026-10-09')).toBe('09/10/2026');
    expect(fechaLegible('hoy')).toBe('hoy');
    const fuentes = fuentesDeLosDatos([
      { label: 'a', value: '1', source: 'nlm-medlineplus-es', sourceUrl: 'https://x/1' },
      { label: 'b', value: '2', source: 'nlm-medlineplus-es', sourceUrl: 'https://x/1' },
      { label: 'c', value: '3', source: 'otra', sourceUrl: 'https://x/2' },
    ]);
    expect(fuentes).toEqual([
      { nombre: 'MedlinePlus en español (NLM)', urls: ['https://x/1'] },
      { nombre: 'otra', urls: ['https://x/2'] },
    ]);
  });

  it('fuentesDeLosDatos: varias páginas de la misma fuente dan un solo nombre', () => {
    const fuentes = fuentesDeLosDatos([
      { label: 'a', value: '1', source: 'nlm-medlineplus-es', sourceUrl: 'https://x/1' },
      { label: 'b', value: '2', source: 'nlm-medlineplus-es', sourceUrl: 'https://x/2' },
      { label: 'c', value: '3', source: 'nlm-medlineplus-es', sourceUrl: 'https://x/3' },
    ]);
    expect(fuentes).toEqual([
      { nombre: 'MedlinePlus en español (NLM)', urls: ['https://x/1', 'https://x/2', 'https://x/3'] },
    ]);
  });
});

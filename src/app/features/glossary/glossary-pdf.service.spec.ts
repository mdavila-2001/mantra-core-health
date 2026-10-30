import type { GlossaryArticle } from '../../core/data-access/terminology/glossary-article.types';
import type { GlossaryTermDetail } from '../../core/data-access/terminology/terminology.types';
import { glossaryPdfBlocks } from './glossary-pdf.service';

const term: GlossaryTermDetail = {
  conceptId: '11111111-1111-4111-8111-111111111111',
  code: 'I10',
  display: 'Hipertensión arterial',
  slug: 'hipertension-arterial',
  codeSystemVersionId: 'csv-1',
  valueSets: [],
  synonyms: [{ value: 'Presión alta' }],
  category: { valueSetId: 'vs-1', internalCode: 'glossary-category-disease', name: 'Enfermedades' },
  tags: [],
  relations: [],
  plainSummary: { text: 'Resumen para pacientes.', translated: true },
  clinicalDefinition: { text: 'Definición clínica.', translated: true },
  properties: { source_name: 'NLM', source_url: 'https://medlineplus.gov/spanish/' },
};

const article: GlossaryArticle = {
  conceptRef: { system: 'test', code: 'I10', slug: 'hipertension-arterial' },
  lang: 'es',
  sections: [
    {
      kind: 'definition',
      text: 'Primer párrafo.\n\nSegundo párrafo.',
      lang: 'es',
      source: 'nlm-medlineplus-es',
      sourceUrl: 'https://medlineplus.gov/spanish/highbloodpressure.html',
      license: 'Dominio público',
      retrievedAt: '2026-10-15',
      sourceVersion: '2026',
      locator: 'Definición',
    },
  ],
  images: [],
  facts: [{ label: 'Código', value: 'I10', source: 'NLM', sourceUrl: 'https://example.org/i10' }],
  references: [{ title: 'Guía', url: 'https://example.org/guia', source: 'NLM' }],
};

describe('glossaryPdfBlocks', () => {
  it('incluye todos los párrafos, la procedencia, las referencias y la imagen con su crédito', () => {
    const image = {
      dataUrl: 'data:image/png;base64,AA==',
      formato: 'PNG' as const,
      ancho: 100,
      alto: 80,
    };
    const blocks = glossaryPdfBlocks(term, article, [
      {
        image,
        caption: 'Esquema de arterias',
        credit: 'Autor · CC BY 4.0 · https://example.org/licencia',
        sourceUrl: 'https://example.org/imagen',
      },
    ]);
    const text = blocks.map((block) => block.text).join('\n');
    expect(text).toContain('Primer párrafo.\nSegundo párrafo.');
    expect(text).toContain('Definición clínica.');
    expect(text).toContain('Fuente del término: NLM · https://medlineplus.gov/spanish/');
    expect(text).toContain('https://medlineplus.gov/spanish/highbloodpressure.html');
    expect(text).toContain('https://example.org/guia');
    expect(text).toContain('Autor · CC BY 4.0');
    expect(blocks.find((block) => block.kind === 'image')?.image).toBe(image);
  });

  it('si una imagen no se pudo descargar, el PDF lo dice y conserva su crédito y su origen', () => {
    const blocks = glossaryPdfBlocks(term, article, [
      {
        image: null,
        caption: 'Esquema de arterias',
        credit: 'Autor · CC BY 4.0',
        sourceUrl: 'https://example.org/imagen',
      },
    ]);
    const text = blocks.map((block) => block.text).join('\n');
    expect(blocks.some((block) => block.kind === 'image')).toBe(false);
    expect(text).toContain('Esta imagen no se pudo incluir en el PDF');
    expect(text).toContain('Autor · CC BY 4.0 · página de origen: https://example.org/imagen');
  });

  it('exporta la definición de una ficha sin artículo y declara su fuente', () => {
    const text = glossaryPdfBlocks(term, null, [])
      .map((block) => block.text)
      .join('\n');
    expect(text).toContain('Definición clínica.');
    expect(text).toContain('Fuente del término: NLM · https://medlineplus.gov/spanish/');
  });
});

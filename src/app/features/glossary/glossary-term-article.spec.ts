import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { GlossaryTerm } from './glossary-term';

const ID = '11111111-1111-4111-8111-111111111111';

const FICHA = {
  conceptId: ID,
  code: 'medlineplus-es-6441',
  display: 'Amigdalitis',
  slug: 'medlineplus-es-6441',
  translated: true,
  codeSystemVersionId: 'csv-1',
  properties: {},
  valueSets: [],
  synonyms: [{ value: 'Anginas', language: 'ES', preferred: false }],
  category: { valueSetId: 'vs-1', internalCode: 'glossary-category-disease', name: 'Enfermedades' },
  tags: [],
  clinicalDefinition: { text: 'Definición corta de la ficha.', translated: true },
  plainSummary: { text: 'Resumen.', translated: true },
  relations: [],
};

const ARTICULO = {
  conceptRef: { system: 'medlineplus-es', code: '6441', slug: 'medlineplus-es-6441' },
  lang: 'es',
  sections: [
    {
      kind: 'definition',
      text: 'Las amígdalas son dos masas de tejido.',
      lang: 'es',
      source: 'nlm-medlineplus-es',
      sourceUrl: 'https://medlineplus.gov/spanish/tonsillitis.html',
      license: 'Dominio público (NLM)',
      retrievedAt: '2026-10-09',
      sourceVersion: '2021-08-16',
      locator: 'Introducción',
    },
  ],
  images: [],
  facts: [],
  references: [],
};

describe('GlossaryTerm con artículo enciclopédico', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'glossary/:conceptId', component: GlossaryTerm }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/glossary/${ID}`, GlossaryTerm);
  });

  afterEach(() => http.verify());

  const html = () => harness.fixture.nativeElement as HTMLElement;
  const rotulos = () => [...html().querySelectorAll('[role="tab"]')].map((b) => b.textContent?.trim());
  const articulo = () => http.expectOne((r) => r.url.endsWith(`/concepts/${ID}/article`));
  const ficha = () =>
    http.expectOne((r) => r.url.endsWith(`/concepts/${ID}`) && !r.url.endsWith('/article'));

  it('con artículo, la pestaña «Artículo» reemplaza a «Definición»', async () => {
    articulo().flush(ARTICULO);
    ficha().flush(FICHA);
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();

    expect(rotulos()).toContain('Artículo');
    expect(rotulos()).not.toContain('Definición');
    expect(html().querySelector('[data-testid="articulo-enciclopedico"]')).not.toBeNull();
    expect(html().textContent).toContain('Las amígdalas son dos masas de tejido.');
    expect(html().textContent).toContain('Anginas');
  });

  it('sin artículo (404), la ficha de siempre queda intacta', async () => {
    articulo().flush(null, { status: 404, statusText: 'Not Found' });
    ficha().flush(FICHA);
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();

    expect(rotulos()).toContain('Definición');
    expect(rotulos()).not.toContain('Artículo');
    expect(html().textContent).toContain('Definición corta de la ficha.');
  });

  it('si falla la lectura del artículo, la ficha se muestra igual', async () => {
    articulo().flush(null, { status: 500, statusText: 'Server Error' });
    ficha().flush(FICHA);
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();

    expect(rotulos()).toContain('Definición');
    expect(html().querySelector('[data-testid="articulo-enciclopedico"]')).toBeNull();
  });
});

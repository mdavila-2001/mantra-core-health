import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { GlossaryTerm } from './glossary-term';

/**
 * La ficha de un término, reconstruida: definición clínica, explicación en
 * lenguaje llano, categoría y etiquetas por separado, y relaciones clínicas
 * tipadas agrupadas por tipo.
 *
 * Se monta con el router porque el término viene en la ruta: sin él, el
 * `paramMap` no emite y la pantalla no sabría qué leer.
 */
const FICHA = {
  conceptId: '11111111-1111-4111-8111-111111111111',
  code: 'I10',
  display: 'Hipertensión esencial',
  slug: 'hipertension-esencial',
  translated: true,
  codeSystemVersionId: 'csv-1',
  valueSets: [{ id: 'vs-1', internalCode: 'glossary-category-disease', name: 'Enfermedades' }],
  synonyms: [{ value: 'Hypertensive disorder', language: 'EN', preferred: true }],
  category: { valueSetId: 'vs-1', internalCode: 'glossary-category-disease', name: 'Enfermedades' },
  tags: [
    { valueSetId: 'vs-t1', internalCode: 'glossary-tag-cardiovascular', name: 'Cardiovascular' },
    { valueSetId: 'vs-t2', internalCode: 'glossary-tag-chronic', name: 'Crónico' },
  ],
  clinicalDefinition: {
    text: 'Presión arterial persistentemente alta sin una causa identificable detrás.',
    translated: true,
  },
  plainSummary: {
    text: 'La presión de la sangre está más alta de lo normal, casi siempre sin síntomas.',
    translated: true,
  },
  relations: [
    {
      type: 'DISEASE',
      conceptId: 'c-2',
      slug: 'insuficiencia-cardiaca',
      display: 'Insuficiencia cardíaca',
    },
    {
      type: 'RELATED_TERM',
      conceptId: 'c-3',
      slug: 'presion-arterial',
      display: 'Presión arterial',
    },
  ],
};

describe('GlossaryTerm', () => {
  let harness: RouterTestingHarness;
  let componente: GlossaryTerm;
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
    componente = await harness.navigateByUrl(`/glossary/${FICHA.conceptId}`, GlossaryTerm);
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function html(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  function peticion() {
    return http.expectOne((r) => r.url.includes('/terminology/concepts/'));
  }

  it('lee el término de la ruta, en castellano y de una sola llamada', () => {
    const req = peticion();

    expect(req.request.url).toContain(FICHA.conceptId);
    expect(req.request.params.get('lang')).toBe('ES');
    req.flush(FICHA);

    // Una sola: `$lookup` habría exigido resolver antes la versión y el sistema
    // de codificación, que el cliente no tiene.
    http.verify();
    expect(interno<() => { display: string } | null>('ficha')()?.display).toBe(
      'Hipertensión esencial',
    );
  });

  it('el encabezado dice el término, nunca su identificador', () => {
    expect(interno<() => string>('titulo')()).toBe('Término');

    peticion().flush(FICHA);

    expect(interno<() => string>('titulo')()).toBe('Hipertensión esencial');
  });

  it('trae la categoría, las etiquetas y las otras denominaciones del término', () => {
    peticion().flush(FICHA);

    const ficha = interno<
      () => {
        category: { name: string } | null;
        tags: readonly { name: string }[];
        synonyms: readonly { value: string }[];
      } | null
    >('ficha')();
    expect(ficha?.category?.name).toBe('Enfermedades');
    expect(ficha?.tags.map((t) => t.name)).toEqual(['Cardiovascular', 'Crónico']);
    // El nombre original sirve para buscar el término en la literatura, así que
    // se muestra en vez de esconderse por estar en inglés.
    expect(ficha?.synonyms.map((s) => s.value)).toEqual(['Hypertensive disorder']);
  });

  it('un término sin traducción se muestra igual, y se nota que falta', () => {
    peticion().flush({ ...FICHA, display: 'Mild', translated: false });

    const ficha = interno<() => { display: string; translated?: boolean } | null>('ficha')();
    expect(ficha?.display).toBe('Mild');
    expect(ficha?.translated).toBe(false);
  });

  it('muestra el código externo, que es con el que se busca el término afuera', () => {
    peticion().flush(FICHA);

    expect(interno<() => string | null>('codigoPublicable')()).toBe('I10');
  });

  it('no muestra la clave interna del catálogo: es configuración, como el uuid', () => {
    // Los conceptos que siembra la plataforma guardan como código su clave de
    // módulo (`clinical:CONDITION_SEVERITY_SEVERE`), porque `catalog_concepts`
    // exige unicidad por versión. Eso no le sirve a nadie en consulta.
    peticion().flush({ ...FICHA, code: 'clinical:CONDITION_SEVERITY_SEVERE' });

    expect(interno<() => string | null>('codigoPublicable')()).toBeNull();
  });

  it('un término inexistente se traduce a S6, no a una excepción', () => {
    peticion().flush(
      { code: 'NOT_FOUND', message: 'Concepto no encontrado' },
      { status: 404, statusText: 'Not Found' },
    );

    expect(interno<() => { status: string }>('termino')().status).toBe('not-found');
  });

  it('un fallo de red se traduce a S8', () => {
    peticion().error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(interno<() => { status: string }>('termino')().status).toBe('offline');
  });

  // --- Definición clínica y explicación en lenguaje llano -------------------

  it('muestra la definición clínica y el resumen en lenguaje llano por separado', async () => {
    peticion().flush(FICHA);
    await harness.fixture.whenStable();

    expect(html().textContent).toContain(FICHA.clinicalDefinition.text);
    expect(html().textContent).toContain(FICHA.plainSummary.text);
  });

  it('una definición clínica sin traducir lo dice, sin confundirse con el nombre traducido', async () => {
    peticion().flush({
      ...FICHA,
      // El nombre sí está traducido: son dos banderas independientes.
      translated: true,
      clinicalDefinition: { text: 'Persistently high blood pressure.', translated: false },
    });
    await harness.fixture.whenStable();

    const aviso = html().querySelectorAll('.termino__sin-traducir-parcial');
    expect(aviso.length).toBe(1);
    expect(html().querySelector('.termino__sin-traducir')).toBeNull();
  });

  // --- Relaciones clínicas tipadas -------------------------------------------

  it('agrupa las relaciones por tipo, en orden clínico, y omite los grupos vacíos', () => {
    peticion().flush(FICHA);

    const grupos = interno<() => readonly { label: string; relaciones: readonly unknown[] }[]>(
      'gruposDeRelaciones',
    )();

    // FICHA sólo trae DISEASE y RELATED_TERM: PROCEDURE, TREATMENT, ANATOMY y
    // DIAGNOSTIC_TEST no deben aparecer con un encabezado vacío.
    expect(grupos.map((g) => g.label)).toEqual([
      'Enfermedades relacionadas',
      'También se relaciona con',
    ]);
    expect(grupos[0].relaciones.length).toBe(1);
  });

  it('cada relación enlaza a la ficha del término relacionado por su conceptId', async () => {
    peticion().flush(FICHA);
    await harness.fixture.whenStable();

    const enlaces = [...html().querySelectorAll('.termino__relaciones a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(enlaces).toContain('/glossary/c-2');
    expect(enlaces).toContain('/glossary/c-3');
  });

  it('sin relaciones, no dibuja ningún grupo', async () => {
    peticion().flush({ ...FICHA, relations: [] });
    await harness.fixture.whenStable();

    expect(interno<() => readonly unknown[]>('gruposDeRelaciones')().length).toBe(0);
    expect(html().querySelector('.termino__relaciones')).toBeNull();
  });

  // --- Imagen: hoy siempre ausente, mostrada defensivamente si existiera -----

  it('sin imagen, usa el ícono de la categoría como marcador visual', async () => {
    peticion().flush(FICHA);
    await harness.fixture.whenStable();

    expect(html().querySelector('.termino__imagen-marcador app-glossary-category-icon')).not.toBeNull();
    expect(html().querySelector('.termino__imagen img')).toBeNull();
  });

  it('con imagen, la muestra con su fuente, licencia y alt — nunca sin atribución', async () => {
    peticion().flush({
      ...FICHA,
      image: {
        source: 'https://ejemplo.org/hipertension.png',
        license: 'CC BY 4.0',
        attribution: 'Atlas Anatómico Nacional',
        alt: 'Diagrama de la presión arterial en una arteria',
        status: 'approved',
      },
    });
    await harness.fixture.whenStable();

    const img = html().querySelector<HTMLImageElement>('.termino__imagen img');
    expect(img?.getAttribute('alt')).toBe('Diagrama de la presión arterial en una arteria');
    expect(html().querySelector('.termino__imagen-atribucion')?.textContent).toContain(
      'Atlas Anatómico Nacional',
    );
    expect(html().querySelector('.termino__imagen-atribucion')?.textContent).toContain('CC BY 4.0');
    expect(html().querySelector('.termino__imagen-marcador')).toBeNull();
  });

  // --- Categoría navegable, etiquetas informativas ---------------------------

  it('la categoría enlaza de vuelta a la grilla filtrada por su código', async () => {
    peticion().flush(FICHA);
    await harness.fixture.whenStable();

    const enlace = html().querySelector('.termino__categoria');
    expect(enlace?.getAttribute('href')).toBe('/glossary?category=glossary-category-disease');
  });

  it('las etiquetas se muestran como chips informativos, no como enlaces', async () => {
    peticion().flush(FICHA);
    await harness.fixture.whenStable();

    const chips = html().querySelectorAll('.termino__chips app-chip');
    expect(chips.length).toBe(2);
    for (const chip of chips) {
      expect(chip.closest('a')).toBeNull();
    }
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { CHIPS_POR_TARJETA, Glossary, MAX_PAGINAS_EN_SELECT } from './glossary';

/**
 * El glosario, **con carga bajo demanda** (2026-09-30).
 *
 * La enciclopedia sigue siendo la misma —buscador y filtros arriba, rejilla de
 * categorías que es el mapa, cuerpo de definiciones agrupadas por inicial—,
 * pero ya no carga el corpus entero: con cientos de miles de términos eso deja
 * de existir. Lo que cambió, y por qué se prueba distinto:
 *
 * - **La rejilla sale de las facetas** (`$glossary-facets`), una consulta
 *   agregada: conteos y chips sin traer un término.
 * - **El cuerpo es una página del servidor**: `limit` y `offset` viajan, y el
 *   `total` que vuelve arma el paginador.
 * - **La etiqueta filtra en el servidor** (`tagValueSetId`), no sobre lo ya
 *   traído.
 * - **El abecedario que saltaba entre páginas se retiró**: saber en qué página
 *   empieza la «M» exige el corpus entero. Las iniciales siguen encabezando los
 *   tramos de la página.
 *
 * Lo que se conserva porque nunca fue lo objetado: el filtro publicado en la
 * URL, los vacíos que nombran qué se buscó, el cinturón contra el concepto
 * parcial, el aviso de términos sin traducir y la rejilla visible con un filtro
 * puesto.
 */
const RUTA = '/glossary';

const ETIQUETA_CARDIO = {
  id: 'vs-t1',
  internalCode: 'glossary-tag-cardiovascular',
  name: 'Cardiovascular',
  count: 40,
};
const ETIQUETA_CRONICO = {
  id: 'vs-t2',
  internalCode: 'glossary-tag-chronic',
  name: 'Crónico',
  count: 30,
};

const CATEGORIA = {
  id: 'vs-1',
  internalCode: 'glossary-category-disease',
  name: 'Enfermedades',
  description: 'Diagnósticos y condiciones clínicas.',
  count: 1200,
  tags: [ETIQUETA_CARDIO, ETIQUETA_CRONICO],
};

const FACETAS = {
  categories: [CATEGORIA],
  tags: [ETIQUETA_CARDIO, ETIQUETA_CRONICO],
  total: 1200,
};

const TERMINO = {
  conceptId: '11111111-1111-4111-8111-111111111111',
  code: 'I10',
  display: 'Hipertensión esencial',
  slug: 'hipertension-esencial',
  translated: true,
  valueSets: [{ id: 'vs-1', internalCode: 'glossary-category-disease', name: 'Enfermedades' }],
  category: { internalCode: 'glossary-category-disease', name: 'Enfermedades' },
  shortDefinition: 'Presión arterial persistentemente alta.',
  tags: ['Cardiovascular', 'Crónico'],
  relationsCount: 3,
  status: 'active',
};

const TERMINO_B = {
  ...TERMINO,
  conceptId: '33333333-3333-4333-8333-333333333333',
  code: 'R00.1',
  display: 'Bradicardia',
  slug: 'bradicardia',
  tags: ['Cardiovascular'],
};

describe('Glossary', () => {
  let harness: RouterTestingHarness;
  let componente: Glossary;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'glossary', component: Glossary }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(RUTA, Glossary);
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function html(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  function pedidoDeFacetas() {
    return http.expectOne((r) => r.url.endsWith('/terminology/value-sets/$glossary-facets'));
  }

  function pedidoDeTerminos() {
    return http.expectOne((r) => r.url.endsWith('/terminology/concepts'));
  }

  function responderFacetas(facetas: object = FACETAS) {
    pedidoDeFacetas().flush(facetas);
  }

  function responderPagina(items: unknown[] = [TERMINO], total = items.length, offset = 0) {
    pedidoDeTerminos().flush({ items, count: items.length, limit: 12, offset, total });
  }

  /** Las dos lecturas que salen al abrir la pantalla. */
  async function responderLanding(items: unknown[] = [TERMINO], total = items.length) {
    responderFacetas();
    responderPagina(items, total);
    await harness.fixture.whenStable();
  }

  async function irA(filtros: Record<string, string>): Promise<void> {
    const query = new URLSearchParams(filtros).toString();
    componente = await harness.navigateByUrl(query === '' ? RUTA : `${RUTA}?${query}`, Glossary);
    await harness.fixture.whenStable();
  }

  function estadoDelCuerpo() {
    return interno<() => { status: string; message?: string }>('cuerpo')();
  }

  function textos(selector: string): string[] {
    return [...html().querySelectorAll(selector)].map((n) => (n.textContent ?? '').trim());
  }

  // --- La landing ------------------------------------------------------------

  it('al abrir pide las facetas y UNA página: nunca el corpus entero', async () => {
    responderFacetas();
    const req = pedidoDeTerminos();
    expect(req.request.params.get('limit')).toBe('12');
    expect(req.request.params.get('offset')).toBe('0');
    expect(req.request.params.get('q')).toBeNull();
    expect(req.request.params.get('valueSetId')).toBeNull();
    expect(req.request.params.get('lang')).toBe('ES');
    expect(req.request.params.get('includeValueSets')).toBe('true');
    req.flush({ items: [TERMINO], count: 1, limit: 12, offset: 0, total: 1 });
    await harness.fixture.whenStable();

    expect(estadoDelCuerpo().status).toBe('ready');
  });

  it('la llegada de las facetas no vuelve a pedir la misma página', async () => {
    // Sin filtro, la página no depende de las facetas: pedirla de nuevo al
    // llegar sería el doble de tráfico en la pantalla que más se abre.
    responderPagina();
    responderFacetas();
    await harness.fixture.whenStable();
    http.expectNone((r) => r.url.endsWith('/terminology/concepts'));
  });

  it('la rejilla ofrece una tarjeta por categoría con el conteo real del servidor', async () => {
    await responderLanding();

    const tarjetas = html().querySelectorAll('.glosario__tarjeta');
    expect(tarjetas.length).toBe(1);
    expect(tarjetas[0].querySelector('app-glossary-category-icon')).not.toBeNull();
    expect(tarjetas[0].textContent).toContain('Enfermedades');
    expect(tarjetas[0].textContent).toContain((1200).toLocaleString('es'));
  });

  it('los chips de la tarjeta son las etiquetas de las facetas, las más frecuentes, y cuenta el resto', async () => {
    const muchas = Array.from({ length: CHIPS_POR_TARJETA + 2 }, (_, i) => ({
      id: `t-${i}`,
      internalCode: `glossary-tag-t${i}`,
      name: `Etiqueta ${i}`,
      count: 100 - i,
    }));
    responderFacetas({ ...FACETAS, categories: [{ ...CATEGORIA, tags: muchas }] });
    responderPagina();
    await harness.fixture.whenStable();

    const tarjeta = interno<() => readonly { etiquetas: readonly string[]; etiquetasDeMas: number }[]>(
      'tarjetas',
    )()[0];
    expect(tarjeta.etiquetas).toHaveLength(CHIPS_POR_TARJETA);
    expect(tarjeta.etiquetasDeMas).toBe(2);
    expect(html().querySelector('.glosario__chips-mas')?.textContent?.trim()).toBe('+2');
  });

  it('si no todos están en castellano, la tarjeta lo dice junto al total', async () => {
    responderFacetas({ ...FACETAS, categories: [{ ...CATEGORIA, translatedCount: 201 }] });
    responderPagina();
    await harness.fixture.whenStable();

    expect(html().querySelector('.glosario__dato')?.textContent).toContain('201 en castellano');
  });

  it('no ofrece una categoría vacía ni un conjunto que no sea del glosario', async () => {
    responderFacetas({
      ...FACETAS,
      categories: [
        CATEGORIA,
        { ...CATEGORIA, id: 'vs-2', internalCode: 'glossary-category-lab', count: 0 },
        { ...CATEGORIA, id: 'vs-9', internalCode: 'condition-code', count: 400 },
      ],
    });
    responderPagina();

    const tarjetas = interno<() => readonly { id: string }[]>('tarjetas')();
    expect(tarjetas.map((c) => c.id)).toEqual(['vs-1']);
  });

  it('con facetas pero sin categorías con términos, lo dice y no dibuja una rejilla en blanco', async () => {
    responderFacetas({ ...FACETAS, categories: [{ ...CATEGORIA, count: 0 }] });
    responderPagina();
    await harness.fixture.whenStable();

    expect(html().querySelectorAll('.glosario__tarjeta').length).toBe(0);
    expect(html().textContent).toContain('todavía no tiene categorías con términos');
  });

  // --- El cuerpo ---------------------------------------------------------------

  it('la página se agrupa por inicial, y los diacríticos no abren tramo propio', async () => {
    await responderLanding([TERMINO_B, TERMINO, { ...TERMINO, conceptId: 'c-o', display: 'Órgano' }]);

    expect(textos('.glosario__letra')).toEqual(['B', 'H', 'O']);
    expect(html().querySelectorAll('.glosario__entrada').length).toBe(3);
    expect(html().textContent).toContain('Presión arterial persistentemente alta.');
  });

  it('ya no hay abecedario que salte de página en página', async () => {
    await responderLanding([TERMINO, TERMINO_B]);
    expect(html().querySelector('.glosario__abecedario')).toBeNull();
  });

  it('la lista se desplaza sólo en vertical, en su propia caja (ADR-0015, regla 6)', async () => {
    await responderLanding();
    const lista = html().querySelector('#glosario-lista');
    expect(lista).not.toBeNull();
    expect(lista?.getAttribute('role')).toBe('region');
  });

  it('con miniatura, la tarjeta la muestra decorativa; el crédito vive en la ficha', async () => {
    await responderLanding([{ ...TERMINO, imageThumbnailUrl: 'https://ejemplo.org/t.jpg' }]);
    const foto = html().querySelector<HTMLImageElement>('.glosario__entrada-foto');
    expect(foto?.getAttribute('src')).toBe('https://ejemplo.org/t.jpg');
    expect(foto?.getAttribute('alt')).toBe('');
    expect(foto?.getAttribute('loading')).toBe('lazy');
  });

  // --- Paginación del servidor ------------------------------------------------

  it('el paginador sale del total del servidor, no de lo que vino en la página', async () => {
    await responderLanding([TERMINO, TERMINO_B], 1200);

    expect(html().querySelector('app-pagination')?.textContent).toContain('1–12 de 1200');
    expect(html().querySelector('[data-testid="glosario-conteo"]')?.textContent).toContain(
      (1200).toLocaleString('es'),
    );
  });

  it('cambiar de página pide el offset que corresponde', async () => {
    await responderLanding([TERMINO], 1200);

    interno<(p: number) => void>('irAPagina')(3);
    await harness.fixture.whenStable();

    const req = pedidoDeTerminos();
    expect(req.request.params.get('offset')).toBe('24');
    expect(req.request.params.get('limit')).toBe('12');
    req.flush({ items: [TERMINO_B], count: 1, limit: 12, offset: 24, total: 1200 });
  });

  it('con decenas de miles de páginas no ofrece el select «ir a la página»', async () => {
    await responderLanding([TERMINO], 12 * (MAX_PAGINAS_EN_SELECT + 1));
    expect(interno<() => boolean>('permiteSaltar')()).toBe(false);
  });

  it('un filtro nuevo vuelve a la primera página', async () => {
    await responderLanding([TERMINO], 1200);
    interno<(p: number) => void>('irAPagina')(3);
    await harness.fixture.whenStable();
    responderPagina([TERMINO], 1200, 24);

    await irA({ q: 'hiper' });
    const req = pedidoDeTerminos();
    expect(req.request.params.get('offset')).toBe('0');
    req.flush({ items: [TERMINO], count: 1, limit: 12, offset: 0, total: 1 });
    expect(interno<() => number>('pagina')()).toBe(1);
  });

  // --- Filtrar ---------------------------------------------------------------

  it('buscar manda el texto al servidor, que lo compara sin tildes', async () => {
    await responderLanding();

    await irA({ q: 'hipertensión' });

    const req = pedidoDeTerminos();
    expect(req.request.params.get('q')).toBe('hipertensión');
    req.flush({ items: [TERMINO], count: 1, limit: 12, offset: 0, total: 1 });
  });

  it('entrar a una categoría la publica en la URL y filtra por su uuid', async () => {
    await responderLanding();

    await irA({ category: 'glossary-category-disease' });

    const req = pedidoDeTerminos();
    expect(req.request.params.get('valueSetId')).toBe('vs-1');
    req.flush({ items: [TERMINO], count: 1, limit: 12, offset: 0, total: 1 });
    await harness.fixture.whenStable();

    expect(html().querySelector('#glosario-cuerpo-titulo')?.textContent).toContain('Enfermedades');
    expect(html().querySelector('.glosario__tarjeta--activa')).not.toBeNull();
  });

  it('con la categoría en la URL espera las facetas antes de pedir: no parpadea el glosario entero', async () => {
    // Recarga directa sobre un enlace compartido: la categoría llega por la URL
    // antes que su uuid.
    responderFacetas();
    responderPagina();
    await irA({ category: 'glossary-category-disease' });
    const req = pedidoDeTerminos();
    expect(req.request.params.get('valueSetId')).toBe('vs-1');
    req.flush({ items: [TERMINO], count: 1, limit: 12, offset: 0, total: 1 });
  });

  it('la etiqueta filtra en el servidor, intersectada con la categoría', async () => {
    await responderLanding();

    await irA({ category: 'glossary-category-disease', tag: 'glossary-tag-chronic' });

    const req = pedidoDeTerminos();
    expect(req.request.params.get('valueSetId')).toBe('vs-1');
    expect(req.request.params.get('tagValueSetId')).toBe('vs-t2');
    req.flush({ items: [TERMINO], count: 1, limit: 12, offset: 0, total: 1 });
  });

  it('con una categoría elegida, «Etiqueta» ofrece sólo las que aparecen en ella', async () => {
    responderFacetas({
      ...FACETAS,
      tags: [...FACETAS.tags, { id: 'vs-t9', internalCode: 'glossary-tag-otra', name: 'Otra', count: 5 }],
    });
    responderPagina();
    await irA({ category: 'glossary-category-disease' });
    responderPagina();

    const filtros = interno<() => readonly { key: string; options: readonly { value: string }[] }[]>(
      'filtros',
    )();
    const etiqueta = filtros.find((f) => f.key === 'tag')!;
    expect(etiqueta.options.map((o) => o.value)).toEqual([
      'glossary-tag-cardiovascular',
      'glossary-tag-chronic',
    ]);
  });

  it('la rejilla sigue visible con un filtro puesto: es el mapa', async () => {
    await responderLanding();
    await irA({ q: 'hiper' });
    responderPagina();
    await harness.fixture.whenStable();

    expect(html().querySelectorAll('.glosario__tarjeta').length).toBe(1);
  });

  it('un enlace con una categoría que no existe lo dice, y no pide nada', async () => {
    await responderLanding();
    await irA({ category: 'glossary-category-inventada' });

    expect(estadoDelCuerpo().status).toBe('empty');
    expect(estadoDelCuerpo().message).toContain('glossary-category-inventada');
  });

  it('si fallan las facetas y hay una categoría en la URL, muestra el fallo, no «no existe»', async () => {
    pedidoDeFacetas().flush(null, { status: 503, statusText: 'Service Unavailable' });
    responderPagina();
    await irA({ category: 'glossary-category-disease' });

    expect(estadoDelCuerpo().status).not.toBe('empty');
    expect(estadoDelCuerpo().status).not.toBe('ready');
  });

  it('si fallan las facetas, buscar por texto igual funciona', async () => {
    pedidoDeFacetas().flush(null, { status: 503, statusText: 'Service Unavailable' });
    responderPagina();
    await irA({ q: 'hiper' });

    responderPagina([TERMINO]);
    await harness.fixture.whenStable();
    expect(estadoDelCuerpo().status).toBe('ready');
  });

  it('«Ver todo el glosario» limpia categoría, etiqueta y texto', async () => {
    await responderLanding();
    await irA({ category: 'glossary-category-disease', tag: 'glossary-tag-chronic', q: 'x' });
    responderPagina();
    await harness.fixture.whenStable();

    interno<() => void>('verTodo')();
    await harness.fixture.whenStable();
    responderPagina();

    expect(interno<() => boolean>('hayAlgoPuesto')()).toBe(false);
  });

  // --- Vacíos, fallos y datos parciales ---------------------------------------

  it('con texto y sin resultados, el vacío nombra el texto que no encontró', async () => {
    await responderLanding();
    await irA({ q: 'zzz' });
    responderPagina([], 0);

    expect(estadoDelCuerpo().status).toBe('empty');
    expect(estadoDelCuerpo().message).toContain('«zzz»');
  });

  it('una categoría con etiqueta y sin términos lo dice con los dos nombres', async () => {
    await responderLanding();
    await irA({ category: 'glossary-category-disease', tag: 'glossary-tag-chronic' });
    responderPagina([], 0);

    expect(estadoDelCuerpo().message).toContain('Enfermedades');
    expect(estadoDelCuerpo().message).toContain('Crónico');
  });

  it('un glosario sin un solo término lo dice, y ofrece por dónde salir', async () => {
    responderFacetas();
    responderPagina([], 0);

    expect(estadoDelCuerpo().status).toBe('empty');
    expect(estadoDelCuerpo().message).toContain('todavía no tiene términos');
  });

  it('un fallo de red al leer la página se traduce a S8, no a una excepción', async () => {
    responderFacetas();
    pedidoDeTerminos().error(new ProgressEvent('error'));

    expect(estadoDelCuerpo().status).toBe('offline');
  });

  it('una API sin `total` se lee como «lo que vino es todo lo que hay»', async () => {
    responderFacetas();
    pedidoDeTerminos().flush({ items: [TERMINO, TERMINO_B], count: 2, limit: 12 });
    await harness.fixture.whenStable();

    expect(interno<() => number>('total')()).toBe(2);
  });

  it('cuenta los términos sin traducir de la página y no los disimula', async () => {
    await responderLanding([TERMINO, { ...TERMINO_B, translated: false }]);

    expect(interno<() => number>('sinTraduccion')()).toBe(1);
    expect(html().textContent).toContain('En esta página');
  });

  it('un término sin tags ni categoría no revienta el render (regresión del bug de búsqueda)', async () => {
    const parcial = { ...TERMINO, tags: undefined, category: undefined };
    await responderLanding([parcial]);

    expect(html().querySelectorAll('.glosario__entrada').length).toBe(1);
  });
});

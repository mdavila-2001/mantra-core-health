import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { Glossary } from './glossary';

/**
 * El glosario, reconstruido por tercera vez: diccionario por categorías en
 * grilla, y tabla al buscar o al entrar a una categoría.
 *
 * Lo que se fija acá es la instrucción nueva del cliente —landing en grilla
 * con conteo, tabla al escribir o al entrar a una categoría— más la mecánica
 * que ya venía bien y se conserva: el filtro en la URL, el aviso de recorte y
 * los vacíos distintos según qué se estaba mirando.
 *
 * Se monta con `RouterTestingHarness` y no con `TestBed.createComponent`
 * porque los filtros viven en la URL: sin un router de verdad, `buscar()`
 * navegaría al vacío y el efecto que recarga no se enteraría nunca.
 */
const RUTA = '/glossary';

const CATEGORIA = {
  id: 'vs-1',
  internalCode: 'glossary-category-disease',
  name: 'Enfermedades',
  description: 'Diagnósticos y condiciones clínicas.',
  defaultVersionId: 'ver-1',
  memberCount: 12,
};

/**
 * `listValueSets()` lee **todo** el catálogo de la plataforma, no sólo el
 * glosario. Este value set representa un enum cualquiera —género, estado
 * administrativo— que no debe aparecer en la grilla aunque tenga miembros.
 */
const VALUE_SET_AJENO_AL_GLOSARIO = {
  id: 'vs-9',
  internalCode: 'condition-code',
  name: 'Diagnóstico (catálogo de plataforma)',
  description: undefined,
  defaultVersionId: 'ver-9',
  memberCount: 400,
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

  /** La lectura de las categorías. Es la primera que sale, al construir. */
  function pedidoDeCategorias() {
    return http.expectOne((r) => r.url.endsWith('/terminology/value-sets'));
  }

  /** La lectura de los términos: sólo sale en modo tabla. */
  function pedidoDeTerminos() {
    return http.expectOne((r) => r.url.endsWith('/terminology/concepts'));
  }

  function responderCategorias(items: unknown[] = [CATEGORIA]) {
    pedidoDeCategorias().flush({
      items,
      count: items.length,
      limit: 200,
      nextCursor: null,
    });
  }

  function responderTerminos(items: unknown[] = [TERMINO], count = items.length) {
    pedidoDeTerminos().flush({ items, count, limit: 200 });
  }

  function estadoDeTerminos() {
    return interno<() => { status: string; message?: string }>('terminos')();
  }

  // --- La landing: grilla de categorías ------------------------------------

  it('al abrir pide las categorías y arma la grilla sin escribir nada', () => {
    responderCategorias();

    const categorias = interno<() => readonly { name: string }[]>('categoriasConTerminos')();
    expect(categorias.map((c) => c.name)).toEqual(['Enfermedades']);
  });

  it('en la landing no se pide el listado de términos: alcanza con el conteo de las categorías', () => {
    // El conteo de la grilla lo trae `listValueSets()`, así que entrar sin
    // filtro no debería disparar una segunda lectura del catálogo entero.
    // `http.verify()` del afterEach falla si queda algo pendiente además de
    // esto — y también fallaría si se disparó una petición de más sin
    // responderla.
    responderCategorias();
  });

  it('no ofrece una categoría vacía: sería un clic a una grilla en blanco', () => {
    responderCategorias([CATEGORIA, { ...CATEGORIA, id: 'vs-2', internalCode: 'glossary-category-lab', memberCount: 0 }]);

    const categorias = interno<() => readonly { id: string }[]>('categoriasConTerminos')();
    expect(categorias.map((c) => c.id)).toEqual(['vs-1']);
  });

  it('no ofrece un conjunto de valores que no es una categoría del glosario', () => {
    // `listValueSets()` lee el catálogo entero de la plataforma. Sin este
    // filtro, la grilla mostraría enums de sistema como si fueran medicina.
    responderCategorias([CATEGORIA, VALUE_SET_AJENO_AL_GLOSARIO]);

    const categorias = interno<() => readonly { internalCode: string }[]>('categoriasConTerminos')();
    expect(categorias.map((c) => c.internalCode)).toEqual(['glossary-category-disease']);
  });

  it('la grilla dibuja un ícono y el conteo de cada categoría', async () => {
    responderCategorias();
    await harness.fixture.whenStable();

    const tiles = html().querySelectorAll('.glosario__categoria');
    expect(tiles.length).toBe(1);
    expect(tiles[0].querySelector('app-glossary-category-icon')).not.toBeNull();
    expect(tiles[0].textContent).toContain('Enfermedades');
    expect(tiles[0].textContent).toContain('12');
  });

  it('con categorías pero todas vacías, la landing lo dice y no ofrece una grilla en blanco', async () => {
    // Distinto del caso «no hay categorías»: acá `listValueSets()` sí
    // respondió, sólo que ninguna tiene un término adentro todavía.
    responderCategorias([{ ...CATEGORIA, memberCount: 0 }]);
    await harness.fixture.whenStable();

    expect(html().querySelectorAll('.glosario__categoria').length).toBe(0);
    expect(html().textContent).toContain('todavía no tiene términos cargados');
  });

  // --- Cambiar a la tabla: por categoría o por texto -----------------------

  it('escribir una búsqueda cambia a modo tabla y pide los términos', async () => {
    responderCategorias();

    expect(interno<() => boolean>('mostrarTabla')()).toBe(false);

    interno<(texto: string) => void>('buscar')('hipertensión');
    await harness.fixture.whenStable();

    expect(interno<() => boolean>('mostrarTabla')()).toBe(true);

    const req = pedidoDeTerminos();
    expect(req.request.params.get('q')).toBe('hipertensión');
    expect(req.request.params.get('lang')).toBe('ES');
    expect(req.request.params.get('includeValueSets')).toBe('true');
    req.flush({ items: [TERMINO], count: 1, limit: 200 });
  });

  it('entrar a una categoría la publica en la URL y filtra por su uuid', async () => {
    responderCategorias();

    interno<(codigo: string) => void>('elegirCategoria')('glossary-category-disease');
    await harness.fixture.whenStable();

    const req = pedidoDeTerminos();
    // En la URL viaja el código —legible y compartible—; a la API va el uuid.
    expect(req.request.params.get('valueSetId')).toBe('vs-1');
    expect(TestBed.inject(Router).url).toContain('category=glossary-category-disease');
    req.flush({ items: [TERMINO], count: 1, limit: 200 });
  });

  it('el texto y la categoría conviven: elegir una no borra lo que se escribió', async () => {
    responderCategorias();

    interno<(texto: string) => void>('buscar')('hiper');
    await harness.fixture.whenStable();
    responderTerminos([]);

    interno<(codigo: string) => void>('elegirCategoria')('glossary-category-disease');
    await harness.fixture.whenStable();

    const req = pedidoDeTerminos();
    expect(req.request.params.get('q')).toBe('hiper');
    expect(req.request.params.get('valueSetId')).toBe('vs-1');
    req.flush({ items: [], count: 0, limit: 200 });
  });

  it('un enlace con una categoría que no existe lo dice, y no pide nada', async () => {
    responderCategorias();

    interno<(codigo: string) => void>('elegirCategoria')('inventada');
    await harness.fixture.whenStable();

    // No sale ninguna petición: sin uuid no hay nada que pedir.
    const actual = estadoDeTerminos();
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('inventada');
  });

  it('volver a la grilla limpia categoría y texto a la vez', async () => {
    responderCategorias();

    interno<(codigo: string) => void>('elegirCategoria')('glossary-category-disease');
    await harness.fixture.whenStable();
    responderTerminos();

    interno<() => void>('volverALaGrilla')();
    await harness.fixture.whenStable();

    expect(interno<() => boolean>('mostrarTabla')()).toBe(false);
    const url = TestBed.inject(Router).url;
    expect(url).not.toContain('category=');
    expect(url).not.toContain('q=');
  });

  it('la tabla reemplaza a la grilla en el DOM al buscar', async () => {
    responderCategorias();
    await harness.fixture.whenStable();
    expect(html().querySelector('.glosario__grilla')).not.toBeNull();

    interno<(texto: string) => void>('buscar')('hiper');
    await harness.fixture.whenStable();
    responderTerminos();
    await harness.fixture.whenStable();

    expect(html().querySelector('app-data-table')).not.toBeNull();
    expect(html().querySelector('.glosario__grilla')).toBeNull();
  });

  // --- Recorte y traducción, conservado de las rondas anteriores -----------

  it('avisa cuando el resultado vino recortado por el tope', async () => {
    responderCategorias();
    interno<(texto: string) => void>('buscar')('hiper');
    await harness.fixture.whenStable();
    responderTerminos([TERMINO], 200);

    expect(interno<() => boolean>('recortado')()).toBe(true);
  });

  it('no avisa de recorte cuando entraron todos', async () => {
    responderCategorias();
    interno<(texto: string) => void>('buscar')('hiper');
    await harness.fixture.whenStable();
    responderTerminos([TERMINO], 1);

    expect(interno<() => boolean>('recortado')()).toBe(false);
  });

  it('cuenta los términos sin traducir y no los disimula', async () => {
    responderCategorias();
    interno<(texto: string) => void>('buscar')('hiper');
    await harness.fixture.whenStable();
    responderTerminos([TERMINO, { ...TERMINO, conceptId: 'c-2', display: 'Mild', translated: false }]);

    expect(interno<() => number>('sinTraduccion')()).toBe(1);
  });

  // --- Vacíos, distintos según qué se estaba mirando ------------------------

  it('con texto y sin resultados, el vacío nombra el texto que no encontró', async () => {
    responderCategorias();
    interno<(texto: string) => void>('buscar')('inexistente');
    await harness.fixture.whenStable();
    responderTerminos([]);

    const actual = estadoDeTerminos();
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('inexistente');
  });

  it('una categoría sin términos lo dice por su nombre', async () => {
    responderCategorias();
    interno<(codigo: string) => void>('elegirCategoria')('glossary-category-disease');
    await harness.fixture.whenStable();
    responderTerminos([]);

    const actual = estadoDeTerminos();
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('Enfermedades');
  });

  // --- Errores ---------------------------------------------------------------

  it('un fallo de red al buscar se traduce a S8, no a una excepción', async () => {
    responderCategorias();
    interno<(texto: string) => void>('buscar')('hiper');
    await harness.fixture.whenStable();
    pedidoDeTerminos().error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(estadoDeTerminos().status).toBe('offline');
  });

  it('si fallan las categorías, buscar por texto igual funciona', async () => {
    pedidoDeCategorias().error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    // Las categorías son la puerta principal de la landing, pero no la única
    // forma de llegar a un término: quedarse sin ellas no puede impedir
    // buscar por texto.
    interno<(texto: string) => void>('buscar')('hiper');
    await harness.fixture.whenStable();
    responderTerminos();

    expect(estadoDeTerminos().status).toBe('ready');
    expect(interno<() => { status: string }>('categorias')().status).toBe('offline');
  });
});

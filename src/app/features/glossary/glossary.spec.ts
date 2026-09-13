import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { Glossary } from './glossary';

/**
 * El glosario, reconstruido por cuarta vez: **enciclopedia**.
 *
 * La ronda anterior lo dejaba en grilla de categorías y tabla al buscar. El
 * propietario volvió a corregir el rumbo y pidió una enciclopedia al estilo
 * Wikipedia: buscador arriba, una fila de categorías que es el mapa, y el
 * cuerpo con las definiciones legibles —todas, agrupadas por inicial, cuando
 * no hay filtro—. La instrucción nueva es más reciente y más específica, así
 * que manda, y este spec fija ese contrato.
 *
 * Lo que cambió respecto de la ronda anterior, y por qué se prueba distinto:
 *
 * - **La landing pide dos cosas, no una.** Sin filtro el cuerpo *son* todos
 *   los términos, así que la lectura del corpus no es un extra; además es la
 *   única forma de saber qué etiquetas lleva cada categoría de verdad.
 * - **No hay tabla.** Las celdas se fueron; se prueban las entradas del
 *   índice (`.glosario__entrada`) y los tramos por inicial.
 * - **Entrar a una categoría es un enlace**, no un método: viaja por la URL,
 *   así que acá se navega con el router y no se llama a nada del componente.
 *
 * Lo que se conserva de las rondas anteriores porque nunca fue lo objetado:
 * el filtro publicado en la URL, el aviso de recorte, los vacíos distintos
 * según qué se estaba mirando y el cinturón contra el concepto parcial.
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
 * administrativo— que no debe aparecer en la fila aunque tenga miembros.
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

/** Otro término de la misma categoría, con una etiqueta que el primero no tiene. */
const TERMINO_B = {
  ...TERMINO,
  conceptId: '33333333-3333-4333-8333-333333333333',
  code: 'I48',
  display: 'Bradicardia',
  slug: 'bradicardia',
  tags: ['Cardiovascular', 'Arritmia'],
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

  /** La lectura de las categorías. Sale al construir. */
  function pedidoDeCategorias() {
    return http.expectOne((r) => r.url.endsWith('/terminology/value-sets'));
  }

  /** La lectura de los términos: el corpus al construir, los filtrados después. */
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

  /** Las dos lecturas que salen al abrir la pantalla, en un solo gesto. */
  function responderLanding(categorias: unknown[] = [CATEGORIA], terminos: unknown[] = [TERMINO]) {
    responderCategorias(categorias);
    responderTerminos(terminos);
  }

  /** Navega publicando los filtros en la URL, que es como se entra de verdad. */
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

  // --- La landing: fila de categorías + cuerpo ------------------------------

  it('al abrir pide las categorías y el corpus: la enciclopedia se lee sin escribir nada', () => {
    // Las dos lecturas son deliberadas: sin filtro el cuerpo *son* todos los
    // términos, y sin ellos no se puede decir qué etiquetas lleva cada
    // categoría. `http.verify()` del afterEach falla si sale alguna de más.
    responderLanding();

    expect(interno<() => boolean>('hayFiltro')()).toBe(false);
    expect(estadoDelCuerpo().status).toBe('ready');
  });

  it('el corpus se pide sin filtros: es el catálogo entero, acotado sólo por el tope', () => {
    responderCategorias();

    const req = pedidoDeTerminos();
    expect(req.request.params.get('q')).toBeNull();
    expect(req.request.params.get('valueSetId')).toBeNull();
    expect(req.request.params.get('limit')).toBe('200');
    expect(req.request.params.get('lang')).toBe('ES');
    expect(req.request.params.get('includeValueSets')).toBe('true');
    req.flush({ items: [TERMINO], count: 1, limit: 200 });
  });

  it('la fila ofrece una tarjeta por categoría, con su ícono y su conteo', async () => {
    responderLanding();
    await harness.fixture.whenStable();

    const tarjetas = html().querySelectorAll('.glosario__tarjeta');
    expect(tarjetas.length).toBe(1);
    expect(tarjetas[0].querySelector('app-glossary-category-icon')).not.toBeNull();
    expect(tarjetas[0].textContent).toContain('Enfermedades');
    expect(tarjetas[0].textContent).toContain('12');
  });

  it('los chips de la tarjeta salen del corpus, no de una lista fija', async () => {
    // Es la diferencia con la ronda anterior: la tarjeta dice de qué habla la
    // categoría **antes** de entrar, y lo dice con las etiquetas que sus
    // términos llevan de verdad. Una lista declarada quedaría vieja en cuanto
    // el catálogo sume un término.
    responderLanding([CATEGORIA], [TERMINO, TERMINO_B]);
    await harness.fixture.whenStable();

    const tarjeta = interno<() => readonly { etiquetas: readonly string[] }[]>('tarjetas')()[0];
    expect([...tarjeta.etiquetas]).toEqual(['Arritmia', 'Cardiovascular', 'Crónico']);
  });

  it('no ofrece una categoría vacía: sería un clic a una pantalla en blanco', () => {
    responderLanding([
      CATEGORIA,
      { ...CATEGORIA, id: 'vs-2', internalCode: 'glossary-category-lab', memberCount: 0 },
    ]);

    const tarjetas = interno<() => readonly { id: string }[]>('tarjetas')();
    expect(tarjetas.map((c) => c.id)).toEqual(['vs-1']);
  });

  it('no ofrece un conjunto de valores que no es una categoría del glosario', () => {
    // `listValueSets()` lee el catálogo entero de la plataforma. Sin este
    // filtro, la fila mostraría enums de sistema como si fueran medicina.
    responderLanding([CATEGORIA, VALUE_SET_AJENO_AL_GLOSARIO]);

    const tarjetas = interno<() => readonly { internalCode: string }[]>('tarjetas')();
    expect(tarjetas.map((c) => c.internalCode)).toEqual(['glossary-category-disease']);
  });

  it('con categorías pero todas vacías, lo dice y no dibuja una fila en blanco', async () => {
    // Distinto del caso «no hay categorías»: acá `listValueSets()` sí
    // respondió, sólo que ninguna tiene un término adentro todavía.
    responderLanding([{ ...CATEGORIA, memberCount: 0 }]);
    await harness.fixture.whenStable();

    expect(html().querySelectorAll('.glosario__tarjeta').length).toBe(0);
    expect(html().textContent).toContain('todavía no tiene categorías con términos');
  });

  // --- El cuerpo: índice alfabético ----------------------------------------

  it('sin filtro el cuerpo son todas las definiciones, agrupadas por inicial', async () => {
    responderLanding([CATEGORIA], [TERMINO, TERMINO_B]);
    await harness.fixture.whenStable();

    expect(textos('.glosario__letra')).toEqual(['B', 'H']);
    expect(html().querySelectorAll('.glosario__entrada').length).toBe(2);
    expect(html().textContent).toContain('Presión arterial persistentemente alta.');
  });

  it('los diacríticos no abren un tramo propio: «Órgano» va bajo la O', async () => {
    responderLanding([CATEGORIA], [{ ...TERMINO, display: 'Órgano' }]);
    await harness.fixture.whenStable();

    expect(textos('.glosario__letra')).toEqual(['O']);
  });

  it('lo que no empieza con letra cae en «#», y «#» va al final', async () => {
    responderLanding([CATEGORIA], [
      { ...TERMINO, conceptId: 'c-num', display: '5-hidroxitriptamina' },
      TERMINO_B,
    ]);
    await harness.fixture.whenStable();

    expect(textos('.glosario__letra')).toEqual(['B', '#']);
  });

  it('con un solo tramo no se dibuja el abecedario: no tendría dónde saltar', async () => {
    responderLanding([CATEGORIA], [TERMINO]);
    await harness.fixture.whenStable();

    expect(html().querySelector('.glosario__abecedario')).toBeNull();
  });

  it('con varios tramos el abecedario ofrece cada inicial, y cada tramo tiene su ancla', async () => {
    responderLanding([CATEGORIA], [TERMINO, TERMINO_B]);
    await harness.fixture.whenStable();

    expect(textos('.glosario__abecedario button')).toEqual(['B', 'H']);
    expect(html().querySelector('#glosario-letra-B')).not.toBeNull();
    expect(html().querySelector('#glosario-letra-H')).not.toBeNull();
  });

  // --- Paginación ------------------------------------------------------------

  /** `n` términos distintos, uno por inicial en orden (A, B, C…, y vuelta a empezar). */
  function terminos(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      ...TERMINO,
      conceptId: `c-${String(i).padStart(3, '0')}`,
      display: `${String.fromCharCode(65 + (i % 26))}término ${String(i).padStart(3, '0')}`,
    }));
  }

  it('el cuerpo se pagina: con 30 términos la primera página muestra 12 y hay paginador', async () => {
    responderLanding([CATEGORIA], terminos(30));
    await harness.fixture.whenStable();

    expect(html().querySelectorAll('.glosario__entrada').length).toBe(12);
    expect(html().querySelector('app-pagination')).not.toBeNull();
    expect(html().querySelector('app-pagination')?.textContent).toContain('1–12 de 30');
  });

  it('ir a la última página muestra el resto, no una página llena de más', async () => {
    responderLanding([CATEGORIA], terminos(30));
    await harness.fixture.whenStable();

    interno<(p: number) => void>('irAPagina')(3);
    await harness.fixture.whenStable();

    expect(html().querySelectorAll('.glosario__entrada').length).toBe(6);
    expect(html().querySelector('app-pagination')?.textContent).toContain('25–30 de 30');
  });

  it('el abecedario lleva a la página donde empieza la letra, aunque no sea la actual', async () => {
    responderLanding([CATEGORIA], terminos(30));
    await harness.fixture.whenStable();

    // Uno por inicial: la «P» es el término 15, que cae en la página 2.
    expect(html().querySelector('#glosario-letra-P')).toBeNull();
    const botonP = [...html().querySelectorAll<HTMLButtonElement>('.glosario__abecedario button')]
      .find((b) => b.textContent?.trim() === 'P');
    botonP?.click();
    await harness.fixture.whenStable();

    expect(interno<() => number>('paginaActual')()).toBe(2);
    expect(html().querySelector('#glosario-letra-P')).not.toBeNull();
  });

  it('un filtro nuevo vuelve a la primera página', async () => {
    responderLanding([CATEGORIA], terminos(30));
    await harness.fixture.whenStable();
    interno<(p: number) => void>('irAPagina')(3);
    await harness.fixture.whenStable();

    await irA({ q: 'término' });
    responderTerminos(terminos(30));
    await harness.fixture.whenStable();

    expect(interno<() => number>('paginaActual')()).toBe(1);
    expect(html().querySelectorAll('.glosario__entrada').length).toBe(12);
  });

  // --- Filtrar: por texto o por categoría ----------------------------------

  it('escribir una búsqueda pide los términos filtrados y no vuelve a pedir el corpus', async () => {
    responderLanding();

    interno<(texto: string) => void>('buscar')('hipertensión');
    await harness.fixture.whenStable();

    expect(interno<() => boolean>('hayFiltro')()).toBe(true);

    const req = pedidoDeTerminos();
    expect(req.request.params.get('q')).toBe('hipertensión');
    expect(req.request.params.get('lang')).toBe('ES');
    expect(req.request.params.get('includeValueSets')).toBe('true');
    req.flush({ items: [TERMINO], count: 1, limit: 200 });
  });

  it('entrar a una categoría la publica en la URL y filtra por su uuid', async () => {
    responderLanding();

    await irA({ category: 'glossary-category-disease' });

    const req = pedidoDeTerminos();
    // En la URL viaja el código —legible y compartible—; a la API va el uuid.
    expect(req.request.params.get('valueSetId')).toBe('vs-1');
    expect(TestBed.inject(Router).url).toContain('category=glossary-category-disease');
    req.flush({ items: [TERMINO], count: 1, limit: 200 });
  });

  it('la fila de categorías sigue visible con un filtro puesto: es el mapa', async () => {
    // Esconderla al entrar a una categoría obligaría a volver atrás para
    // cambiar de tema, que es lo que una enciclopedia no hace.
    responderLanding();
    await irA({ category: 'glossary-category-disease' });
    responderTerminos();
    await harness.fixture.whenStable();

    const tarjetas = html().querySelectorAll('.glosario__tarjeta');
    expect(tarjetas.length).toBe(1);
    expect(tarjetas[0].getAttribute('aria-current')).toBe('true');
  });

  it('el texto y la categoría conviven: elegir una no borra lo que se escribió', async () => {
    responderLanding();

    interno<(texto: string) => void>('buscar')('hiper');
    await harness.fixture.whenStable();
    responderTerminos([]);

    await irA({ q: 'hiper', category: 'glossary-category-disease' });

    const req = pedidoDeTerminos();
    expect(req.request.params.get('q')).toBe('hiper');
    expect(req.request.params.get('valueSetId')).toBe('vs-1');
    req.flush({ items: [], count: 0, limit: 200 });
  });

  it('un enlace con una categoría que no existe lo dice, y no pide nada', async () => {
    responderLanding();

    await irA({ category: 'inventada' });

    // No sale ninguna petición: sin uuid no hay nada que pedir.
    const actual = estadoDelCuerpo();
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('inventada');
  });

  it('«Ver todo el glosario» limpia categoría y texto, y no vuelve a pedir el corpus', async () => {
    responderLanding();

    await irA({ category: 'glossary-category-disease' });
    responderTerminos();

    interno<() => void>('verTodo')();
    await harness.fixture.whenStable();

    expect(interno<() => boolean>('hayFiltro')()).toBe(false);
    const url = TestBed.inject(Router).url;
    expect(url).not.toContain('category=');
    expect(url).not.toContain('q=');
    // El corpus ya está leído: volver al índice no es una lectura nueva.
    expect(estadoDelCuerpo().status).toBe('ready');
  });

  it('un término sin tags ni categoría no revienta el render (regresión del bug de búsqueda)', async () => {
    // Reproduce el defecto real: antes del arreglo del backend, una búsqueda
    // por texto sin `valueSetId` devolvía el concepto pelado —sin `category`,
    // `tags`, `shortDefinition` ni `relationsCount`— y recorrer `termino.tags`
    // tiraba `TypeError` al renderizar la entrada, dejando el cuerpo sin
    // dibujar. El cinturón (`?? []`, en el template y en el derivado de los
    // chips) tiene que sobrevivir a esa forma parcial aunque el backend vuelva
    // a fallar.
    const terminoPelado = {
      conceptId: '22222222-2222-4222-8222-222222222222',
      code: 'N02BE01',
      display: 'Paracetamol',
      slug: 'paracetamol',
      translated: true,
      valueSets: [],
      category: undefined,
      shortDefinition: undefined,
      tags: undefined,
      relationsCount: undefined,
      status: 'active',
    };

    responderLanding([CATEGORIA], [terminoPelado]);
    await harness.fixture.whenStable();

    expect(html().querySelectorAll('.glosario__entrada').length).toBe(1);
    expect(html().textContent).toContain('Paracetamol');
    expect(html().textContent).toContain('Sin definición breve cargada.');
  });

  // --- Recorte y traducción, conservado de las rondas anteriores -----------

  it('avisa cuando el corpus vino recortado por el tope', async () => {
    responderCategorias();
    responderTerminos([TERMINO], 201);
    await harness.fixture.whenStable();

    expect(interno<() => boolean>('recortado')()).toBe(true);
    expect(html().textContent).toContain('Se muestran los primeros 200');
  });

  it('no avisa de recorte cuando entraron todos, ni cuando entraron justo el tope', async () => {
    responderCategorias();
    responderTerminos([TERMINO], 200);

    expect(interno<() => boolean>('recortado')()).toBe(false);
  });

  it('cuenta los términos sin traducir y no los disimula', async () => {
    responderLanding([CATEGORIA], [
      TERMINO,
      { ...TERMINO, conceptId: 'c-2', display: 'Mild', translated: false },
    ]);
    await harness.fixture.whenStable();

    expect(interno<() => number>('sinTraduccion')()).toBe(1);
    expect(html().textContent).toContain('traducción al castellano cargada');
  });

  // --- Vacíos, distintos según qué se estaba mirando ------------------------

  it('con texto y sin resultados, el vacío nombra el texto que no encontró', async () => {
    responderLanding();
    interno<(texto: string) => void>('buscar')('inexistente');
    await harness.fixture.whenStable();
    responderTerminos([]);

    const actual = estadoDelCuerpo();
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('inexistente');
  });

  it('una categoría sin términos lo dice por su nombre', async () => {
    responderLanding();
    await irA({ category: 'glossary-category-disease' });
    responderTerminos([]);

    const actual = estadoDelCuerpo();
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('Enfermedades');
  });

  it('un glosario sin un solo término lo dice, y ofrece por dónde salir', () => {
    responderCategorias();
    responderTerminos([]);

    const actual = estadoDelCuerpo();
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('todavía no tiene términos cargados');
  });

  // --- Errores ---------------------------------------------------------------

  it('un fallo de red al buscar se traduce a S8, no a una excepción', async () => {
    responderLanding();
    interno<(texto: string) => void>('buscar')('hiper');
    await harness.fixture.whenStable();
    pedidoDeTerminos().error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(estadoDelCuerpo().status).toBe('offline');
  });

  it('si fallan las categorías, buscar por texto igual funciona', async () => {
    pedidoDeCategorias().error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    responderTerminos();

    // Las categorías son la puerta principal, pero no la única forma de llegar
    // a un término: quedarse sin ellas no puede impedir buscar por texto.
    interno<(texto: string) => void>('buscar')('hiper');
    await harness.fixture.whenStable();
    responderTerminos();

    expect(estadoDelCuerpo().status).toBe('ready');
    expect(interno<() => { status: string }>('categorias')().status).toBe('offline');
  });

  it('si falla el corpus, la fila de categorías se dibuja igual', async () => {
    responderCategorias();
    pedidoDeTerminos().error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await harness.fixture.whenStable();

    expect(estadoDelCuerpo().status).toBe('offline');
    // El conteo de la tarjeta lo trae `listValueSets()`, no el corpus: la fila
    // sigue siendo navegable aunque el cuerpo no haya podido leerse.
    expect(html().querySelectorAll('.glosario__tarjeta').length).toBe(1);
  });
});

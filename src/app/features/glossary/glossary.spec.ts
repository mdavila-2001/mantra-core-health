import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { Glossary } from './glossary';

/**
 * El glosario, rehecho: se hojea por etiquetas y se lee en castellano.
 *
 * Lo que se fija acá son **las dos cosas que el cliente subrayó** —«no una tabla
 * simplona» y «todo en castellano»— más la mecánica que ya estaba bien y se
 * conservó entera de la ronda anterior: el filtro en la URL, el aviso de recorte
 * y los vacíos distintos según qué se estuviera mirando.
 *
 * Se monta con `RouterTestingHarness` y no con `TestBed.createComponent` porque
 * los filtros viven en la URL: sin un router de verdad, `buscar()` navegaría al
 * vacío y el efecto que recarga no se enteraría nunca.
 */
const RUTA = '/glossary';

const TERMINO = {
  conceptId: '11111111-1111-4111-8111-111111111111',
  code: 'I10',
  display: 'Hipertensión esencial',
  definition: 'Presión arterial persistentemente alta.',
  translated: true,
  valueSets: [{ id: 'vs-1', internalCode: 'condition-code', name: 'Diagnóstico' }],
};

const ETIQUETA = {
  id: 'vs-1',
  internalCode: 'condition-code',
  name: 'Diagnóstico',
  description: 'Nosología para registrar diagnósticos.',
  defaultVersionId: 'ver-1',
  memberCount: 12,
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

  /** La lectura de las etiquetas. Es la primera que sale, al construir. */
  function pedidoDeEtiquetas() {
    return http.expectOne((r) => r.url.endsWith('/terminology/value-sets'));
  }

  /** La lectura de los términos. */
  function pedidoDeTerminos() {
    return http.expectOne((r) => r.url.endsWith('/terminology/concepts'));
  }

  function responderEtiquetas(items: unknown[] = [ETIQUETA]) {
    pedidoDeEtiquetas().flush({
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

  // --- Lo que el cliente subrayó ------------------------------------------

  it('al abrir pide las etiquetas: hay algo que mirar sin escribir nada', () => {
    // Ésta es la diferencia con lo que rebotó. La pantalla anterior sólo sabía
    // pedir conceptos y esperaba a que alguien tecleara.
    responderEtiquetas();
    responderTerminos();

    const etiquetas = interno<() => readonly { name: string }[]>('etiquetasConTerminos')();
    expect(etiquetas.map((e) => e.name)).toEqual(['Diagnóstico']);
  });

  it('pide el catálogo en castellano y con sus etiquetas, siempre', () => {
    responderEtiquetas();

    const req = pedidoDeTerminos();
    // Sin esto el glosario se ve en inglés aunque la interfaz esté en
    // castellano: el `display` que devuelve el catálogo es el del sistema de
    // codificación.
    expect(req.request.params.get('lang')).toBe('ES');
    expect(req.request.params.get('includeValueSets')).toBe('true');
    req.flush({ items: [TERMINO], count: 1, limit: 200 });
  });

  it('no ofrece una categoría vacía: sería un clic a una pantalla en blanco', () => {
    responderEtiquetas([
      ETIQUETA,
      { ...ETIQUETA, id: 'vs-2', internalCode: 'vacia', memberCount: 0 },
    ]);
    responderTerminos();

    const etiquetas = interno<() => readonly { id: string }[]>('etiquetasConTerminos')();
    expect(etiquetas.map((e) => e.id)).toEqual(['vs-1']);
  });

  // --- Navegar por etiqueta ------------------------------------------------

  it('elegir una etiqueta la publica en la URL y filtra por su uuid', async () => {
    responderEtiquetas();
    responderTerminos();

    interno<(codigo: string) => void>('filtrarPorEtiqueta')('condition-code');
    await harness.fixture.whenStable();

    const req = pedidoDeTerminos();
    // En la URL viaja el código —legible y compartible—; a la API va el uuid.
    // Es lo que hace que un glosario filtrado por «Diagnóstico» se pueda pasar
    // por enlace y siga sirviendo mañana, cuando el uuid ya no sea el mismo.
    expect(req.request.params.get('valueSetId')).toBe('vs-1');
    expect(TestBed.inject(Router).url).toContain('etiqueta=condition-code');
    req.flush({ items: [TERMINO], count: 1, limit: 200 });
  });

  it('la misma etiqueta otra vez la quita: es un interruptor', async () => {
    responderEtiquetas();
    responderTerminos();

    interno<(codigo: string) => void>('filtrarPorEtiqueta')('condition-code');
    await harness.fixture.whenStable();
    responderTerminos();

    interno<(codigo: string) => void>('filtrarPorEtiqueta')('condition-code');
    await harness.fixture.whenStable();

    const req = pedidoDeTerminos();
    expect(req.request.params.has('valueSetId')).toBe(false);
    req.flush({ items: [TERMINO], count: 1, limit: 200 });
  });

  it('el texto y la etiqueta conviven: elegir una no borra lo que se escribió', async () => {
    responderEtiquetas();
    responderTerminos();

    interno<(texto: string) => void>('buscar')('hiper');
    await harness.fixture.whenStable();
    responderTerminos();

    interno<(codigo: string) => void>('filtrarPorEtiqueta')('condition-code');
    await harness.fixture.whenStable();

    const req = pedidoDeTerminos();
    expect(req.request.params.get('q')).toBe('hiper');
    expect(req.request.params.get('valueSetId')).toBe('vs-1');
    req.flush({ items: [], count: 0, limit: 200 });
  });

  it('un enlace con una categoría que no existe lo dice, y no muestra el catálogo entero', async () => {
    responderEtiquetas();
    responderTerminos();

    interno<(codigo: string) => void>('filtrarPorEtiqueta')('inventada');
    await harness.fixture.whenStable();

    // No sale ninguna petición: sin uuid no hay nada que pedir, y pedir sin
    // filtro habría mostrado todo el glosario bajo un rótulo que dice otra cosa.
    const actual = estadoDeTerminos();
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('inventada');
  });

  // --- Índice alfabético ---------------------------------------------------

  it('agrupa las entradas por inicial y sabe qué letras tienen algo', () => {
    responderEtiquetas();
    responderTerminos([
      TERMINO,
      { ...TERMINO, conceptId: 'c-2', display: 'Asma' },
      { ...TERMINO, conceptId: 'c-3', display: 'Ámbito' },
    ]);

    const letras = interno<() => Set<string>>('letrasDisponibles')();
    // «Ámbito» cae en la A: quien busca en castellano no piensa en «Á» como
    // una letra distinta.
    expect([...letras].sort()).toEqual(['A', 'H']);
  });

  it('elegir una letra acota a su grupo, y la misma otra vez las muestra todas', () => {
    responderEtiquetas();
    responderTerminos([TERMINO, { ...TERMINO, conceptId: 'c-2', display: 'Asma' }]);

    interno<(letra: string) => void>('elegirLetra')('A');
    expect(
      interno<() => readonly { letra: string }[]>('gruposVisibles')().map((g) => g.letra),
    ).toEqual(['A']);

    interno<(letra: string) => void>('elegirLetra')('A');
    expect(interno<() => readonly unknown[]>('gruposVisibles')().length).toBe(2);
  });

  it('cambiar de filtro reinicia la letra: la elegida ya no aplica', async () => {
    responderEtiquetas();
    responderTerminos();

    interno<(letra: string) => void>('elegirLetra')('H');
    expect(interno<() => string | null>('letra')()).toBe('H');

    interno<(texto: string) => void>('buscar')('asma');
    await harness.fixture.whenStable();
    responderTerminos();

    expect(interno<() => string | null>('letra')()).toBeNull();
  });

  // --- Lo que se conservó de la ronda anterior -----------------------------

  it('al entrar sin filtro NO manda `q` vacío', () => {
    responderEtiquetas();

    const req = pedidoDeTerminos();
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ items: [TERMINO], count: 1, limit: 200 });
  });

  it('buscar publica el texto en la URL y vuelve a pedir con `q`', async () => {
    responderEtiquetas();
    responderTerminos();

    interno<(texto: string) => void>('buscar')('hipertensión');
    await harness.fixture.whenStable();

    const req = pedidoDeTerminos();
    expect(req.request.params.get('q')).toBe('hipertensión');
    req.flush({ items: [], count: 0, limit: 200 });
  });

  it('sin filtro, el vacío dice que el glosario no tiene términos', () => {
    responderEtiquetas();
    responderTerminos([]);

    const actual = estadoDeTerminos();
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('todavía no tiene términos');
  });

  it('con filtro, el vacío nombra el texto que no encontró', async () => {
    responderEtiquetas();
    responderTerminos();

    interno<(texto: string) => void>('buscar')('inexistente');
    await harness.fixture.whenStable();
    responderTerminos([]);

    const actual = estadoDeTerminos();
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('inexistente');
  });

  it('avisa cuando el resultado vino recortado por el tope', () => {
    responderEtiquetas();
    responderTerminos([TERMINO], 200);

    expect(interno<() => boolean>('recortado')()).toBe(true);
  });

  it('no avisa de recorte cuando entraron todos', () => {
    responderEtiquetas();
    responderTerminos([TERMINO], 1);

    expect(interno<() => boolean>('recortado')()).toBe(false);
  });

  it('un fallo de red se traduce a S8, no a una excepción', () => {
    responderEtiquetas();
    pedidoDeTerminos().error(new ProgressEvent('error'), {
      status: 0,
      statusText: 'Unknown Error',
    });

    expect(estadoDeTerminos().status).toBe('offline');
  });

  it('si fallan las etiquetas, los términos igual se leen', () => {
    pedidoDeEtiquetas().error(new ProgressEvent('error'), {
      status: 0,
      statusText: 'Unknown Error',
    });
    responderTerminos();

    // Las categorías son la puerta principal, pero no la única: quedarse sin
    // ellas no puede dejar la pantalla entera sin nada que mostrar.
    expect(estadoDeTerminos().status).toBe('ready');
    expect(interno<() => { status: string }>('etiquetas')().status).toBe('offline');
  });

  // --- Lo que sigue estando prohibido --------------------------------------

  it('cuenta los términos sin traducir y no los disimula', () => {
    responderEtiquetas();
    responderTerminos([
      TERMINO,
      { ...TERMINO, conceptId: 'c-2', display: 'Mild', translated: false },
    ]);

    expect(interno<() => number>('sinTraduccion')()).toBe(1);
  });
});

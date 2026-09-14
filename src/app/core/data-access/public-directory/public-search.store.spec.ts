import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of, throwError, type Observable } from 'rxjs';

import type { PublicPage, PublicSearchResult } from './public-directory.types';
import {
  BusquedaPublica,
  MAX_PAGINAS_TERRITORIAL,
  POR_PETICION_TERRITORIAL,
  TAMANO_DE_PAGINA,
  type CorteTerritorial,
  type FilaConCiudad,
} from './public-search.store';

/**
 * Lo que estas pruebas fijan.
 *
 * El store existe para tres cosas que, mal hechas, no se ven en desarrollo y sí
 * se ven en producción: que una respuesta vieja no pise a una nueva, que
 * «Anteriores» funcione con cursores opacos, y que un error no borre lo que la
 * persona estaba leyendo. Cada una tiene su caso acá.
 *
 * Se monta dentro de un componente ruteado porque el store lee `?q=` y navega:
 * probarlo sin router obligaría a doblarlo, y el doble no cubriría justamente
 * la parte que puede romperse.
 */
describe('BusquedaPublica', () => {
  /** Una página con la forma del contrato. */
  function pagina(
    items: readonly PublicSearchResult[],
    nextCursor: string | null = null,
    totalHint: number | null = null,
  ): PublicPage<PublicSearchResult> {
    return { items, nextCursor, totalHint, generatedAt: new Date('2026-08-18T00:00:00Z') };
  }

  /** Un resultado mínimo, con los campos que la API sirve. */
  function resultado(slug: string, displayName = slug): PublicSearchResult {
    return {
      kind: 'PRACTITIONER',
      slug,
      displayName,
      headline: null,
      city: null,
      avatarUrl: null,
      verified: false,
      ratingAverage: null,
      ratingCount: 0,
      coverUrl: null,
      address: null,
      location: null,
      hasPublishedAgenda: false,
      nextAvailableDate: null,
    };
  }

  /** Monta el store dentro de una ruta real y devuelve el espía de lectura. */
  async function montar(
    lectura: (
      filtros: Record<string, unknown>,
    ) => Observable<PublicPage<PublicSearchResult>>,
  ) {
    const llamadas: Record<string, unknown>[] = [];

    @Component({ template: '' })
    class Anfitrion {
      readonly busqueda = new BusquedaPublica((filtros) => {
        llamadas.push({ ...filtros });
        return lectura(filtros as Record<string, unknown>);
      });
    }

    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'search', component: Anfitrion }])],
    });

    const harness = await RouterTestingHarness.create('/search');
    const anfitrion = harness.routeDebugElement!.componentInstance as Anfitrion;
    return { busqueda: anfitrion.busqueda, llamadas, harness };
  }

  // ─── La lectura inicial la dispara la URL ──────────────────────────────────

  it('lee en cuanto se monta, sin que nadie llame a buscar', async () => {
    const { busqueda, llamadas } = await montar(() => of(pagina([resultado('uno')])));

    expect(llamadas.length).toBe(1);
    expect(busqueda.estado()).toBe('datos');
    expect(busqueda.resultados().length).toBe(1);
  });

  it('toma el texto de `?q=` y no de un estado propio', async () => {
    const llamadas: Record<string, unknown>[] = [];

    @Component({ template: '' })
    class Anfitrion {
      readonly busqueda = new BusquedaPublica((filtros) => {
        llamadas.push({ ...filtros });
        return of(pagina([]));
      });
    }

    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'search', component: Anfitrion }])],
    });

    const harness = await RouterTestingHarness.create('/search?q=cardio');
    const anfitrion = harness.routeDebugElement!.componentInstance as Anfitrion;

    expect(anfitrion.busqueda.texto()).toBe('cardio');
    expect(llamadas[0]?.['q']).toBe('cardio');
  });

  it('pide el tamaño de página del carril', async () => {
    const { llamadas } = await montar(() => of(pagina([])));

    expect(llamadas[0]?.['limit']).toBe(TAMANO_DE_PAGINA);
  });

  // ─── Los cuatro estados ────────────────────────────────────────────────────

  it('una página vacía es «vacio» y no «datos» con cero filas', async () => {
    const { busqueda } = await montar(() => of(pagina([])));

    expect(busqueda.estado()).toBe('vacio');
  });

  it('un fallo de red deja «error» y **no** borra lo que ya se leía', async () => {
    let falla = false;
    const { busqueda } = await montar(() =>
      falla ? throwError(() => new Error('sin red')) : of(pagina([resultado('uno')])),
    );

    expect(busqueda.resultados().length).toBe(1);

    falla = true;
    busqueda.reintentar();

    expect(busqueda.estado()).toBe('error');
    // Lo leído sigue en pantalla: el texto de error de la maqueta promete
    // exactamente eso —«tu búsqueda se mantiene escrita»—.
    expect(busqueda.resultados().length).toBe(1);
  });

  it('después de un error, reintentar vuelve a «datos»', async () => {
    let falla = true;
    const { busqueda } = await montar(() =>
      falla ? throwError(() => new Error('sin red')) : of(pagina([resultado('uno')])),
    );

    expect(busqueda.estado()).toBe('error');

    falla = false;
    busqueda.reintentar();

    expect(busqueda.estado()).toBe('datos');
  });

  // ─── Paginación por cursor ─────────────────────────────────────────────────

  it('avanza con el cursor que devolvió la página anterior', async () => {
    const { busqueda, llamadas } = await montar((filtros) =>
      filtros['cursor'] === undefined
        ? of(pagina([resultado('uno')], 'cursor-2'))
        : of(pagina([resultado('dos')], null)),
    );

    expect(busqueda.haySiguientes()).toBe(true);
    busqueda.siguiente();

    expect(llamadas[1]?.['cursor']).toBe('cursor-2');
    expect(busqueda.resultados()[0]?.slug).toBe('dos');
    expect(busqueda.haySiguientes()).toBe(false);
    expect(busqueda.hayAnteriores()).toBe(true);
  });

  it('«Anteriores» repite la petición con la que se llegó a esa página', async () => {
    const { busqueda, llamadas } = await montar((filtros) =>
      filtros['cursor'] === undefined
        ? of(pagina([resultado('uno')], 'cursor-2'))
        : of(pagina([resultado('dos')], null)),
    );

    busqueda.siguiente();
    busqueda.anterior();

    // Vuelve a la primera: sin cursor, que es como se pidió la primera vez.
    // No hay `prevCursor` en el contrato, así que la única forma de volver es
    // recordar por dónde se pasó.
    expect(llamadas[2]?.['cursor']).toBeUndefined();
    expect(busqueda.hayAnteriores()).toBe(false);
    expect(busqueda.pagina()).toBe(1);
  });

  it('en la primera página, «Anteriores» no hace nada', async () => {
    const { busqueda, llamadas } = await montar(() => of(pagina([resultado('uno')])));

    busqueda.anterior();

    expect(llamadas.length).toBe(1);
  });

  it('una búsqueda nueva vuelve a la primera página', async () => {
    const { busqueda, llamadas } = await montar((filtros) =>
      filtros['cursor'] === undefined
        ? of(pagina([resultado('uno')], 'cursor-2'))
        : of(pagina([resultado('dos')], 'cursor-3')),
    );

    busqueda.siguiente();
    expect(busqueda.pagina()).toBe(2);

    busqueda.buscar();

    expect(busqueda.pagina()).toBe(1);
    expect(llamadas[2]?.['cursor']).toBeUndefined();
  });

  // ─── Respuestas fuera de orden ─────────────────────────────────────────────

  /**
   * El fallo clásico de un buscador: se escribe «car», tarda; se escribe
   * «cardio», responde rápido; y después llega la de «car» y pisa la lista con
   * resultados de una búsqueda que ya no es la que está escrita. No se ve en
   * desarrollo, donde la API responde en 8 ms.
   */
  it('una respuesta vieja que llega tarde no pisa a la nueva', async () => {
    const primera = new Subject<PublicPage<PublicSearchResult>>();
    const segunda = new Subject<PublicPage<PublicSearchResult>>();
    let n = 0;
    const { busqueda } = await montar(() => (n++ === 0 ? primera : segunda));

    busqueda.buscar();

    segunda.next(pagina([resultado('nueva')]));
    primera.next(pagina([resultado('vieja')]));

    expect(busqueda.resultados()[0]?.slug).toBe('nueva');
  });

  // ─── El rótulo de la paginación ────────────────────────────────────────────

  /**
   * `totalHint` es una **pista** y el contrato prohíbe escribir «N resultados»
   * sin el matiz. Con OpenSearch deja de ser exacto por encima de 10 000.
   */
  it('con pista de total, el rótulo dice «aproximadamente»', async () => {
    const { busqueda } = await montar(() => of(pagina([resultado('uno')], null, 96)));

    expect(busqueda.rotuloDePagina()).toContain('aproximadamente 96');
  });

  it('sin pista de total, el rótulo no inventa un total', async () => {
    const { busqueda } = await montar(() => of(pagina([resultado('uno')], null, null)));

    expect(busqueda.rotuloDePagina()).not.toContain('aproximadamente');
    expect(busqueda.rotuloDePagina()).toContain('1 en esta página');
  });

  // ─── Los filtros propios del vertical, en la URL (AC-02-7) ─────────────────

  describe('filtros declarados que viajan en la URL', () => {
    /** Monta el store con parámetros extra declarados, en la URL que se le pase. */
    async function montarCon(url: string, nombres: readonly string[]) {
      const llamadas: Record<string, unknown>[] = [];

      @Component({ template: '' })
      class Anfitrion {
        readonly busqueda = new BusquedaPublica((filtros, parametros) => {
          llamadas.push({ ...filtros, especialidad: parametros['specialty'] ?? '' });
          return of(pagina([]));
        }, nombres);
      }

      TestBed.configureTestingModule({
        providers: [provideRouter([{ path: 'search', component: Anfitrion }])],
      });

      const harness = await RouterTestingHarness.create(url);
      const anfitrion = harness.routeDebugElement!.componentInstance as Anfitrion;
      return { busqueda: anfitrion.busqueda, llamadas, harness };
    }

    it('sin parámetros declarados no cambia nada de lo de antes', async () => {
      const { busqueda } = await montarCon('/search', []);

      expect(busqueda.parametro('specialty')).toBe('');
    });

    it('lee el filtro de la dirección al montar: un enlace pegado ya llega filtrado', async () => {
      const { busqueda, llamadas } = await montarCon('/search?specialty=uuid-cardio', [
        'specialty',
      ]);

      expect(busqueda.parametro('specialty')).toBe('uuid-cardio');
      expect(llamadas[0]?.['especialidad']).toBe('uuid-cardio');
    });

    it('un parámetro que no se declaró se ignora', async () => {
      const { busqueda } = await montarCon('/search?specialty=uuid-cardio', []);

      expect(busqueda.parametro('specialty')).toBe('');
    });

    it('elegir un filtro lo escribe en la URL y vuelve a leer', async () => {
      const { busqueda, llamadas, harness } = await montarCon('/search', ['specialty']);
      expect(llamadas.length).toBe(1);

      busqueda.filtrarPor('specialty', 'uuid-pediatria');
      await harness.fixture.whenStable();

      expect(busqueda.parametro('specialty')).toBe('uuid-pediatria');
      expect(llamadas.length).toBe(2);
      expect(llamadas[1]?.['especialidad']).toBe('uuid-pediatria');
    });

    it('quitarlo con «» saca el parámetro de la URL en vez de dejarlo vacío', async () => {
      const { busqueda, harness } = await montarCon('/search?specialty=uuid-cardio', [
        'specialty',
      ]);

      busqueda.filtrarPor('specialty', '');
      await harness.fixture.whenStable();

      // `?specialty=` colgando es una dirección que dice filtrar y no filtra.
      expect(TestBed.inject(Router).url).toBe('/search');
      expect(busqueda.parametro('specialty')).toBe('');
    });

    it('cambiar el filtro vuelve a la primera página', async () => {
      const paginas: PublicPage<PublicSearchResult>[] = [];
      const llamadas: Record<string, unknown>[] = [];

      @Component({ template: '' })
      class Anfitrion {
        readonly busqueda = new BusquedaPublica((filtros) => {
          llamadas.push({ ...filtros });
          const p = pagina([resultado('uno')], 'cursor-2');
          paginas.push(p);
          return of(p);
        }, ['specialty']);
      }

      TestBed.configureTestingModule({
        providers: [provideRouter([{ path: 'search', component: Anfitrion }])],
      });
      const harness = await RouterTestingHarness.create('/search');
      const busqueda = (harness.routeDebugElement!.componentInstance as Anfitrion).busqueda;

      busqueda.siguiente();
      await harness.fixture.whenStable();
      expect(busqueda.pagina()).toBe(2);

      busqueda.filtrarPor('specialty', 'uuid-cardio');
      await harness.fixture.whenStable();

      // Quedarse en la página 2 de otro conjunto de resultados es mostrar una
      // página que no existe para ese filtro.
      expect(busqueda.pagina()).toBe(1);
      expect(llamadas.at(-1)?.['cursor']).toBeUndefined();
    });

    it('el filtro y el texto en el mismo cambio producen UNA sola lectura', async () => {
      const { llamadas, harness } = await montarCon('/search?q=lopez', ['specialty']);
      expect(llamadas.length).toBe(1);

      // Dos suscripciones al mismo `queryParamMap` habrían pedido dos veces, y
      // `switchMap` habría cancelado la primera a mitad de vuelo.
      await TestBed.inject(Router).navigate(['/search'], {
        queryParams: { q: 'gomez', specialty: 'uuid-cardio' },
      });
      await harness.fixture.whenStable();

      expect(llamadas.length).toBe(2);
    });
  });
});

/* ============================================================================
    El corte territorial (subtarea 2.3).

    Con `territorio`, el store trae el directorio entero y pagina en memoria.
    Acá se prueba el store con un corte de mentira —el departamento es el
    prefijo de la ciudad, «CB-…»—; el corte real, contra el catálogo, se prueba
    en `shared/geo/filtro-territorial.spec.ts` y en las pantallas.
    ========================================================================== */

describe('BusquedaPublica · con corte territorial', () => {
  function pagina(
    items: readonly PublicSearchResult[],
    nextCursor: string | null = null,
  ): PublicPage<PublicSearchResult> {
    return { items, nextCursor, totalHint: null, generatedAt: new Date('2026-09-12T00:00:00Z') };
  }

  function fila(slug: string, city: string | null): PublicSearchResult {
    return {
      kind: 'INSURER',
      slug,
      displayName: slug,
      headline: null,
      city,
      avatarUrl: null,
      verified: false,
      ratingAverage: null,
      ratingCount: 0,
      coverUrl: null,
      address: null,
      location: null,
      hasPublishedAgenda: false,
      nextAvailableDate: null,
    };
  }

  /** `n` filas del mismo departamento de mentira. */
  function varias(n: number, departamento: string): PublicSearchResult[] {
    return Array.from({ length: n }, (_, i) => fila(`${departamento}-${i}`, `${departamento}-Ciudad`));
  }

  function corteDePrueba() {
    const departamento = signal<string | null>(null);
    const ciudad = signal<string | null>(null);
    const enElLugar = (city: string | null): boolean => {
      const elegido = departamento();
      if (elegido !== null && (city === null || !city.startsWith(`${elegido}-`))) {
        return false;
      }
      const municipio = ciudad();
      return municipio === null || city === municipio;
    };
    const corte: CorteTerritorial = {
      departamentoElegido: departamento,
      ciudad,
      nombreDelDepartamento: computed(() => departamento()),
      recortar: <T extends FilaConCiudad>(filas: readonly T[]): readonly T[] =>
        filas.filter((f) => enElLugar(f.city)),
      ciudades: () => [],
      cuentaPorDepartamento: () => new Map<string, number>(),
      sinUbicar: () => 0,
    };
    return { corte, departamento };
  }

  async function montar(
    lectura: (filtros: Record<string, unknown>) => Observable<PublicPage<PublicSearchResult>>,
  ) {
    const llamadas: Record<string, unknown>[] = [];
    const { corte, departamento } = corteDePrueba();

    @Component({ template: '' })
    class Anfitrion {
      readonly busqueda = new BusquedaPublica(
        (filtros) => {
          llamadas.push({ ...filtros });
          return lectura(filtros as Record<string, unknown>);
        },
        [],
        { territorio: corte },
      );
    }

    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'search', component: Anfitrion }])],
    });
    const harness = await RouterTestingHarness.create('/search');
    const busqueda = (harness.routeDebugElement!.componentInstance as Anfitrion).busqueda;
    return { busqueda, llamadas, departamento };
  }

  it('recorre el cursor entero, pidiendo de a lo que el servidor acepta', async () => {
    const { busqueda, llamadas } = await montar((filtros) =>
      filtros['cursor'] === undefined
        ? of(pagina([fila('la-paz', 'LP-La Paz')], 'cursor-2'))
        : of(pagina([fila('cochabamba', 'CB-Cochabamba')])),
    );

    expect(llamadas.length).toBe(2);
    expect(llamadas[0]?.['limit']).toBe(POR_PETICION_TERRITORIAL);
    expect(llamadas[1]?.['cursor']).toBe('cursor-2');
    expect(busqueda.resultados().map((r) => r.slug)).toEqual(['la-paz', 'cochabamba']);
  });

  it('el corte ve el directorio entero, no sólo la primera página', async () => {
    const { busqueda, departamento } = await montar((filtros) =>
      filtros['cursor'] === undefined
        ? of(pagina([fila('la-paz', 'LP-La Paz')], 'cursor-2'))
        : of(pagina([fila('cochabamba', 'CB-Cochabamba')])),
    );

    departamento.set('CB');

    // Recortar sólo la primera página habría dicho «no hay nada en Cochabamba».
    expect(busqueda.resultados().map((r) => r.slug)).toEqual(['cochabamba']);
  });

  it('cambiar el lugar no vuelve a pedir y vuelve a la primera página', async () => {
    const { busqueda, llamadas, departamento } = await montar(() => of(pagina(varias(30, 'CB'))));

    busqueda.siguiente();
    expect(busqueda.pagina()).toBe(2);
    expect(busqueda.resultados().length).toBe(5);

    departamento.set('CB');

    expect(busqueda.pagina()).toBe(1);
    expect(busqueda.resultados().length).toBe(TAMANO_DE_PAGINA);
    expect(llamadas.length).toBe(1);
  });

  it('«Anteriores» y «Siguientes» se mueven en memoria, sin pedir', async () => {
    const { busqueda, llamadas } = await montar(() => of(pagina(varias(30, 'CB'))));

    expect(busqueda.hayAnteriores()).toBe(false);
    expect(busqueda.haySiguientes()).toBe(true);
    busqueda.siguiente();
    expect(busqueda.haySiguientes()).toBe(false);
    busqueda.anterior();

    expect(busqueda.pagina()).toBe(1);
    expect(llamadas.length).toBe(1);
  });

  it('un lugar sin resultados deja «vacio», y soltarlo vuelve a «datos»', async () => {
    const { busqueda, departamento } = await montar(() => of(pagina(varias(3, 'CB'))));

    departamento.set('TJ');
    expect(busqueda.estado()).toBe('vacio');

    departamento.set(null);
    expect(busqueda.estado()).toBe('datos');
  });

  it('el total del rótulo es exacto: el directorio está entero en memoria', async () => {
    const { busqueda, departamento } = await montar(() =>
      of(pagina([...varias(30, 'CB'), ...varias(2, 'LP')])),
    );

    departamento.set('LP');

    expect(busqueda.rotuloDePagina()).toBe('2 de 2 · página 1 de 1');
  });

  it('un directorio que no termina dentro del techo de páginas lo avisa', async () => {
    let n = 0;
    const { busqueda, llamadas } = await montar(() =>
      of(pagina([fila(`f-${n++}`, 'CB-Cochabamba')], 'siempre-hay-otra')),
    );

    expect(llamadas.length).toBe(MAX_PAGINAS_TERRITORIAL);
    expect(busqueda.recortada()).toBe(true);
    expect(busqueda.avisoDelLugar()).toContain('primeros resultados');
  });

  it('un fallo al reintentar deja «error» y no borra lo leído', async () => {
    let falla = false;
    const { busqueda } = await montar(() =>
      falla ? throwError(() => new Error('sin red')) : of(pagina(varias(2, 'CB'))),
    );

    falla = true;
    busqueda.reintentar();

    expect(busqueda.estado()).toBe('error');
    expect(busqueda.resultados().length).toBe(2);
  });

  it('el lugar no viaja al servidor', async () => {
    const { busqueda, llamadas, departamento } = await montar(() => of(pagina(varias(2, 'CB'))));

    departamento.set('CB');
    busqueda.buscar();

    expect(llamadas.length).toBe(2);
    for (const llamada of llamadas) {
      expect(Object.keys(llamada)).not.toContain('departamento');
      expect(llamada['city'] ?? '').toBe('');
    }
  });
});

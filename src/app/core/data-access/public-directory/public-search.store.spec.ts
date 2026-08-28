import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of, throwError, type Observable } from 'rxjs';

import type { PublicPage, PublicSearchResult } from './public-directory.types';
import { BusquedaPublica, TAMANO_DE_PAGINA } from './public-search.store';

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
      providers: [provideRouter([{ path: 'buscar', component: Anfitrion }])],
    });

    const harness = await RouterTestingHarness.create('/buscar');
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
      providers: [provideRouter([{ path: 'buscar', component: Anfitrion }])],
    });

    const harness = await RouterTestingHarness.create('/buscar?q=cardio');
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
});

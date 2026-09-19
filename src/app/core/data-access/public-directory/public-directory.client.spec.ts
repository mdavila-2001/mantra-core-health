import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PublicDirectoryClient } from './public-directory.client';

/**
 * Lo que estas pruebas fijan.
 *
 * Los cuerpos se escriben **con la forma que la API manda de verdad** —fechas
 * en texto, opcionales en `null` explícito— y no con la forma ya convertida que
 * declara el tipo de la vista. Fabricarlos convertidos haría que la prueba pase
 * mientras la conversión está rota, que es el defecto que `wire.ts` documenta.
 *
 * Las formas salen de `openapi/CONTRATO-PUBLICO.md` y de la respuesta real de
 * la API viva, capturada el 2026-08-17:
 *
 * ```
 * {"items":[],"nextCursor":null,"totalHint":null,"generatedAt":"2026-08-17T21:03:50.687Z"}
 * ```
 */
describe('PublicDirectoryClient', () => {
  let client: PublicDirectoryClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(PublicDirectoryClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** La página vacía, tal cual la sirve la API. */
  const paginaVacia = {
    items: [],
    nextCursor: null,
    totalHint: null,
    generatedAt: '2026-08-17T21:03:50.687Z',
  };

  // ─── La categoría, que la API viva todavía no manda ───────────────────────

  /** Una fila del buscador tal como la sirve hoy la API: **sin** `category`. */
  const filaSinCategoria = {
    kind: 'PHARMACY',
    slug: 'farmacia-vida',
    displayName: 'Farmacia Vida',
    headline: null,
    city: 'Santa Cruz de la Sierra',
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

  /**
   * El contrato público no declara `category` y la API no la manda; el
   * simulador sí. Sin normalizar, la clave llegaría **sin declarar** mientras
   * el tipo de la vista promete que está, y `'category' in fila` sería falso
   * en producción y cierto en la maqueta — el peor de los dos mundos.
   */
  it('una fila sin category llega con category en null, no ausente', () => {
    let fila: Record<string, unknown> | undefined;
    client.searchPharmacies().subscribe((pagina) => {
      fila = pagina.items[0] as unknown as Record<string, unknown>;
    });

    http.expectOne((r) => r.url === '/public/search/pharmacies').flush({
      ...paginaVacia,
      items: [filaSinCategoria],
    });

    expect(fila).toBeDefined();
    expect('category' in fila!).toBe(true);
    expect(fila!['category']).toBeNull();
  });

  it('la categoría que sí viene se conserva tal cual', () => {
    const category = { code: 'cadena-farmacorp', label: 'Farmacorp' };
    let fila: Record<string, unknown> | undefined;
    client.searchPharmacies().subscribe((pagina) => {
      fila = pagina.items[0] as unknown as Record<string, unknown>;
    });

    http.expectOne((r) => r.url === '/public/search/pharmacies').flush({
      ...paginaVacia,
      items: [{ ...filaSinCategoria, category }],
    });

    expect(fila!['category']).toEqual(category);
  });

  // ─── Los filtros ausentes no viajan ────────────────────────────────────────

  /**
   * `?q=` no es «no filtrar»: es filtrar por la cadena vacía. En un buscador esa
   * diferencia es la pantalla entera —cero resultados en vez del catálogo—, y
   * es invisible en el código si el cliente manda todo lo que recibe.
   */
  it('search no manda q, city, cursor ni limit cuando no vinieron', () => {
    client.search().subscribe();

    const req = http.expectOne((r) => r.url === '/public/search');
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('city')).toBe(false);
    expect(req.request.params.has('cursor')).toBe(false);
    expect(req.request.params.has('limit')).toBe(false);
    req.flush(paginaVacia);
  });

  it('search omite el texto vacío en vez de filtrar por él', () => {
    client.search({ q: '' }).subscribe();

    const req = http.expectOne((r) => r.url === '/public/search');
    expect(req.request.params.has('q')).toBe(false);
    req.flush(paginaVacia);
  });

  /** `verified: false` **sí** viaja: es un filtro, no una ausencia. */
  it('searchPractitioners manda verified=false cuando se declara', () => {
    client.searchPractitioners({ verified: false }).subscribe();

    const req = http.expectOne((r) => r.url === '/public/search/practitioners');
    expect(req.request.params.get('verified')).toBe('false');
    req.flush(paginaVacia);
  });

  it('searchPractitioners no manda verified cuando no se declara', () => {
    client.searchPractitioners({ q: 'cardio' }).subscribe();

    const req = http.expectOne((r) => r.url === '/public/search/practitioners');
    expect(req.request.params.get('q')).toBe('cardio');
    expect(req.request.params.has('verified')).toBe(false);
    req.flush(paginaVacia);
  });

  // ─── El cursor es opaco ────────────────────────────────────────────────────

  /**
   * Se copia y se manda tal cual. La API lo emite en base64url con JSON adentro
   * —y no como `"nombre id"`, porque todo nombre visible tiene espacios—, pero
   * eso es asunto del servidor: acá no se parsea ni se reconstruye.
   */
  it('search reenvía el cursor recibido sin tocarlo', () => {
    const cursor = 'eyJkIjoiRHJhLiBNYXJpc29sIiwiaSI6InBwLTEifQ';
    client.search({ cursor }).subscribe();

    const req = http.expectOne((r) => r.url === '/public/search');
    expect(req.request.params.get('cursor')).toBe(cursor);
    req.flush(paginaVacia);
  });

  // ─── La conversión de la envoltura ─────────────────────────────────────────

  it('convierte generatedAt a Date y conserva nextCursor y totalHint', () => {
    let pagina: Awaited<ReturnType<() => unknown>> | undefined;
    client.search().subscribe((p) => (pagina = p as never));

    http.expectOne((r) => r.url === '/public/search').flush({
      items: [],
      nextCursor: 'siguiente',
      totalHint: 42,
      generatedAt: '2026-08-17T21:03:50.687Z',
    });

    const p = pagina as unknown as {
      generatedAt: Date;
      nextCursor: string | null;
      totalHint: number | null;
    };
    expect(p.generatedAt instanceof Date).toBe(true);
    expect(p.generatedAt.toISOString()).toBe('2026-08-17T21:03:50.687Z');
    expect(p.nextCursor).toBe('siguiente');
    expect(p.totalHint).toBe(42);
  });

  /**
   * `ratingAverage: null` con `ratingCount: 0` es el estado normal de un
   * catálogo a medio poblar. Tiene que llegar como `null` y **no** convertirse
   * en `0`: un profesional sin reseñas no está calificado con cero.
   */
  it('conserva ratingAverage null sin convertirlo en cero', () => {
    let pagina: unknown;
    client.search().subscribe((p) => (pagina = p));

    http.expectOne((r) => r.url === '/public/search').flush({
      ...paginaVacia,
      items: [
        {
          kind: 'PRACTITIONER',
          slug: 'doctor-uno-e2e',
          displayName: 'Doctora Uno',
          headline: null,
          city: null,
          avatarUrl: null,
          verified: false,
          ratingAverage: null,
          ratingCount: 0,
        },
      ],
    });

    const item = (pagina as { items: { ratingAverage: number | null }[] }).items[0];
    expect(item.ratingAverage).toBeNull();
  });

  // ─── La ficha por slug ─────────────────────────────────────────────────────

  /**
   * El prefijo es parte del contrato, no un detalle de la URL: `/f/` promete
   * una farmacia y un slug de otra clase da 404 en vez de redirigir. Viaja
   * como segmento de `/public/profiles/` y no como raíz de la ruta porque
   * `/p/:slug` es también la URL de la pantalla — ver la nota de `getProfile`.
   */
  it('getProfile usa el prefijo corto que corresponde al tipo', () => {
    client.getProfile('PHARMACY', 'farmacia-central').subscribe();

    const req = http.expectOne((r) => r.url === '/public/profiles/f/farmacia-central');
    expect(req.request.method).toBe('GET');
    req.flush(fichaCruda());
  });

  it('getProfile escapa el slug antes de ponerlo en la ruta', () => {
    client.getProfile('PRACTITIONER', 'a/b').subscribe();

    http.expectOne((r) => r.url === '/public/profiles/p/a%2Fb').flush(fichaCruda());
  });

  /**
   * Una petición del directorio **no lleva `Authorization`**. Es anónima por
   * contrato: el resultado no depende de quién mira, y mandar un token acá
   * ataría una respuesta cacheada `public, max-age=60` a una sesión.
   */
  it('no manda cabecera de autorización', () => {
    client.getProfile('PRACTITIONER', 'doctor-uno-e2e').subscribe();

    const req = http.expectOne((r) => r.url === '/public/profiles/p/doctor-uno-e2e');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(fichaCruda());
  });

  it('convierte updatedAt y las fechas de las publicaciones', () => {
    let ficha: unknown;
    client.getProfile('PRACTITIONER', 'doctor-uno-e2e').subscribe((f) => (ficha = f));

    http.expectOne((r) => r.url === '/public/profiles/p/doctor-uno-e2e').flush(fichaCruda());

    const f = ficha as { updatedAt: Date; posts: { publishedAt: Date }[] };
    expect(f.updatedAt instanceof Date).toBe(true);
    expect(f.posts[0].publishedAt instanceof Date).toBe(true);
    expect(f.posts[0].publishedAt.toISOString()).toBe('2026-08-10T12:00:00.000Z');
  });

  // ─── Cercanía ──────────────────────────────────────────────────────────────

  /**
   * Las coordenadas son obligatorias en la firma porque lo son en la API: sin
   * ellas devuelve 400, y un centro inventado del lado del cliente daría una
   * lista de resultados cercanos a un punto que nadie eligió.
   */
  it('nearby manda lat y lng y omite radiusKm cuando no vino', () => {
    client.nearby({ lat: -17.78, lng: -63.18 }).subscribe();

    const req = http.expectOne((r) => r.url === '/public/nearby');
    expect(req.request.params.get('lat')).toBe('-17.78');
    expect(req.request.params.get('lng')).toBe('-63.18');
    expect(req.request.params.has('radiusKm')).toBe(false);
    req.flush(paginaVacia);
  });

  /** Un cuerpo de ficha con la forma exacta del contrato. */
  function fichaCruda() {
    return {
      kind: 'PRACTITIONER',
      slug: 'doctor-uno-e2e',
      displayName: 'Doctora Uno',
      headline: null,
      biography: null,
      avatarUrl: null,
      coverUrl: null,
      verified: false,
      city: null,
      address: null,
      location: null,
      specialties: [],
      ratingAverage: null,
      ratingCount: 0,
      acceptsReviews: true,
      posts: [
        {
          id: 'post-1',
          bodyText: 'Hola',
          publishedAt: '2026-08-10T12:00:00.000Z',
          mediaUrls: [],
          reactionCount: 0,
          commentCount: 0,
        },
      ],
      updatedAt: '2026-08-17T21:03:50.687Z',
    };
  }
});

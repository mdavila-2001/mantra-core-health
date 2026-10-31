import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router, type ParamMap } from '@angular/router';
import { of } from 'rxjs';

import { CARGADOR_DE_LEAFLET } from '@shared/components/organisms/map/map';

import { PharmacyDetail } from './pharmacy-detail';
import { destinoDeLaQuery, tomarContexto } from '../../../core/messaging/chat-link';

const SLUG = 'farmacia-vida';

const PERFIL = {
  kind: 'PHARMACY',
  slug: SLUG,
  displayName: 'Farmacia Vida',
  headline: 'Farmacia · entrega a domicilio',
  biography: 'Genéricos y de marca, entrega en menos de una hora.',
  avatarUrl: null,
  coverUrl: null,
  verified: false,
  city: 'Santa Cruz de la Sierra',
  address: 'Av. Alemana N.º 2100',
  location: { lat: -17.76, lng: -63.16 },
  specialties: [],
  trajectory: [],
  practiceSites: [],
  ratingAverage: null,
  ratingCount: 0,
  acceptsReviews: true,
  posts: [],
  updatedAt: '2026-09-10T12:00:00.000Z',
};

/**
 * Siete medicamentos y no tres: el buscador de la sección aparece desde siete
 * —el mismo umbral que la ficha de un laboratorio—, así que con tres el
 * catálogo de prueba no podría ejercitar ni el buscador ni la combinación con
 * los chips.
 */
const CATALOGO = {
  items: [
    {
      id: 'prod-1',
      genericName: 'Losartán',
      brandName: 'Losartán Bagó',
      presentation: '50 mg comprimidos',
      therapeuticGroup: 'Cardiovascular',
      price: '18.50',
      currency: 'BOB',
      inStock: true,
      requiresPrescription: true,
    },
    {
      id: 'prod-2',
      genericName: 'Amoxicilina',
      brandName: null,
      presentation: '500 mg cápsulas',
      therapeuticGroup: 'Antibióticos',
      price: '32.00',
      currency: 'BOB',
      inStock: false,
      requiresPrescription: true,
    },
    {
      id: 'prod-3',
      genericName: 'Paracetamol',
      brandName: 'Paracetamol Inti',
      presentation: '500 mg comprimidos',
      therapeuticGroup: null,
      price: '8.00',
      currency: 'BOB',
      inStock: true,
      requiresPrescription: false,
    },
    {
      id: 'prod-4',
      genericName: 'Ibuprofeno',
      brandName: 'Ibuprofeno Inti',
      presentation: '400 mg comprimidos',
      therapeuticGroup: 'Analgésicos',
      price: '12.00',
      currency: 'BOB',
      inStock: true,
      requiresPrescription: false,
    },
    {
      id: 'prod-5',
      genericName: 'Metformina',
      brandName: 'Metformina Bagó',
      presentation: '850 mg comprimidos',
      therapeuticGroup: 'Antidiabéticos',
      price: '21.00',
      currency: 'BOB',
      inStock: true,
      requiresPrescription: true,
    },
    {
      id: 'prod-6',
      genericName: 'Salbutamol',
      brandName: 'Salbutamol Inti',
      presentation: 'inhalador 100 mcg',
      therapeuticGroup: 'Respiratorio',
      price: '45.00',
      currency: 'BOB',
      inStock: false,
      requiresPrescription: true,
    },
    {
      id: 'prod-7',
      genericName: 'Loratadina',
      brandName: null,
      presentation: 'jarabe 120 ml',
      therapeuticGroup: 'Antialérgicos',
      price: '15.00',
      currency: 'BOB',
      inStock: true,
      requiresPrescription: false,
    },
  ],
  nextCursor: null,
  totalHint: 7,
  generatedAt: '2026-09-11T12:00:00.000Z',
};

/**
 * Las tres sucursales de la cadena. La que se está mirando primero, como las
 * sirve el simulador.
 */
const SUCURSALES = {
  items: [
    {
      id: 'sede-centro',
      slug: SLUG,
      name: 'Farmacia Vida · Centro',
      siteName: 'Centro',
      city: 'Santa Cruz de la Sierra',
      addressText: 'Av. Alemana N.º 2100',
      phone: null,
      openingHours: 'Lun a Sáb 08:00–22:00',
      description: null,
      locationUrl: null,
      location: { lat: -17.76, lng: -63.16 },
      locationAccuracy: 'Ubicación exacta',
      isCurrent: true,
    },
    {
      id: 'sede-norte',
      slug: 'farmacia-vida-norte',
      name: 'Farmacia Vida · Norte',
      siteName: 'Norte',
      city: 'Santa Cruz de la Sierra',
      addressText: 'Av. Banzer N.º 900',
      phone: '+591 3 3456789',
      openingHours: null,
      description: null,
      locationUrl: null,
      // Más lejos del origen de la prueba que la del centro.
      location: { lat: -17.71, lng: -63.16 },
      locationAccuracy: 'Ubicación aproximada · centro de la ciudad',
      isCurrent: false,
    },
    {
      id: 'sede-sur',
      slug: 'farmacia-vida-sur',
      name: 'Farmacia Vida · Sur',
      siteName: 'Sur',
      city: 'Santa Cruz de la Sierra',
      addressText: 'Av. Santos Dumont N.º 400',
      phone: null,
      openingHours: null,
      description: null,
      locationUrl: null,
      location: { lat: -17.8, lng: -63.16 },
      locationAccuracy: 'Ubicación exacta',
      isCurrent: false,
    },
  ],
  nextCursor: null,
  totalHint: 3,
  generatedAt: '2026-09-11T12:00:00.000Z',
};

/** Lo que devuelve la búsqueda de una receta, ya ordenado por el servidor. */
const DISPONIBILIDAD = {
  items: [
    {
      branch: SUCURSALES.items[1],
      matches: [
        {
          term: 'Paracetamol',
          genericName: 'Paracetamol',
          brandName: 'Paracetamol Inti',
          presentation: '500 mg comprimidos',
          price: '8.00',
          currency: 'BOB',
        },
      ],
      missing: [],
      complete: true,
      totalAmount: '8.00',
      currency: 'BOB',
      distanceKm: 1.2,
    },
    {
      branch: SUCURSALES.items[0],
      matches: [],
      missing: ['Paracetamol'],
      complete: false,
      totalAmount: null,
      currency: null,
      distanceKm: 0.4,
    },
  ],
  count: 2,
  generatedAt: '2026-09-11T12:00:00.000Z',
};

/** Los siete, ordenados como los ordena la rejilla. */
const TODOS = [
  'Amoxicilina',
  'Ibuprofeno',
  'Loratadina',
  'Losartán',
  'Metformina',
  'Paracetamol',
  'Salbutamol',
];

describe('PharmacyDetail', () => {
  let fixture: ComponentFixture<PharmacyDetail>;
  let http: HttpTestingController;

  function montar(slug: string | null = SLUG, tab: string | null = null): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        // Leaflet no entra a la suite: jsdom no da layout y el chunk dinámico
        // es justo lo que no queremos descargar acá. Con un cargador que no
        // resuelve, el organismo se queda en su estado de espera, que es lo
        // único que esta ficha necesita comprobar — el contrato del mapa lo
        // fija `map.spec.ts` con su propio doble.
        { provide: CARGADOR_DE_LEAFLET, useValue: () => new Promise<never>(() => undefined) },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ slug: slug ?? '' })),
            queryParamMap: of(convertToParamMap(tab === null ? {} : { tab })),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PharmacyDetail);
    fixture.detectChanges();
  }

  function responder(sucursales: unknown = SUCURSALES, catalogo: unknown = CATALOGO): void {
    http.expectOne(`/public/profiles/f/${SLUG}`).flush(PERFIL);
    http.expectOne((pedido) => pedido.url === `/public/profiles/f/${SLUG}/products`).flush(
      catalogo as object,
    );
    http.expectOne((pedido) => pedido.url === `/public/profiles/f/${SLUG}/branches`).flush(
      sucursales as object,
    );
    fixture.detectChanges();
  }

  /** Los genéricos que la rejilla está mostrando, en su orden. */
  function nombresVisibles(): readonly string[] {
    return [
      ...(fixture.nativeElement.querySelectorAll(
        '[data-testid="pharmacy-product"] .rejilla__nombre',
      ) as NodeListOf<HTMLElement>),
    ].map((nombre) => (nombre.textContent ?? '').trim());
  }

  /** Teclea en el buscador de la sección. */
  function buscar(termino: string): void {
    const campo = fixture.nativeElement.querySelector(
      '.ficha-publica__buscador input',
    ) as HTMLInputElement | null;
    expect(campo).not.toBeNull();
    campo!.value = termino;
    campo!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Toca un chip de filtro por su texto. */
  function tocarChip(etiqueta: string): void {
    const chip = [
      ...(fixture.nativeElement.querySelectorAll(
        '.ficha-publica__filtros app-chip',
      ) as NodeListOf<HTMLElement>),
    ].find((candidato) => (candidato.textContent ?? '').trim() === etiqueta);
    expect(chip).toBeDefined();
    chip?.click();
    fixture.detectChanges();
  }

  function limpiar(): void {
    const boton = [
      ...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>),
    ].find((candidato) => (candidato.textContent ?? '').includes('Limpiar filtros'));
    expect(boton).toBeDefined();
    boton?.click();
    fixture.detectChanges();
  }

  /** Los rótulos de las pestañas, en el orden en que se dibujan. */
  function rotulosDeLasPestanas(): readonly string[] {
    return [
      ...(fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>),
    ].map((pestana) => (pestana.textContent ?? '').trim());
  }

  /**
   * Toca una pestaña por su rótulo. El router se sustituye por un doble que
   * sólo anota la navegación: lo que se prueba acá es qué pestaña queda abierta
   * y qué se escribe en la URL, no el enrutado.
   */
  function abrirPestana(rotulo: string): ReturnType<typeof vi.spyOn> {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const pestana = [
      ...(fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>),
    ].find((candidata) => (candidata.textContent ?? '').trim().startsWith(rotulo));
    expect(pestana).toBeDefined();
    pestana?.click();
    fixture.detectChanges();
    return navegar;
  }

  function abrirSucursales(): ReturnType<typeof vi.spyOn> {
    return abrirPestana('Sucursales y receta');
  }

  /** Los nombres de las sucursales, en el orden en que se dibujan. */
  function sucursalesVisibles(): readonly string[] {
    return [
      ...(fixture.nativeElement.querySelectorAll(
        '[data-testid="pharmacy-branch"] .rejilla__nombre',
      ) as NodeListOf<HTMLElement>),
    ].map((nombre) => (nombre.textContent ?? '').trim());
  }

  /**
   * Hace que el navegador conteste con un punto. jsdom no trae `geolocation`,
   * así que se lo pone la prueba — es la única forma de ejercitar el camino.
   */
  function conUbicacion(lat: number, lng: number): void {
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: lat, longitude: lng } } as GeolocationPosition),
      },
    });
    tocarBoton('Usar mi ubicación');
  }

  function tocarBoton(texto: string): void {
    const boton = [
      ...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>),
    ].find((candidato) => (candidato.textContent ?? '').includes(texto));
    expect(boton).toBeDefined();
    boton?.click();
    fixture.detectChanges();
  }

  /** Escribe la receta en el área de texto de la sección. */
  function escribirReceta(texto: string): void {
    const campo = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  afterEach(() => http?.verify());

  it('muestra la farmacia y sus medicamentos con precio', () => {
    montar();
    responder();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Farmacia Vida');
    expect(texto).toContain('Losartán');
    expect(texto).toContain('Losartán Bagó · 50 mg comprimidos');
    expect(texto).toContain('18,50 Bs');
  });

  it('pone el grupo terapéutico DENTRO de la tarjeta y no como encabezado de tramo', () => {
    montar();
    responder();

    // Los tramos con su `<h3>` encima ya no existen: el catálogo es una sola
    // rejilla y el grupo viaja en la tarjeta del medicamento que lo declara.
    expect(fixture.nativeElement.querySelectorAll('.ficha-publica__grupo').length).toBe(0);

    const chips = [
      ...(fixture.nativeElement.querySelectorAll(
        '[data-testid="pharmacy-product"] .ficha-publica__grupo-chip',
      ) as NodeListOf<HTMLElement>),
    ].map((chip) => (chip.textContent ?? '').trim());
    // Paracetamol no declara grupo: no lleva chip, y tampoco uno que diga que
    // le falta. Los demás, en el orden de la rejilla.
    expect(chips).toEqual([
      'Antibióticos',
      'Analgésicos',
      'Antialérgicos',
      'Cardiovascular',
      'Antidiabéticos',
      'Respiratorio',
    ]);
  });

  // El propietario pidió sacar los mapas de todo el directorio (23/10/2026):
  // la ficha dice la dirección escrita y nada más.
  it('no dibuja mapa: la dirección va escrita', () => {
    montar();
    responder();

    expect(fixture.nativeElement.querySelector('app-map')).toBeNull();
  });

  it('el buscador acota por genérico, marca, presentación y grupo', () => {
    montar();
    responder();

    buscar('inti');
    expect(nombresVisibles()).toEqual(['Ibuprofeno', 'Paracetamol', 'Salbutamol']);

    buscar('cápsulas');
    expect(nombresVisibles()).toEqual(['Amoxicilina']);

    buscar('antibio');
    expect(nombresVisibles()).toEqual(['Amoxicilina']);
  });

  it('los chips de grupo se suman entre sí y se apagan al volver a tocarlos', () => {
    montar();
    responder();

    tocarChip('Cardiovascular');
    expect(nombresVisibles()).toEqual(['Losartán']);

    tocarChip('Antibióticos');
    expect(nombresVisibles()).toEqual(['Amoxicilina', 'Losartán']);

    tocarChip('Cardiovascular');
    expect(nombresVisibles()).toEqual(['Amoxicilina']);
  });

  it('«Con stock» y «Sin receta» se combinan con el resto', () => {
    montar();
    responder();

    tocarChip('Con stock');
    expect(nombresVisibles()).toEqual([
      'Ibuprofeno',
      'Loratadina',
      'Losartán',
      'Metformina',
      'Paracetamol',
    ]);

    tocarChip('Sin receta');
    expect(nombresVisibles()).toEqual(['Ibuprofeno', 'Loratadina', 'Paracetamol']);
  });

  it('cuando no queda ninguno lo dice con el término, y «Limpiar filtros» devuelve el catálogo', () => {
    montar();
    responder();

    buscar('omeprazol');
    expect(nombresVisibles()).toEqual([]);
    expect(fixture.nativeElement.textContent as string).toContain('«omeprazol»');

    limpiar();
    expect(nombresVisibles()).toEqual(TODOS);
  });

  it('lista todas las sucursales de la cadena, con la que se mira rotulada', () => {
    montar();
    responder();
    abrirSucursales();

    expect(sucursalesVisibles()).toEqual(['Centro', 'Norte', 'Sur']);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Está viendo ésta');
    expect(texto).toContain('Av. Banzer N.º 900 · Santa Cruz de la Sierra');
    // La que se está mirando no enlaza a sí misma; las otras sí.
    const enlaces = fixture.nativeElement.querySelectorAll(
      'a[data-testid="pharmacy-branch"]',
    ) as NodeListOf<HTMLAnchorElement>;
    expect(enlaces.length).toBe(2);
  });

  it('con la ubicación, ordena por cercanía y señala la más cercana', () => {
    montar();
    responder();
    abrirSucursales();

    // Un punto al sur: la sucursal Sur queda primera y la Norte última.
    conUbicacion(-17.8, -63.16);

    expect(sucursalesVisibles()).toEqual(['Sur', 'Centro', 'Norte']);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('La más cercana');
    expect(texto).toContain('en línea recta');
    // El punto aproximado se rotula; el exacto no lleva renglón que sobre.
    expect(texto).toContain('Ubicación aproximada · centro de la ciudad');
  });

  it('dos sedes del mismo tenant comparten slug: se ven las dos y el distintivo va a una sola', () => {
    // Así las sirve la API (#497): la ficha es del tenant, así que sus sedes
    // comparten slug. Con el slug como clave, el distintivo caía en las dos.
    const [centro, norte, sur] = SUCURSALES.items;
    montar();
    responder({
      ...SUCURSALES,
      items: [centro, norte, { ...sur, id: 'sede-sur-2', slug: norte.slug }],
    });
    abrirSucursales();

    conUbicacion(-17.8, -63.16);

    expect(sucursalesVisibles()).toEqual(['Sur', 'Centro', 'Norte']);
    const distintivos = [
      ...(fixture.nativeElement.querySelectorAll('app-badge') as NodeListOf<HTMLElement>),
    ].filter((badge) => (badge.textContent ?? '').includes('La más cercana'));
    expect(distintivos.length).toBe(1);
  });

  it('dice que no pudo leer la ubicación sin llevarse puesta la sección', () => {
    montar();
    responder();
    abrirSucursales();

    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });
    tocarBoton('Usar mi ubicación');

    expect(fixture.nativeElement.textContent as string).toContain(
      'No pudimos leer su ubicación',
    );
    // Las sucursales siguen ahí, con su dirección.
    expect(sucursalesVisibles()).toEqual(['Centro', 'Norte', 'Sur']);
  });

  it('busca la receta entre las sucursales y recomienda la primera que trae el servidor', () => {
    montar();
    responder();
    abrirSucursales();

    escribirReceta('Paracetamol');
    tocarBoton('Buscar en las sucursales');

    const pedido = http.expectOne(
      (peticion) => peticion.url === `/public/profiles/f/${SLUG}/branch-availability`,
    );
    // La receta viaja en el cuerpo de un POST, nunca en la URL (P37, D-2).
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.params.keys()).toEqual([]);
    expect(pedido.request.urlWithParams).not.toContain('Paracetamol');
    expect(pedido.request.body).toEqual({ items: ['Paracetamol'] });
    pedido.flush(DISPONIBILIDAD);
    fixture.detectChanges();

    const recomendada = fixture.nativeElement.querySelector(
      '[data-testid="pharmacy-recommended"]',
    ) as HTMLElement | null;
    expect(recomendada).not.toBeNull();
    // La recomendada es la que el servidor puso primera, no la más barata ni
    // la que se está mirando.
    expect(recomendada?.textContent).toContain('Norte');
    expect(recomendada?.textContent).toContain('tiene todo lo de su receta');

    const filas = fixture.nativeElement.querySelectorAll(
      '[data-testid="pharmacy-availability-row"]',
    );
    expect(filas.length).toBe(2);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Tiene todo');
    expect(texto).toContain('No tiene: Paracetamol');
    // El dato viaja como `BOB` y la pantalla lo escribe «Bs» desde el pedido
    // del 19/09/2026 (ver `core/money/display-currency.ts`). Se exige el
    // rótulo visible y se prohíbe el código, que es lo que se pidió sacar.
    expect(texto).toContain('8,00 Bs');
    expect(texto).not.toContain('BOB');
  });

  it('manda la ubicación con la búsqueda cuando ya la tiene', () => {
    montar();
    responder();
    abrirSucursales();

    conUbicacion(-17.8, -63.16);
    escribirReceta('Paracetamol, Losartán');
    tocarBoton('Buscar en las sucursales');

    const pedido = http.expectOne(
      (peticion) => peticion.url === `/public/profiles/f/${SLUG}/branch-availability`,
    );
    // Cada renglón es un elemento del arreglo (una receta trae comas
    // adentro), y el punto viaja en el mismo cuerpo.
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({
      items: ['Paracetamol', 'Losartán'],
      lat: -17.8,
      lng: -63.16,
    });
    expect(pedido.request.params.keys()).toEqual([]);
    pedido.flush(DISPONIBILIDAD);
  });

  it('sin receta escrita no busca nada', () => {
    montar();
    responder();
    abrirSucursales();

    const boton = [
      ...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>),
    ].find((candidato) => (candidato.textContent ?? '').includes('Buscar en las sucursales'));
    expect(boton?.getAttribute('aria-disabled')).toBe('true');
    boton?.click();
    fixture.detectChanges();
    // `http.verify()` del `afterEach` falla si salió una petición de más.
  });

  it('conserva la ficha y el catálogo cuando las sucursales fallan', () => {
    montar();
    http.expectOne(`/public/profiles/f/${SLUG}`).flush(PERFIL);
    http.expectOne((pedido) => pedido.url === `/public/profiles/f/${SLUG}/products`).flush(
      CATALOGO,
    );
    http
      .expectOne((pedido) => pedido.url === `/public/profiles/f/${SLUG}/branches`)
      .flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Farmacia Vida');
    expect(nombresVisibles()).toEqual(TODOS);
  });

  it('rotula lo agotado y lo que exige receta, y sólo eso', () => {
    montar();
    responder();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Sin stock');
    expect(texto).toContain('Con receta');
    // Lo normal no se rotula: si todo lleva distintivo, ninguno distingue.
    expect(texto).not.toContain('En stock');
    expect(texto).not.toContain('Venta libre');
  });

  it('no ofrece editar el precio: el catálogo es de la farmacia', () => {
    montar();
    responder();

    // Se mira DENTRO de las tarjetas: fuera de ellas sí hay controles —el
    // buscador y los chips—, y ninguno toca el catálogo. El único botón de la
    // tarjeta es «Consultar por chat», que no edita nada: lleva al chat.
    const controles = fixture.nativeElement.querySelectorAll(
      '[data-testid="pharmacy-product"] button:not([data-testid="consultar-producto-por-chat"]), [data-testid="pharmacy-product"] input',
    );
    expect(controles.length).toBe(0);
    expect(fixture.nativeElement.textContent as string).not.toContain('Editar precio');
  });

  /** La vuelta al chat que guardó el paso por el login (la prueba no tiene sesión). */
  function vueltaAlChat(navegar: ReturnType<typeof vi.spyOn>): ParamMap {
    expect(navegar).toHaveBeenCalledOnce();
    const [, extras] = navegar.mock.calls[0] as [string[], { queryParams: { returnUrl: string } }];
    const router = TestBed.inject(Router);
    return router.parseUrl(extras.queryParams.returnUrl).queryParamMap;
  }

  it('«Consultar por chat» sobre un medicamento manda UNA tarjeta: la del producto', () => {
    montar();
    responder();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const boton = fixture.nativeElement.querySelector(
      '[data-testid="consultar-producto-por-chat"]',
    ) as HTMLElement;
    boton.click();

    const vuelta = vueltaAlChat(navegar);
    expect(vuelta.get('escribirA')).toBe(SLUG);
    // El contexto no viaja en la URL (H1): se deja en la pestaña bajo un
    // nonce de un solo uso, y la URL lleva sólo `ctx=<nonce>`.
    expect(vuelta.has('sobre')).toBe(false);
    expect(vuelta.has('titulo')).toBe(false);
    expect(vuelta.getAll('ctx')).toHaveLength(1);
    // Un solo contexto guardado, y es el del producto: la farmacia va en el
    // renglón de detalle, no como una segunda tarjeta.
    const contexto = tomarContexto(vuelta.get('ctx'), destinoDeLaQuery(vuelta)!, sessionStorage);
    expect(contexto?.tipo).toBe('producto');
    expect(contexto?.titulo).not.toBe('Farmacia Vida');
    expect(contexto?.detalle).toContain('Farmacia Vida');
  });

  it('«Chatear con la farmacia» manda UNA tarjeta: la de la farmacia', () => {
    montar();
    responder();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    (fixture.nativeElement.querySelector('[data-testid="chatear-con-la-farmacia"]') as HTMLElement).click();

    const vuelta = vueltaAlChat(navegar);
    // El contexto no viaja en la URL (H1): se deja en la pestaña bajo un
    // nonce de un solo uso, y la URL lleva sólo `ctx=<nonce>`.
    expect(vuelta.has('sobre')).toBe(false);
    const contexto = tomarContexto(vuelta.get('ctx'), destinoDeLaQuery(vuelta)!, sessionStorage);
    expect(contexto?.tipo).toBe('farmacia');
    expect(contexto?.titulo).toBe('Farmacia Vida');
  });

  it('conserva la ficha cuando el catálogo falla', () => {
    montar();
    http.expectOne(`/public/profiles/f/${SLUG}`).flush(PERFIL);
    http
      .expectOne((pedido) => pedido.url === `/public/profiles/f/${SLUG}/products`)
      .flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    http.expectOne((pedido) => pedido.url === `/public/profiles/f/${SLUG}/branches`).flush(
      SUCURSALES,
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string).toContain('Farmacia Vida');
  });

  it('con la forma de la API real (todas comparten la ficha) no enlaza a la misma página y muestra descripción y mapa', () => {
    montar();
    responder({
      ...SUCURSALES,
      items: [
        {
          ...SUCURSALES.items[1],
          slug: SLUG,
          isCurrent: false,
          description: 'Lun a Dom 24 horas',
          locationUrl: 'https://maps.example/norte',
        },
        { ...SUCURSALES.items[2], slug: SLUG, isCurrent: false },
      ],
    });
    abrirSucursales();

    const lista = fixture.nativeElement.querySelector(
      '[data-testid="pharmacy-branches"]',
    ) as HTMLElement;
    // Ninguna tarjeta es un enlace interno: llevarían a la ficha que ya se mira.
    expect(lista.querySelectorAll('a[href^="/"]').length).toBe(0);
    expect(lista.querySelectorAll('article[data-testid="pharmacy-branch"]').length).toBe(2);
    // Y ninguna dice «Está viendo ésta»: con varias, no hay una que sea la ficha.
    expect(lista.textContent).not.toContain('Está viendo ésta');
    expect(
      lista.querySelector('[data-testid="pharmacy-branch-description"]')?.textContent,
    ).toContain('Lun a Dom 24 horas');
    const mapa = lista.querySelector(
      '[data-testid="pharmacy-branch-map-link"]',
    ) as HTMLAnchorElement | null;
    expect(mapa?.getAttribute('href')).toBe('https://maps.example/norte');
    expect(mapa?.getAttribute('target')).toBe('_blank');
    expect(mapa?.getAttribute('rel')).toContain('noopener');
    expect(mapa?.getAttribute('aria-label')).toBe(
      'Cómo llegar a Norte (abre el mapa en otra pestaña)',
    );
  });

  it('una farmacia sin sucursales publicadas dice por qué y qué hacer, no se queda muda', () => {
    montar();
    responder({ items: [], nextCursor: null, totalHint: 0, generatedAt: '2026-10-26T00:00:00.000Z' });
    abrirSucursales();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Esta farmacia todavía no publicó sus sucursales');
    expect(texto).toContain('Ver otras farmacias');
    // El catálogo sigue ahí, en su pestaña.
    abrirPestana('Medicamentos');
    expect(nombresVisibles()).toEqual(TODOS);
  });

  /* ==========================================================================
      Una tarjeta con pestañas (composition-rules.md §5).
      ========================================================================== */

  it('la ficha es UNA tarjeta con dos pestañas, con la cuenta de medicamentos en la primera', () => {
    montar();
    responder();

    const tarjetas = fixture.nativeElement.querySelectorAll('app-card') as NodeListOf<HTMLElement>;
    expect(tarjetas.length).toBe(1);
    expect(tarjetas[0].getAttribute('data-testid')).toBe('pharmacy-card');
    expect(fixture.nativeElement.querySelectorAll('app-tabs').length).toBe(1);
    expect(rotulosDeLasPestanas()).toEqual(['Medicamentos (7)', 'Sucursales y receta']);
    // El resumen de la farmacia está dentro de la misma tarjeta, no en otra.
    expect(tarjetas[0].textContent).toContain('Av. Alemana N.º 2100');
    expect(tarjetas[0].textContent).toContain('Genéricos y de marca, entrega en menos de una hora.');
  });

  it('abre Medicamentos y sólo ese panel existe: las sucursales no se dibujan hasta abrir la suya', () => {
    montar();
    responder();

    expect(fixture.nativeElement.querySelector('#medicamentos')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="pharmacy-branches"]')).toBeNull();

    abrirSucursales();

    expect(fixture.nativeElement.querySelector('[data-testid="pharmacy-branches"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="pharmacy-products"]')).toBeNull();
  });

  it('la pestaña abierta se escribe en la URL, sólo con `tab`', () => {
    montar();
    responder();

    const navegar = abrirSucursales();

    expect(navegar).toHaveBeenCalledOnce();
    const [destino, extras] = navegar.mock.calls[0] as [
      unknown[],
      { queryParams: Record<string, string>; replaceUrl: boolean },
    ];
    expect(destino).toEqual([]);
    expect(extras.queryParams).toEqual({ tab: 'sucursales' });
    expect(extras.replaceUrl).toBe(true);
  });

  it('`?tab=sucursales` abre las sucursales y no dibuja el catálogo', () => {
    montar(SLUG, 'sucursales');
    responder();

    expect(sucursalesVisibles()).toEqual(['Centro', 'Norte', 'Sur']);
    expect(nombresVisibles()).toEqual([]);
  });

  it('un `?tab=` desconocido abre Medicamentos', () => {
    montar(SLUG, 'inexistente');
    responder();

    expect(nombresVisibles()).toEqual(TODOS);
    expect(sucursalesVisibles()).toEqual([]);
  });

  it('volver a Medicamentos conserva el buscador, los filtros y lo que se escribió en la receta', () => {
    montar();
    responder();

    buscar('inti');
    tocarChip('Sin receta');
    expect(nombresVisibles()).toEqual(['Ibuprofeno', 'Paracetamol']);

    abrirSucursales();
    escribirReceta('Paracetamol');
    abrirPestana('Medicamentos');

    // El panel se vuelve a dibujar, pero el estado vive en el componente.
    expect(nombresVisibles()).toEqual(['Ibuprofeno', 'Paracetamol']);
    expect(
      (fixture.nativeElement.querySelector('.ficha-publica__buscador input') as HTMLInputElement).value,
    ).toBe('inti');

    abrirSucursales();
    expect((fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
      'Paracetamol',
    );
  });

  it('las sucursales que fallan no se llevan puesto el catálogo y su pestaña no dibuja la lista', () => {
    montar();
    http.expectOne(`/public/profiles/f/${SLUG}`).flush(PERFIL);
    http.expectOne((pedido) => pedido.url === `/public/profiles/f/${SLUG}/products`).flush(
      CATALOGO,
    );
    http
      .expectOne((pedido) => pedido.url === `/public/profiles/f/${SLUG}/branches`)
      .flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    abrirSucursales();

    expect(fixture.nativeElement.querySelector('[data-testid="pharmacy-branches"]')).toBeNull();
    // La búsqueda de la receta sigue disponible: no depende de la lista.
    expect(fixture.nativeElement.querySelector('textarea')).not.toBeNull();
  });

  /* ==========================================================================
      Estados: vacío que orienta, error que se puede reintentar.
      ========================================================================== */

  it('un catálogo vacío dice por qué y ofrece consultar por chat o ver otras farmacias', () => {
    montar();
    responder(SUCURSALES, { items: [], nextCursor: null, totalHint: 0, generatedAt: CATALOGO.generatedAt });

    const vacio = fixture.nativeElement.querySelector('[data-testid="catalogo-vacio"]') as HTMLElement | null;
    expect(vacio).not.toBeNull();
    expect(vacio?.textContent).toContain('Esta farmacia todavía no publicó su catálogo de medicamentos.');
    expect(vacio?.querySelector('[data-testid="catalogo-vacio-chatear"]')).not.toBeNull();
    const enlace = [...(vacio?.querySelectorAll('a') ?? [])].find((a) =>
      (a.textContent ?? '').includes('Ver otras farmacias'),
    );
    expect(enlace?.getAttribute('href')).toBe('/pharmacies-directory');
    // Sin catálogo no hay nada que filtrar: ni buscador ni chips.
    expect(fixture.nativeElement.querySelector('.ficha-publica__filtros')).toBeNull();
  });

  it('cuando la búsqueda de la receta falla lo dice y «Reintentar» la vuelve a pedir', () => {
    montar();
    responder();
    abrirSucursales();

    escribirReceta('Paracetamol');
    tocarBoton('Buscar en las sucursales');
    http
      .expectOne((peticion) => peticion.url === `/public/profiles/f/${SLUG}/branch-availability`)
      .flush({ code: 'INTERNAL' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string).toContain('No pudimos consultar las sucursales');
    // Lo escrito no se pierde.
    expect((fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Paracetamol');

    (fixture.nativeElement.querySelector('[data-testid="receta-reintentar"]') as HTMLElement).click();
    const reintento = http.expectOne(
      (peticion) => peticion.url === `/public/profiles/f/${SLUG}/branch-availability`,
    );
    expect(reintento.request.body).toEqual({ items: ['Paracetamol'] });
    reintento.flush(DISPONIBILIDAD);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="receta-reintentar"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="pharmacy-recommended"]')).not.toBeNull();
  });

  it('una receta que ninguna sucursal tiene lo dice y no deja la pantalla muda', () => {
    montar();
    responder();
    abrirSucursales();

    escribirReceta('Omeprazol');
    tocarBoton('Buscar en las sucursales');
    http
      .expectOne((peticion) => peticion.url === `/public/profiles/f/${SLUG}/branch-availability`)
      .flush({ items: [], count: 0, generatedAt: DISPONIBILIDAD.generatedAt });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="receta-sin-resultados"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="pharmacy-recommended"]')).toBeNull();
  });

  it('una ficha que no existe (404) lo dice dentro de la tarjeta y no rompe las pestañas', () => {
    montar();
    http
      .expectOne(`/public/profiles/f/${SLUG}`)
      .flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    http
      .expectOne((pedido) => pedido.url === `/public/profiles/f/${SLUG}/products`)
      .flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    http
      .expectOne((pedido) => pedido.url === `/public/profiles/f/${SLUG}/branches`)
      .flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('app-card').length).toBe(1);
    expect(fixture.nativeElement.querySelector('[data-testid="chatear-con-la-farmacia"]')).toBeNull();
    expect(rotulosDeLasPestanas()).toEqual(['Medicamentos', 'Sucursales y receta']);
  });

  it('no llama a la API cuando la ruta no trae slug', () => {
    montar(null);
    http.verify();
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CARGADOR_DE_LEAFLET } from '@shared/components/organisms/map/map';

import { PharmacyDetail } from './pharmacy-detail';

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
      slug: SLUG,
      name: 'Farmacia Vida · Centro',
      siteName: 'Centro',
      city: 'Santa Cruz de la Sierra',
      addressText: 'Av. Alemana N.º 2100',
      phone: null,
      openingHours: 'Lun a Sáb 08:00–22:00',
      location: { lat: -17.76, lng: -63.16 },
      locationAccuracy: 'Ubicación exacta',
      isCurrent: true,
    },
    {
      slug: 'farmacia-vida-norte',
      name: 'Farmacia Vida · Norte',
      siteName: 'Norte',
      city: 'Santa Cruz de la Sierra',
      addressText: 'Av. Banzer N.º 900',
      phone: '+591 3 3456789',
      openingHours: null,
      // Más lejos del origen de la prueba que la del centro.
      location: { lat: -17.71, lng: -63.16 },
      locationAccuracy: 'Ubicación aproximada · centro de la ciudad',
      isCurrent: false,
    },
    {
      slug: 'farmacia-vida-sur',
      name: 'Farmacia Vida · Sur',
      siteName: 'Sur',
      city: 'Santa Cruz de la Sierra',
      addressText: 'Av. Santos Dumont N.º 400',
      phone: null,
      openingHours: null,
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

  function montar(slug: string | null = SLUG): void {
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
          useValue: { paramMap: of(convertToParamMap({ slug: slug ?? '' })) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PharmacyDetail);
    fixture.detectChanges();
  }

  function responder(): void {
    http.expectOne(`/public/profiles/f/${SLUG}`).flush(PERFIL);
    http.expectOne((pedido) => pedido.url === `/public/profiles/f/${SLUG}/products`).flush(
      CATALOGO,
    );
    http.expectOne((pedido) => pedido.url === `/public/profiles/f/${SLUG}/branches`).flush(
      SUCURSALES,
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
    expect(texto).toContain('18,50 BOB');
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

  it('dibuja la farmacia en el mapa, con el nombre de su ficha', () => {
    montar();
    responder();

    const mapa = fixture.nativeElement.querySelector('app-map .mapa') as HTMLElement | null;
    expect(mapa).not.toBeNull();
    expect(mapa?.getAttribute('aria-label')).toContain('Farmacia Vida');
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

    expect(sucursalesVisibles()).toEqual(['Centro', 'Norte', 'Sur']);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Estás viendo ésta');
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

    // Un punto al sur: la sucursal Sur queda primera y la Norte última.
    conUbicacion(-17.8, -63.16);

    expect(sucursalesVisibles()).toEqual(['Sur', 'Centro', 'Norte']);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('La más cercana');
    expect(texto).toContain('en línea recta');
    // El punto aproximado se rotula; el exacto no lleva renglón que sobre.
    expect(texto).toContain('Ubicación aproximada · centro de la ciudad');
  });

  it('dice que no pudo leer la ubicación sin llevarse puesta la sección', () => {
    montar();
    responder();

    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });
    tocarBoton('Usar mi ubicación');

    expect(fixture.nativeElement.textContent as string).toContain(
      'No pudimos leer tu ubicación',
    );
    // Las sucursales siguen ahí, con su dirección.
    expect(sucursalesVisibles()).toEqual(['Centro', 'Norte', 'Sur']);
  });

  it('busca la receta entre las sucursales y recomienda la primera que trae el servidor', () => {
    montar();
    responder();

    escribirReceta('Paracetamol');
    tocarBoton('Buscar en las sucursales');

    const pedido = http.expectOne(
      (peticion) => peticion.url === `/public/profiles/f/${SLUG}/branch-availability`,
    );
    expect(pedido.request.params.get('items')).toBe('Paracetamol');
    pedido.flush(DISPONIBILIDAD);
    fixture.detectChanges();

    const recomendada = fixture.nativeElement.querySelector(
      '[data-testid="pharmacy-recommended"]',
    ) as HTMLElement | null;
    expect(recomendada).not.toBeNull();
    // La recomendada es la que el servidor puso primera, no la más barata ni
    // la que se está mirando.
    expect(recomendada?.textContent).toContain('Norte');
    expect(recomendada?.textContent).toContain('tiene todo lo de tu receta');

    const filas = fixture.nativeElement.querySelectorAll(
      '[data-testid="pharmacy-availability-row"]',
    );
    expect(filas.length).toBe(2);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Tiene todo');
    expect(texto).toContain('No tiene: Paracetamol');
    expect(texto).toContain('8,00 BOB');
  });

  it('manda la ubicación con la búsqueda cuando ya la tiene', () => {
    montar();
    responder();

    conUbicacion(-17.8, -63.16);
    escribirReceta('Paracetamol, Losartán');
    tocarBoton('Buscar en las sucursales');

    const pedido = http.expectOne(
      (peticion) => peticion.url === `/public/profiles/f/${SLUG}/branch-availability`,
    );
    // Los renglones viajan separados por `|`: una receta trae comas adentro.
    expect(pedido.request.params.get('items')).toBe('Paracetamol|Losartán');
    expect(pedido.request.params.get('lat')).toBe('-17.8');
    expect(pedido.request.params.get('lng')).toBe('-63.16');
    pedido.flush(DISPONIBILIDAD);
  });

  it('sin receta escrita no busca nada', () => {
    montar();
    responder();

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
    // buscador y los chips—, y ninguno toca el catálogo.
    const controles = fixture.nativeElement.querySelectorAll(
      '[data-testid="pharmacy-product"] button, [data-testid="pharmacy-product"] input',
    );
    expect(controles.length).toBe(0);
    expect(fixture.nativeElement.textContent as string).not.toContain('Editar precio');
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

  it('no llama a la API cuando la ruta no trae slug', () => {
    montar(null);
    http.verify();
  });
});

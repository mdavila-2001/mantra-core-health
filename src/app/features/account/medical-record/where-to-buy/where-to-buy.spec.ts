import { readFileSync } from 'node:fs';

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import {
  DISPONIBILIDAD_FIXTURE,
  FIXTURE_IDS,
  productosDelConcepto,
} from '../../../../core/data-access/pharmacy/pharmacy.fixtures';
import type {
  AvailabilityResult,
  AvailabilitySite,
} from '../../../../core/data-access/pharmacy/pharmacy.types';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import { SessionStore } from '../../../../core/auth/session.store';
import { CARGADOR_DE_LEAFLET } from '../../../../shared/components/organisms/map/map';
import type { CargadorDeLeaflet } from '../../../../shared/components/organisms/map/map';
import {
  borradorDePedido,
  coberturaConSeguro,
  ordenarSedes,
  WhereToBuy,
  type ItemDeReceta,
} from './where-to-buy';
import { aprobadosPorElSeguroDeEjemplo } from './where-to-buy.fixtures';

/**
 * Dónde comprar mi receta (carril E3).
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **El recorrido de datos entero con el contrato E2**: resumen propio →
 *    etiquetas → un producto por medicamento → disponibilidad, sin
 *    coordenadas hasta que alguien las dé.
 * 2. **La ubicación se pide, no se toma**: la API de geolocalización no se
 *    toca al entrar; sólo la dispara el botón, y con ella la consulta lleva
 *    `lat` y `lng`.
 * 3. **Ningún uuid llega a la pantalla**: sedes, faltantes y renglones se
 *    nombran por su etiqueta.
 * 4. **El camino real del pedido (FAR-I2)**: el CTA arma el borrador completo
 *    y navega a confirmarlo, sin depender de `demoPresets`.
 * 5. **El CSS del componente usa solo tokens declarados**: cada `var(--…)`
 *    existe en `src/styles.css` y no hay colores a mano — la misma frontera
 *    de deriva que fija `design-tokens.types.spec.ts`.
 * 6. **El orden y la variante con seguro (T-E2)**: «Receta completa primero»
 *    es el orden del backend; «Más cerca» y «Más barato» reacomodan sin
 *    consultar, con ausentes al final y empates estables. Con seguro, tarjeta
 *    y mapa se evalúan sobre lo aprobado y parten el precio en «aprobado / a
 *    tu cargo»; el CTA arma el mismo borrador y no crea ningún pedido.
 */

/** base64url **sobre UTF-8**, como el token real. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const RESUMEN = {
  patientProfileId: 'pp-1',
  conditions: [],
  allergies: [],
  medicationRequests: [
    {
      id: 'm-1',
      medicationConceptId: FIXTURE_IDS.conceptoAmoxicilina,
      statusConceptId: 'st-activa',
      doseText: '500 mg',
      frequencyText: 'cada 8 horas',
      issuedAt: '2026-03-01T11:00:00.000Z',
      createdAt: '2026-03-01T10:30:00.000Z',
    },
    {
      id: 'm-2',
      medicationConceptId: FIXTURE_IDS.conceptoIbuprofeno,
      statusConceptId: 'st-activa',
      doseText: '400 mg',
      issuedAt: '2026-03-02T09:00:00.000Z',
      createdAt: '2026-03-02T08:30:00.000Z',
    },
  ],
  observations: [],
  encounters: [],
  careEpisodes: [],
  limit: 50,
  truncated: [],
};

const CONCEPTOS = {
  items: [
    {
      conceptId: FIXTURE_IDS.conceptoAmoxicilina,
      code: 'J01CA04',
      display: 'Amoxicilina',
      codeSystemVersionId: 'v1',
    },
    {
      conceptId: FIXTURE_IDS.conceptoIbuprofeno,
      code: 'M01AE01',
      display: 'Ibuprofeno',
      codeSystemVersionId: 'v1',
    },
  ],
  count: 2,
  limit: 200,
};

/** El perfil propio, sin domicilio ni trabajo guardados (subtarea B.2). */
const PERFIL_SIN_LUGARES = { personId: 'per-1', patientProfileId: 'pp-1', identityVerified: false };

/** El mismo perfil, con la casa declarada con coordenadas. */
const PERFIL_CON_CASA = {
  ...PERFIL_SIN_LUGARES,
  homeAddress: { lines: 'Av. Banzer 3er anillo', latitude: -17.78, longitude: -63.18 },
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const BOB = { code: 'BOB', display: 'Boliviano' };

/**
 * T-E2: una tercera sede para que los tres órdenes se distingan. El backend la
 * manda última (parcial y más lejos que la Centro), pero es la más barata.
 *
 * | Orden del backend | Distancia | Total  |
 * |-------------------|-----------|--------|
 * | Sucursal Centro   | 1,2 km    | 96.50  |
 * | Plan Tres Mil     | —         | —      |
 * | Sucursal Norte    | 2,5 km    | 28.50  |
 */
const SEDE_NORTE: AvailabilitySite = {
  ...DISPONIBILIDAD_FIXTURE.items[1],
  siteId: '4f9a2b30-1c2d-4e5f-8a9b-000000000003',
  siteName: 'Sucursal Norte',
  addressText: 'Av. Banzer, tercer anillo',
  latitude: -17.76,
  longitude: -63.18,
  distanceKm: 2.5,
  totalAmount: '28.50',
  currency: BOB,
  products: [
    {
      ...DISPONIBILIDAD_FIXTURE.items[1].products[0],
      price: {
        unitAmount: '28.50',
        patientAmount: '28.50',
        currency: BOB,
        priceListCode: 'PUBLICO-2026',
      },
    },
  ],
};

const DISPONIBILIDAD_CON_NORTE: AvailabilityResult = {
  ...DISPONIBILIDAD_FIXTURE,
  items: [...DISPONIBILIDAD_FIXTURE.items, SEDE_NORTE],
  count: 3,
};

/** Los dos renglones del resumen, ya con su producto: el insumo de las funciones puras. */
const CONSULTABLES: readonly (ItemDeReceta & { productId: string })[] = [
  {
    conceptId: FIXTURE_IDS.conceptoAmoxicilina,
    medicamento: 'Amoxicilina',
    indicacion: '500 mg · cada 8 horas',
    emitida: true,
    productId: FIXTURE_IDS.productoAmoxicilina,
  },
  {
    conceptId: FIXTURE_IDS.conceptoIbuprofeno,
    medicamento: 'Ibuprofeno',
    indicacion: '400 mg',
    emitida: true,
    productId: FIXTURE_IDS.productoIbuprofeno,
  },
];

/**
 * El organismo de mapa (FAR-I1) entra con Leaflet doblado: acá se prueba la
 * pantalla, no la cartografía — el contrato del mapa tiene su propio spec.
 */
const marcadoresDelMapa: { alt: string; icono: HTMLElement; popup?: HTMLElement }[] = [];

function leafletDoblado(): unknown {
  return {
    map: () => ({
      setView: () => undefined,
      fitBounds: () => undefined,
      remove: () => undefined,
    }),
    tileLayer: () => ({ addTo: () => undefined }),
    layerGroup: () => ({ addTo: () => undefined, remove: () => undefined }),
    marker: (_coordenadas: unknown, opciones: { icon: { html: HTMLElement }; alt: string }) => {
      const registro: (typeof marcadoresDelMapa)[number] = {
        alt: opciones.alt,
        icono: opciones.icon.html,
      };
      marcadoresDelMapa.push(registro);
      const marcador = {
        bindPopup: (contenido: HTMLElement) => {
          registro.popup = contenido;
          return marcador;
        },
        on: () => marcador,
        addTo: () => marcador,
        getElement: () => document.createElement('div'),
      };
      return marcador;
    },
    divIcon: (opciones: unknown) => opciones,
    latLngBounds: (limites: unknown) => limites,
  };
}

describe('WhereToBuy', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let getCurrentPosition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // jsdom no trae geolocalización: se cuelga una espía para poder afirmar
    // que NADIE la llama hasta que se aprieta el botón.
    getCurrentPosition = vi.fn();
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    marcadoresDelMapa.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'my-account/medical-record/where-to-buy/:requestId', component: WhereToBuy },
        ]),
        {
          provide: CARGADOR_DE_LEAFLET,
          useValue: (() => Promise.resolve(leafletDoblado())) as CargadorDeLeaflet,
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function montar(requestId = 'm-1'): Promise<void> {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], pid: 'pp-1' }),
      refreshToken: 'r-1',
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/my-account/medical-record/where-to-buy/${requestId}`, WhereToBuy);
  }

  /** Resuelve el recorrido completo hasta la consulta de disponibilidad. */
  /**
   * `PERFIL_SIN_LUGARES` por omisión: las pruebas que ya afirmaban «nadie dio
   * una ubicación» siguen siendo ciertas sin tocarlas — sólo un perfil con
   * domicilio hace que la primera consulta de disponibilidad lleve `lat`.
   */
  function responderHastaProductos(
    perfil: Record<string, unknown> = PERFIL_SIN_LUGARES,
  ): void {
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(RESUMEN);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
    http
      .expectOne(
        (r) =>
          r.url === '/pharmacy/products' &&
          r.params.get('conceptId') === FIXTURE_IDS.conceptoAmoxicilina,
      )
      .flush(productosDelConcepto(FIXTURE_IDS.conceptoAmoxicilina));
    http
      .expectOne(
        (r) =>
          r.url === '/pharmacy/products' &&
          r.params.get('conceptId') === FIXTURE_IDS.conceptoIbuprofeno,
      )
      .flush(productosDelConcepto(FIXTURE_IDS.conceptoIbuprofeno));
    http.expectOne('/profiles/patients/me').flush(perfil);
    harness.detectChanges();
  }

  function texto(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  /**
   * La pantalla dejó de ser sólo de farmacias: la receta manda a la farmacia,
   * pero también a los estudios y a los procedimientos. Las tres pestañas
   * existen; dos todavía no pueden ordenar por cercanía y lo dicen en vez de
   * prometerlo.
   */
  it('abre en Farmacias y ofrece las otras dos sin prometer lo que no hay', async () => {
    await montar();
    responderHastaProductos();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    const pestanas = harness.routeNativeElement?.querySelectorAll('[role="tab"]') ?? [];
    expect(Array.from(pestanas).map((p) => p.textContent?.trim())).toEqual([
      'Farmacias',
      'Centros de imagenología',
      'Centros médicos',
    ]);
    // La primera es la que se abre: es el único vertical que hoy responde.
    expect(pestanas[0]?.getAttribute('aria-selected')).toBe('true');
    // Y el panel activo es el de farmacias, no una promesa.
    expect(texto()).toContain('Sucursal Centro');
  });

  it('recorre el contrato E2 entero y pinta completas primero, sin coordenadas', async () => {
    await montar();
    responderHastaProductos();

    const consulta = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
    expect(consulta.request.params.get('products')).toBe(
      `${FIXTURE_IDS.productoAmoxicilina},${FIXTURE_IDS.productoIbuprofeno}`,
    );
    // Nadie dio una ubicación: la consulta no puede llevarla.
    expect(consulta.request.params.has('lat')).toBe(false);
    expect(consulta.request.params.has('lng')).toBe(false);
    consulta.flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    const sedes = harness.routeNativeElement?.querySelectorAll('.compra__sede') ?? [];
    expect(sedes).toHaveLength(2);
    // El orden es el del backend: la completa primero, con su total; la
    // parcial dice qué le falta por su nombre y que el total no está.
    expect(sedes[0]?.textContent).toContain('Sucursal Centro');
    expect(sedes[0]?.textContent).toContain('Tiene todo');
    expect(sedes[0]?.textContent).toContain('96.50 BOB');
    expect(sedes[0]?.textContent).toContain('1,2 km');
    expect(sedes[1]?.textContent).toContain('Le falta algo');
    expect(sedes[1]?.textContent).toContain('Le falta: Amoxicilina');
    expect(sedes[1]?.textContent).toContain('Total no disponible');
  });

  it('el mapa recibe un pin por sede ubicable, y la sede sin coordenadas lo dice', async () => {
    await montar();
    responderHastaProductos();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();
    // El montaje de Leaflet es diferido: dos microtareas y otro render.
    await Promise.resolve();
    await Promise.resolve();
    harness.detectChanges();

    expect(harness.routeNativeElement?.querySelector('app-map')).not.toBeNull();
    // La fixture trae la sede Centro con coordenadas y la Sur sin: un solo pin.
    expect(marcadoresDelMapa).toHaveLength(1);
    expect(marcadoresDelMapa[0].alt).toContain('Sucursal Centro');
    expect(marcadoresDelMapa[0].icono.textContent).toBe('A');
    expect(texto()).toContain('Ubicación no disponible en el mapa');
    // El rótulo normativo (PAC-MED-005) sigue al pie del mapa.
    expect(texto()).toContain('en línea recta');
  });

  it('no muestra ningún identificador: todo viaja por nombre', async () => {
    await montar();
    responderHastaProductos();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    expect(texto()).not.toMatch(UUID);
  });

  it('«Enviar pedido» arma el borrador real de la sede y lleva a confirmarlo', async () => {
    await montar();
    responderHastaProductos();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    expect(
      harness.routeNativeElement?.querySelector('[data-testid="compra-demo-aviso"]'),
    ).toBeNull();
    const botones = harness.routeNativeElement?.querySelectorAll<HTMLButtonElement>(
      '[data-testid="compra-cta-pedido"]',
    );
    expect(botones).toHaveLength(2);
    for (const boton of botones ?? []) {
      expect(boton.getAttribute('aria-disabled')).not.toBe('true');
    }

    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    botones?.[0]?.click();
    harness.detectChanges();

    // El borrador queda en el cliente de pedidos — nada viaja por la URL.
    const borrador = TestBed.inject(PharmacyOrdersClient).borradorPreparado();
    expect(borrador?.farmacia).toBe('Farmacia Andina');
    expect(borrador?.sede).toBe('Sucursal Centro');
    expect(navegar).toHaveBeenCalledWith(['/my-account/pharmacy-orders/new']);
  });

  it('no toca la geolocalización al entrar; el botón la pide y reconsulta con lat/lng', async () => {
    await montar();
    responderHastaProductos();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    // Entrar a la pantalla no dispara el diálogo de permisos del navegador.
    expect(getCurrentPosition).not.toHaveBeenCalled();

    getCurrentPosition.mockImplementation(
      (exito: (posicion: { coords: { latitude: number; longitude: number } }) => void) =>
        exito({ coords: { latitude: -17.7833, longitude: -63.1821 } }),
    );
    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[data-testid="compra-compartir-ubicacion"]')
      ?.click();
    harness.detectChanges();

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    const consulta = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
    expect(consulta.request.params.get('lat')).toBe('-17.7833');
    expect(consulta.request.params.get('lng')).toBe('-63.1821');
    consulta.flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    expect(texto()).toContain('Distancias medidas desde tu ubicación actual');
  });

  it('destildar un renglón lo saca de la consulta', async () => {
    await montar();
    responderHastaProductos();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    const casillas =
      harness.routeNativeElement?.querySelectorAll<HTMLInputElement>(
        '[data-testid="compra-items"] input[type="checkbox"]',
      ) ?? [];
    expect(casillas).toHaveLength(2);
    casillas[1].checked = false;
    casillas[1].dispatchEvent(new Event('change'));
    harness.detectChanges();

    const consulta = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
    expect(consulta.request.params.get('products')).toBe(FIXTURE_IDS.productoAmoxicilina);
    consulta.flush(DISPONIBILIDAD_FIXTURE);
  });

  it('un medicamento sin producto publicado se dice, y ninguna sede queda completa', async () => {
    await montar();
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(RESUMEN);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
    http
      .expectOne(
        (r) =>
          r.url === '/pharmacy/products' &&
          r.params.get('conceptId') === FIXTURE_IDS.conceptoAmoxicilina,
      )
      .flush(productosDelConcepto(FIXTURE_IDS.conceptoAmoxicilina));
    // El directorio no publica nada para el ibuprofeno.
    http
      .expectOne(
        (r) =>
          r.url === '/pharmacy/products' &&
          r.params.get('conceptId') === FIXTURE_IDS.conceptoIbuprofeno,
      )
      .flush({ items: [], limit: 1, truncated: false });
    http.expectOne('/profiles/patients/me').flush(PERFIL_SIN_LUGARES);
    harness.detectChanges();

    const consulta = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
    // Sólo viaja lo consultable.
    expect(consulta.request.params.get('products')).toBe(FIXTURE_IDS.productoAmoxicilina);
    consulta.flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    expect(texto()).toContain('No todo se pudo consultar');
    expect(texto()).toContain('Ibuprofeno');
    // La «completa» del backend no alcanza: la receta entera no se pudo
    // consultar, así que nadie puede declararse con todo.
    expect(texto()).not.toContain('Tiene todo');

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[data-testid="compra-cta-pedido"]')
      ?.click();
    harness.detectChanges();
    const draft = TestBed.inject(PharmacyOrdersClient).borradorPreparado();
    expect(draft?.lineas).toHaveLength(2);
    expect(draft?.lineas.find((line) => line.medicamento === 'Ibuprofeno')?.productId).toBeNull();
    expect(navigate).toHaveBeenCalled();
  });

  it('un error HTTP de productos queda como error recuperable, no como ausencia', async () => {
    await montar();
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(RESUMEN);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
    http
      .expectOne(
        (r) =>
          r.url === '/pharmacy/products' &&
          r.params.get('conceptId') === FIXTURE_IDS.conceptoAmoxicilina,
      )
      .flush(productosDelConcepto(FIXTURE_IDS.conceptoAmoxicilina));
    http.expectOne('/profiles/patients/me').flush(PERFIL_SIN_LUGARES);
    http
      .expectOne(
        (r) =>
          r.url === '/pharmacy/products' &&
          r.params.get('conceptId') === FIXTURE_IDS.conceptoIbuprofeno,
      )
      .flush(
        {
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Catalogue unavailable',
          correlationId: 'catalogue-1',
        },
        { status: 503, statusText: 'Service Unavailable' },
      );
    harness.detectChanges();

    http.expectNone((request) => request.url === '/pharmacy-inventory/availability');
    expect(texto()).toContain('Un servicio no está disponible');
    expect(texto()).toContain('Reintentar');
    expect(texto()).not.toContain('Sin producto publicado');
    expect(TestBed.inject(PharmacyOrdersClient).borradorPreparado()).toBeNull();

    const retry = [...(harness.routeNativeElement?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent?.includes('Reintentar'),
    );
    expect(retry).toBeDefined();
    retry?.click();
    http
      .expectOne((request) => request.url === '/clinical/patients/pp-1/summary')
      .flush({ ...RESUMEN, medicationRequests: [] });
    harness.detectChanges();
  });

  it('una receta que no está en la historia no dispara ninguna consulta a farmacias', async () => {
    await montar('m-inexistente');
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(RESUMEN);
    harness.detectChanges();

    expect(harness.routeNativeElement?.querySelector('[data-testid="compra-items"]')).toBeNull();
    // `http.verify()` del afterEach confirma que no salió nada más.
  });

  /**
   * La casa declarada en el perfil alimenta la búsqueda sin pedir el GPS
   * (subtarea B.2).
   */
  describe('el domicilio guardado mide la primera búsqueda', () => {
    it('con casa guardada, la primera consulta de disponibilidad ya lleva su origen', async () => {
      await montar();
      responderHastaProductos(PERFIL_CON_CASA);

      const consulta = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
      expect(consulta.request.params.get('lat')).toBe('-17.78');
      expect(consulta.request.params.get('lng')).toBe('-63.18');
      consulta.flush(DISPONIBILIDAD_FIXTURE);
      harness.detectChanges();

      expect(texto()).toContain('Distancias medidas desde tu casa');
      // Con un origen ya elegido, la sección muestra el aviso y «Dejar de usar
      // este punto» — no los botones de elección, que viven en la otra rama.
      expect(
        harness.routeNativeElement?.querySelector('[data-testid="where-to-buy-origin-home"]'),
      ).toBeNull();
      expect(harness.routeNativeElement?.querySelector('[data-testid="compra-origen"]')).not.toBeNull();
    });

    it('sin lugares guardados, las ciudades siguen intactas y sin origen por defecto', async () => {
      await montar();
      responderHastaProductos(PERFIL_SIN_LUGARES);

      const consulta = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
      expect(consulta.request.params.has('lat')).toBe(false);
      consulta.flush(DISPONIBILIDAD_FIXTURE);
      harness.detectChanges();

      expect(
        harness.routeNativeElement?.querySelector('[data-testid="where-to-buy-origin-home"]'),
      ).toBeNull();
      expect(
        harness.routeNativeElement?.querySelector('[data-testid="where-to-buy-origin-work"]'),
      ).toBeNull();
      expect(texto()).toContain('Santa Cruz de la Sierra');
    });

    it('el perfil en error deja el recorrido tal como estaba, sin origen por defecto', async () => {
      await montar();
      http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(RESUMEN);
      http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
      http
        .expectOne(
          (r) =>
            r.url === '/pharmacy/products' &&
            r.params.get('conceptId') === FIXTURE_IDS.conceptoAmoxicilina,
        )
        .flush(productosDelConcepto(FIXTURE_IDS.conceptoAmoxicilina));
      http
        .expectOne(
          (r) =>
            r.url === '/pharmacy/products' &&
            r.params.get('conceptId') === FIXTURE_IDS.conceptoIbuprofeno,
        )
        .flush(productosDelConcepto(FIXTURE_IDS.conceptoIbuprofeno));
      http
        .expectOne('/profiles/patients/me')
        .error(new ProgressEvent('error'), { status: 500 });
      harness.detectChanges();

      const consulta = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
      expect(consulta.request.params.has('lat')).toBe(false);
      consulta.flush(DISPONIBILIDAD_FIXTURE);
      harness.detectChanges();

      expect(texto()).toContain('Compartir mi ubicación');
    });
  });

  /* ---- T-E2 · orden y variante con seguro ---------------------------------- */

  /** Monta la pantalla con las tres sedes ya pintadas. */
  async function montarConTresSedes(): Promise<void> {
    await montar();
    responderHastaProductos();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_CON_NORTE);
    harness.detectChanges();
  }

  function consultar<T extends Element>(selector: string): T | null {
    return harness.routeNativeElement?.querySelector<T>(selector) ?? null;
  }

  function todas(selector: string): Element[] {
    return [...(harness.routeNativeElement?.querySelectorAll(selector) ?? [])];
  }

  /** Los nombres de las sedes, en el orden en que se ven. */
  function sedesEnPantalla(): string[] {
    return todas('.compra__sede .compra__principal').map((nodo) => nodo.textContent?.trim() ?? '');
  }

  function tarjetaDe(sede: string): Element | undefined {
    return todas('.compra__sede').find((tarjeta) => tarjeta.textContent?.includes(sede));
  }

  function elegirOrden(valor: 'receta-completa' | 'mas-cerca' | 'mas-barato'): void {
    consultar<HTMLButtonElement>(`[data-testid="segmentado-${valor}"]`)?.click();
    harness.detectChanges();
  }

  function conmutarSeguro(): void {
    consultar<HTMLInputElement>('[data-testid="compra-seguro"] input[type="checkbox"]')?.click();
    harness.detectChanges();
  }

  it('sin seguro: abre con el orden del backend y la tarjeta no habla del seguro', async () => {
    await montarConTresSedes();

    expect(sedesEnPantalla()).toEqual([
      'Farmacia Andina · Sucursal Centro',
      'Farmacia del Sur · Sucursal Plan Tres Mil',
      'Farmacia del Sur · Sucursal Norte',
    ]);
    expect(
      consultar('[data-testid="segmentado-receta-completa"]')?.getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      consultar<HTMLInputElement>('[data-testid="compra-seguro"] input[type="checkbox"]')?.checked,
    ).toBe(false);
    // Ningún rastro de la variante: la pantalla de siempre.
    expect(todas('[data-testid="compra-cobertura-seguro"]')).toHaveLength(0);
    expect(todas('[data-testid="compra-desglose-seguro"]')).toHaveLength(0);
    expect(todas('[data-testid="compra-item-seguro"]')).toHaveLength(0);
    expect(tarjetaDe('Sucursal Centro')?.textContent).toContain('Tiene todo');
    expect(tarjetaDe('Plan Tres Mil')?.textContent).toContain('Le falta: Amoxicilina');
  });

  it('«Más cerca» y «Más barato» reacomodan la lista sin volver a consultar', async () => {
    await montarConTresSedes();

    elegirOrden('mas-cerca');
    // 1,2 km, 2,5 km, y la que no tiene distancia al final.
    expect(sedesEnPantalla()).toEqual([
      'Farmacia Andina · Sucursal Centro',
      'Farmacia del Sur · Sucursal Norte',
      'Farmacia del Sur · Sucursal Plan Tres Mil',
    ]);

    elegirOrden('mas-barato');
    // 28.50, 96.50, y la que no tiene total al final.
    expect(sedesEnPantalla()).toEqual([
      'Farmacia del Sur · Sucursal Norte',
      'Farmacia Andina · Sucursal Centro',
      'Farmacia del Sur · Sucursal Plan Tres Mil',
    ]);

    elegirOrden('receta-completa');
    expect(sedesEnPantalla()).toEqual([
      'Farmacia Andina · Sucursal Centro',
      'Farmacia del Sur · Sucursal Plan Tres Mil',
      'Farmacia del Sur · Sucursal Norte',
    ]);
    // Ordenar es de la pantalla: no sale otra consulta.
    http.expectNone((r) => r.url === '/pharmacy-inventory/availability');
  });

  it('con seguro: cobertura de lo aprobado, desglose «aprobado / a tu cargo» y renglones rotulados', async () => {
    await montarConTresSedes();
    conmutarSeguro();

    // De ejemplo: la amoxicilina entra en el seguro; el ibuprofeno (último renglón) no.
    const renglones = todas('[data-testid="compra-item-seguro"]').map((nodo) =>
      nodo.textContent?.trim(),
    );
    expect(renglones).toEqual(['Aprobado por el seguro', 'A tu cargo']);
    expect(texto()).toContain('Demostración');

    const centro = tarjetaDe('Sucursal Centro');
    expect(centro?.textContent).toContain('Cobertura de lo aprobado: 1 de 1');
    expect(centro?.textContent).toContain('Tiene todo lo aprobado');
    expect(
      centro
        ?.querySelector('[data-testid="compra-desglose-seguro"]')
        ?.textContent?.replace(/\s+/g, ' '),
    ).toContain('Aprobado: 68.00 BOB A tu cargo: 28.50 BOB');

    const planTresMil = tarjetaDe('Plan Tres Mil');
    expect(planTresMil?.textContent).toContain('Cobertura de lo aprobado: 0 de 1');
    expect(planTresMil?.textContent).toContain('Le falta de lo aprobado: Amoxicilina');
    expect(planTresMil?.textContent).toContain('Le falta algo aprobado');
    // El ibuprofeno está pero sin precio publicado: se dice, no se estima.
    expect(planTresMil?.textContent).toContain('A tu cargo: no disponible, falta algún precio');
    // La sede no publica moneda: el importe va sin ella, no con una supuesta.
    expect(planTresMil?.textContent).toContain('Aprobado: 0.00');

    const norte = tarjetaDe('Sucursal Norte');
    expect(norte?.textContent).toContain('Cobertura de lo aprobado: 0 de 1');
    expect(norte?.textContent).toContain('A tu cargo: 28.50 BOB');

    // El total de la sede no cambia: el desglose se suma, no lo reemplaza.
    expect(centro?.textContent).toContain('Total estimado: 96.50 BOB');
    // Conmutar no consulta.
    http.expectNone((r) => r.url === '/pharmacy-inventory/availability');

    // Apagarlo devuelve la pantalla de siempre.
    conmutarSeguro();
    expect(todas('[data-testid="compra-cobertura-seguro"]')).toHaveLength(0);
    expect(tarjetaDe('Sucursal Centro')?.textContent).toContain('Tiene todo');
  });

  it('con seguro el mapa dice lo mismo que las tarjetas', async () => {
    await montarConTresSedes();
    await Promise.resolve();
    await Promise.resolve();
    harness.detectChanges();

    conmutarSeguro();
    await Promise.resolve();
    harness.detectChanges();

    // El mapa se redibuja con los pines de la variante: los dos últimos.
    const pines = marcadoresDelMapa.slice(-2);
    expect(pines.map((pin) => pin.alt)).toEqual([
      'Farmacia Andina · Sucursal Centro',
      'Farmacia del Sur · Sucursal Norte',
    ]);
    for (const pin of pines) {
      const tarjeta = tarjetaDe(pin.alt.split(' · ')[1]);
      const estado = pin.popup?.querySelector('.mapa__popup-estado')?.textContent ?? '';
      const detalle = pin.popup?.querySelector('.mapa__popup-detalle')?.textContent ?? '';
      const cobertura =
        tarjeta?.querySelector('[data-testid="compra-cobertura-seguro"]')?.textContent?.trim() ??
        '';
      expect(tarjeta?.querySelector('app-badge')?.textContent?.trim()).toBe(estado);
      expect(detalle.startsWith(cobertura)).toBe(true);
    }
    expect(pines[0].popup?.querySelector('.mapa__popup-estado')?.textContent).toBe(
      'Tiene todo lo aprobado',
    );
    expect(pines[0].icono.className).toContain('mapa__pin--success');
    expect(pines[1].icono.className).toContain('mapa__pin--warning');
  });

  it('con seguro y ningún renglón aprobado incluido: vacío honesto que deja apagar la variante', async () => {
    await montarConTresSedes();
    conmutarSeguro();

    // Se destilda la amoxicilina, el único renglón aprobado de ejemplo.
    const casillas = todas(
      '[data-testid="compra-items"] input[type="checkbox"]',
    ) as HTMLInputElement[];
    casillas[0].checked = false;
    casillas[0].dispatchEvent(new Event('change'));
    harness.detectChanges();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_CON_NORTE);
    harness.detectChanges();

    expect(texto()).toContain('ninguno de los medicamentos que elegiste está aprobado');
    expect(texto()).toContain('Volver a mi historia');
    expect(todas('.compra__sede')).toHaveLength(0);
    // El conmutador sigue a mano: el vacío no encierra a nadie.
    expect(consultar('[data-testid="compra-seguro"]')).not.toBeNull();

    conmutarSeguro();
    expect(todas('.compra__sede')).toHaveLength(3);
    http.expectNone((r) => r.url === '/pharmacy-inventory/availability');
  });

  it('con seguro, ninguna sede que confirme sigue siendo el vacío de siempre', async () => {
    await montar();
    responderHastaProductos();
    conmutarSeguro();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush({ requestedProductIds: [], items: [], count: 0 });
    harness.detectChanges();

    expect(texto()).toContain(
      'Ninguna sucursal puede confirmar hoy los medicamentos de tu receta.',
    );
    expect(texto()).not.toContain('ninguno de los medicamentos que elegiste está aprobado');
  });

  it('con seguro, un error de disponibilidad queda como error recuperable', async () => {
    await montar();
    responderHastaProductos();
    conmutarSeguro();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(
        {
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Inventory unavailable',
          correlationId: 'inv-1',
        },
        { status: 503, statusText: 'Service Unavailable' },
      );
    harness.detectChanges();

    expect(texto()).toContain('Un servicio no está disponible');
    expect(todas('.compra__sede')).toHaveLength(0);
    const reintentar = (todas('button') as HTMLButtonElement[]).find((boton) =>
      boton.textContent?.includes('Reintentar'),
    );
    expect(reintentar).toBeDefined();
    reintentar?.click();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_CON_NORTE);
    harness.detectChanges();

    expect(tarjetaDe('Sucursal Centro')?.textContent).toContain('Cobertura de lo aprobado: 1 de 1');
  });

  it('con seguro y otro orden, el CTA arma el borrador real de esa sede, navega y no crea el pedido', async () => {
    await montarConTresSedes();
    conmutarSeguro();
    elegirOrden('mas-barato');

    const ordersClient = TestBed.inject(PharmacyOrdersClient);
    const enviar = vi.spyOn(ordersClient, 'enviar');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const botones = todas('[data-testid="compra-cta-pedido"]') as HTMLButtonElement[];
    // El rótulo no cambia (DEUDA-T-E2-01 queda fuera de esta tarea).
    expect(botones.map((boton) => boton.textContent?.trim())).toEqual([
      'Enviar pedido',
      'Enviar pedido',
      'Enviar pedido',
    ]);
    botones[0].click();
    harness.detectChanges();

    // La primera tarjeta con «Más barato» es la Norte: el borrador es el suyo,
    // idéntico al que arma la vista sin seguro — la variante no viaja.
    expect(ordersClient.borradorPreparado()).toEqual(
      borradorDePedido('m-1', SEDE_NORTE, CONSULTABLES, []),
    );
    expect(navegar).toHaveBeenCalledWith(['/my-account/pharmacy-orders/new']);
    expect(enviar).not.toHaveBeenCalled();
    // Ni POST, ni PUT, ni PATCH: el pedido lo crea el checkout.
    http.expectNone((r) => r.method !== 'GET');
    http.expectNone((r) => r.url.startsWith('/pharmacy/orders'));
  });
});

describe('ordenarSedes (T-E2)', () => {
  interface Fila {
    readonly id: string;
    readonly distanciaKm: number | null;
    readonly totalCentavos: number | null;
  }

  const fila = (id: string, distanciaKm: number | null, totalCentavos: number | null): Fila => ({
    id,
    distanciaKm,
    totalCentavos,
  });

  const ids = (filas: readonly Fila[]) => filas.map((f) => f.id);

  it('«Receta completa primero» devuelve la lista del backend tal cual', () => {
    const sedes = [fila('b', 3, 10), fila('a', 1, 5)];
    expect(ordenarSedes(sedes, 'receta-completa')).toBe(sedes);
  });

  it('«Más cerca»: ascendente, 0 vale, ausentes e inválidos al final y empates estables', () => {
    const sedes = [
      fila('a', 2, null),
      fila('sin', null, null),
      fila('cero', 0, null),
      fila('nan', Number.NaN, null),
      fila('e1', 1, null),
      fila('e2', 1, null),
      fila('inf', Number.POSITIVE_INFINITY, null),
      fila('neg', -1, null),
    ];
    expect(ids(ordenarSedes(sedes, 'mas-cerca'))).toEqual([
      'cero',
      'e1',
      'e2',
      'a',
      'sin',
      'nan',
      'inf',
      'neg',
    ]);
  });

  it('«Más barato»: ascendente por total, 0.00 vale, sin total al final y empates estables', () => {
    const sedes = [
      fila('caro', null, 9650),
      fila('sin', null, null),
      fila('igual-1', null, 2850),
      fila('gratis', null, 0),
      fila('igual-2', null, 2850),
    ];
    expect(ids(ordenarSedes(sedes, 'mas-barato'))).toEqual([
      'gratis',
      'igual-1',
      'igual-2',
      'caro',
      'sin',
    ]);
  });

  it('no muta la lista recibida', () => {
    const sedes = Object.freeze([fila('lejos', 9, 1), fila('cerca', 1, 9)]);
    const antes = ids(sedes);
    const ordenadas = ordenarSedes(sedes, 'mas-cerca');
    expect(ids(ordenadas)).toEqual(['cerca', 'lejos']);
    expect(ordenadas).not.toBe(sedes);
    expect(ids(sedes)).toEqual(antes);
  });
});

describe('coberturaConSeguro (T-E2)', () => {
  const [SEDE_COMPLETA, SEDE_PARCIAL] = DISPONIBILIDAD_FIXTURE.items;
  const soloAmoxicilina = new Set([FIXTURE_IDS.conceptoAmoxicilina]);

  it('parte el precio de lo disponible en aprobado y a tu cargo', () => {
    const cobertura = coberturaConSeguro(SEDE_COMPLETA, CONSULTABLES, [], soloAmoxicilina);
    expect(cobertura).toEqual({
      aprobados: 1,
      cubiertos: 1,
      completa: true,
      faltantes: [],
      aprobado: '68.00 BOB',
      aCargo: '28.50 BOB',
    });
  });

  it('todo aprobado: nada a tu cargo es 0.00, no una ausencia', () => {
    const todo = new Set(CONSULTABLES.map((item) => item.conceptId));
    const cobertura = coberturaConSeguro(SEDE_COMPLETA, CONSULTABLES, [], todo);
    expect(cobertura.aprobado).toBe('96.50 BOB');
    expect(cobertura.aCargo).toBe('0.00 BOB');
    expect(cobertura.cubiertos).toBe(2);
  });

  it('un aprobado faltante no suma y se nombra; un precio ausente deja la parte en null', () => {
    const cobertura = coberturaConSeguro(SEDE_PARCIAL, CONSULTABLES, [], soloAmoxicilina);
    expect(cobertura.completa).toBe(false);
    expect(cobertura.cubiertos).toBe(0);
    expect(cobertura.faltantes).toEqual(['Amoxicilina']);
    expect(cobertura.aprobado).toBe('0.00');
    expect(cobertura.aCargo).toBeNull();
  });

  it('un aprobado sin producto publicado cuenta en «de M» y falta', () => {
    const paracetamol: ItemDeReceta = {
      conceptId: 'concepto-paracetamol',
      medicamento: 'Paracetamol',
      indicacion: '',
      emitida: true,
      productId: null,
    };
    const cobertura = coberturaConSeguro(
      SEDE_COMPLETA,
      CONSULTABLES,
      [paracetamol],
      new Set([FIXTURE_IDS.conceptoAmoxicilina, 'concepto-paracetamol']),
    );
    expect(cobertura.aprobados).toBe(2);
    expect(cobertura.cubiertos).toBe(1);
    expect(cobertura.completa).toBe(false);
    expect(cobertura.faltantes).toEqual(['Paracetamol']);
  });

  it('suma en centavos y no mezcla monedas', () => {
    const conPrecios = (precios: readonly [string, string, string]): AvailabilitySite => ({
      ...SEDE_COMPLETA,
      products: SEDE_COMPLETA.products.map((producto, indice) => ({
        ...producto,
        price: {
          unitAmount: precios[indice],
          patientAmount: precios[indice],
          currency: { code: indice === 1 ? precios[2] : 'BOB', display: '' },
          priceListCode: 'X',
        },
      })),
    });
    const todo = new Set(CONSULTABLES.map((item) => item.conceptId));

    expect(
      coberturaConSeguro(conPrecios(['0.10', '0.20', 'BOB']), CONSULTABLES, [], todo).aprobado,
    ).toBe('0.30 BOB');
    expect(
      coberturaConSeguro(conPrecios(['0.10', '0.20', 'USD']), CONSULTABLES, [], todo).aprobado,
    ).toBeNull();
    expect(
      coberturaConSeguro(conPrecios(['10', 'no-es-importe', 'BOB']), CONSULTABLES, [], todo)
        .aprobado,
    ).toBeNull();
  });
});

describe('aprobadosPorElSeguroDeEjemplo (T-E2, datos de ejemplo)', () => {
  it('con un renglón lo aprueba; con más, el último queda a cargo de la persona', () => {
    expect([...aprobadosPorElSeguroDeEjemplo([])]).toEqual([]);
    expect([...aprobadosPorElSeguroDeEjemplo(['a'])]).toEqual(['a']);
    expect([...aprobadosPorElSeguroDeEjemplo(['a', 'b', 'c'])]).toEqual(['a', 'b']);
  });
});

describe('borradorDePedido (FAR-I2)', () => {
  it('con la sede completa: cada renglón con su presentación, su precio y su moneda', () => {
    const borrador = borradorDePedido('m-1', DISPONIBILIDAD_FIXTURE.items[0], CONSULTABLES, []);

    expect(borrador.farmacia).toBe('Farmacia Andina');
    expect(borrador.sede).toBe('Sucursal Centro');
    expect(borrador.requestId).toBe('m-1');
    expect(borrador.totalEstimado).toBe('96.50');
    expect(borrador.moneda).toBe('BOB');
    expect(borrador.lineas).toHaveLength(2);
    expect(borrador.lineas[0]).toEqual({
      productId: FIXTURE_IDS.productoAmoxicilina,
      medicamento: 'Amoxicilina',
      presentacion: '500 mg · Caja x 21 cápsulas',
      cantidad: 1,
      precio: '68.00',
      moneda: 'BOB',
      disponible: true,
    });
  });

  it('con la sede parcial: lo que falta va igual, dicho claro y sin inventar precio', () => {
    const borrador = borradorDePedido('m-1', DISPONIBILIDAD_FIXTURE.items[1], CONSULTABLES, []);

    // La amoxicilina está en `missingProductIds`: viaja como no disponible.
    const amoxicilina = borrador.lineas[0];
    expect(amoxicilina.disponible).toBe(false);
    expect(amoxicilina.precio).toBeNull();
    // El ibuprofeno está, pero la sede no publica su precio: se dice, no se estima.
    const ibuprofeno = borrador.lineas[1];
    expect(ibuprofeno.disponible).toBe(true);
    expect(ibuprofeno.precio).toBeNull();
    expect(borrador.totalEstimado).toBeNull();
  });

  it('un medicamento sin producto publicado entra como renglón no disponible', () => {
    const borrador = borradorDePedido('m-1', DISPONIBILIDAD_FIXTURE.items[0], CONSULTABLES, [
      'Paracetamol',
    ]);

    const suelto = borrador.lineas.at(-1);
    expect(suelto).toEqual({
      productId: null,
      medicamento: 'Paracetamol',
      presentacion: null,
      cantidad: 1,
      precio: null,
      moneda: null,
      disponible: false,
    });
  });
});

/**
 * La misma frontera de deriva que `design-tokens.types.spec.ts`: un
 * `var(--token-que-no-existe)` falla en silencio — el navegador descarta la
 * declaración y el componente se pinta con lo que herede. Acá se fija que el
 * CSS del carril solo hable el idioma declarado en `src/styles.css`.
 */
describe('where-to-buy.css usa solo tokens declarados', () => {
  const css = readFileSync(
    'src/app/features/account/medical-record/where-to-buy/where-to-buy.css',
    'utf8',
  );

  it('cada var(--…) del componente está declarado en src/styles.css', () => {
    const declarados = new Set(
      [...readFileSync('src/styles.css', 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/g)].map(
        (match) => match[1],
      ),
    );
    const usados = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1]);
    expect(usados.length).toBeGreaterThan(0);
    expect(usados.filter((token) => !declarados.has(token))).toEqual([]);
  });

  it('sin colores a mano: ni hex de relleno ni blanco sobre aguamarina', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

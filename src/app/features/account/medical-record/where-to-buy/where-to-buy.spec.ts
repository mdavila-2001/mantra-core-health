import { environment } from '../../../../../environments/environment';
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
import { CART_STORAGE, type CartStorage } from '../../../../core/data-access/pharmacy-cart/cart.storage';
import type { CartState } from '../../../../core/data-access/pharmacy-cart/pharmacy-cart.types';
import { CartStore } from '../../../../core/data-access/pharmacy-cart/cart.store';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import { SessionStore } from '../../../../core/auth/session.store';
import { SAMPLE_DATA_ENABLED } from '../../../../core/mock/sample-data';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { CARGADOR_DE_LEAFLET } from '../../../../shared/components/organisms/map/map';
import type { CargadorDeLeaflet } from '../../../../shared/components/organisms/map/map';
import { createOrderRequest } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.adapter';
import { pendingImagingStudies } from './imaging-centers';
import {
  cartLinesFromDraft,
  insuredCoverageOf,
  orderDraftOf,
  sortBranches,
  type PrescriptionItem,
} from './pharmacy-branches';
import { partialCountLabel, WhereToBuy } from './where-to-buy';
import { sampleInsuranceApprovals } from './where-to-buy.fixtures';

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

const SUMMARY = {
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

const CONCEPTS = {
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
const PROFILE_WITHOUT_PLACES = { personId: 'per-1', patientProfileId: 'pp-1', identityVerified: false };

/** El mismo perfil, con la casa declarada con coordenadas. */
const PROFILE_WITH_HOME = {
  ...PROFILE_WITHOUT_PLACES,
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
const NORTH_SITE: AvailabilitySite = {
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

const AVAILABILITY_WITH_NORTH: AvailabilityResult = {
  ...DISPONIBILIDAD_FIXTURE,
  items: [...DISPONIBILIDAD_FIXTURE.items, NORTH_SITE],
  count: 3,
};

/** Los dos renglones del resumen, ya con su producto: el insumo de las funciones puras. */
const QUERYABLE: readonly (PrescriptionItem & { productId: string })[] = [
  {
    conceptId: FIXTURE_IDS.conceptoAmoxicilina,
    medication: 'Amoxicilina',
    instructions: '500 mg · cada 8 horas',
    issued: true,
    productId: FIXTURE_IDS.productoAmoxicilina,
  },
  {
    conceptId: FIXTURE_IDS.conceptoIbuprofeno,
    medication: 'Ibuprofeno',
    instructions: '400 mg',
    issued: true,
    productId: FIXTURE_IDS.productoIbuprofeno,
  },
];

/**
 * El organismo de mapa (FAR-I1) entra con Leaflet doblado: acá se prueba la
 * pantalla, no la cartografía — el contrato del mapa tiene su propio spec.
 */
const mapMarkers: { alt: string; icono: HTMLElement; popup?: HTMLElement }[] = [];

function fakeLeaflet(): unknown {
  return {
    map: () => ({
      setView: () => undefined,
      fitBounds: () => undefined,
      remove: () => undefined,
    }),
    tileLayer: () => ({ addTo: () => undefined }),
    layerGroup: () => ({ addTo: () => undefined, remove: () => undefined }),
    marker: (_coords: unknown, options: { icon: { html: HTMLElement }; alt: string }) => {
      const entry: (typeof mapMarkers)[number] = {
        alt: options.alt,
        icono: options.icon.html,
      };
      mapMarkers.push(entry);
      const marker = {
        bindPopup: (content: HTMLElement) => {
          entry.popup = content;
          return marker;
        },
        on: () => marker,
        addTo: () => marker,
        getElement: () => document.createElement('div'),
      };
      return marker;
    },
    divIcon: (options: unknown) => options,
    latLngBounds: (bounds: unknown) => bounds,
  };
}

/**
 * El carrito en memoria, no en `localStorage`.
 *
 * `CartStore` persiste por cuenta (H3.S1) y el adaptador de navegador es el
 * que trae la factory del token. Los `it` de este archivo comparten un mismo
 * jsdom: con el adaptador real, el carrito que deja una prueba aparece en la
 * siguiente y dispara el diálogo de «cambiar de farmacia» que esa prueba no
 * espera. Mismo doble que usa `cart.store.spec.ts`.
 */
class MemoryCartStorage implements CartStorage {
  private readonly data = new Map<string, CartState>();
  read(key: string): CartState | null {
    return this.data.get(key) ?? null;
  }
  write(key: string, cart: CartState): void {
    this.data.set(key, cart);
  }
  clear(key: string): void {
    this.data.delete(key);
  }
}

describe('WhereToBuy', () => {
  // Las campañas de demostración sólo existen con el interruptor encendido
  // (`environment.campaignsDemo`, apagado fuera de `demo`): estas pruebas miden
  // el motor de mecánicas sobre ese paquete sembrado.
  const originalDemoCampaigns = environment.campaignsDemo;
  beforeEach(() => Object.assign(environment, { campaignsDemo: true }));
  afterEach(() => Object.assign(environment, { campaignsDemo: originalDemoCampaigns }));

  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let getCurrentPosition: ReturnType<typeof vi.fn>;
  /** Maqueta (`true`) o API real (`false`); se lee al crear la pantalla. */
  let sampleData: boolean;


  /** P-19-4: la lista abre solo con las completas; esto suma las que tienen una parte. */
  function showAll(): void {
    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>(byTestId('where-to-buy-show-partial'))
      ?.click();
    harness.detectChanges();
  }

  function showPartial(): void {
    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>(byTestId('where-to-buy-imaging-show-partial'))
      ?.click();
    harness.detectChanges();
  }
  beforeEach(() => {
    sampleData = true;
    // jsdom no trae geolocalización: se cuelga una espía para poder afirmar
    // que NADIE la llama hasta que se aprieta el botón.
    getCurrentPosition = vi.fn();
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    mapMarkers.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'my-account/medical-record/where-to-buy/:requestId', component: WhereToBuy },
        ]),
        { provide: CART_STORAGE, useValue: new MemoryCartStorage() },
        {
          provide: CARGADOR_DE_LEAFLET,
          useValue: (() => Promise.resolve(fakeLeaflet())) as CargadorDeLeaflet,
        },
        { provide: SAMPLE_DATA_ENABLED, useFactory: () => sampleData },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function mount(requestId = 'm-1', query = ''): Promise<void> {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], pid: 'pp-1' }),
      refreshToken: 'r-1',
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      `/my-account/medical-record/where-to-buy/${requestId}${query}`,
      WhereToBuy,
    );
  }

  /** Resuelve el recorrido completo hasta la consulta de disponibilidad. */
  /**
   * `PROFILE_WITHOUT_PLACES` por omisión: las pruebas que ya afirmaban «nadie dio
   * una ubicación» siguen siendo ciertas sin tocarlas — sólo un perfil con
   * domicilio hace que la primera consulta de disponibilidad lleve `lat`.
   */
  function respondUntilProducts(
    profileId: Record<string, unknown> = PROFILE_WITHOUT_PLACES,
  ): void {
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(SUMMARY);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTS);
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
    http.expectOne('/profiles/patients/me').flush(profileId);
    harness.detectChanges();
  }

  function textOf(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  /**
   * La pantalla dejó de ser sólo de farmacias: la receta manda a la farmacia,
   * pero también a los estudios y a los procedimientos. Las tres pestañas
   * existen; dos todavía no pueden ordenar por cercanía y lo dicen en vez de
   * prometerlo.
   */
  it('abre en Farmacias y ofrece las otras dos sin prometer lo que no hay', async () => {
    await mount();
    respondUntilProducts();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    const tabs = harness.routeNativeElement?.querySelectorAll('[role="tab"]') ?? [];
    expect(Array.from(tabs).map((p) => p.textContent?.trim())).toEqual([
      'Farmacias',
      'Centros de imagenología',
      'Centros médicos',
    ]);
    // La primera es la que se abre: es el único vertical que hoy responde.
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    // Y el panel activo es el de farmacias, no una promesa.
    expect(textOf()).toContain('Sucursal Centro');
  });

  /* ---- carril 19: pestaña en la URL, recorrido, «Cómo llegar», imagenología -- */

  /** Dos órdenes de imagen sin resultado y una de laboratorio que no cuenta. */
  const OWN_ORDERS = {
    patientProfileId: 'pp-1',
    limit: 50,
    truncated: false,
    items: [
      { id: 'o-1', codeConceptId: 'c-rx', categoryConceptId: 'cat-img', statusConceptId: 's-1', createdAt: '2026-10-01T10:00:00Z', hasReleasedResult: false },
      { id: 'o-2', codeConceptId: 'c-eco', statusConceptId: 's-1', createdAt: '2026-10-02T10:00:00Z', hasReleasedResult: false },
      { id: 'o-3', codeConceptId: 'c-hemo', categoryConceptId: 'cat-lab', statusConceptId: 's-1', createdAt: '2026-10-03T10:00:00Z', hasReleasedResult: false },
    ],
  };

  const ORDER_CONCEPTS = {
    items: [
      { conceptId: 'c-rx', code: 'STUDY-RX-TORAX', display: 'Radiografía de tórax', codeSystemVersionId: 'v1' },
      { conceptId: 'c-eco', code: 'STUDY-ECO-ABD', display: 'Ecografía abdominal', codeSystemVersionId: 'v1' },
      { conceptId: 'c-hemo', code: 'STUDY-HEMOGRAMA', display: 'Hemograma', codeSystemVersionId: 'v1' },
      { conceptId: 'cat-img', code: 'SRQ-IMAGING', display: 'Imagenología', codeSystemVersionId: 'v1' },
      { conceptId: 'cat-lab', code: 'SRQ-LAB', display: 'Laboratorio', codeSystemVersionId: 'v1' },
    ],
  };

  const center = (id: string, name: string, complete: boolean, missingStudyConceptIds: string[]) => ({
    id,
    code: id,
    name,
    type: { code: 'DU_TYPE_IMAGING', display: 'Centro de imagenología' },
    siteCount: 1,
    equipmentCount: 1,
    studyCount: 2,
    acceptsExternalOrders: true,
    walkInAvailable: null,
    homeCollectionAvailable: false,
    tenantId: 't-img',
    rating: null,
    ratingCount: 0,
    minAmount: null,
    complete,
    missingStudyConceptIds,
    distanceKm: null,
    addressText: 'Av. Busch 120',
    latitude: -17.77,
    longitude: -63.19,
  });

  it('abre la pestaña que pide la URL y busca todos los estudios de imagen en una sola consulta', async () => {
    await mount('m-1', '?tab=imaging');
    respondUntilProducts();
    http.expectOne((r) => r.url === '/pharmacy-inventory/availability').flush(DISPONIBILIDAD_FIXTURE);
    http.expectOne((r) => r.url === '/diagnostic-results/me/orders').flush(OWN_ORDERS);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(ORDER_CONCEPTS);
    const search = http.expectOne((r) => r.url === '/diagnostic-units/search');
    // El laboratorio no entra: la búsqueda es de imagenología.
    expect(search.request.params.get('studyConceptIds')).toBe('c-rx,c-eco');
    expect(search.request.params.get('kind')).toBe('IMAGING');
    search.flush({
      items: [
        center('u-1', 'Centro de Imagen Sur', true, []),
        center('u-2', 'Imagen Norte', false, ['c-eco']),
      ],
      total: 2,
      limit: 20,
      offset: 0,
    });
    harness.detectChanges();
    showPartial();

    const tabs = harness.routeNativeElement?.querySelectorAll('[role="tab"]') ?? [];
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    expect(textOf()).toContain('Estudios pendientes: Radiografía de tórax, Ecografía abdominal');
    expect(textOf()).toContain('Centro de Imagen Sur');
    expect(textOf()).toContain('Le falta: Ecografía abdominal');
    const directionsLink = harness.routeNativeElement?.querySelector<HTMLAnchorElement>(
      '[data-testid="where-to-buy-imaging-list"] a[href*="openstreetmap.org/directions"]',
    );
    expect(directionsLink?.getAttribute('target')).toBe('_blank');
    expect(directionsLink?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('P-19-4: imagenología abre solo con los centros que tienen todos los estudios', async () => {
    await mount('m-1', '?tab=imaging');
    respondUntilProducts();
    http.expectOne((r) => r.url === '/pharmacy-inventory/availability').flush(DISPONIBILIDAD_FIXTURE);
    http.expectOne((r) => r.url === '/diagnostic-results/me/orders').flush(OWN_ORDERS);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(ORDER_CONCEPTS);
    http.expectOne((r) => r.url === '/diagnostic-units/search').flush({
      items: [center('u-2', 'Imagen Norte', false, ['c-eco'])],
      total: 1,
      limit: 20,
      offset: 0,
    });
    harness.detectChanges();

    expect(textOf()).not.toContain('Imagen Norte');
    expect(textOf()).toContain('Ningún centro tiene hoy todos los estudios que le pidieron.');
    showPartial();
    expect(textOf()).toContain('Imagen Norte');
    expect(textOf()).toContain('Le falta: Ecografía abdominal');
  });

  it('deja la pestaña elegida en la URL', async () => {
    await mount();
    respondUntilProducts();
    http.expectOne((r) => r.url === '/pharmacy-inventory/availability').flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();
    const navigation = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const tabs = harness.routeNativeElement?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [];
    tabs[2]?.click();
    harness.detectChanges();

    expect(navigation).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { tab: 'medical-centers' }, replaceUrl: true }),
    );
    // Abrir Centros médicos es lo que dispara su consulta, y no antes.
    http
      .expectOne((r) => r.url === '/clinical/me/procedure-centers')
      .flush({ procedures: [], centers: [], total: 0, limit: 20 });
  });

  it('carril 19: Centros médicos abre por la URL y busca los centros de mis procedimientos', async () => {
    await mount('m-1', '?tab=medical-centers');
    respondUntilProducts();
    http.expectOne((r) => r.url === '/pharmacy-inventory/availability').flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    const lastQuery = http.expectOne((r) => r.url === '/clinical/me/procedure-centers');
    // Lo que le pidieron no viaja en la URL: sólo el tope (y el origen, si lo hay).
    expect(lastQuery.request.params.keys()).toEqual(['limit']);
    lastQuery.flush({ procedures: [], centers: [], total: 0, limit: 20 });
    harness.detectChanges();

    const tabs = harness.routeNativeElement?.querySelectorAll('[role="tab"]') ?? [];
    expect(tabs[2]?.getAttribute('aria-selected')).toBe('true');
    expect(textOf()).toContain('No tiene procedimientos pendientes.');
    expect(textOf()).not.toContain('Esta parte todavía no está');
  });

  /**
   * Sin procedimientos pendientes, Centros médicos muestra el vacío honesto y la
   * salida al directorio de clínicas tiene que verse (antes desaparecía porque
   * la molécula no proyectaba el enlace).
   */
  it('en Centros médicos, sin procedimientos pendientes, lo dice y ofrece el directorio de clínicas', async () => {
    await mount();
    respondUntilProducts();
    http.expectOne((r) => r.url === '/pharmacy-inventory/availability').flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const tabs = harness.routeNativeElement?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [];
    tabs[2]?.click();
    harness.detectChanges();
    http
      .expectOne((r) => r.url === '/clinical/me/procedure-centers')
      .flush({ procedures: [], centers: [], total: 0, limit: 20 });
    harness.detectChanges();

    expect(textOf()).toContain('No tiene procedimientos pendientes.');
    expect(textOf()).not.toContain('Esta parte todavía no está');
    const links = Array.from(harness.routeNativeElement?.querySelectorAll('a') ?? []);
    expect(links.some((a) => a.textContent?.trim() === 'Ver clínicas y hospitales')).toBe(true);
  });

  it('con una sucursal que tiene todo, la propone sola y lo dice', async () => {
    await mount();
    respondUntilProducts();
    http.expectOne((r) => r.url === '/pharmacy-inventory/availability').flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    expect(
      harness.routeNativeElement?.querySelector('[data-testid="where-to-buy-route-single"]')?.textContent,
    ).toContain('Farmacia Andina · Sucursal Centro tiene todo lo que eligió');
  });

  it('sin ninguna sucursal completa, sugiere el recorrido de menos paradas', async () => {
    await mount();
    respondUntilProducts();
    const [first, second] = DISPONIBILIDAD_FIXTURE.items;
    http.expectOne((r) => r.url === '/pharmacy-inventory/availability').flush({
      ...DISPONIBILIDAD_FIXTURE,
      items: [
        { ...first!, complete: false, missingProductIds: [FIXTURE_IDS.productoIbuprofeno] },
        second!,
      ],
    });
    harness.detectChanges();

    const stops = Array.from(
      harness.routeNativeElement?.querySelectorAll('[data-testid="where-to-buy-stops"] > li') ?? [],
    ).map((li) => li.textContent ?? '');
    expect(stops).toHaveLength(2);
    // La más cercana primero; la que no publica distancia, al final.
    expect(stops[0]).toContain('Sucursal Centro');
    expect(stops[0]).toContain('Aquí: Amoxicilina');
    expect(stops[1]).toContain('Sucursal Plan Tres Mil');
    expect(stops[1]).toContain('Aquí: Ibuprofeno');
  });

  it('muestra las campañas de la farmacia con su etiqueta y pliega las que sobran', async () => {
    await mount();
    respondUntilProducts();
    http.expectOne((r) => r.url === '/pharmacy-inventory/availability').flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    const branch = harness.routeNativeElement?.querySelector('.purchase__branch');
    const visible = branch?.querySelectorAll('[data-testid="where-to-buy-promos"] > li') ?? [];
    // Tres a la vista, cada una con su etiqueta de mecánica y un enlace a su ficha.
    expect(visible).toHaveLength(3);
    for (const row of Array.from(visible)) {
      expect(row.querySelector('app-badge')?.textContent?.trim()).not.toBe('');
      expect(row.querySelector('a[href^="/promotions/"]')).not.toBeNull();
    }
    // El resto queda a un toque y no se pierde ningún enlace.
    const more = branch?.querySelector('[data-testid="where-to-buy-more-promos"]');
    expect(more?.querySelector('summary')?.textContent).toMatch(/Ver \d+ promociones? más/);
    expect(more?.querySelectorAll('a[href^="/promotions/"]').length).toBeGreaterThan(0);
  });

  it('P-19-4: abre solo con las sucursales que tienen todo y muestra las demás a pedido', async () => {
    await mount();
    respondUntilProducts();
    http.expectOne((r) => r.url === '/pharmacy-inventory/availability').flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    const list = () => harness.routeNativeElement?.querySelectorAll('[data-testid="where-to-buy-branches"] > li') ?? [];
    const targetButton = () =>
      harness.routeNativeElement?.querySelector<HTMLButtonElement>(byTestId('where-to-buy-show-partial'));
    expect(list().length).toBe(1);
    expect(list()[0]?.textContent).toContain('Tiene todo');
    expect(targetButton()?.textContent?.trim()).toBe('Ver la que tiene una parte');
    expect(targetButton()?.getAttribute('aria-pressed')).toBe('false');

    showAll();
    expect(list().length).toBe(2);
    expect(targetButton()?.textContent?.trim()).toBe('Mostrar solo las que tienen todo');
    expect(targetButton()?.getAttribute('aria-pressed')).toBe('true');

    showAll();
    expect(list().length).toBe(1);
  });

  it('recorre el contrato E2 entero y pinta completas primero, sin coordenadas', async () => {
    await mount();
    respondUntilProducts();

    const lastQuery = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
    expect(lastQuery.request.params.get('products')).toBe(
      `${FIXTURE_IDS.productoAmoxicilina},${FIXTURE_IDS.productoIbuprofeno}`,
    );
    // Nadie dio una ubicación: la consulta no puede llevarla.
    expect(lastQuery.request.params.has('lat')).toBe(false);
    expect(lastQuery.request.params.has('lng')).toBe(false);
    lastQuery.flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();
    showAll();

    const branches = harness.routeNativeElement?.querySelectorAll('.purchase__branch') ?? [];
    expect(branches).toHaveLength(2);
    // El orden es el del backend: la completa primero, con su total; la
    // parcial dice qué le falta por su nombre y que el total no está.
    expect(branches[0]?.textContent).toContain('Sucursal Centro');
    expect(branches[0]?.textContent).toContain('Tiene todo');
    expect(branches[0]?.textContent).toContain('96.50 Bs');
    expect(branches[0]?.textContent).toContain('1,2 km');
    expect(branches[1]?.textContent).toContain('Le falta algo');
    expect(branches[1]?.textContent).toContain('Le falta: Amoxicilina');
    expect(branches[1]?.textContent).toContain('Total no disponible');
  });

  describe('existencias desactualizadas (REQ-19-011)', () => {
    /** La sede completa del fixture, con sus existencias informadas hace `hours` horas. */
    async function mountWithCenterStockAged(hours: number | null): Promise<void> {
      await mount();
      respondUntilProducts();
      const [complete, partial] = DISPONIBILIDAD_FIXTURE.items;
      const stockUpdatedAt =
        hours === null ? undefined : new Date(Date.now() - hours * 3_600_000).toISOString();
      http.expectOne((r) => r.url === '/pharmacy-inventory/availability').flush({
        ...DISPONIBILIDAD_FIXTURE,
        items: [{ ...complete!, stockUpdatedAt }, partial!],
      });
      harness.detectChanges();
    }

    function statusOf(branch: string): string | undefined {
      return cardOf(branch)
        ?.querySelector('[data-testid="where-to-buy-branch-status"]')
        ?.textContent?.trim();
    }

    it('desactualizado: dice hace cuánto, pide confirmar y no afirma «Tiene todo»', async () => {
      await mountWithCenterStockAged(72);

      expect(
        cardOf('Sucursal Centro')?.querySelector('[data-testid="where-to-buy-stale-stock"]')
          ?.textContent,
      ).toContain('Existencias informadas hace 3 días; confirme con la farmacia antes de ir.');
      expect(statusOf('Sucursal Centro')).toBe('Tenía todo');
      expect(cardOf('Sucursal Centro')?.textContent).not.toContain('Tiene todo');
    });

    it('fresco: sin aviso, y la sede completa sigue diciendo «Tiene todo»', async () => {
      await mountWithCenterStockAged(2);

      expect(queryAll('[data-testid="where-to-buy-stale-stock"]')).toHaveLength(0);
      expect(statusOf('Sucursal Centro')).toBe('Tiene todo');
    });

    it('sin fecha: el comportamiento de siempre', async () => {
      await mountWithCenterStockAged(null);

      expect(queryAll('[data-testid="where-to-buy-stale-stock"]')).toHaveLength(0);
      expect(statusOf('Sucursal Centro')).toBe('Tiene todo');
    });
  });

  it('el mapa recibe un pin por sede ubicable, y la sede sin coordenadas lo dice', async () => {
    await mount();
    respondUntilProducts();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();
    showAll();
    // El montaje de Leaflet es diferido: dos microtareas y otro render.
    await Promise.resolve();
    await Promise.resolve();
    harness.detectChanges();

    expect(harness.routeNativeElement?.querySelector('app-map')).not.toBeNull();
    // La fixture trae la sede Centro con coordenadas y la Sur sin: un solo pin.
    expect(mapMarkers).toHaveLength(1);
    expect(mapMarkers[0].alt).toContain('Sucursal Centro');
    expect(mapMarkers[0].icono.textContent).toBe('A');
    expect(textOf()).toContain('Ubicación no disponible en el mapa');
    // El rótulo normativo (PAC-MED-005) sigue al pie del mapa.
    expect(textOf()).toContain('en línea recta');
  });

  it('no muestra ningún identificador: todo viaja por nombre', async () => {
    await mount();
    respondUntilProducts();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    expect(textOf()).not.toMatch(UUID);
  });

  it('«Enviar pedido» arma el borrador real de la sede y lleva a confirmarlo', async () => {
    await mount();
    respondUntilProducts();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();
    showAll();

    expect(
      harness.routeNativeElement?.querySelector('[data-testid="where-to-buy-demo-notice"]'),
    ).toBeNull();
    const buttons = harness.routeNativeElement?.querySelectorAll<HTMLButtonElement>(
      '[data-testid="where-to-buy-send-order"]',
    );
    expect(buttons).toHaveLength(2);
    for (const targetButton of buttons ?? []) {
      expect(targetButton.getAttribute('aria-disabled')).not.toBe('true');
    }

    const navigation = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    buttons?.[0]?.click();
    harness.detectChanges();

    // El borrador queda en el cliente de pedidos — nada viaja por la URL.
    const orderDraft = TestBed.inject(PharmacyOrdersClient).borradorPreparado();
    expect(orderDraft?.farmacia).toBe('Farmacia Andina');
    expect(orderDraft?.sede).toBe('Sucursal Centro');
    expect(navigation).toHaveBeenCalledWith(['/my-account/pharmacy-orders/new']);
  });

  /* ─── Carril 43 · H5: la salida nueva, al lado de «Enviar pedido» ───────── */

  /** Los botones «Agregar la receta al carrito», en el orden de las tarjetas. */
  function cartButtons(): HTMLButtonElement[] {
    return [
      ...(harness.routeNativeElement?.querySelectorAll<HTMLButtonElement>(
        '[data-testid="where-to-buy-add-to-cart"]',
      ) ?? []),
    ];
  }

  it('«Agregar la receta al carrito» deja el carrito de esa sede, con la receta', async () => {
    await mount();
    respondUntilProducts();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    const navigation = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    cartButtons()[0]?.click();
    harness.detectChanges();

    const currentCart = TestBed.inject(CartStore).cart();
    expect(currentCart?.site.siteName).toBe('Sucursal Centro');
    expect(currentCart?.requestId).toBe('m-1');
    expect(currentCart?.lines.map((line) => line.name)).toEqual(['Amoxicilina', 'Ibuprofeno']);
    expect(navigation).toHaveBeenCalledWith('/my-account/pharmacy/cart');
  });

  it('avisa por su nombre lo que la sede no pudo agregar', async () => {
    await mount();
    respondUntilProducts();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();
    showAll();

    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    // La segunda tarjeta es la sede parcial: le falta la amoxicilina.
    cartButtons()[1]?.click();
    harness.detectChanges();

    const notice = harness.routeNativeElement?.querySelector(
      '[data-testid="where-to-buy-cart-notice"]',
    );
    expect(notice?.textContent).toContain('Amoxicilina');
    expect(TestBed.inject(CartStore).cart()?.lines).toHaveLength(1);
  });

  it('con un carrito de otra farmacia pregunta, y cancelar no cambia nada', async () => {
    await mount();
    respondUntilProducts();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    const cart = TestBed.inject(CartStore);
    cart.replaceWith(
      {
        pharmacyId: 'otra-farmacia',
        pharmacyName: 'Otra Farmacia',
        siteId: 'otra-sede',
        siteName: 'Otra Sucursal',
        addressText: null,
      },
      [
        {
          productId: 'otro-producto',
          name: 'Otro producto',
          presentation: null,
          quantity: 1,
          unitAmount: '5.00',
          currency: 'BOB',
          requiresPrescription: false,
          medicationConceptId: null,
        },
      ],
      null,
    );
    const confirmButton = vi
      .spyOn(TestBed.inject(DialogService), 'confirm')
      .mockResolvedValue(false);
    const navigation = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);

    cartButtons()[0]?.click();
    await Promise.resolve();
    harness.detectChanges();

    expect(confirmButton).toHaveBeenCalledOnce();
    expect(cart.cart()?.site.siteId).toBe('otra-sede');
    expect(cart.cart()?.lines.map((line) => line.name)).toEqual(['Otro producto']);
    expect(navigation).not.toHaveBeenCalled();
  });

  it('confirmando, el carrito de la otra farmacia se reemplaza por la receta', async () => {
    await mount();
    respondUntilProducts();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    const cart = TestBed.inject(CartStore);
    cart.replaceWith(
      {
        pharmacyId: 'otra-farmacia',
        pharmacyName: 'Otra Farmacia',
        siteId: 'otra-sede',
        siteName: 'Otra Sucursal',
        addressText: null,
      },
      [
        {
          productId: 'otro-producto',
          name: 'Otro producto',
          presentation: null,
          quantity: 1,
          unitAmount: '5.00',
          currency: 'BOB',
          requiresPrescription: false,
          medicationConceptId: null,
        },
      ],
      null,
    );
    vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
    const navigation = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);

    cartButtons()[0]?.click();
    await Promise.resolve();
    harness.detectChanges();

    expect(cart.cart()?.site.siteId).toBe(FIXTURE_IDS.sedeCentro);
    expect(cart.cart()?.requestId).toBe('m-1');
    expect(navigation).toHaveBeenCalledWith('/my-account/pharmacy/cart');
  });

  it('no toca la geolocalización al entrar; el botón la pide y reconsulta con lat/lng', async () => {
    await mount();
    respondUntilProducts();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    // Entrar a la pantalla no dispara el diálogo de permisos del navegador.
    expect(getCurrentPosition).not.toHaveBeenCalled();

    getCurrentPosition.mockImplementation(
      (success: (position: { coords: { latitude: number; longitude: number } }) => void) =>
        success({ coords: { latitude: -17.7833, longitude: -63.1821 } }),
    );
    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[data-testid="where-to-buy-share-location"]')
      ?.click();
    harness.detectChanges();

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    const lastQuery = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
    expect(lastQuery.request.params.get('lat')).toBe('-17.7833');
    expect(lastQuery.request.params.get('lng')).toBe('-63.1821');
    lastQuery.flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    expect(textOf()).toContain('Distancias medidas desde su ubicación actual');
  });

  describe('location that cannot be read', () => {
    function buttonByLabel(label: string): HTMLButtonElement | undefined {
      return Array.from(
        harness.routeNativeElement?.querySelectorAll<HTMLButtonElement>('button') ?? [],
      ).find((button) => button.textContent?.trim() === label);
    }

    function shareLocation(): void {
      harness.routeNativeElement
        ?.querySelector<HTMLButtonElement>(byTestId('where-to-buy-share-location'))
        ?.click();
      harness.detectChanges();
    }

    async function mountWithAvailability(): Promise<void> {
      await mount();
      respondUntilProducts();
      http
        .expectOne((r) => r.url === '/pharmacy-inventory/availability')
        .flush(DISPONIBILIDAD_FIXTURE);
      harness.detectChanges();
    }

    /** Whatever the reason the location is missing, measuring from a city must still work. */
    function expectCitiesStillUsable(): void {
      const city = buttonByLabel('La Paz');
      expect(city).toBeDefined();
      expect(city?.disabled).toBe(false);

      city?.click();
      harness.detectChanges();

      const query = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
      expect(query.request.params.get('lat')).toBe('-16.4957');
      expect(query.request.params.get('lng')).toBe('-68.1335');
      query.flush(DISPONIBILIDAD_FIXTURE);
      harness.detectChanges();

      expect(textOf()).toContain('Distancias medidas desde La Paz');
      expect(textOf()).not.toContain('No pudimos leer su ubicación');
    }

    it('shows the notice and keeps the cities usable when the permission is denied', async () => {
      await mountWithAvailability();
      expect(textOf()).not.toContain('No pudimos leer su ubicación');

      getCurrentPosition.mockImplementation(
        (_success: unknown, failure: (error: { code: number }) => void) =>
          failure({ code: 1 }),
      );
      shareLocation();

      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
      expect(textOf()).toContain('No pudimos leer su ubicación');
      expect(
        harness.routeNativeElement?.querySelector('[role="status"]')?.textContent,
      ).toContain('No pudimos leer su ubicación');
      // No position was obtained, so nothing re-queries availability.
      http.expectNone((r) => r.url === '/pharmacy-inventory/availability');
      expect(
        harness.routeNativeElement
          ?.querySelector<HTMLButtonElement>(byTestId('where-to-buy-share-location'))
          ?.disabled,
      ).toBe(false);

      expectCitiesStillUsable();
    });

    it('shows the notice without throwing when the browser has no geolocation', async () => {
      Object.defineProperty(window.navigator, 'geolocation', {
        configurable: true,
        value: undefined,
      });
      await mountWithAvailability();

      expect(() => shareLocation()).not.toThrow();

      expect(getCurrentPosition).not.toHaveBeenCalled();
      expect(textOf()).toContain('No pudimos leer su ubicación');
      http.expectNone((r) => r.url === '/pharmacy-inventory/availability');

      expectCitiesStillUsable();
    });
  });

  it('destildar un renglón lo saca de la consulta', async () => {
    await mount();
    respondUntilProducts();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    const checkboxes =
      harness.routeNativeElement?.querySelectorAll<HTMLInputElement>(
        '[data-testid="where-to-buy-items"] input[type="checkbox"]',
      ) ?? [];
    expect(checkboxes).toHaveLength(2);
    checkboxes[1].checked = false;
    checkboxes[1].dispatchEvent(new Event('change'));
    harness.detectChanges();

    const lastQuery = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
    expect(lastQuery.request.params.get('products')).toBe(FIXTURE_IDS.productoAmoxicilina);
    lastQuery.flush(DISPONIBILIDAD_FIXTURE);
  });

  it('un medicamento sin producto publicado se dice, y ninguna sede queda completa', async () => {
    await mount();
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(SUMMARY);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTS);
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
    http.expectOne('/profiles/patients/me').flush(PROFILE_WITHOUT_PLACES);
    harness.detectChanges();

    const lastQuery = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
    // Sólo viaja lo consultable.
    expect(lastQuery.request.params.get('products')).toBe(FIXTURE_IDS.productoAmoxicilina);
    lastQuery.flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();
    showAll();

    expect(textOf()).toContain('No todo se pudo consultar');
    expect(textOf()).toContain('Ibuprofeno');
    // La «completa» del backend no alcanza: la receta entera no se pudo
    // consultar, así que nadie puede declararse con todo.
    expect(textOf()).not.toContain('Tiene todo');

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[data-testid="where-to-buy-send-order"]')
      ?.click();
    harness.detectChanges();
    const draft = TestBed.inject(PharmacyOrdersClient).borradorPreparado();
    expect(draft?.lineas).toHaveLength(2);
    expect(draft?.lineas.find((line) => line.medicamento === 'Ibuprofeno')?.productId).toBeNull();
    expect(navigate).toHaveBeenCalled();
  });

  it('un error HTTP de productos queda como error recuperable, no como ausencia', async () => {
    await mount();
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(SUMMARY);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTS);
    http
      .expectOne(
        (r) =>
          r.url === '/pharmacy/products' &&
          r.params.get('conceptId') === FIXTURE_IDS.conceptoAmoxicilina,
      )
      .flush(productosDelConcepto(FIXTURE_IDS.conceptoAmoxicilina));
    http.expectOne('/profiles/patients/me').flush(PROFILE_WITHOUT_PLACES);
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
    expect(textOf()).toContain('Un servicio no está disponible');
    expect(textOf()).toContain('Reintentar');
    expect(textOf()).not.toContain('Sin producto publicado');
    expect(TestBed.inject(PharmacyOrdersClient).borradorPreparado()).toBeNull();

    const retry = [...(harness.routeNativeElement?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent?.includes('Reintentar'),
    );
    expect(retry).toBeDefined();
    retry?.click();
    http
      .expectOne((request) => request.url === '/clinical/patients/pp-1/summary')
      .flush({ ...SUMMARY, medicationRequests: [] });
    harness.detectChanges();
  });

  it('una receta que no está en la historia no dispara ninguna consulta a farmacias', async () => {
    await mount('m-inexistente');
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(SUMMARY);
    harness.detectChanges();

    expect(harness.routeNativeElement?.querySelector('[data-testid="where-to-buy-items"]')).toBeNull();
    // `http.verify()` del afterEach confirma que no salió nada más.
  });

  /**
   * La casa declarada en el perfil alimenta la búsqueda sin pedir el GPS
   * (subtarea B.2).
   */
  describe('el domicilio guardado mide la primera búsqueda', () => {
    it('con casa guardada, la primera consulta de disponibilidad ya lleva su origen', async () => {
      await mount();
      respondUntilProducts(PROFILE_WITH_HOME);

      const lastQuery = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
      expect(lastQuery.request.params.get('lat')).toBe('-17.78');
      expect(lastQuery.request.params.get('lng')).toBe('-63.18');
      lastQuery.flush(DISPONIBILIDAD_FIXTURE);
      harness.detectChanges();

      expect(textOf()).toContain('Distancias medidas desde su casa');
      // Con un origen ya elegido, la sección muestra el aviso y «Dejar de usar
      // este punto» — no los botones de elección, que viven en la otra rama.
      expect(
        harness.routeNativeElement?.querySelector('[data-testid="where-to-buy-origin-home"]'),
      ).toBeNull();
      expect(harness.routeNativeElement?.querySelector('[data-testid="where-to-buy-origin"]')).not.toBeNull();
    });

    it('sin lugares guardados, las ciudades siguen intactas y sin origen por defecto', async () => {
      await mount();
      respondUntilProducts(PROFILE_WITHOUT_PLACES);

      const lastQuery = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
      expect(lastQuery.request.params.has('lat')).toBe(false);
      lastQuery.flush(DISPONIBILIDAD_FIXTURE);
      harness.detectChanges();

      expect(
        harness.routeNativeElement?.querySelector('[data-testid="where-to-buy-origin-home"]'),
      ).toBeNull();
      expect(
        harness.routeNativeElement?.querySelector('[data-testid="where-to-buy-origin-work"]'),
      ).toBeNull();
      expect(textOf()).toContain('Santa Cruz de la Sierra');
    });

    it('el perfil en error deja el recorrido tal como estaba, sin origen por defecto', async () => {
      await mount();
      http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(SUMMARY);
      http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTS);
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

      const lastQuery = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
      expect(lastQuery.request.params.has('lat')).toBe(false);
      lastQuery.flush(DISPONIBILIDAD_FIXTURE);
      harness.detectChanges();

      expect(textOf()).toContain('Compartir mi ubicación');
    });
  });

  /* ---- T-E2 · orden y variante con seguro ---------------------------------- */

  /** Monta la pantalla con las tres sedes ya pintadas. */
  async function mountWithThreeSites(): Promise<void> {
    await mount();
    respondUntilProducts();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(AVAILABILITY_WITH_NORTH);
    harness.detectChanges();
    showAll();
  }

  function queryOne<T extends Element>(selector: string): T | null {
    return harness.routeNativeElement?.querySelector<T>(selector) ?? null;
  }

  function queryAll(selector: string): Element[] {
    return [...(harness.routeNativeElement?.querySelectorAll(selector) ?? [])];
  }

  /** Los nombres de las sedes, en el orden en que se ven. */
  function branchesOnScreen(): string[] {
    return queryAll('.purchase__branch .purchase__primary').map((node) => node.textContent?.trim() ?? '');
  }

  function cardOf(branch: string): Element | undefined {
    return queryAll('.purchase__branch').find((card) => card.textContent?.includes(branch));
  }

  function elegirOrden(value: 'complete-first' | 'nearest' | 'cheapest'): void {
    queryOne<HTMLButtonElement>(`[data-testid="segmentado-${value}"]`)?.click();
    harness.detectChanges();
  }

  function toggleInsurance(): void {
    queryOne<HTMLInputElement>('[data-testid="where-to-buy-insurance"] input[type="checkbox"]')?.click();
    harness.detectChanges();
  }

  it('contra la API real no ofrece la variante con seguro: la lista es la de la consulta', async () => {
    sampleData = false;
    await mountWithThreeSites();

    expect(queryOne(byTestId('where-to-buy-insurance-variant'))).toBeNull();
    expect(queryOne(byTestId('where-to-buy-insurance'))).toBeNull();
    expect(textOf()).not.toContain('Demostración');
    expect(queryAll(byTestId('where-to-buy-item-insurance'))).toHaveLength(0);
    // Lo que sí es de la API sigue igual: las tres sedes y el orden.
    expect(branchesOnScreen()).toEqual([
      'Farmacia Andina · Sucursal Centro',
      'Farmacia del Sur · Sucursal Plan Tres Mil',
      'Farmacia del Sur · Sucursal Norte',
    ]);
    expect(queryOne('[data-testid="where-to-buy-sort"]')).not.toBeNull();
  });

  it('sin seguro: abre con el orden del backend y la tarjeta no habla del seguro', async () => {
    await mountWithThreeSites();

    expect(branchesOnScreen()).toEqual([
      'Farmacia Andina · Sucursal Centro',
      'Farmacia del Sur · Sucursal Plan Tres Mil',
      'Farmacia del Sur · Sucursal Norte',
    ]);
    expect(
      queryOne('[data-testid="segmentado-complete-first"]')?.getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      queryOne<HTMLInputElement>('[data-testid="where-to-buy-insurance"] input[type="checkbox"]')?.checked,
    ).toBe(false);
    // Ningún rastro de la variante: la pantalla de siempre.
    expect(queryAll('[data-testid="where-to-buy-insurance-coverage"]')).toHaveLength(0);
    expect(queryAll('[data-testid="where-to-buy-insurance-breakdown"]')).toHaveLength(0);
    expect(queryAll('[data-testid="where-to-buy-item-insurance"]')).toHaveLength(0);
    expect(cardOf('Sucursal Centro')?.textContent).toContain('Tiene todo');
    expect(cardOf('Plan Tres Mil')?.textContent).toContain('Le falta: Amoxicilina');
  });

  it('«Más cerca» y «Más barato» reacomodan la lista sin volver a consultar', async () => {
    await mountWithThreeSites();

    elegirOrden('nearest');
    // 1,2 km, 2,5 km, y la que no tiene distancia al final.
    expect(branchesOnScreen()).toEqual([
      'Farmacia Andina · Sucursal Centro',
      'Farmacia del Sur · Sucursal Norte',
      'Farmacia del Sur · Sucursal Plan Tres Mil',
    ]);

    elegirOrden('cheapest');
    // 28.50, 96.50, y la que no tiene total al final.
    expect(branchesOnScreen()).toEqual([
      'Farmacia del Sur · Sucursal Norte',
      'Farmacia Andina · Sucursal Centro',
      'Farmacia del Sur · Sucursal Plan Tres Mil',
    ]);

    elegirOrden('complete-first');
    expect(branchesOnScreen()).toEqual([
      'Farmacia Andina · Sucursal Centro',
      'Farmacia del Sur · Sucursal Plan Tres Mil',
      'Farmacia del Sur · Sucursal Norte',
    ]);
    // Ordenar es de la pantalla: no sale otra consulta.
    http.expectNone((r) => r.url === '/pharmacy-inventory/availability');
  });

  it('con seguro: cobertura de lo aprobado, desglose «aprobado / a su cargo» y renglones rotulados', async () => {
    await mountWithThreeSites();
    toggleInsurance();

    // De ejemplo: la amoxicilina entra en el seguro; el ibuprofeno (último renglón) no.
    const itemRows = queryAll('[data-testid="where-to-buy-item-insurance"]').map((node) =>
      node.textContent?.trim(),
    );
    expect(itemRows).toEqual(['Aprobado por el seguro', 'A su cargo']);
    expect(textOf()).toContain('Demostración');

    const center = cardOf('Sucursal Centro');
    expect(center?.textContent).toContain('Cobertura de lo aprobado: 1 de 1');
    expect(center?.textContent).toContain('Tiene todo lo aprobado');
    expect(
      center
        ?.querySelector('[data-testid="where-to-buy-insurance-breakdown"]')
        ?.textContent?.replace(/\s+/g, ' '),
    ).toContain('Aprobado: 68.00 Bs A su cargo: 28.50 Bs');

    const planThreeThousand = cardOf('Plan Tres Mil');
    expect(planThreeThousand?.textContent).toContain('Cobertura de lo aprobado: 0 de 1');
    expect(planThreeThousand?.textContent).toContain('Le falta de lo aprobado: Amoxicilina');
    expect(planThreeThousand?.textContent).toContain('Le falta algo aprobado');
    // El ibuprofeno está pero sin precio publicado: se dice, no se estima.
    expect(planThreeThousand?.textContent).toContain('A su cargo: no disponible, falta algún precio');
    // La sede no publica moneda: el importe va sin ella, no con una supuesta.
    expect(planThreeThousand?.textContent).toContain('Aprobado: 0.00');

    const north = cardOf('Sucursal Norte');
    expect(north?.textContent).toContain('Cobertura de lo aprobado: 0 de 1');
    expect(north?.textContent).toContain('A su cargo: 28.50 Bs');

    // El total de la sede no cambia: el desglose se suma, no lo reemplaza.
    expect(center?.textContent).toContain('Total estimado: 96.50 Bs');
    // Conmutar no consulta.
    http.expectNone((r) => r.url === '/pharmacy-inventory/availability');

    // Apagarlo devuelve la pantalla de siempre.
    toggleInsurance();
    expect(queryAll('[data-testid="where-to-buy-insurance-coverage"]')).toHaveLength(0);
    expect(cardOf('Sucursal Centro')?.textContent).toContain('Tiene todo');
  });

  it('con seguro el mapa dice lo mismo que las tarjetas', async () => {
    await mountWithThreeSites();
    await Promise.resolve();
    await Promise.resolve();
    harness.detectChanges();

    toggleInsurance();
    await Promise.resolve();
    harness.detectChanges();

    // El mapa se redibuja con los pines de la variante: los dos últimos.
    const pins = mapMarkers.slice(-2);
    expect(pins.map((pin) => pin.alt)).toEqual([
      'Farmacia Andina · Sucursal Centro',
      'Farmacia del Sur · Sucursal Norte',
    ]);
    for (const pin of pins) {
      const card = cardOf(pin.alt.split(' · ')[1]);
      const state = pin.popup?.querySelector('.mapa__popup-estado')?.textContent ?? '';
      const detail = pin.popup?.querySelector('.mapa__popup-detalle')?.textContent ?? '';
      const coverage =
        card?.querySelector('[data-testid="where-to-buy-insurance-coverage"]')?.textContent?.trim() ??
        '';
      // El badge de estado vive en las acciones de la tarjeta: las campañas de la
      // farmacia también llevan su `app-badge` y ya no es el primero del DOM.
      expect(card?.querySelector('.purchase__actions app-badge')?.textContent?.trim()).toBe(state);
      expect(detail.startsWith(coverage)).toBe(true);
    }
    expect(pins[0].popup?.querySelector('.mapa__popup-estado')?.textContent).toBe(
      'Tiene todo lo aprobado',
    );
    expect(pins[0].icono.className).toContain('mapa__pin--success');
    expect(pins[1].icono.className).toContain('mapa__pin--warning');
  });

  it('con seguro y ningún renglón aprobado incluido: vacío honesto que deja apagar la variante', async () => {
    await mountWithThreeSites();
    toggleInsurance();

    // Se destilda la amoxicilina, el único renglón aprobado de ejemplo.
    const checkboxes = queryAll(
      '[data-testid="where-to-buy-items"] input[type="checkbox"]',
    ) as HTMLInputElement[];
    checkboxes[0].checked = false;
    checkboxes[0].dispatchEvent(new Event('change'));
    harness.detectChanges();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(AVAILABILITY_WITH_NORTH);
    harness.detectChanges();

    expect(textOf()).toContain('ninguno de los medicamentos que eligió está aprobado');
    expect(textOf()).toContain('Volver a mi historia');
    expect(queryAll('.purchase__branch')).toHaveLength(0);
    // El conmutador sigue a mano: el vacío no encierra a nadie.
    expect(queryOne('[data-testid="where-to-buy-insurance"]')).not.toBeNull();

    toggleInsurance();
    expect(queryAll('.purchase__branch')).toHaveLength(3);
    http.expectNone((r) => r.url === '/pharmacy-inventory/availability');
  });

  it('con seguro, ninguna sede que confirme sigue siendo el vacío de siempre', async () => {
    await mount();
    respondUntilProducts();
    toggleInsurance();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush({ requestedProductIds: [], items: [], count: 0 });
    harness.detectChanges();

    expect(textOf()).toContain(
      'Ninguna sucursal puede confirmar hoy los medicamentos de su receta.',
    );
    expect(textOf()).not.toContain('ninguno de los medicamentos que eligió está aprobado');
  });

  it('con seguro, un error de disponibilidad queda como error recuperable', async () => {
    await mount();
    respondUntilProducts();
    toggleInsurance();
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

    expect(textOf()).toContain('Un servicio no está disponible');
    expect(queryAll('.purchase__branch')).toHaveLength(0);
    const retryButton = (queryAll('button') as HTMLButtonElement[]).find((targetButton) =>
      targetButton.textContent?.includes('Reintentar'),
    );
    expect(retryButton).toBeDefined();
    retryButton?.click();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(AVAILABILITY_WITH_NORTH);
    harness.detectChanges();

    expect(cardOf('Sucursal Centro')?.textContent).toContain('Cobertura de lo aprobado: 1 de 1');
  });

  it('con seguro y otro orden, el CTA arma el borrador real de esa sede, navega y no crea el pedido', async () => {
    await mountWithThreeSites();
    toggleInsurance();
    elegirOrden('cheapest');

    const ordersClient = TestBed.inject(PharmacyOrdersClient);
    const sendButton = vi.spyOn(ordersClient, 'enviar');
    const navigation = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const buttons = queryAll('[data-testid="where-to-buy-send-order"]') as HTMLButtonElement[];
    // El rótulo no cambia (DEUDA-T-E2-01 queda fuera de esta tarea).
    expect(buttons.map((targetButton) => targetButton.textContent?.trim())).toEqual([
      'Enviar pedido',
      'Enviar pedido',
      'Enviar pedido',
    ]);
    buttons[0].click();
    harness.detectChanges();

    // La primera tarjeta con «Más barato» es la Norte: el borrador es el suyo,
    // idéntico al que arma la vista sin seguro — la variante no viaja.
    expect(ordersClient.borradorPreparado()).toEqual(
      orderDraftOf('m-1', NORTH_SITE, QUERYABLE, []),
    );
    expect(navigation).toHaveBeenCalledWith(['/my-account/pharmacy-orders/new']);
    expect(sendButton).not.toHaveBeenCalled();
    // Ni POST, ni PUT, ni PATCH: el pedido lo crea el checkout.
    http.expectNone((r) => r.method !== 'GET');
    http.expectNone((r) => r.url.startsWith('/pharmacy/orders'));
  });
});

describe('sortBranches (T-E2)', () => {
  interface Row {
    readonly id: string;
    readonly distanceKm: number | null;
    readonly totalCents: number | null;
  }

  const row = (id: string, distanceKm: number | null, totalCents: number | null): Row => ({
    id,
    distanceKm,
    totalCents,
  });

  const ids = (rows: readonly Row[]) => rows.map((f) => f.id);

  it('«Receta completa primero» devuelve la lista del backend tal cual', () => {
    const branches = [row('b', 3, 10), row('a', 1, 5)];
    expect(sortBranches(branches, 'complete-first')).toBe(branches);
  });

  it('«Más cerca»: ascendente, 0 vale, ausentes e inválidos al final y empates estables', () => {
    const branches = [
      row('a', 2, null),
      row('sin', null, null),
      row('cero', 0, null),
      row('nan', Number.NaN, null),
      row('e1', 1, null),
      row('e2', 1, null),
      row('inf', Number.POSITIVE_INFINITY, null),
      row('neg', -1, null),
    ];
    expect(ids(sortBranches(branches, 'nearest'))).toEqual([
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
    const branches = [
      row('caro', null, 9650),
      row('sin', null, null),
      row('igual-1', null, 2850),
      row('gratis', null, 0),
      row('igual-2', null, 2850),
    ];
    expect(ids(sortBranches(branches, 'cheapest'))).toEqual([
      'gratis',
      'igual-1',
      'igual-2',
      'caro',
      'sin',
    ]);
  });

  it('no muta la lista recibida', () => {
    const branches = Object.freeze([row('lejos', 9, 1), row('cerca', 1, 9)]);
    const before = ids(branches);
    const sorted = sortBranches(branches, 'nearest');
    expect(ids(sorted)).toEqual(['cerca', 'lejos']);
    expect(sorted).not.toBe(branches);
    expect(ids(branches)).toEqual(before);
  });
});

describe('insuredCoverageOf (T-E2)', () => {
  const [COMPLETE_SITE, PARTIAL_SITE] = DISPONIBILIDAD_FIXTURE.items;
  const amoxicillinOnly = new Set([FIXTURE_IDS.conceptoAmoxicilina]);

  it('parte el precio de lo disponible en aprobado y a su cargo', () => {
    const coverage = insuredCoverageOf(COMPLETE_SITE, QUERYABLE, [], amoxicillinOnly);
    expect(coverage).toEqual({
      approvedCount: 1,
      coveredCount: 1,
      complete: true,
      missing: [],
      approved: '68.00 Bs',
      outOfPocket: '28.50 Bs',
    });
  });

  it('todo aprobado: nada a su cargo es 0.00, no una ausencia', () => {
    const everything = new Set(QUERYABLE.map((item) => item.conceptId));
    const coverage = insuredCoverageOf(COMPLETE_SITE, QUERYABLE, [], everything);
    expect(coverage.approved).toBe('96.50 Bs');
    expect(coverage.outOfPocket).toBe('0.00 Bs');
    expect(coverage.coveredCount).toBe(2);
  });

  it('un aprobado faltante no suma y se nombra; un precio ausente deja la parte en null', () => {
    const coverage = insuredCoverageOf(PARTIAL_SITE, QUERYABLE, [], amoxicillinOnly);
    expect(coverage.complete).toBe(false);
    expect(coverage.coveredCount).toBe(0);
    expect(coverage.missing).toEqual(['Amoxicilina']);
    expect(coverage.approved).toBe('0.00');
    expect(coverage.outOfPocket).toBeNull();
  });

  it('un aprobado sin producto publicado cuenta en «de M» y falta', () => {
    const paracetamol: PrescriptionItem = {
      conceptId: 'concepto-paracetamol',
      medication: 'Paracetamol',
      instructions: '',
      issued: true,
      productId: null,
    };
    const coverage = insuredCoverageOf(
      COMPLETE_SITE,
      QUERYABLE,
      [paracetamol],
      new Set([FIXTURE_IDS.conceptoAmoxicilina, 'concepto-paracetamol']),
    );
    expect(coverage.approvedCount).toBe(2);
    expect(coverage.coveredCount).toBe(1);
    expect(coverage.complete).toBe(false);
    expect(coverage.missing).toEqual(['Paracetamol']);
  });

  it('suma en centavos y no mezcla monedas', () => {
    const withPrices = (prices: readonly [string, string, string]): AvailabilitySite => ({
      ...COMPLETE_SITE,
      products: COMPLETE_SITE.products.map((product, index) => ({
        ...product,
        price: {
          unitAmount: prices[index],
          patientAmount: prices[index],
          currency: { code: index === 1 ? prices[2] : 'BOB', display: '' },
          priceListCode: 'X',
        },
      })),
    });
    const everything = new Set(QUERYABLE.map((item) => item.conceptId));

    expect(
      insuredCoverageOf(withPrices(['0.10', '0.20', 'BOB']), QUERYABLE, [], everything).approved,
    ).toBe('0.30 Bs');
    expect(
      insuredCoverageOf(withPrices(['0.10', '0.20', 'USD']), QUERYABLE, [], everything).approved,
    ).toBeNull();
    expect(
      insuredCoverageOf(withPrices(['10', 'no-es-importe', 'BOB']), QUERYABLE, [], everything)
        .approved,
    ).toBeNull();
  });
});

describe('sampleInsuranceApprovals (T-E2, datos de ejemplo)', () => {
  it('con un renglón lo aprueba; con más, el último queda a cargo de la persona', () => {
    expect([...sampleInsuranceApprovals([])]).toEqual([]);
    expect([...sampleInsuranceApprovals(['a'])]).toEqual(['a']);
    expect([...sampleInsuranceApprovals(['a', 'b', 'c'])]).toEqual(['a', 'b']);
  });
});

describe('orderDraftOf (FAR-I2)', () => {
  it('con la sede completa: cada renglón con su presentación, su precio y su moneda', () => {
    const orderDraft = orderDraftOf('m-1', DISPONIBILIDAD_FIXTURE.items[0], QUERYABLE, []);

    expect(orderDraft.farmacia).toBe('Farmacia Andina');
    expect(orderDraft.sede).toBe('Sucursal Centro');
    expect(orderDraft.requestId).toBe('m-1');
    expect(orderDraft.totalEstimado).toBe('96.50');
    expect(orderDraft.moneda).toBe('BOB');
    expect(orderDraft.lineas).toHaveLength(2);
    expect(orderDraft.lineas[0]).toEqual({
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
    const orderDraft = orderDraftOf('m-1', DISPONIBILIDAD_FIXTURE.items[1], QUERYABLE, []);

    // La amoxicilina está en `missingProductIds`: viaja como no disponible.
    const amoxicillin = orderDraft.lineas[0];
    expect(amoxicillin.disponible).toBe(false);
    expect(amoxicillin.precio).toBeNull();
    // El ibuprofeno está, pero la sede no publica su precio: se dice, no se estima.
    const ibuprofen = orderDraft.lineas[1];
    expect(ibuprofen.disponible).toBe(true);
    expect(ibuprofen.precio).toBeNull();
    expect(orderDraft.totalEstimado).toBeNull();
  });

  it('un medicamento sin producto publicado entra como renglón no disponible', () => {
    const orderDraft = orderDraftOf('m-1', DISPONIBILIDAD_FIXTURE.items[0], QUERYABLE, [
      'Paracetamol',
    ]);

    const loose = orderDraft.lineas.at(-1);
    expect(loose).toEqual({
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
    const declared = new Set(
      [...readFileSync('src/styles.css', 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/g)].map(
        (match) => match[1],
      ),
    );
    const used = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1]);
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((token) => !declared.has(token))).toEqual([]);
  });

  it('sin colores a mano: ni hex de relleno ni blanco sobre aguamarina', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

/* ─── Carril 43 · H5: la receta entra al carrito ─────────────────────────────
   Los casos de arriba NO se tocaron: «Enviar pedido» sigue haciendo lo mismo
   y con el mismo `data-testid`. Lo que sigue prueba la salida nueva. */

describe('cartLinesFromDraft (carril 43 · H5)', () => {
  it('deja afuera lo que la sede no puede confirmar y lo devuelve por su nombre', () => {
    // La sede parcial: la amoxicilina está en `missingProductIds`.
    const orderDraft = orderDraftOf('m-1', DISPONIBILIDAD_FIXTURE.items[1], QUERYABLE, []);

    const { lines, omitted } = cartLinesFromDraft(orderDraft);

    expect(lines.map((line) => line.productId)).toEqual([FIXTURE_IDS.productoIbuprofeno]);
    expect(omitted).toEqual(['Amoxicilina']);
  });

  it('deja afuera el medicamento sin producto publicado', () => {
    const orderDraft = orderDraftOf('m-1', DISPONIBILIDAD_FIXTURE.items[0], QUERYABLE, [
      'Paracetamol',
    ]);

    const { lines, omitted } = cartLinesFromDraft(orderDraft);

    // Una línea sin `productId` haría explotar `createOrderRequest` después.
    expect(lines.every((line) => line.productId !== '')).toBe(true);
    expect(lines).toHaveLength(2);
    expect(omitted).toEqual(['Paracetamol']);
  });

  it('cada línea conserva precio, presentación y cantidad, y declara que exige receta', () => {
    const orderDraft = orderDraftOf('m-1', DISPONIBILIDAD_FIXTURE.items[0], QUERYABLE, []);

    const { lines } = cartLinesFromDraft(orderDraft);

    expect(lines[0]).toEqual({
      productId: FIXTURE_IDS.productoAmoxicilina,
      name: 'Amoxicilina',
      presentation: '500 mg · Caja x 21 cápsulas',
      quantity: 1,
      unitAmount: '68.00',
      currency: 'BOB',
      requiresPrescription: true,
      medicationConceptId: null,
    });
  });

  it('una sede que no puede confirmar nada devuelve cero líneas', () => {
    const orderDraft = orderDraftOf('m-1', DISPONIBILIDAD_FIXTURE.items[0], [], [
      'Paracetamol',
      'Amoxicilina',
    ]);

    const { lines, omitted } = cartLinesFromDraft(orderDraft);

    expect(lines).toEqual([]);
    expect(omitted).toEqual(['Paracetamol', 'Amoxicilina']);
  });
});

/**
 * El pedido que nace de un carrito con receta lleva el `medicationRequestId`.
 *
 * El caso vive acá y no en `cart.store.spec.ts` (Pablo, Q-J5) porque el
 * `CartStore` del corte **todavía no tiene `toDraft`**: se aisló su contrato y
 * se prueba lo que sí existe —`orderDraftOf` → `createOrderRequest`—, que
 * es exactamente el trecho donde el id de la receta podría perderse. Cuando
 * `toDraft` llegue, este caso sigue valiendo y el suyo se agrega al lado.
 */
describe('el pedido lleva la receta (carril 43 · H5.S2)', () => {
  it('con `requestId`, el cuerpo del POST incluye `medicationRequestId`', () => {
    const orderDraft = orderDraftOf('m-1', DISPONIBILIDAD_FIXTURE.items[0], QUERYABLE, []);

    const body = createOrderRequest(
      { borrador: orderDraft, modalidad: 'RETIRO', direccionDeEntrega: null },
      'idem-1',
    );

    expect(body.medicationRequestId).toBe('m-1');
  });

  it('sin receta detrás (carrito libre), la clave no viaja', () => {
    const orderDraft = orderDraftOf('', DISPONIBILIDAD_FIXTURE.items[0], QUERYABLE, []);

    const body = createOrderRequest(
      { borrador: orderDraft, modalidad: 'RETIRO', direccionDeEntrega: null },
      'idem-2',
    );

    expect(body.medicationRequestId).toBeUndefined();
  });
});

/** El selector de un `data-testid` ya existente en la plantilla. */
function byTestId(id: string): string {
  return `[data-testid="${id}"]`;
}

describe('pendingImagingStudies con los códigos de la API', () => {
  const concept = (conceptId: string, code: string, display: string) =>
    [conceptId, { conceptId, code, display, codeSystemVersionId: 'v1' }] as const;
  const labels = new Map([
    concept('c-eco', 'diagnostic_units:STUDY_ABDOMINAL_ULTRASOUND', 'Abdominal ultrasound'),
    concept('c-rx', 'diagnostic_units:STUDY_CHEST_XRAY', 'Chest X-ray'),
    concept('c-glu', 'diagnostic_units:STUDY_GLUCOSE', 'Blood glucose test'),
    concept('cat-img', 'diagnostics:SERVICE_REQUEST_CATEGORY_IMAGING', 'Imaging'),
  ]);
  const sortOrder = (id: string, codeConceptId: string, categoryConceptId?: string) => ({
    id,
    codeConceptId,
    categoryConceptId,
    statusConceptId: 's-1',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    hasReleasedResult: false,
  });

  it('reconoce la imagen por la categoría real o, sin categoría, por el estudio; el laboratorio no entra', () => {
    const studies = pendingImagingStudies(
      [sortOrder('o-1', 'c-rx', 'cat-img'), sortOrder('o-2', 'c-eco'), sortOrder('o-3', 'c-glu')],
      labels,
    );
    expect(studies).toEqual([
      { conceptId: 'c-rx', name: 'Chest X-ray' },
      { conceptId: 'c-eco', name: 'Abdominal ultrasound' },
    ]);
  });
});

describe('partialCountLabel', () => {
  it('concuerda en singular y en plural', () => {
    expect(partialCountLabel(1, 'la', 'las')).toBe('Ver la que tiene una parte');
    expect(partialCountLabel(3, 'los', 'los')).toBe('Ver los 3 que tienen una parte');
  });
});

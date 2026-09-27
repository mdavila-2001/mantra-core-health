import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../../core/auth/session.store';
import { StoreFront } from './store-front';

/** base64url sobre UTF-8, como el token real (mismo helper que `where-to-buy.spec`). */
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

const PERFIL_SIN_LUGARES = { id: 'pp-1', homeLatitude: null, homeLongitude: null };

const SEDES = {
  items: [
    {
      siteId: 's-1',
      siteName: 'Sucursal Centro',
      pharmacyId: 'f-1',
      pharmacyName: 'Farmacia Andina',
      addressText: 'Av. de prueba 123',
      latitude: null,
      longitude: null,
      distanceKm: null,
      homeDeliveryAvailable: null,
      pickupAvailable: true,
      productCount: 8,
    },
  ],
  count: 1,
};

const PRODUCTOS = {
  items: [
    {
      id: 'p-1',
      pharmacyId: 'f-1',
      pharmacyName: 'Farmacia Andina',
      productCode: 'PAR-500',
      brandName: 'Paracetamol Andina',
      genericName: 'Paracetamol',
      strengthText: '500 mg',
      packageSizeText: 'Caja x 20',
      dosageForm: null,
      medication: null,
      requiresPrescription: false,
    },
  ],
  limit: 20,
  truncated: false,
};

const DISPONIBILIDAD = {
  requestedProductIds: ['p-1'],
  items: [
    {
      siteId: 's-1',
      siteName: 'Sucursal Centro',
      pharmacyId: 'f-1',
      pharmacyName: 'Farmacia Andina',
      addressText: 'Av. de prueba 123',
      latitude: null,
      longitude: null,
      distanceKm: null,
      homeDeliveryAvailable: null,
      pickupAvailable: true,
      complete: true,
      availableCount: 1,
      missingProductIds: [],
      totalAmount: '12.50',
      currency: { code: 'BOB', display: 'Boliviano' },
      products: [
        {
          productId: 'p-1',
          productCode: 'PAR-500',
          brandName: 'Paracetamol Andina',
          genericName: 'Paracetamol',
          strengthText: '500 mg',
          packageSizeText: 'Caja x 20',
          medication: null,
          availableQuantity: 10,
          price: {
            unitAmount: '12.50',
            patientAmount: null,
            currency: { code: 'BOB', display: 'Boliviano' },
            priceListCode: 'PUBLICA',
          },
        },
      ],
    },
  ],
  count: 1,
};

/**
 * La tienda de farmacia (carril 43 · H3).
 *
 * Lo que estas pruebas fijan: que la home **no tiene pestañas**, que sus
 * controles alimentan la búsqueda, que sin término en Productos no se consulta
 * nada, que sin origen «Más cerca» se dice en vez de inventar distancias, que
 * sin perfil de paciente no se pide nada, y que los `?tab=` del hub viejo
 * siguen llevando a donde llevaban.
 */
describe('StoreFront', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'my-account/pharmacy', component: StoreFront },
          { path: 'my-account/cotizaciones', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function entrarComoPaciente(): void {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], pid: 'pp-1' }),
      refreshToken: 'r-1',
    });
  }

  async function montar(url = '/my-account/pharmacy'): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, StoreFront);
  }

  /** Las lecturas de contorno que la pantalla hace siempre que hay paciente. */
  function responderContorno(): void {
    http.expectOne('/profiles/patients/me').flush(PERFIL_SIN_LUGARES);
    http.expectOne((r) => r.url === '/pharmacy/orders/me').flush({ items: [] });
    harness.detectChanges();
  }

  function raiz(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  function texto(): string {
    return raiz().textContent ?? '';
  }

  it('es una tienda, no un hub: no hay pestañas en ningún lado', async () => {
    entrarComoPaciente();
    await montar();
    responderContorno();

    expect(raiz().querySelector('[role="tablist"]')).toBeNull();
    expect(raiz().querySelector('app-tabs')).toBeNull();
    expect(texto()).toContain('Farmacia');
  });

  it('trae el buscador, el modo, el orden y el origen, con sus ids congelados', async () => {
    entrarComoPaciente();
    await montar();
    responderContorno();

    for (const id of [
      'pharmacy-search-term',
      'pharmacy-search-mode',
      'pharmacy-search-sort',
      'pharmacy-search-origin',
    ]) {
      expect(raiz().querySelector(`[data-testid="${id}"]`)).not.toBeNull();
    }
  });

  it('sin término en Productos no consulta nada y pide qué buscar', async () => {
    entrarComoPaciente();
    await montar();
    responderContorno();

    http.expectNone((r) => r.url === '/pharmacy/products');
    http.expectNone((r) => r.url === '/pharmacy-inventory/availability');
    expect(raiz().querySelector('[data-testid="pharmacy-sin-termino"]')).not.toBeNull();
  });

  it('escribir un término dispara la búsqueda y pinta la fila con su precio', async () => {
    entrarComoPaciente();
    await montar();
    responderContorno();

    harness.routeDebugElement?.componentInstance.buscar('paracetamol');
    harness.detectChanges();

    http.expectOne((r) => r.url === '/pharmacy/products').flush(PRODUCTOS);
    http.expectOne((r) => r.url === '/pharmacy-inventory/availability').flush(DISPONIBILIDAD);
    harness.detectChanges();

    expect(texto()).toContain('Paracetamol Andina');
    expect(texto()).toContain('12.50');
  });

  it('cambiar a Farmacias lista el directorio sin exigir término', async () => {
    entrarComoPaciente();
    await montar();
    responderContorno();

    harness.routeDebugElement?.componentInstance.cambiarModo('stores');
    harness.detectChanges();

    http.expectOne((r) => r.url === '/pharmacy/sites').flush(SEDES);
    harness.detectChanges();

    expect(texto()).toContain('Sucursal Centro');
  });

  it('«Más cerca» sin origen lo dice y ofrece volver a ordenar por precio', async () => {
    entrarComoPaciente();
    await montar();
    responderContorno();

    harness.routeDebugElement?.componentInstance.cambiarOrden('distance');
    harness.detectChanges();

    expect(raiz().querySelector('[data-testid="pharmacy-sin-origen"]')).not.toBeNull();
    expect(texto()).toContain('Elegí desde dónde medir');
  });

  it('«Buscar toda una receta» y «Mis pedidos» apuntan a sus rutas', async () => {
    entrarComoPaciente();
    await montar();
    responderContorno();

    const receta = raiz().querySelector<HTMLAnchorElement>(
      '[data-testid="pharmacy-prescription-button"]',
    );
    expect(receta?.getAttribute('href')).toBe('/my-account/pharmacy/prescriptions');
    const pedidos = [...raiz().querySelectorAll<HTMLAnchorElement>('.tienda__atajos a')].at(-1);
    expect(pedidos?.getAttribute('href')).toBe('/my-account/pharmacy-orders');
  });

  it('sin perfil de paciente no consulta nada y lo dice', async () => {
    await montar();

    http.expectNone(() => true);
    expect(raiz().querySelector('[data-testid="pharmacy-sin-perfil"]')).not.toBeNull();
  });

  it('un error de la búsqueda queda como error recuperable, no como vacío', async () => {
    entrarComoPaciente();
    await montar();
    responderContorno();

    harness.routeDebugElement?.componentInstance.buscar('paracetamol');
    harness.detectChanges();
    http
      .expectOne((r) => r.url === '/pharmacy/products')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    harness.detectChanges();

    expect(texto()).not.toContain('Probá con otra palabra');
    expect(texto()).toContain('Reintentar');
  });

  it('una búsqueda que no encuentra nada trae su propio vacío con próxima acción', async () => {
    entrarComoPaciente();
    await montar();
    responderContorno();

    harness.routeDebugElement?.componentInstance.buscar('xxxxxx');
    harness.detectChanges();
    http
      .expectOne((r) => r.url === '/pharmacy/products')
      .flush({ items: [], limit: 20, truncated: false });
    harness.detectChanges();

    expect(texto()).toContain('Probá con otra palabra');
  });

  /**
   * La redirección se decide en el constructor, así que la navegación que la
   * dispara queda interrumpida: el anfitrión no llega a activar el componente
   * y `navigateByUrl(url, StoreFront)` fallaría. Por eso acá se navega sin
   * exigir el componente y se afirma sobre la navegación que salió, con las
   * lecturas de contorno drenadas — el componente sí se construyó.
   */
  describe('las pestañas del hub viejo siguen llevando a donde llevaban', () => {
    /** Dónde quedó parada la aplicación después de abrir con ese `?tab=`. */
    async function abrirCon(tab: string): Promise<string> {
      entrarComoPaciente();
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(`/my-account/pharmacy?tab=${tab}`);
      drenarContorno();
      await harness.fixture.whenStable();
      drenarContorno();
      return TestBed.inject(Router).url;
    }

    /** Las lecturas de contorno de cada construcción, sin exigir que existan. */
    function drenarContorno(): void {
      http.match('/profiles/patients/me').forEach((r) => r.flush(PERFIL_SIN_LUGARES));
      http.match((r) => r.url === '/pharmacy/orders/me').forEach((r) => r.flush({ items: [] }));
    }

    it('`?tab=cotizaciones` termina en Cotizaciones', async () => {
      expect(await abrirCon('cotizaciones')).toBe('/my-account/cotizaciones');
    });

    it('`?tab=comprar` termina en la tienda, sin la query', async () => {
      expect(await abrirCon('comprar')).toBe('/my-account/pharmacy');
    });
  });
});

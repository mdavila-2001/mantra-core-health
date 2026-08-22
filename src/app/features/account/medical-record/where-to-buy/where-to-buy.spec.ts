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
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import { SessionStore } from '../../../../core/auth/session.store';
import { CARGADOR_DE_LEAFLET } from '../../../../shared/components/organisms/map/map';
import type { CargadorDeLeaflet } from '../../../../shared/components/organisms/map/map';
import { borradorDePedido, WhereToBuy, type ItemDeReceta } from './where-to-buy';

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
 * 4. **El camino del pedido (FAR-I2)**: las pruebas corren con
 *    `environment.development` → `demoPresets` encendido, así que el CTA está
 *    habilitado, anunciado como demostración, y el clic arma el borrador y
 *    navega a confirmarlo. El armado del borrador se ejercita además como
 *    función pura; la rama sin demo (botón cerrado con «Próximamente») vive en
 *    la plantilla y se verifica en runtime.
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

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * El organismo de mapa (FAR-I1) entra con Leaflet doblado: acá se prueba la
 * pantalla, no la cartografía — el contrato del mapa tiene su propio spec.
 */
const marcadoresDelMapa: { alt: string; icono: HTMLElement }[] = [];

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
      marcadoresDelMapa.push({ alt: opciones.alt, icono: opciones.icon.html });
      const marcador = {
        bindPopup: () => marcador,
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
  function responderHastaProductos(): void {
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
    harness.detectChanges();
  }

  function texto(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

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

  it('con la demo, «Enviar pedido» se anuncia, arma el borrador de la sede y lleva a confirmarlo', async () => {
    await montar();
    responderHastaProductos();
    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush(DISPONIBILIDAD_FIXTURE);
    harness.detectChanges();

    // Un CTA habilitado por sede, con el aviso de que la farmacia se simula.
    expect(
      harness.routeNativeElement?.querySelector('[data-testid="compra-demo-aviso"]')?.textContent,
    ).toContain('demostración');
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
  });

  it('una receta que no está en la historia no dispara ninguna consulta a farmacias', async () => {
    await montar('m-inexistente');
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(RESUMEN);
    harness.detectChanges();

    expect(harness.routeNativeElement?.querySelector('[data-testid="compra-items"]')).toBeNull();
    // `http.verify()` del afterEach confirma que no salió nada más.
  });
});

describe('borradorDePedido (FAR-I2)', () => {
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
    const borrador = borradorDePedido(
      'm-1',
      DISPONIBILIDAD_FIXTURE.items[0],
      CONSULTABLES,
      ['Paracetamol'],
    );

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

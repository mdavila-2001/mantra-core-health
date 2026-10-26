import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type {
  MedicalCenterItem,
  MedicalCenterPage,
} from '../../../../../core/data-access/medical-centers/medical-centers.types';
import { MedicalCentersTab } from './medical-centers-tab';

const ENDOSCOPIA = 'c-endoscopia';
const COLONOSCOPIA = 'c-colonoscopia';

const ORDENES = {
  patientProfileId: 'pp-1',
  limit: 50,
  truncated: false,
  items: [
    { id: 'o-endo', codeConceptId: ENDOSCOPIA, categoryConceptId: 'cat-proc', statusConceptId: 's-1', createdAt: '2026-10-01T10:00:00Z', hasReleasedResult: false },
    { id: 'o-colon', codeConceptId: COLONOSCOPIA, categoryConceptId: 'cat-proc', statusConceptId: 's-1', createdAt: '2026-10-02T10:00:00Z', hasReleasedResult: false },
    // No cuentan: laboratorio, un procedimiento que ya tiene resultado y una orden sin categoría.
    { id: 'o-lab', codeConceptId: 'c-hemo', categoryConceptId: 'cat-lab', statusConceptId: 's-1', createdAt: '2026-10-03T10:00:00Z', hasReleasedResult: false },
    { id: 'o-hecha', codeConceptId: 'c-ecg', categoryConceptId: 'cat-proc', statusConceptId: 's-1', createdAt: '2026-10-04T10:00:00Z', hasReleasedResult: true },
    { id: 'o-sin', codeConceptId: 'c-otro', statusConceptId: 's-1', createdAt: '2026-10-05T10:00:00Z', hasReleasedResult: false },
  ],
};

const CONCEPTOS = {
  items: [
    { conceptId: ENDOSCOPIA, code: 'PROC-ENDO', display: 'Endoscopia digestiva alta', codeSystemVersionId: 'v1' },
    { conceptId: COLONOSCOPIA, code: 'PROC-COLON', display: 'Colonoscopia', codeSystemVersionId: 'v1' },
    { conceptId: 'c-hemo', code: 'STUDY-HEMOGRAMA', display: 'Hemograma', codeSystemVersionId: 'v1' },
    { conceptId: 'cat-proc', code: 'clinical:SERVICE_REQUEST_CATEGORY_PROCEDURE', display: 'Procedimiento', codeSystemVersionId: 'v1' },
    { conceptId: 'cat-lab', code: 'SRQ-LAB', display: 'Laboratorio', codeSystemVersionId: 'v1' },
  ],
  count: 5,
  limit: 200,
};

const MONEDAS = {
  items: [{ conceptId: 'cur-bob', code: 'BOB', display: 'Boliviano', codeSystemVersionId: 'v1' }],
  count: 1,
  limit: 200,
};

const centro = (id: string, cambios: Partial<MedicalCenterItem> = {}): MedicalCenterItem => ({
  practiceId: `p-${id}`,
  practiceSiteId: id,
  name: `Centro ${id}`,
  addressText: 'Av. Busch 120',
  latitude: -17.75,
  longitude: -63.18,
  distanceKm: null,
  complete: true,
  missingProcedureConceptIds: [],
  offers: [
    {
      procedureConceptId: ENDOSCOPIA,
      procedureDisplay: 'Endoscopia digestiva alta',
      price: 650,
      currencyConceptId: 'cur-bob',
      referencePrice: 380,
      referenceUnit: 'UMA',
      overMargin: null,
    },
  ],
  totalPrice: 650,
  practitionerWorksHere: false,
  suggestedByPractitioner: false,
  ...cambios,
});

const pagina = (items: MedicalCenterItem[]): MedicalCenterPage => ({
  items,
  total: items.length,
  limit: 20,
  offset: 0,
});

describe('MedicalCentersTab', () => {
  let fixture: ComponentFixture<MedicalCentersTab>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MedicalCentersTab);
  });

  afterEach(() => http.verify());

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texto = (): string => host().textContent ?? '';
  const tarjetas = (): HTMLElement[] =>
    Array.from(host().querySelectorAll<HTMLElement>('[data-testid="medical-center-card"]'));
  const ids = (r: HttpRequest<unknown>): string => r.params.get('ids') ?? '';

  /** Abre la pestaña y responde la lectura de órdenes y de etiquetas. */
  function abrir(ordenes: typeof ORDENES = ORDENES): void {
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/diagnostic-results/me/orders').flush(ordenes);
    if (ordenes.items.some((o) => o.categoryConceptId !== undefined && !o.hasReleasedResult)) {
      http.expectOne((r) => r.url === '/terminology/concepts' && !ids(r).includes('cur-')).flush(CONCEPTOS);
    }
  }

  function responderBusqueda(items: MedicalCenterItem[]): HttpRequest<unknown> {
    const busqueda = http.expectOne((r) => r.url === '/medical-centers/search/for-my-orders');
    busqueda.flush(pagina(items));
    if (items.length > 0) {
      http.expectOne((r) => r.url === '/terminology/concepts' && ids(r).includes('cur-bob')).flush(MONEDAS);
    }
    fixture.detectChanges();
    return busqueda.request;
  }

  function verParciales(): void {
    host().querySelector<HTMLButtonElement>('[data-testid="medical-centers-show-partial"]')?.click();
    fixture.detectChanges();
  }

  it('cerrada no pide nada; al abrirse hace una sola carga', () => {
    fixture.detectChanges();
    http.expectNone(() => true);

    abrir();
    responderBusqueda([centro('a')]);
    // Cerrar y volver a abrir no vuelve a cargar.
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();

    http.expectNone(() => true);
    expect(tarjetas()).toHaveLength(1);
  });

  it('pide la búsqueda con solo los ids de las órdenes de procedimiento sin resultado', () => {
    abrir();
    const pedido = responderBusqueda([centro('a')]);

    // Laboratorio, el procedimiento con resultado y la orden sin categoría no entran.
    expect(pedido.params.get('serviceRequestIds')).toBe('o-endo,o-colon');
    expect(pedido.params.get('includePartial')).toBe('true');
    expect(pedido.url).not.toContain(ENDOSCOPIA);
    expect(texto()).toContain('Procedimientos pendientes: Endoscopia digestiva alta, Colonoscopia');
  });

  it('sin origen no viaja ni lat ni lng; con origen viajan los dos', () => {
    abrir();
    const sinOrigen = responderBusqueda([centro('a')]);
    expect(sinOrigen.params.has('lat')).toBe(false);
    expect(sinOrigen.params.has('lng')).toBe(false);
    expect(texto()).toContain('Sin un punto de partida no se calculan distancias');

    fixture.componentRef.setInput('origin', { lat: -17.78, lng: -63.18, label: 'su casa' });
    fixture.detectChanges();
    const conOrigen = responderBusqueda([centro('a', { distanceKm: 3.2 })]);

    expect(conOrigen.params.get('lat')).toBe('-17.78');
    expect(conOrigen.params.get('lng')).toBe('-63.18');
    expect(texto()).toContain('medidas desde su casa');
    expect(texto()).toContain('3,2 km en línea recta');
  });

  it('cambiar el origen vuelve a buscar sin releer las órdenes', () => {
    abrir();
    responderBusqueda([centro('a')]);

    fixture.componentRef.setInput('origin', { lat: -16.5, lng: -68.15 });
    fixture.detectChanges();

    http.expectNone((r) => r.url === '/diagnostic-results/me/orders');
    http.expectOne((r) => r.url === '/medical-centers/search/for-my-orders').flush(pagina([centro('a')]));
    http.expectOne((r) => r.url === '/terminology/concepts' && ids(r).includes('cur-bob')).flush(MONEDAS);
  });

  it('sin órdenes de procedimiento: vacío honesto con salida a «Mis órdenes»', () => {
    abrir({ ...ORDENES, items: ORDENES.items.filter((o) => o.id === 'o-lab') });
    fixture.detectChanges();

    http.expectNone((r) => r.url.startsWith('/medical-centers'));
    expect(texto()).toContain('No tiene procedimientos pendientes');
    const enlaces = Array.from(host().querySelectorAll<HTMLAnchorElement>('a')).filter((a) =>
      a.textContent?.includes('Ver mis órdenes'),
    );
    // Una sola salida: la del estado vacío, sin un segundo enlace igual al pie.
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0]?.getAttribute('href')).toBe('/my-account/diagnostic-orders');
  });

  it('pinta las tarjetas en el orden recibido, sin reordenar', () => {
    abrir();
    responderBusqueda([
      centro('c', { name: 'Zeta', totalPrice: 900 }),
      centro('a', { name: 'Alfa', totalPrice: 100 }),
      centro('b', { name: 'Beta', totalPrice: 500, distanceKm: 0.5 }),
    ]);

    expect(tarjetas().map((t) => t.querySelector('.centros__principal')?.textContent?.trim())).toEqual([
      'Zeta',
      'Alfa',
      'Beta',
    ]);
    expect(host().querySelector('select, [role="listbox"], [data-testid*="sort"], [data-testid*="orden"]')).toBeNull();
  });

  it('el sugerido tiene la misma clase y la misma estructura que los demás', () => {
    abrir();
    responderBusqueda([
      centro('a'),
      centro('b', { suggestedByPractitioner: true, practitionerWorksHere: true }),
      centro('c'),
    ]);

    const [primera, sugerida, tercera] = tarjetas();
    expect(sugerida?.className).toBe(primera?.className);
    expect(sugerida?.className).toBe(tercera?.className);
    // La posición es la recibida: el sugerido no sube.
    expect(sugerida).toBe(tarjetas()[1]);
    expect(sugerida?.querySelector('[data-testid="medical-center-suggested"]')?.textContent).toContain(
      'Sugerido por su médico',
    );
    expect(sugerida?.querySelector('[data-testid="medical-center-works-here"]')?.textContent).toContain(
      'Su médico trabaja en este centro',
    );
    expect(primera?.querySelector('[data-testid="medical-center-suggested"]')).toBeNull();
    expect(primera?.querySelector('[data-testid="medical-center-works-here"]')).toBeNull();
  });

  it('«Cómo llegar» está en cada tarjeta con coordenadas y la URL no lleva el origen del paciente', () => {
    fixture.componentRef.setInput('origin', { lat: -17.78, lng: -63.18 });
    abrir();
    responderBusqueda([
      centro('a', { latitude: -17.5, longitude: -63.25 }),
      centro('b', { suggestedByPractitioner: true, latitude: -17.6, longitude: -63.3 }),
      centro('c', { latitude: null, longitude: null }),
    ]);

    const enlaces = tarjetas().map((t) =>
      t.querySelector<HTMLAnchorElement>('[data-testid="medical-center-directions"]'),
    );
    expect(enlaces.map((e) => e?.getAttribute('href') ?? null)).toEqual([
      'https://www.openstreetmap.org/directions?route=%3B-17.5%2C-63.25',
      'https://www.openstreetmap.org/directions?route=%3B-17.6%2C-63.3',
      null,
    ]);
    for (const enlace of enlaces) {
      expect(enlace?.getAttribute('href') ?? '').not.toContain('17.78');
    }
    expect(enlaces[0]?.getAttribute('target')).toBe('_blank');
    expect(enlaces[0]?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('precio con moneda, referencia con unidad, total y sin aviso de sobreprecio', () => {
    abrir();
    responderBusqueda([centro('a')]);

    expect(texto()).toContain('650,00 Bs');
    expect(texto()).toContain('Referencia: 380,00 UMA');
    expect(texto()).toContain('Total: 650,00 Bs');
    expect(host().querySelector('[data-testid="medical-center-over-margin"]')).toBeNull();
  });

  it('por defecto solo los completos; el botón suma los que tienen una parte, con «Le falta: …»', () => {
    abrir();
    responderBusqueda([
      centro('a'),
      centro('b', { complete: false, missingProcedureConceptIds: [COLONOSCOPIA], totalPrice: null }),
    ]);

    expect(tarjetas()).toHaveLength(1);
    const boton = host().querySelector<HTMLButtonElement>('[data-testid="medical-centers-show-partial"]');
    expect(boton?.getAttribute('aria-pressed')).toBe('false');
    expect(boton?.textContent).toContain('Ver el que tiene una parte');

    verParciales();

    expect(tarjetas()).toHaveLength(2);
    expect(boton?.getAttribute('aria-pressed')).toBe('true');
    expect(host().querySelector('[data-testid="medical-center-missing"]')?.textContent).toContain(
      'Le falta: Colonoscopia',
    );
    expect(tarjetas().map((t) => t.querySelector('.centros__principal')?.textContent?.trim())).toEqual([
      'Centro a',
      'Centro b',
    ]);
  });

  it('si ninguno está completo, lo dice y ofrece los parciales', () => {
    abrir();
    responderBusqueda([centro('b', { complete: false, missingProcedureConceptIds: [COLONOSCOPIA] })]);

    expect(tarjetas()).toHaveLength(0);
    expect(host().querySelector('[data-testid="medical-centers-none-complete"]')).not.toBeNull();
  });

  it('ningún centro publicado: vacío honesto', () => {
    abrir();
    responderBusqueda([]);

    expect(texto()).toContain('Ningún centro publicado ofrece hoy los procedimientos que le pidieron');
  });

  it('ningún uuid llega a la pantalla', () => {
    abrir();
    responderBusqueda([
      centro('a'),
      centro('b', {
        complete: false,
        missingProcedureConceptIds: ['9d3c8a52-1b7e-4f60-9a1d-5c2e7f0b4a11'],
      }),
    ]);
    verParciales();

    expect(texto()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(texto()).toContain('Le falta: otro procedimiento');
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  ExternalProduct,
  IntegrationConnection,
  ProductMapping,
  SyncBatch,
  SyncResult,
} from '../../../core/data-access/pharmacy/pharmacy-integration.types';
import type { PharmacyProduct } from '../../../core/data-access/pharmacy/pharmacy.types';
import { IntegrationMappings } from './integration-mappings/integration-mappings';
import { MISSING_SYSTEM_TEXT, PharmacyIntegration } from './pharmacy-integration';

/**
 * Pestaña «Integración» (FAR-07): sin conexión ofrece conectarla; con conexión
 * muestra sus datos, la última sincronización y los vínculos; «Sincronizar
 * ahora» no deja salir dos y dice en castellano el 422 y el 502.
 */
const PHARMACY = { id: '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63', name: 'Farmacia del Centro' };
const SITE = { siteId: '77fba9cc-93b1-4c7c-89f8-79d21f5dcf53', siteName: 'Casa central' };
const BASE = `/pharmacies/${PHARMACY.id}/integration-connections`;

const CONNECTION: IntegrationConnection = {
  id: 'c1f20f08-4bbf-47f2-8e8e-7a238cde42ba',
  pharmacySiteId: SITE.siteId,
  siteName: SITE.siteName,
  integrationMode: 'BATCH',
  supportsStockQuery: true,
  status: 'ACTIVE',
  providerConfigured: true,
  createdAt: '2026-10-30T02:51:26.935Z',
};
const CONN = `${BASE}/${CONNECTION.id}`;

const MAPPINGS: readonly ProductMapping[] = [
  {
    id: 'm-1',
    externalProductCode: 'ERP-0001',
    pharmacyProductId: 'p-a',
    productCode: 'FAR06-A',
    productName: 'Producto A',
    createdAt: '2026-10-30T02:51:27.059Z',
  },
];

const EXTERNALS: readonly ExternalProduct[] = [
  { code: 'ERP-0001', name: 'Paracetamol 500 mg', presentation: 'Caja x 20', unitCode: 'BOX', mappedProductId: 'p-a' },
  { code: 'ERP-0003', name: 'Amoxicilina 500 mg', presentation: 'Caja x 21', unitCode: 'BOX', mappedProductId: null },
];

const BATCH: SyncBatch = {
  id: 'b-1',
  status: 'COMPLETED',
  receivedAt: '2026-10-30T02:51:28.194Z',
  completedAt: '2026-10-30T02:51:28.206Z',
  itemCount: 12,
  discrepancies: 10,
};

const RESULT: SyncResult = {
  batchId: 'b-2',
  received: 12,
  mapped: 2,
  unmapped: [
    { externalCode: 'ERP-0003', name: 'Amoxicilina 500 mg' },
    { externalCode: 'ERP-0004', name: 'Loratadina 10 mg' },
  ],
  applied: 2,
};

function apiError(code: string, reason: string, message: string): object {
  return {
    code,
    message,
    correlationId: 'req-123',
    details: { reason },
    reason,
    timestamp: '2026-10-30T03:00:00.000Z',
    path: `${CONN}/sync`,
  };
}

describe('PharmacyIntegration', () => {
  let fixture: ComponentFixture<PharmacyIntegration>;
  let http: HttpTestingController;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);
  const text = (id: string): string => byTestId(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const button = (id: string): HTMLButtonElement =>
    (byTestId(id)?.tagName === 'BUTTON' ? byTestId(id) : byTestId(id)?.querySelector('button')) as HTMLButtonElement;

  /** `app-button` deshabilita con `aria-disabled` (y no deja salir el clic), no con el atributo nativo. */
  const disabled = (id: string): boolean => button(id).getAttribute('aria-disabled') === 'true';

  function expectOne(method: string, url: string): TestRequest {
    return http.expectOne((r) => r.method === method && r.url === url);
  }

  /** Monta la pestaña con la farmacia elegida y contesta conexiones y sucursales. */
  function mount(connections: readonly IntegrationConnection[], providerConfigured = true): void {
    fixture = TestBed.createComponent(PharmacyIntegration);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/pharmacy/pharmacies'))
      .flush({ items: [{ ...PHARMACY, code: 'FC', siteCount: 1, productCount: 1 }], count: 1 });
    fixture.detectChanges();
    expectOne('GET', BASE).flush({ providerConfigured, items: connections });
    expectOne('GET', `/pharmacies/${PHARMACY.id}/opening-hours`).flush({
      pharmacyId: PHARMACY.id,
      asOf: '2026-10-30T03:00:00Z',
      sites: [{ ...SITE, timeZone: 'America/La_Paz', open24h: null, shifts: [] }],
    });
    fixture.detectChanges();
  }

  /** Contesta lo que piden las dos secciones de una conexión. */
  function answerConnection(
    batches: readonly SyncBatch[] = [BATCH],
    mappings: readonly ProductMapping[] = MAPPINGS,
  ): void {
    expectOne('GET', `${CONN}/sync-batches`).flush({ items: batches });
    expectOne('GET', `${CONN}/product-mappings`).flush({ items: mappings });
    expectOne('GET', `${CONN}/external-products`).flush({ items: EXTERNALS });
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('sin conexión', () => {
    it('ofrece «Conectar el sistema de la farmacia» y no pide nada de una conexión', () => {
      mount([]);

      expect(byTestId('integration-connect')).not.toBeNull();
      expect(text('integration-connect-button')).toBe('Conectar el sistema de la farmacia');
      expect(byTestId('integration-sync')).toBeNull();
      expect(byTestId('integration-mappings')).toBeNull();
    });

    it('conecta por lotes con consulta de stock y la sucursal elegida, y relee la lista', () => {
      mount([]);
      (fixture.componentInstance as unknown as { siteId: WritableSignal<string> }).siteId.set(SITE.siteId);
      fixture.detectChanges();

      button('integration-connect-button').click();
      fixture.detectChanges();
      expect(disabled('integration-connect-button')).toBe(true);

      const create = expectOne('POST', BASE);
      expect(create.request.body).toEqual({
        integrationMode: 'BATCH',
        supportsStockQuery: true,
        pharmacySiteId: SITE.siteId,
      });
      create.flush({ id: CONNECTION.id }, { status: 201, statusText: 'Created' });
      fixture.detectChanges();

      // La prueba es la lista releída: la conexión aparece con sus datos.
      expectOne('GET', BASE).flush({ providerConfigured: true, items: [CONNECTION] });
      fixture.detectChanges();
      answerConnection([], []);

      expect(byTestId('integration-connect')).toBeNull();
      expect(text('integration-connection')).toContain('Casa central');
      expect(text('integration-last-sync')).toBe('Todavía no se sincronizó.');
    });

    it('con «Todas las sucursales» no manda sucursal', () => {
      mount([]);

      button('integration-connect-button').click();
      const create = expectOne('POST', BASE);
      expect(create.request.body).toEqual({ integrationMode: 'BATCH', supportsStockQuery: true });
      create.flush({ id: CONNECTION.id });
      fixture.detectChanges();
      expectOne('GET', BASE).flush({ providerConfigured: true, items: [{ ...CONNECTION, pharmacySiteId: null, siteName: null }] });
      fixture.detectChanges();
      answerConnection();

      expect(text('integration-connection')).toContain('Todas las sucursales activas');
    });

    it('si la API no tiene configurado el sistema, lo dice antes de conectar', () => {
      mount([], false);

      expect(text('integration-not-configured')).toContain(
        'La conexión con el sistema de la farmacia no está configurada',
      );
    });
  });

  describe('con conexión', () => {
    it('muestra sus datos, la última sincronización y los productos vinculados', () => {
      mount([CONNECTION]);
      answerConnection();

      const connection = text('integration-connection');
      expect(connection).toContain('Casa central');
      expect(connection).toContain('Por lotes');
      expect(connection).toContain('Activa');
      expect(text('integration-last-sync')).toContain('12 ítems recibidos · 10 sin vincular');
      const mappings = text('integration-mappings-table');
      expect(mappings).toContain('ERP-0001');
      expect(mappings).toContain('Paracetamol 500 mg');
      expect(mappings).toContain('Producto A');
      expect(mappings).toContain('FAR06-A');
      expect(disabled('integration-sync-button')).toBe(false);
    });

    it('«Sincronizar ahora» queda deshabilitado mientras viaja y después muestra el resumen y lo sin vincular', () => {
      mount([CONNECTION]);
      answerConnection();

      button('integration-sync-button').click();
      fixture.detectChanges();
      expect(disabled('integration-sync-button')).toBe(true);
      expect(byTestId('integration-sync-running')).not.toBeNull();
      // Un segundo clic con la primera en vuelo no saca otra petición.
      button('integration-sync-button').click();

      const sync = expectOne('POST', `${CONN}/sync`);
      sync.flush(RESULT);
      fixture.detectChanges();
      expectOne('GET', `${CONN}/sync-batches`).flush({ items: [{ ...BATCH, id: 'b-2' }, BATCH] });
      fixture.detectChanges();

      expect(disabled('integration-sync-button')).toBe(false);
      expect(text('integration-sync-received')).toBe('12');
      expect(text('integration-sync-mapped')).toBe('2');
      expect(text('integration-sync-applied')).toBe('2');
      expect(text('integration-sync-unmapped')).toContain('2 productos sin vincular');
      const rows = [...root().querySelectorAll('[data-testid="integration-sync-unmapped"] li')].map((li) =>
        [...li.children].map((child) => child.textContent?.trim()),
      );
      expect(rows).toEqual([
        ['ERP-0003', 'Amoxicilina 500 mg'],
        ['ERP-0004', 'Loratadina 10 mg'],
      ]);
    });

    it('con `applied: 0` dice que ya estaban al día', () => {
      mount([CONNECTION]);
      answerConnection();

      button('integration-sync-button').click();
      expectOne('POST', `${CONN}/sync`).flush({ ...RESULT, applied: 0, unmapped: [] });
      fixture.detectChanges();
      expectOne('GET', `${CONN}/sync-batches`).flush({ items: [BATCH] });
      fixture.detectChanges();

      expect(text('integration-sync-result')).toContain('ya estaban al día');
      expect(byTestId('integration-sync-all-mapped')).not.toBeNull();
    });

    it('el 422 «no configurado» se dice en castellano y no deja resumen', () => {
      mount([CONNECTION]);
      answerConnection();

      button('integration-sync-button').click();
      expectOne('POST', `${CONN}/sync`).flush(
        apiError('PRECONDITION_FAILED',
          'PHARMACY_INTEGRATION_NOT_CONFIGURED',
          'La conexión con el sistema de la farmacia no está configurada',
        ),
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      fixture.detectChanges();

      expect(text('integration-sync-error')).toContain(
        'La conexión con el sistema de la farmacia no está configurada',
      );
      expect(byTestId('integration-sync-result')).toBeNull();
      expect(disabled('integration-sync-button')).toBe(false);
    });

    it('el 502 dice que no pudimos hablar con el sistema, que nada cambió, y da la petición', () => {
      mount([CONNECTION]);
      answerConnection();

      button('integration-sync-button').click();
      expectOne('POST', `${CONN}/sync`).flush(
        apiError('DEPENDENCY_UNAVAILABLE',
          'PHARMACY_INTEGRATION_UNAVAILABLE',
          'No pudimos hablar con el sistema de la farmacia',
        ),
        { status: 502, statusText: 'Bad Gateway' },
      );
      fixture.detectChanges();

      const error = text('integration-sync-error');
      expect(error).toContain('No pudimos hablar con el sistema de la farmacia');
      expect(error).toContain('No se cambió ninguna existencia');
      expect(error).toContain('req-123');
      expect(byTestId('integration-sync-result')).toBeNull();
    });

    it('la conexión inactiva no se puede sincronizar y lo dice', () => {
      mount([{ ...CONNECTION, status: 'INACTIVE' }]);
      answerConnection();

      expect(disabled('integration-sync-button')).toBe(true);
      expect(text('integration-inactive')).toContain('no está activa');
      expect(text('integration-connection')).toContain('Inactiva');
    });

    it('sin el sistema configurado en la API: aviso, sin botón activo y sin leer el catálogo externo', () => {
      mount([{ ...CONNECTION, providerConfigured: false }], false);
      expectOne('GET', `${CONN}/sync-batches`).flush({ items: [] });
      expectOne('GET', `${CONN}/product-mappings`).flush({ items: [] });
      fixture.detectChanges();

      // Con la conexión dada de alta, el aviso dice qué falta sin negar que está activa.
      expect(text('integration-not-configured')).toContain(MISSING_SYSTEM_TEXT);
      expect(disabled('integration-sync-button')).toBe(true);
      http.expectNone(`${CONN}/external-products`);
    });

    it('con varias conexiones se elige cuál mirar; sin elegir, la activa', () => {
      const other: IntegrationConnection = { ...CONNECTION, id: 'c-2', status: 'INACTIVE', siteName: 'Sucursal Norte' };
      mount([other, CONNECTION]);
      answerConnection();

      expect(byTestId('integration-connection-chooser')).not.toBeNull();
      expect(text('integration-connection')).toContain('Casa central');
    });
  });

  describe('«Vincular producto»', () => {
    const PRODUCTS: readonly Partial<PharmacyProduct>[] = [
      { id: 'p-a', productCode: 'FAR06-A', brandName: 'Producto A', status: 'PUBLISHED' },
      { id: 'p-c', productCode: 'FAR06-C', brandName: 'Producto C', status: 'PUBLISHED' },
      { id: 'p-w', productCode: 'FAR06-W', brandName: 'Retirado', status: 'WITHDRAWN' },
    ];

    interface MappingsInternal {
      productOptions: () => readonly { value: string; disabled?: boolean }[];
      externalOptions: () => readonly { value: string; disabled?: boolean }[];
      productId: WritableSignal<string | null>;
      externalCode: WritableSignal<string | null>;
    }

    function openDialog(): MappingsInternal {
      mount([CONNECTION]);
      answerConnection();
      button('integration-link-button').click();
      fixture.detectChanges();
      http
        .expectOne((r) => r.url.endsWith('/pharmacy/products'))
        .flush({ items: PRODUCTS, limit: 500, truncated: false });
      expectOne('GET', `${CONN}/external-products`).flush({ items: EXTERNALS });
      fixture.detectChanges();
      return fixture.debugElement.query(By.directive(IntegrationMappings)).componentInstance as unknown as MappingsInternal;
    }

    it('ofrece los productos sin vínculo y los códigos libres del sistema de la farmacia', () => {
      const mappings = openDialog();

      expect(byTestId('integration-link-dialog')).not.toBeNull();
      expect(mappings.productOptions().map((option) => option.value)).toEqual(['p-c']);
      expect(mappings.externalOptions().map((option) => [option.value, option.disabled])).toEqual([
        ['ERP-0001', true],
        ['ERP-0003', false],
      ]);
      expect(disabled('integration-link-save')).toBe(true);
    });

    it('vincula con producto, código y unidad, cierra y relee la tabla', () => {
      const mappings = openDialog();
      mappings.productId.set('p-c');
      mappings.externalCode.set('ERP-0003');
      fixture.detectChanges();

      button('integration-link-save').click();
      const create = expectOne('POST', `${CONN}/product-mappings`);
      expect(create.request.body).toEqual({
        pharmacyProductId: 'p-c',
        externalProductCode: 'ERP-0003',
        externalUnitCode: 'BOX',
      });
      create.flush({ id: 'm-2', pharmacyProductId: 'p-c', externalProductCode: 'ERP-0003' }, { status: 201, statusText: 'Created' });
      fixture.detectChanges();

      const added: ProductMapping = {
        id: 'm-2',
        externalProductCode: 'ERP-0003',
        pharmacyProductId: 'p-c',
        productCode: 'FAR06-C',
        productName: 'Producto C',
        createdAt: '2026-10-30T03:10:00.000Z',
      };
      expectOne('GET', `${CONN}/product-mappings`).flush({ items: [...MAPPINGS, added] });
      expectOne('GET', `${CONN}/external-products`).flush({
        items: EXTERNALS.map((item) => (item.code === 'ERP-0003' ? { ...item, mappedProductId: 'p-c' } : item)),
      });
      fixture.detectChanges();

      expect(byTestId('integration-link-dialog')).toBeNull();
      expect(text('integration-mappings-table')).toContain('Producto C');
    });

    it('un 409 queda dicho dentro del modal, que sigue abierto', () => {
      const mappings = openDialog();
      mappings.productId.set('p-c');
      mappings.externalCode.set('ERP-0003');
      fixture.detectChanges();

      button('integration-link-save').click();
      expectOne('POST', `${CONN}/product-mappings`).flush(
        { code: 'CONFLICT', message: 'El producto ya está mapeado en esta conexión', timestamp: '', path: '' },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();

      expect(byTestId('integration-link-dialog')).not.toBeNull();
      expect(text('integration-link-error')).toContain('ya está mapeado');
    });

    it('si el sistema de la farmacia no responde, el modal lo dice y no deja elegir código', () => {
      mount([CONNECTION]);
      answerConnection();
      button('integration-link-button').click();
      fixture.detectChanges();
      http.expectOne((r) => r.url.endsWith('/pharmacy/products')).flush({ items: PRODUCTS, limit: 500, truncated: false });
      expectOne('GET', `${CONN}/external-products`).flush(
        apiError('DEPENDENCY_UNAVAILABLE', 'PHARMACY_INTEGRATION_UNAVAILABLE', 'No pudimos hablar con el sistema de la farmacia'),
        { status: 502, statusText: 'Bad Gateway' },
      );
      fixture.detectChanges();

      expect(text('integration-externals-error')).toContain('No pudimos hablar con el sistema de la farmacia');
      expect(disabled('integration-link-save')).toBe(true);
    });
  });

  it('«Vincular» sobre un código sin vínculo del resultado abre el alta con ese código y su unidad', () => {
    mount([CONNECTION]);
    answerConnection();

    button('integration-sync-button').click();
    expectOne('POST', `${CONN}/sync`).flush({
      ...RESULT,
      unmapped: [{ externalCode: 'ERP-0003', name: 'Amoxicilina 500 mg', reason: 'NO_MAPPING', productIds: [] }],
    });
    fixture.detectChanges();
    expectOne('GET', `${CONN}/sync-batches`).flush({ items: [BATCH] });
    fixture.detectChanges();

    button('integration-sync-link').click();
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/pharmacy/products')).flush({ items: [], limit: 500, truncated: false });
    expectOne('GET', `${CONN}/external-products`).flush({ items: EXTERNALS });
    fixture.detectChanges();

    expect(byTestId('integration-link-dialog')).not.toBeNull();
    const mappings = fixture.debugElement.query(By.directive(IntegrationMappings)).componentInstance as unknown as {
      externalCode: () => string | null;
    };
    expect(mappings.externalCode()).toBe('ERP-0003');
    expect((root().querySelector('input[data-testid="integration-link-unit"]') as HTMLInputElement).value).toBe('BOX');
  });

  describe('sistema de la farmacia (FAR-C9 · C9-4)', () => {
    it('la sección está en la pestaña y, al guardar, la conexión se relee de la API', () => {
      const withSystem: IntegrationConnection = {
        ...CONNECTION,
        system: {
          format: 'ALOVIDA_STANDARD',
          baseUrl: 'https://api.farmacia.bo/alovida-standard',
          externalPharmacyCode: 'FC',
          apiKeyConfigured: true,
          configuredAt: '2026-11-01T04:19:57.180Z',
        },
      };
      mount([withSystem]);
      answerConnection();

      expect(text('integration-system')).toContain('https://api.farmacia.bo/alovida-standard');

      button('integration-system-edit').click();
      fixture.detectChanges();
      const key = root().querySelector('input[data-testid="integration-system-key"]') as HTMLInputElement;
      key.value = 'otra-clave';
      key.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      button('integration-system-save').click();
      expectOne('PUT', `${CONN}/external-system`).flush({ system: withSystem.system, probe: 'OK' });
      fixture.detectChanges();

      // `changed` → la pestaña relee la lista: lo que se ve sale de la API.
      expectOne('GET', BASE).flush({ providerConfigured: true, items: [withSystem] });
      fixture.detectChanges();
      answerConnection();
      expect(byTestId('integration-system-form')).toBeNull();
    });
  });
});

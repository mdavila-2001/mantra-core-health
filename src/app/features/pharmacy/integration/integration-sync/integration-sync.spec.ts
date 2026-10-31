import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  IntegrationConnection,
  SyncResult,
} from '../../../../core/data-access/pharmacy/pharmacy-integration.types';
import { IntegrationSync } from './integration-sync';

/**
 * El resultado de una sincronización con varias sedes (FAR-C8): las cuentas
 * son líneas y cuadran (recibidas = vinculadas + sin vínculo), hay una fila por
 * sede, cada línea no aplicada dice por qué, un código que el sistema dejó de
 * mandar se avisa, y un código sin vínculo se distingue de uno ambiguo.
 */
const PHARMACY = '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63';
const CONNECTION: IntegrationConnection = {
  id: 'c1f20f08-4bbf-47f2-8e8e-7a238cde42ba',
  pharmacySiteId: null,
  siteName: null,
  integrationMode: 'BATCH',
  supportsStockQuery: true,
  status: 'ACTIVE',
  providerConfigured: true,
  createdAt: '2026-10-30T02:51:26.935Z',
};
const CONN = `/pharmacies/${PHARMACY}/integration-connections/${CONNECTION.id}`;

const RESULT: SyncResult = {
  batchId: 'b-2',
  received: 24,
  mapped: 20,
  unmappedLines: 4,
  unmapped: [
    { externalCode: 'ERP-0003', name: 'Amoxicilina 500 mg', reason: 'NO_MAPPING', productIds: [] },
    { externalCode: 'ERP-0004', name: 'Loratadina 10 mg', reason: 'AMBIGUOUS_MAPPING', productIds: ['p-b', 'p-c'] },
  ],
  applied: 15,
  sites: [
    { siteId: 's-1', siteCode: 'CEN', siteName: 'Casa central', received: 12, mapped: 10, unmapped: 2, applied: 8, unchanged: 1, skipped: 1 },
    { siteId: 's-2', siteCode: 'NOR', siteName: 'Sucursal Norte', received: 12, mapped: 10, unmapped: 2, applied: 7, unchanged: 1, skipped: 2 },
  ],
  skipped: [
    { siteId: 's-1', siteCode: 'CEN', externalCode: 'ERP-0001', productId: 'p-a', quantity: 5, reason: 'SITE_MARKED_NOT_AVAILABLE' },
    {
      siteId: 's-2',
      siteCode: 'NOR',
      externalCode: 'ERP-0002',
      productId: 'p-d',
      quantity: 40,
      reason: 'UNIT_MISMATCH',
      mappingUnitCode: 'BOX',
      externalUnitCode: 'TAB',
    },
  ],
  notSent: [{ siteId: 's-2', siteCode: 'NOR', externalCode: 'ERP-0009', productId: 'p-e' }],
};

describe('IntegrationSync · resultado por sede', () => {
  let fixture: ComponentFixture<IntegrationSync>;
  let http: HttpTestingController;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);
  const text = (id: string): string => byTestId(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const all = (id: string): string[] =>
    [...root().querySelectorAll(`[data-testid="${id}"]`)].map((el) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(IntegrationSync);
    fixture.componentRef.setInput('pharmacyId', PHARMACY);
    fixture.componentRef.setInput('connection', CONNECTION);
    fixture.detectChanges();
    http.expectOne((r) => r.url === `${CONN}/sync-batches`).flush({ items: [] });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function sync(result: SyncResult): void {
    (byTestId('integration-sync-button')?.querySelector('button') ?? byTestId('integration-sync-button'))?.click();
    http.expectOne((r) => r.method === 'POST' && r.url === `${CONN}/sync`).flush(result);
    fixture.detectChanges();
    http.expectOne((r) => r.url === `${CONN}/sync-batches`).flush({ items: [] });
    fixture.detectChanges();
  }

  it('cuenta líneas que cuadran: recibidas = vinculadas + sin vínculo', () => {
    sync(RESULT);

    expect(text('integration-sync-received')).toBe('24');
    expect(text('integration-sync-mapped')).toBe('20');
    expect(text('integration-sync-unmapped-lines')).toBe('4');
    expect(text('integration-sync-applied')).toBe('15');
    expect(text('integration-sync-lines-note')).toContain('un código en una sede');
  });

  it('da una fila por sede con sus cuentas', () => {
    sync(RESULT);

    const rows = [...root().querySelectorAll('[data-testid="integration-sync-sites"] tbody tr')].map((row) =>
      row.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Casa central');
    expect(rows[0]).toContain('CEN');
    expect(rows[1]).toContain('Sucursal Norte');
  });

  it('cada línea no aplicada dice su sede y su motivo; las de unidad, las dos unidades', () => {
    sync(RESULT);

    const lines = all('integration-sync-skipped-line');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('ERP-0001');
    expect(lines[0]).toContain('Casa central');
    expect(lines[0]).toContain('se cambia desde la sede');
    expect(lines[1]).toContain('Sucursal Norte');
    expect(lines[1]).toContain('Unidad del vínculo BOX / del sistema TAB');
  });

  it('un código vinculado que el sistema dejó de mandar conserva su stock y se avisa', () => {
    sync(RESULT);

    const lines = all('integration-sync-not-sent-line');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('ERP-0009');
    expect(lines[0]).toContain('Sucursal Norte');
    expect(lines[0]).toContain('El sistema ya no lo manda; conserva su stock.');
  });

  it('distingue «Sin vincular», que ofrece vincular, de «Ambiguo», que no manda a vincular', () => {
    const requested: string[] = [];
    fixture.componentInstance.linkRequested.subscribe((code) => requested.push(code));
    sync(RESULT);

    const items = all('integration-sync-unmapped-item');
    expect(items[0]).toContain('Sin vincular');
    expect(items[1]).toContain('Ambiguo · 2 productos');
    expect(text('integration-sync-unmapped')).not.toContain('Vincúlelos abajo');
    expect(text('integration-sync-unmapped')).toContain('deshaga en «Productos vinculados» los vínculos que sobran');
    const links = root().querySelectorAll('[data-testid="integration-sync-link"]');
    expect(links).toHaveLength(1);
    ((links[0].tagName === 'BUTTON' ? links[0] : links[0].querySelector('button')) as HTMLButtonElement).click();
    expect(requested).toEqual(['ERP-0003']);
  });

  it('con una API anterior sin el detalle por sede, deduce las líneas sin vínculo y no muestra la tabla', () => {
    sync({ batchId: 'b-3', received: 12, mapped: 2, applied: 2, unmapped: [] });

    expect(text('integration-sync-unmapped-lines')).toBe('10');
    expect(byTestId('integration-sync-sites')).toBeNull();
    expect(byTestId('integration-sync-skipped')).toBeNull();
    expect(byTestId('integration-sync-not-sent')).toBeNull();
  });
});

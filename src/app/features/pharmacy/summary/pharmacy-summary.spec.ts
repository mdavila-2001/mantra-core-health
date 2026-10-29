import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PharmacySummary } from '../../../core/data-access/pharmacy/pharmacy.types';
import { PharmacySummaryPage } from './pharmacy-summary';

/**
 * «Resumen» de la farmacia (carril B, 29/09/2026): la pantalla no calcula nada,
 * dibuja lo que da `GET /pharmacy/pharmacies/:id/summary`.
 */
const PHARMACY = { id: '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63', name: 'Farmacia del Centro' };

const SUMMARY: PharmacySummary = {
  published: 40,
  drafts: 3,
  withdrawn: 1,
  outOfStock: 5,
  lowStock: 2,
  inventoryValue: '12345.60',
  byCategory: [
    { category: 'Medicamentos', count: 30 },
    { category: 'Bienestar', count: 10 },
  ],
  recentActivity: [
    { id: 'a-1', at: '2026-09-29T15:00:00.000Z', kind: 'ALTA', text: 'Publicó «Ibuprofeno».' },
  ],
};

describe('PharmacySummaryPage', () => {
  let fixture: ComponentFixture<PharmacySummaryPage>;
  let http: HttpTestingController;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function mount(summary: PharmacySummary = SUMMARY): void {
    fixture = TestBed.createComponent(PharmacySummaryPage);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/pharmacy/pharmacies'))
      .flush({ items: [{ ...PHARMACY, code: 'FC', siteCount: 1, productCount: 1 }], count: 1 });
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith(`/pharmacy/pharmacies/${PHARMACY.id}/summary`)).flush(summary);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('dibuja los indicadores tal como vienen de la API', () => {
    mount();

    const value = (id: string) => root().querySelector(`[data-testid="${id}"]`)?.textContent?.trim();
    expect(value('summary-published')).toBe('40');
    expect(value('summary-drafts')).toBe('3');
    expect(value('summary-out-of-stock')).toBe('5');
    expect(value('summary-low-stock')).toBe('2');
    expect(value('summary-value')).toContain('12,345.60');
  });

  it('dibuja los productos por categoría con su número al lado', () => {
    mount();

    const rows = root().querySelectorAll('[data-testid="summary-by-category"] li');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain('Medicamentos');
    expect(rows[0]!.textContent).toContain('30');
  });

  it('los tres atajos llevan a Productos filtrado, a Inventario con alertas y a Importación', () => {
    mount();

    const hrefs = [...root().querySelectorAll('a.summary__shortcut')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/administration/pharmacy-catalog?status=DRAFT',
      '/administration/pharmacy-inventory?alerts=true',
      '/administration/pharmacy-import',
    ]);
  });

  it('muestra la actividad reciente, y si no hay dice cuándo aparece', () => {
    mount();
    expect(root().querySelector('[data-testid="summary-activity"]')?.textContent).toContain('Publicó «Ibuprofeno».');
  });

  it('sin actividad lo dice en vez de dejar un hueco', () => {
    mount({ ...SUMMARY, recentActivity: [] });
    expect(root().querySelector('[data-testid="summary-no-activity"]')).not.toBeNull();
  });
});

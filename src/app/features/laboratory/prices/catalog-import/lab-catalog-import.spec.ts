import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  LabCatalog,
  LabCatalogItem,
} from '../../../../core/data-access/lab-portal/lab-import.types';
import { LabPortalClient } from '../../../../core/data-access/lab-portal/lab-portal.client';
import { LabCatalogImport } from './lab-catalog-import';

const item = (code: string, extra: Partial<LabCatalogItem> = {}): LabCatalogItem => ({
  conceptId: `c-${code}`,
  code,
  name: code,
  loinc: null,
  specimen: null,
  suggestedPrice: null,
  offeredServiceId: null,
  components: [],
  ...extra,
});

const CATALOG: LabCatalog = {
  count: 3,
  priceRule: 'INLASA 2026 primero.',
  sections: [
    {
      code: 'HEMATO',
      name: 'Hematología',
      items: [
        item('HEMOGRAMA', {
          name: 'Hemograma completo',
          suggestedPrice: {
            source: 'INLASA',
            sourceCode: 'LAC-030',
            sourceName: 'HEMOGRAMA COMPLETO',
            priceBs: '60.00',
          },
          components: [
            {
              conceptId: 'p-hb',
              code: 'HEMOGRAMA.HB',
              name: 'Hemoglobina',
              loinc: '718-7',
              unit: 'g/dL',
              suggestedPrice: {
                source: 'FONASA',
                sourceCode: '03-01-038',
                sourceName: 'HB',
                priceBs: '9.75',
              },
            },
            {
              conceptId: 'p-vcm',
              code: 'HEMOGRAMA.VCM',
              name: 'VCM',
              loinc: '787-2',
              unit: 'fL',
              suggestedPrice: null,
            },
          ],
        }),
      ],
    },
    {
      code: 'BIOQ',
      name: 'Bioquímica clínica',
      items: [item('GLUCOSA'), item('TSH', { offeredServiceId: 's-1' })],
    },
  ],
};

describe('LabCatalogImport', () => {
  let fixture: ComponentFixture<LabCatalogImport>;
  let importCatalog: ReturnType<typeof vi.fn>;
  let getCatalog: ReturnType<typeof vi.fn>;
  const root = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    getCatalog = vi.fn(() => of(CATALOG));
    importCatalog = vi.fn(() =>
      of({ created: 1, linked: 0, republished: 0, skipped: 0, rejected: 0, rows: [] }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LabPortalClient, useValue: { getCatalog, importCatalog } },
      ],
    });
    fixture = TestBed.createComponent(LabCatalogImport);
    fixture.detectChanges();
  });

  it('shows each análisis by section with its suggested price and its components', () => {
    const text = root().textContent ?? '';
    expect(text).toContain('Hematología');
    expect(text).toContain('Sugerido 60.00 Bs · INLASA LAC-030');
    expect(text).toContain('Ver sus 2 componentes');
    expect(text).toContain('9.75 Bs');
    expect(text).toContain('Sin precio sugerido');
    expect(text).toContain('Ya está en su lista de precios');
  });

  it('adds the chosen análisis and rereads the catalog', () => {
    const add = root().querySelector<HTMLButtonElement>('[data-testid="lab-catalog-add"]')!;
    expect(add.getAttribute('aria-disabled')).toBe('true');

    root()
      .querySelector<HTMLInputElement>('[data-code="HEMOGRAMA"] input[type="checkbox"]')!
      .click();
    fixture.detectChanges();
    expect(add.textContent?.trim()).toBe('Agregar 1 análisis');

    add.click();
    fixture.detectChanges();
    expect(importCatalog).toHaveBeenCalledWith(['c-HEMOGRAMA']);
    expect(getCatalog).toHaveBeenCalledTimes(2);
    expect(root().querySelector('[data-testid="lab-catalog-result"]')?.textContent).toContain(
      'Se agregó 1 análisis con sus componentes.',
    );
  });

  it('an análisis already offered cannot be chosen again', () => {
    expect(root().querySelector('[data-code="TSH"] input[type="checkbox"]')).toBeNull();
  });
});

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
  sampleType: 'BLOOD',
  suggestedPrice: null,
  offeredServiceId: null,
  components: [],
  ...extra,
});

const CATALOG: LabCatalog = {
  count: 4,
  priceRule: 'INLASA 2026 primero.',
  catalogVersion: '2026-10-31',
  sampleTypes: [
    { code: 'BLOOD', name: 'Análisis de sangre' },
    { code: 'URINE', name: 'Análisis de orina' },
  ],
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
    {
      code: 'URIANALISIS',
      name: 'Uroanálisis',
      items: [item('EGO', { name: 'Examen general de orina', sampleType: 'URINE' })],
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

  it('groups the análisis by sample type: blood first, then urine', () => {
    const groups = [...root().querySelectorAll('[data-code]')].map((el) =>
      el.getAttribute('data-code'),
    );
    expect(groups).toEqual(['GLUCOSA', 'HEMOGRAMA', 'TSH', 'EGO']);
    const text = root().textContent ?? '';
    expect(text.indexOf('Análisis de sangre')).toBeLessThan(text.indexOf('Análisis de orina'));
  });

  it('shows each análisis with its section, suggested price and components', () => {
    const text = root().textContent ?? '';
    expect(text).toContain('Hematología ·');
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
    expect(importCatalog).toHaveBeenCalledWith(['c-HEMOGRAMA'], []);
    expect(getCatalog).toHaveBeenCalledTimes(2);
    expect(root().querySelector('[data-testid="lab-catalog-result"]')?.textContent).toContain(
      'Se agregó 1 análisis con sus componentes.',
    );
  });

  it('«Elegir todos» ticks every análisis not yet offered, with no filter on', () => {
    const all = root().querySelector<HTMLButtonElement>(
      '[data-testid="lab-catalog-select-shown"]',
    )!;
    expect(all.textContent?.trim()).toBe('Elegir todos');
    all.click();
    fixture.detectChanges();
    const add = root().querySelector<HTMLButtonElement>('[data-testid="lab-catalog-add"]')!;
    // GLUCOSA, HEMOGRAMA and EGO: TSH is already offered.
    expect(add.textContent?.trim()).toBe('Agregar 3 análisis');
    expect(all.getAttribute('aria-disabled')).toBe('true');

    root().querySelector<HTMLButtonElement>('[data-testid="lab-catalog-clear"]')!.click();
    fixture.detectChanges();
    expect(add.textContent?.trim()).toBe('Agregar análisis');
    expect(root().querySelector('[data-testid="lab-catalog-clear"]')).toBeNull();
  });

  it('each component is ticked by default and an unticked one is sent to be skipped', () => {
    const vcm = () =>
      root().querySelector<HTMLInputElement>(
        '[data-part-code="HEMOGRAMA.VCM"] input[type="checkbox"]',
      )!;
    expect(
      root().querySelectorAll('[data-code="HEMOGRAMA"] [data-testid="lab-catalog-part"]').length,
    ).toBe(2);
    expect(vcm().checked).toBe(true);

    vcm().click();
    fixture.detectChanges();
    expect(vcm().checked).toBe(false);
    expect(root().querySelector('[data-code="HEMOGRAMA"]')?.textContent).toContain(
      'Sus componentes: 1 de 2 elegidos',
    );

    root()
      .querySelector<HTMLInputElement>(
        '[data-code="HEMOGRAMA"] .item__head input[type="checkbox"]',
      )!
      .click();
    fixture.detectChanges();
    root().querySelector<HTMLButtonElement>('[data-testid="lab-catalog-add"]')!.click();
    expect(importCatalog).toHaveBeenCalledWith(['c-HEMOGRAMA'], ['p-vcm']);
  });

  it('an unticked component of an análisis that was not chosen is not sent', () => {
    root()
      .querySelector<HTMLInputElement>('[data-part-code="HEMOGRAMA.VCM"] input[type="checkbox"]')!
      .click();
    fixture.detectChanges();
    root().querySelector<HTMLElement>('[data-code="GLUCOSA"] app-checkbox input')!.click();
    fixture.detectChanges();
    root().querySelector<HTMLButtonElement>('[data-testid="lab-catalog-add"]')!.click();
    expect(importCatalog).toHaveBeenCalledWith(['c-GLUCOSA'], []);
  });

  it('an análisis already offered cannot be chosen again', () => {
    expect(root().querySelector('[data-code="TSH"] input[type="checkbox"]')).toBeNull();
  });

  it('says why an análisis was rejected, in a warning when nothing was added', () => {
    importCatalog.mockReturnValue(
      of({
        created: 0,
        linked: 0,
        republished: 0,
        skipped: 0,
        rejected: 1,
        rows: [
          {
            conceptId: 'c-GLUCOSA',
            outcome: 'REJECTED',
            serviceId: null,
            reason: 'Ya tiene un servicio con el código «GLUCOSA».',
          },
        ],
      }),
    );
    root().querySelector<HTMLElement>('[data-code="GLUCOSA"] app-checkbox input')!.click();
    fixture.detectChanges();
    root().querySelector<HTMLButtonElement>('[data-testid="lab-catalog-add"]')!.click();
    fixture.detectChanges();
    const alert = root().querySelector('[data-testid="lab-catalog-result"]')!;
    expect(alert.textContent).toContain('No se agregó ningún análisis.');
    expect(alert.textContent).toContain('GLUCOSA: Ya tiene un servicio con el código «GLUCOSA».');
  });

  it('an empty catalog is an empty state that leads back to Precios', () => {
    getCatalog.mockReturnValue(
      of({ sections: [], sampleTypes: [], count: 0, priceRule: '', catalogVersion: null }),
    );
    fixture = TestBed.createComponent(LabCatalogImport);
    fixture.detectChanges();
    expect(root().textContent).toContain('El catálogo de estudios todavía no está cargado.');
  });

  it('without the LOINC catalog loaded, says so instead of listing loose análisis', () => {
    expect(root().querySelector('[data-testid="lab-catalog-not-loaded"]')).toBeNull();
    getCatalog.mockReturnValue(of({ ...CATALOG, catalogVersion: null }));
    fixture = TestBed.createComponent(LabCatalogImport);
    fixture.detectChanges();
    expect(root().querySelector('[data-testid="lab-catalog-not-loaded"]')?.textContent).toContain(
      'sólo están los análisis básicos',
    );
  });
});

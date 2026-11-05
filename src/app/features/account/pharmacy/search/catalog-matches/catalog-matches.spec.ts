import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { PublicMarketplaceClient } from '../../../../../core/data-access/public-marketplace/public-marketplace.client';
import { CatalogMatches } from './catalog-matches';

const IBUPROFENO = {
  conceptId: 'c-ibu',
  atcCode: 'M01AE01',
  genericName: 'Ibuprofeno',
  therapeuticGroup: 'Aparato locomotor',
  uses: ['Dolor, inflamación y fiebre'],
  brands: [],
  presentations: [],
  requiresPrescription: false,
  priceFrom: null,
  priceTo: null,
  currency: null,
  pharmacyCount: 0,
  nearestKm: null,
};

describe('CatalogMatches', () => {
  it('muestra lo que coincide en el vademécum, con la corrección del tipeo', async () => {
    vi.useFakeTimers();
    const listMedications = vi.fn().mockReturnValue(
      of({
        items: [IBUPROFENO],
        total: 1,
        groups: [],
        correctedQuery: 'ibuprofeno',
        officialProducts: [],
        generatedAt: '',
      }),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: PublicMarketplaceClient, useValue: { listMedications } }],
    });
    const fixture = TestBed.createComponent(CatalogMatches);
    fixture.componentRef.setInput('term', 'ibopofeno');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(200);
    fixture.detectChanges();
    vi.useRealTimers();

    expect(listMedications).toHaveBeenCalledWith({ q: 'ibopofeno', exact: false, limit: 12 });
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('¿Quiso decir «ibuprofeno»?');
    expect(texto).toContain('Sirve para: Dolor, inflamación y fiebre');
    expect(texto).toContain('Ninguna farmacia de la red lo publica todavía');
  });
});

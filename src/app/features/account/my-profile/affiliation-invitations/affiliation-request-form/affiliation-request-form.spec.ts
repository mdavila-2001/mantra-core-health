import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HealthcareServicesClient } from '../../../../../core/data-access/healthcare-services/healthcare-services.client';
import { PracticeSitesClient } from '../../../../../core/data-access/practice-sites/practice-sites.client';
import { ServicesCatalogClient } from '../../../../../core/data-access/services-catalog/services-catalog.client';
import { AffiliationRequestForm } from './affiliation-request-form';

const SITE = { id: 'site-1', practiceId: 'pr-1', code: 'S1', name: 'Sede Sur 1', timeZone: null, addressText: null, latitude: null, longitude: null, status: 'ACTIVE' };
const PROCEDURES = [
  { id: 'hs-1', practiceSiteId: 'site-1', serviceConceptId: 'c-1', serviceDisplay: 'Colonoscopia', serviceCatalogId: null, price: null, currencyConceptId: null, referencePrice: null, referenceUnit: null, overMargin: null, visibleInSearch: true, active: true },
  { id: 'hs-2', practiceSiteId: 'site-1', serviceConceptId: 'c-2', serviceDisplay: 'Endoscopia digestiva alta', serviceCatalogId: null, price: null, currencyConceptId: null, referencePrice: null, referenceUnit: null, overMargin: null, visibleInSearch: true, active: true },
  { id: 'hs-3', practiceSiteId: 'site-1', serviceConceptId: 'c-3', serviceDisplay: 'Retirado', serviceCatalogId: null, price: null, currencyConceptId: null, referencePrice: null, referenceUnit: null, overMargin: null, visibleInSearch: true, active: false },
];
const RESULT = { id: 'ra', practiceId: 'pr-1', practitionerProfileId: 'pp', status: 's', createdAt: new Date() };

interface Internal {
  practiceId: { set: (id: string | null) => void };
  siteId: { set: (id: string | null) => void };
  toggle: (id: string, on: boolean) => void;
  canSubmit: () => boolean;
  submit: () => void;
  error: () => string | null;
}

describe('AffiliationRequestForm', () => {
  let fixture: ComponentFixture<AffiliationRequestForm>;
  let selfRequestAffiliation: ReturnType<typeof vi.fn>;
  const internal = (): Internal => fixture.componentInstance as unknown as Internal;

  beforeEach(() => {
    selfRequestAffiliation = vi.fn(() => of(RESULT));
    TestBed.configureTestingModule({
      providers: [
        { provide: ServicesCatalogClient, useValue: { listPractices: () => of([{ id: 'pr-1', code: 'CMS', name: 'Centro Médico Sur' }]) } },
        { provide: PracticeSitesClient, useValue: { selfRequestAffiliation } },
        { provide: HealthcareServicesClient, useValue: { listSites: () => of([SITE]), listOffers: () => of(PROCEDURES) } },
      ],
    });
    fixture = TestBed.createComponent(AffiliationRequestForm);
    fixture.detectChanges();
    internal().practiceId.set('pr-1');
    fixture.detectChanges();
    internal().siteId.set('site-1');
    fixture.detectChanges();
  });

  it('hace una llamada a self-request por procedimiento, cada una con su healthcareServiceId', () => {
    const requested: number[] = [];
    fixture.componentInstance.requested.subscribe((n) => requested.push(n));

    internal().toggle('hs-1', true);
    internal().toggle('hs-2', true);
    internal().submit();

    expect(selfRequestAffiliation).toHaveBeenCalledTimes(2);
    expect(selfRequestAffiliation).toHaveBeenNthCalledWith(1, 'pr-1', { practiceSiteId: 'site-1', healthcareServiceId: 'hs-1' });
    expect(selfRequestAffiliation).toHaveBeenNthCalledWith(2, 'pr-1', { practiceSiteId: 'site-1', healthcareServiceId: 'hs-2' });
    expect(requested).toEqual([2]);
  });

  it('sin procedimientos marcados no envía nada', () => {
    expect(internal().canSubmit()).toBe(false);
    internal().submit();
    expect(selfRequestAffiliation).not.toHaveBeenCalled();
  });

  it('si la segunda falla, dice cuántas quedaron hechas y pide recargar la lista de afuera', () => {
    selfRequestAffiliation
      .mockReturnValueOnce(of(RESULT))
      .mockReturnValueOnce(throwError(() => ({ status: 409, error: { message: 'Ya tiene una solicitud para ese procedimiento' } })));
    const requested: number[] = [];
    let changed = 0;
    fixture.componentInstance.requested.subscribe((n) => requested.push(n));
    fixture.componentInstance.changed.subscribe(() => changed++);

    internal().toggle('hs-1', true);
    internal().toggle('hs-2', true);
    internal().submit();

    expect(requested).toEqual([]);
    expect(changed).toBe(1);
    expect(internal().error()).toContain('Se enviaron 1 de 2 solicitudes');
  });
});

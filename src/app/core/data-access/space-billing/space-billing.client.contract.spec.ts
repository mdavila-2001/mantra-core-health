import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CURRENCY_CONCEPTS } from '../infra-concepts';
import { SpaceBillingClient } from './space-billing.client';
import type { BedDayRunResult, ChargeCapture, SpaceTariff } from './space-billing.types';

/*
 * Fixtures de contrato (M7), copiados de las vistas de la API
 * (`space-charges.service.ts`: `tariffView`, `chargeView`, `runBedDays`,
 * `pending`) y del DTO `CreateSpaceTariffDto`. `pending-charges` es un
 * **arreglo**; `run` devuelve los cargos creados, no un número.
 */
const TARIFF_VIEW = {
  id: 't-1',
  practiceId: 'pr-1',
  tariffKind: 'BED_DAY',
  bedCategoryConceptId: 'ff0a07eb-ed18-5e2b-972f-82b49f4d4655',
  careSpaceId: null,
  serviceCatalogId: 'svc-1',
  unitMinutes: null,
  minimumUnits: null,
  unitPrice: '450.000000',
  validFrom: '2026-01-01',
  validTo: null,
  rowVersion: 1,
};

const CHARGE_VIEW = {
  id: 'ch-1',
  encounterId: 'enc-1',
  source: 'BED_DAY',
  sourceRefId: 'loc-1',
  serviceDate: '2026-10-29',
  careSpaceId: 'bed-1',
  bedCategoryConceptId: 'ff0a07eb-ed18-5e2b-972f-82b49f4d4655',
  spaceTariffId: 't-1',
  quantity: '1',
  unitPrice: '450.000000',
  costCenterId: 'cc-1',
  status: 'CHG_PENDING',
  idempotencyKey: 'BEDDAY:enc-1:2026-10-29',
};

describe('SpaceBillingClient · contrato con la API', () => {
  let client: SpaceBillingClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(SpaceBillingClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('tarifas: la vista de la API pasa tal cual', () => {
    let list: readonly SpaceTariff[] = [];
    client.listTariffs('pr-1').subscribe((l) => (list = l));
    http.expectOne('/billing/space-tariffs?practiceId=pr-1').flush([TARIFF_VIEW]);
    expect(list).toEqual([TARIFF_VIEW]);
  });

  it('alta: sólo claves de CreateSpaceTariffDto (tariffKind, currencyConceptId)', () => {
    client
      .createTariff({ practiceId: 'pr-1', tariffKind: 'OR_TIME', serviceCatalogId: 'svc-qx', unitMinutes: 30, minimumUnits: 2, unitPrice: '600', currencyConceptId: CURRENCY_CONCEPTS['BOB']!, validFrom: '2026-11-01' })
      .subscribe();
    const req = http.expectOne('/billing/space-tariffs');
    const allowed = ['practiceId', 'tariffKind', 'bedCategoryCode', 'careSpaceId', 'serviceCatalogId', 'unitMinutes', 'minimumUnits', 'unitPrice', 'currencyConceptId', 'validFrom', 'validTo'];
    expect(Object.keys(req.request.body).every((k) => allowed.includes(k))).toBe(true);
    expect(req.request.body.tariffKind).toBe('OR_TIME');
    req.flush({ ...TARIFF_VIEW, tariffKind: 'OR_TIME', bedCategoryConceptId: null, unitMinutes: 30, minimumUnits: 2 });
  });

  it('pendientes: un arreglo de chargeView', () => {
    let list: readonly ChargeCapture[] = [];
    client.getPendingCharges('enc-1').subscribe((l) => (list = l));
    http.expectOne('/billing/encounters/enc-1/pending-charges').flush([CHARGE_VIEW]);
    expect(list).toEqual([CHARGE_VIEW]);
  });

  it('devengar: {created: ChargeCapture[], skipped}', () => {
    let r: BedDayRunResult | null = null;
    client.runBedDay('enc-1').subscribe((x) => (r = x));
    http.expectOne('/billing/encounters/enc-1/bed-day-charges/run').flush({ created: [CHARGE_VIEW], skipped: 2 });
    expect(r!.created.length).toBe(1);
    expect(r!.skipped).toBe(2);
  });

  it('internaciones de la sede (F3) para elegir el encuentro', () => {
    let list: unknown = null;
    client.listInpatients('s-1').subscribe((l) => (list = l));
    const fila = { encounterId: 'enc-1', patientProfileId: 'p-1', bed: { careSpaceId: 'bed-1', clinicalUnitId: 'u-1' }, since: '2026-10-29T18:00:00.000Z', levelOfCare: null, expectedDischargeAt: null, losDays: 2 };
    http.expectOne('/sites/s-1/inpatients').flush([fila]);
    expect(list).toEqual([fila]);
  });
});

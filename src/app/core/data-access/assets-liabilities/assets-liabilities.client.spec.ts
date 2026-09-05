import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AssetsLiabilitiesClient } from './assets-liabilities.client';

const PRACTICE = 'practice-1';

describe('AssetsLiabilitiesClient — FT-26 (auto-servicio de activos y pasivos)', () => {
  let client: AssetsLiabilitiesClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(AssetsLiabilitiesClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista los activos de la práctica', () => {
    client.listAssets(PRACTICE).subscribe();
    const req = http.expectOne(
      (r) => r.url === '/accounting/practitioner/assets' && r.params.get('practiceId') === PRACTICE,
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('da de alta un activo con el mismo contrato que SECURITY_ADMIN', () => {
    client
      .capitalizeAsset({
        practiceId: PRACTICE,
        code: 'AST-1',
        name: 'Silla',
        acquisitionAccountId: 'acc-1',
        offsetAccountId: 'acc-2',
        acquisitionCost: '100.00',
        acquisitionDate: '2026-09-05',
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/accounting/practitioner/assets');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ code: 'AST-1', acquisitionCost: '100.00' });
    req.flush({ id: 'as1' });
  });

  it('prende o apaga la automatización de un activo', () => {
    client.setAssetAutomation('as1', false).subscribe();
    const req = http.expectOne((r) => r.url === '/accounting/practitioner/assets/as1/automation');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ automated: false });
    req.flush(null);
  });

  it('registra el avance (depreciación) de un activo', () => {
    client
      .registerAssetProgress('as1', {
        depreciationExpenseAccountId: 'acc-exp',
        accumulatedDepreciationAccountId: 'acc-dep',
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/accounting/practitioner/assets/as1/progress');
    expect(req.request.method).toBe('POST');
    req.flush({ transactionId: 'tx1', amount: '16.67' });
  });

  it('lista los pasivos de la práctica', () => {
    client.listLiabilities(PRACTICE).subscribe();
    const req = http.expectOne(
      (r) => r.url === '/accounting/practitioner/liabilities' && r.params.get('practiceId') === PRACTICE,
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('da de alta un pasivo con su cronograma', () => {
    client
      .createLiability({
        practiceId: PRACTICE,
        code: 'LIAB-1',
        name: 'Préstamo equipo',
        accountId: 'acc-liab',
        principalAmount: '1200.00',
        interestRate: '12.00',
        installments: 3,
        startDate: '2026-09-05',
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/accounting/practitioner/liabilities');
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'liab1', code: 'LIAB-1', schedule: [] });
  });

  it('registra el avance (pago de cuota) de un pasivo', () => {
    client
      .registerLiabilityProgress('liab1', {
        bankAccountId: 'acc-bank',
        interestExpenseAccountId: 'acc-int',
      })
      .subscribe();
    const req = http.expectOne(
      (r) => r.url === '/accounting/practitioner/liabilities/liab1/progress',
    );
    expect(req.request.method).toBe('POST');
    req.flush({ transactionId: 'tx1', installmentNumber: 1, amount: '112.00' });
  });
});

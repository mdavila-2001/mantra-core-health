import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AccountingClient } from './accounting.client';

const PRACTICE = 'practice-1';

describe('AccountingClient — Carril 18 (auto-servicio contable del doctor)', () => {
  let client: AccountingClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(AccountingClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('listPaidConsultations', () => {
    it('pide las consultas pagadas de la práctica dada', () => {
      client.listPaidConsultations(PRACTICE).subscribe();

      const req = http.expectOne(
        (r) => r.url === '/accounting/practitioner/paid-consultations',
      );
      expect(req.request.params.get('practiceId')).toBe(PRACTICE);
      req.flush({ items: [], count: 0 });
    });

    it('normaliza los opcionales en null y ancla issueDate al día, no al instante', () => {
      let resultado: readonly unknown[] = [];
      client
        .listPaidConsultations(PRACTICE)
        .subscribe((items) => (resultado = items));

      http.expectOne((r) => r.url === '/accounting/practitioner/paid-consultations').flush({
        items: [
          {
            invoiceId: 'inv-1',
            invoiceNumber: 'F-001',
            encounterId: 'enc-1',
            appointmentId: null,
            patientProfileId: 'pat-1',
            issueDate: '2026-01-15T00:00:00.000Z',
            paidTotal: '350.00',
            currencyConceptId: null,
          },
        ],
        count: 1,
      });

      expect(resultado).toEqual([
        {
          invoiceId: 'inv-1',
          invoiceNumber: 'F-001',
          encounterId: 'enc-1',
          patientProfileId: 'pat-1',
          // `maybeDateOnly` ancla al día en hora LOCAL, no UTC (ver wire.ts):
          // una fecha de calendario no es un instante.
          issueDate: new Date(2026, 0, 15),
          paidTotal: '350.00',
        },
      ]);
      expect('appointmentId' in (resultado[0] as object)).toBe(false);
    });
  });

  describe('registerConsultationIncome', () => {
    it('postea el cuerpo tal cual y devuelve el resultado normalizado', () => {
      let resultado: unknown;
      client
        .registerConsultationIncome({
          practiceId: PRACTICE,
          invoiceId: 'inv-1',
          debitAccountId: 'acc-cash',
          creditAccountId: 'acc-revenue',
          transactionDate: '2026-01-31',
        })
        .subscribe((r) => (resultado = r));

      const req = http.expectOne(
        (r) => r.url === '/accounting/practitioner/consultation-income',
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        practiceId: PRACTICE,
        invoiceId: 'inv-1',
        debitAccountId: 'acc-cash',
        creditAccountId: 'acc-revenue',
        transactionDate: '2026-01-31',
      });
      req.flush({
        transactionId: 't-1',
        transactionNumber: 'JT-1',
        status: 'DRAFT',
        totalAmount: '350.00',
        invoiceId: 'inv-1',
        notificationRequestId: 'notif-1',
      });

      expect(resultado).toEqual({
        transactionId: 't-1',
        transactionNumber: 'JT-1',
        status: 'DRAFT',
        totalAmount: '350.00',
        invoiceId: 'inv-1',
        notificationRequestId: 'notif-1',
      });
    });
  });

  describe('registerSimpleEntry', () => {
    it('postea un gasto y omite invoiceId/notificationRequestId cuando llegan null', () => {
      let resultado: unknown;
      client
        .registerSimpleEntry({
          practiceId: PRACTICE,
          kind: 'EXPENSE',
          debitAccountId: 'acc-expense',
          creditAccountId: 'acc-cash',
          amount: '80.00',
          transactionDate: '2026-01-31',
          description: 'Insumos',
        })
        .subscribe((r) => (resultado = r));

      const req = http.expectOne((r) => r.url === '/accounting/practitioner/entries');
      expect(req.request.body.kind).toBe('EXPENSE');
      req.flush({
        transactionId: 't-2',
        transactionNumber: 'JT-2',
        status: 'DRAFT',
        totalAmount: '80.00',
        invoiceId: null,
        notificationRequestId: null,
      });

      expect(resultado).toEqual({
        transactionId: 't-2',
        transactionNumber: 'JT-2',
        status: 'DRAFT',
        totalAmount: '80.00',
      });
    });
  });
});

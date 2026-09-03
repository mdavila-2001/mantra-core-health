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

  /* ---- TAREA-20 S3: libro mayor, estado de resultados, balance general --- */

  describe('generalLedger', () => {
    it('pide la cuenta y normaliza los movimientos, con la fecha anclada al día', () => {
      let resultado: unknown;
      client
        .generalLedger(PRACTICE, { accountId: 'acc-1' })
        .subscribe((r) => (resultado = r));

      const req = http.expectOne((r) => r.url === '/accounting/general-ledger');
      expect(req.request.params.get('practiceId')).toBe(PRACTICE);
      expect(req.request.params.get('accountId')).toBe('acc-1');
      req.flush({
        accountId: 'acc-1',
        code: '1000',
        name: 'Caja',
        normalBalanceConceptId: 'debit',
        currencyConceptId: null,
        openingBalance: '0.00',
        items: [
          {
            id: 'le-1',
            transactionId: 't-1',
            transactionNumber: 'JT-1',
            transactionDate: '2026-01-31T00:00:00.000Z',
            directionConceptId: 'debit',
            debit: '100.00',
            credit: '0.00',
            runningBalance: '100.00',
            memo: null,
          },
        ],
        count: 1,
        limit: 100,
        nextCursor: null,
      });

      expect(resultado).toEqual({
        accountId: 'acc-1',
        code: '1000',
        name: 'Caja',
        normalBalanceConceptId: 'debit',
        openingBalance: '0.00',
        items: [
          {
            id: 'le-1',
            transactionId: 't-1',
            transactionNumber: 'JT-1',
            transactionDate: new Date(2026, 0, 31),
            directionConceptId: 'debit',
            debit: '100.00',
            credit: '0.00',
            runningBalance: '100.00',
          },
        ],
        count: 1,
        limit: 100,
        nextCursor: null,
      });
    });
  });

  describe('incomeStatement', () => {
    it('normaliza ingresos y gastos por separado', () => {
      let resultado: unknown;
      client.incomeStatement(PRACTICE).subscribe((r) => (resultado = r));

      http.expectOne((r) => r.url === '/accounting/income-statement').flush({
        revenueItems: [
          { accountId: 'acc-rev', code: '4000', name: 'Ingresos', accountTypeConceptId: 'revenue', amount: '500.00' },
        ],
        expenseItems: [
          { accountId: 'acc-exp', code: '5000', name: 'Gastos', accountTypeConceptId: 'expense', amount: '200.00' },
        ],
        totalRevenue: '500.00',
        totalExpense: '200.00',
        netIncome: '300.00',
        count: 2,
        limit: 100,
        nextCursor: null,
        truncated: false,
      });

      expect(resultado).toEqual({
        revenueItems: [
          { accountId: 'acc-rev', code: '4000', name: 'Ingresos', accountTypeConceptId: 'revenue', amount: '500.00' },
        ],
        expenseItems: [
          { accountId: 'acc-exp', code: '5000', name: 'Gastos', accountTypeConceptId: 'expense', amount: '200.00' },
        ],
        totalRevenue: '500.00',
        totalExpense: '200.00',
        netIncome: '300.00',
        count: 2,
        limit: 100,
        nextCursor: null,
        truncated: false,
      });
    });
  });

  describe('balanceSheet', () => {
    it('declara si activo == pasivo + patrimonio', () => {
      let resultado: unknown;
      client.balanceSheet(PRACTICE).subscribe((r) => (resultado = r));

      http.expectOne((r) => r.url === '/accounting/balance-sheet').flush({
        assetItems: [{ accountId: 'acc-1', code: '1000', name: 'Caja', accountTypeConceptId: 'asset', amount: '800.00' }],
        liabilityItems: [],
        equityItems: [{ accountId: 'acc-eq', code: '3000', name: 'Capital', accountTypeConceptId: 'equity', amount: '500.00' }],
        netIncomeOfPeriod: '300.00',
        totalAssets: '800.00',
        totalLiabilities: '0.00',
        totalEquity: '800.00',
        totalLiabilitiesAndEquity: '800.00',
        balanced: true,
        count: 2,
        limit: 100,
        nextCursor: null,
        truncated: false,
      });

      expect((resultado as { balanced: boolean }).balanced).toBe(true);
      expect((resultado as { totalAssets: string }).totalAssets).toBe('800.00');
    });
  });

  /* ---- TAREA-20 S2: MODO CONTADOR ------------------------------------------- */

  describe('createJournalDraft', () => {
    it('postea el asiento de N filas a /drafts tal cual', () => {
      let resultado: unknown;
      client
        .createJournalDraft({
          practiceId: PRACTICE,
          transactionDate: '2026-01-31',
          description: 'Asiento manual',
          lines: [
            { accountId: 'acc-1', direction: 'DEBIT', amount: '100.00' },
            { accountId: 'acc-2', direction: 'CREDIT', amount: '100.00' },
          ],
        })
        .subscribe((r) => (resultado = r));

      const req = http.expectOne((r) => r.url === '/accounting/journal-transactions/drafts');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.lines).toHaveLength(2);
      req.flush({
        id: 't-3',
        transactionNumber: 'JT-3',
        status: 'DRAFT',
        totalAmount: '100.00',
        lineCount: 2,
        postedAt: null,
      });

      expect(resultado).toEqual({
        id: 't-3',
        transactionNumber: 'JT-3',
        status: 'DRAFT',
        totalAmount: '100.00',
        lineCount: 2,
      });
    });
  });

  describe('postJournal', () => {
    it('postea el asiento de N filas al endpoint directo', () => {
      client
        .postJournal({
          practiceId: PRACTICE,
          transactionDate: '2026-01-31',
          lines: [
            { accountId: 'acc-1', direction: 'DEBIT', amount: '100.00' },
            { accountId: 'acc-2', direction: 'CREDIT', amount: '100.00' },
          ],
        })
        .subscribe();

      const req = http.expectOne((r) => r.url === '/accounting/journal-transactions');
      expect(req.request.method).toBe('POST');
      req.flush({
        id: 't-4',
        transactionNumber: 'JT-4',
        status: 'POSTED',
        totalAmount: '100.00',
        lineCount: 2,
        postedAt: '2026-01-31T10:00:00.000Z',
      });
    });
  });
});

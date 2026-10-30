import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Observable } from 'rxjs';

import { NOT_AVAILABLE_IN_API } from '../simulator-only';
import { SimpleAccountingClient } from './simple-accounting.client';
import type {
  SimpleAccountInput,
  SimpleRecordInput,
  SimpleTransactionInput,
} from './simple-accounting.types';

const PRACTICE = 'practice-1';
const BASE = '/accounting/practitioner/simple';

const ACCOUNT: SimpleAccountInput = { name: 'Caja chica', accountClass: 'ASSET' };
const RECORD: SimpleRecordInput = {
  kind: 'EXPENSE',
  date: '2026-10-28',
  accountId: 'acc-1',
  description: 'Guantes',
  amount: '45.50',
};
const TRANSACTION: SimpleTransactionInput = {
  date: '2026-10-28',
  description: 'Depósito',
  debitAccountId: 'acc-1',
  creditAccountId: 'acc-2',
  amount: '100.00',
};

/**
 * H12: las escrituras de la contabilidad simple salían envueltas en
 * `simulatorOnly`, que contra la API real no dejaba salir la petición. La API
 * las publica en `accounting-practitioner-simple.controller.ts` (`:56-286`) con
 * los cuerpos de `practitioner-simple-accounting.dto.ts`: `practiceId` solo al
 * crear (`Create*Dto`) y los importes como cadena decimal.
 */
describe('SimpleAccountingClient — rutas y cuerpos del controlador de la API', () => {
  let client: SimpleAccountingClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(SimpleAccountingClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('lecturas', () => {
    it('GET summary con practiceId y period', () => {
      client.summary(PRACTICE, 'month').subscribe();
      const req = http.expectOne((r) => r.url === `${BASE}/summary`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('practiceId')).toBe(PRACTICE);
      expect(req.request.params.get('period')).toBe('month');
      req.flush({});
    });

    it('GET accounts, records?kind= y transactions desenvuelven `items`', () => {
      const vistos: unknown[] = [];
      client.listAccounts(PRACTICE).subscribe((v) => vistos.push(v));
      client.listRecords(PRACTICE, 'DEBT').subscribe((v) => vistos.push(v));
      client.listTransactions(PRACTICE).subscribe((v) => vistos.push(v));

      const accounts = http.expectOne((r) => r.url === `${BASE}/accounts`);
      const records = http.expectOne((r) => r.url === `${BASE}/records`);
      const transactions = http.expectOne((r) => r.url === `${BASE}/transactions`);
      for (const req of [accounts, records, transactions]) {
        expect(req.request.method).toBe('GET');
        expect(req.request.params.get('practiceId')).toBe(PRACTICE);
      }
      expect(records.request.params.get('kind')).toBe('DEBT');
      accounts.flush({ items: ['a'] });
      records.flush({ items: ['r'] });
      transactions.flush({ items: ['t'] });

      expect(vistos).toEqual([['a'], ['r'], ['t']]);
    });
  });

  describe('escrituras: salen a la red', () => {
    const casos: readonly {
      readonly nombre: string;
      readonly llamar: (c: SimpleAccountingClient) => Observable<unknown>;
      readonly method: string;
      readonly url: string;
      readonly body: unknown;
    }[] = [
      {
        nombre: 'crear una cuenta',
        llamar: (c) => c.createAccount(PRACTICE, ACCOUNT),
        method: 'POST',
        url: `${BASE}/accounts`,
        body: { practiceId: PRACTICE, name: 'Caja chica', accountClass: 'ASSET' },
      },
      {
        nombre: 'editar una cuenta',
        llamar: (c) => c.updateAccount('a/1', ACCOUNT),
        method: 'PUT',
        url: `${BASE}/accounts/a%2F1`,
        body: ACCOUNT,
      },
      {
        nombre: 'borrar una cuenta',
        llamar: (c) => c.deleteAccount('a/1'),
        method: 'DELETE',
        url: `${BASE}/accounts/a%2F1`,
        body: null,
      },
      {
        nombre: 'registrar un gasto',
        llamar: (c) => c.createRecord(PRACTICE, RECORD),
        method: 'POST',
        url: `${BASE}/records`,
        body: { practiceId: PRACTICE, ...RECORD },
      },
      {
        nombre: 'editar un registro',
        llamar: (c) => c.updateRecord('r-1', RECORD),
        method: 'PUT',
        url: `${BASE}/records/r-1`,
        body: RECORD,
      },
      {
        nombre: 'borrar un registro',
        llamar: (c) => c.deleteRecord('r-1'),
        method: 'DELETE',
        url: `${BASE}/records/r-1`,
        body: null,
      },
      {
        nombre: 'registrar una transacción',
        llamar: (c) => c.createTransaction(PRACTICE, TRANSACTION),
        method: 'POST',
        url: `${BASE}/transactions`,
        body: { practiceId: PRACTICE, ...TRANSACTION },
      },
      {
        nombre: 'editar una transacción',
        llamar: (c) => c.updateTransaction('t-1', TRANSACTION),
        method: 'PUT',
        url: `${BASE}/transactions/t-1`,
        body: TRANSACTION,
      },
      {
        nombre: 'borrar una transacción',
        llamar: (c) => c.deleteTransaction('t-1'),
        method: 'DELETE',
        url: `${BASE}/transactions/t-1`,
        body: null,
      },
    ];

    for (const caso of casos) {
      it(`${caso.nombre}: ${caso.method} ${caso.url}, sin el error «no disponible»`, () => {
        let error: unknown;
        caso.llamar(client).subscribe({ error: (e: unknown) => (error = e) });

        const req = http.expectOne((r) => r.url === caso.url);
        expect(req.request.method).toBe(caso.method);
        expect(req.request.body).toEqual(caso.body);
        req.flush(null, { status: 204, statusText: 'No Content' });

        expect(error).toBeUndefined();
        expect(JSON.stringify(error ?? {})).not.toContain(NOT_AVAILABLE_IN_API);
      });
    }

    it('los importes viajan como cadena decimal, como pide el DTO', () => {
      client.createRecord(PRACTICE, RECORD).subscribe();
      client.createTransaction(PRACTICE, TRANSACTION).subscribe();
      const [rec, tx] = [http.expectOne(`${BASE}/records`), http.expectOne(`${BASE}/transactions`)];
      expect(typeof (rec.request.body as { amount: unknown }).amount).toBe('string');
      expect(typeof (tx.request.body as { amount: unknown }).amount).toBe('string');
      rec.flush({});
      tx.flush({});
    });
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Accounting } from './accounting';

const PRACTICE = 'practice-1';

describe('Accounting — Carril 18 (auto-servicio contable del doctor)', () => {
  let fixture: ComponentFixture<Accounting>;
  let http: HttpTestingController;

  /** Los cuatro pedidos que cuelgan de la práctica elegida (sin `/practices`). */
  function flushDependientesDeLaPractica(): void {
    http.expectOne((r) => r.url === '/accounting/trial-balance').flush({
      items: [],
      count: 0,
      totalDebit: '0.00',
      totalCredit: '0.00',
      balanced: true,
      transactionsIncluded: 0,
      truncated: false,
    });
    http
      .expectOne((r) => r.url === '/accounting/journal-transactions')
      .flush({ items: [], count: 0, limit: 50 });
    http
      .expectOne((r) => r.url === '/accounting/accounts')
      .flush({
        items: [
          { id: 'acc-1', code: '1000', name: 'Caja', accountTypeConceptId: 'a', normalBalanceConceptId: 'b' },
        ],
        count: 1,
        limit: 50,
      });
    http
      .expectOne((r) => r.url === '/accounting/practitioner/paid-consultations')
      .flush({ items: [], count: 0 });
  }

  function flushCarga(): void {
    http.expectOne((r) => r.url === '/practices').flush({
      items: [{ id: PRACTICE, code: 'P1', name: 'Práctica Uno', typeConceptId: 't', statusConceptId: 's' }],
      count: 1,
    });
    // `practicaElegida` es un `linkedSignal` que reacciona a la respuesta de
    // arriba; los cuatro pedidos que cuelgan de la práctica elegida no salen
    // hasta que un tick de detección de cambios propaga esa señal.
    fixture.detectChanges();
    flushDependientesDeLaPractica();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Accounting],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Accounting);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el plan de cuentas y las consultas pagadas de la práctica elegida', () => {
    fixture.detectChanges();
    flushCarga();
  });

  it('registrarGasto no manda nada si el formulario es inválido', () => {
    fixture.detectChanges();
    flushCarga();
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { registrarGasto: () => void }).registrarGasto();
    // http.verify() confirma que no salió ningún POST.
  });

  it('registrarGasto postea con la fecha de hoy y refresca el diario tras guardar', () => {
    fixture.detectChanges();
    flushCarga();
    fixture.detectChanges();

    const componente = fixture.componentInstance as unknown as {
      formularioDeGasto: {
        setValue: (v: {
          debitAccountId: string;
          creditAccountId: string;
          amount: string;
          description: string;
        }) => void;
      };
      registrarGasto: () => void;
    };
    componente.formularioDeGasto.setValue({
      debitAccountId: 'acc-1',
      creditAccountId: 'acc-1',
      amount: '80.00',
      description: 'Insumos',
    });
    componente.registrarGasto();

    const req = http.expectOne((r) => r.url === '/accounting/practitioner/entries');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      practiceId: PRACTICE,
      kind: 'EXPENSE',
      debitAccountId: 'acc-1',
      creditAccountId: 'acc-1',
      amount: '80.00',
      description: 'Insumos',
    });
    expect(req.request.body.transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    req.flush({
      transactionId: 't-1',
      transactionNumber: 'JT-1',
      status: 'DRAFT',
      totalAmount: '80.00',
      invoiceId: null,
      notificationRequestId: null,
    });

    // El reintento vuelve a pedir todo lo que cuelga de la práctica elegida
    // (no `/practices` de nuevo: la práctica elegida no cambió).
    fixture.detectChanges();
    flushDependientesDeLaPractica();
  });
});

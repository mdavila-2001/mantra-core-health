import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssetsLiabilities } from './assets-liabilities';

const PRACTICE = 'practice-1';

describe('AssetsLiabilities — FT-26', () => {
  let fixture: ComponentFixture<AssetsLiabilities>;
  let http: HttpTestingController;

  function flushCarga(): void {
    // Arreglo desnudo, que es lo que manda el controlador: `listPractices()`
    // hace `body.map(...)` sobre la respuesta. Con `{ items, count }` el `map`
    // no existe, el observable muere, el `catchError` del componente lo traga y
    // la práctica queda en null — con lo que ninguna de las lecturas que cuelgan
    // de ella se llega a pedir. Ver la cabecera de `listPractices` en
    // `accounting.client.ts`.
    http
      .expectOne((r) => r.url === '/practices')
      .flush([{ id: PRACTICE, code: 'P1', name: 'Práctica Uno', typeConceptId: 't', statusConceptId: 's' }]);
    fixture.detectChanges();

    http.expectOne((r) => r.url === '/accounting/accounts').flush({
      items: [
        { id: 'acc-1', code: '1000', name: 'Caja', accountTypeConceptId: 'a', normalBalanceConceptId: 'b' },
      ],
      count: 1,
      limit: 50,
    });
    http
      .expectOne(
        (r) => r.url === '/accounting/practitioner/assets' && r.params.get('practiceId') === PRACTICE,
      )
      .flush([]);
    http
      .expectOne(
        (r) => r.url === '/accounting/practitioner/liabilities' && r.params.get('practiceId') === PRACTICE,
      )
      .flush([]);
  }

  /**
   * Lo que vuelve a pedirse tras una acción con éxito.
   *
   * `reintentar()` incrementa la señal `intento`, que viaja por el mismo
   * `toObservable(practicaYIntento)` que la carga inicial: es un efecto, corre
   * en la cola de tareas, y por eso hace falta esperar antes de buscar las
   * peticiones. Y son **tres**, no dos: de esa señal cuelga también el plan de
   * cuentas, así que el reintento lo recarga igual que los activos y los
   * pasivos. Sin flujearlo, el `http.verify()` del final encuentra una petición
   * suelta y falla.
   */
  async function flushRecarga(): Promise<void> {
    await fixture.whenStable();
    http.expectOne((r) => r.url === '/accounting/accounts').flush({ items: [], count: 0, limit: 50 });
    http.expectOne((r) => r.url === '/accounting/practitioner/assets').flush([]);
    http.expectOne((r) => r.url === '/accounting/practitioner/liabilities').flush([]);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetsLiabilities],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetsLiabilities);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide la práctica, el plan de cuentas, los activos y los pasivos', () => {
    fixture.detectChanges();
    flushCarga();
  });

  it('no registra el avance de un activo sin elegir las dos cuentas primero', () => {
    fixture.detectChanges();
    flushCarga();
    fixture.detectChanges();

    const componente = fixture.componentInstance as unknown as {
      registrarAvanceDeActivo: (a: { id: string }) => void;
      errorDeAvanceDeActivo: () => string | null;
    };
    componente.registrarAvanceDeActivo({ id: 'as1' });

    expect(componente.errorDeAvanceDeActivo()).toContain('Elegí primero');
    // Sin POST: http.verify() lo confirma.
  });

  it('registra el avance de un activo una vez elegidas las cuentas', async () => {
    fixture.detectChanges();
    flushCarga();
    fixture.detectChanges();

    const componente = fixture.componentInstance as unknown as {
      cuentaDeGastoDepreciacion: { set: (v: string) => void };
      cuentaDeDepreciacionAcumulada: { set: (v: string) => void };
      registrarAvanceDeActivo: (a: { id: string }) => void;
    };
    componente.cuentaDeGastoDepreciacion.set('acc-exp');
    componente.cuentaDeDepreciacionAcumulada.set('acc-dep');
    componente.registrarAvanceDeActivo({ id: 'as1' });

    const req = http.expectOne((r) => r.url === '/accounting/practitioner/assets/as1/progress');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      depreciationExpenseAccountId: 'acc-exp',
      accumulatedDepreciationAccountId: 'acc-dep',
    });
    req.flush({ transactionId: 'tx1', amount: '16.67' });

    // El éxito reintenta la carga de lo que cuelga de la práctica.
    await flushRecarga();
  });

  it('da de alta un pasivo y refresca el listado', async () => {
    fixture.detectChanges();
    flushCarga();
    fixture.detectChanges();

    const componente = fixture.componentInstance as unknown as {
      formularioDePasivo: {
        setValue: (v: {
          code: string;
          name: string;
          creditorName: string;
          accountId: string;
          principalAmount: string;
          interestRate: string;
          installments: string;
          startDate: string;
        }) => void;
      };
      darDeAltaPasivo: () => void;
    };
    componente.formularioDePasivo.setValue({
      code: 'LIAB-1',
      name: 'Préstamo equipo',
      creditorName: 'Banco X',
      accountId: 'acc-1',
      principalAmount: '1200.00',
      interestRate: '12.00',
      installments: '3',
      startDate: '2026-09-05',
    });
    componente.darDeAltaPasivo();

    const req = http.expectOne((r) => r.url === '/accounting/practitioner/liabilities');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ practiceId: PRACTICE, code: 'LIAB-1', installments: 3 });
    req.flush({ id: 'liab1', code: 'LIAB-1', schedule: [] });

    await flushRecarga();
  });
});

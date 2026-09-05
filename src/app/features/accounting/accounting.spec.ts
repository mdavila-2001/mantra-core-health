import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { Accounting, agruparPorMes } from './accounting';
import type { PaidConsultation } from '../../core/data-access/accounting/accounting.types';
import { CsvExportService } from '../../shared/utils/csv-export/csv-export';

const PRACTICE = 'practice-1';

describe('Accounting — Carril 18 (auto-servicio contable del doctor)', () => {
  let fixture: ComponentFixture<Accounting>;
  let http: HttpTestingController;

  /**
   * Los pedidos que cuelgan de la práctica elegida (sin `/practices`).
   *
   * `general-ledger` sale último a propósito: depende de `cuentaDelMayor`, un
   * `linkedSignal` que recién elige la primera cuenta cuando responde
   * `/accounting/accounts` — así que hace falta un tick de detección de
   * cambios entre medio para que la pestaña «Libro mayor» (activa por
   * omisión) dispare su pedido.
   */
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

    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/accounting/general-ledger')
      .flush({
        accountId: 'acc-1',
        code: '1000',
        name: 'Caja',
        normalBalanceConceptId: 'b',
        currencyConceptId: null,
        openingBalance: '0.00',
        items: [],
        count: 0,
        limit: 100,
        nextCursor: null,
      });
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

  /**
   * El servicio de exportación de CSV, sustituido por un doble.
   *
   * Vía DI y no `vi.spyOn`: el runner de tests de este repo
   * (`@angular/build:unit-test`) no deja espiar una función exportada de un
   * módulo relativo ("Cannot redefine property") ni usar `vi.mock` sobre
   * imports relativos — el mensaje de su propio error dice "Please use
   * Angular TestBed for mocking dependencies". `CsvExportService` (FT-20)
   * existe justamente para dar esa costura.
   */
  let csvExportEspiado: { download: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    csvExportEspiado = { download: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [Accounting],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CsvExportService, useValue: csvExportEspiado },
      ],
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

  /**
   * FT-20 · Cuadro de mando integral: no agrega ninguna lectura propia, junta
   * las tres que ya existían (`resumen`, `estadoDeResultados`,
   * `balanceGeneral`). Lo que se fija acá es que **no** muestre nada hasta que
   * las tres respondieron — un cuadro de mando a medias mostraría, por
   * ejemplo, el resultado del período sin poder decir todavía si el balance
   * general cuadra.
   */
  it('el cuadro de mando junta los tres informes sólo cuando los tres respondieron', () => {
    fixture.detectChanges();
    flushCarga();
    fixture.detectChanges();

    const componente = fixture.componentInstance as unknown as {
      pestanaActiva: { set: (n: number) => void };
      indicadores: () => unknown;
    };
    expect(componente.indicadores()).toBeNull();

    componente.pestanaActiva.set(3);
    fixture.detectChanges();

    http.expectOne((r) => r.url === '/accounting/income-statement').flush({
      revenueItems: [],
      expenseItems: [],
      totalRevenue: '500.00',
      totalExpense: '120.00',
      netIncome: '380.00',
      count: 0,
      limit: 100,
      nextCursor: null,
      truncated: false,
    });
    // Sólo el estado de resultados respondió: todavía no hay cuadro de mando.
    expect(componente.indicadores()).toBeNull();

    http.expectOne((r) => r.url === '/accounting/balance-sheet').flush({
      assetItems: [],
      liabilityItems: [],
      equityItems: [],
      netIncomeOfPeriod: '380.00',
      totalAssets: '1000.00',
      totalLiabilities: '300.00',
      totalEquity: '700.00',
      totalLiabilitiesAndEquity: '1000.00',
      balanced: true,
      count: 0,
      limit: 100,
      nextCursor: null,
      truncated: false,
    });

    expect(componente.indicadores()).toEqual({
      cuadre: true,
      netIncome: '380.00',
      totalAssets: '1000.00',
      totalLiabilities: '300.00',
      totalEquity: '700.00',
      balanceado: true,
    });
  });

  /**
   * FT-20 · Flujo de caja: el libro mayor de la cuenta que la propia persona
   * elige como caja/banco (ver el JSDoc de `flujoDeCaja`), con entradas
   * (debe), salidas (haber) y neto calculados sobre esas filas reales.
   */
  it('el flujo de caja pide el mayor de la cuenta elegida y calcula entradas, salidas y neto', () => {
    fixture.detectChanges();
    flushCarga();
    fixture.detectChanges();

    const componente = fixture.componentInstance as unknown as {
      pestanaActiva: { set: (n: number) => void };
      resumenDeCaja: () => { entradas: string; salidas: string; neto: string } | null;
    };

    componente.pestanaActiva.set(4);
    fixture.detectChanges();

    http.expectOne((r) => r.url === '/accounting/general-ledger').flush({
      accountId: 'acc-1',
      code: '1000',
      name: 'Caja',
      normalBalanceConceptId: 'b',
      currencyConceptId: null,
      openingBalance: '0.00',
      items: [
        {
          id: 'm-1',
          transactionId: 't-1',
          transactionNumber: 'JT-1',
          transactionDate: '2026-09-01',
          directionConceptId: 'debit',
          debit: '200.00',
          credit: '0.00',
          runningBalance: '200.00',
        },
        {
          id: 'm-2',
          transactionId: 't-2',
          transactionNumber: 'JT-2',
          transactionDate: '2026-09-02',
          directionConceptId: 'credit',
          debit: '0.00',
          credit: '80.00',
          runningBalance: '120.00',
        },
      ],
      count: 2,
      limit: 100,
      nextCursor: null,
    });

    expect(componente.resumenDeCaja()).toEqual({
      entradas: '200.00',
      salidas: '80.00',
      neto: '120.00',
    });
  });

  it('exportarDiarioCsv no descarga nada mientras el diario está vacío', () => {
    fixture.detectChanges();
    // El fixture fijo de `flushCarga` responde `/journal-transactions` sin
    // filas, que es el estado `empty` (ver `filasDelDiario`) — CSV de un
    // informe vacío no es un archivo, es un encabezado solo.
    flushCarga();
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { exportarDiarioCsv: () => void }).exportarDiarioCsv();

    expect(csvExportEspiado.download).not.toHaveBeenCalled();
  });

  it('exportarDiarioCsv descarga el diario cuando tiene asientos', () => {
    fixture.detectChanges();

    http.expectOne((r) => r.url === '/practices').flush({
      items: [{ id: PRACTICE, code: 'P1', name: 'Práctica Uno', typeConceptId: 't', statusConceptId: 's' }],
      count: 1,
    });
    fixture.detectChanges();

    http.expectOne((r) => r.url === '/accounting/trial-balance').flush({
      items: [],
      count: 0,
      totalDebit: '0.00',
      totalCredit: '0.00',
      balanced: true,
      transactionsIncluded: 0,
      truncated: false,
    });
    http.expectOne((r) => r.url === '/accounting/journal-transactions').flush({
      items: [
        {
          id: 'jt-1',
          transactionNumber: 'JT-1',
          transactionDate: '2026-09-01',
          statusConceptId: 'posted',
          totalAmount: '80.00',
          postedAt: '2026-09-01',
        },
      ],
      count: 1,
      limit: 50,
    });
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
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/accounting/general-ledger').flush({
      accountId: 'acc-1',
      code: '1000',
      name: 'Caja',
      normalBalanceConceptId: 'b',
      currencyConceptId: null,
      openingBalance: '0.00',
      items: [],
      count: 0,
      limit: 100,
      nextCursor: null,
    });

    (fixture.componentInstance as unknown as { exportarDiarioCsv: () => void }).exportarDiarioCsv();

    expect(csvExportEspiado.download).toHaveBeenCalledTimes(1);
    expect(csvExportEspiado.download.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ transactionNumber: 'JT-1', totalAmount: '80.00' }),
    ]);
    expect(csvExportEspiado.download.mock.calls[0]?.[2]).toBe('libro-diario');
  });
});

/**
 * «Mi facturación» (H4 del plan de UX del 22/08/2026).
 *
 * El resumen que ve un médico en vez del balance de sumas y saldos. Lo que se
 * fija acá es la agrupación: un total mal sumado en una pantalla de plata se
 * descubre tarde y cuesta la confianza en toda la sección.
 */
describe('agruparPorMes', () => {
  function consulta(issueDate: Date, paidTotal: string, invoiceId = 'inv-1'): PaidConsultation {
    return {
      invoiceId,
      invoiceNumber: 'F-001',
      patientProfileId: 'per-1',
      issueDate,
      paidTotal,
    };
  }

  it('sin consultas no inventa un mes en cero', () => {
    expect(agruparPorMes([])).toEqual([]);
  });

  it('suma el mes y dice cuántas consultas fueron', () => {
    const meses = agruparPorMes([
      consulta(new Date(2026, 7, 3), '150.00', 'inv-1'),
      consulta(new Date(2026, 7, 21), '250.50', 'inv-2'),
    ]);

    expect(meses).toHaveLength(1);
    expect(meses[0].total).toBe('400.50');
    expect(meses[0].cuantas).toBe(2);
    expect(meses[0].promedio).toBe('200.25');
  });

  it('separa los meses y pone el más reciente arriba', () => {
    // Es el orden en que se lee una facturación: lo último primero.
    const meses = agruparPorMes([
      consulta(new Date(2026, 5, 1), '100.00', 'inv-1'),
      consulta(new Date(2026, 7, 1), '200.00', 'inv-2'),
      consulta(new Date(2026, 6, 1), '300.00', 'inv-3'),
    ]);

    expect(meses.map((m) => m.clave)).toEqual(['2026-08', '2026-07', '2026-06']);
  });

  it('no mezcla el mismo mes de años distintos', () => {
    const meses = agruparPorMes([
      consulta(new Date(2025, 7, 1), '100.00', 'inv-1'),
      consulta(new Date(2026, 7, 1), '200.00', 'inv-2'),
    ]);

    expect(meses.map((m) => m.clave)).toEqual(['2026-08', '2025-08']);
  });
});

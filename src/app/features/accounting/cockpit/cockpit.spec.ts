import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { API_BASE_URL } from '../../../core/data-access/api';
import { Cockpit } from './cockpit';
import { ACCION_DEL_ESTADO, ETIQUETA_DE_ESTADO, TONO_DEL_ESTADO } from './flujo-del-documento';

/* ============================================================================
    El cockpit contable.

    Lo que se prueba acá es lo que distingue a un cockpit de una lista: que el
    contexto mande, que el flujo del documento no admita saltos, y que un
    documento sin postear NO cuente como dinero en los libros. Lo estético se
    mira en el navegador, no acá.
    ========================================================================== */

const BASE = 'http://api.test';

function montar(): { fixture: ReturnType<typeof TestBed.createComponent<Cockpit>>; http: HttpTestingController } {
  TestBed.configureTestingModule({
    imports: [Cockpit],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      // El cockpit enlaza a los libros con `routerLink`, y esa directiva pide
      // `ActivatedRoute`: sin router el componente no se construye.
      provideRouter([]),
      { provide: API_BASE_URL, useValue: BASE },
    ],
  });
  const fixture = TestBed.createComponent(Cockpit);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

/** Responde la lista de prácticas con una sola práctica de prueba. */
function responderPracticas(http: HttpTestingController): void {
  http
    .expectOne(`${BASE}/practices`)
    .flush([{ id: 'prac-1', code: 'P1', name: 'Práctica de prueba' }]);
}

/** El ejercicio fiscal, con datos mínimos válidos. */
function ejercicioDePrueba(): object {
  return {
    fiscalYearId: 'fy-1',
    name: 'Ejercicio 2026',
    startsOn: '2026-01-01',
    endsOn: '2026-12-31',
    currentPeriodId: 'period-1',
    periods: [
      {
        id: 'period-1',
        periodNumber: 1,
        name: 'Enero',
        startsOn: '2026-01-01',
        endsOn: '2026-01-31',
        status: 'OPEN',
      },
    ],
  };
}

/**
 * Responde las ocho lecturas del tablero que no son el ejercicio (ya
 * resuelto por separado en cada test), con formas mínimas válidas.
 *
 * @param activos - Reemplaza los ítems de `GET /accounting/assets`, para el
 *   caso del activo no depreciable (retirado / no retirado).
 */
function responderRestoDelTablero(
  http: HttpTestingController,
  activos: readonly object[] = [],
): void {
  http.expectOne((r) => r.url.startsWith(`${BASE}/accounting/trial-balance`)).flush({
    items: [],
    count: 0,
    totalDebit: '0.00',
    totalCredit: '0.00',
    balanced: true,
    transactionsIncluded: 0,
    truncated: false,
  });
  http.expectOne((r) => r.url.startsWith(`${BASE}/accounting/income-statement`)).flush({
    revenueItems: [],
    expenseItems: [],
    totalRevenue: '0.00',
    totalExpense: '0.00',
    netIncome: '0.00',
    count: 0,
    limit: 0,
    nextCursor: null,
    truncated: false,
  });
  http.expectOne((r) => r.url.startsWith(`${BASE}/accounting/balance-sheet`)).flush({
    assetItems: [],
    liabilityItems: [],
    equityItems: [],
    netIncomeOfPeriod: '0.00',
    totalAssets: '0.00',
    totalLiabilities: '0.00',
    totalEquity: '0.00',
    totalLiabilitiesAndEquity: '0.00',
    balanced: true,
    count: 0,
    limit: 0,
    nextCursor: null,
  });
  http.expectOne((r) => r.url.startsWith(`${BASE}/accounting/open-items`)).flush({
    items: [],
    aging: [],
    totalReceivable: '0.00',
    totalPayable: '0.00',
  });
  http
    .expectOne((r) => r.url.startsWith(`${BASE}/accounting/dimensions`))
    .flush({ items: [] });
  http.expectOne((r) => r.url.startsWith(`${BASE}/accounting/assets`)).flush({
    items: activos,
    totalAcquisition: '0.00',
    totalAccumulated: '0.00',
    totalNetBookValue: '0.00',
    monthlyCharge: '0.00',
  });
  http.expectOne((r) => r.url.startsWith(`${BASE}/accounting/accrual-objects`)).flush({
    items: [],
    pendingTotal: '0.00',
    periodCharge: '0.00',
  });
  http
    .expectOne((r) => r.url.startsWith(`${BASE}/accounting/journal-transactions`))
    .flush({ items: [], count: 0, limit: 50, nextCursor: null });
}

describe('Cockpit contable', () => {
  it('pide las prácticas antes que nada: sin práctica no hay libros que leer', () => {
    const { http } = montar();

    // La primera llamada es la lista de prácticas; ninguna lectura contable
    // sale sin un `practiceId`, así que el cockpit no puede inventarse una.
    const pedido = http.expectOne(`${BASE}/practices`);
    expect(pedido.request.method).toBe('GET');

    http.verify();
  });

  it('con 404 en el ejercicio fiscal el tablero queda ready y ejercicio === null', () => {
    const { fixture, http } = montar();
    responderPracticas(http);
    fixture.detectChanges();

    http
      .expectOne((r) => r.url.startsWith(`${BASE}/accounting/fiscal-years`))
      .flush(
        { code: 'NOT_FOUND', message: 'Esta práctica no tiene ejercicio fiscal' },
        { status: 404, statusText: 'Not Found' },
      );
    responderRestoDelTablero(http);
    fixture.detectChanges();

    const cockpit = fixture.componentInstance;
    expect(cockpit.estadoDelTablero().status).toBe('ready');
    expect(cockpit.datos()).not.toBeNull();
    expect(cockpit.datos()?.ejercicio).toBeNull();

    http.verify();
  });

  it('con 404 en otra lectura sigue cayendo a errorToViewState (no-encontrado)', () => {
    const { fixture, http } = montar();
    responderPracticas(http);
    fixture.detectChanges();

    http
      .expectOne((r) => r.url.startsWith(`${BASE}/accounting/fiscal-years`))
      .flush(ejercicioDePrueba());
    http
      .expectOne((r) => r.url.startsWith(`${BASE}/accounting/trial-balance`))
      .flush(
        { code: 'NOT_FOUND', message: 'no existe' },
        { status: 404, statusText: 'Not Found' },
      );
    fixture.detectChanges();

    expect(fixture.componentInstance.estadoDelTablero().status).toBe('not-found');

    // `forkJoin` erra apenas UNA de sus fuentes erra y cancela las demás,
    // pero CUÁNDO exactamente el backend de pruebas marca esas peticiones
    // como canceladas no es observable desde acá — así que se intenta
    // responderlas igual y se ignora el error si ya estaban canceladas; lo
    // único que importa para el `verify()` final es que ninguna quede
    // abierta de verdad.
    for (const ruta of [
      'income-statement',
      'balance-sheet',
      'open-items',
      'dimensions',
      'assets',
      'accrual-objects',
      'journal-transactions',
    ]) {
      try {
        http.expectOne((r) => r.url.startsWith(`${BASE}/accounting/${ruta}`)).flush({});
      } catch {
        // Ya estaba cancelada: exactamente lo esperado si `forkJoin` alcanzó
        // a desuscribirse antes de este punto.
      }
    }

    http.verify();
  });

  it('un activo no depreciable dice si está de baja o ya amortizado, y no muestra cuota', () => {
    const { fixture, http } = montar();
    responderPracticas(http);
    fixture.detectChanges();

    http
      .expectOne((r) => r.url.startsWith(`${BASE}/accounting/fiscal-years`))
      .flush(ejercicioDePrueba());
    responderRestoDelTablero(http, [
      {
        id: 'act-retirado',
        code: 'ACT-1',
        name: 'Silla de ruedas',
        className: 'Equipo médico',
        classCode: 'EQ',
        usefulLifeMonths: 60,
        acquisitionCost: '1000.00',
        accumulatedDepreciation: '1000.00',
        netBookValue: '0.00',
        monthlyDepreciation: '16.67',
        depreciable: false,
        status: 'RETIRED',
      },
      {
        id: 'act-amortizado',
        code: 'ACT-2',
        name: 'Monitor de signos',
        className: 'Equipo médico',
        classCode: 'EQ',
        usefulLifeMonths: 36,
        acquisitionCost: '2000.00',
        accumulatedDepreciation: '2000.00',
        netBookValue: '0.00',
        monthlyDepreciation: '55.56',
        depreciable: false,
        status: 'ACTIVE',
      },
    ]);
    // Los activos viven en la pestaña «Cierre del período» (índice 3); el
    // panel inactivo no se renderiza (ver `tab.html`), así que hay que
    // seleccionarla antes de leer el DOM.
    fixture.componentInstance.pestana.set(3);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('dado de baja');
    expect(texto).toContain('amortizado del todo');
    // Ninguno de los dos activos no depreciables debe mostrar su cuota mensual.
    expect(texto).not.toContain('16.67');
    expect(texto).not.toContain('/mes');

    http.verify();
  });

  it('no ofrece ninguna acción para un documento revertido', () => {
    // Revertido es terminal: el documento espejo ya existe y no hay nada que
    // hacerle. Ofrecer un botón ahí sería prometer una llamada que la API
    // rechaza con 422.
    expect(ACCION_DEL_ESTADO.REVERSED).toBeNull();
  });

  it('cada estado del flujo ofrece UNA sola acción, la que el backend acepta', () => {
    // La máquina no admite saltos: de borrador no se postea, se clasifica.
    expect(ACCION_DEL_ESTADO.DRAFT?.action).toBe('classify');
    expect(ACCION_DEL_ESTADO.AUTO_CLASSIFIED?.action).toBe('submit-review');
    expect(ACCION_DEL_ESTADO.PENDING_REVIEW?.action).toBe('approve');
    expect(ACCION_DEL_ESTADO.APPROVED?.action).toBe('post');
    expect(ACCION_DEL_ESTADO.POSTED?.action).toBe('reverse');
  });

  it('postear es la única acción principal: es la única que toca el mayor', () => {
    const principales = Object.values(ACCION_DEL_ESTADO)
      .filter((a) => a !== null)
      .filter((a) => a.principal);

    expect(principales.map((a) => a.action)).toEqual(['post']);
  });

  it('sólo el posteado se pinta en verde', () => {
    // Un estado intermedio en verde diría «ya está» sobre algo que todavía no
    // existe para los libros.
    const verdes = Object.entries(TONO_DEL_ESTADO)
      .filter(([, tono]) => tono === 'success')
      .map(([estado]) => estado);

    expect(verdes).toEqual(['POSTED']);
  });

  it('los seis estados tienen nombre en castellano', () => {
    // Si un estado llega sin traducir, la bandeja muestra `AUTO_CLASSIFIED` a
    // quien lleva los libros.
    expect(Object.values(ETIQUETA_DE_ESTADO).every((e) => /^[A-ZÁÉÍÓÚÑ]/.test(e))).toBe(true);
    expect(Object.keys(ETIQUETA_DE_ESTADO).length).toBe(6);
  });

  it('formatea el importe sin convertirlo a número', () => {
    const { fixture } = montar();
    const cockpit = fixture.componentInstance;

    // El importe viaja como texto decimal a propósito: pasarlo por un `float`
    // es cómo un balance termina descuadrado por un céntimo. El formateo
    // separa miles y conserva los dos decimales tal como llegaron.
    expect(cockpit.importe('1465927.50')).toBe('Bs 1 465 927,50');
    expect(cockpit.importe('0.00')).toBe('Bs 0,00');
    expect(cockpit.importe('-2480.35')).toBe('Bs -2 480,35');
  });

  it('reconoce un importe negativo por su signo, no por su valor', () => {
    const { fixture } = montar();
    const cockpit = fixture.componentInstance;

    expect(cockpit.esNegativo('-1.00')).toBe(true);
    expect(cockpit.esNegativo('0.00')).toBe(false);
    expect(cockpit.esNegativo('1250.00')).toBe(false);
  });
});

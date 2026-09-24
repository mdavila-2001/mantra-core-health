import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { API_BASE_URL } from '../../../core/data-access/api';
import { Resumen } from './resumen';

/* ============================================================================
    El resumen llano de Contabilidad.

    Lo que se prueba acá es lo que lo distingue del cockpit —y lo que, si se
    rompe, vuelve a dejar una pantalla que le habla al médico en idioma de
    contador—:

    1. Que «hoy», «esta semana» y «este mes» sean **tres lecturas con su
       ventana**, no la misma cifra repetida tres veces. Es el defecto exacto
       que motivó la pantalla.
    2. Que los nombres de cuenta se traduzcan, y que una cuenta desconocida
       conserve el suyo en vez de inventarse uno.
    3. Que el aviso de vencimiento diga en texto lo que el color dice en
       color.
    4. Que cobrar y pagar sean la misma compensación que ya hacía el cockpit.

    Lo estético se mira en el navegador, no acá.
    ========================================================================== */

const BASE = 'http://api.test';

function montar(): {
  fixture: ReturnType<typeof TestBed.createComponent<Resumen>>;
  http: HttpTestingController;
} {
  TestBed.configureTestingModule({
    imports: [Resumen],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      // El resumen enlaza al cockpit, a los libros y a activos y pasivos con
      // `routerLink`, y esa directiva pide `ActivatedRoute`.
      provideRouter([]),
      { provide: API_BASE_URL, useValue: BASE },
    ],
  });
  const fixture = TestBed.createComponent(Resumen);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

/**
 * Contesta el listado de prácticas y **corre un ciclo**.
 *
 * El ciclo no es decorativo: las nueve lecturas del tablero cuelgan de un
 * `toObservable(computed(...))`, que es un efecto, y sin ciclo el efecto no
 * se ejecuta y no sale ninguna petición. Mismo patrón que `cockpit.spec.ts`.
 */
function responderPracticas(
  http: HttpTestingController,
  fixture: { detectChanges: () => void },
): void {
  http
    .expectOne(`${BASE}/practices`)
    .flush([{ id: 'prac-1', code: 'P1', name: 'Consultorio de prueba' }]);
  fixture.detectChanges();
}

/** Un estado de resultados con los totales dados y sin líneas. */
function resultado(revenue: string, expense: string, net: string): object {
  return {
    revenueItems: [],
    expenseItems: [],
    totalRevenue: revenue,
    totalExpense: expense,
    netIncome: net,
    count: 0,
    limit: 200,
    nextCursor: null,
    truncated: false,
  };
}

const CARTERA_VACIA = {
  items: [],
  aging: [],
  totalReceivable: '0.00',
  totalPayable: '0.00',
};

const SITUACION = {
  assetItems: [],
  liabilityItems: [],
  equityItems: [],
  netIncomeOfPeriod: '0.00',
  totalAssets: '1000.00',
  totalLiabilities: '400.00',
  totalEquity: '600.00',
  totalLiabilitiesAndEquity: '1000.00',
  balanced: true,
  count: 0,
  limit: 200,
  nextCursor: null,
  truncated: false,
};

const EQUIPOS = {
  items: [],
  totalAcquisition: '0.00',
  totalAccumulated: '0.00',
  totalNetBookValue: '0.00',
  monthlyCharge: '0.00',
};

/**
 * Contesta las nueve lecturas del tablero. Los seis estados de resultados se
 * responden **en el orden en que salieron**, que es el del `forkJoin`.
 */
function responderTablero(
  http: HttpTestingController,
  estados: readonly object[],
  opciones: { cartera?: object } = {},
): void {
  const pedidos = http.match((r) => r.url === `${BASE}/accounting/income-statement`);
  expect(pedidos).toHaveLength(6);
  pedidos.forEach((pedido, i) => pedido.flush(estados[i]));
  http.expectOne((r) => r.url === `${BASE}/accounting/open-items`).flush(opciones.cartera ?? CARTERA_VACIA);
  http.expectOne((r) => r.url === `${BASE}/accounting/balance-sheet`).flush(SITUACION);
  http.expectOne((r) => r.url === `${BASE}/accounting/assets`).flush(EQUIPOS);
}

describe('Resumen contable', () => {
  describe('los tres tramos', () => {
    it('pide el estado de resultados SEIS veces, cada una con su ventana', () => {
      // Tres tramos y sus tres comparables. Si alguien "optimiza" esto a una
      // sola lectura filtrada en el navegador, «hoy» vuelve a dar el total del
      // ejercicio, que es el defecto que la pantalla vino a corregir.
      const { fixture, http } = montar();
      responderPracticas(http, fixture);

      const pedidos = http.match((r) => r.url === `${BASE}/accounting/income-statement`);
      expect(pedidos).toHaveLength(6);

      const ventanas = pedidos.map((p) => ({
        from: p.request.params.get('from'),
        to: p.request.params.get('to'),
      }));
      // Las seis son distintas entre sí, y las seis llevan las dos puntas.
      expect(new Set(ventanas.map((v) => `${v.from}|${v.to}`)).size).toBe(6);
      expect(ventanas.every((v) => v.from !== null && v.to !== null)).toBe(true);
      // Y todas cuelgan de la práctica elegida.
      expect(pedidos.every((p) => p.request.params.get('practiceId') === 'prac-1')).toBe(true);

      pedidos.forEach((p) => p.flush(resultado('0.00', '0.00', '0.00')));
      http.expectOne((r) => r.url === `${BASE}/accounting/open-items`).flush(CARTERA_VACIA);
      http.expectOne((r) => r.url === `${BASE}/accounting/balance-sheet`).flush(SITUACION);
      http.expectOne((r) => r.url === `${BASE}/accounting/assets`).flush(EQUIPOS);
      http.verify();
    });

    it('cada tramo muestra SU cifra, y «te quedó» sale de la API sin restar acá', () => {
      const { fixture, http } = montar();
      responderPracticas(http, fixture);
      responderTablero(http, [
        resultado('1450.00', '180.00', '1270.00'), // hoy
        resultado('1730.00', '0.00', '1730.00'), // ayer
        resultado('8880.00', '488.33', '8391.67'), // semana
        resultado('1740.00', '0.00', '1740.00'), // semana previa
        resultado('14220.00', '5483.33', '8736.67'), // mes
        resultado('6130.00', '0.00', '6130.00'), // mes previo
      ]);
      fixture.detectChanges();

      const tramos = (fixture.componentInstance as unknown as { tramos: () => readonly {
        clave: string; entro: string; salio: string; quedo: string;
      }[] }).tramos();

      expect(tramos.map((t) => t.clave)).toEqual(['hoy', 'semana', 'mes']);
      expect(tramos.map((t) => t.entro)).toEqual(['1450.00', '8880.00', '14220.00']);
      expect(tramos.map((t) => t.salio)).toEqual(['180.00', '488.33', '5483.33']);
      // `netIncome` tal cual: la pantalla no hace `entro - salio`.
      expect(tramos.map((t) => t.quedo)).toEqual(['1270.00', '8391.67', '8736.67']);
    });

    it('la comparación es contra el tramo previo, no contra el tramo de al lado', () => {
      const { fixture, http } = montar();
      responderPracticas(http, fixture);
      responderTablero(http, [
        resultado('800.00', '0.00', '800.00'), // hoy
        resultado('1000.00', '0.00', '1000.00'), // ayer: bajó 20 %
        resultado('1200.00', '0.00', '1200.00'), // semana
        resultado('1000.00', '0.00', '1000.00'), // semana previa: subió 20 %
        resultado('1000.00', '0.00', '1000.00'), // mes
        resultado('0.00', '0.00', '0.00'), // mes previo: sin comparable
      ]);
      fixture.detectChanges();

      const tramos = (fixture.componentInstance as unknown as { tramos: () => readonly {
        comparacion: { direccion: string; porcentaje: number } | null;
      }[] }).tramos();

      expect(tramos[0]?.comparacion).toMatchObject({ direccion: 'baja', porcentaje: 20 });
      expect(tramos[1]?.comparacion).toMatchObject({ direccion: 'sube', porcentaje: 20 });
      // Mes previo en cero: no se inventa un «+100 %».
      expect(tramos[2]?.comparacion).toBeNull();
    });
  });

  describe('los nombres de las cuentas', () => {
    it('traduce las del plan estándar y respeta las que no conoce', () => {
      const { fixture, http } = montar();
      responderPracticas(http, fixture);
      const mes = {
        ...resultado('0.00', '1000.00', '-1000.00'),
        expenseItems: [
          { accountId: 'a1', code: '5.5', name: 'Depreciación', accountTypeConceptId: 'g', amount: '600.00' },
          { accountId: 'a2', code: '5.3', name: 'Servicios básicos', accountTypeConceptId: 'g', amount: '300.00' },
          { accountId: 'a3', code: '9.9', name: 'Gasto raro de la práctica', accountTypeConceptId: 'g', amount: '100.00' },
        ],
      };
      responderTablero(http, [
        resultado('0.00', '0.00', '0.00'),
        resultado('0.00', '0.00', '0.00'),
        resultado('0.00', '0.00', '0.00'),
        resultado('0.00', '0.00', '0.00'),
        mes,
        resultado('0.00', '0.00', '0.00'),
      ]);
      fixture.detectChanges();

      const gastos = (fixture.componentInstance as unknown as { gastosDelMes: () => readonly {
        nombre: string; porcentaje: number; aclaracion: string | null;
      }[] }).gastosDelMes();

      expect(gastos.map((g) => g.nombre)).toEqual([
        'Desgaste de los equipos',
        'Luz, agua e internet',
        // Una cuenta fuera del plan conocido conserva su nombre: inventarle uno
        // llano sería peor que mostrar el que la práctica le puso.
        'Gasto raro de la práctica',
      ]);
      // Ordenados de mayor a menor, con su parte del total.
      expect(gastos.map((g) => g.porcentaje)).toEqual([60, 30, 10]);
      // El desgaste se explica: no es plata que sale de la cuenta.
      expect(gastos[0]?.aclaracion).toContain('No sale plata');
      expect(gastos[1]?.aclaracion).toBeNull();
    });

    it('una cuenta en cero no ocupa un renglón', () => {
      const { fixture, http } = montar();
      responderPracticas(http, fixture);
      const mes = {
        ...resultado('0.00', '100.00', '-100.00'),
        expenseItems: [
          { accountId: 'a1', code: '5.1', name: 'Alquiler', accountTypeConceptId: 'g', amount: '100.00' },
          { accountId: 'a2', code: '5.2', name: 'Insumos', accountTypeConceptId: 'g', amount: '0.00' },
        ],
      };
      responderTablero(http, [
        resultado('0.00', '0.00', '0.00'),
        resultado('0.00', '0.00', '0.00'),
        resultado('0.00', '0.00', '0.00'),
        resultado('0.00', '0.00', '0.00'),
        mes,
        resultado('0.00', '0.00', '0.00'),
      ]);
      fixture.detectChanges();

      expect(
        (fixture.componentInstance as unknown as { gastosDelMes: () => readonly unknown[] })
          .gastosDelMes(),
      ).toHaveLength(1);
    });
  });

  describe('lo que está pendiente', () => {
    const hoyIso = (dias: number): string => {
      const d = new Date();
      d.setDate(d.getDate() + dias);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    function carteraDePrueba(): object {
      return {
        items: [
          {
            id: 'oi-1', documentNumber: 'FC-1', accountCode: '1.3', accountName: 'Por cobrar',
            partnerName: 'Seguros Andina', side: 'RECEIVABLE', documentDate: hoyIso(-90),
            dueDate: hoyIso(-45), amount: '4820.00', clearedAmount: '0.00',
            openAmount: '4820.00', overdueDays: 45, agingBucket: 'D31_60',
          },
          {
            id: 'oi-2', documentNumber: 'FC-2', accountCode: '1.3', accountName: 'Por cobrar',
            partnerName: 'Nacional Vida', side: 'RECEIVABLE', documentDate: hoyIso(-20),
            dueDate: hoyIso(8), amount: '3120.00', clearedAmount: '0.00',
            openAmount: '3120.00', overdueDays: 0, agingBucket: 'CORRIENTE',
          },
          {
            id: 'oi-3', documentNumber: 'FP-1', accountCode: '2.3', accountName: 'Proveedores',
            partnerName: 'Droguería Boliviana', side: 'PAYABLE', documentDate: hoyIso(-30),
            dueDate: hoyIso(-1), amount: '1740.00', clearedAmount: '0.00',
            openAmount: '1740.00', overdueDays: 1, agingBucket: 'D1_30',
          },
        ],
        aging: [],
        totalReceivable: '7940.00',
        totalPayable: '1740.00',
      };
    }

    function montarConCartera(): ReturnType<typeof montar> {
      const montado = montar();
      responderPracticas(montado.http, montado.fixture);
      responderTablero(
        montado.http,
        Array.from({ length: 6 }, () => resultado('0.00', '0.00', '0.00')),
        { cartera: carteraDePrueba() },
      );
      montado.fixture.detectChanges();
      return montado;
    }

    it('separa las dos columnas y pone lo más vencido arriba', () => {
      const { fixture } = montarConCartera();
      const c = fixture.componentInstance as unknown as {
        teDeben: () => readonly { quien: string; aviso: string; tono: string }[];
        tenesQuePagar: () => readonly { quien: string; aviso: string; tono: string }[];
      };

      expect(c.teDeben().map((p) => p.quien)).toEqual(['Seguros Andina', 'Nacional Vida']);
      expect(c.tenesQuePagar().map((p) => p.quien)).toEqual(['Droguería Boliviana']);
    });

    it('el aviso dice en texto lo mismo que el color dice en color', () => {
      // Regla de la casa: no depender de distinguir rojo. El chip lleva el
      // plazo escrito, no sólo el tono.
      const { fixture } = montarConCartera();
      const c = fixture.componentInstance as unknown as {
        teDeben: () => readonly { aviso: string; tono: string }[];
        tenesQuePagar: () => readonly { aviso: string; tono: string }[];
      };

      expect(c.teDeben()[0]).toMatchObject({ aviso: 'Venció hace 45 días', tono: 'error' });
      expect(c.teDeben()[1]).toMatchObject({ aviso: 'Vence en 8 días', tono: 'neutral' });
      // Un día de atraso no es lo mismo que cuarenta y cinco: avisa, no alarma.
      expect(c.tenesQuePagar()[0]).toMatchObject({ aviso: 'Venció hace 1 día', tono: 'warning' });
    });

    it('cuenta cuántas ya vencieron, que es el número accionable', () => {
      const { fixture } = montarConCartera();
      const c = fixture.componentInstance as unknown as {
        vencidasQueTeDeben: () => number;
        vencidasQueDebes: () => number;
      };
      expect(c.vencidasQueTeDeben()).toBe(1);
      expect(c.vencidasQueDebes()).toBe(1);
    });

    it('«Ya me pagaron» compensa la partida y vuelve a leer el tablero', () => {
      // Es la misma compensación que el cockpit llama «Compensar». Cambia el
      // verbo porque cambia el lector, no el contrato.
      const { fixture, http } = montarConCartera();
      const c = fixture.componentInstance as unknown as {
        teDeben: () => readonly { id: string }[];
        saldar: (p: unknown, lado: 'cobro' | 'pago') => void;
      };

      c.saldar(c.teDeben()[0], 'cobro');

      const compensacion = http.expectOne(`${BASE}/accounting/clearing-documents`);
      expect(compensacion.request.method).toBe('POST');
      expect(compensacion.request.body).toEqual({ openItemIds: ['oi-1'] });
      compensacion.flush({ clearingDocumentId: 'cd-1', clearedItems: 1, clearedAmount: '4820.00' });
      fixture.detectChanges();

      // Y no se queda con la pantalla vieja: relee todo, porque compensar
      // cambia la cartera **y** los saldos.
      expect(http.match((r) => r.url === `${BASE}/accounting/income-statement`)).toHaveLength(6);
      expect(http.match((r) => r.url === `${BASE}/accounting/open-items`)).toHaveLength(1);
    });
  });

  describe('lo que tenés y lo que debés', () => {
    it('deja fuera los equipos dados de baja y los que ya no valen nada', () => {
      const { fixture, http } = montar();
      responderPracticas(http, fixture);
      const pedidos = http.match((r) => r.url === `${BASE}/accounting/income-statement`);
      pedidos.forEach((p) => p.flush(resultado('0.00', '0.00', '0.00')));
      http.expectOne((r) => r.url === `${BASE}/accounting/open-items`).flush(CARTERA_VACIA);
      http.expectOne((r) => r.url === `${BASE}/accounting/balance-sheet`).flush(SITUACION);
      http.expectOne((r) => r.url === `${BASE}/accounting/assets`).flush({
        items: [
          { id: 'e1', code: 'EQ-1', name: 'Ecógrafo', className: 'Equipos', classCode: 'EQ', usefulLifeMonths: 60, acquisitionCost: '45000.00', accumulatedDepreciation: '3750.00', netBookValue: '41250.00', monthlyDepreciation: '750.00', depreciable: true, status: 'ACTIVE' },
          { id: 'e2', code: 'EQ-0', name: 'Tensiómetro de mercurio', className: 'Equipos', classCode: 'EQ', usefulLifeMonths: 0, acquisitionCost: '350.00', accumulatedDepreciation: '350.00', netBookValue: '0.00', monthlyDepreciation: '0.00', depreciable: false, status: 'RETIRED' },
          { id: 'e3', code: 'EQ-2', name: 'Camilla ya amortizada', className: 'Equipos', classCode: 'EQ', usefulLifeMonths: 36, acquisitionCost: '6500.00', accumulatedDepreciation: '6500.00', netBookValue: '0.00', monthlyDepreciation: '0.00', depreciable: false, status: 'ACTIVE' },
        ],
        totalAcquisition: '51850.00',
        totalAccumulated: '10600.00',
        totalNetBookValue: '41250.00',
        monthlyCharge: '750.00',
      });
      fixture.detectChanges();

      const equipos = (
        fixture.componentInstance as unknown as { equiposConValor: () => readonly { name: string }[] }
      ).equiposConValor();

      // Un renglón en cero en «lo que tenés» ocupa lugar y no dice nada. El
      // registro completo está en la pantalla de activos y pasivos.
      expect(equipos.map((e) => e.name)).toEqual(['Ecógrafo']);
    });
  });

  describe('la práctica', () => {
    it('con una sola no se pregunta cuál', () => {
      const { fixture, http } = montar();
      responderPracticas(http, fixture);
      expect(
        (fixture.componentInstance as unknown as { hayVariasPracticas: () => boolean })
          .hayVariasPracticas(),
      ).toBe(false);
    });
  });

  it('no pide nada que no conteste, ni deja nada colgando', () => {
    // `verify()` falla si quedó una petición sin responder: es la red de la
    // que cuelga todo lo de arriba, porque un `forkJoin` al que le falta una
    // rama no emite y la pantalla se queda cargando para siempre.
    const { fixture, http } = montar();
    responderPracticas(http, fixture);
    responderTablero(http, Array.from({ length: 6 }, () => resultado('0.00', '0.00', '0.00')));
    http.verify();
  });
});

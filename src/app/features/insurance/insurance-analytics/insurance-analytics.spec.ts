import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { esperarSinViolaciones } from '../../../../testing/a11y';
import { CsvExportService } from '../../../shared/utils/csv-export/csv-export';
import { InsuranceAnalytics } from './insurance-analytics';

const CARRIER_ID = '11111111-1111-4111-8111-111111111111';
const PLAN_ID = '22222222-2222-4222-8222-222222222222';

/** El catálogo mínimo que consume la constructora: una aseguradora, un plan. */
function carriersWire() {
  return { items: [{ id: CARRIER_ID }], count: 1 };
}

function carrierDetailWire() {
  return {
    id: CARRIER_ID,
    products: [
      {
        id: 'prod-1',
        plans: [
          { id: PLAN_ID, name: 'Plan Salud Total', monthlyPremiumAmount: '100.00', benefits: [] },
        ],
      },
    ],
    networks: [],
  };
}

/**
 * El tablero tal cual lo devuelve la API: importes como cadena, tasas
 * `string | null`. `overrides.kpis` se **fusiona** sobre los valores por
 * defecto (no los reemplaza entero): un test que sólo quiere otro
 * `lossRatioPercent` no tiene que repetir los otros catorce campos.
 */
function dashboardWire(overrides: Record<string, unknown> = {}) {
  const { kpis: kpisOverride, ...topOverrides } = overrides;
  return {
    carrierId: CARRIER_ID,
    carrierLegalName: 'Nacional Seguros',
    startDate: '2025-09-14',
    endDate: '2026-09-14',
    currency: { code: 'BOB', display: 'Boliviano' },
    kpis: {
      totalClaimsCount: 12,
      adjudicatedClaimsCount: 10,
      pendingClaimsCount: 2,
      otherCurrencyClaimsCount: 0,
      totalBilledAmount: '350000.00',
      totalApprovedAmount: '280000.00',
      totalPatientCopayAmount: '15000.00',
      totalDeniedAmount: '40000.00',
      approvalRatePercent: '80.00',
      activeAffiliatesCount: 47,
      periodMonths: '12.00',
      averageMonthlyPerCapitaExpense: '496.45',
      averageAnnualPerCapitaExpense: '5957.45',
      estimatedPremiumsTotal: '400000.00',
      coveragesWithoutPremiumCount: 0,
      lossRatioPercent: '70.00',
      ...((kpisOverride as Record<string, unknown>) ?? {}),
    },
    monthlyTrends: [{ period: '2026-08', billedAmount: '30000.00', approvedAmount: '24000.00', claimsCount: 3 }],
    topMedications: [
      {
        medicationCode: 'RXN-1',
        medicationName: 'Losartán potásico 50 mg',
        dispensationsCount: '18',
        totalExpenseAmount: '2160.00',
        sharePercent: '22.30',
      },
    ],
    specialties: [
      { specialtyCode: 'MED_GEN', specialtyName: 'Medicina General', consultationsCount: 9, totalExpenseAmount: null },
    ],
    prevalentPathologies: [
      { code: 'I10', description: 'Hipertensión esencial', casesCount: 6, percentage: '18.75' },
    ],
    immunization: { vaccinatedCount: 30, unvaccinatedCount: 17, vaccinationRatePercent: '63.83' },
    ...topOverrides,
  };
}

/**
 * El tablero de siniestralidad (subtarea 3.1). Sólo se prueba lo que distingue
 * a esta pantalla: que los importes lleguen tal cual desde Postgres y sólo se
 * les dé formato (nunca `Number()`), que cambiar el período dispare una nueva
 * consulta con el rango correcto, y que el semáforo del loss ratio siga los
 * umbrales acordados con el usuario (verde < 75 · ámbar 75-85 · rojo > 85).
 */
describe('InsuranceAnalytics', () => {
  let fixture: ComponentFixture<InsuranceAnalytics>;
  let http: HttpTestingController;
  let csvExportEspiado: { download: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    csvExportEspiado = { download: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CsvExportService, useValue: csvExportEspiado },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Monta, resuelve el catálogo de la aseguradora y devuelve la petición del tablero (sin flushear). */
  function mount() {
    fixture = TestBed.createComponent(InsuranceAnalytics);
    fixture.detectChanges();
    http.expectOne('/insurance-carriers').flush(carriersWire());
    http.expectOne(`/insurance-carriers/${CARRIER_ID}`).flush(carrierDetailWire());
    return dashboardRequest();
  }

  function dashboardRequest() {
    return http.expectOne((req) => req.url === '/insurance/analytics/loss-ratio');
  }

  function diasEntre(desde: string, hasta: string): number {
    const a = Date.parse(`${desde}T00:00:00Z`);
    const b = Date.parse(`${hasta}T00:00:00Z`);
    return Math.round((b - a) / 86_400_000);
  }

  it('pide el rango de un año por defecto', () => {
    const req = mount();
    const startDate = req.request.params.get('startDate')!;
    const endDate = req.request.params.get('endDate')!;

    expect(diasEntre(startDate, endDate)).toBe(365);
    req.flush(dashboardWire());
  });

  it('pinta las cinco tarjetas KPI con el formato boliviano, sin recalcular nada', () => {
    const req = mount();
    req.flush(dashboardWire());
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    // 280.000,00 Bs: miles con punto, decimales con coma, sufijo Bs — nunca `Number()`.
    expect(texto).toContain('280.000,00 Bs');
    expect(texto).toContain('70.00 %'); // loss ratio
    expect(texto).toContain('496,45 Bs'); // per cápita mensual
    expect(texto).toContain('12'); // reclamos totales
    expect(texto).toContain('47'); // afiliados protegidos

    const tiles = ['kpi-loss-ratio', 'kpi-total-approved', 'kpi-per-capita', 'kpi-claims', 'kpi-affiliates'];
    for (const testId of tiles) {
      expect(fixture.nativeElement.querySelector(`[data-testid="${testId}"]`)).not.toBeNull();
    }

    // El boliviano se muestra como «Bs», no como «Boliviano» (display-currency.ts).
    expect(texto).toContain('Moneda de reporte: Bs');
  });

  it('cambiar a «90 días» vuelve a pedir el tablero con la ventana correcta', async () => {
    const primera = mount();
    primera.flush(dashboardWire());
    fixture.detectChanges();

    const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="segmentado-90d"]',
    );
    expect(boton).not.toBeNull();
    boton.click();
    // `changeRange` navega por el router (async, aunque sin rutas configuradas);
    // hay que dejar que esa navegación resuelva antes de esperar la nueva petición.
    await fixture.whenStable();
    fixture.detectChanges();

    const segunda = dashboardRequest();
    const startDate = segunda.request.params.get('startDate')!;
    const endDate = segunda.request.params.get('endDate')!;
    expect(diasEntre(startDate, endDate)).toBe(90);
    segunda.flush(dashboardWire());
  });

  /** Abre una pestaña por su rótulo, como lo haría una persona. */
  function abrirPestana(rotulo: string): void {
    const pestanas: HTMLElement[] = [...fixture.nativeElement.querySelectorAll('[role="tab"]')];
    const pestana = pestanas.find((el) => el.textContent?.trim() === rotulo);
    expect(pestana, `pestaña «${rotulo}»`).toBeDefined();
    pestana!.click();
    fixture.detectChanges();
  }

  it('organiza el tablero en cuatro pestañas por grupo de vistas', () => {
    const req = mount();
    req.flush(dashboardWire());
    fixture.detectChanges();

    const rotulos = [...fixture.nativeElement.querySelectorAll('[role="tab"]')].map((el) =>
      (el as HTMLElement).textContent?.trim(),
    );
    expect(rotulos).toEqual(['Resumen', 'Gasto y farmacia', 'Población', 'Por persona']);
    // Sólo se dibuja el panel abierto: el resumen, no la población.
    expect(fixture.nativeElement.querySelector('[data-testid="kpi-loss-ratio"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="section-immunization"]')).toBeNull();
  });

  it('cada pestaña pone sus tarjetas en una rejilla', () => {
    const req = mount();
    req.flush(dashboardWire());
    fixture.detectChanges();

    abrirPestana('Población');
    const rejilla = fixture.nativeElement.querySelector('.analytics__grid');
    expect(rejilla).not.toBeNull();
    expect(rejilla.querySelectorAll('.analytics__panel').length).toBe(3);
    expect(fixture.nativeElement.querySelector('[data-testid="section-immunization"]')).not.toBeNull();
  });

  it('la pestaña activa viaja en la URL, como el período y el plan', async () => {
    const req = mount();
    req.flush(dashboardWire());
    fixture.detectChanges();

    abrirPestana('Gasto y farmacia');
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toContain('tab=spend');
  });

  it('el top 10 de medicamentos se pinta con nombre e importe tal cual llegaron', () => {
    const req = mount();
    req.flush(dashboardWire());
    fixture.detectChanges();
    abrirPestana('Gasto y farmacia');

    const tabla = fixture.nativeElement.querySelector('[data-testid="table-top-medications"]');
    expect(tabla).not.toBeNull();
    expect(tabla.textContent).toContain('Losartán potásico 50 mg');
    expect(tabla.textContent).toContain('2160.00');
  });

  it('el botón de exportar está deshabilitado mientras carga y exporta las filas al hacer clic', () => {
    // AppButton se deshabilita por `aria-disabled` (no el atributo nativo
    // `disabled`), con el click interceptado — así lo documenta su JSDoc.
    const req = mount();
    const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="btn-export-analytics"]',
    );
    expect(boton.getAttribute('aria-disabled')).toBe('true');

    req.flush(dashboardWire());
    fixture.detectChanges();
    expect(boton.getAttribute('aria-disabled')).toBe('false');

    boton.click();
    expect(csvExportEspiado.download).toHaveBeenCalledTimes(1);
    const [filas, columnas, nombre] = csvExportEspiado.download.mock.calls[0] as [
      readonly unknown[],
      readonly unknown[],
      string,
    ];
    expect(filas.length).toBeGreaterThan(0);
    expect(columnas.length).toBe(4);
    expect(nombre).toBe('siniestralidad-2025-09-14-2026-09-14');
  });

  it('semáforo: verde bajo 75, ámbar entre 75 y 85, rojo sobre 85', async () => {
    const req = mount();
    req.flush(dashboardWire({ kpis: { lossRatioPercent: '60.00' } }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Saludable');

    // Fuerza una nueva carga con otro loss ratio reutilizando el flujo de filtros.
    const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="segmentado-90d"]',
    );
    boton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const req2 = dashboardRequest();
    req2.flush(dashboardWire({ kpis: { lossRatioPercent: '80.00' } }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Atención');
  });

  it('sin prima registrada: el loss ratio es null y el semáforo lo dice con palabras, no con un cero', () => {
    const req = mount();
    req.flush(dashboardWire({ kpis: { lossRatioPercent: null, coveragesWithoutPremiumCount: 3 } }));
    fixture.detectChanges();

    const tile = fixture.nativeElement.querySelector('[data-testid="kpi-loss-ratio"]');
    expect(tile.textContent).toContain('Sin prima registrada');
    expect(tile.textContent).toContain('3 cobertura(s) sin prima');
    expect(tile.textContent).not.toContain('NaN');
  });

  it('muestra la prima devengada: es el denominador del loss ratio', () => {
    const req = mount();
    req.flush(dashboardWire());
    fixture.detectChanges();

    const tile = fixture.nativeElement.querySelector('[data-testid="kpi-earned-premium"]');
    expect(tile.textContent).toContain('400.000,00 Bs');
    // Sin coberturas sin prima, la cifra no se rotula «estimada».
    expect(tile.textContent).not.toContain('Estimada');
    expect(tile.textContent).toContain('47 afiliado(s) activo(s)');
  });

  it('con coberturas sin prima, la cifra se declara estimada', () => {
    const req = mount();
    req.flush(dashboardWire({ kpis: { coveragesWithoutPremiumCount: 4 } }));
    fixture.detectChanges();

    const tile = fixture.nativeElement.querySelector('[data-testid="kpi-earned-premium"]');
    expect(tile.textContent).toContain('Estimada');
    expect(tile.textContent).toContain('4 cobertura(s) sin prima');
  });

  describe('informe de siniestralidad por persona', () => {
    function reclamo(id: string, paciente: string, facturado: string, aprobado: string | null) {
      return {
        id,
        claimIdentifier: `CL-${id}`,
        patient: {
          id: `pac-${paciente}`,
          displayName: paciente,
          patientCode: null,
          memberIdentifier: `AF-${paciente}`,
        },
        practitioner: null,
        providerName: 'Consultorio',
        service: null,
        additionalServiceCount: 0,
        billedTotal: { amount: facturado, currency: { code: 'BOB', display: 'Boliviano' } },
        approvedTotal:
          aprobado === null
            ? null
            : { amount: aprobado, currency: { code: 'BOB', display: 'Boliviano' } },
        submittedAt: new Date().toISOString(),
        serviceDate: null,
        policyIdentifier: null,
        planName: 'Nacional Seguros · Plan Salud Total',
        status: null,
        lines: [],
        decision: null,
        invoice: null,
      };
    }

    function abrirYGenerar(items: readonly unknown[], truncated = false) {
      const req = mount();
      req.flush(dashboardWire());
      fixture.detectChanges();
      abrirPestana('Por persona');
      const generar: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[data-testid="btn-generate-person-report"]',
      );
      generar.click();
      http.expectOne('/insurance/received-claims').flush({ items, truncated });
      fixture.detectChanges();
    }

    it('no calcula nada hasta que se pide: primero dice cómo generarlo', () => {
      const req = mount();
      req.flush(dashboardWire());
      fixture.detectChanges();
      abrirPestana('Por persona');

      expect(fixture.nativeElement.textContent).toContain('Todavía no generaste el informe');
      expect(fixture.nativeElement.querySelector('[data-testid="table-person-loss"]')).toBeNull();
      const exportar: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[data-testid="btn-export-person-report"]',
      );
      expect(exportar.getAttribute('aria-disabled')).toBe('true');
    });

    it('«Generar informe» agrupa las solicitudes por persona y las muestra en la tabla', () => {
      abrirYGenerar([
        reclamo('1', 'Ana Pérez', '800.00', '600.00'),
        reclamo('2', 'Ana Pérez', '100.00', null),
        reclamo('3', 'Luis Rojas', '50.00', '50.00'),
      ]);

      const tabla: HTMLElement = fixture.nativeElement.querySelector(
        '[data-testid="table-person-loss"]',
      );
      expect(tabla.textContent).toContain('Ana Pérez');
      expect(tabla.textContent).toContain('Luis Rojas');
      // Ana: 2 solicitudes, una pendiente; aprobado 600, rechazado 200.
      expect(tabla.textContent).toContain('2 (1 pend.)');
      expect(tabla.textContent).toContain('600.00');
      expect(tabla.textContent).toContain('200.00');
    });

    it('el informe sobrevive a cambiar de pestaña y volver', () => {
      abrirYGenerar([reclamo('1', 'Ana Pérez', '800.00', '600.00')]);

      abrirPestana('Resumen');
      abrirPestana('Por persona');

      expect(fixture.nativeElement.querySelector('[data-testid="table-person-loss"]')).not.toBeNull();
    });

    it('exporta el informe a CSV, una fila por persona', () => {
      abrirYGenerar([
        reclamo('1', 'Ana Pérez', '800.00', '600.00'),
        reclamo('2', 'Luis Rojas', '50.00', '50.00'),
      ]);

      const exportar: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[data-testid="btn-export-person-report"]',
      );
      exportar.click();

      const [filas, columnas, nombre] = csvExportEspiado.download.mock.calls.at(-1) as [
        readonly unknown[],
        readonly unknown[],
        string,
      ];
      expect(filas.length).toBe(2);
      expect(columnas.length).toBe(12);
      expect(nombre).toMatch(/^siniestralidad-por-persona-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}$/);
    });

    it('si el servidor recortó el listado, el informe se rotula parcial', () => {
      abrirYGenerar([reclamo('1', 'Ana Pérez', '800.00', '600.00')], true);

      expect(
        fixture.nativeElement.querySelector('[data-testid="person-report-partial"]'),
      ).not.toBeNull();
    });

    it('sin solicitudes en el período lo dice, en vez de dibujar una tabla vacía', () => {
      abrirYGenerar([]);

      expect(fixture.nativeElement.textContent).toContain('Sin solicitudes en el período');
      expect(fixture.nativeElement.querySelector('[data-testid="table-person-loss"]')).toBeNull();
    });

    it('al cambiar el período avisa que el informe mostrado es del filtro anterior', async () => {
      abrirYGenerar([reclamo('1', 'Ana Pérez', '800.00', '600.00')]);
      expect(fixture.nativeElement.querySelector('[data-testid="person-report-stale"]')).toBeNull();
      // El cambio de pestaña navega (async): que se asiente antes de tocar el período.
      await fixture.whenStable();

      const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[data-testid="segmentado-90d"]',
      );
      boton.click();
      await fixture.whenStable();
      fixture.detectChanges();
      dashboardRequest().flush(dashboardWire());
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="person-report-stale"]'),
      ).not.toBeNull();
    });
  });

  it('el tablero no tiene violaciones mecánicas de accesibilidad', async () => {
    const req = mount();
    req.flush(dashboardWire());
    fixture.detectChanges();

    await esperarSinViolaciones(fixture.nativeElement as HTMLElement);
  });
});

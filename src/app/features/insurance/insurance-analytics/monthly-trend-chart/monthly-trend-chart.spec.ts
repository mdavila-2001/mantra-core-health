import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { InsuranceConcept } from '../../../../core/data-access/insurance/insurance.types';
import type { MonthlyTrend } from '../../../../core/data-access/insurance/insurance-analytics.types';
import { esperarSinViolaciones } from '../../../../../testing/a11y';
import { MonthlyTrendChart } from './monthly-trend-chart';

const BOLIVIANO: InsuranceConcept = { code: 'BOB', display: 'Boliviano' } as InsuranceConcept;

/** Tres meses con un pico claro en el del medio, para poder afirmar alturas. */
const TRES_MESES: readonly MonthlyTrend[] = [
  { period: '2026-01', billedAmount: '10000.00', approvedAmount: '8000.00', claimsCount: 2 },
  { period: '2026-02', billedAmount: '40000.00', approvedAmount: '30000.00', claimsCount: 1 },
  { period: '2026-03', billedAmount: '20000.00', approvedAmount: '0.00', claimsCount: 5 },
];

async function montar(
  trends: readonly MonthlyTrend[],
  currency: InsuranceConcept | null = BOLIVIANO,
): Promise<ComponentFixture<MonthlyTrendChart>> {
  await TestBed.configureTestingModule({ imports: [MonthlyTrendChart] }).compileComponents();
  const fixture = TestBed.createComponent(MonthlyTrendChart);
  fixture.componentRef.setInput('trends', trends);
  fixture.componentRef.setInput('currency', currency);
  fixture.detectChanges();
  return fixture;
}

/** `nativeElement` viene como `any`: se tipa una sola vez acá. */
function raiz(fixture: ComponentFixture<MonthlyTrendChart>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function barras(fixture: ComponentFixture<MonthlyTrendChart>): readonly SVGRectElement[] {
  return Array.from(raiz(fixture).querySelectorAll<SVGRectElement>('.trend-chart__bar'));
}

describe('MonthlyTrendChart', () => {
  it('dibuja las dos barras de cada mes: facturado y aprobado', async () => {
    const fixture = await montar(TRES_MESES);
    expect(barras(fixture).length).toBe(6);
  });

  /*
    El criterio del carril pide que CADA barra sea una parada de teclado, no el
    gráfico entero: quien no ve la pantalla tiene que poder recorrer la serie
    mes a mes.
  */
  it('cada barra es alcanzable con el tabulador', async () => {
    const fixture = await montar(TRES_MESES);
    expect(barras(fixture).every((b) => b.getAttribute('tabindex') === '0')).toBe(true);
  });

  it('cada barra anuncia su mes y su importe en bolivianos', async () => {
    const fixture = await montar(TRES_MESES);
    const etiquetas = barras(fixture).map((b) => b.getAttribute('aria-label') ?? '');

    expect(etiquetas[0]).toBe('ene 26, facturado 10.000,00 Bs, 2 reclamos.');
    expect(etiquetas[1]).toBe('ene 26, aprobado 8.000,00 Bs.');
    // Singular cuando es un solo reclamo: «1 reclamos» delata la plantilla.
    expect(etiquetas[2]).toContain('1 reclamo.');
  });

  /*
    Regresión con nombre propio.

    `role="img"` convierte al SVG en un nodo hoja del árbol de accesibilidad:
    su contenido deja de exponerse y los `aria-label` de las barras se callan,
    sin que falle nada visible. Si alguien lo revierte, que falle acá.
  */
  it('el gráfico es un grupo, no una imagen: si no, las barras no se anuncian', async () => {
    const fixture = await montar(TRES_MESES);
    const svg = raiz(fixture).querySelector('svg');

    expect(svg?.getAttribute('role')).toBe('group');
    expect(svg?.getAttribute('aria-label')).toContain('mayor facturado');
  });

  it('la altura es proporcional: el pico manda y el cero no dibuja nada', async () => {
    const fixture = await montar(TRES_MESES);
    const alturas = barras(fixture).map((b) => Number(b.getAttribute('height')));

    // El mayor facturado (feb, 40 000) ocupa el alto completo del área.
    expect(Math.max(...alturas)).toBe(140);
    // ene (10 000) es la cuarta parte de feb.
    expect(alturas[0]).toBeCloseTo(35, 5);
    // El aprobado de marzo es 0: no se dibuja, no se le da un mínimo visible.
    expect(alturas[5]).toBe(0);
  });

  it('mantiene la tabla oculta con la cifra exacta de cada mes', async () => {
    const fixture = await montar(TRES_MESES);
    const filas = raiz(fixture).querySelectorAll('table.sr-only tbody tr');

    expect(filas.length).toBe(3);
    expect(filas[1].textContent).toContain('40.000,00 Bs');
  });

  it('sin moneda declarada no inventa una', async () => {
    const fixture = await montar(TRES_MESES, null);
    const etiqueta = barras(fixture)[0]?.getAttribute('aria-label') ?? '';

    expect(etiqueta).toContain('10.000,00');
    expect(etiqueta).not.toContain('Bs');
  });

  it('un periodo sin datos lo dice, y no dibuja un eje vacío con barras', async () => {
    const fixture = await montar([]);

    expect(barras(fixture).length).toBe(0);
    expect(raiz(fixture).querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Tendencia mensual sin datos en el periodo.',
    );
  });

  it('no tiene violaciones mecánicas de accesibilidad', async () => {
    const fixture = await montar(TRES_MESES);
    await esperarSinViolaciones(raiz(fixture));
  });
});

import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import {
  formatearValor,
  formatearVariacion,
  NO_DATA,
} from '@core/data-access/reporting/reporting-format';
import type { KpiSpec } from '@core/data-access/reporting/reporting.types';
import { readDelta } from './kpi-delta';
import { KpiTile } from './kpi-tile';
import { describeTrend, hasTrend } from './sparkline';

const INFO = {
  definicion: 'Ingreso mensual recurrente.',
  formula: 'Σ precio mensual de las suscripciones activas',
  fuente: 'payments.subscriptions',
  frescura: 'Cada hora',
  salvedades: ['Datos de EJEMPLO'],
};

function kpi(overrides: Partial<KpiSpec> = {}): KpiSpec {
  return {
    id: 'mrr',
    titulo: 'MRR',
    valor: 12500,
    unidad: { tipo: 'moneda', moneda: 'BOB' },
    variacionPct: 4.2,
    info: INFO,
    ...overrides,
  };
}

async function mount(spec: KpiSpec, comparison: string | null = null) {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(KpiTile);
  fixture.componentRef.setInput('kpi', spec);
  fixture.componentRef.setInput('comparison', comparison);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const text = (testId: string) => root.querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  return { fixture, root, text };
}

describe('KpiTile', () => {
  describe('null no es cero', () => {
    it('escribe «Sin dato» y el motivo cuando el valor es null, nunca un 0', async () => {
      const { root, text } = await mount(kpi({ valor: null, motivoSinDato: 'Aún no hay suscripciones activas.' }));
      expect(text('kpi-value')).toBe(NO_DATA);
      expect(text('kpi-reason')).toBe('Aún no hay suscripciones activas.');
      expect(root.textContent).not.toMatch(/\b0\b/);
    });

    it('dice la verdad aunque el servidor no explique la ausencia', async () => {
      const { text } = await mount(kpi({ valor: null }));
      expect(text('kpi-value')).toBe(NO_DATA);
      expect(text('kpi-reason')).toContain('Aún no hay datos');
    });

    it('no dibuja variación, fracción ni tendencia sin valor', async () => {
      const { root } = await mount(kpi({ valor: null, tendencia: [1, 2, 3], numerador: 1, denominador: 2 }));
      expect(root.querySelector('[data-testid="kpi-delta"]')).toBeNull();
      expect(root.querySelector('[data-testid="kpi-fraction"]')).toBeNull();
      expect(root.querySelector('[data-testid="kpi-trend"]')).toBeNull();
    });

    it('un cero real SÍ se escribe como cero: ausencia y cero no son lo mismo', async () => {
      const { text } = await mount(kpi({ valor: 0, unidad: { tipo: 'numero' }, variacionPct: null }));
      expect(text('kpi-value')).toBe(formatearValor(0, { tipo: 'numero' }));
      expect(text('kpi-value')).not.toBe(NO_DATA);
    });
  });

  describe('variación', () => {
    it('mejora: sube y subir es bueno → flecha, número y palabra', async () => {
      const { root, text } = await mount(kpi({ variacionPct: 4.2 }), 'frente al periodo anterior');
      const delta = root.querySelector('[data-testid="kpi-delta"]') as HTMLElement;
      expect(delta.getAttribute('data-verdict')).toBe('better');
      expect(text('kpi-delta')).toContain(formatearVariacion(4.2));
      expect(text('kpi-delta')).toContain('mejora');
      expect(text('kpi-delta')).toContain('▲');
      expect(text('kpi-delta')).toContain('frente al periodo anterior');
    });

    it('empeora: sube pero subir es malo (churn, mora) → la flecha sube y el veredicto es malo', async () => {
      const { root, text } = await mount(kpi({ variacionPct: 3.1, subirEsMalo: true }));
      expect((root.querySelector('[data-testid="kpi-delta"]') as HTMLElement).getAttribute('data-verdict')).toBe('worse');
      expect(text('kpi-delta')).toContain('empeora');
      expect(text('kpi-delta')).toContain('▲');
    });

    it('mejora: baja y subir es malo', async () => {
      const { root, text } = await mount(kpi({ variacionPct: -2, subirEsMalo: true }));
      expect((root.querySelector('[data-testid="kpi-delta"]') as HTMLElement).getAttribute('data-verdict')).toBe('better');
      expect(text('kpi-delta')).toContain('mejora');
      expect(text('kpi-delta')).toContain('▼');
    });

    it('el significado va en texto, no solo en color: la palabra está en el DOM', async () => {
      const { text } = await mount(kpi({ variacionPct: -5 }));
      expect(text('kpi-delta')).toMatch(/empeora/);
    });

    it('sin comparativo lo dice con palabras y sin flecha', async () => {
      const { text } = await mount(kpi({ variacionPct: null }), 'frente al periodo anterior');
      expect(text('kpi-delta')).toBe('Sin comparativo');
    });
  });

  it('muestra numerador y denominador cuando existen («12 de 340»)', async () => {
    const { text } = await mount(kpi({ unidad: { tipo: 'porcentaje' }, valor: 3.5, numerador: 12, denominador: 340 }));
    expect(text('kpi-fraction')).toBe(`${formatearValor(12, { tipo: 'numero' })} de ${formatearValor(340, { tipo: 'numero' })}`);
  });

  it('no inventa una fracción si falta un lado', async () => {
    const { root } = await mount(kpi({ numerador: 12, denominador: null }));
    expect(root.querySelector('[data-testid="kpi-fraction"]')).toBeNull();
  });

  describe('«N de M»', () => {
    it('formatea cada lado con su propia unidad: un costo por unidad no pone bolivianos al conteo', async () => {
      const { text } = await mount(
        kpi({
          id: 'cac',
          titulo: 'CAC',
          valor: 666.07,
          unidad: { tipo: 'moneda', moneda: 'BOB' },
          numerador: 230460,
          denominador: 346,
          unidadNumerador: { tipo: 'moneda', moneda: 'BOB' },
          unidadDenominador: { tipo: 'numero' },
        }),
      );
      const fraction = text('kpi-fraction') ?? '';
      expect(fraction).toMatch(/^Bs\s230\.460,00 de 346$/);
    });

    it('una razón de importes lleva moneda en los dos lados', async () => {
      const bob = { tipo: 'moneda', moneda: 'BOB' } as const;
      const { text } = await mount(
        kpi({ id: 'roas', titulo: 'ROAS', valor: 5.8, unidad: { tipo: 'razon', sufijo: '×' }, numerador: 304199, denominador: 52423, unidadNumerador: bob, unidadDenominador: bob }),
      );
      expect(text('kpi-fraction')).toMatch(/Bs\s304\.199,00 de Bs\s52\.423,00/);
    });

    it('sin unidades declaradas, una tasa se lee como conteos', async () => {
      const { text } = await mount(kpi({ id: 'x', titulo: 'X', valor: 12.5, unidad: { tipo: 'porcentaje' }, numerador: 5, denominador: 40 }));
      expect(text('kpi-fraction')).toBe('5 de 40');
    });
  });

  describe('mini-tendencia', () => {
    it('dibuja la tendencia con una frase para el lector de pantalla', async () => {
      // jsdom no trae `ResizeObserver`, que `ngx-echarts` exige para ajustar el lienzo.
      vi.stubGlobal('ResizeObserver', class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      });
      try {
        const { fixture, root } = await mount(kpi({ tendencia: [10, 12, 15], unidad: { tipo: 'numero' } }));
        await fixture.whenStable();
        const trend = root.querySelector('[data-testid="kpi-trend"]') as HTMLElement | null;
        expect(trend).not.toBeNull();
        expect(trend?.getAttribute('role')).toBe('img');
        expect(trend?.getAttribute('aria-label')).toBe(describeTrend([10, 12, 15], { tipo: 'numero' }));
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('no dibuja nada con un solo punto', async () => {
      const { root } = await mount(kpi({ tendencia: [10] }));
      expect(root.querySelector('.kpi__spark')).toBeNull();
    });
  });

  describe('Cómo se calcula', () => {
    it('despliega y oculta la ficha con aria-expanded', async () => {
      const { fixture, root } = await mount(kpi());
      const button = root.querySelector('[data-testid="kpi-how"]') as HTMLButtonElement;
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(root.querySelector('[data-testid="calc-info"]')).toBeNull();

      button.click();
      await fixture.whenStable();
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(root.querySelector('[data-testid="calc-info"]')?.textContent).toContain('payments.subscriptions');

      button.click();
      await fixture.whenStable();
      expect(root.querySelector('[data-testid="calc-info"]')).toBeNull();
    });

    it('sin ficha, escribe el motivo en vez de callar', async () => {
      const { root, text } = await mount(kpi({ info: null, infoMotivo: 'Es un conteo directo.' }));
      expect(root.querySelector('[data-testid="kpi-how"]')).toBeNull();
      expect(text('kpi-no-info')).toContain('Es un conteo directo.');
    });
  });
});

describe('readDelta', () => {
  it.each([
    [5, false, 'up', 'better'],
    [5, true, 'up', 'worse'],
    [-5, false, 'down', 'worse'],
    [-5, true, 'down', 'better'],
  ] as const)('pct %s con subirEsMalo=%s → flecha %s, veredicto %s', (pct, riseIsBad, direction, verdict) => {
    const reading = readDelta(pct, riseIsBad);
    expect(reading.direction).toBe(direction);
    expect(reading.verdict).toBe(verdict);
    expect(reading.word).not.toBe('');
  });

  it('un cambio que se redondea a 0,0 % es «sin cambio», no mejora ni empeora', () => {
    expect(readDelta(0.01).verdict).toBe('same');
    expect(readDelta(0).word).toBe('sin cambio');
  });

  it('null es «sin comparativo» y no cuenta como cero', () => {
    const reading = readDelta(null);
    expect(reading.verdict).toBe('unknown');
    expect(reading.direction).toBe('none');
    expect(reading.text).toBe('Sin comparativo');
  });
});

describe('hasTrend', () => {
  it('necesita al menos dos puntos con dato', () => {
    expect(hasTrend(undefined)).toBe(false);
    expect(hasTrend([1])).toBe(false);
    expect(hasTrend([null, null, 3])).toBe(false);
    expect(hasTrend([1, null, 3])).toBe(true);
  });
});

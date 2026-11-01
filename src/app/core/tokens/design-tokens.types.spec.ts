import { readFileSync } from 'node:fs';

import {
  CHART,
  cssVar,
  DESIGN_TOKENS,
  isThemeMode,
  radiusToken,
  rampToken,
  spacingToken,
  statusToken,
  THEME_MODES,
} from './design-tokens.types';

describe('design tokens', () => {
  describe('constructores de nombre', () => {
    it('arma el nombre de un escalón de rampa', () => {
      expect(rampToken('petrol', 500)).toBe('--c-petrol-500');
    });

    it('arma el trío de un estado', () => {
      expect(statusToken('error', 'fg')).toBe('--st-error-fg');
      expect(statusToken('success', 'bg')).toBe('--st-success-bg');
    });

    it('arma geometría', () => {
      expect(spacingToken(4)).toBe('--sp-4');
      expect(radiusToken('signature')).toBe('--r-signature');
    });

    it('cssVar es el único puente a CSS', () => {
      expect(cssVar('--brand-primary')).toBe('var(--brand-primary)');
    });
  });

  describe('catálogo', () => {
    it('no tiene nombres repetidos', () => {
      expect(new Set(DESIGN_TOKENS).size).toBe(DESIGN_TOKENS.length);
    });

    it('está congelado: nadie agrega tokens en runtime', () => {
      expect(Object.isFrozen(DESIGN_TOKENS)).toBe(true);
    });

    it('todo nombre es una custom property válida', () => {
      const invalidos = DESIGN_TOKENS.filter((token) => !/^--[a-z0-9-]+$/.test(token));
      expect(invalidos).toEqual([]);
    });
  });

  describe('isThemeMode', () => {
    it('acepta los modos declarados', () => {
      for (const mode of THEME_MODES) {
        expect(isThemeMode(mode)).toBe(true);
      }
    });

    it('rechaza lo que venga de localStorage sin contrato', () => {
      for (const valor of ['', 'system', 'DARK', 'oscuro', null, undefined, 0, {}]) {
        expect(isThemeMode(valor)).toBe(false);
      }
    });
  });

  /**
   * La quinta frontera de deriva: los NOMBRES viven en TS, los VALORES en CSS.
   * Si divergen, un componente escribe `var(--token-que-no-existe)` y falla
   * en silencio — el peor modo de falla posible en una UI clínica.
   */
  describe('fidelidad TS ↔ src/styles.css', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    const declaradosEnCss = new Set(
      [...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]),
    );

    it('todo token del catálogo está declarado en styles.css', () => {
      const faltantes = DESIGN_TOKENS.filter((token) => !declaradosEnCss.has(token));
      expect(faltantes).toEqual([]);
    });

    it('todo token declarado en styles.css está en el catálogo', () => {
      const catalogo = new Set<string>(DESIGN_TOKENS);
      const huerfanos = [...declaradosEnCss].filter((token) => !catalogo.has(token));
      expect(huerfanos).toEqual([]);
    });
  });

  describe('paleta de gráficos (ADR-0017, frente 05 H1)', () => {
    const css = readFileSync('src/styles.css', 'utf8');

    it('cataloga el ordinal de 4 pasos y el divergente de 5 puntos', () => {
      const valores = Object.values(CHART) as string[];
      for (const n of [1, 2, 3, 4]) expect(valores).toContain(`--chart-ord-${n}`);
      for (const t of ['neg', 'neg-soft', 'mid', 'pos-soft', 'pos']) {
        expect(valores).toContain(`--chart-div-${t}`);
      }
    });

    it('declara el ordinal como alias de seq-2..5 en los tres bloques de tema', () => {
      for (const n of [1, 2, 3, 4]) {
        const alias = new RegExp(`--chart-ord-${n}: var\\(--chart-seq-${n + 1}\\);`, 'g');
        expect(css.match(alias)?.length).toBe(3);
      }
    });

    it('el verde (slot 6) oscuro ya no es #008300 (2,98:1 sobre la superficie petróleo)', () => {
      expect(css.match(/--chart-6: #0c960c;/g)?.length).toBe(2);
      expect(css.match(/--chart-6: #008300;/g)?.length).toBe(1);
    });
  });
});

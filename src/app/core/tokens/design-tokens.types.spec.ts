import { readFileSync } from 'node:fs';

import {
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
    it('acepta los tres modos declarados', () => {
      for (const mode of THEME_MODES) {
        expect(isThemeMode(mode)).toBe(true);
      }
    });

    it('rechaza lo que venga de localStorage sin contrato', () => {
      for (const valor of ['', 'DARK', 'oscuro', null, undefined, 0, {}]) {
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
});

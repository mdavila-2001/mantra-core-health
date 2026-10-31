import { readFileSync } from 'node:fs';

import { CHART } from '@core/tokens/design-tokens.types';

import {
  DIVERGENTE_TOKENS,
  leerTemaGraficos,
  ORDINAL_TOKENS,
  RAMPA_TOKENS,
  SERIE_TOKENS,
} from './chart-theme';

const css = readFileSync('src/styles.css', 'utf8');

describe('chart-theme · CSS ↔ TS', () => {
  it('todo token que lee el tema está declarado en los tres bloques de styles.css', () => {
    for (const token of [...SERIE_TOKENS, ...RAMPA_TOKENS, ...ORDINAL_TOKENS, ...DIVERGENTE_TOKENS]) {
      const declaraciones = css.match(new RegExp(`${token}\\s*:`, 'g')) ?? [];
      expect(declaraciones.length, token).toBeGreaterThanOrEqual(3);
    }
  });

  it('todo token que lee el tema está en el catálogo CHART', () => {
    const catalogo = new Set<string>(Object.values(CHART));
    for (const token of [...SERIE_TOKENS, ...RAMPA_TOKENS, ...ORDINAL_TOKENS, ...DIVERGENTE_TOKENS]) {
      expect(catalogo.has(token), token).toBe(true);
    }
  });

  it('el ordinal tiene 4 pasos y son alias de seq-2..5', () => {
    expect(ORDINAL_TOKENS).toHaveLength(4);
    ORDINAL_TOKENS.forEach((token, i) => {
      expect(css).toContain(`${token}: var(--chart-seq-${i + 2});`);
    });
  });

  it('leerTemaGraficos devuelve ordinal (4) y divergente (5) desde el documento', () => {
    const raiz = document.documentElement;
    const puestos: string[] = [];
    try {
      [...ORDINAL_TOKENS, ...DIVERGENTE_TOKENS].forEach((token, i) => {
        raiz.style.setProperty(token, `#0000${i.toString(16).padStart(2, '0')}`);
        puestos.push(token);
      });
      const tema = leerTemaGraficos();
      expect(tema.ordinal).toHaveLength(4);
      expect(tema.divergente).toHaveLength(5);
      expect(tema.ordinal?.[0]).toBe('#000000');
      expect(tema.divergente?.[4]).toBe('#000008');
    } finally {
      for (const token of puestos) raiz.style.removeProperty(token);
    }
  });

  it('sin tokens en el documento cae a currentColor (no inventa un color)', () => {
    const tema = leerTemaGraficos();
    expect(tema.ordinal?.every((c) => c === 'currentColor' || c !== '')).toBe(true);
    expect(tema.ordinal).toHaveLength(4);
  });

  it('lee los colores de estado y la tinta atenuada para series que significan bueno/aviso/error', () => {
    const raiz = document.documentElement;
    const pares: readonly [string, string][] = [
      ['--st-success-fg', '#010101'],
      ['--st-warning-fg', '#020202'],
      ['--st-error-fg', '#030303'],
      ['--text-muted', '#040404'],
    ];
    try {
      for (const [t, v] of pares) raiz.style.setProperty(t, v);
      const tema = leerTemaGraficos();
      expect(tema.estado).toEqual({ exito: '#010101', aviso: '#020202', error: '#030303' });
      expect(tema.aviso).toBe('#020202');
      expect(tema.atenuado).toBe('#040404');
    } finally {
      for (const [t] of pares) raiz.style.removeProperty(t);
    }
  });
});

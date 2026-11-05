import { describe, expect, it } from 'vitest';

import { rampColorAt, readableOn } from './chart-color';

const LIGHT_RAMP = ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'];

describe('rampColorAt', () => {
  it('devuelve las paradas en los extremos e interpola en medio', () => {
    expect(rampColorAt(LIGHT_RAMP, 0)).toEqual([0xcd, 0xe2, 0xfb]);
    expect(rampColorAt(LIGHT_RAMP, 1)).toEqual([0x0d, 0x36, 0x6b]);
    const mid = rampColorAt(['#000000', '#ffffff'], 0.5);
    expect(mid?.map((c) => Math.round(c))).toEqual([128, 128, 128]);
  });

  it('acota t fuera de 0–1 y devuelve null si una parada no es hexadecimal', () => {
    expect(rampColorAt(LIGHT_RAMP, -3)).toEqual(rampColorAt(LIGHT_RAMP, 0));
    expect(rampColorAt(LIGHT_RAMP, 9)).toEqual(rampColorAt(LIGHT_RAMP, 1));
    expect(rampColorAt(['rgb(0,0,0)', '#fff'], 0.5)).toBeNull();
    expect(rampColorAt([], 0.5)).toBeNull();
  });
});

describe('readableOn', () => {
  const INK = '#1a1a1a';
  const SURFACE = '#ffffff';

  it('sobre una celda clara elige el texto oscuro y sobre una oscura el de superficie (tema claro)', () => {
    expect(readableOn(rampColorAt(LIGHT_RAMP, 0), INK, SURFACE)).toBe(INK);
    expect(readableOn(rampColorAt(LIGHT_RAMP, 1), INK, SURFACE)).toBe(SURFACE);
  });

  it('en tema oscuro la rampa va al revés y la elección también', () => {
    const darkInk = '#f5f5f5';
    const darkSurface = '#121212';
    const darkRamp = [...LIGHT_RAMP].reverse();
    expect(readableOn(rampColorAt(darkRamp, 0), darkInk, darkSurface)).toBe(darkInk);
    expect(readableOn(rampColorAt(darkRamp, 1), darkInk, darkSurface)).toBe(darkSurface);
  });

  it('si no puede medir (fondo o colores no hexadecimales) cae al color de texto', () => {
    expect(readableOn(null, INK, SURFACE)).toBe(INK);
    expect(readableOn([0, 0, 0], 'currentColor', SURFACE)).toBe('currentColor');
  });
});

describe('readableOn · contraste AA con los tokens reales', () => {
  const lin = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const lum = (h: string): number => {
    const n = parseInt(h.slice(1), 16);
    return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  const hex = (rgb: readonly number[]): string => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const ratio = (a: string, b: string): number => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
  };

  const CASOS = [
    // [rampa, texto, superficie] tal como salen de styles.css (--chart-seq-*, --text-primary, --bg-surface)
    ['claro', ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'], '#242828', '#ffffff'],
    ['oscuro', ['#184f95', '#1c5cab', '#3987e5', '#6da7ec', '#9ec5f4'], '#f6f3ed', '#0a2b3d'],
  ] as const;

  for (const [tema, rampa, texto, superficie] of CASOS) {
    it(`en tema ${tema} ninguna celda de la rampa baja de 4,5:1 (antes el peor caso era 3,7–3,9:1)`, () => {
      let peor = Infinity;
      for (let t = 0; t <= 1.0001; t += 0.01) {
        const fondo = rampColorAt(rampa, t);
        expect(fondo).not.toBeNull();
        const color = readableOn(fondo, texto, superficie);
        peor = Math.min(peor, ratio(hex(fondo ?? [0, 0, 0]), color));
      }
      expect(peor).toBeGreaterThanOrEqual(4.5);
    });
  }
});

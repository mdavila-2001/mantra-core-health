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

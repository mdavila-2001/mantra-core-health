import { readFileSync } from 'node:fs';

import type { ColorRgb } from './alovida-mark';
import {
  CONTENT_WIDTH,
  gridSpan,
  PDF_ALPHA_TOKENS,
  PDF_COLORS,
  PDF_GRADIENTS,
  PDF_TOKENS,
  PDF_TONES,
} from './pdf-theme';

/**
 * El papel copia los colores de AloVida en RGB porque `jsPDF` no lee CSS. Esta
 * prueba es lo que impide que las dos copias se separen: lee
 * `src/styles/alovida.css` —la hoja normativa de AloVida v1.1— y compara cada
 * token del tema con la variable de la que dice salir, en el tema claro (el
 * primer `:root` de la hoja; el oscuro redefine las mismas variables más abajo).
 */
const CSS = readFileSync('src/styles/alovida.css', 'utf8');

function hex(nombre: string): ColorRgb {
  const valor = new RegExp(`--${nombre}:\\s*#([0-9A-Fa-f]{6})\\b`).exec(CSS)?.[1];
  if (valor === undefined) {
    throw new Error(`alovida.css no declara --${nombre} como hex`);
  }
  return [0, 2, 4].map((desde) => Number.parseInt(valor.slice(desde, desde + 2), 16)) as unknown as ColorRgb;
}

function rgba(nombre: string): { color: ColorRgb; opacity: number } {
  const valor = new RegExp(`--${nombre}:\\s*rgba\\(([^)]+)\\)`).exec(CSS)?.[1];
  if (valor === undefined) {
    throw new Error(`alovida.css no declara --${nombre} como rgba`);
  }
  const [r, g, b, a] = valor.split(',').map((parte) => Number.parseFloat(parte));
  return { color: [r, g, b], opacity: a };
}

describe('los colores del papel son los de AloVida', () => {
  it.each(Object.entries(PDF_TOKENS))('%s es --%s de alovida.css', (nombre, color) => {
    expect(color).toEqual(hex(nombre));
  });

  it.each(Object.entries(PDF_ALPHA_TOKENS))('%s es el rgba de alovida.css', (nombre, token) => {
    expect(token).toEqual(rgba(nombre));
  });

  /** Un rol, un tono o un degradado que no sale de un token es un hex inventado. */
  it('cada rol, tono y parada de degradado es uno de los tokens', () => {
    const tokens = Object.values(PDF_TOKENS).map((color) => color.join(','));
    const usados = [
      ...Object.values(PDF_COLORS),
      ...Object.values(PDF_TONES).flatMap((tono) => [tono.fill, tono.ink]),
      ...Object.values(PDF_GRADIENTS).flatMap((degradado) => degradado.map((parada) => parada.color)),
    ];
    for (const color of usados) {
      expect(tokens).toContain(color.join(','));
    }
  });

  it('el ámbar de acción no se usa en el papel', () => {
    const ambar = hex('ambar').join(',');
    expect(Object.values(PDF_TOKENS).map((color) => color.join(','))).not.toContain(ambar);
  });
});

describe('la retícula', () => {
  it('doce columnas ocupan el ancho útil entero', () => {
    expect(gridSpan(12)).toBeCloseTo(CONTENT_WIDTH, 5);
    expect(gridSpan(6) * 2 + 12).toBeCloseTo(CONTENT_WIDTH, 5);
  });
});

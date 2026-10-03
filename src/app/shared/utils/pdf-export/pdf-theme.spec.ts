import { readFileSync } from 'node:fs';

import type { ColorRgb } from './alovida-mark';
import {
  COLOR_CEBRA,
  COLOR_FILETE,
  COLOR_FILETE_FUERTE,
  COLOR_MARCA,
  COLOR_MARCA_PROFUNDO,
  COLOR_PANEL,
  COLOR_TINTA,
  COLOR_TINTA_SUAVE,
  mezclarConBlanco,
} from './pdf-theme';

/**
 * El papel copia los colores de la pantalla en RGB porque `jsPDF` no lee CSS.
 * Esta prueba es lo que impide que las dos copias se separen: lee `styles.css`
 * con `node:fs` —mismo patrón que `core/tokens/design-tokens.types.spec.ts`— y
 * compara cada constante del tema con la variable de la que dice salir.
 */
const CSS = readFileSync('src/styles.css', 'utf8');

function variable(nombre: string): ColorRgb {
  const hex = new RegExp(`--${nombre}:\\s*#([0-9A-Fa-f]{6})`).exec(CSS)?.[1];
  if (hex === undefined) {
    throw new Error(`styles.css no declara --${nombre}`);
  }
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

describe('los colores del papel son los de la pantalla', () => {
  it.each([
    ['COLOR_MARCA', COLOR_MARCA, 'c-petrol-500'],
    ['COLOR_MARCA_PROFUNDO', COLOR_MARCA_PROFUNDO, 'c-petrol-700'],
    ['COLOR_TINTA', COLOR_TINTA, 'c-neutral-500'],
    ['COLOR_TINTA_SUAVE', COLOR_TINTA_SUAVE, 'c-neutral-400'],
    ['COLOR_FILETE', COLOR_FILETE, 'c-petrol-50'],
    ['COLOR_FILETE_FUERTE', COLOR_FILETE_FUERTE, 'c-petrol-200'],
  ])('%s es --%s', (_nombre, color, token) => {
    expect(color).toEqual(variable(token.replace(/^--/, '')));
  });

  it('el panel y la cebra son tintes del filete sobre blanco, el panel más presente', () => {
    expect(COLOR_PANEL).toEqual(mezclarConBlanco(variable('c-petrol-50'), 0.4));
    expect(COLOR_CEBRA).toEqual(mezclarConBlanco(variable('c-petrol-50'), 0.2));
    for (const canal of [0, 1, 2]) {
      expect(COLOR_CEBRA[canal]).toBeGreaterThanOrEqual(COLOR_PANEL[canal]);
    }
  });
});

describe('mezclarConBlanco', () => {
  it('con fracción 1 devuelve el color y con 0 devuelve blanco', () => {
    expect(mezclarConBlanco([11, 85, 126], 1)).toEqual([11, 85, 126]);
    expect(mezclarConBlanco([11, 85, 126], 0)).toEqual([255, 255, 255]);
  });

  it('redondea al entero más cercano, que es lo que jsPDF acepta', () => {
    expect(mezclarConBlanco([0, 0, 0], 0.5)).toEqual([128, 128, 128]);
  });
});

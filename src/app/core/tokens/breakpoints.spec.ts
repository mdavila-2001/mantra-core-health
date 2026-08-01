import { readFileSync } from 'node:fs';

import { BREAKPOINTS, mediaFrom, type BreakpointName } from './breakpoints';

/**
 * La escala vive en dos archivos por una limitación del lenguaje: CSS no admite
 * custom properties en la condición de una consulta de medios. Esta prueba es
 * la que evita que se separen, igual que la que ya cuida los colores.
 */
describe('breakpoints', () => {
  const css = readFileSync('src/styles.css', 'utf8');

  it('cada punto de quiebre existe en styles.css con el mismo valor', () => {
    for (const [nombre, valor] of Object.entries(BREAKPOINTS)) {
      const declaracion = new RegExp(`--bp-${nombre}:\\s*${valor}px`);

      expect(css).toMatch(declaracion);
    }
  });

  it('styles.css no declara ningún --bp- que TypeScript no conozca', () => {
    const declarados = [...css.matchAll(/--bp-([a-z]+):/g)].map((m) => m[1]);
    const conocidos = Object.keys(BREAKPOINTS);

    for (const nombre of declarados) {
      expect(conocidos).toContain(nombre);
    }
  });

  it('la escala es creciente: cada corte agrega ancho', () => {
    const valores = Object.values(BREAKPOINTS);
    const ordenados = [...valores].sort((a, b) => a - b);

    expect(valores).toEqual(ordenados);
  });

  it('mediaFrom siempre produce min-width, nunca max-width', () => {
    for (const nombre of Object.keys(BREAKPOINTS) as BreakpointName[]) {
      const consulta = mediaFrom(nombre);

      // Mobile-first no es una preferencia: el telefono es el caso base.
      expect(consulta).toContain('min-width');
      expect(consulta).not.toContain('max-width');
      expect(consulta).toContain(`${BREAKPOINTS[nombre]}px`);
    }
  });
});

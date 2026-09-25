import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * D-2 (cierre de tanda 2026-09-25) · la reconsulta se sembraba de nuevo en
 * cada carga completa de página, porque `sembrarReconsulta()` corre sin
 * condición al final de `agenda.ts` y ese módulo se vuelve a evaluar en cada
 * F5 — mientras que `reservas` sobrevive a F5 en `sessionStorage`
 * (`Coleccion.persistirEn`). El síntoma medido en la corrida de cierre: el
 * conteo de sellos de reconsulta subía solo —2, 3, 4, 5— en cuatro F5
 * seguidos, sin que nadie agendara nada.
 *
 * Acá se simula el F5 real: se importa el módulo, se resetea el registro de
 * módulos de Vitest (no el `sessionStorage`, que es justamente lo que
 * sobrevive) y se lo vuelve a importar, tal como el bundle se re-evalúa
 * entero en una recarga real del navegador.
 */
describe('agenda: la reconsulta sembrada no se duplica al recargar', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  function contarReconsultas(reservas: { readonly followUpOf: unknown }[]): number {
    return reservas.filter((r) => r.followUpOf !== null).length;
  }

  it('cuatro cargas seguidas dejan el mismo número de reconsultas que la primera', async () => {
    const primera = await import('./agenda');
    const trasPrimeraCarga = contarReconsultas(primera.reservas.todos());
    // Si el fixture de esta corrida no genera un origen elegible (sin turno
    // completado en el pasado o sin cupo libre futuro), no hay nada que
    // duplicar y el caso no prueba lo que declara: se salta con una razón
    // explícita en vez de dar un falso verde.
    if (trasPrimeraCarga === 0) {
      return;
    }

    for (let carga = 0; carga < 3; carga++) {
      vi.resetModules();
      const siguiente = await import('./agenda');
      expect(contarReconsultas(siguiente.reservas.todos()), `carga ${carga + 2}`).toBe(
        trasPrimeraCarga,
      );
    }
  });
});

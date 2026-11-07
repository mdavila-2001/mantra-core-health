import { describe, expect, it } from 'vitest';

import { type AristaConectable, conectadosA, describirIntervalo } from './recorrido-clinico.model';

/*
 * La geometría de carriles por tipo (`ubicarRecorrido`) que se probaba acá
 * se reemplazó por la red por episodios (ADR-0021). Sus promesas —nodos que
 * no se superponen, líneas que arrancan y terminan en el borde, que no
 * comparten tramo, que no pasan por otra tarjeta ni pisan la punta de otra
 * flecha, grupos «+N» que reciben las líneas de sus ocultos, pasillos que se
 * ensanchan, una receta hacia atrás, lo sin fecha al final, el plano vacío,
 * el día con atención oculta que no se rotula «sin atención»— se exigen
 * ahora a la red en `red-clinica.geometria.spec.ts`, con las mismas
 * tolerancias.
 */

/**
 *   enero:  consulta c1 → diagnóstico d1 → receta r1 (indicada para d1)
 *   abril:  consulta c2 → receta r2 (renovación, indicada para d1)
 */
const ARISTAS: readonly AristaConectable[] = [
  { desde: 'c1', hasta: 'd1', motivo: 'atencion' },
  { desde: 'c1', hasta: 'r1', motivo: 'atencion' },
  { desde: 'c2', hasta: 'r2', motivo: 'atencion' },
  { desde: 'd1', hasta: 'r1', motivo: 'indicacion' },
  { desde: 'd1', hasta: 'r2', motivo: 'indicacion' },
];

describe('conectadosA', () => {
  it('desde una receta ilumina su diagnóstico y su atención, no a sus hermanas', () => {
    const { nodos } = conectadosA('r1', ARISTAS);
    expect([...nodos].sort()).toEqual(['c1', 'd1', 'r1']);
  });

  it('desde un diagnóstico ilumina lo que derivó de él', () => {
    const { nodos, aristas } = conectadosA('d1', ARISTAS);
    expect([...nodos].sort()).toEqual(['c1', 'd1', 'r1', 'r2']);
    expect(aristas.has('indicacion:d1>r2')).toBe(true);
    expect(aristas.has('atencion:c2>r2')).toBe(false);
  });

  it('no se cuelga con un ciclo', () => {
    const ciclo: AristaConectable[] = [
      { desde: 'a', hasta: 'b', motivo: 'atencion' },
      { desde: 'b', hasta: 'a', motivo: 'indicacion' },
    ];
    expect(conectadosA('a', ciclo).nodos.size).toBe(2);
  });
});

describe('describirIntervalo', () => {
  // Fixed instants (La Paz offset): the result does not depend on the machine's zone.
  const desde = new Date('2026-01-01T12:00:00-04:00');
  const mas = (dias: number) => new Date(desde.getTime() + dias * 86_400_000);

  it.each([
    [0, 'el mismo día'],
    [1, '1 día'],
    [9, '9 días'],
    [21, '3 semanas'],
    [95, '3 meses'],
    [365, '1 año'],
    [548, '1,5 años'],
  ])('%i días → %s', (dias, esperado) => {
    expect(describirIntervalo(desde, mas(dias))).toBe(esperado);
  });

  it('cuenta días de calendario, no tramos de 24 horas', () => {
    expect(describirIntervalo(new Date('2026-01-01T08:00:00-04:00'), new Date('2026-01-01T21:00:00-04:00'))).toBe('el mismo día');
    expect(describirIntervalo(new Date('2026-01-01T23:00:00-04:00'), new Date('2026-01-02T06:00:00-04:00'))).toBe('1 día');
  });

  it('cuenta días clínicos de La Paz, no los del navegador', () => {
    // 20:30 in La Paz is 00:30 UTC of the next day: still a different clinical day from 10:00 the next morning.
    const noche = new Date('2026-03-11T00:30:00Z');
    const manana = new Date('2026-03-11T14:00:00Z');
    expect(describirIntervalo(noche, manana)).toBe('1 día');
    // 23:30 and 01:00 UTC are both the same evening in La Paz.
    expect(describirIntervalo(new Date('2026-03-10T23:30:00Z'), new Date('2026-03-11T01:00:00Z'))).toBe('el mismo día');
  });
});

describe('conectadosA · con claves propias', () => {
  it('usa la clave de la arista cuando la trae: el tronco puede ir al revés que el vínculo', () => {
    const { aristas } = conectadosA('rx', [{ desde: 'e', hasta: 'rx', motivo: 'registrado-en', clave: 'k-1' }]);
    expect([...aristas]).toEqual(['k-1']);
  });
});

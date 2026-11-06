import { describe, expect, it } from 'vitest';

import { etiquetaDeCubo, fechaHora, hace, inicioDeCubo, rejillaDeCubos, textoPercentil, textoProporcion } from './obs-format';

describe('obs-format', () => {
  it('la misma instante se lee distinto en La Paz (UTC−4) y en UTC', () => {
    const iso = '2026-10-31T14:32:00.000Z';
    expect(fechaHora(iso, 'UTC')).toBe('31/10 14:32');
    expect(fechaHora(iso, 'America/La_Paz')).toBe('31/10 10:32');
  });

  it('null o una fecha inválida dicen «Sin dato» (nunca 1970)', () => {
    expect(fechaHora(null, 'UTC')).toBe('Sin dato');
    expect(fechaHora('no-es-fecha', 'UTC')).toBe('Sin dato');
  });

  it('hace: segundos, minutos, horas, días', () => {
    const ahora = new Date('2026-10-31T12:00:00.000Z');
    expect(hace('2026-10-31T11:59:58.000Z', ahora)).toBe('ahora');
    expect(hace('2026-10-31T11:56:00.000Z', ahora)).toBe('hace 4 min');
    expect(hace('2026-10-31T09:00:00.000Z', ahora)).toBe('hace 3 h');
    expect(hace('2026-10-28T12:00:00.000Z', ahora)).toBe('hace 3 d');
    expect(hace(null, ahora)).toBe('Sin dato');
  });

  it('el cubo diario de La Paz empieza a las 04:00 UTC y el de UTC a las 00:00', () => {
    const t = new Date('2026-10-31T10:00:00.000Z');
    expect(inicioDeCubo(t, 'day', 'America/La_Paz').toISOString()).toBe('2026-10-31T04:00:00.000Z');
    expect(inicioDeCubo(t, 'day', 'UTC').toISOString()).toBe('2026-10-31T00:00:00.000Z');
    // A las 02:00 UTC todavía es el día anterior en La Paz.
    expect(inicioDeCubo(new Date('2026-10-31T02:00:00.000Z'), 'day', 'America/La_Paz').toISOString()).toBe('2026-10-30T04:00:00.000Z');
  });

  it('la rejilla cubre toda la ventana, incluso los cubos sin fila (hueco = sin dato)', () => {
    const g = rejillaDeCubos('2026-10-31T10:30:00.000Z', '2026-10-31T13:10:00.000Z', 'hour', 'UTC');
    expect(g.map((d) => d.toISOString())).toEqual([
      '2026-10-31T10:00:00.000Z',
      '2026-10-31T11:00:00.000Z',
      '2026-10-31T12:00:00.000Z',
      '2026-10-31T13:00:00.000Z',
    ]);
    const dias = rejillaDeCubos('2026-10-29T10:00:00.000Z', '2026-10-31T10:00:00.000Z', 'day', 'America/La_Paz');
    expect(dias.map((d) => etiquetaDeCubo(d, 'day', 'America/La_Paz'))).toEqual(['2026-10-29', '2026-10-30', '2026-10-31']);
  });

  it('las etiquetas de cubo por hora no se repiten entre días', () => {
    const a = etiquetaDeCubo(new Date('2026-10-30T14:00:00.000Z'), 'hour', 'UTC');
    const b = etiquetaDeCubo(new Date('2026-10-31T14:00:00.000Z'), 'hour', 'UTC');
    expect(a).not.toBe(b);
  });

  it('un percentil que cayó en el último corte es una cota («≥»)', () => {
    expect(textoPercentil({ value: 10000, atLeast: true })).toBe('≥ 10 s');
    expect(textoPercentil({ value: 231.77 })).toBe('232 ms');
    expect(textoPercentil({ value: null, reason: 'SIN_MUESTRAS' })).toBe('Sin dato');
  });

  it('una proporción 0–1 se lee en porcentaje y null no es 0 %', () => {
    expect(textoProporcion(0.0817)).toBe('8,2 %');
    expect(textoProporcion(null)).toBe('Sin dato');
  });
});

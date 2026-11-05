import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { consultaDeRango, ObservabilityContextStore } from './observability-context.store';

describe('consultaDeRango', () => {
  const ahora = new Date('2026-10-31T15:00:00.000Z');

  it('«hoy» no manda from: la API arranca la ventana a las 00:00 de la zona pedida', () => {
    expect(consultaDeRango('hoy', 'America/La_Paz', ahora)).toEqual({ to: ahora.toISOString(), tz: 'America/La_Paz', interval: 'hour' });
  });

  it('24 h y 7 d respetan los límites de intervalo de la API (hora hasta 7 d; día hasta 92 d)', () => {
    expect(consultaDeRango('24h', 'UTC', ahora)).toMatchObject({ from: '2026-10-30T15:00:00.000Z', interval: 'hour' });
    expect(consultaDeRango('7d', 'UTC', ahora)).toMatchObject({ from: '2026-10-24T15:00:00.000Z', interval: 'day' });
    expect(consultaDeRango('30d', 'UTC', ahora)).toMatchObject({ from: '2026-10-01T15:00:00.000Z', interval: 'day' });
  });
});

describe('ObservabilityContextStore · URL', () => {
  function store(): ObservabilityContextStore {
    TestBed.configureTestingModule({});
    return TestBed.inject(ObservabilityContextStore);
  }

  it('sin parámetros vale lo de por omisión y la URL queda vacía', () => {
    const s = store();
    s.desdeParametros({});
    expect(s.rango()).toBe('hoy');
    expect(s.zona()).toBe('America/La_Paz');
    expect(s.pestana()).toBe('resumen');
    expect(s.haciaParametros()).toEqual({});
  });

  it('ida y vuelta: lo que se escribe en la URL se lee igual', () => {
    const s = store();
    s.desdeParametros({ rango: '24h', tz: 'UTC', pestana: 'errores', estado: 'NEW', modulo: 'iam', codigo: 'INTERNAL', req: 'abc-123' });
    expect(s.haciaParametros()).toEqual({ rango: '24h', tz: 'UTC', pestana: 'errores', estado: 'NEW', modulo: 'iam', codigo: 'INTERNAL', req: 'abc-123' });
  });

  it('un valor inválido en la URL cae al de por omisión, no rompe ni se manda a la API', () => {
    const s = store();
    s.desdeParametros({ rango: '999d', tz: 'Marte/Olimpo', pestana: 'x', estado: 'DROP', grupo: 'no-es-uuid', req: 'a b;c' });
    expect(s.haciaParametros()).toEqual({});
  });

  it('actualizar() sube la versión y fija un instante nuevo para toda la carga', () => {
    const s = store();
    const v = s.version();
    s.actualizar();
    expect(s.version()).toBe(v + 1);
  });
});

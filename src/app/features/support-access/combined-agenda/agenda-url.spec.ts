import { describe, expect, it } from 'vitest';

import { ALL_ORGS, clearAllFilters, defaultUrlState, parseUrlState, toQueryParams, withoutFilter, type AgendaUrlState } from './agenda-url';

const HOY = new Date(2026, 10, 3);
const lector = (valores: Record<string, string>) => ({ get: (nombre: string): string | null => valores[nombre] ?? null });

describe('el estado de la agenda vive en la URL', () => {
  it('sin parámetros es el día de hoy, por doctor, sin filtros', () => {
    expect(parseUrlState(lector({}), HOY)).toEqual(defaultUrlState(HOY));
    expect(defaultUrlState(HOY)).toMatchObject({ view: 'DAY', group: 'DOCTOR', date: '2026-11-03', hidden: [], location: null, service: null, showDenied: true, showFree: true, span: 1 });
  });

  it('lee vista, agrupación, fecha, organización y filtros', () => {
    const estado = parseUrlState(
      lector({ vista: 'semana', agrupar: 'consultorio', fecha: '2026-11-10', org: 't-1', ocultos: 'd-1,d-2', ubicacion: 'piso-1', servicio: 's-1', sinpermiso: '0', libres: '0', rango: '7' }),
      HOY,
    );
    expect(estado).toEqual({
      view: 'WEEK',
      group: 'SPACE',
      date: '2026-11-10',
      org: 't-1',
      hidden: ['d-1', 'd-2'],
      location: 'piso-1',
      service: 's-1',
      showDenied: false,
      showFree: false,
      span: 7,
    });
  });

  it('el enlace de una vista de línea de tiempo vuelve a abrirse igual (ida y vuelta)', () => {
    const original: AgendaUrlState = { view: 'TIMELINE', group: 'SERVICE', date: '2026-11-12', org: ALL_ORGS, hidden: ['d-3'], location: 'a-p2', service: 's-2', showDenied: false, showFree: true, span: 7 };
    const params = toQueryParams(original, HOY);
    const leido = parseUrlState(lector(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null)) as Record<string, string>), HOY);
    expect(leido).toEqual(original);
  });

  it('lo que está en su valor por omisión no ensucia la dirección', () => {
    const params = toQueryParams(defaultUrlState(HOY), HOY);
    expect(Object.values(params).every((v) => v === null)).toBe(true);
  });

  it('un valor inválido cae al valor por omisión en vez de romper la pantalla', () => {
    const estado = parseUrlState(lector({ vista: 'mes', agrupar: 'piso', fecha: '2026-13-45', rango: '3' }), HOY);
    expect(estado).toMatchObject({ view: 'DAY', group: 'DOCTOR', date: '2026-11-03', span: 1 });
  });

  it('un parámetro vacío es lo mismo que ausente', () => {
    expect(parseUrlState(lector({ ocultos: '', org: '', ubicacion: '', servicio: '' }), HOY)).toMatchObject({ hidden: [], org: null, location: null, service: null });
  });
});

describe('chips y «Limpiar todo»', () => {
  const filtrado: AgendaUrlState = { ...defaultUrlState(HOY), view: 'WEEK', org: 't-1', hidden: ['d-1'], location: 'a', service: 's-1', showDenied: false, showFree: false };

  it('quitar un chip quita solo ese filtro', () => {
    expect(withoutFilter(filtrado, 'location')).toMatchObject({ location: null, service: 's-1', hidden: ['d-1'] });
    expect(withoutFilter(filtrado, 'doctors').hidden).toEqual([]);
    expect(withoutFilter(filtrado, 'denied').showDenied).toBe(true);
    expect(withoutFilter(filtrado, 'free').showFree).toBe(true);
  });

  it('«Limpiar todo» quita los filtros y deja la vista, la fecha y la organización', () => {
    expect(clearAllFilters(filtrado)).toEqual({ ...defaultUrlState(HOY), view: 'WEEK', org: 't-1' });
  });
});

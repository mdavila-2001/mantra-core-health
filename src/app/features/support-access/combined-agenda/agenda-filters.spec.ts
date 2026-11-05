import { describe, expect, it } from 'vitest';

import type { LocationNode } from '../../../core/data-access/support-access/support-access.types';
import { activeFilterCount, applyFilters, filterChips, flattenLocationTree, locationBreadcrumb, NO_FILTERS, setAllDoctors, toggleDoctor, type AgendaFilters } from './agenda-filters';
import { events, item } from './agenda.fixtures';

const nodo = (id: string, name: string, parentId: string | null, path: string, kind: LocationNode['kind'] = 'LEVEL'): LocationNode => ({ id, name, parentId, path, kind });

const UBICACIONES: readonly LocationNode[] = [
  nodo('sede', 'Sede Central', null, '/sede/', 'SITE'),
  nodo('a', 'Edificio A', 'sede', '/sede/a/', 'BUILDING'),
  nodo('a-p1', 'Piso 1', 'a', '/sede/a/p1/'),
  nodo('c-103', 'Consultorio 103', 'a-p1', '/sede/a/p1/103/', 'CONSULTING_ROOM'),
  nodo('a-p2', 'Piso 2', 'a', '/sede/a/p2/'),
  nodo('c-201', 'Sala 201', 'a-p2', '/sede/a/p2/201/', 'PROCEDURE_ROOM'),
  nodo('norte', 'Sede Norte', null, '/norte/', 'SITE'),
];
const INDICE = new Map(UBICACIONES.map((n) => [n.id, n]));

const LISTA = events([
  item('piso1', { careSpaceId: 'c-103' }),
  item('piso2', { careSpaceId: 'c-201', practitionerRoleAssignmentId: 'd-2', healthcareServiceId: 's-2' }),
  item('sin-permiso', { careSpaceId: 'c-103', allowedActions: [], denialReason: 'No.' }),
  item('cita', { careSpaceId: 'c-103', status: 'CONFIRMED' }),
]);

const con = (parcial: Partial<AgendaFilters>): AgendaFilters => ({ ...NO_FILTERS, ...parcial });
const ids = (filtros: AgendaFilters): string[] => applyFilters(LISTA, filtros, INDICE).map((e) => e.id);

describe('filtros de la agenda', () => {
  it('sin filtros se ve todo', () => {
    expect(ids(NO_FILTERS)).toEqual(['piso1', 'piso2', 'sin-permiso', 'cita']);
  });

  it('apagar un doctor en «Mis doctores» quita sus horarios y nada más', () => {
    expect(ids(con({ hiddenDoctors: new Set(['d-2']) }))).toEqual(['piso1', 'sin-permiso', 'cita']);
  });

  it('una ubicación del árbol cubre todo lo que queda dentro: el piso trae sus salas', () => {
    expect(ids(con({ locationId: 'a-p1' }))).toEqual(['piso1', 'sin-permiso', 'cita']);
    expect(ids(con({ locationId: 'a' }))).toEqual(['piso1', 'piso2', 'sin-permiso', 'cita']);
    expect(ids(con({ locationId: 'norte' }))).toEqual([]);
  });

  it('una sala es solo esa sala', () => {
    expect(ids(con({ locationId: 'c-201' }))).toEqual(['piso2']);
  });

  it('el servicio filtra por el servicio del horario', () => {
    expect(ids(con({ serviceId: 's-2' }))).toEqual(['piso2']);
  });

  it('los horarios sin permiso se pueden ocultar; los libres, también, pero las citas se quedan', () => {
    expect(ids(con({ showDenied: false }))).toEqual(['piso1', 'piso2', 'cita']);
    expect(ids(con({ showFree: false }))).toEqual(['sin-permiso', 'cita']);
  });

  it('los filtros se combinan', () => {
    expect(ids(con({ locationId: 'a-p1', showFree: false, showDenied: false }))).toEqual(['cita']);
  });

  it('cuenta cuántos filtros cambian lo que se ve', () => {
    expect(activeFilterCount(NO_FILTERS, 3)).toBe(0);
    expect(activeFilterCount(con({ hiddenDoctors: new Set(['d-1']), locationId: 'a', showFree: false }), 3)).toBe(3);
  });
});

describe('«Mis doctores»', () => {
  it('alternar prende y apaga sin tocar el original', () => {
    const base = new Set<string>();
    const apagado = toggleDoctor(base, 'd-1');
    expect([...apagado]).toEqual(['d-1']);
    expect(base.size).toBe(0);
    expect(toggleDoctor(apagado, 'd-1').size).toBe(0);
  });

  it('«Todos» prende a todos y «Ninguno» los apaga a todos', () => {
    const doctores = [
      { id: 'd-1', name: 'A', specialty: '', orgId: 'o' },
      { id: 'd-2', name: 'B', specialty: '', orgId: 'o' },
    ];
    expect(setAllDoctors(doctores, true).size).toBe(0);
    expect([...setAllDoctors(doctores, false)]).toEqual(['d-1', 'd-2']);
  });
});

describe('el árbol de ubicaciones', () => {
  it('se dibuja sede → edificio → piso → sala, en orden y con su nivel', () => {
    const filas = flattenLocationTree(UBICACIONES);
    expect(filas.map((f) => `${'  '.repeat(f.depth)}${f.node.name}`)).toEqual([
      'Sede Central',
      '  Edificio A',
      '    Piso 1',
      '      Consultorio 103',
      '    Piso 2',
      '      Sala 201',
      'Sede Norte',
    ]);
    expect(filas.find((f) => f.node.id === 'a-p1')!.hasChildren).toBe(true);
    expect(filas.find((f) => f.node.id === 'c-103')!.hasChildren).toBe(false);
  });

  it('un nodo cerrado esconde a sus hijos', () => {
    const filas = flattenLocationTree(UBICACIONES, new Set(['a']));
    expect(filas.map((f) => f.node.id)).toEqual(['sede', 'a', 'norte']);
  });

  it('si la API manda un piso sin su edificio, el piso pasa a ser raíz y no se pierde', () => {
    const filas = flattenLocationTree([UBICACIONES[2]!, UBICACIONES[3]!]);
    expect(filas.map((f) => [f.node.id, f.depth])).toEqual([
      ['a-p1', 0],
      ['c-103', 1],
    ]);
  });

  it('el camino de un nodo se escribe con sus dos últimos niveles', () => {
    expect(locationBreadcrumb(UBICACIONES, 'c-103')).toBe('Piso 1 › Consultorio 103');
    expect(locationBreadcrumb(UBICACIONES, 'sede')).toBe('Sede Central');
  });
});

describe('los chips de filtros activos', () => {
  const nombres = { doctors: [{ id: 'd-1', name: 'A', specialty: '', orgId: 'o' }, { id: 'd-2', name: 'B', specialty: '', orgId: 'o' }], services: [{ id: 's-1', name: 'Ecografía' }], locations: INDICE };

  it('sin filtros no hay chips', () => {
    expect(filterChips(NO_FILTERS, nombres)).toEqual([]);
  });

  it('cada filtro activo tiene su chip, con el nombre de lo que filtra', () => {
    const chips = filterChips(con({ hiddenDoctors: new Set(['d-2']), locationId: 'a-p1', serviceId: 's-1', showFree: false, showDenied: false }), nombres);
    expect(chips.map((c) => [c.id, c.label])).toEqual([
      ['doctors', 'Doctores: 1 de 2'],
      ['location', 'Ubicación: Piso 1'],
      ['service', 'Servicio: Ecografía'],
      ['free', 'Sin horarios libres'],
      ['denied', 'Sin horarios sin permiso'],
    ]);
  });
});

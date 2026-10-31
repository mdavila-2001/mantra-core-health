import { describe, expect, it } from 'vitest';

import { dayColumns, weekColumns, type DayColumnsInput } from './agenda-columns';
import { CESP, HP, agenda, item } from './agenda.fixtures';
import { mergeAgendas } from './agenda-model';

const local = (dia: number, hora: number): string => new Date(2026, 10, dia, hora).toISOString();

const DATA = mergeAgendas([
  {
    org: HP,
    agenda: agenda([
      item('a', { start: local(3, 9), end: local(3, 10) }),
      item('b', { start: local(3, 10), end: local(3, 11), careSpaceId: 'c-201', careSpaceName: 'Sala 201' }),
      item('c', { start: local(4, 9), end: local(4, 10) }),
    ]),
  },
]);

function entrada(parcial: Partial<DayColumnsInput> = {}): DayColumnsInput {
  return { events: DATA.events, day: new Date(2026, 10, 3), group: 'DOCTOR', data: DATA, orgs: [HP], multiOrg: false, now: new Date(2026, 10, 2, 8), hiddenDoctors: new Set(), narrowed: false, ...parcial };
}

describe('columnas del día', () => {
  it('por doctor: solo los eventos de ese día, y el doctor que no atiende ese día queda con su columna vacía', () => {
    const columnas = dayColumns(entrada());
    expect(columnas.map((c) => [c.label, c.events.length])).toEqual([
      ['Dr. Pérez', 2],
      ['Dra. Rojas', 0],
    ]);
    expect(columnas[0]!.sub).toBe('Cardiología');
    expect(columnas.every((c) => c.today === false)).toBe(true);
  });

  it('marca la columna de hoy', () => {
    expect(dayColumns(entrada({ now: new Date(2026, 10, 3, 15) })).every((c) => c.today)).toBe(true);
  });

  it('un doctor apagado en «Mis doctores» no tiene columna', () => {
    expect(dayColumns(entrada({ hiddenDoctors: new Set(['d-2']), events: DATA.events.filter((e) => e.practitionerRoleAssignmentId !== 'd-2') })).map((c) => c.label)).toEqual(['Dr. Pérez']);
  });

  it('con un filtro de servicio o ubicación no se muestran columnas vacías', () => {
    expect(dayColumns(entrada({ narrowed: true })).map((c) => c.label)).toEqual(['Dr. Pérez']);
  });

  it('por consultorio: una columna por espacio', () => {
    expect(dayColumns(entrada({ group: 'SPACE' })).map((c) => c.key).sort()).toEqual(['c-103', 'c-201']);
  });

  it('con varias organizaciones, la columna de cada doctor dice a cuál pertenece', () => {
    const dos = mergeAgendas([
      { org: HP, agenda: agenda([item('a', { start: local(3, 9), end: local(3, 10) })]) },
      { org: CESP, agenda: agenda([item('z', { start: local(3, 9), end: local(3, 10), practitionerRoleAssignmentId: 'd-9' })], { doctors: [{ id: 'd-9', name: 'Dra. Céspedes', specialty: 'Dermatología' }] }) },
    ]);
    const columnas = dayColumns(entrada({ data: dos, events: dos.events, orgs: [HP, CESP], multiOrg: true }));
    expect(columnas.find((c) => c.key === 'd-9')!.sub).toBe('Dermatología · CPC');
    expect(columnas.find((c) => c.key === 'd-1')!.sub).toBe('Cardiología · HPM');
  });
});

describe('columnas de la semana', () => {
  it('una por día, con sus eventos y el día de hoy marcado', () => {
    const dias = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 2 + i));
    const columnas = weekColumns(DATA.events, dias, new Date(2026, 10, 4, 12));
    expect(columnas.map((c) => c.key)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    expect(columnas.map((c) => c.events.length)).toEqual([0, 2, 1, 0, 0, 0, 0]);
    expect(columnas.filter((c) => c.today).map((c) => c.key)).toEqual(['2026-11-04']);
  });
});

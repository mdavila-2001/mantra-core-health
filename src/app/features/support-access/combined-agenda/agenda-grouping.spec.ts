import type { SupportAgendaDoctor, SupportAgendaItem } from '../../../core/data-access/support-access/support-access.types';
import { dayRange, doctorColor, groupAgenda, isVisible, itemAriaLabel, timeRows } from './agenda-grouping';

function item(parcial: Partial<SupportAgendaItem> & { id: string }): SupportAgendaItem {
  return {
    kind: 'SLOT',
    start: '2026-11-02T13:00:00.000Z',
    end: '2026-11-02T13:30:00.000Z',
    practitionerRoleAssignmentId: 'd-1',
    careSpaceId: 'c-1',
    careSpaceName: 'Consultorio 103',
    healthcareServiceId: 's-1',
    serviceName: 'Consulta',
    status: 'FREE',
    allowedActions: ['schedule.view'],
    ...parcial,
  };
}

const DOCTORES: readonly SupportAgendaDoctor[] = [
  { id: 'd-1', name: 'Dr. Pérez', specialty: 'Cardiología' },
  { id: 'd-2', name: 'Dra. Rojas', specialty: 'Ginecología' },
];

describe('groupAgenda', () => {
  const items = [
    item({ id: 'a', practitionerRoleAssignmentId: 'd-2', careSpaceId: 'c-2', start: '2026-11-02T14:00:00.000Z' }),
    item({ id: 'b', practitionerRoleAssignmentId: 'd-1', careSpaceId: 'c-1' }),
    item({ id: 'c', practitionerRoleAssignmentId: 'd-1', careSpaceId: 'c-3', start: '2026-11-02T12:00:00.000Z' }),
  ];

  it('por doctor: una columna por doctor, ordenadas por nombre y con sus horarios en orden', () => {
    const columnas = groupAgenda(items, 'DOCTOR', DOCTORES, [], []);

    expect(columnas.map((c) => c.label)).toEqual(['Dr. Pérez', 'Dra. Rojas']);
    expect(columnas[0]!.items.map((i) => i.id)).toEqual(['c', 'b']);
  });

  it('por consultorio y por servicio corta la misma información de otra forma', () => {
    expect(groupAgenda(items, 'SPACE', DOCTORES, [], []).map((c) => c.key).sort()).toEqual(['c-1', 'c-2', 'c-3']);
    expect(groupAgenda(items, 'SERVICE', DOCTORES, [{ id: 's-1', name: 'Consulta' }], [])).toHaveLength(1);
  });
});

describe('timeRows', () => {
  it('son las horas de inicio distintas, en orden', () => {
    const filas = timeRows([item({ id: 'a', start: '2026-11-02T14:00:00.000Z' }), item({ id: 'b' }), item({ id: 'c' })]);
    expect(filas).toEqual(['2026-11-02T13:00:00.000Z', '2026-11-02T14:00:00.000Z']);
  });
});

describe('doctorColor', () => {
  it('es estable por posición y reparte familias distintas', () => {
    expect(doctorColor(DOCTORES, 'd-1').fondo).toBe('var(--c-petrol-100)');
    expect(doctorColor(DOCTORES, 'd-2').fondo).toBe('var(--c-aqua-100)');
    expect(doctorColor(DOCTORES, 'desconocido').fondo).toBe('var(--c-petrol-100)');
  });
});

describe('horarios sin permiso', () => {
  const sinPermiso = item({ id: 'x', allowedActions: [], denialReason: 'No tiene permiso sobre esta agenda.' });

  it('un horario sin «ver la agenda» queda atenuado', () => {
    expect(isVisible(sinPermiso)).toBe(false);
    expect(isVisible(item({ id: 'y' }))).toBe(true);
  });

  it('la etiqueta accesible incluye el motivo, para quien no puede pasar el mouse', () => {
    expect(itemAriaLabel(sinPermiso, 'Dr. Pérez')).toContain('Sin permiso: No tiene permiso sobre esta agenda.');
  });

  it('un horario libre y una cita se leen distinto', () => {
    expect(itemAriaLabel(item({ id: 'l' }), 'Dr. Pérez')).toContain('Horario libre');
    expect(itemAriaLabel(item({ id: 'c', status: 'CHECKED_IN', kind: 'BOOKING', patientLabel: 'Rosa M.' }), 'Dr. Pérez')).toContain('Rosa M., ya llegó');
  });
});

describe('dayRange', () => {
  it('cubre el día local entero', () => {
    const { from, to } = dayRange(new Date(2026, 10, 2, 15, 30));
    expect(new Date(from).getHours()).toBe(0);
    expect(new Date(to).getHours()).toBe(23);
    expect(new Date(to).getTime()).toBeGreaterThan(new Date(from).getTime());
  });
});

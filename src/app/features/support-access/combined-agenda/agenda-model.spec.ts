import { describe, expect, it } from 'vitest';

import { agenda, event, events, item, CESP, HP } from './agenda.fixtures';
import {
  addDays,
  assignLanes,
  boundsOf,
  colorOfDoctor,
  dayKeyOf,
  daysOf,
  eventLabel,
  eventTooltip,
  fromDayKey,
  hourlyHeat,
  layoutColumn,
  layoutRow,
  makeOrg,
  mergeAgendas,
  nowOffset,
  occupancyOf,
  orgShortName,
  startOfWeek,
  titleOf,
  toDayKey,
  windowFor,
} from './agenda-model';

/** Un instante local: las pruebas no dependen del huso horario de quien las corre. */
const local = (dia: number, hora: number, minuto = 0): string => new Date(2026, 10, dia, hora, minuto).toISOString();

describe('fechas y rangos', () => {
  it('la semana empieza el lunes: el viernes 30 de octubre de 2026 pertenece a la semana del lunes 26', () => {
    expect(toDayKey(startOfWeek(new Date(2026, 9, 30)))).toBe('2026-10-26');
    expect(toDayKey(startOfWeek(new Date(2026, 9, 26)))).toBe('2026-10-26');
    // El domingo cierra la semana anterior, no abre la siguiente.
    expect(toDayKey(startOfWeek(new Date(2026, 10, 1)))).toBe('2026-10-26');
  });

  it('el día cubre un día; la semana, siete desde el lunes; la línea de tiempo, según el rango', () => {
    const ancla = new Date(2026, 10, 4);
    expect(daysOf('DAY', ancla, 1).map(toDayKey)).toEqual(['2026-11-04']);
    expect(daysOf('WEEK', ancla, 1).map(toDayKey)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    expect(daysOf('TIMELINE', ancla, 1)).toHaveLength(1);
    expect(daysOf('TIMELINE', ancla, 7)).toHaveLength(7);
  });

  it('el rango que se pide a la API va del primer instante del primer día al último del último', () => {
    const { from, to } = boundsOf(daysOf('WEEK', new Date(2026, 10, 4), 1));
    expect(new Date(from).getTime()).toBe(new Date(2026, 10, 2, 0, 0, 0, 0).getTime());
    expect(new Date(to).getTime()).toBe(new Date(2026, 10, 8, 23, 59, 59, 999).getTime());
  });

  it('una fecha inválida de la URL no se lee como fecha', () => {
    expect(fromDayKey('2026-02-30')).toBeNull();
    expect(fromDayKey('hoy')).toBeNull();
    expect(fromDayKey(null)).toBeNull();
    expect(toDayKey(fromDayKey('2026-11-02')!)).toBe('2026-11-02');
  });

  it('cruzar el cambio de mes suma bien los días', () => {
    expect(toDayKey(addDays(new Date(2026, 9, 30), 3))).toBe('2026-11-02');
    expect(dayKeyOf(new Date(2026, 10, 2, 23, 30).toISOString())).toBe('2026-11-02');
  });

  it('el título de una semana nombra desde y hasta; el de un día, el día completo', () => {
    expect(titleOf('WEEK', daysOf('WEEK', new Date(2026, 10, 4), 1))).toMatch(/2\D+8 de noviembre de 2026/);
    expect(titleOf('DAY', [new Date(2026, 10, 4)])).toMatch(/miércoles, 4 de noviembre de 2026/);
  });
});

describe('organizaciones y agendas unidas', () => {
  it('la sigla sale de las palabras que importan', () => {
    expect(orgShortName('Hospital Piloto Mantra')).toBe('HPM');
    expect(orgShortName('Consultorio Dra. Paola Céspedes')).toBe('CPC');
  });

  it('une varias organizaciones y cada evento recuerda de cuál viene', () => {
    const unido = mergeAgendas([
      { org: HP, agenda: agenda([item('a')]) },
      { org: CESP, agenda: agenda([item('b', { practitionerRoleAssignmentId: 'd-9' })], { doctors: [{ id: 'd-9', name: 'Dra. Céspedes', specialty: 'Dermatología' }] }) },
    ]);
    expect(unido.events.map((e) => [e.id, e.orgShort, e.orgTone, e.doctorName])).toEqual([
      ['a', 'HPM', 0, 'Dr. Pérez'],
      ['b', 'CPC', 1, 'Dra. Céspedes'],
    ]);
    expect(unido.doctors.map((d) => d.orgId)).toEqual(['t-hp', 't-hp', 't-ce']);
    expect(unido.orgs).toHaveLength(2);
  });

  it('el color de un doctor es estable por posición y da la vuelta al llegar al final', () => {
    const doctores = Array.from({ length: 9 }, (_, i) => ({ id: `d-${i}`, name: `D${i}`, specialty: '', orgId: 'o' }));
    expect(colorOfDoctor(doctores, 'd-0').family).toBe('petrol');
    expect(colorOfDoctor(doctores, 'd-1').family).toBe('aqua');
    expect(colorOfDoctor(doctores, 'd-8').family).toBe('petrol');
    expect(colorOfDoctor(doctores, 'no-existe').index).toBe(0);
  });

  it('makeOrg arma la sigla', () => {
    expect(makeOrg('x', 'Clínica Santa María', 2).short).toBe('CSM');
  });
});

describe('la ventana de horas y la posición de cada evento', () => {
  it('va de la primera a la última hora con algo, redondeada a la hora', () => {
    const w = windowFor([item('a', { start: local(3, 9, 30), end: local(3, 10) }), item('b', { start: local(3, 16, 30), end: local(3, 17, 15) })]);
    expect(w).toEqual({ startMin: 9 * 60, endMin: 18 * 60 });
  });

  it('sin eventos, una jornada por defecto; con muy pocos, no menos de cuatro horas', () => {
    expect(windowFor([])).toEqual({ startMin: 8 * 60, endMin: 18 * 60 });
    expect(windowFor([item('a', { start: local(3, 10), end: local(3, 10, 30) })])).toEqual({ startMin: 10 * 60, endMin: 14 * 60 });
  });

  it('el alto sale de la duración y la posición, de la hora', () => {
    const [colocado] = layoutColumn(events([item('a', { start: local(3, 10), end: local(3, 11) })]), { startMin: 9 * 60, endMin: 18 * 60 }, 1);
    expect(colocado).toMatchObject({ top: 60, height: 60, lane: 0, lanes: 1 });
  });

  it('los que se pisan quedan lado a lado en carriles; los que no, a todo el ancho', () => {
    const lista = events([
      item('a', { start: local(3, 9), end: local(3, 10) }),
      item('b', { start: local(3, 9, 30), end: local(3, 10, 30), practitionerRoleAssignmentId: 'd-2' }),
      item('c', { start: local(3, 11), end: local(3, 11, 30) }),
    ]);
    const colocados = layoutColumn(lista, { startMin: 9 * 60, endMin: 12 * 60 }, 1);
    const por = Object.fromEntries(colocados.map((c) => [c.event.id, [c.lane, c.lanes]]));
    expect(por).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] });
  });

  it('assignLanes reusa el carril que quedó libre', () => {
    const intervalos = [
      { id: 1, s: 0, e: 10 },
      { id: 2, s: 5, e: 15 },
      { id: 3, s: 10, e: 20 },
    ];
    const r = assignLanes(intervalos, (i) => i.s, (i) => i.e);
    expect(r.map((x) => [x.item.id, x.lane, x.lanes])).toEqual([
      [1, 0, 2],
      [2, 1, 2],
      [3, 0, 2],
    ]);
  });

  it('un evento muy corto no desaparece: tiene un alto mínimo', () => {
    const [c] = layoutColumn(events([item('a', { start: local(3, 9), end: local(3, 9, 5) })]), { startMin: 9 * 60, endMin: 13 * 60 }, 1);
    expect(c!.height).toBeGreaterThanOrEqual(20);
  });
});

describe('la línea de tiempo', () => {
  it('cada día ocupa su ancho y el segundo día arranca donde termina el primero', () => {
    const dias = [new Date(2026, 10, 3), new Date(2026, 10, 4)];
    const lista = events([item('a', { start: local(3, 9), end: local(3, 9, 30) }), item('b', { start: local(4, 9), end: local(4, 9, 30) })]);
    const { bars } = layoutRow(lista, dias, { startMin: 9 * 60, endMin: 11 * 60 }, 2);
    // Ventana de 2 h a 2 px por minuto: 240 px por día.
    expect(bars.find((b) => b.event.id === 'a')!.left).toBe(0);
    expect(bars.find((b) => b.event.id === 'b')!.left).toBe(240);
  });

  it('dos citas que se pisan en la misma fila usan dos carriles', () => {
    const lista = events([item('a', { start: local(3, 9), end: local(3, 10) }), item('b', { start: local(3, 9, 30), end: local(3, 10, 30) })]);
    const { lanes } = layoutRow(lista, [new Date(2026, 10, 3)], { startMin: 9 * 60, endMin: 12 * 60 }, 1);
    expect(lanes).toBe(2);
  });

  it('la franja de calor cuenta la ocupación hora por hora', () => {
    const lista = events([
      item('a', { start: local(3, 9), end: local(3, 9, 30), status: 'CONFIRMED' }),
      item('b', { start: local(3, 9, 30), end: local(3, 10), status: 'FREE' }),
      item('c', { start: local(3, 10), end: local(3, 10, 30), status: 'FREE' }),
    ]);
    const calor = hourlyHeat(lista, [new Date(2026, 10, 3)], { startMin: 9 * 60, endMin: 12 * 60 });
    expect(calor.map((c) => [c.hour, c.percent, c.level])).toEqual([
      [9, 50, 3],
      [10, 0, 1],
      [11, 0, 0],
    ]);
  });
});

describe('ocupación', () => {
  it('cuenta lo ocupado sobre lo que se puede ver, y no cuenta lo que no se ve ni lo cancelado', () => {
    const lista = [
      item('a', { status: 'CONFIRMED' }),
      item('b', { status: 'CHECKED_IN' }),
      item('c', { status: 'FREE' }),
      item('d', { status: 'FREE', allowedActions: [] }),
      item('e', { status: 'CANCELLED' }),
    ];
    const o = occupancyOf(lista);
    expect(o).toMatchObject({ bookedCount: 2, totalCount: 3, percent: 67, bookedMin: 60, freeMin: 30 });
  });

  it('sin nada que medir da 0 y no divide por cero', () => {
    expect(occupancyOf([])).toMatchObject({ percent: 0, totalMin: 0 });
  });
});

describe('el indicador de «ahora»', () => {
  it('cae en la posición de la hora actual si el día es hoy y está dentro de la ventana', () => {
    const w = { startMin: 9 * 60, endMin: 18 * 60 };
    expect(nowOffset(new Date(2026, 10, 3, 10, 30), new Date(2026, 10, 3), w, 2)).toBe(180);
  });

  it('no aparece en otro día ni fuera de la ventana', () => {
    const w = { startMin: 9 * 60, endMin: 18 * 60 };
    expect(nowOffset(new Date(2026, 10, 3, 10, 30), new Date(2026, 10, 4), w, 2)).toBeNull();
    expect(nowOffset(new Date(2026, 10, 3, 7, 0), new Date(2026, 10, 3), w, 2)).toBeNull();
  });
});

describe('lo que cada evento dice en voz alta', () => {
  it('un horario sin permiso lleva el motivo; una cita, su estado y su paciente; un libre, que está libre', () => {
    expect(eventLabel(event('x', { allowedActions: [], denialReason: 'No tiene permiso sobre esta agenda.' }), false)).toContain('Sin permiso: No tiene permiso sobre esta agenda.');
    expect(eventLabel(event('y', { status: 'BOOKED', patientLabel: 'Rosa M.' }), false)).toContain('Reservada, por confirmar, Rosa M.');
    expect(eventLabel(event('z'), false)).toContain('Horario libre');
  });

  it('un bloque «Reservado» no es un permiso que falta: dice que está reservado y no revela por qué', () => {
    const reservado = event('r', { status: 'CONFIRMED', allowedActions: [], denialReason: 'RESERVED' });
    expect(eventLabel(reservado, false)).toContain('Reservado: no puede ver el detalle de esta cita');
    expect(eventLabel(reservado, false)).not.toContain('Sin permiso');
    expect(eventLabel(reservado, false)).not.toContain('RESERVED');
  });

  it('con varias organizaciones, dice en cuál es', () => {
    expect(eventLabel(event('z'), true)).toContain('Hospital Piloto Mantra');
    expect(eventLabel(event('z'), false)).not.toContain('Hospital Piloto Mantra');
  });
});

describe('el globo de un evento', () => {
  it('sin permiso dice el motivo que dio la API; con permiso no hay globo', () => {
    expect(eventTooltip(event('x', { allowedActions: [], denialReason: 'No tiene permiso sobre esta agenda.' }))).toBe('No tiene permiso sobre esta agenda.');
    expect(eventTooltip(event('y', { allowedActions: [] }))).toBe('Sin permiso sobre este horario.');
    expect(eventTooltip(event('z'))).toBe('');
  });

  it('un bloque «Reservado» invita a preguntar por qué, sin decir el código', () => {
    const globo = eventTooltip(event('r', { allowedActions: [], denialReason: 'RESERVED' }));
    expect(globo).toContain('Reservado: no puede ver el detalle de esta cita.');
    expect(globo).not.toContain('RESERVED');
  });
});

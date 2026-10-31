import type { SupportActivityEntry } from './support-access.types';
import { actionOptions, activityActionLabel, activityParams, audienceOfPath, doctorOptions, localDay, personOptions } from './support-activity';

function entrada(id: string, userId: string, personName: string, action: string, practitionerName?: string): SupportActivityEntry {
  return {
    id,
    userId,
    personName,
    action,
    auditAction: action.toUpperCase(),
    entity: 'booking',
    summary: `s-${id}`,
    success: true,
    result: 'SUCCESS',
    createdAt: '2026-10-30T15:00:00Z',
    ...(practitionerName === undefined ? {} : { practitionerName }),
  };
}

const E = [
  entrada('1', 'u-ana', 'Ana Gutiérrez', 'schedule.create', 'Dr. Pérez'),
  entrada('2', 'u-lucia', 'Lucía Paz', 'schedule.check_in', 'Dra. Méndez'),
  entrada('3', 'u-ana', 'Ana Gutiérrez', 'messages.reply_on_behalf', 'Dr. Pérez'),
  entrada('4', 'u-hosp', 'Hospital', 'engagement.recertified'),
];

describe('las opciones de los filtros', () => {
  it('las personas salen de lo que hay, sin repetir, con el id como valor y el nombre como rótulo', () => {
    expect(personOptions(E)).toEqual([
      { value: 'u-ana', label: 'Ana Gutiérrez' },
      { value: 'u-hosp', label: 'Hospital' },
      { value: 'u-lucia', label: 'Lucía Paz' },
    ]);
  });

  it('los doctores son los que la API dejó ver', () => {
    expect(doctorOptions(E).map((o) => o.value)).toEqual(['Dr. Pérez', 'Dra. Méndez']);
  });

  it('las acciones se ordenan por su nombre en palabras', () => {
    const rotulos = actionOptions(E).map((o) => o.label);
    expect(rotulos).toEqual([...rotulos].sort((a, b) => a.localeCompare(b, 'es')));
    expect(actionOptions(E).map((o) => o.value).sort()).toEqual(['engagement.recertified', 'messages.reply_on_behalf', 'schedule.check_in', 'schedule.create']);
  });
});

describe('apoyos', () => {
  it('dice cada código en palabras; uno desconocido se muestra tal cual', () => {
    expect(activityActionLabel('schedule.create')).toBe('Crear citas');
    expect(activityActionLabel('engagement.suspended')).toBe('Se suspendió un vínculo');
    expect(activityActionLabel('engagement.confirmed_by_person')).toBe('La persona confirmó su vínculo');
    expect(activityActionLabel('algo.nuevo')).toBe('algo.nuevo');
  });

  it('«pidió reactivar» ya no existe: la persona no reactiva', () => {
    expect(activityActionLabel('engagement.reactivation_requested')).toBe('engagement.reactivation_requested');
  });

  it('manda a la API solo los filtros con valor, con sus nombres', () => {
    expect(activityParams({ person: 'Ana', doctor: '', from: '2026-10-01' })).toEqual({ person: 'Ana', from: '2026-10-01' });
    expect(activityParams({ userId: 'u-1', tenantId: 't-1', action: 'schedule.confirm', to: '2026-10-30', cursor: 'abc' })).toEqual({
      userId: 'u-1',
      tenantId: 't-1',
      action: 'schedule.confirm',
      to: '2026-10-30',
      cursor: 'abc',
    });
  });

  it('el tope de filas va de 1 a 200', () => {
    expect(activityParams({ limit: 500 })['limit']).toBe('200');
    expect(activityParams({ limit: 0 })['limit']).toBe('1');
    expect(activityParams({ limit: 50 })['limit']).toBe('50');
  });

  it('localDay es el día de la hora local', () => {
    expect(localDay(new Date(2026, 9, 30, 23, 30).toISOString())).toBe('2026-10-30');
  });

  it('sabe qué pantalla es por la ruta', () => {
    expect(audienceOfPath('administration/support-activity')).toBe('org');
    expect(audienceOfPath('/my-team/activity')).toBe('doctor');
    expect(audienceOfPath('my-support/activity')).toBe('person');
  });
});

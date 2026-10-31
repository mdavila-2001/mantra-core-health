import { describe, expect, it } from 'vitest';

import { canDrag, dropVerdict, missingNote, offeredActions, rescheduleCandidates, reschedulePreview } from './agenda-actions';
import { CESP, event, events, item } from './agenda.fixtures';
import type { SupportActionCode } from '../../../core/data-access/support-access/support-access.types';

const AHORA = new Date(2026, 10, 3, 8, 0);
const mañana = (hora: number): { start: string; end: string } => ({ start: new Date(2026, 10, 4, hora).toISOString(), end: new Date(2026, 10, 4, hora, 30).toISOString() });
const ids = (lista: readonly { id: string }[]): string[] => lista.map((a) => a.id);

const ANA: SupportActionCode[] = ['schedule.view', 'schedule.create', 'schedule.reschedule', 'schedule.cancel', 'schedule.confirm', 'schedule.check_in', 'schedule.walk_in', 'schedule.waitlist', 'patient.register'];
const LUCIA: SupportActionCode[] = ['schedule.view', 'schedule.check_in', 'schedule.walk_in', 'patient.register'];
const MARCOS: SupportActionCode[] = ['schedule.view', 'schedule.create', 'schedule.reschedule', 'schedule.cancel'];

describe('qué se ofrece sobre un horario o una cita', () => {
  it('Ana, en un horario libre: crear, atender sin cita y lista de espera', () => {
    expect(ids(offeredActions(event('a', { status: 'FREE', allowedActions: ANA })))).toEqual(['CREATE', 'WALK_IN', 'WAITLIST']);
  });

  it('Ana, en una cita reservada (por confirmar): confirmar, llegada, reprogramar y cancelar', () => {
    expect(ids(offeredActions(event('a', { status: 'BOOKED', kind: 'BOOKING', allowedActions: ANA })))).toEqual(['CONFIRM', 'CHECK_IN', 'RESCHEDULE', 'CANCEL']);
  });

  it('en una cita ya confirmada no se vuelve a ofrecer «Confirmar»', () => {
    expect(ids(offeredActions(event('a', { status: 'CONFIRMED', kind: 'BOOKING', allowedActions: ANA })))).toEqual(['CHECK_IN', 'RESCHEDULE', 'CANCEL']);
  });

  it('Lucía (recepción) no tiene «Crear»: el botón no existe, y sí atender sin cita', () => {
    const libre = event('a', { status: 'FREE', allowedActions: LUCIA });
    expect(ids(offeredActions(libre))).toEqual(['WALK_IN']);
    expect(ids(offeredActions(libre))).not.toContain('CREATE');
    const cita = event('b', { status: 'CONFIRMED', kind: 'BOOKING', allowedActions: LUCIA });
    expect(ids(offeredActions(cita))).toEqual(['CHECK_IN']);
  });

  it('Marcos (call center): crear, reprogramar y cancelar; nada de llegada ni confirmar', () => {
    expect(ids(offeredActions(event('a', { status: 'FREE', allowedActions: MARCOS })))).toEqual(['CREATE']);
    expect(ids(offeredActions(event('b', { status: 'BOOKED', kind: 'BOOKING', allowedActions: MARCOS })))).toEqual(['RESCHEDULE', 'CANCEL']);
  });

  it('un paciente que ya llegó y una cita cancelada no tienen acciones', () => {
    expect(offeredActions(event('a', { status: 'CHECKED_IN', kind: 'BOOKING', allowedActions: ANA }))).toEqual([]);
    expect(offeredActions(event('b', { status: 'CANCELLED', kind: 'BOOKING', allowedActions: ANA }))).toEqual([]);
  });

  it('un horario sin permiso para verlo no ofrece nada, aunque traiga otras acciones', () => {
    expect(offeredActions(event('a', { allowedActions: ['schedule.create'] }))).toEqual([]);
    expect(missingNote(event('a', { allowedActions: [] }))).toBeNull();
  });
});

describe('la nota de lo que el permiso no incluye', () => {
  it('nombra lo que falta con palabras de la persona, no con códigos', () => {
    const nota = missingNote(event('a', { status: 'FREE', allowedActions: LUCIA }));
    expect(nota).toBe('Su permiso en este horario no incluye crear citas y manejar la lista de espera.');
  });

  it('si no falta nada, no hay nota', () => {
    expect(missingNote(event('a', { status: 'FREE', allowedActions: ANA }))).toBeNull();
  });

  it('con un solo faltante, lo dice sin «y»', () => {
    expect(missingNote(event('a', { status: 'CONFIRMED', kind: 'BOOKING', allowedActions: ['schedule.view', 'schedule.reschedule', 'schedule.cancel'] }))).toBe('Su permiso en este horario no incluye registrar la llegada del paciente.');
  });
});

describe('arrastrar una cita para reprogramarla', () => {
  const origen = event('o', { status: 'CONFIRMED', kind: 'BOOKING', patientLabel: 'Rosa M.', allowedActions: ANA });
  const libre = (id: string, parcial = {}) => event(id, { ...mañana(10), status: 'FREE', allowedActions: ANA, ...parcial });

  it('se arrastra una cita reservada o confirmada con permiso de reprogramar', () => {
    expect(canDrag(origen)).toBe(true);
    expect(canDrag(event('b', { status: 'BOOKED', kind: 'BOOKING', allowedActions: ANA }))).toBe(true);
  });

  it('no se arrastra un horario libre, a quien ya llegó, ni sin permiso de reprogramar', () => {
    expect(canDrag(libre('x'))).toBe(false);
    expect(canDrag(event('c', { status: 'CHECKED_IN', allowedActions: ANA }))).toBe(false);
    expect(canDrag(event('d', { status: 'CONFIRMED', allowedActions: LUCIA }))).toBe(false);
  });

  it('un horario libre del mismo servicio, a futuro y con permiso, sirve', () => {
    expect(dropVerdict(origen, libre('t'), AHORA)).toEqual({ ok: true, warnings: [] });
  });

  it('avisa si cambia de doctor o de lugar, sin impedirlo', () => {
    const otro = libre('t', { practitionerRoleAssignmentId: 'd-2', careSpaceId: 'c-201', careSpaceName: 'Sala 201' });
    const v = dropVerdict(origen, otro, AHORA);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.warnings.join(' ')).toContain('Cambia de lugar: de Consultorio 103 a Sala 201.');
  });

  it('no sirve sobre otra cita ni sobre sí misma', () => {
    const v = dropVerdict(origen, event('p', { ...mañana(11), status: 'CONFIRMED', allowedActions: ANA }), AHORA);
    expect(v).toMatchObject({ ok: false, reason: expect.stringContaining('ya tiene una cita') });
    expect(dropVerdict(origen, origen, AHORA).ok).toBe(false);
  });

  it('no sirve en otro servicio, y dice cuál es', () => {
    const v = dropVerdict(origen, libre('t', { healthcareServiceId: 's-9', serviceName: 'Ecografía' }), AHORA);
    expect(v).toMatchObject({ ok: false });
    if (!v.ok) expect(v.reason).toContain('otro servicio (Ecografía)');
  });

  it('no sirve en un horario que ya pasó', () => {
    const pasado = libre('t', { start: new Date(2026, 10, 3, 7).toISOString(), end: new Date(2026, 10, 3, 7, 30).toISOString() });
    expect(dropVerdict(origen, pasado, AHORA)).toMatchObject({ ok: false, reason: 'Ese horario ya pasó.' });
  });

  it('no sirve sin permiso: da el motivo que dio la API; sin reprogramar, dice que no lo incluye', () => {
    expect(dropVerdict(origen, libre('t', { allowedActions: [], denialReason: 'No tiene permiso sobre esta agenda.' }), AHORA)).toMatchObject({ ok: false, reason: 'No tiene permiso sobre esta agenda.' });
    expect(dropVerdict(origen, libre('t', { allowedActions: LUCIA }), AHORA)).toMatchObject({ ok: false, reason: expect.stringContaining('no incluye reprogramar') });
  });

  it('no se mueve una cita a otra organización', () => {
    const deOtra = events([item('t', { ...mañana(10), status: 'FREE', allowedActions: ANA })], CESP)[0]!;
    const v = dropVerdict(origen, deOtra, AHORA);
    expect(v).toMatchObject({ ok: false });
    if (!v.ok) expect(v.reason).toContain('otra organización (Consultorio Dra. Paola Céspedes)');
  });

  it('los destinos del panel son solo los que sirven, primero los del mismo doctor y por hora', () => {
    const lista = [
      libre('mismo-tarde', { start: new Date(2026, 10, 4, 15).toISOString(), end: new Date(2026, 10, 4, 15, 30).toISOString() }),
      libre('otro-temprano', { practitionerRoleAssignmentId: 'd-2', start: new Date(2026, 10, 4, 9).toISOString(), end: new Date(2026, 10, 4, 9, 30).toISOString() }),
      libre('mismo-temprano', { start: new Date(2026, 10, 4, 9).toISOString(), end: new Date(2026, 10, 4, 9, 30).toISOString() }),
      libre('otro-servicio', { healthcareServiceId: 's-9' }),
      libre('sin-permiso', { allowedActions: [] }),
    ];
    expect(ids(rescheduleCandidates(origen, lista, AHORA))).toEqual(['mismo-temprano', 'mismo-tarde', 'otro-temprano']);
    expect(rescheduleCandidates(origen, lista, AHORA, 2)).toHaveLength(2);
  });

  it('la vista previa dice la organización, el paciente, de dónde sale y adónde va', () => {
    const lineas = reschedulePreview(origen, libre('t', { practitionerRoleAssignmentId: 'd-2' }));
    expect(lineas.map((l) => l.label)).toEqual(['Organización', 'Paciente', 'Ahora', 'Pasa a']);
    expect(lineas[0]!.value).toBe('Hospital Piloto Mantra');
    expect(lineas[1]!.value).toBe('Rosa M.');
  });
});

import { bookingStatusOf, fromWireSupportAgenda, type WireSupportAgenda } from './support-agenda.wire';

/**
 * `GET /me/support-agenda` tal como lo contesta la API (`SupportAgendaResponseDto`): solo CITAS (no horarios libres), con
 * `statusConceptId` (un concepto, no un código), doctores por **perfil profesional** y filtros planos.
 */
const DOCTOR = '11111111-1111-4111-8111-111111111111';
const SERVICIO = '22222222-2222-4222-8222-222222222222';
const ESPACIO = '33333333-3333-4333-8333-333333333333';
const RECURSO = '44444444-4444-4444-8444-444444444444';
const RESERVA = '55555555-5555-4555-8555-555555555555';
const CONFIRMADA = 'c-confirmada';
const CODIGOS: Readonly<Record<string, string>> = { [CONFIRMADA]: 'BOOKING_CONFIRMED', 'c-llego': 'BOOKING_CHECKED_IN', 'c-pedida': 'BOOKING_REQUESTED' };
const codigoDe = (id: string): string | undefined => CODIGOS[id];

function wire(items: WireSupportAgenda['items']): WireSupportAgenda {
  return {
    doctors: [{ practitionerProfileId: DOCTOR, displayName: 'Dr. Andrés Pérez' }],
    services: [{ id: SERVICIO, name: 'Consulta externa' }],
    locations: [{ id: ESPACIO, name: 'Consultorio 103', code: 'A-P1-103' }],
    items,
  };
}

const VISIBLE = {
  bookingId: RESERVA,
  resourceId: RECURSO,
  practitionerProfileId: DOCTOR,
  startAt: '2026-11-02T13:00:00.000Z',
  endAt: '2026-11-02T13:30:00.000Z',
  statusConceptId: CONFIRMADA,
  careSpaceId: ESPACIO,
  healthcareServiceId: SERVICIO,
  patientProfileId: '66666666-6666-4666-8666-666666666666',
  patientName: 'Ana Lucía Pérez Quiroga',
  waitlistCount: 2,
  allowedActions: ['schedule.view', 'schedule.check_in'],
};

describe('fromWireSupportAgenda', () => {
  it('una cita que se puede ver: la clave es la reserva y trae servicio, espacio y paciente por nombre', () => {
    const { items } = fromWireSupportAgenda(wire([VISIBLE]), codigoDe);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: RESERVA,
      bookingId: RESERVA,
      kind: 'BOOKING',
      start: '2026-11-02T13:00:00.000Z',
      end: '2026-11-02T13:30:00.000Z',
      practitionerRoleAssignmentId: DOCTOR,
      careSpaceId: ESPACIO,
      careSpaceName: 'Consultorio 103',
      healthcareServiceId: SERVICIO,
      serviceName: 'Consulta externa',
      resourceId: RECURSO,
      status: 'CONFIRMED',
      patientLabel: 'Ana Lucía Pérez Quiroga',
      waitlistCount: 2,
      allowedActions: ['schedule.view', 'schedule.check_in'],
    });
    expect(items[0]).not.toHaveProperty('denialReason');
  });

  it('un bloque sin «Ver agenda» no trae reserva, servicio ni paciente: su clave es local, estable y no se hace pasar por una cita', () => {
    const bloque = {
      resourceId: RECURSO,
      practitionerProfileId: DOCTOR,
      startAt: VISIBLE.startAt,
      endAt: VISIBLE.endAt,
      statusConceptId: CONFIRMADA,
      careSpaceId: ESPACIO,
      allowedActions: ['schedule.check_in'],
      denialReason: 'No tiene permiso para ver esta cita.',
    };
    const a = fromWireSupportAgenda(wire([bloque]), codigoDe).items[0]!;
    const b = fromWireSupportAgenda(wire([bloque]), codigoDe).items[0]!;
    expect(a.id.startsWith('bloque:')).toBe(true);
    expect(a.id).toBe(b.id);
    expect(a).not.toHaveProperty('bookingId');
    expect(a).not.toHaveProperty('healthcareServiceId');
    expect(a).not.toHaveProperty('patientLabel');
    expect(a.serviceName).toBe('');
    expect(a.denialReason).toBe('No tiene permiso para ver esta cita.');
  });

  it('dos bloques del mismo doctor a distinta hora tienen claves distintas', () => {
    const base = { resourceId: RECURSO, practitionerProfileId: DOCTOR, statusConceptId: CONFIRMADA, careSpaceId: ESPACIO, allowedActions: ['schedule.check_in'] };
    const { items } = fromWireSupportAgenda(
      wire([
        { ...base, startAt: '2026-11-02T13:00:00.000Z', endAt: '2026-11-02T13:30:00.000Z' },
        { ...base, startAt: '2026-11-02T14:00:00.000Z', endAt: '2026-11-02T14:30:00.000Z' },
      ]),
      codigoDe,
    );
    expect(new Set(items.map((i) => i.id)).size).toBe(2);
  });

  it('los doctores salen por su perfil profesional, que es también la clave de cada cita; los filtros planos se convierten a los de la pantalla', () => {
    const agenda = fromWireSupportAgenda(wire([VISIBLE]), codigoDe);
    expect(agenda.doctors).toEqual([{ id: DOCTOR, name: 'Dr. Andrés Pérez', specialty: '' }]);
    expect(agenda.services).toEqual([{ id: SERVICIO, name: 'Consulta externa' }]);
    expect(agenda.locations).toEqual([{ id: ESPACIO, kind: 'CONSULTING_ROOM', name: 'Consultorio 103', parentId: null, path: `/${ESPACIO}/` }]);
  });

  it('una lista vacía es una agenda vacía, no un error', () => {
    const agenda = fromWireSupportAgenda({ doctors: [], services: [], locations: [], items: [] }, codigoDe);
    expect(agenda).toEqual({ doctors: [], services: [], locations: [], items: [] });
  });

  it('un espacio que la lista de ubicaciones no nombra queda con el nombre vacío, sin romper', () => {
    const { items } = fromWireSupportAgenda(wire([{ ...VISIBLE, careSpaceId: '99999999-9999-4999-8999-999999999999' }]), codigoDe);
    expect(items[0]!.careSpaceName).toBe('');
  });

  it('la cita sin espacio ni doctor (agenda sin ficha) sigue saliendo, con textos vacíos', () => {
    const { items } = fromWireSupportAgenda(
      wire([{ startAt: VISIBLE.startAt, endAt: VISIBLE.endAt, statusConceptId: CONFIRMADA, allowedActions: ['schedule.view'], bookingId: RESERVA }]),
      codigoDe,
    );
    expect(items[0]).toMatchObject({ careSpaceId: '', careSpaceName: '', practitionerRoleAssignmentId: '' });
  });

  it('el estado sale del código del concepto; uno que no se pudo resolver queda como «pedida»', () => {
    const estado = (id: string) => fromWireSupportAgenda(wire([{ ...VISIBLE, statusConceptId: id }]), codigoDe).items[0]!.status;
    expect(estado('c-llego')).toBe('CHECKED_IN');
    expect(estado('c-pedida')).toBe('BOOKED');
    expect(estado('desconocido')).toBe('BOOKED');
  });
});

describe('bookingStatusOf', () => {
  it.each([
    ['BOOKING_REQUESTED', 'BOOKED'],
    ['BOOKING_PENDING_CONFIRM', 'BOOKED'],
    ['BOOKING_PENDING_CONFIRMATION', 'BOOKED'],
    ['BOOKING_CONFIRMED', 'CONFIRMED'],
    ['BOOKING_CHECKED_IN', 'CHECKED_IN'],
    ['BOOKING_IN_PROGRESS', 'CHECKED_IN'],
    ['BOOKING_COMPLETED', 'CHECKED_IN'],
    ['BOOKING_CANCELLED', 'CANCELLED'],
    ['BK-CONFIRMED', 'CONFIRMED'],
    ['scheduling:BOOKING_CONFIRMED', 'CONFIRMED'],
  ])('%s → %s', (codigo, esperado) => {
    expect(bookingStatusOf(codigo)).toBe(esperado);
  });

  it('sin código: «pedida»', () => {
    expect(bookingStatusOf(undefined)).toBe('BOOKED');
  });
});

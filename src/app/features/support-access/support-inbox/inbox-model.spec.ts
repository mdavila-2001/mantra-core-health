import type { SupportInboxDoctor, SupportInboxItem } from '../../../core/data-access/support-access/support-inbox.types';
import { doctorColor } from '../combined-agenda/agenda-grouping';
import {
  doctorsWithConversations,
  elapsedText,
  filterInbox,
  formatDuration,
  inboxDoctorColor,
  INBOX_TABS,
  ownerText,
  slaOf,
  sortInbox,
  statusText,
  tabCounts,
  tabOf,
} from './inbox-model';

const AHORA = new Date('2026-10-30T12:00:00.000Z');
const enMin = (m: number): string => new Date(AHORA.getTime() + m * 60_000).toISOString();

function item(id: string, parcial: Partial<SupportInboxItem> = {}): SupportInboxItem {
  return {
    conversationId: id,
    organizationId: 't-1',
    organizationName: 'Hospital Piloto',
    practitionerProfileId: 'h-perez',
    doctorPublicProfileId: 'pub-perez',
    practitionerName: 'Dr. Pérez',
    patientLabel: 'Ana Lucía',
    lastMessagePreview: '¿Puedo cambiar mi cita?',
    lastMessageAt: enMin(-30),
    status: 'NEW',
    assignedToMe: false,
    isClinical: false,
    ...parcial,
  };
}

describe('pestañas de la bandeja', () => {
  it('cada estado cae en su pestaña; lo que tomó otra persona va a «Del equipo»', () => {
    expect(tabOf(item('a', { status: 'NEW' }))).toBe('NEW');
    expect(tabOf(item('b', { status: 'TAKEN', assignedToMe: true }))).toBe('MINE');
    expect(tabOf(item('c', { status: 'TAKEN', assignedToMe: false, assignedToName: 'Mariela' }))).toBe('TEAM');
    expect(tabOf(item('d', { status: 'WAITING_DOCTOR', assignedToMe: true }))).toBe('WAITING_DOCTOR');
    expect(tabOf(item('e', { status: 'RESOLVED' }))).toBe('RESOLVED');
  });

  it('lo derivado queda esperando al doctor aunque lo haya derivado quien mira', () => {
    expect(tabOf(item('d', { status: 'WAITING_DOCTOR', assignedToMe: false }))).toBe('WAITING_DOCTOR');
  });

  it('cuenta por pestaña, incluidas las que están en cero', () => {
    const cuentas = tabCounts([
      item('1'),
      item('2'),
      item('3', { status: 'TAKEN', assignedToMe: true }),
      item('4', { status: 'RESOLVED' }),
    ]);
    expect(cuentas).toEqual({ NEW: 2, MINE: 1, TEAM: 0, WAITING_DOCTOR: 0, RESOLVED: 1 });
    expect(INBOX_TABS).toHaveLength(5);
  });

  it('filtra por pestaña y por doctor, y «todos» no filtra', () => {
    const items = [
      item('1', { practitionerProfileId: 'h-perez' }),
      item('2', { practitionerProfileId: 'h-rojas' }),
      item('3', { status: 'RESOLVED', practitionerProfileId: 'h-perez' }),
    ];
    expect(filterInbox(items, { tab: 'NEW', doctor: '' }).map((i) => i.conversationId)).toEqual(['1', '2']);
    expect(filterInbox(items, { tab: 'NEW', doctor: 'h-rojas' }).map((i) => i.conversationId)).toEqual(['2']);
    expect(filterInbox(items, { tab: 'RESOLVED', doctor: 'h-rojas' })).toEqual([]);
  });
});

describe('plazo de respuesta (SLA)', () => {
  it('formatea duraciones cortas', () => {
    expect(formatDuration(0.2)).toBe('menos de 1 min');
    expect(formatDuration(35)).toBe('35 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(125)).toBe('2 h 5 min');
    expect(formatDuration(24 * 60)).toBe('1 día');
    expect(formatDuration(26 * 60)).toBe('1 día 2 h');
    expect(formatDuration(3 * 24 * 60)).toBe('3 días');
    expect(formatDuration(-45)).toBe('45 min');
  });

  it('con plazo lejano está bien, a media hora está por vencer y pasado el plazo está vencido', () => {
    expect(slaOf(item('a', { slaDueAt: enMin(95) }), AHORA)).toEqual({ kind: 'ok', minutes: 95, label: 'Vence en 1 h 35 min' });
    expect(slaOf(item('b', { slaDueAt: enMin(30) }), AHORA)).toMatchObject({ kind: 'soon', minutes: 30 });
    expect(slaOf(item('c', { slaDueAt: enMin(10) }), AHORA)).toMatchObject({ kind: 'soon' });
    expect(slaOf(item('d', { slaDueAt: enMin(-25) }), AHORA)).toEqual({ kind: 'overdue', minutes: 25, label: 'Vencida hace 25 min' });
  });

  it('justo en el plazo todavía no está vencido', () => {
    expect(slaOf(item('a', { slaDueAt: enMin(0) }), AHORA)).toMatchObject({ kind: 'soon', minutes: 0 });
  });

  it('lo resuelto no tiene plazo, y sin plazo declarado no se inventa uno', () => {
    expect(slaOf(item('a', { status: 'RESOLVED', slaDueAt: enMin(-500) }), AHORA)).toEqual({ kind: 'none' });
    expect(slaOf(item('b'), AHORA)).toEqual({ kind: 'none' });
    expect(slaOf(item('c', { slaDueAt: 'no es una fecha' }), AHORA)).toEqual({ kind: 'none' });
  });
});

describe('orden de la bandeja', () => {
  it('primero lo vencido (lo más atrasado arriba), luego lo que vence antes, al final lo sin plazo', () => {
    const ordenadas = sortInbox(
      [
        item('sin-plazo-viejo', { lastMessageAt: enMin(-600) }),
        item('vence-tarde', { slaDueAt: enMin(180) }),
        item('vencida-poco', { slaDueAt: enMin(-5) }),
        item('sin-plazo-nuevo', { lastMessageAt: enMin(-10) }),
        item('vence-pronto', { slaDueAt: enMin(20) }),
        item('vencida-mucho', { slaDueAt: enMin(-120) }),
      ],
      AHORA,
    );
    expect(ordenadas.map((i) => i.conversationId)).toEqual(['vencida-mucho', 'vencida-poco', 'vence-pronto', 'vence-tarde', 'sin-plazo-nuevo', 'sin-plazo-viejo']);
  });

  it('a igual plazo, lo clínico va antes', () => {
    const mismo = enMin(60);
    const ordenadas = sortInbox([item('admin', { slaDueAt: mismo }), item('clinica', { slaDueAt: mismo, isClinical: true })], AHORA);
    expect(ordenadas.map((i) => i.conversationId)).toEqual(['clinica', 'admin']);
  });

  it('no modifica la lista que recibe', () => {
    const original = [item('b', { slaDueAt: enMin(50) }), item('a', { slaDueAt: enMin(10) })];
    sortInbox(original, AHORA);
    expect(original.map((i) => i.conversationId)).toEqual(['b', 'a']);
  });
});

describe('doctores y color', () => {
  const doctores: SupportInboxDoctor[] = [
    { id: 'r-perez', practitionerProfileId: 'h-perez', name: 'Dr. Pérez', specialty: 'Cardiología' },
    { id: 'r-rojas', practitionerProfileId: 'h-rojas', name: 'Dra. Rojas', specialty: 'Ginecología' },
    { id: 'r-suarez', practitionerProfileId: 'h-suarez', name: 'Dr. Suárez', specialty: 'Pediatría' },
  ];

  it('el color es el de la agenda: sale de la misma posición en la lista de doctores', () => {
    const comoAgenda = doctores.map((d) => ({ id: d.id, name: d.name, specialty: d.specialty }));
    for (const d of doctores) {
      expect(inboxDoctorColor(doctores, d.practitionerProfileId)).toEqual(doctorColor(comoAgenda, d.id));
    }
    expect(inboxDoctorColor(doctores, 'h-perez')).not.toEqual(inboxDoctorColor(doctores, 'h-rojas'));
  });

  it('ofrece para filtrar solo a los doctores que tienen conversaciones', () => {
    const presentes = doctorsWithConversations(doctores, [item('1', { practitionerProfileId: 'h-rojas' }), item('2', { practitionerProfileId: 'h-rojas' })]);
    expect(presentes.map((d) => d.name)).toEqual(['Dra. Rojas']);
  });
});

describe('rótulos', () => {
  it('dice el estado y quién tiene la conversación', () => {
    expect(statusText('NEW')).toBe('Nueva');
    expect(statusText('WAITING_DOCTOR')).toBe('Esperando al doctor');
    expect(ownerText(item('a'))).toBe('Sin responsable');
    expect(ownerText(item('b', { status: 'TAKEN', assignedToMe: true }))).toBe('Responsable: usted');
    expect(ownerText(item('c', { status: 'TAKEN', assignedToName: 'Mariela Soliz' }))).toBe('Responsable: Mariela Soliz');
    expect(ownerText(item('d', { status: 'TAKEN' }))).toBe('Responsable: alguien del equipo');
  });

  it('dice cuánto pasó desde el último mensaje', () => {
    expect(elapsedText(enMin(-35), AHORA)).toBe('hace 35 min');
    expect(elapsedText(enMin(-200), AHORA)).toBe('hace 3 h 20 min');
    expect(elapsedText(AHORA.toISOString(), AHORA)).toBe('ahora');
    expect(elapsedText('nada', AHORA)).toBe('');
  });
});

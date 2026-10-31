import type { SupportAgenda, SupportAgendaItem } from '../../../core/data-access/support-access/support-access.types';
import { makeOrg, mergeAgendas, type AgendaData, type AgendaEvent } from './agenda-model';

/**
 * Constructores de datos para las pruebas de la agenda combinada. No es una
 * prueba: es lo que comparten, para que cada una diga solo lo que importa.
 */
export const HP = makeOrg('t-hp', 'Hospital Piloto Mantra', 0);
export const CESP = makeOrg('t-ce', 'Consultorio Dra. Paola Céspedes', 1);

export function item(id: string, parcial: Partial<SupportAgendaItem> = {}): SupportAgendaItem {
  return {
    id,
    kind: 'SLOT',
    start: '2026-11-03T13:00:00.000Z',
    end: '2026-11-03T13:30:00.000Z',
    practitionerRoleAssignmentId: 'd-1',
    careSpaceId: 'c-103',
    careSpaceName: 'Consultorio 103',
    healthcareServiceId: 's-1',
    serviceName: 'Consulta de cardiología',
    status: 'FREE',
    allowedActions: ['schedule.view', 'schedule.create', 'schedule.reschedule', 'schedule.cancel', 'schedule.confirm', 'schedule.check_in', 'schedule.walk_in', 'schedule.waitlist'],
    ...parcial,
  };
}

export function agenda(items: readonly SupportAgendaItem[], extra: Partial<SupportAgenda> = {}): SupportAgenda {
  return {
    doctors: [
      { id: 'd-1', name: 'Dr. Pérez', specialty: 'Cardiología' },
      { id: 'd-2', name: 'Dra. Rojas', specialty: 'Ginecología' },
    ],
    services: [{ id: 's-1', name: 'Consulta de cardiología' }],
    locations: [],
    items,
    ...extra,
  };
}

export function events(items: readonly SupportAgendaItem[], org = HP, extra: Partial<SupportAgenda> = {}): readonly AgendaEvent[] {
  return mergeAgendas([{ org, agenda: agenda(items, extra) }]).events;
}

export function data(items: readonly SupportAgendaItem[], extra: Partial<SupportAgenda> = {}): AgendaData {
  return mergeAgendas([{ org: HP, agenda: agenda(items, extra) }]);
}

/** Un evento ya con su organización, listo para probar acciones. */
export function event(id: string, parcial: Partial<SupportAgendaItem> = {}, org = HP): AgendaEvent {
  return events([item(id, parcial)], org)[0]!;
}

import type { SupportAgenda, SupportAgendaItem } from '../../data-access/support-access/support-access.types';
import type { WireSupportAgenda, WireSupportAgendaItem, WireSupportFreeSlots } from '../../data-access/support-access/support-agenda.wire';
import { BOOKING_STATUS } from '../fixtures/concepts';
import { DOCTORES_POR_TENANT } from '../fixtures/support-hospital';
import { isMockReply, type MockReply, type MockRequest } from '../mock-router';
import { uuid } from '../mock-store';
import { agendaDe } from './support-access.core';

/**
 * `GET /me/support-agenda` con la **forma de la API** (`SupportAgendaResponseDto`).
 *
 * La decisión de qué se ve y qué se puede hacer sale de `agendaDe` (la misma de siempre); acá solo se vuelve a escribir con los
 * nombres y el alcance del cable:
 *
 * - solo **citas** (los horarios libres no los da la API: ver {@link horariosLibres});
 * - el estado es un **concepto** (`statusConceptId`), y las canceladas no salen (la API no las muestra);
 * - los doctores son **perfiles profesionales**;
 * - los espacios y servicios son listas planas y salen solo de lo que la persona **ve** (con `schedule.view`);
 * - un bloque sin `schedule.view` no trae reserva, servicio, paciente ni motivo.
 */

const ESTADO_CONCEPTO: Readonly<Record<string, string | undefined>> = {
  BOOKED: BOOKING_STATUS['BK-REQUESTED'],
  CONFIRMED: BOOKING_STATUS['BK-CONFIRMED'],
  CHECKED_IN: BOOKING_STATUS['BK-CHECKED-IN'],
};

/** El perfil profesional de un doctor del simulador; el id de entrada si no se encuentra. */
function perfilDe(tenantId: string, doctorId: string): string {
  return (DOCTORES_POR_TENANT[tenantId] ?? []).find((d) => d.id === doctorId)?.practitionerProfileId ?? doctorId;
}

function esDeLaReserva(item: SupportAgendaItem): boolean {
  return item.status !== 'FREE' && item.status !== 'CANCELLED';
}

function citaDelCable(tenantId: string, item: SupportAgendaItem): WireSupportAgendaItem {
  const puedeVer = item.allowedActions.includes('schedule.view');
  return {
    ...(item.bookingId === undefined ? {} : { bookingId: item.bookingId }),
    ...(item.resourceId === undefined ? {} : { resourceId: item.resourceId }),
    practitionerProfileId: perfilDe(tenantId, item.practitionerRoleAssignmentId),
    startAt: item.start,
    endAt: item.end,
    statusConceptId: ESTADO_CONCEPTO[item.status]!,
    careSpaceId: item.careSpaceId,
    ...(item.healthcareServiceId === undefined ? {} : { healthcareServiceId: item.healthcareServiceId }),
    ...(puedeVer && item.patientLabel !== undefined ? { patientProfileId: uuid(`paciente-${item.patientLabel}`), patientName: item.patientLabel } : {}),
    ...(item.waitlistCount === undefined ? {} : { waitlistCount: item.waitlistCount }),
    allowedActions: item.allowedActions,
    ...(item.denialReason === undefined ? {} : { denialReason: item.denialReason }),
  };
}

function opcionesDelCable(tenantId: string, agenda: SupportAgenda, items: readonly SupportAgendaItem[]): Pick<WireSupportAgenda, 'doctors' | 'services' | 'locations'> {
  const doctores = new Set(items.map((i) => i.practitionerRoleAssignmentId));
  const servicios = new Set(items.map((i) => i.healthcareServiceId).filter((id): id is string => id !== undefined));
  const espacios = new Set(items.map((i) => i.careSpaceId));
  return {
    doctors: agenda.doctors.filter((d) => doctores.has(d.id)).map((d) => ({ practitionerProfileId: perfilDe(tenantId, d.id), displayName: d.name })),
    services: agenda.services.filter((s) => servicios.has(s.id)).map((s) => ({ id: s.id, name: s.name })),
    locations: agenda.locations.filter((l) => espacios.has(l.id)).map((l) => ({ id: l.id, name: l.name, code: l.name })),
  };
}

function tenantDeLaPeticion(request: MockRequest): string {
  return request.query.get('tenantId') ?? request.query.get('org') ?? '';
}

export function agendaReal(request: MockRequest): MockReply | WireSupportAgenda {
  const agenda = agendaDe(request);
  if (isMockReply(agenda)) return agenda;
  const tenantId = tenantDeLaPeticion(request);
  const citas = agenda.items.filter(esDeLaReserva);
  const vistas = citas.filter((i) => i.allowedActions.includes('schedule.view'));
  return { ...opcionesDelCable(tenantId, agenda, vistas), items: citas.map((i) => citaDelCable(tenantId, i)) };
}

/**
 * Solo del simulador: los horarios libres que el personal de apoyo puede ocupar. La API real no los ofrece a este rol
 * (`GET /scheduling/slots` no admite `SUPPORT_STAFF`); sin esto las pantallas de crear cita no se podrían probar en la demo.
 */
export function horariosLibres(request: MockRequest): MockReply | WireSupportFreeSlots {
  const agenda = agendaDe(request);
  if (isMockReply(agenda)) return agenda;
  const tenantId = tenantDeLaPeticion(request);
  const libres = agenda.items.filter((i) => i.status === 'FREE');
  return {
    ...opcionesDelCable(tenantId, agenda, libres),
    items: libres.map((i) => ({
      slotId: i.id,
      ...(i.resourceId === undefined ? {} : { resourceId: i.resourceId }),
      practitionerProfileId: perfilDe(tenantId, i.practitionerRoleAssignmentId),
      startAt: i.start,
      endAt: i.end,
      careSpaceId: i.careSpaceId,
      ...(i.healthcareServiceId === undefined ? {} : { healthcareServiceId: i.healthcareServiceId }),
      allowedActions: i.allowedActions,
      ...(i.denialReason === undefined ? {} : { denialReason: i.denialReason }),
    })),
  };
}

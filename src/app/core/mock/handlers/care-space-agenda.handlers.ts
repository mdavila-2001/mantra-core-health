import { intervalOf, overlaps } from '../../data-access/operating-rooms/operating-rooms.rules';
import { plantillas, recursos, reservas, type PlantillaSimulada } from '../fixtures/agenda';
import { BOOKING_STATUS } from '../fixtures/concepts';
import { FUNCIONES } from '../fixtures/infraestructura';
import type { MockReply, MockRequest } from '../mock-router';
import { Coleccion } from '../mock-store';
import { espacios } from './infrastructure.handlers';
import { conflictReply, notFoundReply, preconditionReply, tenantOf } from './operating-rooms.state';

/* ============================================================================
    Agenda de consultorios con el espacio — franja F5d (`CONTRATO-F2-F5.md`
    §F5d). La plantilla de horario declara su consultorio; la cita lo hereda
    (`appointments.care_space_id`) y dos citas de agendas distintas no pueden
    ocupar el mismo consultorio a la vez (`ex_appointments_care_space_time` →
    409 `CARE_SPACE_DOUBLE_BOOKED`).

    Los manejadores de agenda (`scheduling.handlers.ts`) llaman acá con una
    línea cada uno; el estado vive en este archivo.
    ========================================================================== */

/** Funciones que reciben consultorio en la plantilla (perfil `schedulable`). */
const SCHEDULABLE_ROOMS = new Set(['SPACE_FN_CONSULTING_ROOM', 'SPACE_FN_PROCEDURE_ROOM', 'SPACE_FN_IMAGING_ROOM']);

/** Los mismos dos estados de `ex_appointments_practitioner_time`: reservada y paciente presente. */
const LIVE_STATUSES = new Set([BOOKING_STATUS['BK-CONFIRMED']!, BOOKING_STATUS['BK-CHECKED-IN']!]);

type Rule = PlantillaSimulada['rules'][number];

interface TemplateSpace {
  readonly id: string;
  readonly resourceId: string;
  readonly careSpaceId: string;
  readonly rules: readonly Rule[];
}

interface AppointmentSpace {
  readonly id: string;
  readonly careSpaceId: string;
}

const templateSpaces = new Coleccion<TemplateSpace>([]);
const appointmentSpaces = new Coleccion<AppointmentSpace>([]);

const minutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const rulesOverlap = (a: Rule, b: Rule): boolean =>
  a.dayOfWeek === b.dayOfWeek && minutes(a.startTime) < minutes(b.endTime) && minutes(b.startTime) < minutes(a.endTime);

const liveTemplate = (t: TemplateSpace): boolean => plantillas.get(t.id)?.retired !== true;

/**
 * Valida el consultorio de una plantilla nueva, o `null` si está bien (o si no
 * se pidió ninguno). Mismo orden que la API: tenant (404), función (422),
 * sede (422), y otra plantilla en el mismo consultorio a la misma hora (422).
 */
export function validateTemplateSpace(request: MockRequest, resourceId: string, careSpaceId: string | undefined, rules: readonly Rule[]): MockReply | null {
  if (careSpaceId === undefined) return null;
  const space = espacios.get(careSpaceId);
  const tenant = tenantOf(request);
  if (space === undefined || (tenant !== null && tenant !== space.tenantId)) return notFoundReply();
  const profile = FUNCIONES.find((f) => f.code === space.functionCode);
  if (!SCHEDULABLE_ROOMS.has(space.functionCode) || profile?.schedulable !== true || profile.allowOverlap) {
    return preconditionReply('TEMPLATE_CARE_SPACE_INVALID_FUNCTION', `«${space.name}» no es un consultorio ni una sala que se agende.`);
  }
  const resource = recursos.get(resourceId);
  if (resource?.site !== null && resource?.site !== undefined && resource.site.id !== space.siteId) {
    return preconditionReply('TEMPLATE_CARE_SPACE_SITE_MISMATCH', `«${space.name}» es de otra sede que la agenda.`);
  }
  const clash = templateSpaces
    .filtrar((t) => t.careSpaceId === careSpaceId && t.resourceId !== resourceId && liveTemplate(t))
    .find((t) => t.rules.some((r) => rules.some((mine) => rulesOverlap(r, mine))));
  if (clash !== undefined) {
    return preconditionReply('TEMPLATE_RULE_OVERLAP_CARE_SPACE', `Otra agenda ya ocupa «${space.name}» en esos días y horas.`, { conflictingTemplateId: clash.id });
  }
  return null;
}

export function rememberTemplateSpace(templateId: string, resourceId: string, careSpaceId: string | undefined, rules: readonly Rule[]): void {
  if (careSpaceId !== undefined) templateSpaces.agregar({ id: templateId, resourceId, careSpaceId, rules });
}

/** El consultorio de la agenda a esa hora: el de su plantilla vigente que cubre el día y la hora. */
function spaceOfResourceAt(resourceId: string, startAt: string): string | null {
  const d = new Date(startAt);
  const day = d.getDay() === 0 ? 7 : d.getDay();
  const at = d.getHours() * 60 + d.getMinutes();
  const hit = templateSpaces
    .filtrar((t) => t.resourceId === resourceId && liveTemplate(t))
    .find((t) => t.rules.some((r) => r.dayOfWeek === day && minutes(r.startTime) <= at && at < minutes(r.endTime)));
  return hit?.careSpaceId ?? null;
}

/**
 * El consultorio que toma una cita nueva, o el 409 si ya lo ocupa otra cita
 * viva en ese rato (aunque sea de otra agenda: es lo que agrega la EXCLUDE).
 */
export function claimAppointmentSpace(resourceId: string, startAt: string, endAt: string): { careSpaceId: string | null } | MockReply {
  const careSpaceId = spaceOfResourceAt(resourceId, startAt);
  if (careSpaceId === null) return { careSpaceId: null };
  const mine = intervalOf(startAt, endAt);
  const clash = appointmentSpaces
    .filtrar((a) => a.careSpaceId === careSpaceId)
    .map((a) => reservas.get(a.id))
    .find((r) => r !== undefined && LIVE_STATUSES.has(r.statusConceptId) && overlaps(mine, intervalOf(r.startAt, r.endAt)));
  if (clash !== undefined) {
    const space = espacios.get(careSpaceId);
    return conflictReply('CARE_SPACE_DOUBLE_BOOKED', `«${space?.name ?? 'El consultorio'}» ya está ocupado a esa hora por otra cita.`, { careSpaceId, conflictingBookingId: clash.id });
  }
  return { careSpaceId };
}

export function rememberAppointmentSpace(bookingId: string, careSpaceId: string | null): void {
  if (careSpaceId !== null) appointmentSpaces.agregar({ id: bookingId, careSpaceId });
}

/** El consultorio de una cita, como lo devuelve la API. */
export function bookingCareSpace(bookingId: string): { id: string; code: string; name: string } | null {
  const row = appointmentSpaces.get(bookingId);
  const space = row === undefined ? undefined : espacios.get(row.careSpaceId);
  return space === undefined ? null : { id: space.id, code: space.code, name: space.name };
}

templateSpaces.persistirEn('mock.scheduling.templateSpaces');
appointmentSpaces.persistirEn('mock.scheduling.appointmentSpaces');

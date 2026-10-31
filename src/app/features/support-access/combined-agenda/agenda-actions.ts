import { SUPPORT_ACTION_LABELS, type SupportActionCode } from '../../../core/data-access/support-access/support-access.types';
import { clock, isVisible } from './agenda-grouping';
import { STATUS_TEXT, type AgendaEvent } from './agenda-model';

/**
 * Qué se le ofrece a la persona sobre un horario o una cita. Lógica pura.
 *
 * Las acciones **permitidas** salen de `allowedActions`, que la API ya resolvió
 * con `SupportAccessPolicy`: acá no se recalcula ningún permiso. Lo que sí se
 * decide acá es cuáles **tienen sentido** según el estado (no se «registra la
 * llegada» de un horario libre). Una acción se ofrece solo si es **las dos
 * cosas**; si tiene sentido pero no está permitida, no hay botón: hay una nota.
 */
export type EventAction = 'CREATE' | 'WALK_IN' | 'WAITLIST' | 'CONFIRM' | 'CHECK_IN' | 'RESCHEDULE' | 'CANCEL';

export interface ActionInfo {
  readonly id: EventAction;
  readonly code: SupportActionCode;
  /** Lo que dice el botón. */
  readonly label: string;
}

export const ACTIONS: Readonly<Record<EventAction, ActionInfo>> = {
  CREATE: { id: 'CREATE', code: 'schedule.create', label: 'Crear cita' },
  WALK_IN: { id: 'WALK_IN', code: 'schedule.walk_in', label: 'Atender sin cita' },
  WAITLIST: { id: 'WAITLIST', code: 'schedule.waitlist', label: 'Lista de espera' },
  CONFIRM: { id: 'CONFIRM', code: 'schedule.confirm', label: 'Confirmar cita' },
  CHECK_IN: { id: 'CHECK_IN', code: 'schedule.check_in', label: 'Registrar llegada' },
  RESCHEDULE: { id: 'RESCHEDULE', code: 'schedule.reschedule', label: 'Reprogramar' },
  CANCEL: { id: 'CANCEL', code: 'schedule.cancel', label: 'Cancelar cita' },
};

/** Las acciones que tienen sentido en cada estado, en el orden en que se ofrecen. */
const POR_ESTADO: Readonly<Record<AgendaEvent['status'], readonly EventAction[]>> = {
  FREE: ['CREATE', 'WALK_IN', 'WAITLIST'],
  BOOKED: ['CONFIRM', 'CHECK_IN', 'RESCHEDULE', 'CANCEL'],
  CONFIRMED: ['CHECK_IN', 'RESCHEDULE', 'CANCEL'],
  CHECKED_IN: [],
  CANCELLED: [],
};

function permitida(event: AgendaEvent, id: EventAction): boolean {
  return event.allowedActions.includes(ACTIONS[id].code);
}

/** Las acciones que se ofrecen: con sentido **y** permitidas. */
export function offeredActions(event: AgendaEvent): readonly ActionInfo[] {
  if (!isVisible(event)) return [];
  return POR_ESTADO[event.status].filter((id) => permitida(event, id)).map((id) => ACTIONS[id]);
}

/** Las que tendrían sentido pero el permiso no incluye: para decirlo con palabras, no para ofrecerlas. */
export function missingActions(event: AgendaEvent): readonly ActionInfo[] {
  if (!isVisible(event)) return [];
  return POR_ESTADO[event.status].filter((id) => !permitida(event, id)).map((id) => ACTIONS[id]);
}

/** «Su permiso en este horario no incluye crear citas y atender pacientes sin cita.» */
export function missingNote(event: AgendaEvent): string | null {
  const faltan = missingActions(event);
  if (faltan.length === 0) return null;
  const nombres = faltan.map((a) => SUPPORT_ACTION_LABELS[a.code].toLocaleLowerCase('es'));
  const lista = nombres.length === 1 ? nombres[0]! : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]!}`;
  return `Su permiso en este horario no incluye ${lista}.`;
}

/* ---- reprogramar ---------------------------------------------------------------- */

/** Una cita se puede arrastrar si está reservada o confirmada y el permiso incluye reprogramar. */
export function canDrag(event: AgendaEvent): boolean {
  return (event.status === 'BOOKED' || event.status === 'CONFIRMED') && isVisible(event) && permitida(event, 'RESCHEDULE');
}

export type DropVerdict =
  | { readonly ok: true; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly reason: string };

/**
 * Si se puede soltar `source` sobre `target`. La API vuelve a decidir (409/403/422):
 * esto es para que la persona **vea antes** por qué un horario no sirve, no para autorizar.
 */
export function dropVerdict(source: AgendaEvent, target: AgendaEvent, now: Date): DropVerdict {
  if (source.id === target.id) return { ok: false, reason: 'Es el mismo horario.' };
  if (target.status !== 'FREE') return { ok: false, reason: 'Ese horario ya tiene una cita. Suelte la cita sobre un horario libre.' };
  if (target.orgId !== source.orgId) {
    return { ok: false, reason: `Ese horario es de otra organización (${target.orgName}). Una cita no se mueve entre organizaciones.` };
  }
  if (!isVisible(target)) return { ok: false, reason: target.denialReason ?? 'No tiene permiso sobre ese horario.' };
  if (!permitida(target, 'RESCHEDULE')) return { ok: false, reason: 'Su permiso en ese horario no incluye reprogramar citas.' };
  // El servicio solo viene con `schedule.view`: sin él no se puede comprobar que sea el mismo.
  if (target.healthcareServiceId === undefined || source.healthcareServiceId === undefined) {
    return { ok: false, reason: 'No se puede comprobar el servicio de ese horario: su permiso no incluye ver la agenda ahí.' };
  }
  if (target.healthcareServiceId !== source.healthcareServiceId) {
    return { ok: false, reason: `Ese horario es de otro servicio (${target.serviceName}). Esta cita es de «${source.serviceName}».` };
  }
  if (new Date(target.start).getTime() <= now.getTime()) return { ok: false, reason: 'Ese horario ya pasó.' };
  const warnings: string[] = [];
  if (target.practitionerRoleAssignmentId !== source.practitionerRoleAssignmentId) {
    warnings.push(`Cambia de doctor: de ${source.doctorName} a ${target.doctorName}.`);
  }
  if (target.careSpaceId !== source.careSpaceId) {
    warnings.push(`Cambia de lugar: de ${source.careSpaceName} a ${target.careSpaceName}.`);
  }
  return { ok: true, warnings };
}

/** Los horarios libres a los que se puede mover una cita, para el selector del panel. */
export function rescheduleCandidates(source: AgendaEvent, events: readonly AgendaEvent[], now: Date, limit = 60): readonly AgendaEvent[] {
  return events
    .filter((e) => dropVerdict(source, e, now).ok)
    .sort((a, b) => {
      // Primero los del mismo doctor: es lo que casi siempre se quiere.
      const mismoA = a.practitionerRoleAssignmentId === source.practitionerRoleAssignmentId ? 0 : 1;
      const mismoB = b.practitionerRoleAssignmentId === source.practitionerRoleAssignmentId ? 0 : 1;
      return mismoA - mismoB || a.start.localeCompare(b.start);
    })
    .slice(0, limit);
}

export function whenText(event: AgendaEvent): string {
  const dia = new Date(event.start).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${dia}, ${clock(event.start)}`;
}

export interface PreviewLine {
  readonly label: string;
  readonly value: string;
}

/** La vista previa de la reprogramación: lo que había y lo que queda. Siempre dice en qué organización se actúa. */
export function reschedulePreview(source: AgendaEvent, target: AgendaEvent): readonly PreviewLine[] {
  const lineas: PreviewLine[] = [{ label: 'Organización', value: source.orgName }];
  lineas.push({ label: 'Paciente', value: source.patientLabel ?? 'Cita' });
  lineas.push({ label: 'Ahora', value: `${whenText(source)} · ${source.doctorName} · ${source.careSpaceName}` });
  lineas.push({ label: 'Pasa a', value: `${whenText(target)} · ${target.doctorName} · ${target.careSpaceName}` });
  return lineas;
}

/** Cómo se llama el estado de un evento, para el panel. */
export function statusText(event: AgendaEvent): string {
  return STATUS_TEXT[event.status];
}

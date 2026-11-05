import type {
  AccessRequestItem,
  AccessRequestKind,
  AccessRequestStatus,
} from '../../../core/data-access/authz/authz.types';
import type { ViewStateNextAction } from '../../../core/view-state/view-state.types';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';

/** Who is looking at the inbox: it decides the endpoint, the copy and the actions. */
export type InboxRole = 'patient' | 'practitioner';

export const KIND_LABEL: Readonly<Record<AccessRequestKind, string>> = {
  CABECERA: 'Médico de cabecera',
  GRANULAR: 'Por especialidad',
  ATENCION: 'Atención',
};

export const STATUS_LABEL: Readonly<Record<AccessRequestStatus, { label: string; tone: BadgeVariant }>> = {
  PENDING: { label: 'Pendiente', tone: 'warning' },
  ACTIVE: { label: 'Activa', tone: 'success' },
  REJECTED: { label: 'Rechazada', tone: 'secondary' },
  REVOKED: { label: 'Revocada', tone: 'secondary' },
  EXPIRED: { label: 'Vencida', tone: 'secondary' },
};

interface InboxCopy {
  readonly subtitle: string;
  readonly receivedEmpty: string;
  readonly sentEmpty: string;
  readonly historyEmpty: string;
  readonly emptyTitle: string;
  readonly emptyMessage: string;
  readonly emptyAction: ViewStateNextAction;
}

/** Spoken to the reader as «usted»; the practitioner is not told that he chooses areas. */
export const INBOX_COPY: Readonly<Record<InboxRole, InboxCopy>> = {
  patient: {
    subtitle:
      'Quién pidió ver su historia clínica, lo que usted pidió y lo que ya decidió. Usted elige qué autoriza y puede revocarlo.',
    receivedEmpty: 'No tiene solicitudes por responder.',
    sentEmpty: 'No tiene solicitudes enviadas esperando respuesta.',
    historyEmpty: 'Todavía no hay solicitudes decididas.',
    emptyTitle: 'No tiene solicitudes de acceso',
    emptyMessage: 'Cuando un profesional pida ver su historia clínica, la va a ver acá.',
    emptyAction: { label: 'Ver quién ve su historia', route: '/my-account/clinical-access' },
  },
  practitioner: {
    subtitle: 'Las solicitudes de acceso que envió a sus pacientes y las que ellos le enviaron a usted.',
    receivedEmpty: 'Ningún paciente le envió una solicitud por responder.',
    sentEmpty: 'No tiene solicitudes enviadas esperando respuesta.',
    historyEmpty: 'Todavía no hay solicitudes decididas.',
    emptyTitle: 'No hay solicitudes de acceso',
    emptyMessage: 'Para pedir acceso a la historia de un paciente, búsquelo en el Archivo clínico.',
    emptyAction: { label: 'Buscar un paciente', route: '/medical-records' },
  },
};

/** The three tabs: what waits for the reader, what waits for the other side, and what is decided. */
export function splitByTab(items: readonly AccessRequestItem[]) {
  return {
    received: items.filter((item) => item.status === 'PENDING' && item.direction === 'RECEIVED'),
    sent: items.filter((item) => item.status === 'PENDING' && item.direction === 'SENT'),
    history: items.filter((item) => item.status !== 'PENDING'),
  };
}

/** A specialty's name, never its id: the catalog may not know a retired concept. */
export function specialtyName(names: ReadonlyMap<string, string>, conceptId: string): string {
  return names.get(conceptId) ?? 'Especialidad sin nombre en el catálogo';
}

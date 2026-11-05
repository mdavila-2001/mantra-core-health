import { SUPPORT_ACTION_CODES, SUPPORT_ACTION_LABELS, type SupportActionCode, type SupportActivityEntry, type SupportActivityQuery } from './support-access.types';

/**
 * Lógica pura de las pantallas de **actividad del equipo de apoyo**: la de la
 * organización, la del doctor y «Mi actividad» de la propia persona.
 *
 * La bitácora la escribe la API **y la filtra ella** (persona, doctor, acción, fechas y
 * cursor): acá solo se dicen los códigos de acción en palabras, se arman las opciones de
 * los filtros y se mandan los parámetros.
 */

/** Los eventos que no son una acción de agenda: lo que pasa con el vínculo, los permisos y las invitaciones. */
const EVENT_LABELS: Readonly<Record<string, string>> = {
  'request.created': 'Pidió acceso',
  'request.decided': 'Se resolvió una solicitud',
  'grant.created': 'Se agregó un permiso',
  'grant.updated': 'Se cambió un permiso',
  'grant.revoked': 'Se retiró un permiso',
  'engagement.created': 'Se creó un vínculo',
  'engagement.recertified': 'Se confirmó un vínculo',
  'engagement.confirmed_by_person': 'La persona confirmó su vínculo',
  'engagement.suspended': 'Se suspendió un vínculo',
  'engagement.ended': 'Terminó un vínculo',
  'invitation.created': 'Se emitió una invitación',
  'invitation.redeemed': 'Se usó una invitación',
  'delegate.accepted': 'El doctor aceptó a una persona',
  'delegate.revoked': 'El doctor retiró a una persona',
  'clinical_access.approved': 'Acceso clínico autorizado',
  'clinical_access.denied': 'Acceso clínico negado',
  'clinical_access.requested': 'Pidió un acceso clínico',
  'patient.search': 'Buscó a un paciente',
  'session_policy.updated': 'Se cambiaron los controles de sesión',
};

/** El código dicho en palabras. Un código que no se conoce se muestra tal cual en vez de inventarle un nombre. */
export function activityActionLabel(action: string): string {
  const evento = EVENT_LABELS[action];
  if (evento !== undefined) return evento;
  if ((SUPPORT_ACTION_CODES as readonly string[]).includes(action)) return SUPPORT_ACTION_LABELS[action as SupportActionCode];
  return action;
}

export interface ActivityOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Las personas que aparecen en las entradas, para el filtro. El valor es el `userId`
 * (la API acepta el id o el nombre completo) y el rótulo, el nombre.
 */
export function personOptions(entries: readonly SupportActivityEntry[]): readonly ActivityOption[] {
  const porId = new Map<string, string>();
  for (const e of entries) if (e.userId !== '' && e.personName !== '') porId.set(e.userId, e.personName);
  return [...porId.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

/** Los doctores que aparecen. La API acepta su nombre completo; solo se ofrecen los que se pueden ver. */
export function doctorOptions(entries: readonly SupportActivityEntry[]): readonly ActivityOption[] {
  const nombres = new Set<string>();
  for (const e of entries) if (e.practitionerName !== undefined && e.practitionerName !== '') nombres.add(e.practitionerName);
  return [...nombres].sort((a, b) => a.localeCompare(b, 'es')).map((name) => ({ value: name, label: name }));
}

/** Las acciones que aparecen, con su nombre en palabras. */
export function actionOptions(entries: readonly SupportActivityEntry[]): readonly ActivityOption[] {
  const codigos = new Set<string>();
  for (const e of entries) if (e.action !== '') codigos.add(e.action);
  return [...codigos]
    .map((code) => ({ value: code, label: activityActionLabel(code) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

/** `YYYY-MM-DD` de un instante, en la hora local (la que ve la persona). */
export function localDay(value: string): string {
  const date = new Date(value);
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mes}-${dia}`;
}

/** Los parámetros que se mandan a la API: solo los que tienen valor. */
export function activityParams(query: SupportActivityQuery): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  if (query.person !== undefined && query.person !== '') out['person'] = query.person;
  if (query.doctor !== undefined && query.doctor !== '') out['doctor'] = query.doctor;
  if (query.action !== undefined && query.action !== '') out['action'] = query.action;
  if (query.from !== undefined && query.from !== '') out['from'] = query.from;
  if (query.to !== undefined && query.to !== '') out['to'] = query.to;
  if (query.userId !== undefined && query.userId !== '') out['userId'] = query.userId;
  if (query.tenantId !== undefined && query.tenantId !== '') out['tenantId'] = query.tenantId;
  if (query.limit !== undefined) out['limit'] = String(Math.min(200, Math.max(1, Math.trunc(query.limit))));
  if (query.cursor !== undefined && query.cursor !== '') out['cursor'] = query.cursor;
  return out;
}

/** Qué pantalla de actividad es, según la ruta con la que se abrió. */
export type ActivityAudience = 'org' | 'doctor' | 'person';

export function audienceOfPath(path: string): ActivityAudience {
  const limpia = path.replace(/^\/+/, '').split('?')[0] ?? '';
  if (limpia.startsWith('my-team')) return 'doctor';
  if (limpia.startsWith('my-support')) return 'person';
  return 'org';
}

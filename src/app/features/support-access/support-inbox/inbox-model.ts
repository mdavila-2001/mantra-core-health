import type { SupportAgendaDoctor } from '../../../core/data-access/support-access/support-access.types';
import type { ConversationAssignmentStatus, SupportInboxDoctor, SupportInboxItem } from '../../../core/data-access/support-access/support-inbox.types';
import { doctorColor } from '../combined-agenda/agenda-grouping';

/**
 * La lógica de la **bandeja** de la persona de apoyo, sin pantalla: en qué
 * pestaña cae cada conversación, en qué orden se atienden, cuánto falta para su
 * plazo y de qué color es cada doctor.
 *
 * Ninguna de estas reglas autoriza nada. La API ya decidió qué conversaciones
 * llegan y quién tiene cada una (`assignedToMe`); acá solo se ordenan y se
 * rotulan.
 */

/** Las pestañas de la bandeja. «Del equipo» son las que ya tomó otra persona. */
export const INBOX_TABS = ['NEW', 'MINE', 'TEAM', 'WAITING_DOCTOR', 'RESOLVED'] as const;
export type InboxTab = (typeof INBOX_TABS)[number];

export const INBOX_TAB_LABELS: Readonly<Record<InboxTab, string>> = {
  NEW: 'Nuevos',
  MINE: 'Míos',
  TEAM: 'Del equipo',
  WAITING_DOCTOR: 'Esperando al doctor',
  RESOLVED: 'Resueltos',
};

/** En qué pestaña vive una conversación. */
export function tabOf(item: Pick<SupportInboxItem, 'status' | 'assignedToMe'>): InboxTab {
  switch (item.status) {
    case 'NEW':
      return 'NEW';
    case 'TAKEN':
      return item.assignedToMe ? 'MINE' : 'TEAM';
    case 'WAITING_DOCTOR':
      return 'WAITING_DOCTOR';
    case 'RESOLVED':
      return 'RESOLVED';
  }
}

export function tabCounts(items: readonly Pick<SupportInboxItem, 'status' | 'assignedToMe'>[]): Readonly<Record<InboxTab, number>> {
  const cuentas: Record<InboxTab, number> = { NEW: 0, MINE: 0, TEAM: 0, WAITING_DOCTOR: 0, RESOLVED: 0 };
  for (const item of items) cuentas[tabOf(item)] += 1;
  return cuentas;
}

/* ---- el plazo de respuesta (SLA) ------------------------------------------------- */

/** Cuántos minutos antes del plazo se avisa que está por vencer. */
export const SLA_SOON_MINUTES = 30;

export type SlaState =
  | { readonly kind: 'none' }
  | { readonly kind: 'ok' | 'soon' | 'overdue'; readonly minutes: number; readonly label: string };

/** «35 min», «2 h 5 min», «1 día 3 h»: una duración corta, sin signo. */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(Math.abs(minutes)));
  if (total < 1) return 'menos de 1 min';
  if (total < 60) return `${total} min`;
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  if (horas < 24) return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
  const dias = Math.floor(horas / 24);
  const horasDelDia = horas % 24;
  const base = dias === 1 ? '1 día' : `${dias} días`;
  return horasDelDia === 0 ? base : `${base} ${horasDelDia} h`;
}

/**
 * Cuánto falta para el plazo de una conversación, y si ya venció.
 *
 * Lo resuelto no tiene plazo, y una conversación sin `slaDueAt` tampoco: no se
 * inventa uno. «Por vencer» son los últimos {@link SLA_SOON_MINUTES} minutos.
 */
export function slaOf(item: Pick<SupportInboxItem, 'status' | 'slaDueAt'>, now: Date): SlaState {
  if (item.status === 'RESOLVED' || item.slaDueAt === undefined) return { kind: 'none' };
  const due = new Date(item.slaDueAt).getTime();
  if (Number.isNaN(due)) return { kind: 'none' };
  const minutes = Math.round((due - now.getTime()) / 60_000);
  if (minutes < 0) return { kind: 'overdue', minutes: -minutes, label: `Vencida hace ${formatDuration(minutes)}` };
  return { kind: minutes <= SLA_SOON_MINUTES ? 'soon' : 'ok', minutes, label: `Vence en ${formatDuration(minutes)}` };
}

/* ---- el orden --------------------------------------------------------------------- */

/**
 * El orden en que se atiende: primero lo **vencido** (lo más atrasado arriba),
 * luego lo que tiene plazo (el que vence antes, primero), y al final lo que no
 * lo tiene, lo más reciente primero. A igual plazo, lo clínico va antes: es lo
 * que más urge llevarle al doctor.
 */
export function sortInbox<T extends Pick<SupportInboxItem, 'status' | 'slaDueAt' | 'lastMessageAt' | 'isClinical'>>(items: readonly T[], now: Date): readonly T[] {
  const rango = (item: T): number => {
    const estado = slaOf(item, now);
    if (estado.kind === 'none') return 2;
    return estado.kind === 'overdue' ? 0 : 1;
  };
  return [...items].sort((a, b) => {
    const porRango = rango(a) - rango(b);
    if (porRango !== 0) return porRango;
    if (rango(a) < 2) {
      const porPlazo = new Date(a.slaDueAt!).getTime() - new Date(b.slaDueAt!).getTime();
      if (porPlazo !== 0) return porPlazo;
      if (a.isClinical !== b.isClinical) return a.isClinical ? -1 : 1;
    }
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
}

/* ---- filtros ----------------------------------------------------------------------- */

export interface InboxFilter {
  readonly tab: InboxTab;
  /** `practitionerProfileId` del doctor, o `''` para todos. */
  readonly doctor: string;
}

export function filterInbox<T extends Pick<SupportInboxItem, 'status' | 'assignedToMe' | 'practitionerProfileId'>>(items: readonly T[], filter: InboxFilter): readonly T[] {
  return items.filter((item) => tabOf(item) === filter.tab && (filter.doctor === '' || item.practitionerProfileId === filter.doctor));
}

/** Los doctores con al menos una conversación, en el orden de la agenda. */
export function doctorsWithConversations(doctors: readonly SupportInboxDoctor[], items: readonly Pick<SupportInboxItem, 'practitionerProfileId'>[]): readonly SupportInboxDoctor[] {
  const presentes = new Set(items.map((item) => item.practitionerProfileId));
  return doctors.filter((d) => presentes.has(d.practitionerProfileId));
}

/**
 * El color de un doctor: **el mismo que en la agenda combinada**. Sale de su
 * posición en la lista que la API ordena igual en las dos pantallas, así que no
 * hay una paleta aparte que mantener.
 */
export function inboxDoctorColor(doctors: readonly SupportInboxDoctor[], practitionerProfileId: string): { readonly fondo: string; readonly borde: string } {
  const comoAgenda: readonly SupportAgendaDoctor[] = doctors.map((d) => ({ id: d.practitionerProfileId, name: d.name, specialty: d.specialty }));
  return doctorColor(comoAgenda, practitionerProfileId);
}

/* ---- rótulos ------------------------------------------------------------------------ */

export function statusText(status: ConversationAssignmentStatus): string {
  switch (status) {
    case 'NEW':
      return 'Nueva';
    case 'TAKEN':
      return 'En curso';
    case 'WAITING_DOCTOR':
      return 'Esperando al doctor';
    case 'RESOLVED':
      return 'Resuelta';
  }
}

/** Quién tiene la conversación, en una frase para la fila. */
export function ownerText(item: Pick<SupportInboxItem, 'status' | 'assignedToMe' | 'assignedToName'>): string {
  if (item.status === 'NEW') return 'Sin responsable';
  if (item.assignedToMe) return 'Responsable: usted';
  return item.assignedToName === undefined ? 'Responsable: alguien del equipo' : `Responsable: ${item.assignedToName}`;
}

/** «hace 35 min», «hace 3 h», «hace 2 días»: cuánto pasó desde un instante. */
export function elapsedText(value: string, now: Date): string {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  const minutes = Math.round((now.getTime() - time) / 60_000);
  if (minutes < 1) return 'ahora';
  return `hace ${formatDuration(minutes)}`;
}

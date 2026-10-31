import type { SupportEngagement } from '../../../core/data-access/support-access/support-access.types';
import type { TeamMember } from '../../../core/data-access/access-governance/access-governance.types';

/* ============================================================================
    Las personas con nombre: los casos, los traspasos y los dueños de cuenta llegan con `userId`; la pantalla los muestra
    con el nombre que ya trae el equipo de apoyo. Puro: sin red.
   ========================================================================== */

export interface Person {
  readonly userId: string;
  readonly name: string;
  readonly engagementId?: string;
  /** `ACTIVE`, `SUSPENDED`, `ENDED`… tal como lo usan las pantallas. */
  readonly status?: string;
}

export function peopleOfEngagements(engagements: readonly SupportEngagement[]): readonly Person[] {
  return engagements.map((e) => ({
    userId: e.userId,
    name: e.personName,
    engagementId: e.id,
    status: e.status,
  }));
}

export function peopleOfMembers(members: readonly TeamMember[]): readonly Person[] {
  return members.map((m) => ({
    userId: m.userId,
    name: m.personName ?? 'Una persona',
    engagementId: m.engagementId,
    status: m.status,
  }));
}

/** El nombre de una persona; si no se conoce, una palabra neutra (nunca el identificador). */
export function nameOfUser(
  people: readonly Person[],
  userId: string | undefined,
  me?: Person,
): string {
  if (userId === undefined) return '—';
  if (me !== undefined && me.userId === userId) return me.name;
  return people.find((p) => p.userId === userId)?.name ?? 'Otra persona';
}

export interface PersonOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Quién puede recibir trabajo o ser dueño de una cuenta: las personas con vínculo vigente (sin la que se va) y quien
 * está haciendo el trámite, primero. La API decide si cada una es elegible (422 `HANDOVER_TARGET_INELIGIBLE`,
 * `OWNER_NOT_ELIGIBLE`).
 */
export function recipientOptions(
  people: readonly Person[],
  excludeUserId: string | undefined,
  me: Person | null,
): readonly PersonOption[] {
  const seen = new Set<string>();
  const options: PersonOption[] = [];
  if (me !== null && me.userId !== excludeUserId) {
    options.push({ value: me.userId, label: `Yo (${me.name})` });
    seen.add(me.userId);
  }
  for (const p of people) {
    if (
      p.userId === excludeUserId ||
      seen.has(p.userId) ||
      (p.status !== undefined && p.status !== 'ACTIVE')
    )
      continue;
    seen.add(p.userId);
    options.push({ value: p.userId, label: p.name });
  }
  return options;
}

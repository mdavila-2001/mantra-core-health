import type { SupportEngagement } from './support-access.types';

/**
 * Lógica pura de la **recertificación**: cada 6 o 12 meses hay que confirmar que
 * una persona sigue ayudando a la organización. Sin confirmación, a los 15 días
 * de vencida, el vínculo se **suspende**: no se pierde ni se borra, pero deja de
 * regir hasta que la organización lo reactive.
 *
 * El plazo y el aviso son del contrato; quien suspende es la API. Esto solo
 * clasifica lo que la API devolvió para poder avisar a tiempo.
 */

/** Los días de gracia que siguen al vencimiento antes de suspender. */
export const GRACE_DAYS = 15;
/** Desde cuántos días antes del vencimiento se empieza a avisar. */
export const NOTICE_DAYS = 30;

const DAY_MS = 86_400_000;

export type ReviewStatus =
  /** Falta más de un mes: nada que hacer. */
  | 'OK'
  /** Vence dentro del mes. */
  | 'DUE_SOON'
  /** Ya venció y sigue activo: corre el plazo de gracia. */
  | 'OVERDUE'
  /** Se suspendió por no confirmarse. */
  | 'SUSPENDED'
  /** No entra en la revisión: terminó o todavía no empezó. */
  | 'NOT_APPLICABLE';

export interface ReviewInfo {
  readonly status: ReviewStatus;
  /** Cuándo vence la recertificación. */
  readonly dueAt?: Date;
  /** Cuándo se suspende si nadie la confirma. */
  readonly suspendsAt?: Date;
  /** Días hasta el vencimiento; negativo si ya venció. */
  readonly daysToDue?: number;
  /** Días hasta la suspensión; cero o negativo si el plazo se agotó. */
  readonly daysToSuspension?: number;
}

function daysBetween(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / DAY_MS);
}

export function classifyReview(engagement: Pick<SupportEngagement, 'status' | 'nextRecertificationAt'>, now: Date = new Date()): ReviewInfo {
  if (engagement.status === 'ENDED' || engagement.status === 'PENDING') return { status: 'NOT_APPLICABLE' };
  const due = engagement.nextRecertificationAt === undefined ? null : new Date(engagement.nextRecertificationAt);
  if (due === null || Number.isNaN(due.getTime())) {
    return engagement.status === 'SUSPENDED' ? { status: 'SUSPENDED' } : { status: 'NOT_APPLICABLE' };
  }
  const suspendsAt = new Date(due.getTime() + GRACE_DAYS * DAY_MS);
  const base = { dueAt: due, suspendsAt, daysToDue: daysBetween(due, now), daysToSuspension: daysBetween(suspendsAt, now) };
  if (engagement.status === 'SUSPENDED') return { status: 'SUSPENDED', ...base };
  if (base.daysToDue > NOTICE_DAYS) return { status: 'OK', ...base };
  if (base.daysToDue >= 0) return { status: 'DUE_SOON', ...base };
  return { status: 'OVERDUE', ...base };
}

/** Los estados que piden que alguien haga algo. */
export function needsAttention(info: ReviewInfo): boolean {
  return info.status === 'DUE_SOON' || info.status === 'OVERDUE' || info.status === 'SUSPENDED';
}

export function reviewStatusText(status: ReviewStatus): string {
  switch (status) {
    case 'OK':
      return 'Al día';
    case 'DUE_SOON':
      return 'Por vencer';
    case 'OVERDUE':
      return 'Vencido';
    case 'SUSPENDED':
      return 'Suspendido';
    case 'NOT_APPLICABLE':
      return '—';
  }
}

function dayText(value: Date): string {
  return value.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function plural(n: number, uno: string, varios: string): string {
  return n === 1 ? uno : varios;
}

/** Lo que se le dice a quien administra: cuándo vence y qué pasa si no se confirma. */
export function reviewHeadline(info: ReviewInfo): string {
  const { status, dueAt, suspendsAt, daysToDue, daysToSuspension } = info;
  switch (status) {
    case 'DUE_SOON':
      return daysToDue === 0
        ? 'La confirmación vence hoy.'
        : `La confirmación vence en ${daysToDue} ${plural(daysToDue ?? 0, 'día', 'días')} (${dayText(dueAt!)}).`;
    case 'OVERDUE':
      return (daysToSuspension ?? 0) > 0
        ? `Venció el ${dayText(dueAt!)}. Si nadie lo confirma, se suspende en ${daysToSuspension} ${plural(daysToSuspension ?? 0, 'día', 'días')}.`
        : `Venció el ${dayText(dueAt!)} y el plazo para confirmarlo ya se agotó: queda suspendido.`;
    case 'SUSPENDED':
      return suspendsAt === undefined
        ? 'Suspendido por no confirmarse a tiempo. No puede actuar hasta que se reactive.'
        : `Suspendido desde el ${dayText(suspendsAt)} por no confirmarse a tiempo. No puede actuar hasta que se reactive.`;
    case 'OK':
      return `Al día. Próxima confirmación: ${dayText(dueAt!)}.`;
    case 'NOT_APPLICABLE':
      return '';
  }
}

/** Lo que la persona ya declaró, para no volver a pedírselo. */
export interface PersonDeclaration {
  readonly lastConfirmedAt?: string;
  readonly lastConfirmedBy?: 'PERSON' | 'ORGANIZATION';
}

/**
 * ¿La persona ya declaró que sigue trabajando en esta organización **en este ciclo**?
 * Cuenta su última confirmación si la hizo ella y cae dentro del aviso de este
 * vencimiento; si la organización renueva el vínculo, la confirmación pasa a ser de
 * la organización y el aviso se apaga solo.
 */
export function declaredAt(info: ReviewInfo, declaration: PersonDeclaration): Date | null {
  if (declaration.lastConfirmedBy !== 'PERSON' || declaration.lastConfirmedAt === undefined || info.dueAt === undefined) return null;
  const cuando = new Date(declaration.lastConfirmedAt);
  if (Number.isNaN(cuando.getTime())) return null;
  return cuando.getTime() >= info.dueAt.getTime() - NOTICE_DAYS * DAY_MS ? cuando : null;
}

export interface PersonNotice {
  readonly tone: 'info' | 'warning' | 'error';
  readonly title: string;
  readonly text: string;
  /** Ofrece «Confirmar que sigo trabajando aquí». */
  readonly canConfirm: boolean;
  /** Ya declaró que sigue trabajando aquí: se le dice y no se le vuelve a pedir. */
  readonly declared: boolean;
}

/**
 * Lo que se le dice a la propia persona de apoyo. `null` si no hay nada que avisar.
 *
 * La persona **no renueva su vínculo**: solo declara «sigo trabajando aquí». Renovarlo
 * y reactivarlo es de la organización, así que un vínculo suspendido no ofrece ningún
 * botón y dice a quién pedirlo. (La API de hoy deja que la persona reactive uno
 * suspendido; la decisión de producto es que no pueda, y la pantalla ya está así.)
 */
export function personNotice(info: ReviewInfo, declaration: PersonDeclaration = {}): PersonNotice | null {
  const { status, dueAt, suspendsAt, daysToDue, daysToSuspension } = info;
  const yaDeclaro = declaredAt(info, declaration);
  if (status === 'DUE_SOON' || status === 'OVERDUE') {
    if (yaDeclaro !== null) {
      return {
        tone: 'info',
        title: 'Ya avisó que sigue trabajando aquí',
        text: `Lo declaró el ${dayText(yaDeclaro)}. Falta que su organización renueve el vínculo${
          status === 'OVERDUE' && suspendsAt !== undefined ? ` antes del ${dayText(suspendsAt)}` : dueAt === undefined ? '' : ` antes del ${dayText(dueAt)}`
        }: si no lo hace, se suspende. Si le urge, avísele a quien administra la organización.`,
        canConfirm: false,
        declared: true,
      };
    }
    if (status === 'DUE_SOON') {
      return {
        tone: 'info',
        title: 'Confirme que sigue trabajando aquí',
        text:
          (daysToDue === 0 ? 'Su vínculo vence hoy.' : `Su vínculo vence el ${dayText(dueAt!)}.`) +
          ' Al confirmar le avisa a la organización que sigue trabajando aquí; la que renueva el vínculo es la organización. Si no lo renueva dentro de los 15 días siguientes al vencimiento, se suspende y usted deja de poder actuar.',
        canConfirm: true,
        declared: false,
      };
    }
    return {
      tone: 'warning',
      title: 'Su vínculo está vencido',
      text:
        ((daysToSuspension ?? 0) > 0 ? `Si su organización no lo renueva antes del ${dayText(suspendsAt!)}, ese día se suspende y usted deja de poder actuar.` : 'El plazo para renovarlo se agotó.') +
        ' Confirme que sigue trabajando aquí para avisarle: la que renueva el vínculo es la organización.',
      canConfirm: true,
      declared: false,
    };
  }
  if (status === 'SUSPENDED') {
    return {
      tone: 'error',
      title: 'Suspendido: pida a su organización que lo renueve',
      text:
        'Su vínculo no se renovó a tiempo, así que usted no puede actuar en esta organización. Solo la organización puede renovarlo: pídaselo a quien administra su personal. Cuando lo renueve, vuelve a regir sin que usted haga nada.',
      canConfirm: false,
      declared: false,
    };
  }
  return null;
}

/** Ordena lo más urgente primero: suspendidos, vencidos, por vencer y, dentro de cada uno, el vencimiento más cercano. */
export function sortByUrgency<T extends { readonly info: ReviewInfo }>(rows: readonly T[]): readonly T[] {
  const rank: Readonly<Record<ReviewStatus, number>> = { SUSPENDED: 0, OVERDUE: 1, DUE_SOON: 2, OK: 3, NOT_APPLICABLE: 4 };
  return [...rows].sort((a, b) => {
    const porEstado = rank[a.info.status] - rank[b.info.status];
    if (porEstado !== 0) return porEstado;
    return (a.info.dueAt?.getTime() ?? Infinity) - (b.info.dueAt?.getTime() ?? Infinity);
  });
}

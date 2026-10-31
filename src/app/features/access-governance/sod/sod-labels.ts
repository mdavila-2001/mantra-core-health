import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import {
  SOD_ACTION_LABELS,
  SOD_SCOPE_LABELS,
  type SodAction,
  type SodException,
  type SodFinding,
  type SodRule,
} from '../../../core/data-access/access-governance/governance-rules.types';
import { atomMeta } from '../../../core/data-access/support-access/support-atoms';

/* ============================================================================
    Palabras de la pantalla «Separación de funciones»: lógica pura, sin Angular.
    La API habla con códigos; la persona, con oraciones (CONTRATO-GOBIERNO §9.1).
   ========================================================================== */

/** Los marcadores que usan las reglas de plataforma en lugar de un permiso (`SOD-GOV-01`). */
const MARCADORES: Readonly<Record<string, string>> = {
  '@request': 'pedir un acceso',
  '@decide': 'decidir ese mismo acceso',
};

/** El nombre en lenguaje simple de un permiso; si no se conoce, su código. */
export function atomLabel(code: string): string {
  return MARCADORES[code] ?? atomMeta(code)?.name ?? code;
}

/** «A», «A o B», «A, B o C». */
export function joinWithOr(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} o ${items[items.length - 1]!}`;
}

/** La regla en una sola oración: qué dos cosas no deberían reunirse y dónde. */
export function describeSodRule(rule: Pick<SodRule, 'atomsA' | 'atomsB' | 'scope'>): string {
  const a = joinWithOr(rule.atomsA.map((atom) => `«${atomLabel(atom)}»`));
  const b = joinWithOr(rule.atomsB.map((atom) => `«${atomLabel(atom)}»`));
  const donde =
    rule.scope === 'PERSON'
      ? 'en una misma persona'
      : rule.scope === 'PERSON_OVERLAP'
        ? 'sobre un mismo doctor o servicio'
        : 'en una misma operación';
  return `No conviene reunir ${a} con ${b} ${donde}.`;
}

export function sodActionText(action: SodAction): string {
  return SOD_ACTION_LABELS[action];
}

/** Bloquear es lo más serio (rojo), pedir aprobación pide atención (ámbar) y avisar informa (azul). El texto siempre acompaña. */
export function sodActionTone(action: SodAction): BadgeVariant {
  return action === 'BLOCK' ? 'error' : action === 'REQUIRE_APPROVAL' ? 'warning' : 'info';
}

export function sodScopeText(scope: SodRule['scope']): string {
  return SOD_SCOPE_LABELS[scope];
}

/** Qué hace la regla con quien la incumple, dicho como consecuencia. */
export function sodActionConsequence(rule: Pick<SodRule, 'action' | 'isHard'>): string {
  if (rule.action === 'BLOCK')
    return rule.isHard
      ? 'Se bloquea y no admite excepciones.'
      : 'Se bloquea, salvo con una excepción aprobada.';
  if (rule.action === 'REQUIRE_APPROVAL')
    return 'Necesita una excepción aprobada por otra persona.';
  return 'Se avisa y aparece en el tablero.';
}

export function findingOutcomeText(
  finding: Pick<SodFinding, 'outcome' | 'exceptionValidTo'>,
): string {
  if (finding.outcome === 'EXCEPTION_ACTIVE')
    return finding.exceptionValidTo === undefined
      ? 'Con excepción vigente'
      : `Con excepción vigente hasta el ${formatDay(finding.exceptionValidTo)}`;
  if (finding.outcome === 'CONFLICT') return 'Conflicto sin resolver';
  return 'En revisión';
}

export function findingOutcomeTone(finding: Pick<SodFinding, 'outcome'>): BadgeVariant {
  return finding.outcome === 'EXCEPTION_ACTIVE'
    ? 'info'
    : finding.outcome === 'CONFLICT'
      ? 'error'
      : 'warning';
}

/** `2026-12-31` o una fecha ISO → «31/12/2026». */
export function formatDay(value: string): string {
  const day = value.slice(0, 10).split('-');
  return day.length === 3 ? `${day[2]}/${day[1]}/${day[0]}` : value;
}

const DIA_EN_MS = 86_400_000;

/** Días enteros hasta una fecha (negativo si ya pasó). */
export function daysUntil(value: string, now: Date): number {
  const end = new Date(`${value.slice(0, 10)}T23:59:59`).getTime();
  return Math.ceil((end - now.getTime()) / DIA_EN_MS);
}

/** Una excepción que vence en dos semanas o menos se marca «Vence pronto». */
export const EXPIRING_SOON_DAYS = 14;

export function exceptionStatusText(
  exception: Pick<SodException, 'status' | 'validTo'>,
  now: Date,
): string {
  switch (exception.status) {
    case 'PENDING':
      return 'Esperando aprobación';
    case 'ACTIVE': {
      const dias = daysUntil(exception.validTo, now);
      if (dias < 0) return 'Vencida';
      if (dias <= EXPIRING_SOON_DAYS)
        return dias === 0 ? 'Vence hoy' : dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`;
      return `Vigente hasta el ${formatDay(exception.validTo)}`;
    }
    case 'REVOKED':
      return 'Revocada';
    case 'EXPIRED':
      return 'Vencida';
    case 'REJECTED':
      return 'Rechazada';
    default:
      return exception.status;
  }
}

export function exceptionStatusTone(
  exception: Pick<SodException, 'status' | 'validTo'>,
  now: Date,
): BadgeVariant {
  if (exception.status === 'ACTIVE')
    return daysUntil(exception.validTo, now) <= EXPIRING_SOON_DAYS ? 'warning' : 'success';
  if (exception.status === 'PENDING') return 'info';
  return 'secondary';
}

/** Las excepciones que se pueden revocar: las que siguen vivas. */
export function isRevocable(exception: Pick<SodException, 'status'>): boolean {
  return exception.status === 'ACTIVE' || exception.status === 'PENDING';
}

/** El último día que admite una excepción de esta regla, en `YYYY-MM-DD`. */
export function maxExceptionDate(
  rule: Pick<SodRule, 'maxExceptionDays'> | undefined,
  now: Date,
  fallbackDays = 90,
): string {
  const dias = rule?.maxExceptionDays ?? fallbackDays;
  const fin = new Date(now.getTime() + dias * DIA_EN_MS);
  return `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`;
}

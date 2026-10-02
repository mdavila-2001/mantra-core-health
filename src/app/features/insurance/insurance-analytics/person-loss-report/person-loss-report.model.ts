import type { ReceivedClaim } from '../../../../core/data-access/insurance/insurance.types';

/**
 * Informe de siniestralidad **por persona**, armado con las solicitudes que la
 * aseguradora recibió.
 *
 * ## De dónde sale cada número
 *
 * - **Facturado**: suma de `billedTotal` de las solicitudes de la persona.
 * - **Aprobado**: suma de `approvedTotal` de las **dictaminadas**.
 * - **Denegado**: facturado − aprobado, **sólo de las dictaminadas**. Una
 *   solicitud pendiente no es una denegación: se cuenta aparte.
 * - **Prima del periodo**: prima mensual de lista del plan × meses del periodo.
 *   Es una estimación, igual que la «prima neta devengada» del tablero; si el
 *   plan no tiene prima registrada, la siniestralidad es `null` («sin prima»)
 *   y **nunca** 0 %.
 * - **Siniestralidad**: aprobado ÷ prima del periodo.
 *
 * ## Importes sin `float`
 *
 * Llegan como cadenas decimales y se suman en enteros (`BigInt`, 4 decimales de
 * escala): sumar `0.1 + 0.2` con `Number` es exactamente el error que una
 * pantalla contable no se puede permitir.
 *
 * ## Una sola moneda
 *
 * Un informe suma importes de una moneda. Si el periodo trae solicitudes en
 * varias, se informa la más frecuente y las demás se **cuentan** en
 * `excludedOtherCurrencyCount`, que la pantalla dice en voz alta.
 */

/** La prima de lista de un plan, para estimar la prima del periodo. */
export interface PlanPremium {
  readonly name: string;
  readonly monthlyPremiumAmount: string | null;
}

export interface PersonLossReportQuery {
  /** `YYYY-MM-DD`, fecha civil. `null` = sin límite: desde la primera solicitud («Todo»). */
  readonly startDate: string | null;
  /** `YYYY-MM-DD`, fecha civil. */
  readonly endDate: string;
  /** Nombre del plan a filtrar; `null` para todos. */
  readonly planName: string | null;
  readonly plans: readonly PlanPremium[];
}

export interface PersonLossRow {
  readonly personId: string;
  readonly name: string;
  /** Identificador de afiliado, o el código de paciente; vacío si no tiene. */
  readonly memberCode: string;
  readonly planName: string;
  readonly claimsCount: number;
  readonly pendingCount: number;
  readonly billedAmount: string;
  readonly approvedAmount: string;
  readonly deniedAmount: string;
  /** Aprobado ÷ facturado de las dictaminadas; `null` si ninguna lo está. */
  readonly approvalRatePercent: string | null;
  readonly premiumAmount: string | null;
  /** `null` = no computable (sin prima). Nunca `'0.0'`. */
  readonly lossRatioPercent: string | null;
}

export interface PersonLossReport {
  /** El inicio efectivo del periodo: el pedido, o el de la primera solicitud si no hubo límite. */
  readonly startDate: string;
  readonly endDate: string;
  readonly currencyCode: string | null;
  readonly rows: readonly PersonLossRow[];
  readonly claimsConsidered: number;
  readonly excludedOtherCurrencyCount: number;
}

const SCALE = 10_000n;
const NAMELESS = 'Sin nombre registrado';
const NO_PLAN = '—';
const DAYS_PER_MONTH = 30.4375;
const MS_PER_DAY = 86_400_000;

const laPazDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/La_Paz',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Fecha civil (`YYYY-MM-DD`) de un instante, en `America/La_Paz`. */
export function civilDateOf(instant: Date): string {
  return laPazDay.format(instant);
}

/** `'123.45'` → `1234500n`. Hasta 4 decimales; lo que sobre se descarta. */
export function toScaled(amount: string): bigint {
  const trimmed = amount.trim();
  const negative = trimmed.startsWith('-');
  const [whole = '0', fraction = ''] = trimmed.replace(/^[-+]/, '').split('.');
  const digits = BigInt(whole === '' ? '0' : whole) * SCALE;
  const decimals = BigInt((fraction + '0000').slice(0, 4));
  const value = digits + decimals;
  return negative ? -value : value;
}

/** Escala → texto con 2 decimales, redondeo half-up. */
export function formatScaled(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const cents = (abs + 50n) / 100n;
  const text = `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
  return negative ? `-${text}` : text;
}

/** `numerador ÷ denominador × 100` con un decimal, half-up. `null` si el denominador no es > 0. */
export function percentOf(numerator: bigint, denominator: bigint): string | null {
  if (denominator <= 0n) return null;
  const tenths = (numerator * 2000n + denominator) / (2n * denominator);
  return `${tenths / 10n}.${tenths % 10n}`;
}

function planSegment(planName: string | null): string | null {
  if (planName === null) return null;
  return planName.split(' · ').at(-1) ?? planName;
}

/** Meses entre dos fechas civiles, inclusivas, con la duración media del mes. */
export function monthsBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const days = Math.max(1, Math.round((end - start) / MS_PER_DAY) + 1);
  return days / DAYS_PER_MONTH;
}

function dominantCurrency(claims: readonly ReceivedClaim[]): string | null {
  const counts = new Map<string | null, number>();
  for (const claim of claims) {
    const code = claim.billedTotal.currency?.code ?? null;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

interface Accumulator {
  readonly personId: string;
  name: string;
  memberCode: string;
  latestAt: string;
  planName: string | null;
  claimsCount: number;
  pendingCount: number;
  billed: bigint;
  approved: bigint;
  adjudicatedBilled: bigint;
}

export function buildPersonLossReport(
  claims: readonly ReceivedClaim[],
  query: PersonLossReportQuery,
): PersonLossReport {
  const inScope = claims.filter((claim) => {
    if (claim.submittedAt === null) return false;
    const day = civilDateOf(claim.submittedAt);
    if ((query.startDate !== null && day < query.startDate) || day > query.endDate) return false;
    return query.planName === null || planSegment(claim.planName) === query.planName;
  });

  const currencyCode = dominantCurrency(inScope);
  const sameCurrency = inScope.filter(
    (claim) => (claim.billedTotal.currency?.code ?? null) === currencyCode,
  );

  const byPerson = new Map<string, Accumulator>();
  for (const claim of sameCurrency) {
    const day = civilDateOf(claim.submittedAt!);
    const found = byPerson.get(claim.patient.id);
    const acc: Accumulator = found ?? {
      personId: claim.patient.id,
      name: claim.patient.displayName ?? NAMELESS,
      memberCode: claim.patient.memberIdentifier ?? claim.patient.patientCode ?? '',
      latestAt: '',
      planName: null,
      claimsCount: 0,
      pendingCount: 0,
      billed: 0n,
      approved: 0n,
      adjudicatedBilled: 0n,
    };
    acc.claimsCount += 1;
    const billed = toScaled(claim.billedTotal.amount);
    acc.billed += billed;
    if (claim.approvedTotal === null) {
      acc.pendingCount += 1;
    } else {
      acc.approved += toScaled(claim.approvedTotal.amount);
      acc.adjudicatedBilled += billed;
    }
    // El plan de la persona es el de su solicitud más reciente.
    if (day >= acc.latestAt) {
      acc.latestAt = day;
      acc.planName = planSegment(claim.planName);
    }
    byPerson.set(acc.personId, acc);
  }

  const premiums = new Map(
    query.plans.map((plan) => [plan.name, plan.monthlyPremiumAmount] as const),
  );
  const earliest = [...byPerson.values()].reduce(
    (min, acc) => (min === '' || acc.latestAt < min ? acc.latestAt : min),
    '',
  );
  // Sin límite de inicio («Todo») la prima corre desde la primera solicitud
  // real, no desde una fecha que nadie eligió.
  const effectiveStart = query.startDate ?? (earliest === '' ? query.endDate : earliest);
  const monthsHundredths = BigInt(Math.round(monthsBetween(effectiveStart, query.endDate) * 100));

  const rows = [...byPerson.values()].map((acc): PersonLossRow => {
    const monthly = acc.planName === null ? null : (premiums.get(acc.planName) ?? null);
    const premium = monthly === null ? null : (toScaled(monthly) * monthsHundredths) / 100n;
    const denied = acc.adjudicatedBilled - acc.approved;
    return {
      personId: acc.personId,
      name: acc.name,
      memberCode: acc.memberCode,
      planName: acc.planName ?? NO_PLAN,
      claimsCount: acc.claimsCount,
      pendingCount: acc.pendingCount,
      billedAmount: formatScaled(acc.billed),
      approvedAmount: formatScaled(acc.approved),
      deniedAmount: formatScaled(denied < 0n ? 0n : denied),
      approvalRatePercent: percentOf(acc.approved, acc.adjudicatedBilled),
      premiumAmount: premium === null ? null : formatScaled(premium),
      lossRatioPercent: premium === null ? null : percentOf(acc.approved, premium),
    };
  });

  rows.sort(
    (a, b) =>
      (b.lossRatioPercent === null ? -1 : Number(b.lossRatioPercent)) -
        (a.lossRatioPercent === null ? -1 : Number(a.lossRatioPercent)) ||
      Number(b.approvedAmount) - Number(a.approvedAmount) ||
      a.name.localeCompare(b.name, 'es'),
  );

  return {
    startDate: effectiveStart,
    endDate: query.endDate,
    currencyCode,
    rows,
    claimsConsidered: sameCurrency.length,
    excludedOtherCurrencyCount: inScope.length - sameCurrency.length,
  };
}

export type LossRatioTone = 'success' | 'warning' | 'error' | 'secondary';

/** Semáforo de la siniestralidad: verde < 75 %, ámbar 75–85 %, rojo > 85 %; gris si no es computable. */
export function lossRatioTone(percent: string | null): LossRatioTone {
  if (percent === null) return 'secondary';
  const value = Number(percent);
  if (value < 75) return 'success';
  if (value <= 85) return 'warning';
  return 'error';
}

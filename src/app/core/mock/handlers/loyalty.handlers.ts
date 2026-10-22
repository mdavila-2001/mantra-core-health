import { NOMBRE_PROGRAMA_PUNTOS } from '../../data-access/loyalty/loyalty.types';
import { PACIENTE } from '../fixtures/people';
import { conflict, preconditionFailed, reply, validation, type MockRequest, type MockRouter } from '../mock-router';
import { Coleccion, iso, nuevoId, uuid } from '../mock-store';

/* ============================================================================
    El portal de lealtad del paciente: `GET /loyalty/me`,
    `GET /loyalty/me/points` y `POST /loyalty/me/points/redeem` (R-T-E6B1).

    Mismas reglas que `PromotionsLoyaltyService`: el titular sale del token
    —nunca de la petición—, no estar inscrito es un 200 con `enrolled: false`,
    el ledger se lee del más nuevo al más viejo por cursor, el saldo nunca queda
    negativo y el canje es idempotente por `idempotencyKey`.

    Sólo la paciente de la maqueta tiene membresía: es la cuenta con la que se
    recorre la billetera. El resto de los pacientes ve el vacío honesto del
    portal, que también es un estado que hay que poder mostrar.
    ========================================================================== */

/** Lo que la API publica por página cuando no se pide `limit`. */
const ENTRIES_PER_PAGE = 20;

interface MembershipRecord {
  readonly id: string;
  readonly patientProfileId: string;
  readonly pointsBalance: string;
  readonly lifetimePoints: string;
  readonly enrolledAt: string;
  readonly active: boolean;
}

interface LedgerEntryRecord {
  readonly id: string;
  readonly membershipId: string;
  readonly direction: 'POINTS_EARN' | 'POINTS_REDEEM' | 'POINTS_EXPIRE' | 'POINTS_ADJUST';
  readonly points: string;
  readonly reason: 'REASON_SIGNUP' | 'REASON_EVENT' | 'REASON_REDEMPTION' | 'REASON_EXPIRY' | 'REASON_REFERRAL' | 'REASON_MANUAL';
  readonly balanceAfter: string;
  readonly expiresAt: string | null;
  readonly occurredAt: string;
  readonly idempotencyKey: string | null;
}

/** Los niveles del programa, del más bajo al más alto, por puntos de por vida. */
const TIERS = [
  { code: 'BRONZE', name: 'Bronce', multiplier: '1.00', minPoints: '0.00' },
  { code: 'SILVER', name: 'Plata', multiplier: '1.25', minPoints: '1000.00' },
  { code: 'GOLD', name: 'Oro', multiplier: '1.50', minPoints: '5000.00' },
] as const;

function tierFor(lifetimePoints: string) {
  return [...TIERS].reverse().find((tier) => Number(lifetimePoints) >= Number(tier.minPoints));
}

const PATIENT_MEMBERSHIP_ID = uuid('loyalty-membership-paciente');

/**
 * El historial sembrado, del más viejo al más nuevo: alta, compras en la red,
 * un referido, un canje y un vencimiento. Cada `balanceAfter` es el saldo que
 * dejó ese movimiento, así que el saldo de la membresía es el del último.
 */
function seedLedger(): LedgerEntryRecord[] {
  const moves: readonly (readonly [LedgerEntryRecord['direction'], number, LedgerEntryRecord['reason']])[] = [
    ['POINTS_EARN', 200, 'REASON_SIGNUP'],
    ['POINTS_EARN', 120, 'REASON_EVENT'],
    ['POINTS_EARN', 85, 'REASON_EVENT'],
    ['POINTS_EARN', 300, 'REASON_REFERRAL'],
    ['POINTS_EARN', 150, 'REASON_EVENT'],
    ['POINTS_REDEEM', 400, 'REASON_REDEMPTION'],
    ['POINTS_EARN', 95, 'REASON_EVENT'],
    ['POINTS_EARN', 210, 'REASON_EVENT'],
    ['POINTS_EXPIRE', 50, 'REASON_EXPIRY'],
    ['POINTS_EARN', 130, 'REASON_EVENT'],
    ['POINTS_EARN', 75, 'REASON_EVENT'],
    ['POINTS_EARN', 180, 'REASON_EVENT'],
    ['POINTS_REDEEM', 250, 'REASON_REDEMPTION'],
    ['POINTS_EARN', 60, 'REASON_EVENT'],
    ['POINTS_EARN', 140, 'REASON_EVENT'],
    ['POINTS_ADJUST', 25, 'REASON_MANUAL'],
    ['POINTS_EARN', 110, 'REASON_EVENT'],
    ['POINTS_EARN', 90, 'REASON_EVENT'],
    ['POINTS_EARN', 160, 'REASON_EVENT'],
    ['POINTS_EARN', 70, 'REASON_EVENT'],
    ['POINTS_EARN', 115, 'REASON_EVENT'],
    ['POINTS_EARN', 45, 'REASON_EVENT'],
  ];
  let balance = 0;
  return moves.map(([direction, points, reason], index) => {
    balance += direction === 'POINTS_REDEEM' || direction === 'POINTS_EXPIRE' ? -points : points;
    const daysAgo = (moves.length - index) * 9;
    return {
      id: uuid(`loyalty-entry-${index}`),
      membershipId: PATIENT_MEMBERSHIP_ID,
      direction,
      points: points.toFixed(2),
      reason,
      balanceAfter: balance.toFixed(2),
      // Los puntos ganados vencen al año; los demás movimientos no vencen.
      expiresAt: direction === 'POINTS_EARN' ? iso(365 - daysAgo) : null,
      occurredAt: iso(-daysAgo, 10 + (index % 8)),
      idempotencyKey: null,
    };
  });
}

const ledger = new Coleccion<LedgerEntryRecord>(seedLedger());

/** Los de por vida suman todo lo ganado; gastar o vencer no los baja. */
function seededLifetime(entries: readonly LedgerEntryRecord[]): string {
  return entries
    .filter((entry) => entry.direction === 'POINTS_EARN' || entry.direction === 'POINTS_ADJUST')
    .reduce((sum, entry) => sum + Number(entry.points), 0)
    .toFixed(2);
}

const memberships = new Coleccion<MembershipRecord>([
  {
    id: PATIENT_MEMBERSHIP_ID,
    patientProfileId: PACIENTE.id,
    pointsBalance: ledger.todos().at(-1)!.balanceAfter,
    lifetimePoints: seededLifetime(ledger.todos()),
    enrolledAt: iso(-(22 * 9) - 1, 9),
    active: true,
  },
]);

/** El perfil de paciente del token, o el 422 que la API responde sin él. */
function ownPatientProfileId(request: MockRequest): string | null {
  return request.user?.patientProfileId ?? null;
}

function ownMembership(patientProfileId: string): MembershipRecord | undefined {
  return memberships.todos().find((m) => m.patientProfileId === patientProfileId);
}

export function registerLoyalty(router: MockRouter): void {
  router.get('/loyalty/me', (request) => {
    const patientProfileId = ownPatientProfileId(request);
    if (patientProfileId === null) return preconditionFailed('La cuenta no tiene perfil de paciente');
    const membership = ownMembership(patientProfileId);
    if (membership === undefined) return { enrolled: false };
    const tier = tierFor(membership.lifetimePoints);
    return {
      enrolled: true,
      membership: {
        membershipId: membership.id,
        programName: NOMBRE_PROGRAMA_PUNTOS,
        pointsCurrencyName: 'puntos',
        pointsBalance: membership.pointsBalance,
        lifetimePoints: membership.lifetimePoints,
        ...(tier === undefined ? {} : { tier: { ...tier } }),
        enrolledAt: membership.enrolledAt,
        active: membership.active,
      },
    };
  });

  router.get('/loyalty/me/points', (request) => {
    const patientProfileId = ownPatientProfileId(request);
    if (patientProfileId === null) return preconditionFailed('La cuenta no tiene perfil de paciente');
    const membership = ownMembership(patientProfileId);
    // Sin membresía no hay movimientos: el mismo vacío honesto del saldo.
    if (membership === undefined) return { entries: [] };

    const limit = Math.min(100, Math.max(1, Number(request.query.get('limit') ?? ENTRIES_PER_PAGE) || ENTRIES_PER_PAGE));
    const cursor = request.query.get('cursor');
    const from = cursor === null ? 0 : decodeCursor(cursor);
    if (from === null) return validation('Cursor inválido', [{ field: 'cursor', message: 'must be a valid cursor' }]);

    const ordered = ledger
      .filtrar((entry) => entry.membershipId === membership.id)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id));
    const page = ordered.slice(from, from + limit);
    const next = from + limit;
    return {
      entries: page.map((entry) => ({
        entryId: entry.id,
        direction: entry.direction,
        points: entry.points,
        reason: entry.reason,
        balanceAfter: entry.balanceAfter,
        ...(entry.expiresAt === null ? {} : { expiresAt: entry.expiresAt }),
        occurredAt: entry.occurredAt,
      })),
      ...(next < ordered.length ? { nextCursor: encodeCursor(next) } : {}),
    };
  });

  /**
   * El canje propio. Orden de las comprobaciones, como en la API: perfil de
   * paciente, membresía, clave de otra membresía (409), puntos positivos,
   * repetición de la clave (misma respuesta con `duplicate: true`), membresía
   * activa y saldo suficiente (422 con `pointsBalance` y `requested`, que es lo
   * que el cliente lee para decir «te alcanza hasta…»).
   */
  router.post('/loyalty/me/points/redeem', (request) => {
    const patientProfileId = ownPatientProfileId(request);
    if (patientProfileId === null) return preconditionFailed('La cuenta no tiene perfil de paciente');
    const membership = ownMembership(patientProfileId);
    if (membership === undefined) return preconditionFailed('No tiene una membresía de lealtad en este programa');

    const body = (request.body ?? {}) as { points?: unknown; idempotencyKey?: unknown };
    const invalid = [
      ...(typeof body.points === 'string' && /^\d+(\.\d+)?$/.test(body.points) ? [] : [{ field: 'points', message: 'must be a number string' }]),
      ...(typeof body.idempotencyKey === 'string' && body.idempotencyKey !== '' && body.idempotencyKey.length <= 200
        ? []
        : [{ field: 'idempotencyKey', message: 'must be a string shorter than or equal to 200 characters' }]),
    ];
    if (invalid.length > 0) return validation('El canje no es válido', invalid);
    const points = body.points as string;
    const idempotencyKey = body.idempotencyKey as string;

    const previous = ledger.todos().find((entry) => entry.idempotencyKey === idempotencyKey);
    if (previous !== undefined && previous.membershipId !== membership.id) {
      return conflict('La clave de idempotencia pertenece a otro canje', { idempotencyKey });
    }
    if (Number(points) <= 0) return preconditionFailed('El canje debe ser de puntos positivos', { points });
    if (previous !== undefined) {
      const current = memberships.get(previous.membershipId)!;
      return reply(201, redeemResponse(previous, current, true));
    }
    if (!membership.active) return preconditionFailed('La membresía no está activa', { membershipId: membership.id });

    const balance = Number(membership.pointsBalance);
    if (balance < Number(points)) {
      return preconditionFailed('Saldo de puntos insuficiente', {
        membershipId: membership.id,
        pointsBalance: membership.pointsBalance,
        requested: points,
      });
    }

    const balanceAfter = (balance - Number(points)).toFixed(2);
    const entry: LedgerEntryRecord = {
      id: nuevoId('loyalty-entry'),
      membershipId: membership.id,
      direction: 'POINTS_REDEEM',
      points: Number(points).toFixed(2),
      reason: 'REASON_REDEMPTION',
      balanceAfter,
      expiresAt: null,
      occurredAt: new Date().toISOString(),
      idempotencyKey,
    };
    ledger.agregar(entry);
    // Canjear no descuenta los de por vida: el nivel mide lealtad, no saldo.
    const updated = memberships.actualizar(membership.id, { pointsBalance: balanceAfter })!;
    return reply(201, redeemResponse(entry, updated, false));
  });
}

function redeemResponse(entry: LedgerEntryRecord, membership: MembershipRecord, duplicate: boolean) {
  const tier = tierFor(membership.lifetimePoints);
  return {
    ledgerEntryId: entry.id,
    membershipId: membership.id,
    points: entry.points,
    balanceAfter: entry.balanceAfter,
    lifetimePoints: membership.lifetimePoints,
    ...(tier === undefined ? {} : { currentTierId: uuid(`loyalty-tier-${tier.code}`) }),
    duplicate,
  };
}

/** El cursor es opaco para el cliente: la posición, en base64url. */
function encodeCursor(position: number): string {
  return btoa(JSON.stringify({ position })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCursor(cursor: string): number | null {
  try {
    const parsed = JSON.parse(atob(cursor.replace(/-/g, '+').replace(/_/g, '/'))) as { position?: unknown };
    return typeof parsed.position === 'number' && Number.isInteger(parsed.position) && parsed.position >= 0 ? parsed.position : null;
  } catch {
    return null;
  }
}

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
memberships.persistirEn('mock.loyalty.memberships');
ledger.persistirEn('mock.loyalty.ledger');

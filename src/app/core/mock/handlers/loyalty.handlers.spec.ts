import { HttpHeaders } from '@angular/common/http';

import { PACIENTES } from '../fixtures/people';
import { MockRouter, isMockReply, preconditionFailed, validation, type MockMethod } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registerLoyalty } from './loyalty.handlers';

/**
 * El estado HTTP de cada familia de rechazo sale de los ayudantes del
 * simulador y no se escribe a mano: `mockup` todavía responde las
 * precondiciones con 412 y la validación con 422, y `test` ya con 422 y 400
 * (H2.S1.M2). La prueba fija la familia, no el número de una rama.
 */
const PRECONDITION = preconditionFailed('').status;
const INVALID = validation('').status;

/**
 * El portal de lealtad del paciente (`/loyalty/me*`, R-T-E6B1).
 *
 * - **correcto**: la paciente de la maqueta tiene membresía, nivel y un ledger
 *   que se recorre por cursor; canjear baja el saldo y deja el movimiento.
 * - **límite**: la misma clave de idempotencia devuelve el mismo canje con
 *   `duplicate: true` y no descuenta dos veces; canjear el saldo entero deja 0.
 * - **inválido**: otro paciente no está inscrito (200 con `enrolled: false`),
 *   una cuenta sin perfil de paciente es 422, el saldo insuficiente es 422 con
 *   el saldo y lo pedido, y un cuerpo malformado es 400.
 */
describe('portal de lealtad del paciente (/loyalty/me)', () => {
  const router = new MockRouter();
  registerLoyalty(router);
  const patient = buscarUsuario('paciente')!;

  interface Result<T> {
    readonly status: number;
    readonly body: T;
  }

  function call<T>(method: MockMethod, path: string, options: { body?: unknown; query?: string; user?: MockUser } = {}): Result<T> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(options.query ?? ''),
      body: options.body ?? null,
      headers: new HttpHeaders(),
      user: options.user ?? patient,
    });
    return isMockReply(result) ? { status: result.status, body: result.body as T } : { status: 200, body: result as T };
  }

  interface Me {
    readonly enrolled: boolean;
    readonly membership?: { membershipId: string; pointsBalance: string; lifetimePoints: string; tier?: { code: string }; active: boolean };
  }

  interface LedgerPage {
    readonly entries: readonly { entryId: string; direction: string; points: string; reason: string; balanceAfter: string; occurredAt: string }[];
    readonly nextCursor?: string;
  }

  interface Redeemed {
    readonly ledgerEntryId: string;
    readonly balanceAfter: string;
    readonly duplicate: boolean;
  }

  it('correcto — la paciente está inscrita, con saldo, puntos de por vida y nivel', () => {
    const me = call<Me>('GET', '/loyalty/me').body;

    expect(me.enrolled).toBe(true);
    expect(Number(me.membership!.pointsBalance)).toBeGreaterThan(0);
    expect(Number(me.membership!.lifetimePoints)).toBeGreaterThanOrEqual(Number(me.membership!.pointsBalance));
    expect(me.membership!.tier?.code).toBe('SILVER');
    expect(me.membership!.active).toBe(true);
  });

  it('correcto — el ledger viene del más nuevo al más viejo y se recorre entero por cursor', () => {
    const first = call<LedgerPage>('GET', '/loyalty/me/points').body;
    expect(first.entries).toHaveLength(20);
    expect(first.nextCursor).toBeDefined();
    const dates = first.entries.map((e) => e.occurredAt);
    expect([...dates].sort().reverse()).toEqual(dates);

    const second = call<LedgerPage>('GET', '/loyalty/me/points', { query: `cursor=${first.nextCursor}` }).body;
    expect(second.entries.length).toBeGreaterThan(0);
    expect(second.nextCursor).toBeUndefined();
    const ids = new Set([...first.entries, ...second.entries].map((e) => e.entryId));
    expect(ids.size).toBe(first.entries.length + second.entries.length);
  });

  it('correcto — canjear baja el saldo y deja el movimiento arriba del ledger', () => {
    const before = Number(call<Me>('GET', '/loyalty/me').body.membership!.pointsBalance);

    const redeemed = call<Redeemed>('POST', '/loyalty/me/points/redeem', { body: { points: '100', idempotencyKey: 'canje-1' } });

    expect(redeemed.status).toBe(201);
    expect(redeemed.body.duplicate).toBe(false);
    expect(Number(redeemed.body.balanceAfter)).toBe(before - 100);
    expect(Number(call<Me>('GET', '/loyalty/me').body.membership!.pointsBalance)).toBe(before - 100);
    const [latest] = call<LedgerPage>('GET', '/loyalty/me/points').body.entries;
    expect(latest).toEqual(expect.objectContaining({ entryId: redeemed.body.ledgerEntryId, direction: 'POINTS_REDEEM', reason: 'REASON_REDEMPTION' }));
  });

  it('límite — la misma clave devuelve el mismo canje y no descuenta dos veces', () => {
    const request = { body: { points: '50', idempotencyKey: 'canje-repetido' } };
    const first = call<Redeemed>('POST', '/loyalty/me/points/redeem', request);
    const balance = call<Me>('GET', '/loyalty/me').body.membership!.pointsBalance;

    const second = call<Redeemed>('POST', '/loyalty/me/points/redeem', request);

    expect(second.status).toBe(201);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.ledgerEntryId).toBe(first.body.ledgerEntryId);
    expect(call<Me>('GET', '/loyalty/me').body.membership!.pointsBalance).toBe(balance);
  });

  it('límite — canjear exactamente el saldo lo deja en cero, nunca negativo', () => {
    const balance = call<Me>('GET', '/loyalty/me').body.membership!.pointsBalance;

    const redeemed = call<Redeemed>('POST', '/loyalty/me/points/redeem', { body: { points: balance, idempotencyKey: 'canje-todo' } });

    expect(redeemed.status).toBe(201);
    expect(redeemed.body.balanceAfter).toBe('0.00');
  });

  it('inválido — saldo insuficiente es una precondición con el saldo y lo pedido, que el cliente lee', () => {
    const balance = call<Me>('GET', '/loyalty/me').body.membership!.pointsBalance;

    const refused = call<{ code: string; details: { pointsBalance: string; requested: string } }>('POST', '/loyalty/me/points/redeem', {
      body: { points: '999999', idempotencyKey: 'canje-imposible' },
    });

    expect(refused.status).toBe(PRECONDITION);
    expect(refused.body.code).toBe('PRECONDITION_FAILED');
    expect(refused.body.details).toEqual(expect.objectContaining({ pointsBalance: balance, requested: '999999' }));
  });

  it('inválido — cero puntos es una precondición y un cuerpo sin clave no valida', () => {
    expect(call('POST', '/loyalty/me/points/redeem', { body: { points: '0', idempotencyKey: 'canje-cero' } }).status).toBe(PRECONDITION);
    expect(call('POST', '/loyalty/me/points/redeem', { body: { points: '10' } }).status).toBe(INVALID);
    expect(call('POST', '/loyalty/me/points/redeem', { body: { points: 'diez', idempotencyKey: 'k' } }).status).toBe(INVALID);
  });

  it('inválido — otro paciente no está inscrito: 200 con enrolled false y ledger vacío', () => {
    const other: MockUser = { ...patient, id: 'otro-usuario', patientProfileId: PACIENTES[1]!.id };

    expect(call<Me>('GET', '/loyalty/me', { user: other })).toEqual({ status: 200, body: { enrolled: false } });
    expect(call<LedgerPage>('GET', '/loyalty/me/points', { user: other }).body).toEqual({ entries: [] });
    expect(call('POST', '/loyalty/me/points/redeem', { user: other, body: { points: '1', idempotencyKey: 'k-otro' } }).status).toBe(PRECONDITION);
  });

  it('inválido — una cuenta sin perfil de paciente es una precondición, no un 403', () => {
    const medica = buscarUsuario('medica')!;

    expect(call('GET', '/loyalty/me', { user: medica }).status).toBe(PRECONDITION);
  });

  it('inválido — un cursor que no emitió el servidor no valida', () => {
    expect(call('GET', '/loyalty/me/points', { query: 'cursor=basura' }).status).toBe(INVALID);
  });
});

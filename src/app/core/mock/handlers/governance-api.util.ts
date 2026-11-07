import { reply, validation, type MockReply, type MockRequest } from '../mock-router';

/* Shared helpers of the simulated governance API (pagination by cursor, date range,
   code validation, business rejections with a stable `reason`). Split out of
   governance.handlers.ts, which is frozen by check-max-lines. */

const DAY_MS = 86_400_000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_WINDOW_DAYS = 30;

function pageSize(req: MockRequest): number | MockReply {
  const raw = req.query.get('limit');
  if (raw === null) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    return validation('Error de validación', [{ field: 'limit', message: `must not be greater than ${MAX_LIMIT}` }]);
  }
  return n;
}

/** Cursor opaco: la posición siguiente, como la API la codifica a su manera. */
export function paginate<T>(items: readonly T[], req: MockRequest): MockReply | { items: readonly T[]; nextCursor: string | null; limit: number } {
  const limit = pageSize(req);
  if (typeof limit !== 'number') return limit;
  const start = Number(req.query.get('cursor') ?? '0') || 0;
  const slice = items.slice(start, start + limit);
  const next = start + limit < items.length ? String(start + limit) : null;
  return { items: slice, nextCursor: next, limit };
}

/** El rango de la consulta. Sin rango, los últimos 30 días, como la API. */
export function inRange(req: MockRequest): (iso: string) => boolean {
  const from = req.query.get('from');
  const to = req.query.get('to');
  const lower = from ? Date.parse(from) : from === null && to === null ? Date.now() - DEFAULT_WINDOW_DAYS * DAY_MS : -Infinity;
  const upper = to ? Date.parse(to) : Infinity;
  return (iso) => {
    const t = Date.parse(iso);
    return t >= lower && t < upper;
  };
}

export function invalidCode(req: MockRequest, key: string, allowed: ReadonlySet<string>): MockReply | null {
  const value = req.query.get(key);
  return value !== null && !allowed.has(value)
    ? validation('Error de validación', [{ field: key, message: `must be one of the following values: ${[...allowed].join(', ')}` }])
    : null;
}

export const byNewest = (a: { recordedAt: string }, b: { recordedAt: string }) => b.recordedAt.localeCompare(a.recordedAt);

/** Un rechazo de negocio con su motivo estable en la raíz del cuerpo, como la API. */
export function withReason(base: MockReply, reason: string): MockReply {
  return reply(base.status, { ...(base.body as Record<string, unknown>), reason });
}

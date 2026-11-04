import { reply, validationPipeRejected, type MockHandler, type MockRequest, type MockRouter } from '../mock-router';
import { UNIDADES } from './diagnostics.handlers';

/* ============================================================================
    Real-API parity for the lab portal simulator (04/11/2026).

    The API published `/diagnostics/lab/*` with a few rules the original
    simulator did not have. They are layered here with `router.wrap` so the
    frozen `lab-portal.handlers.ts` does not grow:

    - `GET /result-files` rejects `q` (no PHI in URLs); the search goes through
      `POST /result-files/search` with the same filters in the body.
    - An upload is tied to an order, weighs at most 10 MB and is one of the
      allowed document/image types; anything else is a 422.
    - `notified` is always `false`: the API does not notify yet.
    - `CANCEL` is not supported, and `REJECT` needs a specimen (labs only).
    ========================================================================== */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unprocessableWithCode(code: string, message: string): ReturnType<typeof reply> {
  return reply(422, { statusCode: 422, code, message });
}

/** Marks every returned result file as not notified, like the API. */
function withoutNotification(result: unknown): unknown {
  if (result === null || typeof result !== 'object' || !('items' in result)) return result;
  const page = result as { items: readonly Record<string, unknown>[] };
  return { ...page, items: page.items.map((item) => ({ ...item, notified: false })) };
}

/** Guards run before validation in the API: a non-center account still gets its 403 first. */
function isCenterStaff(request: MockRequest): boolean {
  const tenants = request.user?.tenants ?? [];
  return UNIDADES.some((u) => tenants.includes(u.tenantId));
}

function isImagingStaff(request: MockRequest): boolean {
  const tenants = request.user?.tenants ?? [];
  return UNIDADES.some((u) => u.kind === 'IMAGING' && tenants.includes(u.tenantId));
}

export function registerLabPortalApiParity(router: MockRouter): void {
  // The original list handler, captured before wrapping: the search reuses it.
  const listFiles: MockHandler =
    router.match('GET', '/diagnostics/lab/result-files')?.handler ?? (() => ({ items: [], count: 0, totalBytes: 0 }));

  router.wrap('GET', '/diagnostics/lab/result-files', (request, next) => {
    if (isCenterStaff(request) && request.query.has('q')) return validationPipeRejected('property q should not exist');
    return withoutNotification(next(request));
  });

  router.post('/diagnostics/lab/result-files/search', (request) => {
    const filters = (request.body ?? {}) as Record<string, unknown>;
    const query = new URLSearchParams();
    for (const key of ['q', 'kind', 'orderId', 'includeWithdrawn'] as const) {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    return withoutNotification(listFiles({ ...request, method: 'GET', query }));
  });

  router.wrap('POST', '/diagnostics/lab/result-uploads', (request, next) => {
    if (!isCenterStaff(request)) return next(request);
    const start = (request.body ?? {}) as { orderId?: unknown; sizeBytes?: unknown; contentType?: unknown };
    if (typeof start.orderId !== 'string' || !UUID.test(start.orderId)) {
      return validationPipeRejected('orderId must be a UUID');
    }
    if (typeof start.sizeBytes === 'number' && start.sizeBytes > MAX_UPLOAD_BYTES) {
      return unprocessableWithCode('DIAGNOSTICS_LAB_RESULT_TOO_LARGE', 'El archivo supera los 10 MB permitidos.');
    }
    if (typeof start.contentType !== 'string' || !ALLOWED_TYPES.has(start.contentType)) {
      return unprocessableWithCode(
        'DIAGNOSTICS_LAB_RESULT_TYPE_UNSUPPORTED',
        'Ese tipo de archivo no se admite. Suba PDF, JPEG, PNG, WEBP, GIF, DOCX, XLSX o TXT.',
      );
    }
    return next(request);
  });

  router.wrap('POST', '/diagnostics/lab/result-uploads/:uploadId/complete', (request, next) => {
    const done = next(request) as { status?: number; body?: unknown };
    return done !== null && typeof done === 'object' && 'body' in done && done.body !== null && typeof done.body === 'object'
      ? { ...done, body: { ...(done.body as object), notified: false } }
      : done;
  });

  router.wrap('POST', '/diagnostics/lab/orders/:orderId/transitions', (request, next) => {
    const action = (request.body as { action?: unknown } | null)?.action;
    if (action === 'CANCEL' || (action === 'REJECT' && isImagingStaff(request))) {
      return unprocessableWithCode(
        'DIAGNOSTICS_LAB_ORDER_ACTION_UNSUPPORTED',
        action === 'CANCEL'
          ? 'Todavía no se puede cancelar una orden desde el centro.'
          : 'Una orden sin muestra no se puede rechazar.',
      );
    }
    return next(request);
  });
}

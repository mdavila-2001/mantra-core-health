import {
  forbidden,
  reply,
  unauthorized,
  type MockReply,
  type MockRequest,
} from '../mock-router';

/* ============================================================================
    Ayudas de respuesta del simulador de visibilidad (`ui-visibility.handlers.ts`):
    los fallos con el `reason` estable del contrato, el rol de seguridad y la
    validación de cuerpo y `limit` igual que la API. Sin rutas ni estado.
    ========================================================================== */

const MAX_LIMITE = 200;
const LIMITE_POR_DEFECTO = 50;

type CodigoGenerico = 'VALIDATION_FAILED' | 'NOT_FOUND' | 'CONFLICT' | 'PRECONDITION_FAILED';
const ERROR_HTTP: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  428: 'Precondition Required',
};

export interface CampoRechazado {
  readonly field: string;
  readonly messages: readonly string[];
}

/** Un fallo con el `reason` estable del contrato y, si es de un campo, `details.fields`. */
export function fallo(
  status: 400 | 404 | 409 | 422 | 428,
  code: CodigoGenerico,
  reason: string | null,
  message: string,
  fields: readonly CampoRechazado[] = [],
  extra: Record<string, unknown> = {},
): MockReply {
  return reply(status, {
    statusCode: status,
    code,
    message,
    error: ERROR_HTTP[status],
    ...(reason === null ? {} : { reason }),
    details: { ...(reason === null ? {} : { reason }), ...(fields.length > 0 ? { fields } : {}), ...extra },
  });
}

export const invalido = (campo: string, mensaje: string): MockReply =>
  fallo(400, 'VALIDATION_FAILED', null, 'Error de validación', [{ field: campo, messages: [mensaje] }]);

export function exigirAdmin(req: MockRequest): MockReply | null {
  if (req.user === null) return unauthorized();
  const ok = req.user.roles.some((r) => r === 'SECURITY_ADMIN' || r === 'SUPERADMIN');
  return ok ? null : forbidden('Para administrar la visibilidad hace falta el rol de seguridad.');
}

export function cuerpoObjeto(req: MockRequest): Record<string, unknown> | MockReply {
  const b = req.body;
  if (typeof b !== 'object' || b === null || Array.isArray(b)) {
    return invalido('body', 'El cuerpo debe ser un objeto.');
  }
  return b as Record<string, unknown>;
}

export const esRespuesta = (v: unknown): v is MockReply =>
  typeof v === 'object' && v !== null && 'status' in v && 'body' in v;

/** `forbidNonWhitelisted`: una clave que el DTO no declara es un 400, no se ignora. */
export function claveDesconocida(b: Record<string, unknown>, permitidas: readonly string[]): MockReply | null {
  const extra = Object.keys(b).find((k) => !permitidas.includes(k));
  return extra === undefined ? null : invalido(extra, `La propiedad ${extra} no debe existir.`);
}

export function limiteDe(query: URLSearchParams): number | MockReply {
  const crudo = query.get('limit');
  if (crudo === null || crudo === '') return LIMITE_POR_DEFECTO;
  const n = Number(crudo);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMITE) return invalido('limit', `limit debe estar entre 1 y ${MAX_LIMITE}.`);
  return n;
}

export const normal = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

import { forbidden, reply, type MockReply } from '../mock-router';

/**
 * Los errores del personal de apoyo con la forma de la API: `reason` (el sub-código de
 * negocio) va **dos veces**, arriba y en `details.reason`, como lo entrega el filtro de
 * errores; `error` es el nombre del estado HTTP.
 */
const NOMBRE_DE_ESTADO: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
};

const CODIGO_DE_ESTADO: Readonly<Record<number, string>> = {
  400: 'VALIDATION_FAILED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'PRECONDITION_FAILED',
};

export function conMotivo(status: 400 | 403 | 404 | 409 | 422, message: string, reason: string, details: Readonly<Record<string, unknown>> = {}): MockReply {
  return reply(status, {
    statusCode: status,
    code: CODIGO_DE_ESTADO[status],
    message,
    error: NOMBRE_DE_ESTADO[status],
    reason,
    details: { ...details, reason },
  });
}

/**
 * El único 403 de la agenda del personal de apoyo. Es el mismo para todo rechazo
 * —vínculo ausente, terminado o suspendido, doctor sin aceptar, permiso que no cubre,
 * cita de otra organización—: distinguirlos le diría a quien no tiene acceso que una cita,
 * un doctor o una organización existen. Es el texto de `SUPPORT_DENIED_MESSAGE` de la API.
 */
export const SUPPORT_DENIED_MESSAGE = 'Su vínculo de apoyo no le permite esta acción.';

export const denegadoGenerico = (): MockReply => forbidden(SUPPORT_DENIED_MESSAGE);

/* ---- el motivo de una cancelación o un cambio ------------------------------------ */

export const MOTIVO_MINIMO = 5;
export const MOTIVO_MAXIMO = 500;

const RELLENOS: ReadonlySet<string> = new Set(['na', 'n/a', 'no aplica', 'nada', 'ninguno', 'ninguna', 'sin motivo', 'motivo', 'test', 'prueba', 'asdf', 'aaaa', 'xxxx', 'otro', 'otros']);

/**
 * Juzga el motivo como la API (`judgeReason` / `requireReason`): 400 solo si no es un texto o
 * pasa de 500 caracteres; 422 `REASON_REQUIRED` si falta, está vacío o es corto, y
 * 422 `REASON_PLACEHOLDER` si es relleno («prueba», «....», «xxxx»). Devuelve el motivo
 * normalizado o el rechazo.
 */
export function juzgarMotivo(crudo: unknown, accion: string): { ok: true; motivo: string } | { ok: false; respuesta: MockReply } {
  if (crudo !== undefined && typeof crudo !== 'string') {
    return { ok: false, respuesta: reply(400, { statusCode: 400, code: 'VALIDATION_FAILED', message: 'El motivo debe ser un texto.', error: 'Bad Request', details: { fields: [{ field: 'reasonText', message: 'debe ser un texto' }] } }) };
  }
  if (typeof crudo === 'string' && crudo.length > MOTIVO_MAXIMO) {
    return { ok: false, respuesta: reply(400, { statusCode: 400, code: 'VALIDATION_FAILED', message: 'El motivo admite hasta 500 caracteres.', error: 'Bad Request', details: { fields: [{ field: 'reasonText', message: 'máximo 500 caracteres' }] } }) };
  }
  const motivo = (crudo ?? '').trim().replace(/\s+/g, ' ');
  if (motivo.length < MOTIVO_MINIMO) {
    return { ok: false, respuesta: conMotivo(422, `Indique el motivo para ${accion}: es obligatorio y debe explicar el cambio.`, 'REASON_REQUIRED', { failureCode: 'REASON_REQUIRED', minLength: MOTIVO_MINIMO }) };
  }
  const llano = motivo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const sinEspacios = llano.replace(/\s/g, '');
  if (RELLENOS.has(llano) || (sinEspacios.length > 0 && new Set(sinEspacios).size === 1)) {
    return { ok: false, respuesta: conMotivo(422, `El motivo para ${accion} no puede ser un texto de relleno: escriba la razón real.`, 'REASON_PLACEHOLDER', { failureCode: 'REASON_PLACEHOLDER' }) };
  }
  return { ok: true, motivo };
}

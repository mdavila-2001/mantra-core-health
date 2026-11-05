import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';
import { ipRulesFailureOf } from './ip-rules-failure';

/**
 * Lo que la API dice cuando **no guarda** los controles de sesión (`PUT /org/session-policies`). Son `422` con
 * `details.reason`; se ramifica por ese código y nunca por el mensaje.
 *
 * - `SESSION_POLICY_HOURS_EMPTY`: la hora de inicio y la de fin son iguales: la franja no admite a nadie.
 * - `SESSION_POLICY_HOURS_TOO_SHORT`: dura menos de 4 horas (`details.minimumMinutes`): sería cerrar el acceso.
 * - `SESSION_POLICY_WOULD_LOCK_OUT_ACTOR`: la política dejaría fuera **el horario en el que está trabajando** quien la guarda.
 * - `IP_RULES_WOULD_LOCK_OUT_ACTOR`: con la red exigida, quedaría fuera **la red desde la que está trabajando**; ahora la API
 *   también lo comprueba al guardar políticas de sesión, no solo al guardar redes.
 *
 * Todo lo demás cae en el mensaje con que la API lo explicó.
 */
export function sessionPolicyFailureOf(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0) return 'No pudimos conectarnos. Revise su conexión y reintente: no se guardó nada.';
  const detalles = readApiError(error)?.details;
  switch (detalles?.['reason']) {
    case 'SESSION_POLICY_HOURS_EMPTY':
      return 'No se guardó nada: el horario empieza y termina a la misma hora, así que no admite a nadie. Elija una hora de inicio distinta de la de fin.';
    case 'SESSION_POLICY_HOURS_TOO_SHORT': {
      const minutos = typeof detalles['minimumMinutes'] === 'number' ? detalles['minimumMinutes'] : 240;
      return `No se guardó nada: la franja horaria debe durar al menos ${minutos / 60} horas. Una más corta equivale a cerrar el acceso.`;
    }
    case 'SESSION_POLICY_WOULD_LOCK_OUT_ACTOR':
      return 'No se guardó nada: con este horario usted quedaría fuera de su propia organización, porque la hora en que está trabajando ahora no entraría. Amplíe el horario o cámbielo para que incluya esta hora, y vuelva a guardar.';
    case 'IP_RULES_WOULD_LOCK_OUT_ACTOR':
      return `${ipRulesFailureOf(error).message} Revise las redes de la organización antes de exigirlas en una regla de sesión.`;
    default:
      break;
  }
  const mensaje = readApiError(error)?.message.trim() ?? '';
  return mensaje === '' ? fallback : mensaje;
}

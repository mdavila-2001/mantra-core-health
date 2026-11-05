import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../http/api-error';

/**
 * El 403 de cancelar o mover **una cita que no es de su agenda** (SEG V-1, ronda 2 de la API).
 *
 * Antes cualquier profesional cancelaba y movía las citas de un colega; ahora la API responde 403 (`assertMayChangeBooking`)
 * salvo que la cita sea de su propia agenda o de un paciente suyo o representado. El 403 no trae un `reason` (es el muro
 * genérico): la pantalla lo explica con claridad en vez de un «No se pudo cancelar la cita» sin salida.
 *
 * Devuelve `null` si el fallo no es ese muro: un 403 con `reason` (un desafío de motivo, segundo paso o aprobación que atiende
 * el diálogo, o un motivo de negocio con su propia explicación) se deja a quien ya lo explica.
 *
 * @param error El fallo de `cancelBooking` o `rescheduleBooking`.
 * @param accion Lo que se intentaba, en infinitivo: `cancelar` o `mover`.
 */
export function bookingChangeDeniedText(
  error: unknown,
  accion: 'cancelar' | 'mover',
): string | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 403) return null;
  const body = readApiError(error);
  // Con un `reason` o con la identidad sin verificar (que es una puerta, no un muro) lo explica otro.
  if (body?.reason !== undefined || body?.code === 'IDENTITY_VERIFICATION_REQUIRED') return null;
  return `Esta cita no es de su agenda, así que no puede ${accion}la: solo puede ${accion} las suyas. Pídaselo a quien la atiende o a recepción.`;
}

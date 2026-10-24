import type { BadgeVariant } from '../../shared/components/atoms/badge/badge.types';

/**
 * El tono de la etiqueta de estado de una solicitud de seguro. Lo que ya está
 * resuelto se ve como tal, lo que se rechaza se ve distinto, y lo que espera
 * queda en informativo. El texto siempre lo dice el servidor; el tono solo
 * acompaña, nunca es la única señal.
 *
 * @param codigo - El código de estado de la solicitud (`status.code`).
 * @returns El tono del badge.
 */
export function tonoDeEstadoDeReclamo(codigo: string): BadgeVariant {
  switch (codigo) {
    case 'APPROVED':
    case 'PAID':
      return 'success';
    case 'PARTIAL':
      return 'warning';
    case 'REJECTED':
      return 'error';
    default:
      return 'info';
  }
}

/* The simulated pharmacy orders' states and their labels (`pharmacy.handlers.ts`). */

export type EstadoPedido = 'ENVIADO' | 'EN_REVISION' | 'CONFIRMADO' | 'ACEPTACION_PENDIENTE' | 'ACEPTADO' | 'LISTO_PARA_RETIRO' | 'RETIRADO' | 'RECHAZADO' | 'VENCIDO' | 'CANCELADO';

export const ETIQUETA: Record<EstadoPedido, string> = {
  ENVIADO: 'Enviado',
  EN_REVISION: 'En revisión',
  CONFIRMADO: 'Confirmado',
  ACEPTACION_PENDIENTE: 'Esperando su aceptación',
  ACEPTADO: 'Aceptado',
  LISTO_PARA_RETIRO: 'Listo para retirar',
  RETIRADO: 'Retirado',
  RECHAZADO: 'Rechazado',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
};

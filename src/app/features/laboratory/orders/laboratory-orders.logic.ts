import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import type {
  LabOrder,
  LabOrderStatus,
} from '../../../core/data-access/lab-portal/lab-portal.types';

/** Las pestañas de «Órdenes»: cada una es un filtro por estado, en el orden del camino. */
export const ORDER_TABS = ['all', 'draft', 'received', 'processed', 'uploaded', 'closed'] as const;

export type OrderTab = (typeof ORDER_TABS)[number];

export const ORDER_TAB_LABELS: Readonly<Record<OrderTab, string>> = {
  all: 'Todas',
  draft: 'Borrador',
  received: 'Recibidas',
  processed: 'Procesadas',
  uploaded: 'Subidos',
  closed: 'Canceladas y rechazadas',
};

/** Qué estados junta cada pestaña. */
const TAB_STATUSES: Readonly<Record<OrderTab, readonly LabOrderStatus[] | null>> = {
  all: null,
  draft: ['DRAFT'],
  received: ['RECEIVED'],
  processed: ['PROCESSED'],
  uploaded: ['UPLOADED'],
  closed: ['CANCELLED', 'REJECTED'],
};

/** El índice de la pestaña que dice `?estado=`; una clave desconocida abre «Todas». */
export function orderTabIndexOf(key: string | null): number {
  const index = ORDER_TABS.findIndex((tab) => tab === key);
  return index < 0 ? 0 : index;
}

export function orderTabKeyOf(index: number): OrderTab {
  return ORDER_TABS[index] ?? 'all';
}

export function ordersOfTab(orders: readonly LabOrder[], tab: OrderTab): readonly LabOrder[] {
  const statuses = TAB_STATUSES[tab];
  return statuses === null ? orders : orders.filter((order) => statuses.includes(order.status));
}

export const ORDER_STATUS_BADGE: Readonly<
  Record<LabOrderStatus, { readonly label: string; readonly variant: BadgeVariant }>
> = {
  DRAFT: { label: 'Borrador', variant: 'secondary' },
  RECEIVED: { label: 'Recibida', variant: 'info' },
  PROCESSED: { label: 'Procesada', variant: 'warning' },
  UPLOADED: { label: 'Subidos', variant: 'success' },
  CANCELLED: { label: 'Cancelada', variant: 'error' },
  REJECTED: { label: 'Rechazada', variant: 'error' },
};

/** Los códigos estables de las cuatro acciones de la fila. */
export type OrderActionCode = 'receive' | 'process' | 'upload' | 'download';

/**
 * Las cuatro acciones, y nada más: recibir, marcar como procesada, subir
 * resultados y descargar. Cada una sólo está habilitada en el paso del camino
 * que le toca; una orden cancelada o rechazada no tiene ninguna.
 *
 * Es presentación: la API revalida cada paso y responde 409 si no corresponde.
 */
export function actionsOf(order: LabOrder): readonly RowAction[] {
  if (order.status === 'CANCELLED' || order.status === 'REJECTED') return [];
  return [
    { code: 'receive', label: 'Recibir', icon: 'arrive', disabled: order.status !== 'DRAFT' },
    {
      code: 'process',
      label: 'Marcar como procesada',
      icon: 'check-circle',
      disabled: order.status !== 'RECEIVED',
    },
    {
      code: 'upload',
      label: 'Subir resultados',
      icon: 'paperclip',
      disabled: order.status !== 'PROCESSED' && order.status !== 'UPLOADED',
    },
    {
      code: 'download',
      label: 'Descargar',
      icon: 'download',
      disabled: order.status !== 'UPLOADED' || order.files.length === 0,
    },
  ];
}

/** Las mismas acciones sin poder usarse: mientras una está en vuelo no se manda otra. */
export function disabledAll(actions: readonly RowAction[]): readonly RowAction[] {
  return actions.map((action) => ({ ...action, disabled: true }));
}

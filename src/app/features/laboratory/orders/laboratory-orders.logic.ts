import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import type {
  LabOrder,
  LabOrderAction,
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

/** Los códigos estables de las acciones de la fila. */
export type OrderActionCode = 'receive' | 'process' | 'upload' | 'download' | 'cancel' | 'reject';

/**
 * Las acciones de la fila: recibir, marcar como procesada, subir resultados,
 * descargar, y las dos salidas, cancelar y rechazar. Cada una sólo está
 * habilitada en el paso del camino que le toca; una orden cancelada o
 * rechazada no tiene ninguna. Valen igual para laboratorio e imagenología.
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
    {
      code: 'cancel',
      label: 'Cancelar',
      icon: 'close',
      destructive: true,
      disabled: order.status !== 'DRAFT' && order.status !== 'RECEIVED',
    },
    {
      code: 'reject',
      label: 'Rechazar',
      icon: 'remove',
      destructive: true,
      disabled: order.status !== 'RECEIVED',
    },
  ];
}

/** The reason box of the cancel and reject dialogs: three characters at least. */
export const REASON_FIELD = {
  label: 'Motivo',
  placeholder: 'Por ejemplo: pedida por error',
  minLength: 3,
  maxLength: 300,
} as const;

/** What each exit step asks, and what it says when it is done. */
export const REASON_STEPS: Readonly<
  Record<
    'cancel' | 'reject',
    {
      readonly action: LabOrderAction;
      readonly done: string;
      readonly dialog: (order: LabOrder) => {
        title: string;
        message: string;
        confirmLabel: string;
        destructive: true;
      };
    }
  >
> = {
  cancel: {
    action: 'CANCEL',
    done: 'Orden cancelada.',
    dialog: (order) => ({
      title: 'Cancelar la orden',
      message: `Cancela «${order.studyName}» de ${order.patientName}. La orden queda cancelada con el motivo que escriba y ya no admite más pasos.`,
      confirmLabel: 'Cancelar la orden',
      destructive: true,
    }),
  },
  reject: {
    action: 'REJECT',
    done: 'Orden rechazada.',
    dialog: (order) => ({
      title: 'Rechazar la orden',
      message: `Rechaza «${order.studyName}» de ${order.patientName}. La orden queda rechazada con el motivo que escriba y ya no admite más pasos.`,
      confirmLabel: 'Rechazar la orden',
      destructive: true,
    }),
  },
};

/** Las mismas acciones sin poder usarse: mientras una está en vuelo no se manda otra. */
export function disabledAll(actions: readonly RowAction[]): readonly RowAction[] {
  return actions.map((action) => ({ ...action, disabled: true }));
}

/** The API's own readable message of a failed request (409, 422…), or the fallback. */
export function apiMessageOf(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const message = readApiError(error)?.message;
    if (message !== undefined && message !== '') return message;
  }
  return fallback;
}

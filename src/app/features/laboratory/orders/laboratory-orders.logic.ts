import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { empty, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
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

/** What the table of a tab shows: its orders matching the search, or why there are none. */
export function tableOf(
  orders: readonly LabOrder[],
  tab: OrderTab,
  search: string,
): ViewState<readonly LabOrder[]> {
  const query = search.trim().toLocaleLowerCase('es');
  const rows = ordersOfTab(orders, tab).filter(
    (order) =>
      query === '' ||
      [order.patientName, order.requesterName, order.studyName].some((field) =>
        field.toLocaleLowerCase('es').includes(query),
      ),
  );
  if (rows.length > 0) return ready(rows);
  const all = { label: 'Ver todas las órdenes' };
  if (query !== '') return empty(all, 'Ninguna orden coincide con la búsqueda.');
  return empty(
    all,
    tab === 'all'
      ? 'Todavía no hay órdenes: cargue una con «Nueva orden» o espere las que le deriven.'
      : `No hay órdenes en «${ORDER_TAB_LABELS[tab]}».`,
  );
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
export type OrderActionCode =
  | 'receive'
  | 'process'
  | 'upload'
  | 'download'
  | 'reject'
  | 'edit'
  | 'cancel';

/**
 * Recibir, marcar como procesada, subir resultados, descargar y rechazar (con
 * motivo; sólo si la API dice `canReject`: lo registra contra la muestra, así
 * que una orden de imagenología nunca lo trae). Cada una sólo está habilitada
 * en el paso del camino que le toca; una orden cancelada o rechazada no tiene
 * ninguna. Corregir y anular sólo se ofrecen en una orden que cargó el propio
 * centro (`registeredByPerformer`): la de un médico es de quien la pidió.
 * Corregir, mientras la API diga `canEdit` (todavía no se recibió).
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
    // Only when the API says so: rejecting is recorded against the specimen, which imaging orders lack.
    ...(order.canReject === true
      ? [{ code: 'reject', label: 'Rechazar', icon: 'remove', destructive: true } satisfies RowAction]
      : []),
    ...(order.registeredByPerformer === true
      ? ([
          { code: 'edit', label: 'Corregir', icon: 'edit', disabled: order.canEdit !== true },
          { code: 'cancel', label: 'Anular', icon: 'remove', destructive: true },
        ] satisfies RowAction[])
      : []),
  ];
}

/** How much of a file already went out, from 0 to 100. */
export function percentOf(item: { readonly file: { readonly size: number }; readonly sentBytes: number }): number {
  return item.file.size === 0 ? 100 : Math.floor((item.sentBytes / item.file.size) * 100);
}

/** The reason box of the reject and annul dialogs: three characters at least. */
export const REASON_FIELD = {
  label: 'Motivo',
  placeholder: 'Por ejemplo: muestra hemolizada o cargada por error',
  minLength: 3,
  maxLength: 300,
} as const;

/** What the reject step asks, and what it says when it is done. */
export const REASON_STEPS: Readonly<
  Record<
    'reject' | 'cancel',
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
  cancel: {
    action: 'CANCEL',
    done: 'Orden anulada.',
    dialog: (order) => ({
      title: 'Anular la orden',
      message: `Anula «${order.studyName}» de ${order.patientName}, que cargó este centro. Queda anulada con el motivo que escriba y ya no admite más pasos.`,
      confirmLabel: 'Anular la orden',
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

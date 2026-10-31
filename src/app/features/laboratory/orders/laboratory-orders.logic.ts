import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import type {
  LabOrder,
  LabOrderScope,
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

/* ---- tipo de bandeja: Laboratorio · Imagenología ------------------------- */

export type ScopeFilter = 'all' | LabOrderScope;

export const SCOPE_LABELS: Readonly<Record<ScopeFilter, string>> = {
  all: 'Todos',
  LAB: 'Laboratorio',
  IMAGING: 'Imagenología',
};

const SCOPE_KEYS: readonly ScopeFilter[] = ['all', 'LAB', 'IMAGING'];

/** Una orden sin `scope` (armada a mano) es de laboratorio, que es lo que siempre fue. */
export function scopeOf(order: LabOrder): LabOrderScope {
  return order.scope ?? 'LAB';
}

export function ordersOfScope(
  orders: readonly LabOrder[],
  scope: ScopeFilter,
): readonly LabOrder[] {
  return scope === 'all' ? orders : orders.filter((order) => scopeOf(order) === scope);
}

/** Las opciones del control de tipo, cada una con cuántas órdenes tiene. */
export function scopeOptions(orders: readonly LabOrder[]): readonly SegmentedOption<ScopeFilter>[] {
  return SCOPE_KEYS.map((value) => ({
    value,
    label: `${SCOPE_LABELS[value]} (${ordersOfScope(orders, value).length})`,
  }));
}

/* ---- búsqueda ------------------------------------------------------------ */

/** Minúsculas y sin tildes: «radiografia» encuentra «Radiografía». */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es');
}

/** Todo lo que la búsqueda mira de una orden: paciente, estudio, componentes, región, modalidad. */
export function searchTextOf(order: LabOrder): string {
  const imaging = order.detail?.imaging;
  return fold(
    [
      order.patientName,
      order.studyName,
      order.summary,
      order.detail?.specimenTypeDisplay,
      ...(order.detail?.components.map((component) => component.display) ?? []),
      imaging?.modalityDisplay,
      imaging?.bodySiteDisplay,
      imaging?.lateralityDisplay,
    ]
      .filter((part): part is string => typeof part === 'string')
      .join(' '),
  );
}

export function matchesQuery(order: LabOrder, query: string): boolean {
  const q = fold(query.trim());
  return q === '' || searchTextOf(order).includes(q);
}

/**
 * La línea secundaria de la celda «Estudio»: el resumen sin repetir el nombre
 * que ya está arriba («Hemograma completo · 3 componentes» → «3 componentes»).
 */
export function summaryLineOf(order: LabOrder): string | null {
  const summary = order.summary?.trim() ?? '';
  if (summary === '') return null;
  const prefix = `${order.studyName} · `;
  if (summary === order.studyName) return null;
  return summary.startsWith(prefix) ? summary.slice(prefix.length) : summary;
}

/** Qué decir cuando la tabla queda sin filas: por la búsqueda, por el tipo o por la pestaña. */
export function emptyMessageOf(tab: OrderTab, scope: ScopeFilter, query: string): string {
  if (query.trim() !== '') return 'Ninguna orden coincide con la búsqueda.';
  if (tab === 'all' && scope === 'all') return 'Todavía no le derivaron ninguna orden.';
  if (tab === 'all') return `No hay órdenes de ${SCOPE_LABELS[scope]}.`;
  const suffix = scope === 'all' ? '' : ` de ${SCOPE_LABELS[scope]}`;
  return `No hay órdenes en «${ORDER_TAB_LABELS[tab]}»${suffix}.`;
}

/** El mensaje que dio la API, o el de respaldo. */
export function messageOf(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const message = readApiError(error)?.message;
    if (message !== undefined && message !== '') return message;
  }
  return fallback;
}

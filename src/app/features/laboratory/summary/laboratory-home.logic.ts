import type { CenterBooking } from '../../../core/data-access/diagnostic-units/center-schedule.types';
import type { LabOrder, LabSummary } from '../../../core/data-access/lab-portal/lab-portal.types';
import { empty, mapData } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

/* Pure rules of the diagnostic-center home: wording per center kind and the
   per-block view states. Nothing here fetches; the container does. */

export const ORDERS_ROUTE = '/administration/laboratory-orders';
export const PRICES_ROUTE = '/administration/laboratory-prices';
export const SCHEDULE_ROUTE = '/administration/center-schedule';

/** How many rows a home block lists before pointing to the full screen. */
export const HOME_LIST_SIZE = 4;

/** `null` while unknown: the wording then fits both laboratories and imaging centers. */
export type CenterKind = 'LABORATORY' | 'IMAGING' | null;

export interface CenterWording {
  /** Fallback name, used when neither the session nor the summary names the center. */
  readonly fallbackName: string;
  /** What the center works on: «muestras», «estudios» or both. */
  readonly items: string;
  readonly processHint: string;
}

const WORDING: Readonly<Record<'LABORATORY' | 'IMAGING' | 'BOTH', CenterWording>> = {
  LABORATORY: { fallbackName: 'Su laboratorio', items: 'muestras', processHint: 'Muestras en análisis' },
  IMAGING: { fallbackName: 'Su centro de imagen', items: 'estudios', processHint: 'Estudios por informar' },
  BOTH: { fallbackName: 'Su centro', items: 'muestras o estudios', processHint: 'En análisis o por informar' },
};

export function wordingFor(kind: CenterKind): CenterWording {
  return WORDING[kind ?? 'BOTH'];
}

/** One actionable count of «Órdenes de hoy», linked to its tab in Órdenes. */
export interface OrderCount {
  readonly key: 'draft' | 'received' | 'processed';
  readonly label: string;
  readonly hint: string;
  readonly count: number;
  readonly icon: 'arrive' | 'flask' | 'results';
}

export interface OrdersOverview {
  readonly counts: readonly OrderCount[];
  readonly recent: readonly LabOrder[];
}

const byNewest = (a: LabOrder, b: LabOrder): number => b.requestedAt.localeCompare(a.requestedAt);

export function ordersOverview(orders: readonly LabOrder[], wording: CenterWording): OrdersOverview {
  const count = (status: LabOrder['status']) => orders.filter((o) => o.status === status).length;
  return {
    counts: [
      { key: 'draft', label: 'Por recibir', hint: `Le derivaron ${wording.items}`, count: count('DRAFT'), icon: 'arrive' },
      { key: 'received', label: 'Por procesar', hint: wording.processHint, count: count('RECEIVED'), icon: 'flask' },
      { key: 'processed', label: 'Por subir', hint: 'Procesadas, sin resultado', count: count('PROCESSED'), icon: 'results' },
    ],
    recent: [...orders].sort(byNewest).slice(0, HOME_LIST_SIZE),
  };
}

export function ordersBlockState(state: ViewState<readonly LabOrder[]>, wording: CenterWording): ViewState<OrdersOverview> {
  if (state.status === 'ready' && state.data.length === 0) {
    return empty(
      { label: 'Ver órdenes', route: ORDERS_ROUTE },
      `Cuando un médico le derive ${wording.items}, la orden aparece acá.`,
      'Todavía no le derivaron órdenes',
    );
  }
  return mapData(state, (orders) => ordersOverview(orders, wording));
}

/** Processed orders still without a file: the ones waiting for «Subir resultado». */
export interface PendingResults {
  readonly items: readonly LabOrder[];
  readonly total: number;
}

export function pendingResultsState(state: ViewState<readonly LabOrder[]>): ViewState<PendingResults> {
  if (state.status === 'ready' && !state.data.some((o) => o.status === 'PROCESSED')) {
    return empty(
      { label: 'Ver órdenes por procesar', route: ORDERS_ROUTE, queryParams: { estado: 'received' } },
      'Cuando marque una orden como procesada, aparece acá para subir su resultado.',
      'No hay resultados pendientes',
    );
  }
  return mapData(state, (orders) => {
    const items = orders.filter((o) => o.status === 'PROCESSED').sort(byNewest);
    return { items: items.slice(0, HOME_LIST_SIZE), total: items.length };
  });
}

export function bookingsBlockState(state: ViewState<readonly CenterBooking[]>): ViewState<readonly CenterBooking[]> {
  if (state.status === 'ready' && state.data.length === 0) {
    return empty(
      { label: 'Revisar horarios', route: SCHEDULE_ROUTE },
      'Los turnos que reserven los pacientes para hoy aparecen acá.',
      'Hoy no hay turnos reservados',
    );
  }
  return state;
}

export function catalogBlockState(state: ViewState<LabSummary>): ViewState<LabSummary> {
  if (state.status === 'ready' && state.data.published + state.data.drafts === 0) {
    return empty(
      { label: 'Cargar mi catálogo', route: PRICES_ROUTE },
      'Cargue los servicios que ofrece con su precio para que los pacientes los encuentren.',
      'Su catálogo está vacío',
    );
  }
  return state;
}

/** Today, from local midnight to the next one, for `GET /diagnostic-units/me/bookings`. */
export function todayRange(now: Date): { readonly from: Date; readonly to: Date } {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

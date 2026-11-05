import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  groupLabel,
  inboxGroup,
  type InboxGroup,
} from '../../../organization/pharmacy-inbox/inbox-status';

/** Same cap the inbox uses: the API's maximum page. */
const ORDERS_LIMIT = 500;

/** The open queues, in the order an order walks them. Closed ones are not work. */
const OPEN_GROUPS: readonly InboxGroup[] = [
  'NUEVOS',
  'EN_REVISION',
  'ESPERANDO_PACIENTE',
  'EN_PREPARACION',
  'LISTOS',
];

interface QueueCount {
  readonly group: InboxGroup;
  readonly label: string;
  readonly count: number;
}

/**
 * «Mostrador ahora»: how many pickup requests wait in each open queue.
 *
 * Counts come straight from `GET /pharmacy/orders` grouped with the inbox's own
 * rule (`inboxGroup`), so this panel and the inbox can never disagree.
 */
@Component({
  selector: 'app-counter-today',
  imports: [RouterLink, AppButtonLink, NavIcon, Skeleton, ViewStateHost],
  templateUrl: './counter-today.html',
  styleUrl: './counter-today.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CounterToday {
  private readonly orders = inject(PharmacyOrdersClient);

  protected readonly state = signal<ViewState<readonly QueueCount[]>>(loading());

  protected readonly queues = computed(() => dataOf(this.state()) ?? []);
  protected readonly open = computed(() => this.queues().reduce((sum, q) => sum + q.count, 0));
  protected readonly fresh = computed(
    () => this.queues().find((q) => q.group === 'NUEVOS')?.count ?? 0,
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set(loading());
    this.orders.pedidosDeFarmacia({ limit: ORDERS_LIMIT }).subscribe({
      next: (items) => {
        const counts = new Map<InboxGroup, number>();
        for (const order of items) {
          const group = inboxGroup(order.estado);
          counts.set(group, (counts.get(group) ?? 0) + 1);
        }
        this.state.set(
          ready(
            OPEN_GROUPS.map((group) => ({
              group,
              label: groupLabel(group),
              count: counts.get(group) ?? 0,
            })),
          ),
        );
      },
      error: (error: unknown) =>
        this.state.set(errorToViewState<readonly QueueCount[]>(error)),
    });
  }
}

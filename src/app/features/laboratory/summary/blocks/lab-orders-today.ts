import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { dataOf } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Card } from '../../../../shared/components/molecules/card/card';
import { SectionHeading } from '../../../../shared/components/molecules/section-heading/section-heading';
import { ORDER_STATUS_BADGE } from '../../orders/laboratory-orders.logic';
import { ORDERS_ROUTE, type OrdersOverview } from '../laboratory-home.logic';
import { LabBlockState } from './lab-block-state';

/** «Órdenes de hoy»: what waits at each step, linked to its tab, and the latest orders. */
@Component({
  selector: 'app-lab-orders-today',
  imports: [AppButtonLink, Badge, Card, DatePipe, NavIcon, RouterLink, SectionHeading, LabBlockState],
  templateUrl: './lab-orders-today.html',
  styleUrls: ['./lab-home-block.css', './lab-orders-today.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabOrdersToday {
  readonly state = input.required<ViewState<OrdersOverview>>();
  readonly retry = output<void>();

  protected readonly data = computed(() => dataOf(this.state()));
  protected readonly ordersRoute = ORDERS_ROUTE;
  protected readonly badges = ORDER_STATUS_BADGE;
}

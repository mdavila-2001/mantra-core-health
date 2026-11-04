import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import type { Observable } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { CenterScheduleClient } from '../../../core/data-access/diagnostic-units/center-schedule.client';
import type { CenterBooking } from '../../../core/data-access/diagnostic-units/center-schedule.types';
import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type { LabOrder, LabSummary } from '../../../core/data-access/lab-portal/lab-portal.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { greetingFor } from '../../dashboard/patient-home/patient-home.copy';

import { LabCatalogOverview } from './blocks/lab-catalog-overview';
import { LabDayBookings } from './blocks/lab-day-bookings';
import { LabOrdersToday } from './blocks/lab-orders-today';
import { LabPendingResults } from './blocks/lab-pending-results';
import {
  bookingsBlockState,
  catalogBlockState,
  ordersBlockState,
  pendingResultsState,
  studyByFileOf,
  todayRange,
  wordingFor,
  type CenterKind,
} from './laboratory-home.logic';

/**
 * Home of a DIAGNOSTIC_CENTER account (laboratory or imaging center), in the
 * same visual language as the practitioner's welcome: a greeting, then the day
 * in four blocks — today's orders, pending results, today's bookings and the
 * catalog. Every block owns its M34 state, so one failing read never blanks
 * the page.
 */
@Component({
  selector: 'app-laboratory-summary',
  imports: [DatePipe, NavIcon, LabOrdersToday, LabPendingResults, LabDayBookings, LabCatalogOverview],
  templateUrl: './laboratory-summary.html',
  styleUrl: './laboratory-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaboratorySummaryPage {
  private readonly lab = inject(LabPortalClient);
  private readonly schedule = inject(CenterScheduleClient);
  private readonly auth = inject(AuthService);

  protected readonly summary = signal<ViewState<LabSummary>>(loading());
  protected readonly orders = signal<ViewState<readonly LabOrder[]>>(loading());
  protected readonly bookings = signal<ViewState<readonly CenterBooking[]>>(loading());
  private readonly kind = signal<CenterKind>(null);

  /** Resolved in the browser: the server does not know the viewer's clock. */
  protected readonly greeting = signal('Hola');
  protected readonly today = signal<Date | null>(null);

  protected readonly wording = computed(() => wordingFor(this.kind()));
  protected readonly ordersState = computed(() => ordersBlockState(this.orders(), this.wording()));
  protected readonly pendingState = computed(() => pendingResultsState(this.orders()));
  protected readonly studies = computed(() => {
    const orders = dataOf(this.orders());
    return orders === null ? {} : studyByFileOf(orders);
  });
  protected readonly bookingsState = computed(() => bookingsBlockState(this.bookings()));
  protected readonly catalogState = computed(() => catalogBlockState(this.summary()));

  /** The session's tenant name first; the summary's name if the claim lacks it. */
  protected readonly centerName = computed(() => {
    const tenantId = this.auth.activeTenantId();
    const fromSession = tenantId === null ? '' : this.auth.tenantName(tenantId);
    if (fromSession !== '' && fromSession !== tenantId) return fromSession;
    return dataOf(this.summary())?.labName ?? this.wording().fallbackName;
  });

  constructor() {
    this.loadSummary();
    this.loadOrders();
    // The kind only adapts the wording: without it the copy fits both kinds.
    this.schedule.getMySchedule().subscribe({ next: (view) => this.kind.set(view.kind), error: () => undefined });
    afterNextRender(() => {
      const now = new Date();
      this.greeting.set(greetingFor(now));
      this.today.set(now);
      this.loadBookings();
    });
  }

  protected loadSummary(): void {
    this.load(this.summary, this.lab.getSummary(), (data) => data);
  }

  protected loadOrders(): void {
    this.load(this.orders, this.lab.listOrders(), (page) => page.items);
  }

  protected loadBookings(): void {
    const { from, to } = todayRange(this.today() ?? new Date());
    this.load(this.bookings, this.schedule.getMyBookings(from, to), (page) => page.items);
  }

  private load<R, T>(target: WritableSignal<ViewState<T>>, source: Observable<R>, pick: (r: R) => T): void {
    target.set(loading());
    source.subscribe({
      next: (response) => target.set(ready(pick(response))),
      error: (error: unknown) => target.set(errorToViewState<T>(error)),
    });
  }
}

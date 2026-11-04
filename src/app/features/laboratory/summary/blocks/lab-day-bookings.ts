import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { CenterBooking } from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import { dataOf } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Card } from '../../../../shared/components/molecules/card/card';
import { SectionHeading } from '../../../../shared/components/molecules/section-heading/section-heading';
import { StatusSeal } from '../../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { statusLabelOf, statusVariantOf } from '../../../agenda/booking-status';
import { HOME_LIST_SIZE, SCHEDULE_ROUTE } from '../laboratory-home.logic';

/** «Turnos del día»: today's bookings at the center, earliest first. */
@Component({
  selector: 'app-lab-day-bookings',
  imports: [AppButtonLink, Card, DatePipe, NavIcon, RouterLink, SectionHeading, StatusSeal, ViewStateHost],
  templateUrl: './lab-day-bookings.html',
  styleUrl: './lab-home-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabDayBookings {
  readonly state = input.required<ViewState<readonly CenterBooking[]>>();
  readonly retry = output<void>();

  protected readonly all = computed(() => dataOf(this.state()));
  protected readonly shown = computed(() => (this.all() ?? []).slice(0, HOME_LIST_SIZE + 1));
  /** The site is noise when every booking is at the same one. */
  protected readonly showSite = computed(() => new Set((this.all() ?? []).map((b) => b.siteName)).size > 1);
  protected readonly scheduleRoute = SCHEDULE_ROUTE;
  protected readonly variantOf = statusVariantOf;

  protected labelOf(code: string): string {
    return statusLabelOf(code, 'Reservado');
  }
}

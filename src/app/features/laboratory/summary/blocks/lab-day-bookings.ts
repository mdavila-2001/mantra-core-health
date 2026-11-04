import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { CenterBooking } from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import { dataOf } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Card } from '../../../../shared/components/molecules/card/card';
import { SectionHeading } from '../../../../shared/components/molecules/section-heading/section-heading';
import { statusLabelOf } from '../../../agenda/booking-status';
import { HOME_LIST_SIZE, SCHEDULE_ROUTE } from '../laboratory-home.logic';
import { LabBlockState } from './lab-block-state';

/** Same badge tones as the orders list: done is green, waiting is amber, cancelled is red. */
const BADGE_BY_STATUS: Readonly<Record<string, BadgeVariant>> = {
  BOOKING_CONFIRMED: 'info',
  BOOKING_CHECKED_IN: 'warning',
  BOOKING_IN_PROGRESS: 'warning',
  BOOKING_COMPLETED: 'success',
  BOOKING_CANCELLED: 'error',
  BOOKING_NO_SHOW: 'error',
};

/** «Turnos del día»: today's bookings at the center, earliest first. */
@Component({
  selector: 'app-lab-day-bookings',
  imports: [AppButtonLink, Badge, Card, DatePipe, NavIcon, RouterLink, SectionHeading, LabBlockState],
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

  protected variantOf(code: string): BadgeVariant {
    const suffix = code.slice(code.lastIndexOf(':') + 1);
    return BADGE_BY_STATUS[suffix] ?? 'secondary';
  }

  protected labelOf(code: string): string {
    return statusLabelOf(code, 'Reservado');
  }
}

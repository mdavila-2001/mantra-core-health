import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';

import { CenterScheduleClient } from '../../../../core/data-access/diagnostic-units/center-schedule.client';
import type { CenterBooking, CenterScheduleView } from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

/** One production line of the day: a device and the bookings it attends. */
interface Line {
  readonly key: string;
  readonly name: string;
  readonly note: string | null;
  readonly bookings: readonly CenterBooking[];
}

const DAY_MS = 86_400_000;

/**
 * «Ocupación»: the day of every device that gives appointments, as a
 * production line. Bookings no operational device attends go in a line of
 * their own, so the center sees which patients to call.
 */
@Component({
  selector: 'app-occupancy-tab',
  imports: [AppButton, DatePipe, ViewStateHost],
  templateUrl: './occupancy-tab.html',
  styleUrl: './occupancy-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OccupancyTab {
  private readonly client = inject(CenterScheduleClient);

  readonly center = input.required<CenterScheduleView>();

  /** Days from today: 0 is today. */
  protected readonly offset = signal(0);
  protected readonly day = computed(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + this.offset());
  });
  protected readonly state = signal<ViewState<readonly CenterBooking[]>>(loading());

  protected readonly lines = computed<readonly Line[]>(() => {
    const bookings = dataOf(this.state()) ?? [];
    const devices = this.center().equipment.filter((e) => e.modalityCode !== null);
    const lines: Line[] = devices.map((d) => ({
      key: d.id,
      name: d.name,
      note: d.status === 'OPERATIONAL' ? null : 'Fuera de línea',
      bookings: bookings.filter((b) => b.equipmentId === d.id),
    }));
    const orphan = bookings.filter((b) => !devices.some((d) => d.id === b.equipmentId && d.status === 'OPERATIONAL'));
    const unattended = orphan.filter((b) => !devices.some((d) => d.id === b.equipmentId));
    return unattended.length === 0 ? lines : [...lines, { key: 'none', name: 'Sin equipo asignado', note: 'Hay que reprogramarlos', bookings: unattended }];
  });

  constructor() {
    // Reads the day again when the day changes or a device change arrives.
    effect(() => {
      this.center();
      this.load(this.day());
    });
  }

  protected load(day: Date = this.day()): void {
    this.state.set(loading());
    this.client.getMyBookings(day, new Date(day.getTime() + DAY_MS)).subscribe({
      next: (page) => this.state.set(ready(page.items)),
      error: (error: unknown) => this.state.set(errorToViewState(error)),
    });
  }

  protected move(days: number): void {
    this.offset.update((o) => o + days);
  }
}

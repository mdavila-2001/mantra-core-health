import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import type { Subscription } from 'rxjs';

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
    const lines: Line[] = devices.map((d) => {
      const own = bookings.filter((b) => b.equipmentId === d.id);
      const note = d.status === 'OPERATIONAL' ? null : own.length > 0 ? 'Fuera de línea: avise a estos pacientes y reprográmelos' : 'Fuera de línea';
      return { key: d.id, name: d.name, note, bookings: own };
    });
    // Without a device yet: taken before devices had lines (the API moves them
    // to a free device on the center's next change) or of a modality without
    // devices, which still books on the center's declared quota.
    const unassigned = bookings.filter((b) => !devices.some((d) => d.id === b.equipmentId));
    return unassigned.length === 0
      ? lines
      : [...lines, { key: 'none', name: 'Turnos sin equipo asignado', note: 'Los atiende el cupo general del centro', bookings: unassigned }];
  });

  /** The read in flight: a newer day cancels it, so a late answer never paints another day. */
  private pending: Subscription | null = null;

  constructor() {
    // Reads the day again when the day changes or a device change arrives
    // (a change can move bookings between devices).
    effect(() => {
      this.center();
      this.load(this.day());
    });
    inject(DestroyRef).onDestroy(() => this.pending?.unsubscribe());
  }

  protected load(day: Date = this.day()): void {
    this.pending?.unsubscribe();
    this.state.set(loading());
    this.pending = this.client.getMyBookings(day, new Date(day.getTime() + DAY_MS)).subscribe({
      next: (page) => this.state.set(ready(page.items)),
      error: (error: unknown) => this.state.set(errorToViewState(error)),
    });
  }

  protected move(days: number): void {
    this.offset.update((o) => o + days);
  }
}

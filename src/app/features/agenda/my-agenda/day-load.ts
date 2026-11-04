import { signal, type WritableSignal } from '@angular/core';
import {
  catchError,
  defaultIfEmpty,
  finalize,
  forkJoin,
  map,
  of,
  type Observable,
  type Subscription,
} from 'rxjs';

import type { ViewStateStatus } from '../../../core/view-state/view-state.types';

/**
 * What the day may claim: `loading` while its reads are in flight (an empty
 * day would otherwise read as "No atiende este día"), `error` if a read failed
 * and `ready` once everything arrived.
 */
export type DayState = Extract<ViewStateStatus, 'ready' | 'loading' | 'error'>;

/** The outcome of one read of the day: its items, or the error that stopped it. */
export type DayRead<T> =
  | { readonly ok: true; readonly items: readonly T[] }
  | { readonly ok: false; readonly error: unknown };

/** A paged response, reduced to what the day needs. */
interface Page<T> {
  readonly items: readonly T[];
}

/**
 * Loads the two reads of a day (slots and bookings) as one atomic turn.
 *
 * `load` applies both results together, so the day is never drawn half-read
 * (slots without their bookings would paint "No disponible"). Starting a new
 * turn cancels the previous one, HTTP request included, so a slow answer for
 * another day can neither overwrite the current one nor switch `loading` off.
 */
export class DayLoad {
  private readonly loadingSignal = signal(false);
  /** True from the moment a turn starts until it completes, fails or is cancelled. */
  readonly loading = this.loadingSignal.asReadonly();

  private readonly freshDaySignal = signal(false);
  /**
   * True when the turn in flight is for a day other than the one last loaded:
   * the lists were emptied, so nothing on screen belongs to the day yet. False
   * on a reload of the same day, whose lists (and failures) still stand.
   */
  readonly freshDay = this.freshDaySignal.asReadonly();

  private readonly lists: readonly WritableSignal<readonly unknown[]>[];
  private turn: Subscription | null = null;
  private lastDay: number | null = null;

  /** `lists`: what the day draws (slots, bookings); emptied when the day changes. */
  constructor(...lists: WritableSignal<readonly unknown[]>[]) {
    this.lists = lists;
  }

  /**
   * Starts the turn of `day`, cancelling the one in flight.
   *
   * Another day empties the lists before asking; the same day (a reload after
   * operating a booking) does not, so it does not flicker. Both reads are
   * turned into a {@link DayRead} so one failing never hides the other.
   */
  load<S, B>(
    day: Date,
    slots: Observable<Page<S>>,
    bookings: Observable<Page<B>>,
    apply: (slots: DayRead<S>, bookings: DayRead<B>) => void,
  ): void {
    this.turn?.unsubscribe();
    const key = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    if (this.lastDay !== null && this.lastDay !== key) {
      for (const list of this.lists) list.set([]);
    }
    this.freshDaySignal.set(this.lastDay !== key);
    this.lastDay = key;
    this.loadingSignal.set(true);
    this.turn = forkJoin([read(slots), read(bookings)])
      .pipe(finalize(() => this.loadingSignal.set(false)))
      .subscribe(([s, b]) => apply(s, b));
  }
}

function read<T>(source: Observable<Page<T>>): Observable<DayRead<T>> {
  return source.pipe(
    map((page): DayRead<T> => ({ ok: true, items: page.items })),
    // A source that completes without answering counts as a failed read, so
    // the day never claims "No atiende este día" on data it did not get.
    defaultIfEmpty<DayRead<T>, DayRead<T>>({
      ok: false,
      error: new Error('The day read returned nothing'),
    }),
    catchError((error: unknown) => of<DayRead<T>>({ ok: false, error })),
  );
}

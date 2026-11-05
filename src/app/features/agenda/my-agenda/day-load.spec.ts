import { signal } from '@angular/core';
import { EMPTY, Observable, of, Subject, throwError } from 'rxjs';

import { DayLoad, type DayRead } from './day-load';

interface Item {
  readonly id: number;
}

const page = (...ids: number[]) => ({ items: ids.map((id) => ({ id })) });

describe('DayLoad', () => {
  const TODAY = new Date(2026, 10, 4);
  const TOMORROW = new Date(2026, 10, 5);

  const list = signal<readonly number[]>([]);
  let load: DayLoad;
  let applied: [DayRead<Item>, DayRead<Item>][];

  const apply = (s: DayRead<Item>, b: DayRead<Item>): void => {
    applied.push([s, b]);
  };

  beforeEach(() => {
    list.set([1, 2]);
    applied = [];
    load = new DayLoad(list);
  });

  it('stays loading until both sources complete, then applies both at once', () => {
    const slots = new Subject<{ items: Item[] }>();
    const bookings = new Subject<{ items: Item[] }>();
    load.load(TODAY, slots, bookings, apply);
    expect(load.loading()).toBe(true);

    slots.next(page(1));
    slots.complete();
    expect(load.loading()).toBe(true);
    expect(applied).toEqual([]);

    bookings.next(page(2));
    bookings.complete();
    expect(load.loading()).toBe(false);
    expect(applied).toEqual([
      [
        { ok: true, items: [{ id: 1 }] },
        { ok: true, items: [{ id: 2 }] },
      ],
    ]);
  });

  it('a synchronous source does not switch loading off before the other arrives', () => {
    load.load(TODAY, of(page(1)), new Subject<{ items: Item[] }>(), apply);
    expect(load.loading()).toBe(true);
    expect(applied).toEqual([]);
  });

  it('a failing read becomes a result and the other one is still applied', () => {
    const error = new Error('down');
    load.load(
      TODAY,
      throwError(() => error),
      of(page(2)),
      apply,
    );
    expect(load.loading()).toBe(false);
    expect(applied).toEqual([
      [
        { ok: false, error },
        { ok: true, items: [{ id: 2 }] },
      ],
    ]);
  });

  it('a new turn cancels the old source and ignores its late answer', () => {
    let unsubscribed = false;
    const old = new Observable<{ items: Item[] }>(() => () => (unsubscribed = true));
    load.load(TODAY, old, new Subject<{ items: Item[] }>(), apply);

    const slots = new Subject<{ items: Item[] }>();
    const bookings = new Subject<{ items: Item[] }>();
    load.load(TOMORROW, slots, bookings, apply);
    expect(unsubscribed).toBe(true);
    expect(load.loading()).toBe(true);

    slots.next(page(3));
    slots.complete();
    bookings.next(page());
    bookings.complete();
    expect(applied.length).toBe(1);
    expect(load.loading()).toBe(false);
  });

  it('cancelling the turn by starting another keeps loading on for the new one', () => {
    load.load(TODAY, new Subject<{ items: Item[] }>(), new Subject<{ items: Item[] }>(), apply);
    load.load(TOMORROW, new Subject<{ items: Item[] }>(), new Subject<{ items: Item[] }>(), apply);
    expect(load.loading()).toBe(true);
  });

  it('another day empties the lists and the same day does not', () => {
    const pending = new Subject<{ items: Item[] }>();
    load.load(TODAY, pending, pending, apply);
    expect(list()).toEqual([1, 2]);
    load.load(new Date(2026, 10, 4, 15, 30), pending, pending, apply);
    expect(list()).toEqual([1, 2]);
    load.load(TOMORROW, pending, pending, apply);
    expect(list()).toEqual([]);
  });

  it('freshDay is true for a first load or another day, false for a reload of the same day', () => {
    const pending = new Subject<{ items: Item[] }>();
    load.load(TODAY, of(page(1)), of(page(2)), apply);
    expect(load.freshDay()).toBe(true);
    load.load(TODAY, pending, pending, apply);
    expect(load.freshDay()).toBe(false);
    load.load(TOMORROW, pending, pending, apply);
    expect(load.freshDay()).toBe(true);
  });

  it('asking the same new day again before it answers keeps it fresh; once applied, it is a reload', () => {
    const pending = new Subject<{ items: Item[] }>();
    load.load(TODAY, of(page(1)), of(page(2)), apply);
    load.load(TOMORROW, pending, pending, apply);
    load.load(TOMORROW, pending, pending, apply);
    expect(load.freshDay()).toBe(true);

    load.load(TOMORROW, of(page(3)), of(page(4)), apply);
    expect(load.loading()).toBe(false);
    load.load(TOMORROW, pending, pending, apply);
    expect(load.freshDay()).toBe(false);
  });

  it('a source that completes without answering counts as a failed read', () => {
    load.load(TODAY, EMPTY, of(page(2)), apply);
    expect(load.loading()).toBe(false);
    expect(applied.length).toBe(1);
    expect(applied[0][0].ok).toBe(false);
    expect(applied[0][1]).toEqual({ ok: true, items: [{ id: 2 }] });
  });
});

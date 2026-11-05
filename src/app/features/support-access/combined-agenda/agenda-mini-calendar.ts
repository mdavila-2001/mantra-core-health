import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { addDays, sameDay, startOfWeek, toDayKey } from './agenda-model';

interface CeldaDeMes {
  readonly day: Date;
  readonly key: string;
  readonly inMonth: boolean;
  readonly today: boolean;
  readonly selected: boolean;
  readonly inWeek: boolean;
}

/** Las seis semanas (lunes a domingo) que cubren un mes. Lógica pura. */
export function monthWeeks(anchor: Date): readonly (readonly Date[])[] {
  const primero = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const inicio = startOfWeek(primero);
  return Array.from({ length: 6 }, (_, semana) => Array.from({ length: 7 }, (_, dia) => addDays(inicio, semana * 7 + dia)));
}

/**
 * El calendario chico del costado, como el de Google Calendar: tocar un día
 * lleva la agenda a ese día, y la semana que se está viendo queda marcada.
 */
@Component({
  selector: 'app-agenda-mini-calendar',
  templateUrl: './agenda-mini-calendar.html',
  styleUrl: './agenda-mini-calendar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaMiniCalendar {
  readonly date = input.required<Date>();
  readonly today = input.required<Date>();
  /** Cuántos días de la semana en vista están marcados (1 = solo el día). */
  readonly markWeek = input(false);
  readonly dateChange = output<Date>();

  /** El mes que se muestra: arranca en el del día elegido y se mueve con las flechas. */
  private readonly shifted = signal(0);

  protected readonly month = computed(() => {
    const base = this.date();
    return new Date(base.getFullYear(), base.getMonth() + this.shifted(), 1);
  });

  protected readonly title = computed(() => this.month().toLocaleDateString('es-BO', { month: 'long', year: 'numeric' }));

  protected readonly heads = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  protected readonly headNames = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

  protected readonly weeks = computed<readonly (readonly CeldaDeMes[])[]>(() => {
    const mes = this.month();
    const elegido = this.date();
    const lunes = startOfWeek(elegido);
    return monthWeeks(mes).map((semana) =>
      semana.map((day) => ({
        day,
        key: toDayKey(day),
        inMonth: day.getMonth() === mes.getMonth(),
        today: sameDay(day, this.today()),
        selected: sameDay(day, elegido),
        inWeek: this.markWeek() && sameDay(startOfWeek(day), lunes),
      })),
    );
  });

  protected move(delta: number): void {
    this.shifted.update((n) => n + delta);
  }

  protected pick(day: Date): void {
    this.shifted.set(0);
    this.dateChange.emit(day);
  }

  protected label(day: Date): string {
    return day.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' });
  }
}

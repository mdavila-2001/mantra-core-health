import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { Subscription } from 'rxjs';

import { SchedulingClient } from '../../../../core/data-access/scheduling/scheduling.client';
import type { Booking } from '../../../../core/data-access/scheduling/scheduling.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { BookingPaymentStates } from '../booking-payment-states';
import { formatBolivianos, ReceivedAmountStore } from '../received-amount-store';

/** Cuántos días hacia atrás y hacia adelante se buscan citas sin pago registrado. */
const DAYS_BACK = 30;
const DAYS_AHEAD = 7;
const LIMIT = 100;

/**
 * «Pagos por registrar»: las citas de la ventana que todavía no están pagadas.
 *
 * Es el atajo para registrar el pago sin tener que abrir el día de cada cita.
 * Lee por su cuenta (`searchBookings`, sin canceladas: una cancelada o
 * rechazada no admite pago) y se relee cuando cambia `reloadToken` o el
 * recurso. «Pagada» sale de la lista en el acto, porque se lee el estado más
 * nuevo de {@link BookingPaymentStates}, sin esperar otra lectura.
 *
 * El botón no abre nada: emite la cita y quien lo monta abre el modal de
 * comprobantes que ya existe.
 */
@Component({
  selector: 'app-pending-payments',
  imports: [Alert, AppButton, Badge, DatePipe, Skeleton],
  templateUrl: './pending-payments.html',
  styleUrl: './pending-payments.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingPayments {
  readonly resourceId = input.required<string>();
  /** Cambia cuando algo operó una cita: se relee la lista. */
  readonly reloadToken = input(0);

  readonly registerRequested = output<Booking>();

  private readonly scheduling = inject(SchedulingClient);
  private readonly paymentStates = inject(BookingPaymentStates);
  private readonly amounts = inject(ReceivedAmountStore);

  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly bookings = signal<readonly Booking[]>([]);
  private request: Subscription | null = null;

  /** La decisión de quien lo plegó o desplegó; `null` mientras no tocó nada. */
  private readonly userOpen = signal<boolean | null>(null);

  protected readonly rows = computed(() =>
    this.bookings()
      .map((booking) => ({
        booking,
        state: this.paymentStates.resolve(booking.id, booking.paymentState ?? null),
        received: this.amounts.get(booking.id),
      }))
      .filter((row) => row.state?.state !== 'PAID')
      .sort(
        (a, b) =>
          (a.booking.startAt?.getTime() ?? Infinity) - (b.booking.startAt?.getTime() ?? Infinity),
      ),
  );

  /** Abierto si hay pendientes (o si todavía se está leyendo); cerrado si no. */
  protected readonly expanded = computed(
    () => this.userOpen() ?? (this.status() !== 'ready' || this.rows().length > 0),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
    effect(() => {
      const resourceId = this.resourceId();
      this.reloadToken();
      untracked(() => this.load(resourceId));
    });
  }

  protected reload(): void {
    this.load(this.resourceId());
  }

  /** El `<summary>` nativo alterna solo; se frena para que el estado sea de la señal. */
  protected toggle(event: Event): void {
    event.preventDefault();
    this.userOpen.set(!this.expanded());
  }

  protected amountLabel(amount: number): string {
    return `Bs ${formatBolivianos(amount)}`;
  }

  private load(resourceId: string): void {
    this.request?.unsubscribe();
    // Una relectura no vuelve al esqueleto: la lista que ya se ve no parpadea.
    if (this.bookings().length === 0) this.status.set('loading');

    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - DAYS_BACK);
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    to.setDate(to.getDate() + DAYS_AHEAD);

    this.request = this.scheduling
      .searchBookings({ resourceId, from, to, includeCancelled: false, limit: LIMIT })
      .subscribe({
        next: (page) => {
          this.bookings.set(page.items);
          this.status.set('ready');
        },
        error: () => this.status.set('error'),
      });
  }
}

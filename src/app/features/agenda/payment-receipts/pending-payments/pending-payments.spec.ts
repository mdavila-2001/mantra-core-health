import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { SchedulingClient } from '../../../../core/data-access/scheduling/scheduling.client';
import type {
  Booking,
  BookingPage,
  PaymentStateInfo,
} from '../../../../core/data-access/scheduling/scheduling.types';
import { BookingPaymentStates } from '../booking-payment-states';
import { ReceivedAmountStore } from '../received-amount-store';
import { PendingPayments } from './pending-payments';

function paymentState(state: PaymentStateInfo['state'], label: string): PaymentStateInfo {
  return {
    state,
    label,
    conceptId: `c-${state}`,
    insuranceUsed: false,
    markedByUserId: 'u-1',
    markedAt: new Date('2026-10-27T10:00:00.000Z'),
  };
}

function booking(id: string, startAt: string, extra: Partial<Booking> = {}): Booking {
  return {
    id,
    statusConceptId: 'c-status',
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    startAt: new Date(startAt),
    patientName: `Paciente ${id}`,
    ...extra,
  };
}

describe('PendingPayments', () => {
  let searchBookings: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<PendingPayments>;
  let requested: Booking[];

  function render(page: unknown = of({ items: [], truncated: false })): HTMLElement {
    searchBookings = vi.fn().mockReturnValue(page);
    TestBed.configureTestingModule({
      providers: [{ provide: SchedulingClient, useValue: { searchBookings } }],
    });
    fixture = TestBed.createComponent(PendingPayments);
    fixture.componentRef.setInput('resourceId', 'r-1');
    requested = [];
    fixture.componentInstance.registerRequested.subscribe((b) => requested.push(b));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const items = (...bookings: Booking[]) =>
    of({ items: bookings, truncated: false } as unknown as BookingPage);
  const q = (root: HTMLElement, id: string) =>
    root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const rows = (root: HTMLElement) => [
    ...root.querySelectorAll('[data-testid="pending-payment-row"]'),
  ];

  beforeEach(() => localStorage.clear());

  it('pide solo no canceladas del recurso, en una ventana de hoy -30 a hoy +7', () => {
    render();

    const query = searchBookings.mock.calls[0][0];
    expect(query.resourceId).toBe('r-1');
    expect(query.includeCancelled).toBe(false);
    const days = (query.to.getTime() - query.from.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(36.5);
    expect(days).toBeLessThanOrEqual(38.5);
  });

  it('lista las no pagadas, las más viejas primero, y quita las pagadas', () => {
    const root = render(
      items(
        booking('b-nueva', '2026-10-28T15:00:00.000Z'),
        booking('b-pagada', '2026-10-20T15:00:00.000Z', {
          paymentState: paymentState('PAID', 'Pagada'),
        }),
        booking('b-vieja', '2026-10-10T15:00:00.000Z', {
          paymentState: paymentState('PARTIALLY_PAID', 'Parcialmente pagada'),
        }),
      ),
    );

    const names = rows(root).map((row) => row.querySelector('strong')?.textContent?.trim());
    expect(names).toEqual(['Paciente b-vieja', 'Paciente b-nueva']);
    expect(q(root, 'pending-payments-toggle')?.textContent).toContain('(2)');
    const badges = rows(root).map((row) => row.querySelector('app-badge')?.textContent?.trim());
    expect(badges).toEqual(['Parcialmente pagada', 'Sin registrar']);
  });

  it('una cita marcada como pagada sale en el acto, sin releer', () => {
    const root = render(items(booking('b-1', '2026-10-10T15:00:00.000Z')));
    expect(rows(root)).toHaveLength(1);

    TestBed.inject(BookingPaymentStates).record('b-1', paymentState('PAID', 'Pagada'));
    fixture.detectChanges();

    expect(rows(root)).toHaveLength(0);
    expect(q(root, 'pending-payments-empty')?.textContent).toContain('No hay pagos por registrar');
    expect(searchBookings).toHaveBeenCalledTimes(1);
  });

  it('muestra el monto recibido si existe', () => {
    const root = render(items(booking('b-1', '2026-10-10T15:00:00.000Z')));
    TestBed.inject(ReceivedAmountStore).set('b-1', 150);
    fixture.detectChanges();

    expect(q(root, 'pending-payment-received')?.textContent).toContain('Bs 150,00');
  });

  it('vacío: dice que no hay pagos y queda cerrado', () => {
    const root = render();

    expect(q(root, 'pending-payments-empty')).not.toBeNull();
    expect(root.querySelector('details')?.open).toBe(false);
    expect(q(root, 'pending-payments-toggle')?.textContent).toContain('(0)');
  });

  it('con pendientes queda abierto, y el título se puede plegar', () => {
    const root = render(items(booking('b-1', '2026-10-10T15:00:00.000Z')));
    const details = root.querySelector('details')!;
    expect(details.open).toBe(true);

    q(root, 'pending-payments-toggle')!.click();
    fixture.detectChanges();

    expect(details.open).toBe(false);
  });

  it('cargando: esqueleto, sin contador', () => {
    const root = render(new Subject());

    expect(q(root, 'pending-payments-loading')).not.toBeNull();
    expect(q(root, 'pending-payments-toggle')?.textContent).not.toContain('(');
  });

  it('error: avisa y Reintentar vuelve a pedir', () => {
    const root = render(throwError(() => new Error('falla')));
    expect(q(root, 'pending-payments-error')).not.toBeNull();

    searchBookings.mockReturnValue(items(booking('b-1', '2026-10-10T15:00:00.000Z')));
    q(root, 'pending-payments-retry')!.click();
    fixture.detectChanges();

    expect(searchBookings).toHaveBeenCalledTimes(2);
    expect(rows(root)).toHaveLength(1);
  });

  it('relee cuando cambia el token', () => {
    render();

    fixture.componentRef.setInput('reloadToken', 1);
    fixture.detectChanges();

    expect(searchBookings).toHaveBeenCalledTimes(2);
  });

  it('«Registrar pago» emite la cita y su nombre accesible trae paciente y hora', () => {
    const cita = booking('b-1', '2026-10-10T15:00:00.000Z');
    const root = render(items(cita));
    const button = q(root, 'pending-payment-register')!;

    expect(button.getAttribute('aria-label')).toMatch(/^Registrar pago: Paciente b-1, \d\d:\d\d$/);
    button.click();

    expect(requested).toEqual([cita]);
  });
});

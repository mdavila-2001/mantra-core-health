import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { CenterScheduleClient } from '../../../core/data-access/diagnostic-units/center-schedule.client';
import type { CenterBooking } from '../../../core/data-access/diagnostic-units/center-schedule.types';
import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type { LabOrder, LabSummary } from '../../../core/data-access/lab-portal/lab-portal.types';
import { LaboratorySummaryPage } from './laboratory-summary';

/**
 * La portada del centro de diagnóstico: saludo con el nombre del centro y cuatro
 * bloques —órdenes de hoy, resultados pendientes, turnos del día, catálogo—,
 * cada uno con su estado: si uno falla, los otros siguen a la vista.
 */

const SUMMARY = {
  labName: 'Laboratorio Andino',
  published: 12,
  drafts: 2,
  withdrawn: 1,
  unavailable: 1,
  ordersWithoutResults: 3,
  resultFiles: 40,
  resultBytes: 2_097_152,
  byCategory: [],
  recentActivity: [{ id: 'a-1', kind: 'RESULT_UPLOADED', text: 'Se subió hemograma.pdf', at: '2026-10-30T12:00:00Z' }],
} as LabSummary;

const order = (orderId: string, status: LabOrder['status'], requestedAt: string): LabOrder => ({
  orderId,
  studyName: `Estudio ${orderId}`,
  patientName: `Paciente ${orderId}`,
  requesterName: 'Dra. Rojas',
  requestedAt,
  status,
  reason: null,
  files: [],
});

const ORDERS: LabOrder[] = [
  order('a', 'DRAFT', '2026-11-04T10:00:00Z'),
  order('b', 'DRAFT', '2026-11-04T09:00:00Z'),
  order('c', 'RECEIVED', '2026-11-03T09:00:00Z'),
  order('d', 'PROCESSED', '2026-11-02T09:00:00Z'),
  order('e', 'UPLOADED', '2026-11-01T09:00:00Z'),
];

const BOOKING: CenterBooking = {
  bookingId: 'bk-1',
  orderId: 'a',
  patientName: 'Ana Pérez',
  studyName: 'Hemograma',
  startsAt: '2026-11-04T11:30:00Z',
  endsAt: '2026-11-04T12:15:00Z',
  siteName: 'Sede central',
  status: 'BOOKING_CONFIRMED',
};

describe('LaboratorySummaryPage (portada del centro de diagnóstico)', () => {
  let fixture: ComponentFixture<LaboratorySummaryPage>;
  let lab: { getSummary: ReturnType<typeof vi.fn>; listOrders: ReturnType<typeof vi.fn> };
  let schedule: { getMySchedule: ReturnType<typeof vi.fn>; getMyBookings: ReturnType<typeof vi.fn> };
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(LaboratorySummaryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    lab = {
      getSummary: vi.fn(() => of(SUMMARY)),
      listOrders: vi.fn(() => of({ items: ORDERS, count: ORDERS.length })),
    };
    schedule = {
      getMySchedule: vi.fn(() => of({ kind: 'LABORATORY' })),
      getMyBookings: vi.fn(() => of({ items: [BOOKING], count: 1 })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LabPortalClient, useValue: lab },
        { provide: CenterScheduleClient, useValue: schedule },
      ],
    });
  });

  it('saluda con el nombre del centro', async () => {
    await render();
    expect(root().querySelector('h1')?.textContent).toContain('Laboratorio Andino');
  });

  it('cuenta las órdenes por paso y cada cifra abre su pestaña', async () => {
    await render();
    expect(q('lab-home-count-draft')?.textContent).toContain('2');
    expect(q('lab-home-count-received')?.textContent).toContain('1');
    expect(q('lab-home-count-processed')?.textContent).toContain('1');
    expect(q('lab-home-count-draft')?.getAttribute('href')).toBe('/administration/laboratory-orders?estado=draft');
    expect(q('lab-home-count-processed')?.getAttribute('href')).toBe('/administration/laboratory-orders?estado=processed');
    const recent = q('lab-home-recent-orders')!.querySelectorAll('li');
    expect(recent).toHaveLength(4);
    expect(recent[0]!.textContent).toContain('Estudio a');
  });

  it('los resultados pendientes son las procesadas sin archivo, con su enlace para subir', async () => {
    await render();
    const rows = q('lab-home-pending-list')!.querySelectorAll('li');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent).toContain('Estudio d');
    expect(q('lab-home-upload')?.getAttribute('href')).toBe('/administration/laboratory-orders?estado=processed');
    expect(q('summary-result-files')?.textContent).toBe('40');
    expect(q('summary-activity')?.textContent).toContain('último: hemograma, hace');
    expect(q('summary-activity')?.textContent).not.toContain('Se subió');
  });

  it('pide los turnos de hoy y los lista', async () => {
    await render();
    const [from, to] = schedule.getMyBookings.mock.calls[0] as [Date, Date];
    expect(to.getTime() - from.getTime()).toBe(86_400_000);
    expect(q('lab-home-bookings-list')?.textContent).toContain('Ana Pérez');
    expect(q('lab-home-bookings-list')?.textContent).toContain('Confirmada');
  });

  it('el catálogo muestra publicados, borradores y no disponibles, y lleva a Precios', async () => {
    await render();
    expect(q('summary-published')?.textContent).toBe('12');
    expect(q('summary-drafts')?.textContent).toBe('2');
    expect(q('summary-unavailable')?.textContent).toBe('1');
    expect(q('lab-home-prices')?.getAttribute('href')).toBe('/administration/laboratory-prices');
  });

  it('si fallan las órdenes, el catálogo y los turnos siguen a la vista', async () => {
    lab.listOrders.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    await render();
    expect(q('lab-home-recent-orders')).toBeNull();
    expect(q('lab-home-pending-list')).toBeNull();
    expect(q('summary-published')?.textContent).toBe('12');
    expect(q('lab-home-bookings-list')).not.toBeNull();
  });

  it('si falla el resumen, las órdenes siguen y el saludo no queda vacío', async () => {
    lab.getSummary.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    schedule.getMySchedule.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    await render();
    expect(q('summary-published')).toBeNull();
    expect(q('lab-home-count-draft')).not.toBeNull();
    expect(q('lab-home-name')?.textContent?.trim()).toBe('Su centro');
  });

  it('un centro de imagen habla de estudios, no de muestras', async () => {
    schedule.getMySchedule.mockReturnValue(of({ kind: 'IMAGING' }));
    await render();
    expect(q('lab-home-count-draft')?.textContent).toContain('estudios');
    expect(q('lab-home-count-received')?.textContent).toContain('Estudios por informar');
  });

  it('sin órdenes, la tarjeta de órdenes sólo ofrece la acción del estado vacío', async () => {
    lab.listOrders.mockReturnValue(of({ items: [], count: 0 }));
    await render();
    expect(q('lab-home-orders-all')).toBeNull();
    expect(q('lab-home-orders')?.querySelectorAll('a')).toHaveLength(1);
  });

  it('sin turnos hoy lo dice y ofrece revisar los horarios', async () => {
    schedule.getMyBookings.mockReturnValue(of({ items: [], count: 0 }));
    await render();
    expect(q('lab-home-bookings')?.textContent).toContain('Hoy no hay turnos reservados');
    // The empty state carries the only action: no second button in the footer.
    expect(q('lab-home-bookings')?.querySelectorAll('a')).toHaveLength(1);
  });

  it('el recuento de turnos es una insignia con nombre accesible', async () => {
    await render();
    const badge = q('lab-home-bookings')!.querySelector('app-badge');
    expect(badge?.getAttribute('aria-label')).toBe('1 turno hoy');
  });

  it('un turno sin nombre de paciente ni de estudio lo dice, no deja un hueco', async () => {
    schedule.getMyBookings.mockReturnValue(of({ items: [{ ...BOOKING, patientName: null, studyName: null, siteName: null }], count: 1 }));
    await render();
    expect(q('lab-home-bookings-list')?.textContent).toContain('Paciente sin nombre');
    expect(q('lab-home-bookings-list')?.textContent).toContain('Estudio sin nombre');
  });
});

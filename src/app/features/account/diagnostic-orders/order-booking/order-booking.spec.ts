import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { CenterScheduleClient } from '../../../../core/data-access/diagnostic-units/center-schedule.client';
import type {
  OrderAppointment,
  OrderBookingOptions,
  StudyAvailability,
} from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import { OrderBooking } from './order-booking';

const OPCIONES: OrderBookingOptions = {
  orderId: 'orden-1',
  studyCode: 'STUDY-ECO-ABD',
  studyName: 'Ecografía abdominal',
  modalityCode: 'ECO',
  modalityLabel: 'Ecografía',
  options: [
    {
      unitId: 'caro',
      unitName: 'Centro Caro',
      addressText: null,
      price: 500,
      currency: 'BOB',
      distanceKm: 1,
      nextStartAt: '2026-10-07T12:00:00.000Z',
      preparation: null,
      operationalEquipment: 1,
    },
    {
      unitId: 'sur',
      unitName: 'Centro de Imagen Sur',
      addressText: 'Av. Cristo Redentor, km 4',
      price: 340,
      currency: 'BOB',
      distanceKm: 4.5,
      nextStartAt: '2026-10-06T12:00:00.000Z',
      preparation: 'Ayuno de 6 a 8 horas.',
      operationalEquipment: 1,
    },
  ],
};

const HORARIOS: StudyAvailability = {
  unitId: 'sur',
  studyCode: 'STUDY-ECO-ABD',
  origin: 'MODALITY',
  items: [
    { startAt: '2026-10-06T12:00:00.000Z', endAt: '2026-10-06T12:30:00.000Z', remaining: 1, capacity: 1 },
    { startAt: '2026-10-06T12:30:00.000Z', endAt: '2026-10-06T13:00:00.000Z', remaining: 1, capacity: 1 },
  ],
};

const TURNO: OrderAppointment = {
  bookingId: 'b-1',
  unitId: 'sur',
  unitName: 'Centro de Imagen Sur',
  addressText: null,
  startAt: HORARIOS.items[0]!.startAt,
  endAt: HORARIOS.items[0]!.endAt,
  studyName: 'Ecografía abdominal',
  price: 340,
  currency: 'BOB',
  preparation: 'Ayuno de 6 a 8 horas.',
};

async function montar(cliente: Partial<CenterScheduleClient>) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'my-account/diagnostic-orders/:orderId/book', component: OrderBooking }]),
      { provide: CenterScheduleClient, useValue: cliente },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/my-account/diagnostic-orders/orden-1/book');
  harness.fixture.detectChanges();
  const el = harness.routeNativeElement as HTMLElement;
  const boton = (texto: string | RegExp): HTMLButtonElement =>
    [...el.querySelectorAll('button')].find((b) =>
      typeof texto === 'string' ? b.textContent?.trim() === texto || b.getAttribute('aria-label') === texto : texto.test(b.textContent ?? ''),
    ) as HTMLButtonElement;
  const clic = async (b: HTMLButtonElement): Promise<void> => {
    b.click();
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
  };
  return { harness, el, boton, clic };
}

describe('OrderBooking', () => {
  it('muestra el estudio de la orden y los centros, primero el que atiende antes', async () => {
    const { el } = await montar({ getBookingOptions: () => of(OPCIONES) });
    expect(el.querySelector('[data-testid="reserva-estudio-orden"]')?.textContent).toContain('Ecografía abdominal');
    const centros = [...el.querySelectorAll('[data-testid="reserva-estudio-centro"]')].map((c) => c.textContent ?? '');
    expect(centros[0]).toContain('Centro de Imagen Sur');
    expect(centros[1]).toContain('Centro Caro');
  });

  it('no pide motivo: elegir centro y horario lleva directo a confirmar, y confirmar reserva ese horario', async () => {
    const bookOrder = vi.fn(() => of(TURNO));
    const { el, boton, clic } = await montar({
      getBookingOptions: () => of(OPCIONES),
      getStudyAvailability: () => of(HORARIOS),
      bookOrder,
    });
    await clic(boton('Ver horarios de Centro de Imagen Sur'));
    const horarios = el.querySelectorAll<HTMLButtonElement>('[data-testid="reserva-estudio-horario"]');
    expect(horarios.length).toBe(2);
    await clic(horarios[0]!);
    expect(el.querySelector('textarea')).toBeNull();
    expect(el.querySelector('[data-testid="reserva-estudio-resumen"]')?.textContent).toContain('Ayuno de 6 a 8 horas.');
    await clic(el.querySelector<HTMLButtonElement>('[data-testid="reserva-estudio-confirmar"]')!);
    expect(bookOrder).toHaveBeenCalledWith('orden-1', 'sur', HORARIOS.items[0]!.startAt);
    expect(el.querySelector('[data-testid="reserva-estudio-listo"]')?.textContent).toContain('Cita confirmada');
  });

  it('si el horario se ocupó en el medio, avisa y vuelve a los horarios', async () => {
    const getStudyAvailability = vi.fn(() => of(HORARIOS));
    const { el, boton, clic } = await montar({
      getBookingOptions: () => of(OPCIONES),
      getStudyAvailability,
      bookOrder: () => throwError(() => new HttpErrorResponse({ status: 409, error: { details: { slotTaken: true } } })),
    });
    await clic(boton('Ver horarios de Centro de Imagen Sur'));
    await clic(el.querySelector<HTMLButtonElement>('[data-testid="reserva-estudio-horario"]')!);
    await clic(el.querySelector<HTMLButtonElement>('[data-testid="reserva-estudio-confirmar"]')!);
    expect(el.querySelector('[data-testid="reserva-estudio-aviso"]')?.textContent).toContain('Ese horario se ocupó');
    expect(el.querySelectorAll('[data-testid="reserva-estudio-horario"]').length).toBe(2);
    expect(getStudyAvailability).toHaveBeenCalledTimes(2);
  });

  it('si la orden ya tenía turno, no ofrece confirmar de nuevo y lleva a «Mis órdenes»', async () => {
    const { el, boton, clic } = await montar({
      getBookingOptions: () => of(OPCIONES),
      getStudyAvailability: () => of(HORARIOS),
      bookOrder: () => throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Esta orden ya tiene un turno.' } })),
    });
    await clic(boton('Ver horarios de Centro de Imagen Sur'));
    await clic(el.querySelector<HTMLButtonElement>('[data-testid="reserva-estudio-horario"]')!);
    await clic(el.querySelector<HTMLButtonElement>('[data-testid="reserva-estudio-confirmar"]')!);
    expect(el.querySelector('[data-testid="reserva-estudio-aviso"]')?.textContent).toContain('Esta orden ya tiene cita');
    expect(el.querySelector('[data-testid="reserva-estudio-confirmar"]')).toBeNull();
    expect(el.querySelector('[data-testid="reserva-estudio-ir-a-ordenes"]')?.getAttribute('href')).toBe('/my-account/diagnostic-orders');
  });

  it('sin centros que hagan el estudio, ofrece volver a las órdenes', async () => {
    const { el } = await montar({ getBookingOptions: () => of({ ...OPCIONES, options: [] }) });
    expect(el.textContent).toContain('Todavía ningún centro de la red publica horarios para Ecografía abdominal.');
    expect(el.querySelector('a[href="/my-account/diagnostic-orders"]')).not.toBeNull();
  });
});

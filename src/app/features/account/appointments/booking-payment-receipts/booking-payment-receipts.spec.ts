import { HttpErrorResponse } from '@angular/common/http';
import type { Signal, WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { FilesClient } from '../../../../core/data-access/files/files.client';
import { PaymentReceiptsClient } from '../../../../core/data-access/scheduling/payment-receipts.client';
import type { PaymentReceipt } from '../../../../core/data-access/scheduling/payment-receipts.types';
import { SchedulingClient } from '../../../../core/data-access/scheduling/scheduling.client';
import type { PaymentStateInfo } from '../../../../core/data-access/scheduling/scheduling.types';
import { BookingPaymentReceipts } from './booking-payment-receipts';

const PENDING: PaymentReceipt = {
  id: 'r-1',
  bookingId: 'b-1',
  fileId: 'f-1',
  mimeType: 'image/png',
  originalName: 'transferencia.png',
  amount: '150.00',
  paidAt: null,
  note: null,
  uploadedAt: new Date('2026-10-27T13:00:00.000Z'),
  uploadedBy: { userId: 'u-paciente', displayName: 'Ana Pérez' },
  status: 'PENDING',
  reviewedAt: null,
  reviewedBy: null,
  rejectionReason: null,
};

const REJECTED: PaymentReceipt = {
  ...PENDING,
  id: 'r-0',
  status: 'REJECTED',
  rejectionReason: 'No se lee el monto',
  uploadedAt: new Date('2026-10-26T13:00:00.000Z'),
};

const PAID: PaymentStateInfo = {
  state: 'PAID',
  label: 'Pagada',
  conceptId: 'c-pagada',
  insuranceUsed: false,
  markedByUserId: 'u-medica',
  markedAt: new Date('2026-10-28T10:00:00.000Z'),
};

/** Lo que el bloque guarda del formulario, para llenarlo sin pasar por el diálogo del sistema. */
interface FormState {
  readonly files: WritableSignal<readonly File[]>;
  readonly amount: WritableSignal<string>;
  readonly note: WritableSignal<string>;
  readonly uploading: Signal<boolean>;
}

/** La cita como la devuelve `getBooking`: lo único que el bloque lee es su pago. */
function booking(id: string, paymentState?: PaymentStateInfo): { id: string; paymentState?: PaymentStateInfo } {
  return paymentState === undefined ? { id } : { id, paymentState };
}

describe('BookingPaymentReceipts', () => {
  let fixture: ComponentFixture<BookingPaymentReceipts>;
  let list: ReturnType<typeof vi.fn>;
  let uploadReceipt: ReturnType<typeof vi.fn>;
  let uploadFile: ReturnType<typeof vi.fn>;
  let getBooking: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    list = vi.fn().mockReturnValue(of([REJECTED]));
    uploadReceipt = vi.fn().mockReturnValue(of(PENDING));
    uploadFile = vi.fn().mockReturnValue(of({ id: 'f-nuevo' }));
    getBooking = vi.fn((id: string) => of(booking(id)));
    TestBed.configureTestingModule({
      imports: [BookingPaymentReceipts],
      providers: [
        { provide: PaymentReceiptsClient, useValue: { list, upload: uploadReceipt } },
        { provide: FilesClient, useValue: { upload: uploadFile } },
        { provide: SchedulingClient, useValue: { getBooking } },
      ],
    });
  });

  function mount(inputs: Record<string, unknown> = {}, receipts?: readonly PaymentReceipt[]): HTMLElement {
    if (receipts !== undefined) list.mockReturnValue(of(receipts));
    fixture = TestBed.createComponent(BookingPaymentReceipts);
    fixture.componentRef.setInput('bookingId', 'b-1');
    fixture.componentRef.setInput('statusCode', 'BOOKING_CONFIRMED');
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function form(): FormState {
    return fixture.componentInstance as unknown as FormState;
  }

  function byTestId(testid: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  }

  function all(testid: string): HTMLElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)];
  }

  function submit(): void {
    byTestId('booking-receipts-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  function openBooking(bookingId: string): void {
    fixture.componentRef.setInput('bookingId', bookingId);
    fixture.detectChanges();
  }

  it('lista lo que ya subió, con su estado y el motivo del rechazado', () => {
    mount();

    expect(list).toHaveBeenCalledWith('b-1');
    expect(byTestId('booking-receipt-status')?.textContent?.trim()).toBe('Rechazado');
    expect(byTestId('booking-receipt-rejection-reason')?.textContent).toContain('No se lee el monto');
    expect(byTestId('booking-receipt-rejection-reason')?.textContent).toContain('Puede subir otro comprobante');
  });

  it('sube primero el archivo y después el comprobante, con el monto como lo pide la API', () => {
    mount();
    const file = new File(['%PDF-1.4'], 'pago.pdf', { type: 'application/pdf' });
    form().files.set([file]);
    form().amount.set('150,5');
    form().note.set('  Pagué desde la cuenta de mi esposo  ');
    fixture.detectChanges();

    submit();

    expect(uploadFile).toHaveBeenCalledWith(file, 'DOCUMENT', 'NORMAL');
    expect(uploadReceipt).toHaveBeenCalledWith('b-1', {
      fileId: 'f-nuevo',
      amount: '150.5',
      note: 'Pagué desde la cuenta de mi esposo',
    });
    expect(byTestId('booking-receipts-notice')?.textContent).toContain('Comprobante enviado');
    // Lo recién subido encabeza la lista y el formulario vuelve a cero.
    expect(byTestId('booking-receipt-status')?.textContent?.trim()).toBe('Pendiente');
    expect(form().files()).toEqual([]);
  });

  it('sin archivo, o con un monto que no es dinero, no se sube nada', () => {
    mount();
    // `app-button` deshabilita con `aria-disabled`, no con el atributo nativo.
    expect(byTestId('booking-receipt-submit')?.getAttribute('aria-disabled')).toBe('true');

    form().files.set([new File(['x'], 'foto.png', { type: 'image/png' })]);
    form().amount.set('ciento cincuenta');
    fixture.detectChanges();
    submit();

    expect(uploadFile).not.toHaveBeenCalled();
    expect(byTestId('booking-receipts-form')?.textContent).toContain('con hasta dos decimales');
  });

  it('una cita pagada no ofrece subir y lo explica: el pago lo lee el bloque de la cita', () => {
    getBooking.mockReturnValue(of(booking('b-1', PAID)));
    mount();

    expect(getBooking).toHaveBeenCalledWith('b-1');
    expect(byTestId('booking-receipts-form')).toBeNull();
    expect(byTestId('booking-receipts-blocked')?.textContent).toContain('ya figura como pagada');
  });

  describe('H03: el pago que ya trajo la lista (`knownPaymentState`)', () => {
    it('la cita sola sin paymentState y la lista dice PAID: «ya figura como pagada», sin formulario', () => {
      mount({ knownPaymentState: PAID });

      expect(byTestId('booking-receipts-form')).toBeNull();
      expect(byTestId('booking-receipts-blocked')?.textContent).toContain('ya figura como pagada');
    });

    it('la cita sola con paymentState manda sobre la de la lista', () => {
      getBooking.mockReturnValue(
        of(booking('b-1', { ...PAID, state: 'PENDING', label: 'Pendiente de pago' })),
      );
      mount({ knownPaymentState: PAID });

      expect(byTestId('booking-receipts-blocked')).toBeNull();
      expect(byTestId('booking-receipts-form')).not.toBeNull();
    });

    it('si la cita sola no se pudo leer, usa la de la lista', () => {
      getBooking.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
      mount({ knownPaymentState: PAID });

      expect(byTestId('booking-receipts-form')).toBeNull();
      expect(byTestId('booking-receipts-blocked')?.textContent).toContain('ya figura como pagada');
    });
  });

  it('mientras no se sabe si la cita está pagada, no ofrece subir', () => {
    getBooking.mockReturnValue(new Subject());
    mount();

    expect(byTestId('booking-receipts-form')).toBeNull();
    expect(byTestId('booking-receipts-blocked')).toBeNull();
  });

  it('si no se pudo leer la cita, ofrece subir: si ya estaba pagada, la API lo dice', () => {
    getBooking.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    mount();

    expect(byTestId('booking-receipts-form')).not.toBeNull();
  });

  it('un comprobante confirmado también la da por pagada', () => {
    mount({}, [{ ...PENDING, status: 'CONFIRMED' }]);

    expect(byTestId('booking-receipts-form')).toBeNull();
  });

  it('una cita cancelada no lleva comprobante y lo dice', () => {
    mount({ statusCode: 'scheduling:BOOKING_CANCELLED' });

    expect(byTestId('booking-receipts-form')).toBeNull();
    expect(byTestId('booking-receipts-blocked')?.textContent).toContain('se canceló');
  });

  it('sólo la cancelada no lleva pago: la API no publica un estado «rechazada»', () => {
    mount({ statusCode: 'scheduling:BOOKING_REJECTED' });

    expect(byTestId('booking-receipts-blocked')).toBeNull();
    expect(byTestId('booking-receipts-form')).not.toBeNull();
  });

  it('si la API dice que ya está pagada (409), lo explica y deja de ofrecer subir', () => {
    mount();
    uploadReceipt.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { code: 'CONFLICT', message: 'La cita ya está pagada: no hace falta otro comprobante.' },
          }),
      ),
    );
    form().files.set([new File(['x'], 'foto.png', { type: 'image/png' })]);
    fixture.detectChanges();

    submit();

    expect(uploadFile).toHaveBeenCalledWith(expect.any(File), 'IMAGE', 'NORMAL');
    expect(byTestId('booking-receipts-notice')?.textContent).toContain('ya figura como pagada');
    expect(byTestId('booking-receipts-form')).toBeNull();
  });

  it('si la API rechaza el archivo (422), muestra su motivo y el formulario sigue', () => {
    mount();
    uploadReceipt.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 'PRECONDITION_FAILED', message: 'El comprobante supera los 5 MB' },
          }),
      ),
    );
    form().files.set([new File(['x'], 'foto.png', { type: 'image/png' })]);
    fixture.detectChanges();

    submit();

    expect(byTestId('booking-receipts-notice')?.textContent).toContain('El comprobante supera los 5 MB');
    expect(byTestId('booking-receipts-form')).not.toBeNull();
  });

  it('reintentar la lista no borra lo que se estaba escribiendo', () => {
    list.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
    mount();
    form().amount.set('150');
    fixture.detectChanges();

    const retry = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Reintentar'),
    );
    retry!.click();
    fixture.detectChanges();

    expect(list).toHaveBeenCalledTimes(2);
    expect(form().amount()).toBe('150');
    expect(byTestId('booking-receipt-status')?.textContent?.trim()).toBe('Rechazado');
  });

  describe('otra cita es otro bloque', () => {
    it('al cambiar de cita, el formulario y la lista empiezan de cero', () => {
      const second = new Subject<readonly PaymentReceipt[]>();
      list.mockImplementation((id: string) => (id === 'b-1' ? of([REJECTED]) : second));
      mount();
      form().amount.set('150');
      fixture.detectChanges();

      openBooking('b-2');

      expect(form().amount()).toBe('');
      expect(all('booking-receipt-item')).toHaveLength(0);
      expect(list).toHaveBeenLastCalledWith('b-2');
    });

    it('lo que la cita anterior responde tarde no pisa a la que se mira', () => {
      const receipts = { 'b-1': new Subject<readonly PaymentReceipt[]>(), 'b-2': new Subject<readonly PaymentReceipt[]>() };
      const payments = { 'b-1': new Subject<unknown>(), 'b-2': new Subject<unknown>() };
      list.mockImplementation((id: 'b-1' | 'b-2') => receipts[id]);
      getBooking.mockImplementation((id: 'b-1' | 'b-2') => payments[id]);
      mount();

      openBooking('b-2');
      receipts['b-2'].next([{ ...PENDING, id: 'r-b2', bookingId: 'b-2' }]);
      payments['b-2'].next(booking('b-2'));
      // La cita A contesta después: pagada y con un rechazado.
      receipts['b-1'].next([REJECTED]);
      payments['b-1'].next(booking('b-1', PAID));
      fixture.detectChanges();

      expect(all('booking-receipt-status').map((badge) => badge.textContent?.trim())).toEqual(['Pendiente']);
      expect(byTestId('booking-receipts-blocked')).toBeNull();
      expect(byTestId('booking-receipts-form')).not.toBeNull();
    });

    it('una subida que termina con otra cita abierta va a la suya y no cae en la que se mira', () => {
      const fileUpload = new Subject<{ id: string }>();
      const receiptUpload = new Subject<PaymentReceipt>();
      uploadFile.mockReturnValue(fileUpload);
      uploadReceipt.mockReturnValue(receiptUpload);
      list.mockImplementation((id: string) => of(id === 'b-1' ? [REJECTED] : []));
      mount();
      form().files.set([new File(['x'], 'foto.png', { type: 'image/png' })]);
      form().amount.set('150');
      fixture.detectChanges();
      submit();

      // Mientras sube, abre otra cita.
      openBooking('b-2');
      expect(form().uploading()).toBe(false);
      fileUpload.next({ id: 'f-nuevo' });
      fileUpload.complete();

      // El comprobante sale a la cita en que se envió, con lo que se había escrito.
      expect(uploadReceipt).toHaveBeenCalledWith('b-1', { fileId: 'f-nuevo', amount: '150' });
      receiptUpload.next({ ...PENDING, id: 'r-nuevo' });
      receiptUpload.complete();
      fixture.detectChanges();

      expect(byTestId('booking-receipts-notice')).toBeNull();
      expect(all('booking-receipt-item')).toHaveLength(0);
      expect(form().uploading()).toBe(false);
    });
  });
});

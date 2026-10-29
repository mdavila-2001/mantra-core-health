import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { BookingPaymentStates } from '../booking-payment-states';
import { PaymentReceiptsDialog } from './payment-receipts-dialog';

const BOOKING = 'b-1';
const RECEIPTS_URL = `/scheduling/bookings/${BOOKING}/payment-receipts`;

/** Mediodía UTC: «27/10» en cualquier zona horaria de ±10 h. */
const IMAGE_RECEIPT = {
  id: 'r-img',
  bookingId: BOOKING,
  fileId: 'f-img',
  mimeType: 'image/png',
  originalName: 'transferencia.png',
  amount: '150.00',
  paidAt: '2026-10-27T12:00:00.000Z',
  note: 'Transferencia desde Banco Unión',
  uploadedAt: '2026-10-27T13:00:00.000Z',
  uploadedBy: { userId: 'u-paciente', displayName: 'Ana Pérez' },
  status: 'PENDING',
  reviewedAt: null,
  reviewedBy: null,
  rejectionReason: null,
};

const PDF_RECEIPT = {
  ...IMAGE_RECEIPT,
  id: 'r-pdf',
  fileId: 'f-pdf',
  mimeType: 'application/pdf',
  originalName: 'qr.pdf',
  amount: '80.50',
  paidAt: '2026-10-26T12:00:00.000Z',
  note: null,
  uploadedAt: '2026-10-28T09:00:00.000Z',
};

const PAID = {
  state: 'PAID',
  label: 'Pagada',
  conceptId: 'c-pagada',
  insuranceUsed: false,
  markedByUserId: 'u-medica',
  markedAt: '2026-10-28T10:00:00.000Z',
};

describe('PaymentReceiptsDialog', () => {
  let fixture: ComponentFixture<PaymentReceiptsDialog>;
  let http: HttpTestingController;
  let closed: number;
  const createObjectURL = URL.createObjectURL;
  const revokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    // jsdom no trae URL de objeto: se finge una por archivo.
    let next = 0;
    URL.createObjectURL = vi.fn(() => `blob:receipt-${(next += 1)}`);
    URL.revokeObjectURL = vi.fn();

    TestBed.configureTestingModule({
      imports: [PaymentReceiptsDialog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PaymentReceiptsDialog);
    fixture.componentRef.setInput('bookingId', BOOKING);
    fixture.componentRef.setInput('patientName', 'Ana Pérez');
    fixture.componentRef.setInput('startsAt', new Date('2026-10-28T17:00:00.000Z'));
    closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function byTestId(testid: string): HTMLElement | null {
    return root().querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  }

  function all(testid: string): HTMLElement[] {
    return [...root().querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)];
  }

  /**
   * Deja correr lo pendiente y redibuja. Una vuelta de la cola de tareas y no
   * sólo `whenStable()`: el camino de un error atraviesa varias promesas
   * encadenadas, y redibujar antes de que terminen mide un modal a medias.
   */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Responde la lista; las imágenes piden su miniatura y se sirven acá. */
  async function respond(receipts: unknown[] = [PDF_RECEIPT, IMAGE_RECEIPT]): Promise<void> {
    http.expectOne(RECEIPTS_URL).flush(receipts);
    await settle();
    for (const receipt of receipts as { id: string; mimeType: string }[]) {
      if (receipt.mimeType !== 'application/pdf') {
        http
          .expectOne(`${RECEIPTS_URL}/${receipt.id}/content`)
          .flush(new Blob(['png'], { type: receipt.mimeType }));
      }
    }
    await settle();
  }

  async function click(element: HTMLElement | null): Promise<void> {
    expect(element).not.toBeNull();
    element!.click();
    await settle();
  }

  it('el título nombra el modal: `aria-labelledby` apunta a «Comprobantes de pago»', () => {
    const dialog = root().querySelector('dialog')!;
    const title = root().querySelector(`#${dialog.getAttribute('aria-labelledby')}`);

    expect(title?.textContent?.trim()).toBe('Comprobantes de pago');
    http.expectOne(RECEIPTS_URL).flush([]);
  });

  it('mientras carga muestra el esqueleto de las filas', () => {
    expect(byTestId('payment-receipts-loading')).not.toBeNull();
    http.expectOne(RECEIPTS_URL).flush([]);
  });

  it('sin comprobantes lo dice y ofrece marcar el pago sin comprobante', async () => {
    await respond([]);

    expect(root().textContent).toContain('El paciente todavía no subió comprobantes');
    await click(byTestId('payment-receipts-manual-toggle'));
    expect(byTestId('payment-manual')).not.toBeNull();
  });

  describe('H04: el vacío no contradice el estado del pago', () => {
    function manualControls(): HTMLElement[] {
      return [...root().querySelectorAll<HTMLElement>('button')].filter((b) =>
        b.textContent?.includes('Marcar sin comprobante…'),
      );
    }

    for (const state of [
      { ...PAID },
      { ...PAID, state: 'PARTIALLY_PAID', label: 'Pagada en parte' },
    ]) {
      it(`${state.state} sin comprobantes: dice que se registró sin comprobante, sin pedirlo`, async () => {
        fixture.componentRef.setInput('paymentState', state);
        await respond([]);

        const text = root().textContent ?? '';
        expect(byTestId('payment-receipts-payment-state')?.textContent).toContain(state.label);
        expect(byTestId('payment-receipts-empty-paid')).not.toBeNull();
        expect(text).toContain('El pago se registró sin comprobante');
        expect(text).not.toContain('todavía no subió comprobantes');
        expect(text).not.toContain('márquelo sin comprobante');
        expect(manualControls()).toHaveLength(1);
      });
    }

    it('sin pago y sin comprobantes: un solo «Marcar sin comprobante…», el del pie', async () => {
      await respond([]);

      expect(byTestId('payment-receipts-empty-unpaid')).not.toBeNull();
      expect(manualControls()).toHaveLength(1);
      expect(manualControls()[0]?.dataset['testid']).toBe('payment-receipts-manual-toggle');

      await click(byTestId('payment-receipts-manual-toggle'));
      expect(byTestId('payment-manual')).not.toBeNull();
      expect(manualControls()).toHaveLength(0);
    });

    it('con comprobantes y el panel abierto: un solo control, «Ocultar el marcado sin comprobante»', async () => {
      await respond([PDF_RECEIPT]);
      expect(manualControls()).toHaveLength(1);

      await click(byTestId('payment-receipts-manual-toggle'));
      expect(manualControls()).toHaveLength(0);
      expect(byTestId('payment-receipts-manual-toggle')?.textContent?.trim()).toBe(
        'Ocultar el marcado sin comprobante',
      );
    });
  });

  it('si la lista falla, ofrece reintentar y vuelve a pedirla', async () => {
    http
      .expectOne(RECEIPTS_URL)
      .flush(
        { code: 'INTERNAL', message: 'Falló', correlationId: 'req-9' },
        { status: 500, statusText: 'Server Error' },
      );
    await settle();

    const retry = [...root().querySelectorAll('button')].find((b) => b.textContent?.includes('Reintentar'));
    await click(retry ?? null);

    http.expectOne(RECEIPTS_URL).flush([]);
  });

  it('lista del más reciente al más viejo, con monto, estado e insignia', async () => {
    // Desordenados a propósito: el orden lo pone el cliente, no la respuesta.
    await respond([IMAGE_RECEIPT, PDF_RECEIPT]);

    expect(all('payment-receipt-amount').map((el) => el.textContent?.trim())).toEqual([
      '80,50 Bs',
      '150,00 Bs',
    ]);
    expect(all('payment-receipt-status').map((el) => el.textContent?.trim())).toEqual([
      'Pendiente',
      'Pendiente',
    ]);
    expect(root().textContent).toContain('Transferencia desde Banco Unión');
    // La miniatura de la imagen son sus bytes; el PDF lleva su ícono.
    expect(root().querySelector('[data-kind="image"] img')?.getAttribute('src')).toMatch(/^blob:/);
  });

  it('cada acción dice sobre qué comprobante actúa', async () => {
    await respond();

    const labels = all('payment-receipt-confirm').map((b) => b.getAttribute('aria-label'));
    expect(labels).toContain('Confirmar comprobante de 150,00 Bs del 27/10');
    expect(all('payment-receipt-reject')[1]?.getAttribute('aria-label')).toBe(
      'Rechazar comprobante de 150,00 Bs del 27/10',
    );
  });

  it('confirmar marca la cita pagada con el estado que devolvió la API y la fila pierde sus acciones', async () => {
    await respond([PDF_RECEIPT]);

    await click(byTestId('payment-receipt-confirm'));
    // En vuelo: los botones quedan deshabilitados, no sale un segundo envío.
    // `app-button` deshabilita con `aria-disabled` y corta el clic él mismo.
    expect(all('payment-receipt-reject').every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
    byTestId('payment-receipt-confirm')!.click();
    const request = http.expectOne(`${RECEIPTS_URL}/r-pdf/confirm`);
    request.flush({ receipt: { ...PDF_RECEIPT, status: 'CONFIRMED' }, paymentState: PAID });
    await settle();

    expect(byTestId('payment-receipt-status')?.textContent?.trim()).toBe('Confirmado');
    expect(byTestId('payment-receipt-confirm')).toBeNull();
    expect(byTestId('payment-receipts-payment-state')?.textContent).toContain('Pagada');
    expect(byTestId('payment-receipts-notice')?.textContent).toContain('La cita quedó pagada.');
    expect(TestBed.inject(BookingPaymentStates).resolve(BOOKING, null)?.state).toBe('PAID');
  });

  it('con la cita ya pagada, los comprobantes pendientes no ofrecen confirmar, pero sí rechazar', async () => {
    fixture.componentRef.setInput('paymentState', { ...PAID, markedAt: new Date(PAID.markedAt) });
    await respond();

    expect(all('payment-receipt-confirm')).toHaveLength(0);
    expect(all('payment-receipt-reject')).toHaveLength(2);
  });

  it('confirmar uno deja la cita pagada: el otro pendiente ya no ofrece confirmar', async () => {
    await respond();

    await click(root().querySelector('[data-receipt-id="r-pdf"] [data-testid="payment-receipt-confirm"]'));
    http
      .expectOne(`${RECEIPTS_URL}/r-pdf/confirm`)
      .flush({ receipt: { ...PDF_RECEIPT, status: 'CONFIRMED' }, paymentState: PAID });
    await settle();

    const image = root().querySelector('[data-receipt-id="r-img"]');
    expect(image?.querySelector('[data-testid="payment-receipt-confirm"]')).toBeNull();
    expect(image?.querySelector('[data-testid="payment-receipt-reject"]')).not.toBeNull();
  });

  it('con otra operación en vuelo, el rechazo espera en vez de perderse', async () => {
    await respond();
    const reason = 'No se lee el monto';

    // Empieza a rechazar la imagen y escribe el motivo.
    await click(root().querySelector('[data-receipt-id="r-img"] [data-testid="payment-receipt-reject"]'));
    const textarea = byTestId('payment-receipt-rejection-form')!.querySelector('textarea')!;
    textarea.value = reason;
    textarea.dispatchEvent(new Event('input'));
    await settle();
    expect(byTestId('payment-receipt-rejection-submit')?.getAttribute('aria-disabled')).toBe('false');

    // Mientras confirma el PDF, el envío del rechazo espera: no sale ni se pierde.
    await click(root().querySelector('[data-receipt-id="r-pdf"] [data-testid="payment-receipt-confirm"]'));
    const confirmation = http.expectOne(`${RECEIPTS_URL}/r-pdf/confirm`);
    expect(byTestId('payment-receipt-rejection-submit')?.getAttribute('aria-disabled')).toBe('true');
    byTestId('payment-receipt-rejection-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    http.expectNone(`${RECEIPTS_URL}/r-img/reject`);
    expect(byTestId('payment-receipt-rejection-form')?.querySelector('textarea')?.value).toBe(reason);

    // Terminada la confirmación, el rechazo sale con lo que se había escrito.
    confirmation.flush({ receipt: { ...PDF_RECEIPT, status: 'CONFIRMED' }, paymentState: PAID });
    await settle();
    expect(byTestId('payment-receipt-rejection-submit')?.getAttribute('aria-disabled')).toBe('false');
    byTestId('payment-receipt-rejection-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    const rejection = http.expectOne(`${RECEIPTS_URL}/r-img/reject`);
    expect(rejection.request.body).toEqual({ reason });
    rejection.flush({ ...IMAGE_RECEIPT, status: 'REJECTED', rejectionReason: reason });
    await settle();

    expect(
      root().querySelector('[data-receipt-id="r-img"] [data-testid="payment-receipt-status"]')?.textContent?.trim(),
    ).toBe('Rechazado');
  });

  it('un 409 se explica y la lista se relee con su estado actual', async () => {
    await respond([PDF_RECEIPT]);

    await click(byTestId('payment-receipt-confirm'));
    http
      .expectOne(`${RECEIPTS_URL}/r-pdf/confirm`)
      .flush(
        { code: 'CONFLICT', message: 'Ese comprobante ya se rechazó: no se puede confirmar.' },
        { status: 409, statusText: 'Conflict' },
      );
    await settle();

    expect(byTestId('payment-receipts-notice')?.textContent).toContain('Este comprobante ya estaba rechazado');
    http
      .expectOne(RECEIPTS_URL)
      .flush([{ ...PDF_RECEIPT, status: 'REJECTED', rejectionReason: 'Es de otra cita' }]);
    await settle();
    expect(byTestId('payment-receipt-status')?.textContent?.trim()).toBe('Rechazado');
    expect(byTestId('payment-receipt-rejection-reason')?.textContent).toContain('Es de otra cita');
  });

  it('rechazar pide el motivo en el mismo modal: sin él no se envía y el campo dice por qué', async () => {
    await respond([PDF_RECEIPT]);

    await click(byTestId('payment-receipt-reject'));
    const form = byTestId('payment-receipt-rejection-form');
    const textarea = form?.querySelector('textarea');
    const submit = byTestId('payment-receipt-rejection-submit');
    expect(textarea).not.toBeNull();
    expect(submit?.getAttribute('aria-disabled')).toBe('true');

    textarea!.dispatchEvent(new Event('blur'));
    await settle();
    expect(form?.textContent).toContain('al menos 3 caracteres');

    textarea!.value = '  No se lee el monto  ';
    textarea!.dispatchEvent(new Event('input'));
    await settle();
    expect(byTestId('payment-receipt-rejection-submit')?.getAttribute('aria-disabled')).toBe('false');
    form!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();

    const request = http.expectOne(`${RECEIPTS_URL}/r-pdf/reject`);
    expect(request.request.body).toEqual({ reason: 'No se lee el monto' });
    request.flush({ ...PDF_RECEIPT, status: 'REJECTED', rejectionReason: 'No se lee el monto' });
    await settle();

    expect(byTestId('payment-receipt-rejection-form')).toBeNull();
    expect(byTestId('payment-receipt-status')?.textContent?.trim()).toBe('Rechazado');
    // Rechazar no cambia el pago de la cita.
    expect(byTestId('payment-receipts-payment-state')?.textContent).toContain('Sin registrar');
  });

  it('el visor abre el comprobante dentro del modal, con «Descargar», y vuelve a la lista', async () => {
    await respond([PDF_RECEIPT]);

    await click(byTestId('payment-receipt-view'));
    http
      .expectOne(`${RECEIPTS_URL}/r-pdf/content`)
      .flush(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
    await settle();

    expect(byTestId('payment-receipt-viewer')).not.toBeNull();
    expect(root().querySelector('iframe')).not.toBeNull();
    const download = byTestId('payment-receipt-download');
    expect(download?.getAttribute('download')).toBe('qr.pdf');
    expect(download?.getAttribute('href')).toMatch(/^blob:/);

    await click(byTestId('payment-receipt-viewer-back'));
    expect(byTestId('payment-receipt-viewer')).toBeNull();
    expect(byTestId('payment-receipt-confirm')).not.toBeNull();
  });

  it('marcar sin comprobante conserva el seguro y sale por PUT payment-state', async () => {
    fixture.componentRef.setInput('paymentState', {
      ...PAID,
      state: 'PENDING',
      label: 'Pendiente de pago',
      insuranceUsed: true,
      markedAt: new Date('2026-10-27T10:00:00.000Z'),
    });
    await respond([]);

    await click(byTestId('payment-receipts-manual-toggle'));
    await click(byTestId('payment-manual-PAID'));

    const request = http.expectOne(`/scheduling/bookings/${BOOKING}/payment-state`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ state: 'PAID', insuranceUsed: true });
    request.flush({ ...PAID, insuranceUsed: true });
    await settle();

    expect(byTestId('payment-receipts-notice')?.textContent).toContain('Pagada, con seguro.');
  });

  it('«Marcar sin comprobante…» apunta a su panel sólo mientras el panel existe', async () => {
    await respond([]);
    const toggle = byTestId('payment-receipts-manual-toggle')!;

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.hasAttribute('aria-controls')).toBe(false);

    await click(toggle);
    const panelId = toggle.getAttribute('aria-controls');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(panelId).not.toBeNull();
    expect(root().querySelector(`#${panelId}`)).not.toBeNull();

    await click(toggle);
    expect(toggle.hasAttribute('aria-controls')).toBe(false);
  });

  it('Escape cierra el modal', async () => {
    http.expectOne(RECEIPTS_URL).flush([]);
    await settle();

    root().querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle();

    expect(closed).toBe(1);
  });
});

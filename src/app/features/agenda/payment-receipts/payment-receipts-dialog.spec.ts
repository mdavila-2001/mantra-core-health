import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { PaymentStateInfo } from '../../../core/data-access/scheduling/scheduling.types';
import { PaymentReceiptsDialog, type PaymentReceiptsMode } from './payment-receipts-dialog';

const LISTA = '/scheduling/bookings/bk-1/payment-receipts';
const SUBIDA = '/common/files/upload';

/** Un comprobante tal como lo manda la API, con sus `null`. */
function comprobante(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'rc-1',
    bookingId: 'bk-1',
    fileId: 'f-1',
    mimeType: 'image/png',
    originalName: 'pago.png',
    amount: '150.00',
    paidAt: null,
    note: null,
    uploadedAt: '2026-10-27T14:00:00.000Z',
    uploadedBy: { userId: 'u-pac', displayName: 'Ana Pérez' },
    status: 'PENDING',
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    ...cambios,
  };
}

function unaImagen(): File {
  return new File([new Uint8Array([137, 80, 78, 71])], 'pago.png', { type: 'image/png' });
}

async function montar(mode: PaymentReceiptsMode, canUpload = true) {
  await TestBed.configureTestingModule({
    imports: [PaymentReceiptsDialog],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  }).compileComponents();

  const fixture: ComponentFixture<PaymentReceiptsDialog> =
    TestBed.createComponent(PaymentReceiptsDialog);
  fixture.componentRef.setInput('bookingId', 'bk-1');
  fixture.componentRef.setInput('cita', 'la cita del lunes 3 a las 09:30');
  fixture.componentRef.setInput('mode', mode);
  fixture.componentRef.setInput('canUpload', canUpload);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

function el(fixture: ComponentFixture<PaymentReceiptsDialog>, testId: string): HTMLElement | null {
  return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
}

/** Los miembros protegidos, para hablar de lo que hace sin pasar por el DOM. */
function api(fixture: ComponentFixture<PaymentReceiptsDialog>): Record<string, unknown> {
  return fixture.componentInstance as unknown as Record<string, unknown>;
}

function llamar(fixture: ComponentFixture<PaymentReceiptsDialog>, nombre: string, ...args: unknown[]) {
  (api(fixture)[nombre] as (...a: unknown[]) => unknown).apply(fixture.componentInstance, args);
  fixture.detectChanges();
}

function poner(fixture: ComponentFixture<PaymentReceiptsDialog>, nombre: string, valor: unknown) {
  (api(fixture)[nombre] as { set(v: unknown): void }).set(valor);
  fixture.detectChanges();
}

describe('PaymentReceiptsDialog — comprobantes de pago de una cita', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('el paciente', () => {
    it('sin comprobantes, ofrece subir uno', async () => {
      const { fixture, http } = await montar('paciente');
      http.expectOne(LISTA).flush([]);
      fixture.detectChanges();

      expect(el(fixture, 'comprobante-archivo')).not.toBeNull();
      expect(el(fixture, 'comprobantes-lista')).toBeNull();
    });

    /**
     * Dos pasos, como en el backend: el archivo entra a `common/files` subido
     * por el propio paciente y recién después se adjunta a la cita.
     */
    it('subir es el archivo primero y el comprobante después, con lo declarado', async () => {
      const { fixture, http } = await montar('paciente');
      http.expectOne(LISTA).flush([]);
      const cambios: unknown[] = [];
      fixture.componentInstance.changed.subscribe((c) => cambios.push(c));

      llamar(fixture, 'elegir', [unaImagen()]);
      poner(fixture, 'monto', '150,5');
      poner(fixture, 'nota', '  Pagué por QR  ');
      llamar(fixture, 'enviar');

      const subida = http.expectOne((r) => r.url === SUBIDA && r.method === 'POST');
      expect((subida.request.body as FormData).get('category')).toBe('IMAGE');
      // Dice quién pagó qué atención: se guarda como PHI.
      expect((subida.request.body as FormData).get('sensitivity')).toBe('PHI');
      subida.flush({ id: 'f-nuevo' });

      const adjuntar = http.expectOne((r) => r.url === LISTA && r.method === 'POST');
      // La coma se acepta y viaja como punto; la nota, recortada.
      expect(adjuntar.request.body).toEqual({ fileId: 'f-nuevo', amount: '150.5', note: 'Pagué por QR' });
      adjuntar.flush(comprobante({ fileId: 'f-nuevo' }));

      expect(cambios).toEqual([null]);
      // Se relee la lista: lo que se muestra es lo del servidor.
      http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush([comprobante()]);
      fixture.detectChanges();
      expect(el(fixture, 'comprobante-PENDING')).not.toBeNull();
    });

    it('un PDF se sube como documento', async () => {
      const { fixture, http } = await montar('paciente');
      http.expectOne(LISTA).flush([]);

      llamar(fixture, 'elegir', [new File(['%PDF'], 'pago.pdf', { type: 'application/pdf' })]);
      llamar(fixture, 'enviar');

      const subida = http.expectOne(SUBIDA);
      expect((subida.request.body as FormData).get('category')).toBe('DOCUMENT');
    });

    it('un monto mal escrito no deja enviar', async () => {
      const { fixture, http } = await montar('paciente');
      http.expectOne(LISTA).flush([]);

      llamar(fixture, 'elegir', [unaImagen()]);
      poner(fixture, 'monto', '150 Bs');

      // `app-button` deshabilita por `aria-disabled`, no con el atributo nativo.
      expect(el(fixture, 'comprobante-enviar')?.getAttribute('aria-disabled')).toBe('true');
      llamar(fixture, 'enviar');
      http.expectNone(SUBIDA);
    });

    /** Uno esperando revisión: subir otro sólo duplicaría el trabajo del médico. */
    it('con uno esperando revisión, no ofrece subir otro', async () => {
      const { fixture, http } = await montar('paciente');
      http.expectOne(LISTA).flush([comprobante()]);
      fixture.detectChanges();

      expect(el(fixture, 'comprobante-archivo')).toBeNull();
      expect(el(fixture, 'comprobante-pendiente')).not.toBeNull();
      // Y el paciente no ve los botones del revisor.
      expect(el(fixture, 'comprobante-confirmar')).toBeNull();
    });

    it('rechazado, muestra el motivo y deja subir otro', async () => {
      const { fixture, http } = await montar('paciente');
      http
        .expectOne(LISTA)
        .flush([comprobante({ status: 'REJECTED', rejectionReason: 'No se lee el monto', reviewedAt: '2026-10-27T15:00:00.000Z' })]);
      fixture.detectChanges();

      expect(el(fixture, 'comprobante-motivo')?.textContent).toContain('No se lee el monto');
      expect(el(fixture, 'comprobante-archivo')).not.toBeNull();
    });

    it('si la cita ya no admite uno, no ofrece subir', async () => {
      const { fixture, http } = await montar('paciente', false);
      http.expectOne(LISTA).flush([]);
      fixture.detectChanges();

      expect(el(fixture, 'comprobante-archivo')).toBeNull();
      expect(el(fixture, 'comprobante-no-aplica')).not.toBeNull();
    });

    /** 409: la cita se pagó con el modal abierto. Se dice por qué y se relee. */
    it('si el servidor rechaza el comprobante, muestra su motivo', async () => {
      const { fixture, http } = await montar('paciente');
      http.expectOne(LISTA).flush([]);

      llamar(fixture, 'elegir', [unaImagen()]);
      llamar(fixture, 'enviar');
      http.expectOne(SUBIDA).flush({ id: 'f-nuevo' });
      http
        .expectOne((r) => r.url === LISTA && r.method === 'POST')
        .flush({ message: 'La cita ya está pagada', code: 'CONFLICT' }, { status: 409, statusText: 'Conflict' });
      http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush([]);
      fixture.detectChanges();

      expect(el(fixture, 'comprobante-error-subida')?.textContent).toContain('La cita ya está pagada');
    });
  });

  describe('el revisor', () => {
    it('sin comprobantes, lo dice', async () => {
      const { fixture, http } = await montar('revisor', false);
      http.expectOne(LISTA).flush([]);
      fixture.detectChanges();

      expect(el(fixture, 'comprobantes-vacio')).not.toBeNull();
      expect(el(fixture, 'comprobante-archivo')).toBeNull();
    });

    /**
     * Por la ruta de la cita, no por `common/files`: ésa sólo le da el archivo
     * a quien lo subió. Y recién al pedirlo.
     */
    it('baja el archivo al pedirlo, por la ruta de la cita', async () => {
      const { fixture, http } = await montar('revisor', false);
      http.expectOne(LISTA).flush([comprobante()]);
      fixture.detectChanges();
      http.expectNone((r) => r.url.includes('/content'));

      (el(fixture, 'comprobante-ver') as HTMLButtonElement).click();
      fixture.detectChanges();

      http
        .expectOne(`${LISTA}/rc-1/content`)
        .flush(new Blob(['png'], { type: 'image/png' }));
      http.expectNone((r) => r.url.startsWith('/common/files'));
      fixture.detectChanges();
      expect(el(fixture, 'comprobante-vista')).not.toBeNull();
    });

    it('confirmar avisa con el pago nuevo y relee', async () => {
      const { fixture, http } = await montar('revisor', false);
      http.expectOne(LISTA).flush([comprobante()]);
      fixture.detectChanges();
      const cambios: (PaymentStateInfo | null)[] = [];
      fixture.componentInstance.changed.subscribe((c) => cambios.push(c));

      (el(fixture, 'comprobante-confirmar') as HTMLButtonElement).click();
      fixture.detectChanges();

      http.expectOne(`${LISTA}/rc-1/confirm`).flush({
        receipt: comprobante({ status: 'CONFIRMED' }),
        paymentState: {
          state: 'PAID',
          label: 'Pagada',
          conceptId: 'c-1',
          insuranceUsed: false,
          markedByUserId: 'u-med',
          markedAt: '2026-10-27T15:00:00.000Z',
        },
      });

      expect(cambios[0]?.state).toBe('PAID');
      http.expectOne(LISTA).flush([comprobante({ status: 'CONFIRMED' })]);
      fixture.detectChanges();
      expect(el(fixture, 'comprobante-CONFIRMED')).not.toBeNull();
      expect(el(fixture, 'comprobante-confirmar')).toBeNull();
    });

    /** Sin motivo el paciente no sabe qué volver a subir. */
    it('rechazar exige el motivo y lo manda', async () => {
      const { fixture, http } = await montar('revisor', false);
      http.expectOne(LISTA).flush([comprobante()]);
      fixture.detectChanges();

      (el(fixture, 'comprobante-rechazar') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el(fixture, 'comprobante-rechazo')).not.toBeNull();

      poner(fixture, 'motivo', 'no');
      expect(el(fixture, 'comprobante-rechazar-confirmar')?.getAttribute('aria-disabled')).toBe('true');

      poner(fixture, 'motivo', '  No se lee el monto ');
      (el(fixture, 'comprobante-rechazar-confirmar') as HTMLButtonElement).click();
      fixture.detectChanges();

      const rechazo = http.expectOne(`${LISTA}/rc-1/reject`);
      expect(rechazo.request.body).toEqual({ reason: 'No se lee el monto' });
      rechazo.flush(comprobante({ status: 'REJECTED', rejectionReason: 'No se lee el monto' }));
      http.expectOne(LISTA).flush([comprobante({ status: 'REJECTED', rejectionReason: 'No se lee el monto' })]);
      fixture.detectChanges();

      expect(el(fixture, 'comprobante-rechazo')).toBeNull();
      expect(el(fixture, 'comprobante-motivo')?.textContent).toContain('No se lee el monto');
    });

    /**
     * Cerrar en plena confirmación dejaba la respuesta sin destinatario: la API
     * pagaba la cita y la agenda seguía diciendo «Sin registrar».
     */
    it('no se deja cerrar mientras confirma', async () => {
      const { fixture, http } = await montar('revisor', false);
      http.expectOne(LISTA).flush([comprobante()]);
      fixture.detectChanges();
      expect(api(fixture)['ocupado'] as () => boolean).toBeDefined();
      expect((api(fixture)['ocupado'] as () => boolean)()).toBe(false);

      (el(fixture, 'comprobante-confirmar') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect((api(fixture)['ocupado'] as () => boolean)()).toBe(true);

      http.expectOne(`${LISTA}/rc-1/confirm`).flush({
        receipt: comprobante({ status: 'CONFIRMED' }),
        paymentState: {
          state: 'PAID',
          label: 'Pagada',
          conceptId: 'c-1',
          insuranceUsed: false,
          markedByUserId: 'u-med',
          markedAt: '2026-10-27T15:00:00.000Z',
        },
      });
      expect((api(fixture)['ocupado'] as () => boolean)()).toBe(false);
      http.expectOne(LISTA).flush([comprobante({ status: 'CONFIRMED' })]);
    });

    /** Releer tras una acción no borra la lista: el foco no se cae al `body`. */
    it('releer no pasa por «cargando»', async () => {
      const { fixture, http } = await montar('revisor', false);
      http.expectOne(LISTA).flush([comprobante()]);
      fixture.detectChanges();

      llamar(fixture, 'cargar');
      expect(el(fixture, 'comprobantes-lista')).not.toBeNull();
      http.expectOne(LISTA).flush([comprobante()]);
    });

    /** S9: un error inesperado lleva el ID de la petición, que es lo que pide soporte. */
    it('un error del servidor muestra el ID de la petición', async () => {
      const { fixture, http } = await montar('revisor', false);
      http.expectOne(LISTA).flush([comprobante()]);
      fixture.detectChanges();

      (el(fixture, 'comprobante-confirmar') as HTMLButtonElement).click();
      http
        .expectOne(`${LISTA}/rc-1/confirm`)
        .flush({ code: 'INTERNAL', message: 'boom', correlationId: 'req-123' }, { status: 500, statusText: 'Server Error' });
      http.expectOne(LISTA).flush([comprobante()]);
      fixture.detectChanges();

      expect(el(fixture, 'comprobante-error-revision')?.textContent).toContain('req-123');
    });

    /** 409: otro lo revisó con el modal abierto. Se dice y se muestra en qué quedó. */
    it('si otro ya lo revisó, lo dice y relee', async () => {
      const { fixture, http } = await montar('revisor', false);
      http.expectOne(LISTA).flush([comprobante()]);
      fixture.detectChanges();

      (el(fixture, 'comprobante-confirmar') as HTMLButtonElement).click();
      http
        .expectOne(`${LISTA}/rc-1/confirm`)
        .flush({ message: 'El comprobante ya se rechazó', code: 'CONFLICT' }, { status: 409, statusText: 'Conflict' });
      http.expectOne(LISTA).flush([comprobante({ status: 'REJECTED', rejectionReason: 'Duplicado' })]);
      fixture.detectChanges();

      expect(el(fixture, 'comprobante-error-revision')?.textContent).toContain('ya se rechazó');
      expect(el(fixture, 'comprobante-REJECTED')).not.toBeNull();
    });
  });
});

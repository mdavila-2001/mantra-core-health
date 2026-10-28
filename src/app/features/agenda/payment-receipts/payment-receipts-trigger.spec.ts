import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { PaymentStateInfo } from '../../../core/data-access/scheduling/scheduling.types';
import { PaymentReceiptsDialog } from './payment-receipts-dialog';
import { PaymentReceiptsTrigger } from './payment-receipts-trigger';
import type { PaymentReceiptsMode } from './payment-receipts-dialog';

const LISTA = '/scheduling/bookings/bk-1/payment-receipts';

const PAGADA: PaymentStateInfo = {
  state: 'PAID',
  label: 'Pagada',
  conceptId: 'c-1',
  insuranceUsed: false,
  markedByUserId: 'u-med',
  markedAt: new Date('2026-10-27T15:00:00.000Z'),
};

async function montar(mode: PaymentReceiptsMode, pago: PaymentStateInfo | null = null) {
  await TestBed.configureTestingModule({
    imports: [PaymentReceiptsTrigger],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  }).compileComponents();

  const fixture: ComponentFixture<PaymentReceiptsTrigger> =
    TestBed.createComponent(PaymentReceiptsTrigger);
  fixture.componentRef.setInput('bookingId', 'bk-1');
  fixture.componentRef.setInput('cita', 'la cita del jueves 29 a las 08:30');
  fixture.componentRef.setInput('mode', mode);
  fixture.componentRef.setInput('pago', pago);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

function el(fixture: ComponentFixture<PaymentReceiptsTrigger>, testId: string): HTMLElement | null {
  return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
}

/** El modal que cuelga del botón, para hablarle como lo haría su plantilla. */
function dialogo(fixture: ComponentFixture<PaymentReceiptsTrigger>): PaymentReceiptsDialog {
  const nodo = fixture.debugElement.query((d) => d.componentInstance instanceof PaymentReceiptsDialog);
  return nodo.componentInstance as PaymentReceiptsDialog;
}

describe('PaymentReceiptsTrigger — el botón de comprobantes de una cita', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('el paciente ve «Pagada» cuando la cita lo está', async () => {
    const { fixture } = await montar('paciente', PAGADA);

    expect(el(fixture, 'turnos-pagada')?.textContent).toContain('Pagada');
    expect(el(fixture, 'turnos-comprobante')?.getAttribute('aria-label')).toBe(
      'Comprobante de pago de la cita del jueves 29 a las 08:30',
    );
  });

  it('el revisor no ve la insignia: su fila ya muestra el pago', async () => {
    const { fixture } = await montar('revisor', PAGADA);

    expect(el(fixture, 'turnos-pagada')).toBeNull();
    expect(el(fixture, 'agenda-comprobantes')).not.toBeNull();
  });

  it('abre el modal sin ofrecer subir sobre una cita pagada', async () => {
    const { fixture, http } = await montar('paciente', PAGADA);

    el(fixture, 'turnos-comprobante')!.click();
    fixture.detectChanges();
    http.expectOne(LISTA).flush([]);
    fixture.detectChanges();

    expect(el(fixture, 'comprobantes')).not.toBeNull();
    expect(el(fixture, 'comprobante-archivo')).toBeNull();
    expect(el(fixture, 'comprobante-no-aplica')).not.toBeNull();
  });

  /**
   * Releer redibuja la fila donde vive este botón: avisar en caliente cerraba
   * el modal en la cara de quien revisaba. El aviso espera al cierre.
   */
  it('avisa del cambio recién al cerrar, y una sola vez', async () => {
    const { fixture, http } = await montar('revisor');
    let avisos = 0;
    fixture.componentInstance.changed.subscribe(() => (avisos += 1));

    el(fixture, 'agenda-comprobantes')!.click();
    fixture.detectChanges();
    http.expectOne(LISTA).flush([]);

    dialogo(fixture).changed.emit(null);
    dialogo(fixture).changed.emit(null);
    expect(avisos).toBe(0);
    expect(el(fixture, 'comprobantes')).not.toBeNull();

    dialogo(fixture).closed.emit();
    fixture.detectChanges();
    expect(avisos).toBe(1);
    expect(el(fixture, 'comprobantes')).toBeNull();
  });

  it('cerrar sin cambios no hace releer a nadie', async () => {
    const { fixture, http } = await montar('revisor');
    let avisos = 0;
    fixture.componentInstance.changed.subscribe(() => (avisos += 1));

    el(fixture, 'agenda-comprobantes')!.click();
    fixture.detectChanges();
    http.expectOne(LISTA).flush([]);
    dialogo(fixture).closed.emit();
    fixture.detectChanges();

    expect(avisos).toBe(0);
  });
});

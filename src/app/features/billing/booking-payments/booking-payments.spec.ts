import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { API_BASE_URL } from '../../../core/data-access/api';
import type { PaymentProof, SimulatedCharge } from '../../../core/data-access/billing-simulated/billing-simulated.types';
import type { SimulatedInvoicing } from '../../../core/mock/billing-sim/simulated-invoicing';
import { motorDePrueba } from '../billing.spec-fixtures';
import { BookingPayments } from './booking-payments';

const BOOKING_ID = 'reserva-de-prueba';
const PROOF: PaymentProof = {
  fileName: 'transferencia.png',
  mimeType: 'image/png',
  sizeBytes: 2048,
  dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
};

/**
 * «Pagos de la cita» del médico: dos pestañas, contra respuestas del mismo
 * motor que atiende la maqueta. Fijan que:
 *
 * 1. el comprobante que envió la persona **se ve** (archivo y datos del aviso);
 * 2. **confirmar** deja el pago confirmado, relee y avisa a la agenda;
 * 3. la pestaña **Factura** ofrece generar la factura y abre su diálogo.
 */
describe('BookingPayments', () => {
  let fixture: ComponentFixture<BookingPayments>;
  let http: HttpTestingController;
  let motor: SimulatedInvoicing;
  let cobro: SimulatedCharge;
  let cambios: number;

  function el(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  function leer(items: readonly SimulatedCharge[]): void {
    const lectura = http.expectOne((r) => r.url === '/billing/simulated/charges');
    expect(lectura.request.params.get('bookingId')).toBe(BOOKING_ID);
    lectura.flush({ items, count: items.length, simulated: true });
    http.expectOne('/billing/simulated/catalogs').flush(motor.catalogs());
    fixture.detectChanges();
  }

  function montar(): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '' }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BookingPayments);
    fixture.componentRef.setInput('bookingId', BOOKING_ID);
    fixture.componentRef.setInput('patientName', 'Ana Pérez');
    cambios = 0;
    fixture.componentInstance.changed.subscribe(() => cambios++);
    fixture.detectChanges();
  }

  function pestaña(nombre: string): HTMLButtonElement {
    const botones = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('[role="tab"]'));
    return botones.find((boton) => boton.textContent?.trim() === nombre)!;
  }

  beforeEach(() => {
    motor = motorDePrueba();
    cobro = motor.listCharges().find((c) => c.source === 'CONSULTATION' && c.payment === null && c.plan === null)!;
  });

  afterEach(() => http.verify());

  it('ofrece las dos pestañas: Comprobantes y Factura', async () => {
    montar();
    await fixture.whenStable();
    leer([cobro]);
    expect(pestaña('Comprobantes')).toBeDefined();
    expect(pestaña('Factura')).toBeDefined();
  });

  it('muestra el comprobante enviado por la persona, con su archivo', async () => {
    const enviado = motor.informarPagoDelPaciente(cobro.id, PROOF);
    expect(enviado.ok).toBe(true);
    montar();
    await fixture.whenStable();
    leer([(enviado as { value: SimulatedCharge }).value]);

    const archivo = el('booking-payments-file');
    expect(archivo?.textContent).toContain('transferencia.png');
    expect(archivo?.querySelector('img')?.getAttribute('alt')).toBe('Comprobante enviado: transferencia.png');
    expect(el('booking-payments-confirm')).not.toBeNull();
  });

  it('un cobro sin comprobante lo dice y no ofrece confirmar', async () => {
    montar();
    await fixture.whenStable();
    leer([cobro]);
    expect(el('booking-payments-proofs')?.textContent).toContain('todavía no envió un comprobante');
    expect(el('booking-payments-confirm')).toBeNull();
  });

  it('confirmar el pago relee, deja el cobro como pagado y avisa a la agenda', async () => {
    const enviado = motor.informarPagoDelPaciente(cobro.id, PROOF);
    montar();
    await fixture.whenStable();
    leer([(enviado as { value: SimulatedCharge }).value]);

    (el('booking-payments-confirm') as HTMLButtonElement).click();
    const confirmacion = http.expectOne(`/billing/simulated/payment-reports/${cobro.id}/confirm`);
    expect(confirmacion.request.method).toBe('POST');
    const confirmado = motor.confirmarPagoInformado(cobro.id);
    confirmacion.flush((confirmado as { value: SimulatedCharge }).value);
    expect(cambios).toBe(1);

    leer([(confirmado as { value: SimulatedCharge }).value]);
    expect(el('booking-payments-paid')?.textContent).toContain('Pagado');
    expect(el('booking-payments-confirm')).toBeNull();
    expect(el('booking-payments-notice')?.textContent).toContain('La cita figura como pagada');
  });

  it('la pestaña Factura ofrece generar la factura de un cobro ya pagado', async () => {
    motor.informarPagoDelPaciente(cobro.id, PROOF);
    const pagado = (motor.confirmarPagoInformado(cobro.id) as { value: SimulatedCharge }).value;
    montar();
    await fixture.whenStable();
    leer([pagado]);

    pestaña('Factura').click();
    fixture.detectChanges();
    const boton = el('booking-payments-invoice') as HTMLButtonElement;
    expect(boton.textContent?.trim()).toBe('Generar factura');
    boton.click();
    fixture.detectChanges();
    expect(el('factura-simulada')).not.toBeNull();
  });

  it('si la lectura falla, lo dice y deja reintentar', async () => {
    montar();
    await fixture.whenStable();
    http.expectOne('/billing/simulated/catalogs').flush(motor.catalogs());
    http.expectOne((r) => r.url === '/billing/simulated/charges').flush({ message: 'x' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el('booking-payments-error')).not.toBeNull();
  });
});

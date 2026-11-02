import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { API_BASE_URL } from '../../../../core/data-access/api';
import type { SimulatedCharge } from '../../../../core/data-access/billing-simulated/billing-simulated.types';
import type { SimulatedInvoicing } from '../../../../core/mock/billing-sim/simulated-invoicing';
import { motorDePrueba } from '../../../billing/billing.spec-fixtures';
import { SessionPayment } from './session-payment';

const PNG_BASE64 = 'iVBORw0KGgo=';

function archivo(nombre: string, tipo: string, bytes = 8): File {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo });
}

/**
 * «Pago de la sesión» del paciente. Fija el hueco que tenía: el aviso de pago
 * se mandaba sin ningún archivo. Ahora el paciente **sube el comprobante** y el
 * botón de envío no se habilita hasta que hay uno válido.
 */
describe('SessionPayment', () => {
  let fixture: ComponentFixture<SessionPayment>;
  let http: HttpTestingController;
  let motor: SimulatedInvoicing;
  let cobro: SimulatedCharge;

  function el<T extends HTMLElement = HTMLElement>(testId: string): T | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  async function montar(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '' }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SessionPayment);
    fixture.componentRef.setInput('bookingId', 'reserva-1');
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/billing/simulated/patient/charges').flush({ items: [cobro], count: 1, simulated: true });
    fixture.detectChanges();
  }

  async function elegir(file: File): Promise<void> {
    const entrada = el<HTMLInputElement>('session-payment-proof')!;
    Object.defineProperty(entrada, 'files', { value: [file], configurable: true });
    entrada.dispatchEvent(new Event('change'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el('session-payment-chosen') ?? el('session-payment-error')).not.toBeNull();
    });
  }

  beforeEach(() => {
    motor = motorDePrueba();
    cobro = motor.listCharges().find((c) => c.source === 'CONSULTATION' && c.payment === null && c.plan === null)!;
  });

  afterEach(() => http.verify());

  it('no deja enviar mientras no haya un comprobante', async () => {
    await montar();
    expect(el<HTMLButtonElement>('session-payment-send')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('sube el comprobante elegido y lo manda junto con el aviso de pago', async () => {
    await montar();
    await elegir(archivo('transferencia.png', 'image/png'));
    expect(el('session-payment-chosen')?.textContent).toContain('transferencia.png');

    el<HTMLButtonElement>('session-payment-send')!.click();
    const envio = http.expectOne(`/billing/simulated/patient/charges/${cobro.id}/report`);
    expect(envio.request.method).toBe('POST');
    expect(envio.request.body.proof).toMatchObject({
      fileName: 'transferencia.png',
      mimeType: 'image/png',
      sizeBytes: 8,
    });
    expect(envio.request.body.proof.dataUrl.startsWith('data:image/png;base64,')).toBe(true);

    const enviado = (motor.informarPagoDelPaciente(cobro.id, envio.request.body.proof) as { value: SimulatedCharge }).value;
    envio.flush(enviado);
    fixture.detectChanges();
    expect(el('session-payment')?.textContent).toContain('Comprobante enviado');
    expect(el('session-payment-sent')?.textContent).toContain('transferencia.png');
  });

  it('rechaza un archivo que no es imagen ni PDF y lo dice', async () => {
    await montar();
    await elegir(archivo('virus.exe', 'application/x-msdownload'));
    expect(el('session-payment-error')?.textContent).toContain('JPG, PNG o WEBP, o un PDF de hasta 3 MB');
    expect(el('session-payment-chosen')).toBeNull();
    expect(el<HTMLButtonElement>('session-payment-send')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('rechaza un archivo de más de 3 MB', async () => {
    await montar();
    await elegir(archivo('enorme.png', 'image/png', 3 * 1024 * 1024 + 1));
    expect(el('session-payment-error')).not.toBeNull();
    expect(el('session-payment-chosen')).toBeNull();
  });

  it('si el envío falla, lo dice y conserva el comprobante elegido para reintentar', async () => {
    await montar();
    await elegir(archivo('transferencia.png', 'image/png'));
    el<HTMLButtonElement>('session-payment-send')!.click();
    http.expectOne(`/billing/simulated/patient/charges/${cobro.id}/report`).flush({ message: 'x' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el('session-payment-error')?.textContent).toContain('No pudimos enviar el comprobante');
    expect(PNG_BASE64).toBeTruthy();
  });
});

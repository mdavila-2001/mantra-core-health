import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { PedidoFarmacia } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { OrderPayment } from './order-payment';

/**
 * La pantalla de pago (FAR-I5). Lo que se fija: el camino real («pagás al
 * retirar») como default, la pestaña QR marcada SIEMPRE como demo — el chip
 * no tiene prop que lo quite: los únicos inputs del componente son el pedido
 * y `ocupado`, y esta prueba lo demuestra usándolos todos —, y el resumen
 * del pago una vez registrado.
 *
 * Las pruebas corren con `environment.development` → `paymentDemo` encendido:
 * la pestaña QR está presente; su ausencia sin el gate vive en la plantilla
 * y se verifica en runtime, no acá.
 */

const PAGADO_EL = new Date('2026-08-21T18:30:00');

const pedido = (extra: Partial<PedidoFarmacia> = {}): PedidoFarmacia => ({
  id: 'f0e1d2c3-0000-4000-8000-00000000abcd',
  estado: 'CONFIRMADO',
  creadoEl: new Date('2026-08-21T10:00:00'),
  venceEl: null,
  farmacia: 'Farmacia Andina',
  sede: 'Sucursal Centro',
  direccion: null,
  modalidad: 'RETIRO',
  direccionDeEntrega: null,
  paciente: 'Ana Pérez',
  prescriptor: null,
  lineas: [
    {
      productId: null,
      medicamento: 'Amoxicilina',
      presentacion: '500 mg',
      cantidad: 1,
      precio: '60.00',
      moneda: 'BOB',
      disponible: true,
    },
  ],
  totalEstimado: '60.00',
  moneda: 'BOB',
  codigoDeRetiro: null,
  motivoDeRechazo: null,
  sustituciones: [],
  envio: null,
  entregas: [],
  pago: { estado: 'PENDIENTE', origen: null, pagadoEl: null, total: null, moneda: null },
  requestId: 'rx-1',
  siteId: 'site-1',
  pharmacyId: 'pharmacy-1',
  ...extra,
});

const PAGO_QR = {
  estado: 'PAGADO',
  origen: 'QR_DEMO',
  pagadoEl: PAGADO_EL,
  total: '60.00',
  moneda: 'BOB',
} as const;

describe('OrderPayment', () => {
  let fixture: ComponentFixture<OrderPayment>;

  function montar(abierto: PedidoFarmacia, ocupado = false): void {
    fixture = TestBed.createComponent(OrderPayment);
    // Los DOS inputs del componente, a propósito: no existe ninguno que
    // apague el chip DEMO — ese es el contrato que esta suite demuestra.
    fixture.componentRef.setInput('pedido', abierto);
    fixture.componentRef.setInput('ocupado', ocupado);
    fixture.detectChanges();
  }

  function elemento(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(): string {
    return elemento().textContent ?? '';
  }

  function abrirPestanaQr(): void {
    const botones = [...elemento().querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const qr = botones.find((boton) => (boton.textContent ?? '').includes('QR'));
    qr?.click();
    fixture.detectChanges();
  }

  it('pendiente: el total a pagar y el mostrador como camino default', () => {
    montar(pedido());

    expect(texto()).toContain('A pagar:');
    expect(texto()).toContain('60.00 BOB');
    expect(texto()).toContain('Pagás al retirar, en la farmacia.');
    // Las DOS pestañas existen (gate encendido en dev) y la abierta es la
    // del mostrador: sin esta aserción, un gate roto pasaría en silencio.
    const pestanas = [...elemento().querySelectorAll('[role="tab"]')].map((boton) =>
      boton.textContent?.trim(),
    );
    expect(pestanas).toEqual(['En mostrador', 'QR']);
    expect(elemento().querySelector('[data-testid="pago-chip-demo"]')).toBeNull();
  });

  it('el contrato de inputs es cerrado: no existe ninguno que apague el chip DEMO', () => {
    // La definición compilada declara los inputs reales: si mañana aparece
    // un `ocultarChip`, esta lista cambia y la prueba lo delata.
    const definicion = (
      OrderPayment as unknown as { ɵcmp: { inputs: Record<string, unknown> } }
    ).ɵcmp;
    expect(Object.keys(definicion.inputs).sort()).toEqual(['ocupado', 'pedido']);
  });

  it('la pestaña QR lleva el chip DEMO fijo, la espera y el botón de simular', () => {
    montar(pedido());
    abrirPestanaQr();

    expect(texto()).toContain('DEMO — el pago real llega con la pasarela');
    expect(texto()).toContain('Escaneá con tu banca móvil.');
    expect(texto()).toContain('Esperando la confirmación del banco…');
    expect(elemento().querySelector('[data-testid="pago-simular"]')).not.toBeNull();
  });

  it('simular el pago aprobado emite hacia el contenedor, que es quien ejecuta', () => {
    montar(pedido());
    const emitido = vi.fn();
    fixture.componentInstance.pagoSimulado.subscribe(emitido);
    abrirPestanaQr();

    elemento().querySelector<HTMLButtonElement>('[data-testid="pago-simular"]')?.click();
    expect(emitido).toHaveBeenCalledTimes(1);
  });

  it('sin total publicado, el vacío honesto — el QR no muestra un monto inventado', () => {
    montar(pedido({ totalEstimado: null }));
    expect(texto()).toContain('Total no disponible: falta algún precio publicado.');
  });

  it('pagado: queda el resumen con el medio y la fecha, sin pestañas ni QR', () => {
    montar(pedido({ pago: PAGO_QR }));

    expect(texto()).toContain('Pagado por QR (demo)');
    expect(texto()).toContain('21/08/2026');
    expect(texto()).not.toContain('A pagar:');
    expect(elemento().querySelector('[role="tab"]')).toBeNull();
    expect(elemento().querySelector('[data-testid="pago-simular"]')).toBeNull();
  });

  it('pagado en mostrador se dice con esas palabras', () => {
    montar(pedido({ pago: { ...PAGO_QR, origen: 'MOSTRADOR' } }));
    expect(texto()).toContain('Pagado en mostrador');
  });
});

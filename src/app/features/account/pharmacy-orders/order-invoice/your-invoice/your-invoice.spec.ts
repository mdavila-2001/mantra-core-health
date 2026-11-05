import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { EstadoDePedido } from '../../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import type { DocumentoDeFactura } from '../order-invoice.types';
import { YourInvoice } from './your-invoice';

/**
 * «Su factura» en el detalle de un pedido de farmacia: con factura muestra sus
 * datos, la ruta para verla y la descarga; sin factura explica por qué según
 * el estado. El comprobante interno siempre se ofrece.
 */

const FACTURA = {
  id: 'p-1',
  numero: '000123',
  emitidaEl: new Date('2026-10-30T12:00:00Z'),
  estado: 'Emitida',
  subtotal: '100.00',
  descuentoDeRed: null,
  coaseguro: null,
  total: '90.00',
  moneda: 'BOB',
  lineas: [],
} as unknown as DocumentoDeFactura;

describe('YourInvoice', () => {
  let fixture: ComponentFixture<YourInvoice>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  function pintar(estado: EstadoDePedido, factura: DocumentoDeFactura | null): HTMLElement {
    fixture = TestBed.createComponent(YourInvoice);
    fixture.componentRef.setInput('orderId', 'p-1');
    fixture.componentRef.setInput('estado', estado);
    fixture.componentRef.setInput('factura', factura);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const q = (root: HTMLElement, id: string) => root.querySelector(`[data-testid="${id}"]`);

  it('con factura: número, total en Bs, rótulo de ejemplo y enlace a la factura del pedido', () => {
    const root = pintar('RETIRADO', FACTURA);

    expect(root.textContent).toContain('000123');
    expect(q(root, 'tu-factura-total')?.textContent?.trim()).toBe('90.00 Bs');
    expect(root.textContent).toContain('Datos de ejemplo');
    expect(q(root, 'tu-factura-ver')?.getAttribute('href')).toBe('/my-account/pharmacy-orders/p-1/invoice');
    expect(q(root, 'tu-factura-descargar')).not.toBeNull();
    expect(q(root, 'tu-factura-vacia')).toBeNull();
  });

  it('un total ausente se dice «No disponible»', () => {
    const root = pintar('RETIRADO', { ...FACTURA, total: null });
    expect(q(root, 'tu-factura-total')?.textContent?.trim()).toBe('No disponible');
  });

  it('sin factura en un pedido retirado, dice que todavía no está en la app', () => {
    const root = pintar('RETIRADO', null);

    expect(q(root, 'tu-factura-vacia')?.textContent).toContain('todavía no está disponible en la app');
    expect(q(root, 'tu-factura-ver')).toBeNull();
    expect(q(root, 'tu-factura-descargar')).toBeNull();
  });

  it('sin factura en un pedido en curso, dice cuándo se emite', () => {
    const root = pintar('CONFIRMADO', null);
    expect(q(root, 'tu-factura-vacia')?.textContent).toContain('cuando le entrega el pedido');
  });

  it('el comprobante interno se ofrece siempre, con la ruta del pedido', () => {
    for (const factura of [FACTURA, null]) {
      const root = pintar('RETIRADO', factura);
      expect(q(root, 'tu-factura-comprobante')?.getAttribute('href')).toBe('/my-account/pharmacy-orders/p-1/receipt');
    }
  });
});

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';

import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type {
  BorradorDePedido,
  PedidoFarmacia,
  SimulacionDeFarmacia,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { OrderReceipt } from './order-receipt';

/**
 * El comprobante interno (FAR-I5). Lo que se fija: el papel refleja EXACTO lo
 * que el puerto registró (medio, líneas, total), un pedido sin pago no tiene
 * comprobante (vacío honesto con salida), y cero uuid a la vista.
 */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const BORRADOR: BorradorDePedido = {
  requestId: 'rx-1',
  siteId: 'f0e1d2c3-0000-4000-8000-000000000001',
  pharmacyId: 'a1b2c3d4-0000-4000-8000-000000000001',
  farmacia: 'Farmacia Andina',
  sede: 'Sucursal Centro',
  direccion: 'Calle Libertad 245',
  lineas: [
    {
      productId: 'f0e1d2c3-0000-4000-8000-000000000002',
      medicamento: 'Amoxicilina',
      presentacion: '500 mg · Caja x 21 cápsulas',
      cantidad: 2,
      precio: '60.00',
      moneda: 'BOB',
      disponible: true,
    },
  ],
  totalEstimado: '120.00',
  moneda: 'BOB',
};

describe('OrderReceipt', () => {
  let harness: RouterTestingHarness;
  let client: PharmacyOrdersClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'my-account/pharmacy-orders/:orderId/receipt', component: OrderReceipt },
        ]),
      ],
    });
    client = TestBed.inject(PharmacyOrdersClient);
  });

  async function pedidoEn(pasos: readonly SimulacionDeFarmacia[]): Promise<PedidoFarmacia> {
    const pedido = await firstValueFrom(
      client.enviar({ borrador: BORRADOR, modalidad: 'RETIRO', direccionDeEntrega: null }),
    );
    for (const paso of pasos) {
      await firstValueFrom(client.simular(pedido.id, paso));
    }
    return (await firstValueFrom(client.pedido(pedido.id))) ?? pedido;
  }

  async function montar(orderId: string): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/my-account/pharmacy-orders/${orderId}/receipt`, OrderReceipt);
    harness.detectChanges();
  }

  function texto(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  it('el pago del mostrador produce su papel: medio, líneas, total y descarga', async () => {
    // El cierre de la dispensa ES el cobro — el mismo camino de la demo.
    const pedido = await pedidoEn(['REVISAR', 'CONFIRMAR', 'MARCAR_LISTO', 'DISPENSAR']);
    await montar(pedido.id);

    expect(texto()).toContain('Comprobante interno. No es una factura.');
    expect(texto()).toContain('Farmacia Andina — Sucursal Centro');
    expect(texto()).toContain('Pagado en mostrador');
    expect(texto()).toContain('Amoxicilina · 500 mg · Caja x 21 cápsulas');
    // 60.00 × 2, leído del RENGLÓN: el total imprime el mismo texto en otra
    // parte de la página y taparía un importe unitario mal calculado.
    const renglon = harness.routeNativeElement?.querySelector(
      '[data-testid="comprobante-lineas"] li',
    );
    expect(renglon?.textContent).toContain('120.00 BOB');
    expect(renglon?.textContent).not.toContain('60.00');
    expect(
      harness.routeNativeElement?.querySelector('[data-testid="comprobante-descargar"]'),
    ).not.toBeNull();
  });

  it('el pago del QR de la demo se dice sin vueltas en el papel', async () => {
    const pedido = await pedidoEn(['REVISAR', 'CONFIRMAR']);
    await firstValueFrom(client.confirmarPagoDemo(pedido.id));
    await montar(pedido.id);

    expect(texto()).toContain('Pago demo — sin valor real');
  });

  it('sin pago registrado no hay comprobante: el vacío honesto con su salida', async () => {
    const pedido = await pedidoEn([]);
    await montar(pedido.id);

    expect(texto()).toContain('Este pedido todavía no tiene un pago registrado.');
    expect(texto()).toContain('Ver el pedido');
    expect(harness.routeNativeElement?.querySelector('[data-testid="comprobante"]')).toBeNull();
  });

  it('un pedido que no existe ofrece volver a la lista', async () => {
    await montar('no-existe');
    expect(texto()).toContain('Volver a mis pedidos');
  });

  it('ningún uuid se pinta en el comprobante', async () => {
    const pedido = await pedidoEn(['REVISAR', 'CONFIRMAR', 'MARCAR_LISTO', 'DISPENSAR']);
    await montar(pedido.id);
    expect(texto()).not.toMatch(UUID);
  });
});

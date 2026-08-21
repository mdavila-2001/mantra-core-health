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
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { OrderDetail } from './order-detail';

/**
 * El detalle del pedido (FAR-I2). Lo que se fija: los tres momentos clave —
 * la decisión de sustitución con el ahorro visible, el código de retiro con
 * su vencimiento, y los finales anticipados con sus salidas — más las reglas
 * de la casa: estado en palabras, cancelar con confirmación, cero uuid a la
 * vista y la barra de demo marcada como demostración.
 *
 * Las pruebas corren con `environment.development` → `demoPresets` encendido:
 * la barra de simulación está presente; su ausencia sin el gate vive en la
 * plantilla y se verifica en runtime, no acá.
 */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const BORRADOR: BorradorDePedido = {
  requestId: 'rx-1',
  siteId: 'f0e1d2c3-0000-4000-8000-000000000001',
  farmacia: 'Farmacia Andina',
  sede: 'Sucursal Centro',
  direccion: 'Calle Libertad 245',
  lineas: [
    {
      productId: 'f0e1d2c3-0000-4000-8000-000000000002',
      medicamento: 'Amoxicilina',
      presentacion: '500 mg · Caja x 21 cápsulas',
      cantidad: 1,
      precio: '60.00',
      moneda: 'BOB',
      disponible: true,
    },
  ],
  totalEstimado: '60.00',
  moneda: 'BOB',
};

describe('OrderDetail', () => {
  let harness: RouterTestingHarness;
  let client: PharmacyOrdersClient;
  let confirmar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    confirmar = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'my-account/pharmacy-orders/:orderId', component: OrderDetail }]),
        // El diálogo real vive en el `<body>` y pide un navegador de verdad:
        // acá lo que se fija es que cancelar PREGUNTA antes de hacer.
        { provide: DialogService, useValue: { confirm: confirmar } },
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
    await harness.navigateByUrl(`/my-account/pharmacy-orders/${orderId}`, OrderDetail);
    harness.detectChanges();
  }

  function texto(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  function click(testid: string): void {
    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`)
      ?.click();
    harness.detectChanges();
  }

  it('un pedido que no existe ofrece volver a la lista, sin inventar nada', async () => {
    await montar('no-existe');

    // El copy fijo de S6 más la salida como enlace: nada del recurso se filtra.
    expect(texto()).toContain('No encontramos lo que buscás');
    expect(texto()).toContain('Volver a mis pedidos');
    expect(
      harness.routeNativeElement?.querySelector('[data-testid="pedido-detalle"]'),
    ).toBeNull();
  });

  it('recién enviado: estado en palabras, línea de tiempo completa y cancelar a mano', async () => {
    const pedido = await pedidoEn([]);
    await montar(pedido.id);

    expect(texto()).toContain('Enviado');
    expect(texto()).toContain('La farmacia todavía no abrió tu pedido');
    for (const paso of ['En revisión', 'Confirmado', 'Listo para retirar', 'Retirado']) {
      expect(texto()).toContain(paso);
    }
    expect(
      harness.routeNativeElement?.querySelector('[data-testid="pedido-cancelar"]'),
    ).not.toBeNull();
    // Con la demo encendida la barra de simulación está, y dice lo que es.
    const demo = harness.routeNativeElement?.querySelector('[data-testid="pedido-demo"]');
    expect(demo).not.toBeNull();
    expect(demo?.textContent).toContain('Escenarios de demostración');
    expect(demo?.textContent).toContain('Demo');
    expect(texto()).not.toMatch(UUID);
  });

  it('la decisión de sustitución compara con el ahorro visible y acepta', async () => {
    const pedido = await pedidoEn(['REVISAR', 'PROPONER_SUSTITUCION']);
    await montar(pedido.id);

    expect(texto()).toContain('Esperando tu decisión');
    expect(texto()).toContain('Te proponen');
    expect(texto()).toContain('Genérico equivalente de Amoxicilina');
    expect(texto()).toContain('En lugar de');
    // 60.00 contra 24.00: el ahorro se dice, no se deja calcular de cabeza.
    expect(texto()).toContain('Te ahorrás');
    expect(texto()).toContain('36.00 BOB');

    click('pedido-aceptar');
    expect(texto()).toContain('Propuesta aceptada');
  });

  it('preferir la receta original vuelve al pedido confirmado', async () => {
    const pedido = await pedidoEn(['REVISAR', 'PROPONER_SUSTITUCION']);
    await montar(pedido.id);

    click('pedido-preferir');
    expect(texto()).toContain('Confirmado');
    expect(texto()).not.toContain('Te proponen');
  });

  it('listo para retirar: el código grande, su vencimiento y que no es un pago', async () => {
    const pedido = await pedidoEn(['CONFIRMAR', 'MARCAR_LISTO']);
    await montar(pedido.id);

    const codigo = harness.routeNativeElement?.querySelector('[data-testid="pedido-codigo"]');
    expect(codigo?.textContent?.trim()).toMatch(/^[ACDEFHJKLMNPRTUVWXY34679]{6}$/);
    expect(texto()).toContain('Mostralo en Farmacia Andina');
    expect(texto()).toContain('vence el');
    expect(texto()).toContain('no un pago');
  });

  it('vencido: re-pedir crea un pedido nuevo y navega a su detalle', async () => {
    const pedido = await pedidoEn(['CONFIRMAR', 'MARCAR_LISTO', 'VENCER']);
    await montar(pedido.id);

    expect(texto()).toContain('Tu reserva venció');
    click('pedido-repedir');
    await harness.fixture.whenStable();
    harness.detectChanges();

    // El detalle ahora es el del pedido nuevo, recién enviado.
    expect(texto()).toContain('La farmacia todavía no abrió tu pedido');
    expect((await firstValueFrom(client.misPedidos()))).toHaveLength(2);
  });

  it('rechazado: el motivo en palabras y la salida hacia las alternativas', async () => {
    const pedido = await pedidoEn(['RECHAZAR']);
    await montar(pedido.id);

    expect(texto()).toContain('La farmacia no pudo tomar tu pedido');
    expect(texto()).toContain('stock');
    const alternativas = harness.routeNativeElement?.querySelector<HTMLAnchorElement>(
      '[data-testid="pedido-alternativas"]',
    );
    expect(alternativas?.getAttribute('href')).toBe(
      '/my-account/medical-record/where-to-buy/rx-1',
    );
  });

  it('cancelar pregunta primero, y recién entonces cancela', async () => {
    const pedido = await pedidoEn(['CONFIRMAR']);
    await montar(pedido.id);

    click('pedido-cancelar');
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(texto()).toContain('Cancelado');
    // El foco aterriza en el estado por microtask: un tick para verlo llegar.
    await new Promise((resolver) => setTimeout(resolver));
    expect(document.activeElement?.id).toBe('pedido-estado');
  });

  it('con envío, el camino se avisa y el cierre se dice «Entregado»', async () => {
    // El lado del mostrador (FAR-I3) marca los hitos; acá se ve el reflejo.
    const pedido = await firstValueFrom(
      client.enviar({
        borrador: BORRADOR,
        modalidad: 'DOMICILIO',
        direccionDeEntrega: 'Av. Ejemplo 123',
      }),
    );
    await firstValueFrom(client.confirmarPedido(pedido.id, []));
    await firstValueFrom(client.marcarEnvio(pedido.id, 'EN_CAMINO'));
    await montar(pedido.id);

    expect(texto()).toContain('Tu pedido está en camino');
    expect(texto()).toContain('En camino');

    await firstValueFrom(client.marcarEnvio(pedido.id, 'ENTREGADO'));
    // Un solo harness por test: se re-navega para que `paramMap` recargue.
    await harness.navigateByUrl('/my-account/pharmacy-orders/no-existe', OrderDetail);
    await harness.navigateByUrl(`/my-account/pharmacy-orders/${pedido.id}`, OrderDetail);
    harness.detectChanges();
    expect(texto()).toContain('Entregado');
    expect(texto()).toContain('Tu pedido llegó.');
  });

  it('si la persona se arrepiente en el diálogo, nada cambia', async () => {
    confirmar.mockResolvedValue(false);
    const pedido = await pedidoEn(['CONFIRMAR']);
    await montar(pedido.id);

    click('pedido-cancelar');
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(texto()).toContain('Confirmado');
  });
});

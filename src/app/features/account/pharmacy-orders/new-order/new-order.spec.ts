import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type { BorradorDePedido } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { NewOrder } from './new-order';

/**
 * «Confirmá tu pedido» (FAR-I2). Lo que se fija: sin borrador hay salida y no
 * error; el resumen dice claro lo que la farmacia no tiene y que enviar no es
 * pagar; el retiro es el default y la demo ejercita los envíos con dirección
 * de ejemplo marcada; y enviar crea el pedido y lleva a su detalle.
 *
 * Las pruebas corren con `environment.development` → `demoPresets` encendido:
 * la rama de producción sin demo (envíos deshabilitados con su porqué) vive en
 * la plantilla pero no se puede ejercitar acá, como en el resto del proyecto.
 */

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
      precio: '68.00',
      moneda: 'BOB',
      disponible: true,
    },
    {
      productId: null,
      medicamento: 'Paracetamol',
      presentacion: null,
      cantidad: 1,
      precio: null,
      moneda: null,
      disponible: false,
    },
  ],
  totalEstimado: '68.00',
  moneda: 'BOB',
};

describe('NewOrder', () => {
  let fixture: ComponentFixture<NewOrder>;
  let client: PharmacyOrdersClient;

  function montar(): void {
    fixture = TestBed.createComponent(NewOrder);
    fixture.detectChanges();
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    client = TestBed.inject(PharmacyOrdersClient);
  });

  it('sin borrador ofrece la salida hacia la historia, no un error', () => {
    montar();

    // El copy fijo de S6 más la salida: quien entra por URL directa no queda preso.
    expect(texto()).toContain('No encontramos lo que buscás');
    expect(texto()).toContain('Ir a mi historia clínica');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="pedido-confirmacion"]',
      ),
    ).toBeNull();
  });

  it('el resumen marca claro lo que la farmacia no tiene y que enviar no es pagar', () => {
    client.prepararBorrador(BORRADOR);
    montar();

    expect(texto()).toContain('Farmacia Andina · Sucursal Centro');
    expect(texto()).toContain('Amoxicilina');
    expect(texto()).toContain('500 mg · Caja x 21 cápsulas');
    expect(texto()).toContain('68.00 BOB');
    expect(texto()).toContain('La farmacia no la tiene');
    expect(texto()).toContain('Sin precio publicado');
    expect(texto()).toContain('Pagás al retirar');
    expect(texto()).toContain('no es un pago');
  });

  it('el retiro es el default; la demo abre los envíos con dirección de ejemplo marcada', () => {
    client.prepararBorrador(BORRADOR);
    montar();

    const radios = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
      '[data-testid="pedido-modalidad"] input[type="radio"]',
    );
    expect(radios).toHaveLength(3);
    expect(radios[0].checked).toBe(true);
    expect(radios[1].disabled).toBe(false);
    expect(radios[2].disabled).toBe(false);

    radios[1].click();
    fixture.detectChanges();

    // La dirección es simulada y se dice: badge de demo al lado, no en secreto.
    const direccion = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="pedido-direccion"]',
    );
    expect(direccion?.textContent).toContain('La farmacia coordina la entrega a');
    expect(direccion?.textContent).toContain('Av. Ejemplo 123');
    expect(direccion?.textContent).toContain('Demo');
  });

  it('salir sin enviar descarta el borrador: no reaparece después por URL directa', () => {
    client.prepararBorrador(BORRADOR);
    montar();

    fixture.destroy();

    expect(client.borradorPreparado()).toBeNull();
  });

  it('enviar crea el pedido con retiro, consume el borrador y lleva a su detalle', async () => {
    client.prepararBorrador(BORRADOR);
    montar();
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="pedido-enviar"]')
      ?.click();
    fixture.detectChanges();

    const pedidos = await firstValueFrom(client.misPedidos());
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].estado).toBe('ENVIADO');
    expect(pedidos[0].modalidad).toBe('RETIRO');
    expect(pedidos[0].direccionDeEntrega).toBeNull();
    expect(client.borradorPreparado()).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/my-account/pharmacy-orders', pedidos[0].id]);
  });
});

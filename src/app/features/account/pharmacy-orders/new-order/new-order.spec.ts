import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PharmacyCampaignsClient } from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.client';
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
  pharmacyId: 'a1b2c3d4-0000-4000-8000-000000000001',
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

  /* ── Las promociones del pedido (FAR-I7) ───────────────────────────────── */

  it('pone los dos precios con el mismo formato y dice en voz alta cuál es cuál', () => {
    // `GET /pharmacy-inventory/availability` devuelve el numeric crudo: el
    // precio de este renglón llega como "22.5". Junto al promocional, que sale
    // de la aritmética en centavos, «antes 22.5 · ahora 14.62» se lee como un
    // descuido sobre el número que la paciente va a pagar.
    const conPrecioCrudo: BorradorDePedido = {
      ...BORRADOR,
      lineas: [{ ...BORRADOR.lineas[0], precio: '22.5' }],
      totalEstimado: '22.5',
    };
    TestBed.inject(PharmacyCampaignsClient).sembrarPara(BORRADOR.pharmacyId, BORRADOR.farmacia, [
      {
        productId: 'f0e1d2c3-0000-4000-8000-000000000002',
        nombre: 'Ibuprofeno 400 mg',
        presentacion: null,
        precio: '22.5',
        moneda: 'BOB',
      },
    ]);
    client.prepararBorrador(conPrecioCrudo);
    montar();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('[data-testid="pedido-banner-promo"]')).not.toBeNull();
    const renglon = raiz.querySelector('[data-testid="pedido-lineas"] .confirmacion__linea-precio');
    // Los dos con dos decimales, y no uno crudo y el otro formateado.
    expect(renglon?.textContent).toContain('22.50 BOB');
    expect(renglon?.textContent).toContain('14.62 BOB');
    // El tachado no se escucha: sin estas etiquetas, un lector de pantalla
    // anuncia dos precios seguidos y quien escucha no sabe cuál va a pagar.
    expect(renglon?.querySelector('s .sr-only')?.textContent).toContain('Antes');
    expect(renglon?.querySelector('strong .sr-only')?.textContent).toContain('campaña');

    const total = raiz.querySelector('[data-testid="pedido-total-promo"]');
    expect(total?.textContent).toContain('14.62');
    expect(raiz.querySelector('.confirmacion__total s .sr-only')?.textContent).toContain('Antes');
  });
});

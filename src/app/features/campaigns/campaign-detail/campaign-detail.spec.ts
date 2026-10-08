import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';

import {
  PharmacyCampaignsClient,
  type ProductoDeCatalogo,
  estadoDe,
} from '../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.client';
import { idSembrado } from '../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.fixtures';
import { NO_CONDITIONS } from '../../../core/promotions-engine/promotion-mechanics.types';
import type { Mechanic } from '../../../core/promotions-engine/promotion-mechanics.types';
import { CampaignDetail } from './campaign-detail';

/**
 * El detalle público de una promoción (FAR-I7).
 *
 * Lo que se fija es la regla de honestidad del carril: **una promoción vencida
 * no muestra precios ni con su URL exacta**, un enlace roto se distingue de una
 * promoción que se cumplió, y lo que se pinta son los dos precios que la
 * farmacia puso —nunca un descuento derivado por la pantalla—.
 *
 * Corren con la demo encendida, que es el default de desarrollo.
 */
const FARMACIA = '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63';

const CATALOGO: readonly ProductoDeCatalogo[] = [
  {
    productId: 'p-1',
    nombre: 'Metformina 850 mg',
    presentacion: 'caja x 30',
    precio: '48.00',
    moneda: 'BOB',
  },
  {
    productId: 'p-2',
    nombre: 'Ibuprofeno 400 mg',
    presentacion: 'caja x 20',
    precio: '22.50',
    moneda: 'BOB',
  },
  {
    productId: 'p-3',
    nombre: 'Paracetamol 500 mg',
    presentacion: 'caja x 16',
    precio: '15.00',
    moneda: 'BOB',
  },
];

describe('CampaignDetail', () => {
  let harness: RouterTestingHarness;
  let client: PharmacyCampaignsClient;

  /**
   * Navega de verdad a la URL: el id sale de `ActivatedRoute`, así que montar
   * el componente suelto probaría algo que la aplicación no hace.
   */
  async function montar(campaignId: string): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/promotions/${campaignId}`, CampaignDetail);
    harness.detectChanges();
  }

  function texto(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  function elemento(selector: string): Element | null {
    return harness.routeNativeElement?.querySelector(selector) ?? null;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'promotions/:campaignId', component: CampaignDetail }]),
      ],
    });
    client = TestBed.inject(PharmacyCampaignsClient);
    client.sembrarPara(FARMACIA, 'Farmacia del Centro', CATALOGO);
  });

  it('muestra los dos precios de cada producto mientras la campaña está vigente', async () => {
    const [vigente] = client.campanasVigentes(FARMACIA);

    await montar(vigente.id);

    expect(elemento('[data-testid="promo-detalle"]')).not.toBeNull();
    expect(texto()).toContain(vigente.titulo);
    // El precio de lista y el de campaña, los dos: sin el «antes» nadie sabe
    // si el descuento es real.
    expect(texto()).toContain(vigente.productos[0].precioNormal);
    expect(texto()).toContain(vigente.productos[0].precioPromocional);
    // El tachado es sólo visual. Sin decir cuál es cuál, quien escucha la
    // ficha oye dos importes seguidos y no sabe cuál pagaría.
    const precios = elemento('.promo__precios');
    expect(precios?.querySelector('s .sr-only')?.textContent).toContain('Antes');
    expect(precios?.querySelector('strong .sr-only')?.textContent).toContain('campaña');
  });

  it('no pinta un solo precio de una campaña vencida, ni con su URL exacta', async () => {
    const todas = await firstValueFrom(client.campanasDeFarmacia(FARMACIA));
    const vencida = todas.find((campana) => estadoDe(campana) === 'TERMINADA');

    await montar(vencida!.id);

    expect(elemento('[data-testid="promo-terminada"]')).not.toBeNull();
    expect(texto()).toContain('Esta promoción terminó');
    // La garantía de la unión discriminada, comprobada en el DOM y no sólo en
    // el tipo: ningún precio de la campaña llegó a la plantilla.
    for (const producto of vencida!.productos) {
      expect(texto()).not.toContain(producto.precioPromocional);
    }
    expect(elemento('[data-testid="promo-productos"]')).toBeNull();
  });

  it('distingue un enlace roto de una promoción que se cumplió', async () => {
    await montar('no-existe');

    expect(texto()).toContain('No encontramos lo que busca');
    expect(texto()).not.toContain('Esta promoción terminó');
  });

  it('una campaña programada tampoco adelanta sus precios', async () => {
    const dentroDeCincoDias = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const dentroDeDiez = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const creada = await firstValueFrom(
      client.crear(
        {
          titulo: 'Campaña de la semana que viene',
          descripcion: '',
          desde: dentroDeCincoDias,
          hasta: dentroDeDiez,
          tipoDeDescuento: 'PORCENTAJE',
          porcentaje: 25,
          renglones: [
            {
              productId: 'p-1',
              nombre: 'Metformina 850 mg',
              presentacion: 'caja x 30',
              precioNormal: '48.00',
              moneda: 'BOB',
              precioPromocional: null,
            },
          ],
        },
        FARMACIA,
        'Farmacia del Centro',
      ),
    );

    // `Array.isArray` no estrecha una unión con `readonly T[]`; `in` sí.
    expect('id' in creada).toBe(true);
    await montar('id' in creada ? creada.id : '');

    expect(elemento('[data-testid="promo-programada"]')).not.toBeNull();
    expect(elemento('[data-testid="promo-productos"]')).toBeNull();
    // El descuento del 25 % sobre 48.00 no puede haberse filtrado.
    expect(texto()).not.toContain('36.00');
  });
  describe('las mecánicas del motor', () => {
    const sembrada = (slug: string) => idSembrado(slug, FARMACIA);

    async function publicar(mecanica: Mechanic, extras: { condiciones?: typeof NO_CONDITIONS } = {}) {
      const creada = await firstValueFrom(
        client.crear(
          {
            titulo: 'Campaña propia',
            descripcion: '',
            desde: new Date(Date.now() - 24 * 60 * 60 * 1000),
            hasta: new Date(Date.now() + 24 * 60 * 60 * 1000),
            mecanica,
            condiciones: extras.condiciones,
            renglones:
              mecanica.kind === 'ORDER_PERCENT_OVER'
                ? []
                : [
                    { productId: 'p-1', nombre: 'Metformina 850 mg', presentacion: 'caja x 30', precioNormal: '48.00', moneda: 'BOB', precioPromocional: null },
                  ],
          },
          FARMACIA,
          'Farmacia del Centro',
        ),
      );
      return 'id' in creada ? creada.id : '';
    }

    it('un 2x1 dice «2x1», la oración y un caso calculado, sin precio tachado', async () => {
      await montar(sembrada('dos-por-uno'));

      expect(elemento('[data-testid="promo-mecanica-etiqueta"]')?.textContent?.trim()).toBe('2x1');
      expect(elemento('[data-testid="promo-mecanica-frase"]')?.textContent).toContain('Lleve 2 y pague 1.');
      // 2 × 48.00 = 96.00; pagando 1: 48.00.
      expect(elemento('[data-testid="promo-ejemplo"]')?.textContent).toContain('paga Bs 48 en vez de Bs 96');
      // No inventa un precio por unidad que la mecánica no tiene.
      expect(elemento('.promo__precios s')).toBeNull();
      expect(elemento('.promo__precios')?.textContent).toContain('48.00');
    });

    it('una de precio sigue mostrando los dos precios y no repite un ejemplo', async () => {
      await montar(sembrada('cuidado-diario'));

      expect(elemento('[data-testid="promo-mecanica-etiqueta"]')?.textContent?.trim()).toBe('20 % menos');
      expect(elemento('.promo__precios s')).not.toBeNull();
      expect(elemento('[data-testid="promo-ejemplo"]')).toBeNull();
    });

    it('una sobre el total no apunta a productos y lo dice', async () => {
      await montar(sembrada('compra-minima'));

      expect(elemento('[data-testid="promo-productos"]')).toBeNull();
      expect(elemento('[data-testid="promo-sin-productos"]')?.textContent).toContain('vale sobre toda su compra');
      expect(elemento('[data-testid="promo-ejemplo"]')?.textContent).toContain('En una compra justo en el mínimo');
    });

    it('un combo muestra el precio normal de cada producto y el ejemplo del conjunto', async () => {
      await montar(sembrada('combo-cuidado'));

      expect(elemento('[data-testid="promo-mecanica-etiqueta"]')?.textContent?.trim()).toBe('Combo');
      // 48.00 + 22.50 = 70.50; el combo cuesta 63.45.
      expect(elemento('[data-testid="promo-ejemplo"]')?.textContent).toContain('paga Bs 63.45 en vez de Bs 70.50');
    });

    it('dice las condiciones y NUNCA el código del cupón', async () => {
      const id = await publicar(
        { kind: 'BUY_X_PAY_Y', take: 2, pay: 1 },
        { condiciones: { ...NO_CONDITIONS, couponCode: 'SECRETO50', maxDiscount: '30.00', weekdays: [6, 0] } },
      );

      await montar(id);

      const condiciones = elemento('[data-testid="promo-condiciones"]')?.textContent ?? '';
      expect(condiciones).toContain('Vale los sábados y domingos.');
      expect(condiciones).toContain('Descuento máximo de Bs 30 por pedido.');
      expect(condiciones).toContain('Se necesita un cupón');
      expect(texto()).not.toContain('SECRETO50');
    });

    it('sin condiciones no pinta una lista vacía', async () => {
      await montar(sembrada('dos-por-uno'));

      expect(elemento('[data-testid="promo-condiciones"]')).toBeNull();
    });

    it('una vencida sigue sin mostrar mecánica, ejemplo ni precios', async () => {
      await montar(sembrada('invierno-pasado'));

      expect(elemento('[data-testid="promo-terminada"]')).not.toBeNull();
      expect(elemento('[data-testid="promo-mecanica"]')).toBeNull();
      expect(elemento('[data-testid="promo-ejemplo"]')).toBeNull();
      expect(elemento('[data-testid="promo-productos"]')).toBeNull();
    });
  });
});

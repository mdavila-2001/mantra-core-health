import { environment } from '../../../../environments/environment';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { MECHANIC_FAMILIES, infoOf } from '../../promotions-engine/mechanic-catalog';
import { NO_CONDITIONS } from '../../promotions-engine/promotion-mechanics.types';
import type { Mechanic } from '../../promotions-engine/promotion-mechanics.types';
import {
  PharmacyCampaignsClient,
  ProductoDeCatalogo,
  mecanicaDe,
  revisar,
} from './pharmacy-campaigns.client';
import { CAMPANAS_SEMBRADAS, UN_DIA } from './pharmacy-campaigns.fixtures';
import type {
  BorradorDeCampana,
  CampanaDeFarmacia,
  RenglonDeBorrador,
} from './pharmacy-campaigns.types';

/**
 * Las mecánicas del motor sobre el contrato de farmacia: que cada familia se
 * pueda sembrar y publicar, que el pedido se evalúe con todas, y que el formato
 * anterior (sólo porcentaje o precio por producto) siga leyéndose igual.
 */
const FARMACIA = 'farm-0001';
const NOMBRE = 'Farmacia del Centro';

const CATALOGO: readonly ProductoDeCatalogo[] = [
  { productId: 'p-1', nombre: 'Metformina 850 mg', presentacion: 'caja x 30', precio: '48.00', moneda: 'BOB' },
  { productId: 'p-2', nombre: 'Ibuprofeno 400 mg', presentacion: 'caja x 20', precio: '22.50', moneda: 'BOB' },
  { productId: 'p-3', nombre: 'Paracetamol 500 mg', presentacion: 'caja x 16', precio: '15.00', moneda: 'BOB' },
];

function renglon(productId: string, precioNormal: string, nombre = productId): RenglonDeBorrador {
  return { productId, nombre, presentacion: null, precioNormal, moneda: 'BOB', precioPromocional: null };
}

function borrador(mecanica: Mechanic, cambios: Partial<BorradorDeCampana> = {}): BorradorDeCampana {
  const ahora = Date.now();
  return {
    titulo: 'Campaña de prueba',
    descripcion: '',
    desde: new Date(ahora - UN_DIA),
    hasta: new Date(ahora + UN_DIA),
    mecanica,
    renglones: [renglon('a', '10.00')],
    ...cambios,
  };
}

describe('las mecánicas sobre el contrato de farmacia', () => {
  // Las campañas de demostración sólo existen con el interruptor encendido
  // (`environment.campaignsDemo`, apagado fuera de `demo`): estas pruebas miden
  // el motor de mecánicas sobre ese paquete sembrado.
  const campanasDemoOriginal = environment.campaignsDemo;
  beforeEach(() => Object.assign(environment, { campaignsDemo: true }));
  afterEach(() => Object.assign(environment, { campaignsDemo: campanasDemoOriginal }));

  let client: PharmacyCampaignsClient;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    client = TestBed.inject(PharmacyCampaignsClient);
  });

  async function publicar(
    mecanica: Mechanic,
    cambios: Partial<BorradorDeCampana> = {},
    farmacia = FARMACIA,
  ): Promise<CampanaDeFarmacia> {
    const resultado = await firstValueFrom(client.crear(borrador(mecanica, cambios), farmacia, NOMBRE));
    if (Array.isArray(resultado)) {
      throw new Error(`El borrador no cerró: ${resultado.join(', ')}`);
    }
    return resultado as CampanaDeFarmacia;
  }

  describe('el paquete sembrado', () => {
    beforeEach(() => client.sembrarPara(FARMACIA, NOMBRE, CATALOGO));

    it('recorre todas las familias de mecánicas, para poder verlas en pantalla', async () => {
      const todas = await firstValueFrom(client.campanasDeFarmacia(FARMACIA));
      const familias = new Set(todas.map((campana) => infoOf(mecanicaDe(campana).kind).family));

      for (const { family } of MECHANIC_FAMILIES) {
        expect(familias.has(family)).toBe(true);
      }
    });

    it('las nuevas no son de precio por unidad: no dejan precio promocional', async () => {
      const todas = await firstValueFrom(client.campanasDeFarmacia(FARMACIA));
      const sinPrecio = todas.filter((campana) => !['PERCENT_OFF', 'CLEARANCE'].includes(mecanicaDe(campana).kind));

      expect(sinPrecio.length).toBeGreaterThan(0);
      for (const campana of sinPrecio) {
        expect(campana.productos.every((producto) => producto.precioPromocional === null)).toBe(true);
      }
    });

    it('las campañas sobre el total no apuntan a productos', async () => {
      const todas = await firstValueFrom(client.campanasDeFarmacia(FARMACIA));
      const delTotal = todas.filter((campana) =>
        ['ORDER_PERCENT_OVER', 'SPEND_TIERS', 'POINTS_MULTIPLIER'].includes(mecanicaDe(campana).kind),
      );

      expect(delTotal).toHaveLength(3);
      expect(delTotal.every((campana) => campana.productos.length === 0)).toBe(true);
    });

    it('conserva el tope que declara la plantilla', async () => {
      const todas = await firstValueFrom(client.campanasDeFarmacia(FARMACIA));
      const escalonada = todas.find((campana) => mecanicaDe(campana).kind === 'SPEND_TIERS');

      expect(escalonada?.condiciones?.maxDiscount).toBe('50.00');
    });

    it('con un solo producto no arma el combo ni el regalo, en vez de armarlos incompletos', async () => {
      client.sembrarPara('farm-0002', 'Farmacia chica', [CATALOGO[0]]);
      const todas = await firstValueFrom(client.campanasDeFarmacia('farm-0002'));
      const tipos = todas.map((campana) => mecanicaDe(campana).kind);

      expect(tipos).not.toContain('BUNDLE_PRICE');
      expect(tipos).not.toContain('GIFT_WITH_PURCHASE');
      expect(tipos).toContain('BUY_X_PAY_Y');
    });

    it('el precio del combo sembrado es menor que la suma de sus productos', async () => {
      const todas = await firstValueFrom(client.campanasDeFarmacia(FARMACIA));
      const combo = todas.find((campana) => mecanicaDe(campana).kind === 'BUNDLE_PRICE');
      const mecanica = combo === undefined ? null : mecanicaDe(combo);

      expect(mecanica?.kind).toBe('BUNDLE_PRICE');
      // 48.00 + 22.50 = 70.50; al 90 % hacia abajo, 63.45.
      expect(mecanica?.kind === 'BUNDLE_PRICE' ? mecanica.bundlePrice : '').toBe('63.45');
    });
  });

  describe('el formato anterior', () => {
    it('una campaña sin mecánica se lee como precio de campaña por producto', () => {
      const vieja: CampanaDeFarmacia = {
        id: 'vieja',
        pharmacyId: FARMACIA,
        farmacia: NOMBRE,
        titulo: 'Vieja',
        descripcion: '',
        desde: new Date(),
        hasta: new Date(),
        productos: [
          { productId: 'p-1', nombre: 'a', presentacion: null, precioNormal: '10.00', precioPromocional: '8.00', moneda: 'BOB' },
        ],
        sembrada: false,
      };

      expect(mecanicaDe(vieja)).toEqual({ kind: 'CAMPAIGN_PRICE', prices: { 'p-1': '8.00' } });
    });

    it('un borrador con porcentaje y sin mecánica sigue publicándose', async () => {
      const resultado = await firstValueFrom(
        client.crear(
          {
            titulo: 'Heredada',
            descripcion: '',
            desde: new Date(Date.now() - UN_DIA),
            hasta: new Date(Date.now() + UN_DIA),
            tipoDeDescuento: 'PORCENTAJE',
            porcentaje: 25,
            renglones: [renglon('a', '10.00')],
          },
          FARMACIA,
          NOMBRE,
        ),
      );
      const campana = resultado as CampanaDeFarmacia;

      expect(campana.mecanica).toEqual({ kind: 'PERCENT_OFF', percent: 25 });
      expect(campana.productos[0].precioPromocional).toBe('7.50');
    });
  });

  describe('publicar cada mecánica', () => {
    it('una de cantidad deja el precio normal y ningún precio promocional', async () => {
      const campana = await publicar({ kind: 'BUY_X_PAY_Y', take: 2, pay: 1 }, { renglones: [renglon('a', '10')] });

      expect(campana.productos).toEqual([
        expect.objectContaining({ productId: 'a', precioNormal: '10.00', precioPromocional: null }),
      ]);
      expect(campana.mecanica).toEqual({ kind: 'BUY_X_PAY_Y', take: 2, pay: 1 });
    });

    it('una sobre el total se publica sin productos', async () => {
      const campana = await publicar(
        { kind: 'ORDER_PERCENT_OVER', minSpend: '100.00', percent: 10 },
        { renglones: [] },
      );

      expect(campana.productos).toEqual([]);
    });

    it('una sobre toda la tienda se publica sin elegir productos', async () => {
      const campana = await publicar(
        { kind: 'PERCENT_OFF', percent: 10 },
        { renglones: [], alcance: { itemIds: [], categoryIds: [], allItems: true } },
      );

      expect(campana.alcance?.allItems).toBe(true);
    });

    it('un monto fijo por unidad deja el precio rebajado', async () => {
      const campana = await publicar(
        { kind: 'AMOUNT_OFF_PER_UNIT', amount: '3.00' },
        { renglones: [renglon('a', '10.00')] },
      );

      expect(campana.productos[0].precioPromocional).toBe('7.00');
    });

    it('guarda las condiciones que declaró el formulario', async () => {
      const campana = await publicar(
        { kind: 'PERCENT_OFF', percent: 10 },
        { condiciones: { ...NO_CONDITIONS, maxDiscount: '20.00', weekdays: [6, 0] } },
      );

      expect(campana.condiciones).toMatchObject({ maxDiscount: '20.00', weekdays: [6, 0] });
    });

    it('dice qué falta: sin precio normal ya no se pierde el renglón en silencio', () => {
      const fallos = revisar(borrador({ kind: 'BUY_X_PAY_Y', take: 2, pay: 1 }, { renglones: [renglon('a', '')] }));

      expect(fallos).toContain('LIST_PRICE_INVALID');
    });

    it('rechaza un monto fijo igual o mayor que el precio', () => {
      const fallos = revisar(borrador({ kind: 'AMOUNT_OFF_PER_UNIT', amount: '10.00' }));

      expect(fallos).toContain('AMOUNT_EXCEEDS_PRICE');
    });

    it('rechaza un 2x1 que paga lo mismo que lleva', () => {
      expect(revisar(borrador({ kind: 'BUY_X_PAY_Y', take: 2, pay: 2 }))).toContain('BUY_QUANTITIES_INVALID');
    });
  });

  describe('evaluar un pedido', () => {
    it('aplica un 2x1 sobre las unidades del pedido', async () => {
      const campana = await publicar({ kind: 'BUY_X_PAY_Y', take: 2, pay: 1 });
      const resultado = client.evaluarPedido(FARMACIA, [{ itemId: 'a', quantity: 3, unitPrice: '10.00' }]);

      expect(resultado.lines[0]).toMatchObject({ discount: '10.00', total: '20.00', campaignId: campana.id });
    });

    it('aplica una compra mínima sobre el total, sin productos', async () => {
      await publicar({ kind: 'ORDER_PERCENT_OVER', minSpend: '50.00', percent: 10 }, { renglones: [] });
      const resultado = client.evaluarPedido(FARMACIA, [{ itemId: 'x', quantity: 1, unitPrice: '80.00' }]);

      expect(resultado.total).toBe('72.00');
    });

    it('avisa lo que falta para alcanzar la compra mínima', async () => {
      await publicar({ kind: 'ORDER_PERCENT_OVER', minSpend: '100.00', percent: 10 }, { renglones: [] });
      const resultado = client.evaluarPedido(FARMACIA, [{ itemId: 'x', quantity: 1, unitPrice: '80.00' }]);

      expect(resultado.nudges).toMatchObject([{ kind: 'SPEND_MORE', missingAmount: '20.00' }]);
    });

    it('no mezcla las campañas de otra farmacia', async () => {
      await publicar({ kind: 'BUY_X_PAY_Y', take: 2, pay: 1 }, {}, 'otra-farmacia');
      const resultado = client.evaluarPedido(FARMACIA, [{ itemId: 'a', quantity: 2, unitPrice: '10.00' }]);

      expect(resultado.totalDiscount).toBe('0.00');
    });

    it('una campaña con cupón sólo vale si el pedido lo trae', async () => {
      await publicar(
        { kind: 'PERCENT_OFF', percent: 50 },
        { condiciones: { ...NO_CONDITIONS, couponCode: 'AHORRO50' } },
      );
      const pedido = [{ itemId: 'a', quantity: 1, unitPrice: '10.00' }];

      expect(client.evaluarPedido(FARMACIA, pedido).totalDiscount).toBe('0.00');
      expect(client.evaluarPedido(FARMACIA, pedido, new Date(), ['ahorro50']).totalDiscount).toBe('5.00');
    });

    it('una campaña programada o terminada no descuenta', async () => {
      await publicar(
        { kind: 'PERCENT_OFF', percent: 50 },
        { desde: new Date(Date.now() + 5 * UN_DIA), hasta: new Date(Date.now() + 9 * UN_DIA) },
      );

      expect(
        client.evaluarPedido(FARMACIA, [{ itemId: 'a', quantity: 1, unitPrice: '10.00' }]).totalDiscount,
      ).toBe('0.00');
    });
  });

  describe('el precio promocional por unidad respeta el calendario y el cupón', () => {
    it('no da precio fuera de los días de la campaña', async () => {
      const ahora = new Date();
      const otroDia = (ahora.getDay() + 1) % 7;
      await publicar(
        { kind: 'PERCENT_OFF', percent: 50 },
        { condiciones: { ...NO_CONDITIONS, weekdays: [otroDia] } },
      );

      expect(client.precioPromocional(FARMACIA, 'a', ahora)).toBeNull();
    });

    it('da precio en los días de la campaña', async () => {
      const ahora = new Date();
      await publicar(
        { kind: 'PERCENT_OFF', percent: 50 },
        { condiciones: { ...NO_CONDITIONS, weekdays: [ahora.getDay()] } },
      );

      expect(client.precioPromocional(FARMACIA, 'a', ahora)?.precioPromocional).toBe('5.00');
    });

    it('no da precio detrás de un cupón que este camino no tiene', async () => {
      await publicar(
        { kind: 'PERCENT_OFF', percent: 50 },
        { condiciones: { ...NO_CONDITIONS, couponCode: 'AHORRO50' } },
      );

      expect(client.precioPromocional(FARMACIA, 'a')).toBeNull();
    });

    it('una campaña de 2x1 no inventa un precio por unidad', async () => {
      await publicar({ kind: 'BUY_X_PAY_Y', take: 2, pay: 1 });

      expect(client.precioPromocional(FARMACIA, 'a')).toBeNull();
    });
  });

  it('el paquete sembrado tiene ids únicos', () => {
    const slugs = CAMPANAS_SEMBRADAS.map((plantilla) => plantilla.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

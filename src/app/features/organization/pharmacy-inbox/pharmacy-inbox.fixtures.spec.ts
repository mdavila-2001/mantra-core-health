import { pharmacyOrderFromDto } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.adapter';
import { pharmacyOrderDtoFixture } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.spec-fixtures';
import type { PedidoFarmacia } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import {
  ID_PEDIDO_CON_DELIVERY,
  ID_PEDIDO_CON_SEGURO,
} from '../../../core/mock/fixtures/pedidos-de-farmacia';
import {
  PEDIDO_CON_DELIVERY,
  PEDIDO_CON_SEGURO,
  PEDIDO_ENTREGADO_CON_FACTURA,
  PEDIDO_NUEVO,
  coberturaDeEjemplo,
  entregaDeEjemplo,
  facturaDeEjemplo,
} from './pharmacy-inbox.fixtures';

/**
 * Los datos de ejemplo de la bandeja (FAR-I3). Lo que se prueba acá no es la
 * maqueta: es que el reparto del seguro cierre —cubierto más coaseguro es el
 * total del pedido— y que la factura no se invente para pedidos que todavía
 * no salieron.
 */
describe('pharmacy-inbox.fixtures · la respuesta del seguro', () => {
  it('sólo responde por el pedido con cobertura declarada', () => {
    expect(coberturaDeEjemplo(PEDIDO_NUEVO)).toBeNull();
    expect(coberturaDeEjemplo(PEDIDO_CON_DELIVERY)).toBeNull();
    expect(coberturaDeEjemplo(PEDIDO_CON_SEGURO)).not.toBeNull();
  });

  it('se reconoce por el identificador del pedido, no por el nombre de la persona', () => {
    // Mismo nombre, otro pedido: la cobertura no se contagia.
    const otroPedido = { ...PEDIDO_CON_SEGURO, id: PEDIDO_NUEVO.id };
    expect(coberturaDeEjemplo(otroPedido)).toBeNull();

    // Y sin nombre, el pedido de siempre sigue teniendo su cobertura.
    expect(coberturaDeEjemplo({ ...PEDIDO_CON_SEGURO, paciente: null })).not.toBeNull();
  });

  it('el identificador es el que siembra el backend simulado, desde un solo lugar', () => {
    expect(PEDIDO_CON_SEGURO.id).toBe(ID_PEDIDO_CON_SEGURO);
  });

  it('dice lo aprobado y lo NO aprobado, renglón por renglón', () => {
    const cobertura = coberturaDeEjemplo(PEDIDO_CON_SEGURO);
    expect(cobertura?.renglones.map((renglon) => renglon.aprobado)).toEqual([true, false]);
  });

  it('el renglón aprobado se reparte por el porcentaje del plan', () => {
    const cobertura = coberturaDeEjemplo(PEDIDO_CON_SEGURO);
    // 40,00 × 2 unidades al 80 %: 64,00 el seguro y 16,00 la persona.
    expect(cobertura?.renglones[0]).toEqual({
      aprobado: true,
      cubierto: '64.00',
      coaseguro: '16.00',
    });
  });

  it('el renglón NO aprobado lo paga entero la persona', () => {
    const cobertura = coberturaDeEjemplo(PEDIDO_CON_SEGURO);
    expect(cobertura?.renglones[1]).toEqual({
      aprobado: false,
      cubierto: '0.00',
      coaseguro: '95.50',
    });
  });

  it('el reparto cierra contra el total del pedido: no se pierde ni se inventa plata', () => {
    const cobertura = coberturaDeEjemplo(PEDIDO_CON_SEGURO);
    const repartido = Number(cobertura?.totalCubierto) + Number(cobertura?.totalCoaseguro);
    expect(repartido.toFixed(2)).toBe(PEDIDO_CON_SEGURO.totalEstimado);
  });

  it('los importes son texto, como en todo el contrato de farmacia', () => {
    const cobertura = coberturaDeEjemplo(PEDIDO_CON_SEGURO);
    expect(typeof cobertura?.totalCubierto).toBe('string');
    expect(typeof cobertura?.totalCoaseguro).toBe('string');
  });

  it('un renglón que el mostrador descartó no lo paga nadie', () => {
    // Sólo queda en pie el primero: el segundo se marcó «No disponible».
    const cobertura = coberturaDeEjemplo(PEDIDO_CON_SEGURO, new Set([0]));

    expect(cobertura?.renglones[1]).toEqual({
      aprobado: false,
      cubierto: '0.00',
      coaseguro: '0.00',
    });
    // El de arriba sigue repartido como siempre.
    expect(cobertura?.renglones[0]?.cubierto).toBe('64.00');
  });

  it('descartar un renglón mueve el reparto, igual que mueve el total en vivo', () => {
    const entero = coberturaDeEjemplo(PEDIDO_CON_SEGURO);
    const sinElSegundo = coberturaDeEjemplo(PEDIDO_CON_SEGURO, new Set([0]));

    expect(entero?.totalCoaseguro).toBe('111.50');
    // Los 95,50 del renglón caído dejan de cobrarse.
    expect(sinElSegundo?.totalCoaseguro).toBe('16.00');
    expect(sinElSegundo?.totalCubierto).toBe(entero?.totalCubierto);
  });

  it('la aprobación es del seguro y no cambia porque el mostrador no tenga stock', () => {
    const cobertura = coberturaDeEjemplo(PEDIDO_CON_SEGURO, new Set());

    expect(cobertura?.renglones.map((renglon) => renglon.aprobado)).toEqual([true, false]);
    expect(cobertura?.totalCubierto).toBe('0.00');
    expect(cobertura?.totalCoaseguro).toBe('0.00');
  });
});

describe('pharmacy-inbox.fixtures · el medio de entrega de la maqueta', () => {
  it('sólo alcanza al pedido de ejemplo: el resto usa lo que devuelve la API', () => {
    expect(entregaDeEjemplo(PEDIDO_NUEVO)).toBeNull();
    expect(entregaDeEjemplo(PEDIDO_CON_SEGURO)).toBeNull();
    expect(entregaDeEjemplo(PEDIDO_ENTREGADO_CON_FACTURA)).toBeNull();
  });

  it('el pedido de ejemplo sale a domicilio, con su dirección', () => {
    const entrega = entregaDeEjemplo(PEDIDO_CON_DELIVERY);

    expect(PEDIDO_CON_DELIVERY.id).toBe(ID_PEDIDO_CON_DELIVERY);
    expect(entrega?.modalidad).toBe('DOMICILIO');
    expect((entrega?.direccion ?? '').length).toBeGreaterThan(10);
  });
});

/**
 * La factura, ejercida sobre **lo que el adaptador produce de verdad**: un
 * pedido armado desde el DTO de la API, no a mano. La versión anterior de
 * estas pruebas montaba un pedido con `entregas` cargadas —algo que
 * `pharmacy-orders.adapter.ts:95` no puede devolver nunca— y por eso pasaba
 * en verde mientras la pantalla fechaba el comprobante el día del pedido.
 */
describe('pharmacy-inbox.fixtures · la factura', () => {
  const AHORA = new Date('2026-09-10T15:00:00.000Z');

  /** Un pedido entregado tal como llega de la API, por el adaptador real. */
  function entregadoComoLoDaLaApi(): PedidoFarmacia {
    return pharmacyOrderFromDto(
      pharmacyOrderDtoFixture({ status: { code: 'PINV_ORDER_RETIRADO', display: 'Retirado' } }),
      'staff',
    );
  }

  it('el adaptador no trae ni entregas ni pago: no hay de dónde sacar la fecha', () => {
    const entregado = entregadoComoLoDaLaApi();
    // Si esto dejara de ser cierto, la factura podría usar la fecha real y
    // esta suite tiene que enterarse.
    expect(entregado.entregas).toEqual([]);
    expect(entregado.pago).toBeNull();
  });

  it('no existe hasta que el pedido salió', () => {
    expect(facturaDeEjemplo(PEDIDO_NUEVO, AHORA)).toBeNull();
    expect(facturaDeEjemplo(PEDIDO_CON_DELIVERY, AHORA)).toBeNull();
  });

  it('el pedido entregado la tiene, con su total y su estado en palabras', () => {
    const factura = facturaDeEjemplo(entregadoComoLoDaLaApi(), AHORA);
    expect(factura?.total).toBe('68.00');
    expect(factura?.moneda).toBe('BOB');
    expect(factura?.estado).toBe('Enviada al paciente');
  });

  it('NO se fecha el día en que se hizo el pedido: una factura anterior a la entrega no existe', () => {
    const entregado = entregadoComoLoDaLaApi();
    const factura = facturaDeEjemplo(entregado, AHORA);

    expect(factura?.emitidaEl).toBe(AHORA);
    expect(factura?.emitidaEl.getTime()).not.toBe(entregado.creadoEl.getTime());
    expect(factura?.emitidaEl.getTime()).toBeGreaterThan(entregado.creadoEl.getTime());
  });

  it('el número es estable y no deja ver el identificador del pedido', () => {
    const entregado = entregadoComoLoDaLaApi();
    const primera = facturaDeEjemplo(entregado, AHORA);
    const segunda = facturaDeEjemplo(entregado, AHORA);

    expect(primera?.numero).toBe(segunda?.numero);
    expect(primera?.numero).toMatch(/^\d{8}$/);
    expect(entregado.id).not.toContain(primera?.numero ?? '');
  });

  it('sin total publicado no hay factura: un comprobante sin cifra no es un comprobante', () => {
    expect(
      facturaDeEjemplo({ ...entregadoComoLoDaLaApi(), totalEstimado: null }, AHORA),
    ).toBeNull();
  });
});

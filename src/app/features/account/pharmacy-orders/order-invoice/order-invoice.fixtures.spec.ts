import { uuid } from '../../../../core/mock/mock-store';
import { facturaDeEjemplo } from '../../../organization/pharmacy-inbox/pharmacy-inbox.fixtures';
import { conSeguimientoDeEjemplo, facturaDelPedido } from './order-invoice.fixtures';
import {
  lineaDePrueba,
  liquidacionDePrueba,
  pedidoDePrueba,
} from './order-invoice.spec-fixtures';

/**
 * Lo que se fija acá es la regla D-FARMOCK-2: la maqueta **completa** lo que
 * el contrato no publica, sólo para pedidos conocidos y sólo con el backend
 * simulado; nunca reemplaza un valor del contrato ni inventa una factura
 * donde no la hay.
 */
describe('order-invoice fixtures', () => {
  const ENTREGADO = uuid('pharmacy-order-3');
  const LISTO = uuid('pharmacy-order-1');

  describe('el seguimiento de ejemplo', () => {
    it('un pedido desconocido sale intacto: el mismo objeto, sin datos ficticios', () => {
      const real = pedidoDePrueba({ estado: 'LISTO_PARA_RETIRO' });
      expect(conSeguimientoDeEjemplo(real, true)).toBe(real);
    });

    it('con la API real no aporta nada, ni siquiera a un pedido conocido', () => {
      const conocido = pedidoDePrueba({ id: LISTO, estado: 'LISTO_PARA_RETIRO' });
      expect(conSeguimientoDeEjemplo(conocido, false)).toBe(conocido);
    });

    it('completa sólo el pago que el contrato no trae', () => {
      const conocido = pedidoDePrueba({ id: LISTO, estado: 'LISTO_PARA_RETIRO' });
      const vista = conSeguimientoDeEjemplo(conocido, true);

      expect(vista.pago).toEqual({
        estado: 'PAGADO',
        origen: 'QR_DEMO',
        pagadoEl: new Date(conocido.creadoEl.getTime() + 4 * 60_000),
        total: '68.00',
        moneda: 'BOB',
      });
      // El pago nunca es anterior al pedido.
      expect(vista.pago!.pagadoEl!.getTime()).toBeGreaterThan(conocido.creadoEl.getTime());
      // Todo lo demás es el pedido del contrato, campo por campo.
      expect({ ...vista, pago: null }).toEqual(conocido);
    });

    it('nunca pisa un pago que el contrato sí trae', () => {
      const pagoReal = {
        estado: 'PENDIENTE' as const,
        origen: null,
        pagadoEl: null,
        total: '68.00',
        moneda: 'BOB',
      };
      const conocido = pedidoDePrueba({ id: LISTO, estado: 'LISTO_PARA_RETIRO', pago: pagoReal });
      expect(conSeguimientoDeEjemplo(conocido, true)).toBe(conocido);
    });

    it('nunca reemplaza la modalidad, el hito del envío ni la dirección del contrato', () => {
      for (const modalidad of ['RETIRO', 'DOMICILIO', 'TRABAJO', null] as const) {
        const conocido = pedidoDePrueba({ id: ENTREGADO, modalidad });
        const vista = conSeguimientoDeEjemplo(conocido, true);
        expect(vista.modalidad).toBe(modalidad);
        expect(vista.envio).toBeNull();
        expect(vista.direccionDeEntrega).toBeNull();
      }
      const conEnvio = pedidoDePrueba({
        id: ENTREGADO,
        modalidad: 'DOMICILIO',
        envio: 'ENTREGADO',
        direccionDeEntrega: 'Calle del contrato 1',
      });
      const vista = conSeguimientoDeEjemplo(conEnvio, true);
      expect(vista.envio).toBe('ENTREGADO');
      expect(vista.direccionDeEntrega).toBe('Calle del contrato 1');
    });

    it('un pedido cancelado, rechazado o vencido no recibe pago', () => {
      for (const estado of ['CANCELADO', 'RECHAZADO', 'VENCIDO'] as const) {
        const conocido = pedidoDePrueba({ id: LISTO, estado });
        expect(conSeguimientoDeEjemplo(conocido, true)).toBe(conocido);
      }
    });

    it('los pedidos con seguro que no son casos de ejemplo quedan intactos', () => {
      const conSeguroDenegado = pedidoDePrueba({ id: uuid('pharmacy-copay-denied'), estado: 'CONFIRMADO' });
      expect(conSeguimientoDeEjemplo(conSeguroDenegado, true)).toBe(conSeguroDenegado);
    });
  });

  describe('la factura', () => {
    it('no existe para un pedido desconocido, aunque esté entregado', () => {
      expect(facturaDelPedido(pedidoDePrueba(), true)).toBeNull();
    });

    it('no existe con la API real', () => {
      expect(facturaDelPedido(pedidoDePrueba({ id: ENTREGADO }), false)).toBeNull();
    });

    it('no existe antes de la entrega: una factura anterior a la entrega no existe', () => {
      for (const estado of ['ENVIADO', 'CONFIRMADO', 'LISTO_PARA_RETIRO'] as const) {
        expect(facturaDelPedido(pedidoDePrueba({ id: ENTREGADO, estado }), true)).toBeNull();
      }
    });

    it('no existe sin un total publicado', () => {
      expect(
        facturaDelPedido(pedidoDePrueba({ id: ENTREGADO, totalEstimado: null }), true),
      ).toBeNull();
    });

    it('arma el documento entero, con número y estado alineados al resumen del mostrador', () => {
      const entregado = pedidoDePrueba({ id: ENTREGADO });
      const factura = facturaDelPedido(entregado, true)!;
      const resumen = facturaDeEjemplo(entregado, factura.emitidaEl)!;

      expect(factura.numero).toBe(resumen.numero);
      expect(factura.estado).toBe(resumen.estado);
      expect(factura.emitidaEl.getTime()).toBeGreaterThan(entregado.creadoEl.getTime());
      expect(factura.emisor).toEqual({
        nombre: 'Farmacia Andina',
        detalle: 'Sucursal Centro',
        razonSocial: 'Farmacia Andina',
        nit: '1028394027',
      });
      expect(factura.comprador.nombre).toBe('Ana Paciente');
      expect(factura.lineas).toEqual([
        { descripcion: 'Amoxicilina · 500 mg', cantidad: 1, importe: '68.00' },
      ]);
      expect(factura.subtotal).toBe('68.00');
      expect(factura.descuentoDeRed).toBe('6.80');
      expect(factura.total).toBe('61.20');
      expect(factura.moneda).toBe('BOB');
      expect(factura.coaseguro).toBeNull();
    });

    it('factura sólo lo que la farmacia mantuvo en pie, con importes exactos', () => {
      const entregado = pedidoDePrueba({
        id: ENTREGADO,
        totalEstimado: '105.30',
        lineas: [
          lineaDePrueba({ medicamento: 'Levotiroxina', presentacion: null, precio: '17.55', cantidad: 3 }),
          lineaDePrueba({ medicamento: 'Omeprazol', precio: '52.65', cantidad: 1 }),
          lineaDePrueba({ medicamento: 'Sin stock', precio: '99.00', disponible: false }),
        ],
      });
      const factura = facturaDelPedido(entregado, true)!;

      expect(factura.lineas.map((l) => l.descripcion)).toEqual(['Levotiroxina', 'Omeprazol · 500 mg']);
      expect(factura.lineas[0]!.importe).toBe('52.65');
      expect(factura.subtotal).toBe('105.30');
      expect(factura.descuentoDeRed).toBe('10.53');
      expect(factura.total).toBe('94.77');
    });

    it('sin un precio publicado no inventa ni subtotal ni total', () => {
      const entregado = pedidoDePrueba({
        id: ENTREGADO,
        lineas: [lineaDePrueba(), lineaDePrueba({ precio: null })],
      });
      const factura = facturaDelPedido(entregado, true)!;

      expect(factura.lineas[1]!.importe).toBeNull();
      expect(factura.subtotal).toBeNull();
      expect(factura.descuentoDeRed).toBeNull();
      expect(factura.total).toBeNull();
    });

    it('el coaseguro sale de la liquidación real del seguro cuando está publicada', () => {
      const conSeguro = pedidoDePrueba({
        id: ENTREGADO,
        insuranceSettlementAvailability: 'AVAILABLE',
        insuranceSettlement: liquidacionDePrueba(),
      });
      expect(facturaDelPedido(conSeguro, true)!.coaseguro).toEqual({
        aseguradora: 'Seguros Bolívar',
        importe: '13.60',
        moneda: 'BOB',
      });

      const pendiente = pedidoDePrueba({
        id: ENTREGADO,
        insuranceSettlementAvailability: 'PENDING_PUBLICATION',
        insuranceSettlement: null,
      });
      expect(facturaDelPedido(pendiente, true)!.coaseguro).toBeNull();
    });
  });
});

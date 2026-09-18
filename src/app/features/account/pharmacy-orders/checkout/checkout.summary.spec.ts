import { resumirPedido, type RenglonACobrar } from './checkout.summary';

/**
 * El resumen del checkout real (R-T-E3 · AC-R3-04): **sólo** aritmética sobre
 * los precios que publica la farmacia. Nada de descuento de red, coaseguro,
 * envío ni puntos: no existen en el contrato antes de crear el pedido.
 */

const AMOXICILINA: RenglonACobrar = {
  indice: 0,
  medicamento: 'Amoxicilina 500 mg',
  presentacion: 'Caja x 21 cápsulas',
  cantidad: 1,
  precioUnitario: '68.00',
  disponible: true,
};

const LOSARTAN: RenglonACobrar = {
  indice: 1,
  medicamento: 'Losartán 50 mg',
  presentacion: 'Caja x 30',
  cantidad: 1,
  precioUnitario: '40.00',
  disponible: true,
};

describe('resumirPedido', () => {
  it('suma los renglones publicados y no agrega ninguna línea que el contrato no produzca', () => {
    const resumen = resumirPedido({
      renglones: [{ ...AMOXICILINA, cantidad: 2 }, LOSARTAN],
      moneda: 'BOB',
    });

    expect(resumen.renglones.map((r) => r.subtotal)).toEqual(['136.00', '40.00']);
    expect(resumen.total).toBe('176.00');
    // El resumen no tiene dónde meter un porcentaje inventado.
    expect(Object.keys(resumen).sort()).toEqual(['moneda', 'renglones', 'total']);
    expect(JSON.stringify(resumen)).not.toMatch(/descuento|coaseguro|envio|envío|puntos/i);
  });

  it('lo que la farmacia no tiene no suma y se muestra sin subtotal', () => {
    const resumen = resumirPedido({
      renglones: [{ ...AMOXICILINA, disponible: false }, LOSARTAN],
      moneda: 'BOB',
    });

    expect(resumen.renglones[0]?.subtotal).toBeNull();
    expect(resumen.renglones[0]?.precioUnitario).toBeNull();
    expect(resumen.total).toBe('40.00');
  });

  it('si falta un precio, el total no se afirma', () => {
    const resumen = resumirPedido({
      renglones: [AMOXICILINA, { ...LOSARTAN, precioUnitario: null }],
      moneda: 'BOB',
    });

    expect(resumen.total).toBeNull();
  });
});

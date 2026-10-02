import { resumirPedido, type RenglonACobrar } from './checkout.summary';

/**
 * Las líneas del resumen (AC-T-E3-05): cuentas en centavos, un solo total con
 * seguro (F2.2.5) y `null` cuando falta un precio en vez de un total parcial.
 */

const AMOXICILINA: RenglonACobrar = {
  indice: 0,
  medicamento: 'Amoxicilina 500 mg',
  presentacion: 'Caja x 21 cápsulas',
  cantidad: 1,
  precioUnitario: '68.00',
  esAlternativa: false,
  aprobadoPorSeguro: true,
  disponible: true,
};

const LOSARTAN: RenglonACobrar = {
  indice: 1,
  medicamento: 'Losartán 50 mg',
  presentacion: 'Caja x 30',
  cantidad: 1,
  precioUnitario: '40.00',
  esAlternativa: false,
  aprobadoPorSeguro: false,
  disponible: true,
};

describe('resumirPedido', () => {
  it('sin seguro y con recojo: subtotal, descuento de red, total y puntos; sin coaseguro ni envío', () => {
    const resumen = resumirPedido({
      renglones: [AMOXICILINA, LOSARTAN],
      moneda: 'BOB',
      conSeguro: false,
      conEnvio: false,
    });

    expect(resumen.aprobados).toEqual([]);
    expect(resumen.noAprobados.map((r) => r.subtotal)).toEqual(['68.00', '40.00']);
    expect(resumen.subtotal).toBe('108.00');
    expect(resumen.descuentoDeRed).toBe('10.80');
    expect(resumen.coaseguro).toBeNull();
    expect(resumen.cubreElSeguro).toBeNull();
    expect(resumen.envio).toBeNull();
    expect(resumen.total).toBe('97.20');
    expect(resumen.puntos).toBe(9);
  });

  it('con delivery suma el envío de ejemplo', () => {
    const resumen = resumirPedido({
      renglones: [AMOXICILINA, LOSARTAN],
      moneda: 'BOB',
      conSeguro: false,
      conEnvio: true,
    });

    expect(resumen.envio).toBe('15.00');
    expect(resumen.total).toBe('112.20');
    expect(resumen.puntos).toBe(11);
  });

  it('con seguro separa los dos bloques y consolida un solo total', () => {
    const resumen = resumirPedido({
      renglones: [{ ...AMOXICILINA, cantidad: 2 }, LOSARTAN],
      moneda: 'BOB',
      conSeguro: true,
      conEnvio: false,
    });

    expect(resumen.aprobados.map((r) => r.medicamento)).toEqual(['Amoxicilina 500 mg']);
    expect(resumen.noAprobados.map((r) => r.medicamento)).toEqual(['Losartán 50 mg']);
    expect(resumen.subtotal).toBe('176.00');
    // El descuento de red va sobre lo no aprobado; el coaseguro, sobre lo aprobado.
    expect(resumen.descuentoDeRed).toBe('4.00');
    expect(resumen.coaseguro).toBe('27.20');
    expect(resumen.cubreElSeguro).toBe('108.80');
    expect(resumen.total).toBe('63.20');
  });

  it('lo que la farmacia no tiene no suma ni se cuenta como aprobado', () => {
    const resumen = resumirPedido({
      renglones: [{ ...AMOXICILINA, disponible: false }, LOSARTAN],
      moneda: 'BOB',
      conSeguro: true,
      conEnvio: false,
    });

    expect(resumen.aprobados).toEqual([]);
    expect(resumen.noAprobados[0]?.subtotal).toBeNull();
    expect(resumen.coaseguro).toBeNull();
    expect(resumen.subtotal).toBe('40.00');
    expect(resumen.total).toBe('36.00');
  });

  it('si falta un precio, el total no se afirma', () => {
    const resumen = resumirPedido({
      renglones: [AMOXICILINA, { ...LOSARTAN, precioUnitario: null }],
      moneda: 'BOB',
      conSeguro: false,
      conEnvio: false,
    });

    expect(resumen.subtotal).toBeNull();
    expect(resumen.total).toBeNull();
    expect(resumen.puntos).toBeNull();
  });
  describe('las campañas', () => {
    it('el descuento de un renglón se resta del renglón y el precio sigue siendo el de lista', () => {
      const resumen = resumirPedido({
        renglones: [{ ...LOSARTAN, cantidad: 2, descuentoDeCampana: '40.00', promocion: '2x1' }],
        moneda: 'BOB',
        conSeguro: false,
        conEnvio: false,
      });

      // 2 × 40.00 − 40.00 = 40.00.
      expect(resumen.noAprobados[0].subtotal).toBe('40.00');
      expect(resumen.noAprobados[0].promocion).toBe('2x1');
      expect(resumen.subtotal).toBe('40.00');
    });

    it('un renglón sin campaña no tiene promoción', () => {
      const resumen = resumirPedido({ renglones: [LOSARTAN], moneda: 'BOB', conSeguro: false, conEnvio: false });

      expect(resumen.noAprobados[0].promocion).toBeNull();
      expect(resumen.descuentoDeCampana).toBeNull();
    });

    it('nunca deja un renglón en negativo', () => {
      const resumen = resumirPedido({
        renglones: [{ ...LOSARTAN, descuentoDeCampana: '99.00' }],
        moneda: 'BOB',
        conSeguro: false,
        conEnvio: false,
      });

      expect(resumen.noAprobados[0].subtotal).toBe('0.00');
    });

    it('el descuento sobre el total se resta antes del descuento de red, que se calcula sobre lo que queda', () => {
      const resumen = resumirPedido({
        renglones: [AMOXICILINA, LOSARTAN],
        moneda: 'BOB',
        conSeguro: false,
        conEnvio: false,
        descuentoDeCampanaDelTotal: '8.00',
      });

      expect(resumen.subtotal).toBe('108.00');
      expect(resumen.descuentoDeCampana).toBe('8.00');
      // Base de pago 100.00; descuento de red 10 % = 10.00; total 90.00.
      expect(resumen.descuentoDeRed).toBe('10.00');
      expect(resumen.total).toBe('90.00');
    });

    it('el descuento sobre el total nunca supera lo que se paga', () => {
      const resumen = resumirPedido({
        renglones: [LOSARTAN],
        moneda: 'BOB',
        conSeguro: false,
        conEnvio: false,
        descuentoDeCampanaDelTotal: '500.00',
      });

      expect(resumen.descuentoDeCampana).toBe('40.00');
      expect(resumen.total).toBe('0.00');
    });

    it('con seguro, el descuento sobre el total lo recibe lo que paga la persona, no lo aprobado', () => {
      const resumen = resumirPedido({
        renglones: [AMOXICILINA, LOSARTAN],
        moneda: 'BOB',
        conSeguro: true,
        conEnvio: false,
        descuentoDeCampanaDelTotal: '10.00',
      });

      // Aprobado: 68.00 (coaseguro 20 %: 13.60). No aprobado: 40.00 − 10.00 = 30.00,
      // y el descuento de red sobre esos 30.00: 3.00.
      expect(resumen.coaseguro).toBe('13.60');
      expect(resumen.descuentoDeRed).toBe('3.00');
      expect(resumen.total).toBe('40.60');
    });

    it('sin descuento sobre el total, no hay línea de promoción', () => {
      const resumen = resumirPedido({ renglones: [LOSARTAN], moneda: 'BOB', conSeguro: false, conEnvio: false });

      expect(resumen.descuentoDeCampana).toBeNull();
    });

    it('con un precio que falta, el total sigue siendo null: la campaña no inventa un total parcial', () => {
      const resumen = resumirPedido({
        renglones: [{ ...LOSARTAN, precioUnitario: null }],
        moneda: 'BOB',
        conSeguro: false,
        conEnvio: false,
        descuentoDeCampanaDelTotal: '5.00',
      });

      expect(resumen.total).toBeNull();
    });
  });
});

import { SiatSimuladoAdapter } from '../siat-sim/siat-simulado.adapter';
import { EMISOR_CONSULTORIO, PADRON_SIMULADO } from './datos-simulados';
import { FacturacionSimulada, subtotalDeRenglon, totalDeRenglones, type CobroInicial } from './facturacion-simulada';

/**
 * El servicio de MANTRA contra el SIAT simulado, sin fixtures de la maqueta:
 * cobros armados acá para aislar la lógica de credenciales y numeración.
 */
describe('FacturacionSimulada', () => {
  let ahora: Date;
  let siat: SiatSimuladoAdapter;
  let facturacion: FacturacionSimulada;

  function cobro(id: string, pagado: boolean): CobroInicial {
    return {
      id,
      source: 'CONSULTATION',
      sourceRef: `cita-${id}`,
      issuerId: EMISOR_CONSULTORIO.issuer.id,
      patientProfileId: `paciente-${id}`,
      patientName: 'PACIENTE DE PRUEBA',
      description: 'Consulta',
      lines: [
        { productCode: 'C', description: 'Consulta', quantity: '1', unitOfMeasure: 58, unitPrice: '250.00', discount: null, subtotal: '250.00' },
      ],
      createdAt: ahora.toISOString(),
      suggestedBuyer: { name: 'PACIENTE DE PRUEBA', documentTypeCode: 1, documentNumber: '1234567', email: null },
      payment: pagado
        ? { id: `pago-${id}`, methodCode: 1, methodLabel: 'EFECTIVO', amount: '250.00', currency: 'BOB', paidAt: ahora.toISOString(), simulated: true }
        : null,
    };
  }

  const comprador = { buyer: { name: 'PACIENTE DE PRUEBA', documentTypeCode: 1, documentNumber: '1234567' } };

  beforeEach(() => {
    ahora = new Date('2026-09-15T14:00:00.000Z');
    siat = new SiatSimuladoAdapter({ padron: PADRON_SIMULADO, reloj: () => ahora });
    facturacion = new FacturacionSimulada({
      siat,
      emisores: [EMISOR_CONSULTORIO],
      cobros: [cobro('a', true), cobro('b', true), cobro('c', false)],
      reloj: () => ahora,
    });
  });

  it('calcula subtotales y totales en centavos, sin errores de coma flotante', () => {
    expect(subtotalDeRenglon('3', '0.10', null)).toBe('0.30');
    expect(subtotalDeRenglon('2', '12.35', '1.00')).toBe('23.70');
    expect(
      totalDeRenglones([
        { productCode: 'x', description: 'x', quantity: '1', unitOfMeasure: 1, unitPrice: '0.10', discount: null, subtotal: '0.10' },
        { productCode: 'y', description: 'y', quantity: '1', unitOfMeasure: 1, unitPrice: '0.20', discount: null, subtotal: '0.20' },
      ]),
    ).toBe('0.30');
  });

  it('pide CUIS y CUFD en la primera emisión y los reutiliza mientras están vigentes', () => {
    const cuis = vi.spyOn(siat, 'solicitudCuis');
    const cufd = vi.spyOn(siat, 'solicitudCufd');
    facturacion.emitirFactura('a', comprador, 'prueba');
    facturacion.emitirFactura('b', comprador, 'prueba');
    expect(cuis).toHaveBeenCalledTimes(1);
    expect(cufd).toHaveBeenCalledTimes(1);
  });

  it('renueva el CUFD vencido (24 h) sin pedir otro CUIS, y el CUF usa el codigoControl nuevo', () => {
    const primera = facturacion.emitirFactura('a', comprador, 'prueba');
    ahora = new Date(ahora.getTime() + 25 * 3_600_000);
    const cuis = vi.spyOn(siat, 'solicitudCuis');
    const segunda = facturacion.emitirFactura('b', comprador, 'prueba');
    expect(cuis).not.toHaveBeenCalled();
    expect(primera.ok && segunda.ok).toBe(true);
    if (primera.ok && segunda.ok) {
      expect(segunda.value.cufd).not.toBe(primera.value.cufd);
      expect(segunda.value.siatResponse.codigoEstado).toBe(908);
      expect(segunda.value.invoiceNumber).toBe(2);
    }
  });

  it('un cobro sin pago no se factura; se registra el pago y entonces sí', () => {
    expect(facturacion.emitirFactura('c', comprador, 'prueba')).toEqual(
      expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'PAYMENT_REQUIRED' }) }),
    );
    expect(facturacion.registrarPago('c', 3).ok).toBe(true);
    const r = facturacion.emitirFactura('c', comprador, 'prueba');
    expect(r.ok && r.value.status).toBe('VALIDATED');
  });

  it('el emisor emite en sector 1 (CA-1): el padrón simulado no habilita el 17', () => {
    const r = facturacion.emitirFactura('a', comprador, 'prueba');
    expect(r.ok && r.value.documentSector).toBe(1);
    expect(PADRON_SIMULADO.every((c) => c.sectoresHabilitados.includes(1) && !c.sectoresHabilitados.includes(17))).toBe(true);
  });

  it('después de anular se puede volver a facturar el cobro', () => {
    const primera = facturacion.emitirFactura('a', comprador, 'prueba');
    if (!primera.ok) throw new Error('la primera emisión tenía que pasar');
    expect(facturacion.anular(primera.value.id, 1).ok).toBe(true);
    ahora = new Date(ahora.getTime() + 1000);
    const segunda = facturacion.emitirFactura('a', comprador, 'prueba');
    expect(segunda.ok && segunda.value.status).toBe('VALIDATED');
  });
});

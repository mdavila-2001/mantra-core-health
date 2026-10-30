import { SiatSimulatedAdapter } from '../siat-sim/siat-simulated.adapter';
import { PRACTICE_ISSUER, SIMULATED_REGISTRY } from './simulated-data';
import { SimulatedInvoicing, lineSubtotal, linesTotal, type InitialCharge } from './simulated-invoicing';

/**
 * El servicio de MANTRA contra el SIAT simulado, sin fixtures de la maqueta:
 * cobros armados acá para aislar la lógica de credenciales y numeración.
 */
describe('FacturacionSimulada', () => {
  let ahora: Date;
  let siat: SiatSimulatedAdapter;
  let facturacion: SimulatedInvoicing;

  function cobro(id: string, pagado: boolean): InitialCharge {
    return {
      id,
      source: 'CONSULTATION',
      sourceRef: `cita-${id}`,
      issuerId: PRACTICE_ISSUER.issuer.id,
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
    siat = new SiatSimulatedAdapter({ padron: SIMULATED_REGISTRY, reloj: () => ahora });
    facturacion = new SimulatedInvoicing({
      siat,
      emisores: [PRACTICE_ISSUER],
      cobros: [cobro('a', true), cobro('b', true), cobro('c', false)],
      reloj: () => ahora,
    });
  });

  it('calcula subtotales y totales en centavos, sin errores de coma flotante', () => {
    expect(lineSubtotal('3', '0.10', null)).toBe('0.30');
    expect(lineSubtotal('2', '12.35', '1.00')).toBe('23.70');
    expect(
      linesTotal([
        { productCode: 'x', description: 'x', quantity: '1', unitOfMeasure: 1, unitPrice: '0.10', discount: null, subtotal: '0.10' },
        { productCode: 'y', description: 'y', quantity: '1', unitOfMeasure: 1, unitPrice: '0.20', discount: null, subtotal: '0.20' },
      ]),
    ).toBe('0.30');
  });

  it('pide CUIS y CUFD en la primera emisión y los reutiliza mientras están vigentes', () => {
    const cuis = vi.spyOn(siat, 'solicitudCuis');
    const cufd = vi.spyOn(siat, 'solicitudCufd');
    facturacion.issueInvoice('a', comprador, 'prueba');
    facturacion.issueInvoice('b', comprador, 'prueba');
    expect(cuis).toHaveBeenCalledTimes(1);
    expect(cufd).toHaveBeenCalledTimes(1);
  });

  it('renueva el CUFD vencido (24 h) sin pedir otro CUIS, y el CUF usa el codigoControl nuevo', () => {
    const primera = facturacion.issueInvoice('a', comprador, 'prueba');
    ahora = new Date(ahora.getTime() + 25 * 3_600_000);
    const cuis = vi.spyOn(siat, 'solicitudCuis');
    const segunda = facturacion.issueInvoice('b', comprador, 'prueba');
    expect(cuis).not.toHaveBeenCalled();
    expect(primera.ok && segunda.ok).toBe(true);
    if (primera.ok && segunda.ok) {
      expect(segunda.value.cufd).not.toBe(primera.value.cufd);
      expect(segunda.value.siatResponse.codigoEstado).toBe(908);
      expect(segunda.value.invoiceNumber).toBe(2);
    }
  });

  it('un cobro sin pago no se factura; se registra el pago y entonces sí', () => {
    expect(facturacion.issueInvoice('c', comprador, 'prueba')).toEqual(
      expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'PAYMENT_REQUIRED' }) }),
    );
    expect(facturacion.registerPayment('c', 3).ok).toBe(true);
    const r = facturacion.issueInvoice('c', comprador, 'prueba');
    expect(r.ok && r.value.status).toBe('VALIDATED');
  });

  it('el emisor emite en sector 1 (CA-1): el padrón simulado no habilita el 17', () => {
    const r = facturacion.issueInvoice('a', comprador, 'prueba');
    expect(r.ok && r.value.documentSector).toBe(1);
    expect(SIMULATED_REGISTRY.every((c) => c.sectoresHabilitados.includes(1) && !c.sectoresHabilitados.includes(17))).toBe(true);
  });

  it('después de anular se puede volver a facturar el cobro', () => {
    const primera = facturacion.issueInvoice('a', comprador, 'prueba');
    if (!primera.ok) throw new Error('la primera emisión tenía que pasar');
    expect(facturacion.void(primera.value.id, 1).ok).toBe(true);
    ahora = new Date(ahora.getTime() + 1000);
    const segunda = facturacion.issueInvoice('a', comprador, 'prueba');
    expect(segunda.ok && segunda.value.status).toBe('VALIDATED');
  });

  describe('plan de pagos (consulta con reconsultas)', () => {
    function conPlan(id: string): InitialCharge {
      const instancia = (n: number, label: string, monto: string) => ({
        id: `${id}-i${n}`,
        kind: n === 1 ? ('CONSULTATION' as const) : ('FOLLOW_UP' as const),
        label,
        expectedAmount: monto,
        bookingId: null,
        scheduledAt: null,
        salesNotes: [],
      });
      return {
        ...cobro(id, false),
        plan: {
          serviceCode: 'CONS-RECONS',
          serviceName: 'Consulta con 2 reconsultas',
          instances: [instancia(1, 'Consulta inicial', '250.00'), instancia(2, 'Reconsulta 1', '180.00'), instancia(3, 'Reconsulta 2', '180.00')],
        },
      };
    }

    beforeEach(() => {
      facturacion = new SimulatedInvoicing({
        siat,
        emisores: [PRACTICE_ISSUER],
        cobros: [conPlan('p'), cobro('u', false)],
        reloj: () => ahora,
      });
    });

    it('los renglones y el total salen de las instancias, no de los del cobro', () => {
      const c = facturacion.charge('p')!;
      expect(c.total).toBe('610.00');
      expect(c.lines.map((l) => l.description)).toEqual([
        'Consulta con 2 reconsultas · Consulta inicial',
        'Consulta con 2 reconsultas · Reconsulta 1',
        'Consulta con 2 reconsultas · Reconsulta 2',
      ]);
      expect(c.plan).toEqual(expect.objectContaining({ expectedTotal: '610.00', paidTotal: '0.00', balance: '610.00', complete: false }));
    });

    it('cada pago de una instancia emite una nota de venta correlativa, y no una factura', () => {
      const a = facturacion.instanceRegisterPayment('p', 'p-i1', { methodCode: 1, amount: '250.00' });
      const b = facturacion.instanceRegisterPayment('p', 'p-i2', { methodCode: 3, amount: '80.00' });
      if (!a.ok || !b.ok) throw new Error('los pagos tenían que pasar');
      const [consulta, primera] = b.value.plan!.instances;
      expect(consulta!.salesNotes.map((n) => n.number)).toEqual(['NV-000001']);
      expect(primera!.salesNotes.map((n) => [n.number, n.amount])).toEqual([['NV-000002', '80.00']]);
      expect(primera!).toEqual(expect.objectContaining({ paidAmount: '80.00', balance: '100.00' }));
      expect(b.value.plan).toEqual(expect.objectContaining({ paidTotal: '330.00', balance: '280.00', complete: false }));
      expect(b.value.payment).toBeNull();
      expect(b.value.latestInvoice).toBeNull();
    });

    it('con saldo, la factura se rechaza con 412 y lo dice', () => {
      facturacion.instanceRegisterPayment('p', 'p-i1', { methodCode: 1, amount: '250.00' });
      const r = facturacion.issueInvoice('p', comprador, 'prueba');
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe('PAYMENT_REQUIRED');
        expect(r.error.message).toContain('nota de venta');
      }
    });

    it('saldado el plan, el cobro tiene su pago por el total y se factura con un renglón por instancia', () => {
      facturacion.instanceRegisterPayment('p', 'p-i1', { methodCode: 1, amount: '250.00' });
      facturacion.instanceRegisterPayment('p', 'p-i2', { methodCode: 1, amount: '180.00' });
      const ultimo = facturacion.instanceRegisterPayment('p', 'p-i3', { methodCode: 3, amount: '180.00' });
      if (!ultimo.ok) throw new Error('el último pago tenía que pasar');
      expect(ultimo.value.plan!.complete).toBe(true);
      expect(ultimo.value.payment).toEqual(expect.objectContaining({ amount: '610.00', methodCode: 3 }));
      const f = facturacion.issueInvoice('p', comprador, 'prueba');
      if (!f.ok) throw new Error('la factura tenía que emitirse');
      expect(f.value.status).toBe('VALIDATED');
      expect(f.value.detalle).toHaveLength(3);
      expect(f.value.cabecera['montoTotal']).toBe('610.00');
      expect(f.value.events[0]!.detail).toContain('NV-000001, NV-000002, NV-000003');
    });

    it('no acepta más que el saldo de la instancia, ni montos inválidos, ni una instancia ya pagada', () => {
      const excedido = facturacion.instanceRegisterPayment('p', 'p-i2', { methodCode: 1, amount: '180.01' });
      expect(!excedido.ok && excedido.error.issues?.map((i) => i.field)).toEqual(['amount']);
      const cero = facturacion.instanceRegisterPayment('p', 'p-i2', { methodCode: 99, amount: '0' });
      expect(!cero.ok && cero.error.issues?.map((i) => i.field)).toEqual(['methodCode', 'amount']);
      facturacion.instanceRegisterPayment('p', 'p-i2', { methodCode: 1, amount: '180.00' });
      const otraVez = facturacion.instanceRegisterPayment('p', 'p-i2', { methodCode: 1, amount: '1.00' });
      expect(!otraVez.ok && otraVez.error.code).toBe('ALREADY_PAID');
      expect(facturacion.instanceRegisterPayment('p', 'no-existe', { methodCode: 1, amount: '1.00' }).ok).toBe(false);
    });

    it('un servicio con plan no se paga de una vez, y uno sin plan no se paga por instancia', () => {
      const deUnaVez = facturacion.registerPayment('p', 1);
      expect(!deUnaVez.ok && deUnaVez.error.code).toBe('PLAN_REQUIRED');
      const porInstancia = facturacion.instanceRegisterPayment('u', 'x', { methodCode: 1, amount: '1.00' });
      expect(!porInstancia.ok && porInstancia.error.code).toBe('NOT_A_PLAN');
      expect(facturacion.charge('u')!.plan).toBeNull();
    });
  });
});

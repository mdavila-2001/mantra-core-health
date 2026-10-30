import type { SimulatedCharge } from '../../core/data-access/billing-simulated/billing-simulated.types';
import { estadoDeCobro, filtrarCobros, resumenDeCobros, ROTULO_DE_ESTADO } from './billing-summary';

function cobro(id: string, extra: Partial<SimulatedCharge> = {}): SimulatedCharge {
  return {
    id,
    source: 'CONSULTATION',
    sourceRef: id,
    issuerId: 'e',
    patientProfileId: `p-${id}`,
    patientName: 'X',
    practitionerProfileId: null,
    description: 'd',
    lines: [],
    total: '100.00',
    currency: 'BOB',
    createdAt: '2026-09-01T00:00:00.000Z',
    payment: { id: `pay-${id}`, methodCode: 1, methodLabel: 'EFECTIVO', amount: '100.00', currency: 'BOB', paidAt: '2026-09-01T00:00:00.000Z', simulated: true },
    suggestedBuyer: { name: 'X', documentTypeCode: 1, documentNumber: '1', email: null },
    latestInvoice: null,
    plan: null,
    simulated: true,
    ...extra,
  };
}

describe('resumen y filtros de facturación', () => {
  it('monto cobrado y pacientes con pago cuentan sólo lo pagado, en centavos exactos', () => {
    const lista = [
      cobro('a', { payment: { ...cobro('a').payment!, amount: '0.10' } }),
      cobro('b', { patientProfileId: 'p-a', payment: { ...cobro('b').payment!, amount: '0.20' } }),
      cobro('c', { payment: null }),
    ];
    expect(resumenDeCobros(lista)).toEqual({ montoCobrado: '0.30', pacientesConPago: 1, cobrosPendientes: 1 });
  });

  it('el estado de un cobro sale del pago y de su última factura', () => {
    expect(estadoDeCobro(cobro('a', { payment: null }))).toBe('SIN_PAGO');
    expect(estadoDeCobro(cobro('a'))).toBe('SIN_FACTURAR');
    const conFactura = cobro('a', {
      latestInvoice: { id: 'f', invoiceNumber: 1, cuf: 'X', status: 'OBSERVED', siatStatusCode: 904, issuedAt: '', total: '100.00', simulated: true },
    });
    expect(estadoDeCobro(conFactura)).toBe('OBSERVED');
  });

  it('un plan con notas de venta y saldo es «pago parcial»: cuenta lo pagado y sigue pendiente', () => {
    const plan = {
      serviceCode: 'S',
      serviceName: 'Servicio',
      instances: [],
      expectedTotal: '610.00',
      paidTotal: '330.00',
      balance: '280.00',
      complete: false,
    };
    const parcial = cobro('p', { payment: null, plan });
    expect(estadoDeCobro(parcial)).toBe('PAGO_PARCIAL');
    expect(estadoDeCobro(cobro('q', { payment: null, plan: { ...plan, paidTotal: '0.00' } }))).toBe('SIN_PAGO');
    expect(resumenDeCobros([parcial, cobro('a')])).toEqual({ montoCobrado: '430.00', pacientesConPago: 2, cobrosPendientes: 1 });
  });

  it('filtra por origen y por estado', () => {
    const lista = [cobro('a'), cobro('b', { source: 'PHARMACY' }), cobro('c', { payment: null })];
    expect(filtrarCobros(lista, 'PHARMACY', 'TODOS').map((c) => c.id)).toEqual(['b']);
    expect(filtrarCobros(lista, 'TODOS', 'SIN_PAGO').map((c) => c.id)).toEqual(['c']);
    expect(filtrarCobros(lista, 'CONSULTATION', 'SIN_FACTURAR').map((c) => c.id)).toEqual(['a']);
  });

  it('todo estado fiscal lleva la marca SIMULADO', () => {
    for (const estado of ['VALIDATED', 'OBSERVED', 'REJECTED', 'ANNULLED'] as const) {
      expect(ROTULO_DE_ESTADO[estado]).toContain('SIMULADO');
    }
  });
});

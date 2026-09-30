import { HttpHeaders } from '@angular/common/http';

import type {
  SimulatedCharge,
  SimulatedChargesPage,
  SimulatedInvoice,
  SimulatedOutboxEntry,
  SimulatedOutboxPage,
} from '../../data-access/billing-simulated/billing-simulated.types';
import { MockRouter, isMockReply, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { uuid } from '../mock-store';
import { ESQUEMA_COMPRA_VENTA } from '../siat-sim/esquema-siat';
import { facturaDesdeXml, leerXmlFactura } from '../siat-sim/factura-xml';
import { registrarFacturacionSimulada } from './billing-simulated.handlers';
import { crearRouterSimulado } from './index';
import { registrarFarmacia } from './pharmacy.handlers';
import { registrarFinanzas } from './finance.handlers';

/**
 * Las rutas `/billing/simulated/*` contra su router, con reloj fijo y sin
 * persistencia. El contrato es el de `billing-simulated.types.ts`; los montos
 * se contrastan con los de contabilidad y farmacia de la misma maqueta.
 */
describe('handlers de facturación simulada (FACT-SIAT-MOCK)', () => {
  let router: MockRouter;
  let activa: boolean;
  let ahora: Date;
  const admin = buscarUsuario('admin')!;
  const paciente = buscarUsuario('paciente')!;
  const medica = buscarUsuario('medica')!;

  beforeEach(() => {
    activa = true;
    ahora = new Date('2026-09-15T14:00:00.000Z');
    router = new MockRouter();
    registrarFacturacionSimulada(router, { activa: () => activa, reloj: () => ahora, persistir: false });
  });

  function llamar(method: MockMethod, path: string, body: unknown = null, user: MockUser | null = admin, r = router): MockReply {
    const match = r.match(method, path.split('?')[0]!);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const [ruta, consulta = ''] = path.split('?');
    const resultado = match.handler({ method, path: ruta!, params: match.params, query: new URLSearchParams(consulta), body, headers: new HttpHeaders(), user });
    return isMockReply(resultado) ? resultado : { status: 200, body: resultado };
  }

  function cobros(): readonly SimulatedCharge[] {
    return (llamar('GET', '/billing/simulated/charges').body as SimulatedChargesPage).items;
  }

  function cobroPagado(source: 'CONSULTATION' | 'PHARMACY' = 'CONSULTATION'): SimulatedCharge {
    return cobros().find((c) => c.source === source && c.payment !== null)!;
  }

  function comprador(c: SimulatedCharge) {
    return { name: c.suggestedBuyer.name, documentTypeCode: 1, documentNumber: c.suggestedBuyer.documentNumber || '1234567' };
  }

  function facturar(c: SimulatedCharge, extra: Record<string, unknown> = {}): MockReply {
    return llamar('POST', `/billing/simulated/charges/${c.id}/invoices`, { buyer: comprador(c), ...extra });
  }

  function facturarComo(c: SimulatedCharge, user: MockUser): MockReply {
    return llamar('POST', `/billing/simulated/charges/${c.id}/invoices`, { buyer: comprador(c) }, user);
  }

  function conPlan(filtro: (c: SimulatedCharge) => boolean = () => true): SimulatedCharge {
    return cobros().find((c) => c.plan !== null && filtro(c))!;
  }

  describe('acceso', () => {
    it('apagada por el interruptor responde 404', () => {
      activa = false;
      expect(llamar('GET', '/billing/simulated/charges').status).toBe(404);
    });

    it('sin sesión 401; paciente sin rol de facturación 403', () => {
      expect(llamar('GET', '/billing/simulated/charges', null, null).status).toBe(401);
      expect(llamar('GET', '/billing/simulated/charges', null, paciente).status).toBe(403);
    });

    it('la médica ve y opera sólo los cobros de SUS consultas; lo demás es 404, no 403', () => {
      const r = llamar('GET', '/billing/simulated/charges', null, medica);
      expect(r.status).toBe(200);
      const suyos = (r.body as SimulatedChargesPage).items;
      expect(suyos.length).toBeGreaterThan(0);
      expect(suyos.every((c) => c.source === 'CONSULTATION' && c.practitionerProfileId === medica.practitionerProfileId)).toBe(true);

      // Fuera de su alcance, el cobro «no existe»: un 403 diría que sí.
      const deFarmacia = cobroPagado('PHARMACY');
      expect(facturarComo(deFarmacia, medica).status).toBe(404);
      expect(llamar('POST', `/billing/simulated/charges/${deFarmacia.id}/payment`, { methodCode: 1 }, medica).status).toBe(404);
      const facturaDeFarmacia = facturar(deFarmacia).body as SimulatedInvoice;
      expect(llamar('GET', `/billing/simulated/invoices/${facturaDeFarmacia.id}`, null, medica).status).toBe(404);

      const f = facturarComo(cobroPagado('CONSULTATION'), medica);
      expect(f.status).toBe(201);
      const factura = f.body as SimulatedInvoice;
      expect(llamar('GET', `/billing/simulated/invoices/${factura.id}`, null, medica).status).toBe(200);
      expect(llamar('POST', `/billing/simulated/invoices/${factura.id}/annulment`, { reasonCode: 1 }, medica).status).toBe(403);
      expect(llamar('POST', `/billing/simulated/invoices/${factura.id}/annulment-reversal`, {}, medica).status).toBe(403);
      expect(llamar('POST', `/billing/simulated/invoices/${factura.id}/email`, { to: 'x@y.bo' }, medica).status).toBe(403);
      expect(llamar('GET', '/billing/simulated/outbox', null, medica).status).toBe(403);
    });

    it('otra profesional no ve ni opera los cobros de la médica', () => {
      const otra: MockUser = { ...medica, id: 'otra', practitionerProfileId: 'otro-perfil-profesional' };
      const lista = llamar('GET', '/billing/simulated/charges', null, otra);
      expect((lista.body as SimulatedChargesPage).items).toEqual([]);
      const deLaMedica = cobroPagado('CONSULTATION');
      expect(facturarComo(deLaMedica, otra).status).toBe(404);
    });

    it('sin perfil profesional, el rol de quien atiende no alcanza: 403', () => {
      const sinPerfil: MockUser = { ...medica, id: 'sin-perfil', practitionerProfileId: undefined };
      expect(llamar('GET', '/billing/simulated/charges', null, sinPerfil).status).toBe(403);
    });

    it('a quien atiende no se le entregan credenciales fiscales ni el emisor de farmacia', () => {
      const estado = llamar('GET', '/billing/simulated/status', null, medica).body as {
        issuers: { kind: string }[];
        credentials: unknown[];
      };
      expect(estado.credentials).toEqual([]);
      expect(estado.issuers.every((e) => e.kind === 'PRACTICE')).toBe(true);
    });
  });

  describe('cobros', () => {
    it('lista cobros de consultas y de farmacia, todos marcados como simulados', () => {
      const lista = cobros();
      expect(lista.some((c) => c.source === 'CONSULTATION')).toBe(true);
      expect(lista.some((c) => c.source === 'PHARMACY')).toBe(true);
      expect(lista.every((c) => c.simulated)).toBe(true);
      expect(lista.some((c) => c.payment === null)).toBe(true);
      expect(lista.some((c) => c.payment !== null)).toBe(true);
    });

    it('pharmacy-order-3 queda fuera del listado', () => {
      expect(cobros().some((c) => c.sourceRef === uuid('pharmacy-order-3'))).toBe(false);
    });

    it('los montos de consultas pagadas son los de paid-consultations', () => {
      const conFinanzas = new MockRouter();
      registrarFinanzas(conFinanzas);
      const pagadas = llamar('GET', '/accounting/practitioner/paid-consultations', null, medica, conFinanzas).body as {
        items: { appointmentId: string; paidTotal: string }[];
      };
      // Con plan, lo que contabilidad da por pagado en esa cita es la consulta
      // inicial: su nota de venta, y no el total del servicio con reconsultas.
      const pagadoEnLaCita = (c: SimulatedCharge): string =>
        c.plan === null ? c.total : c.plan.instances[0]!.paidAmount;
      // Sólo los honorarios de consulta: un estudio hecho en la misma cita (el
      // ECG de la demo) es otro cobro y `paid-consultations` no lo lista.
      const honorarios = cobros().filter(
        (c) => c.source === 'CONSULTATION' && (c.plan !== null || c.lines[0]?.productCode === 'CONSULTA-MEDICA'),
      );
      const porCita = new Map(honorarios.map((c) => [c.sourceRef, pagadoEnLaCita(c)]));
      for (const item of pagadas.items) expect(porCita.get(item.appointmentId)).toBe(item.paidTotal);
    });

    it('?patientProfileId= acota los cobros a esa persona', () => {
      const alguien = cobros().find((c) => c.source === 'CONSULTATION')!.patientProfileId;
      const suyos = (llamar('GET', `/billing/simulated/charges?patientProfileId=${alguien}`).body as SimulatedChargesPage).items;
      expect(suyos.length).toBeGreaterThan(0);
      expect(suyos.every((c) => c.patientProfileId === alguien)).toBe(true);
      expect(suyos.length).toBeLessThan(cobros().length);
    });

    it('el total de cada cobro de farmacia es el totalAmount del pedido', () => {
      const conFarmacia = new MockRouter();
      registrarFarmacia(conFarmacia);
      for (const c of cobros().filter((x) => x.source === 'PHARMACY')) {
        const pedido = llamar('GET', `/pharmacy/orders/${c.sourceRef}`, null, admin, conFarmacia).body as { totalAmount: string };
        expect(c.total).toBe(pedido.totalAmount);
      }
    });

    it('registrar el pago de un cobro pendiente → 201; pagar otra vez → 409', () => {
      const pendiente = cobros().find((c) => c.payment === null && c.plan === null)!;
      const r = llamar('POST', `/billing/simulated/charges/${pendiente.id}/payment`, { methodCode: 2 });
      expect(r.status).toBe(201);
      const pagado = r.body as SimulatedCharge;
      expect(pagado.payment).toEqual(expect.objectContaining({ methodCode: 2, amount: pendiente.total, simulated: true }));
      expect(llamar('POST', `/billing/simulated/charges/${pendiente.id}/payment`, { methodCode: 2 }).status).toBe(409);
    });

    it('método de pago fuera del catálogo simulado → 400', () => {
      const pendiente = cobros().find((c) => c.payment === null && c.plan === null)!;
      expect(llamar('POST', `/billing/simulated/charges/${pendiente.id}/payment`, { methodCode: 99 }).status).toBe(400);
    });
  });

  describe('plan de pagos', () => {
    it('siembra servicios con reconsultas: consulta pagada con nota de venta, reconsultas con saldo', () => {
      const plan = conPlan().plan!;
      expect(plan.instances.map((i) => i.kind)).toEqual(['CONSULTATION', 'FOLLOW_UP', 'FOLLOW_UP']);
      expect(plan.instances[0]!.salesNotes[0]!.number).toMatch(/^NV-\d{6}$/);
      expect(plan.complete).toBe(false);
    });

    it('la reconsulta agendada de la agenda es la «Reconsulta 1» del plan de su consulta de origen', () => {
      const conReconsulta = conPlan((c) => c.plan!.instances[1]!.bookingId !== null);
      expect(conReconsulta).toBeDefined();
      expect(conReconsulta.plan!.instances[1]!.scheduledAt).not.toBeNull();
    });

    it('pagar una instancia → 201 con la nota de venta; facturar con saldo → 422; saldado → 201 y la factura es por el total', () => {
      const cobro = conPlan();
      expect(facturar(cobro).status).toBe(422);
      let actual = cobro;
      for (const instancia of cobro.plan!.instances.filter((i) => i.balance !== '0.00')) {
        const r = llamar('POST', `/billing/simulated/charges/${cobro.id}/instances/${instancia.id}/payments`, {
          methodCode: 1,
          amount: instancia.balance,
        }, medica);
        expect(r.status).toBe(201);
        actual = r.body as SimulatedCharge;
      }
      expect(actual.plan!.complete).toBe(true);
      expect(actual.payment!.amount).toBe(actual.total);
      const f = facturarComo(actual, medica);
      expect(f.status).toBe(201);
      expect((f.body as SimulatedInvoice).cabecera['montoTotal']).toBe(actual.total);
    });

    it('un pago de más → 400; pagar de una vez un servicio con plan → 409', () => {
      const cobro = conPlan();
      const reconsulta = cobro.plan!.instances[2]!;
      const r = llamar('POST', `/billing/simulated/charges/${cobro.id}/instances/${reconsulta.id}/payments`, {
        methodCode: 1,
        amount: '9999.00',
      });
      expect(r.status).toBe(400);
      expect(llamar('POST', `/billing/simulated/charges/${cobro.id}/payment`, { methodCode: 1 }).status).toBe(409);
    });
  });

  describe('emisión', () => {
    it('facturar un cobro sin pago → 422', () => {
      const pendiente = cobros().find((c) => c.payment === null && c.plan === null)!;
      const result = facturar(pendiente);
      expect(result.status).toBe(422);
      expect(result.body).toMatchObject({
        code: 'PRECONDITION_FAILED',
        details: { reason: 'PAYMENT_REQUIRED' },
      });
    });

    it('un cobro pagado se factura: 908 VALIDADA, XML válido de sector 1, emisor ficticio', () => {
      const cobro = cobroPagado('PHARMACY');
      const r = facturar(cobro);
      expect(r.status).toBe(201);
      const f = r.body as SimulatedInvoice;
      expect(f.status).toBe('VALIDATED');
      expect(f.siatResponse.codigoEstado).toBe(908);
      expect(f.documentSector).toBe(1);
      expect(f.modality).toBe(2);
      expect(f.issuer.legalName).toContain('SIMULADO');
      expect(f.issuer.nit.startsWith('999')).toBe(true);
      expect(f.detalle).toHaveLength(cobro.lines.length);
      expect(f.cabecera['montoTotal']).toBe(cobro.total);
      const { problemas } = facturaDesdeXml(ESQUEMA_COMPRA_VENTA, leerXmlFactura(f.xml));
      expect(problemas).toEqual([]);
      expect(f.events.map((e) => e.kind)).toEqual(['PAYMENT_REGISTERED', 'INVOICE_BUILT', 'SENT_TO_SIAT', 'SIAT_RESPONSE']);
      expect(f.simulated).toBe(true);
    });

    it('el cobro muestra su última factura; facturarlo otra vez → 409', () => {
      const cobro = cobroPagado();
      facturar(cobro);
      const actualizado = cobros().find((c) => c.id === cobro.id)!;
      expect(actualizado.latestInvoice).toEqual(expect.objectContaining({ status: 'VALIDATED', siatStatusCode: 908 }));
      expect(facturar(cobro).status).toBe(409);
    });

    it('numeración correlativa por emisor: dos facturas seguidas no generan advertencia', () => {
      const [a, b] = cobros().filter((c) => c.source === 'CONSULTATION' && c.payment !== null);
      const fa = facturar(a!).body as SimulatedInvoice;
      const fb = facturar(b!).body as SimulatedInvoice;
      expect(fb.invoiceNumber).toBe(fa.invoiceNumber + 1);
      expect(fb.siatResponse.codigoEstado).toBe(908);
    });

    it('rechazo forzado (1013) → 902 RECHAZADA; se puede reintentar y el número no se consumió', () => {
      const cobro = cobroPagado();
      const rechazada = facturar(cobro, { simulation: { forceMessageCode: 1013 } }).body as SimulatedInvoice;
      expect(rechazada.status).toBe('REJECTED');
      expect(rechazada.siatResponse.mensajesList).toEqual([expect.objectContaining({ codigo: 1013, forzadoPorSimulacion: true })]);
      const valida = facturar(cobro).body as SimulatedInvoice;
      expect(valida.status).toBe('VALIDATED');
      expect(valida.invoiceNumber).toBe(rechazada.invoiceNumber);
    });

    it('observación forzada (2005) → 904 OBSERVADA', () => {
      const f = facturar(cobroPagado(), { simulation: { forceMessageCode: 2005 } }).body as SimulatedInvoice;
      expect(f.status).toBe('OBSERVED');
      expect(f.siatResponse.codigoEstado).toBe(904);
    });

    it('comprador inválido → 400 con el detalle por campo', () => {
      const cobro = cobroPagado();
      const r = llamar('POST', `/billing/simulated/charges/${cobro.id}/invoices`, {
        buyer: { name: '', documentTypeCode: 99, documentNumber: '' },
        additionalDiscount: '999999',
      });
      expect(r.status).toBe(400);
      const violations = (r.body as { details: { violations: string[] } }).details.violations;
      const campos = violations.map((violation) => violation.split(' ')[0]);
      expect(r.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(campos).toEqual(
        expect.arrayContaining(['buyer.name', 'buyer.documentTypeCode', 'buyer.documentNumber', 'additionalDiscount']),
      );
    });

    it('descuento adicional: total = Σ subtotales − descuento, y el SIAT simulado lo valida', () => {
      const cobro = cobroPagado();
      const f = facturar(cobro, { additionalDiscount: '10.00' }).body as SimulatedInvoice;
      expect(f.status).toBe('VALIDATED');
      expect(Number(f.cabecera['montoTotal'])).toBeCloseTo(Number(cobro.total) - 10, 2);
    });

    it('cobro inexistente → 404', () => {
      expect(llamar('POST', '/billing/simulated/charges/no-existe/invoices', { buyer: {} }).status).toBe(404);
    });
  });

  describe('anulación, reversión y entrega', () => {
    it('anular → 905 ANULADA; revertir → 907 y vuelve a VALIDADA', () => {
      const f = facturar(cobroPagado()).body as SimulatedInvoice;
      const anulada = llamar('POST', `/billing/simulated/invoices/${f.id}/annulment`, { reasonCode: 1 }).body as SimulatedInvoice;
      expect(anulada.status).toBe('ANNULLED');
      expect(anulada.siatResponse.codigoEstado).toBe(905);
      const revertida = llamar('POST', `/billing/simulated/invoices/${f.id}/annulment-reversal`).body as SimulatedInvoice;
      expect(revertida.status).toBe('VALIDATED');
      expect(revertida.siatResponse.codigoEstado).toBe(907);
      expect(revertida.events.map((e) => e.kind)).toEqual(expect.arrayContaining(['ANNULMENT', 'ANNULMENT_REVERSAL']));
    });

    it('anular fuera de plazo (día 10 del mes siguiente) → la factura sigue VALIDADA con 906/934', () => {
      const f = facturar(cobroPagado()).body as SimulatedInvoice;
      ahora = new Date('2026-10-10T12:00:00.000Z');
      const r = llamar('POST', `/billing/simulated/invoices/${f.id}/annulment`, { reasonCode: 1 }).body as SimulatedInvoice;
      expect(r.status).toBe('VALIDATED');
      expect(r.siatResponse.codigoEstado).toBe(906);
      expect(r.siatResponse.mensajesList.map((m) => m.codigo)).toEqual([934]);
    });

    it('el correo queda en la bandeja simulada y no se envía', () => {
      const f = facturar(cobroPagado()).body as SimulatedInvoice;
      const r = llamar('POST', `/billing/simulated/invoices/${f.id}/email`, { to: 'paciente@ejemplo.test' });
      expect(r.status).toBe(201);
      expect((r.body as SimulatedOutboxEntry).status).toBe('NOT_SENT_SIMULATED');
      const bandeja = llamar('GET', '/billing/simulated/outbox').body as SimulatedOutboxPage;
      expect(bandeja.items).toHaveLength(1);
      expect(llamar('POST', `/billing/simulated/invoices/${f.id}/email`, { to: 'no-es-correo' }).status).toBe(400);
    });
  });

  describe('estado fiscal y catálogos', () => {
    it('declara el ambiente SIMULADO, Computarizada en Línea y credenciales tras emitir', () => {
      facturar(cobroPagado());
      const estado = llamar('GET', '/billing/simulated/status').body as {
        environment: string;
        modality: number;
        serverTime: string;
        credentials: { cuis: string | null; cufd: string | null }[];
      };
      expect(estado.environment).toBe('SIMULADO');
      expect(estado.modality).toBe(2);
      expect(estado.serverTime).toBe('2026-09-15T10:00:00.000');
      expect(estado.credentials.some((c) => c.cuis !== null && c.cufd !== null)).toBe(true);
    });

    it('los catálogos declaran su origen y los mensajes forzables son del catálogo oficial', () => {
      const catalogos = llamar('GET', '/billing/simulated/catalogs').body as {
        paymentMethods: { origen: string }[];
        forceableMessages: { codigo: number }[];
      };
      expect(catalogos.paymentMethods.every((m) => m.origen === 'SIMULADO')).toBe(true);
      expect(catalogos.forceableMessages.map((m) => m.codigo)).toEqual(expect.arrayContaining([1013, 2005]));
    });
  });

  it('barrido: ninguna respuesta nombra hosts del SIN ni pierde la marca de simulado', () => {
    const cobro = cobroPagado();
    const f = facturar(cobro).body as SimulatedInvoice;
    const respuestas = [
      llamar('GET', '/billing/simulated/charges').body,
      llamar('GET', '/billing/simulated/status').body,
      llamar('GET', '/billing/simulated/catalogs').body,
      llamar('GET', `/billing/simulated/invoices/${f.id}`).body,
    ];
    const texto = JSON.stringify(respuestas);
    expect(texto).not.toMatch(/impuestos\.gob\.bo/i);
    expect(texto).not.toMatch(/siat\.impuestos/i);
    for (const r of respuestas) expect((r as { simulated: boolean }).simulated).toBe(true);
  });

  it('en el router completo, las rutas nuevas y /billing/service-catalog conviven', () => {
    const completo = crearRouterSimulado();
    expect(completo.match('GET', '/billing/simulated/charges')).not.toBeNull();
    expect(completo.match('POST', '/billing/simulated/charges/x/invoices')).not.toBeNull();
    const catalogo = llamar('GET', '/billing/service-catalog/procedure-specialties', null, admin, completo).body as { items: unknown[] };
    expect(Array.isArray(catalogo.items)).toBe(true);
  });
});

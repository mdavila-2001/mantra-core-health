import { HttpHeaders } from '@angular/common/http';

import type {
  ChargeProofs,
  PaymentContext,
  ProviderPaymentTablePage,
} from '../../data-access/billing/payment-proofs.types';
import type { InitialCharge } from '../billing-sim/simulated-invoicing';
import { MockRouter, isMockReply, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registrarComprobantesDePago, sembrarComprobantes } from './payment-proofs.handlers';

/**
 * C-01 en el simulador, en los tres niveles del contrato (regla 65):
 * correcto (subir, aceptar, rechazar), límite (segundo pendiente, doble
 * revisión, paginado) e inválido (sin archivo, sin motivo, ajeno, rol).
 */
describe('handlers de comprobantes de pago (C-01)', () => {
  const medica = buscarUsuario('medica')!;
  const paciente = buscarUsuario('paciente')!;
  const admin = buscarUsuario('admin')!;

  const linea = (subtotal: string) => ({
    productCode: 'CONSULTA',
    description: 'Consulta',
    quantity: '1',
    unitOfMeasure: 58,
    unitPrice: subtotal,
    discount: null,
    subtotal,
  });
  const cargo = (id: string, opciones: Partial<InitialCharge> = {}): InitialCharge =>
    ({
      id,
      source: 'CONSULTATION',
      sourceRef: id,
      issuerId: 'emisor',
      patientProfileId: paciente.patientProfileId!,
      patientName: 'Paciente Demo',
      practitionerProfileId: medica.practitionerProfileId!,
      description: 'Consulta',
      lines: [linea('150.00')],
      createdAt: `2026-10-0${id.length % 9}T10:00:00.000Z`,
      suggestedBuyer: { name: 'x', documentTypeCode: 1, documentNumber: '1', complement: null, email: null },
      payment: null,
      ...opciones,
    }) as InitialCharge;

  let router: MockRouter;

  beforeEach(() => {
    router = new MockRouter();
    registrarComprobantesDePago(router, () =>
      sembrarComprobantes([
        cargo('c-propio'),
        cargo('c-otro-medico', { practitionerProfileId: 'otro-profesional' }),
        cargo('c-pagado', { payment: { id: 'p', methodCode: 1, methodLabel: 'Efectivo', amount: '150.00', currency: 'BOB', paidAt: '2026-10-01', simulated: true } }),
      ]),
    );
  });

  function llamar(method: MockMethod, path: string, body: unknown = null, user: MockUser | null = medica): MockReply {
    const [ruta, consulta = ''] = path.split('?');
    const match = router.match(method, ruta!);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const r = match.handler({ method, path: ruta!, params: match.params, query: new URLSearchParams(consulta), body, headers: new HttpHeaders(), user });
    return isMockReply(r) ? r : { status: 200, body: r };
  }

  const pendienteDe = (chargeId: string): string =>
    (llamar('GET', `/billing/charges/${chargeId}/payment-proofs`).body as ChargeProofs).items.find(
      (p) => p.status === 'PENDING_REVIEW',
    )!.id;

  it('correcto: la siembra trae un pendiente y un rechazado; aceptar deja el cargo pagado', () => {
    const lista = llamar('GET', '/billing/charges/c-propio/payment-proofs').body as ChargeProofs;
    expect(lista.status).toBe('PENDING');
    const id = pendienteDe('c-propio');

    const aceptado = llamar('POST', `/billing/payment-proofs/${id}/accept`);
    expect(aceptado.status).toBe(200);
    expect(aceptado.body).toMatchObject({ status: 'ACCEPTED', chargeStatus: 'PAID' });

    const ctx = llamar('GET', '/billing/me/charges/c-propio/payment-context', null, paciente).body as PaymentContext;
    expect(ctx.status).toBe('PAID');
    expect(ctx.patientShare.approval.status).toBe('NO_COVERAGE');
  });

  it('correcto: el paciente sube efectivo después de un rechazo y el médico rechaza con motivo', () => {
    // c-otro-medico trae el comprobante rechazado sembrado; no hay pendiente.
    const subir = llamar('POST', '/billing/me/charges/c-otro-medico/payment-proofs', { method: 'CASH', amountMinor: 15000 }, paciente);
    expect(subir.status).toBe(201);
    const rechazo = llamar('POST', `/billing/payment-proofs/${(subir.body as { id: string }).id}/reject`, { reason: 'No llegó' }, admin);
    expect(rechazo.body).toMatchObject({ status: 'REJECTED', chargeStatus: 'PENDING' });
  });

  it('límite: un segundo pendiente es 409; revisar dos veces es 409; un cargo pagado no acepta comprobantes', () => {
    const otro = llamar('POST', '/billing/me/charges/c-propio/payment-proofs', { method: 'CASH', amountMinor: 15000 }, paciente);
    expect(otro.status).toBe(409);
    expect((otro.body as { details: { reason: string } }).details.reason).toBe('PROOF_ALREADY_PENDING');

    const id = pendienteDe('c-propio');
    expect(llamar('POST', `/billing/payment-proofs/${id}/accept`).status).toBe(200);
    const segunda = llamar('POST', `/billing/payment-proofs/${id}/accept`);
    expect(segunda.status).toBe(409);
    expect((segunda.body as { details: { reason: string } }).details.reason).toBe('PROOF_NOT_PENDING');

    const tarde = llamar('POST', '/billing/me/charges/c-pagado/payment-proofs', { method: 'CASH', amountMinor: 15000 }, paciente);
    expect((tarde.body as { details: { reason: string } }).details.reason).toBe('ALREADY_PAID');
  });

  it('límite: la tabla del prestador pagina por cursor y filtra por persona', () => {
    const p1 = llamar('GET', '/billing/me/provider-payment-table?limit=1').body as ProviderPaymentTablePage;
    expect(p1.items).toHaveLength(1);
    expect(p1.nextCursor).not.toBeNull();
    const p2 = llamar('GET', `/billing/me/provider-payment-table?limit=1&cursor=${p1.nextCursor}`).body as ProviderPaymentTablePage;
    expect(p2.items[0]!.chargeId).not.toBe(p1.items[0]!.chargeId);
    const todas = llamar('GET', '/billing/me/provider-payment-table').body as ProviderPaymentTablePage;
    // La médica no ve la consulta del otro profesional.
    expect(todas.items.map((i) => i.chargeId)).not.toContain('c-otro-medico');
    const ajenaPersona = llamar('GET', '/billing/me/provider-payment-table?patientProfileId=nadie').body as ProviderPaymentTablePage;
    expect(ajenaPersona.items).toHaveLength(0);
  });

  it('inválido: QR sin archivo 422 FILE_REQUIRED; rechazo sin motivo 400; método desconocido 400', () => {
    const otro = llamar('POST', '/billing/me/charges/c-otro-medico/payment-proofs', { method: 'QR_TRANSFER', amountMinor: 15000 }, paciente);
    expect(otro.status).toBe(422);
    expect((otro.body as { details: { reason: string } }).details.reason).toBe('FILE_REQUIRED');
    const id = pendienteDe('c-propio');
    expect(llamar('POST', `/billing/payment-proofs/${id}/reject`, {}).status).toBe(400);
    expect(llamar('POST', '/billing/me/charges/c-propio/payment-proofs', { method: 'TARJETA', amountMinor: 1 }, paciente).status).toBe(400);
  });

  it('inválido: ajeno es 404, el paciente no revisa (403), sin sesión 401', () => {
    expect(llamar('GET', '/billing/charges/c-otro-medico/payment-proofs').status).toBe(404);
    expect(llamar('GET', '/billing/me/charges/c-propio/payment-context', null, medica).status).toBe(403);
    expect(llamar('GET', '/billing/me/provider-payment-table', null, paciente).status).toBe(403);
    expect(llamar('GET', '/billing/me/provider-payment-table', null, null).status).toBe(401);
    const id = pendienteDe('c-propio');
    expect(llamar('POST', `/billing/payment-proofs/${id}/accept`, null, paciente).status).toBe(403);
  });
});

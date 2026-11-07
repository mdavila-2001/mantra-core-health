import { HttpHeaders } from '@angular/common/http';

import { orderList } from '../fixtures/clinic';
import { ORDER_CATEGORY, STATUS } from '../fixtures/concepts';
import { PACIENTE } from '../fixtures/people';
import { nuevoId } from '../mock-store';
import { isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario, TENANT_LABORATORIO } from '../mock-session';
import { crearRouterSimulado } from './index';

/**
 * La derivación de una orden con aceptación del paciente (06/11/2026): el
 * médico deriva, el paciente decide, y sólo al aceptar la orden entra a la
 * bandeja del centro. Tres niveles del contrato: correcto, límite e inválido.
 */
describe('derivación de una orden a un centro (simulador)', () => {
  const router = crearRouterSimulado();
  const medica = buscarUsuario('medica')!;
  const paciente = buscarUsuario('paciente')!;
  const laboratorio = buscarUsuario('laboratorio')!;

  function pedir(method: MockMethod, path: string, body: unknown = {}, user = medica) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders({ 'X-Tenant-Id': user.tenants[0]! }),
      user,
    } satisfies MockRequest);
  }
  const estado = (r: unknown) => (isMockReply(r) ? r.status : 200);
  const cuerpo = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;

  const derivar = (orderId: string, performerTenantId: string = TENANT_LABORATORIO) =>
    pedir('POST', `/diagnostics/orders/${orderId}/referral`, { performerTenantId });
  const responder = (orderId: string, accion: 'accept' | 'reject', user = paciente) =>
    pedir('POST', `/diagnostic-results/me/orders/${orderId}/referral/${accion}`, {}, user);
  const enBandejaDelLaboratorio = (orderId: string) =>
    cuerpo<{ items: { orderId: string; origin: string; status: string }[] }>(
      pedir('GET', '/diagnostics/lab/orders', {}, laboratorio),
    ).items.find((o) => o.orderId === orderId);
  const referralEnMisOrdenes = (orderId: string) =>
    cuerpo<{ items: { id: string; referral?: { status: string; performerName: string } }[] }>(
      pedir('GET', '/diagnostic-results/me/orders', {}, paciente),
    ).items.find((o) => o.id === orderId)?.referral;

  /**
   * Una orden de laboratorio nueva del paciente de la sesión: cada prueba arma la
   * suya, para no depender de lo que otra dejó derivado o aceptado.
   */
  function ordenLibre(): string {
    const base = orderList.filtrar(
      (o) => o.patientProfileId === PACIENTE.id && o.categoryConceptId === ORDER_CATEGORY['SRQ-LAB'],
    )[0]!;
    return orderList.agregar({
      ...base,
      id: nuevoId('orden-derivable'),
      statusConceptId: STATUS['ST-PENDING']!,
    }).id;
  }

  it('correcto: derivar deja la orden pendiente, sin que el centro la vea; aceptar la manda al centro', () => {
    const id = ordenLibre();

    expect(estado(derivar(id))).toBe(201);
    expect(referralEnMisOrdenes(id)).toMatchObject({ status: 'PENDING', performerName: 'Laboratorio Central' });
    expect(enBandejaDelLaboratorio(id)).toBeUndefined();

    expect(cuerpo<{ status: string }>(responder(id, 'accept')).status).toBe('ACCEPTED');
    expect(referralEnMisOrdenes(id)).toMatchObject({ status: 'ACCEPTED' });
    expect(enBandejaDelLaboratorio(id)).toMatchObject({ origin: 'DOCTOR_REFERRAL', status: 'DRAFT' });
  });

  it('correcto: si el paciente rechaza, el centro no ve la orden nunca', () => {
    const id = ordenLibre();
    derivar(id);

    expect(cuerpo<{ status: string }>(responder(id, 'reject')).status).toBe('REJECTED');
    expect(enBandejaDelLaboratorio(id)).toBeUndefined();
  });

  it('límite: tras un rechazo el médico puede volver a derivar; una pendiente o aceptada no', () => {
    const id = ordenLibre();
    derivar(id);
    expect(estado(derivar(id))).toBe(409); // pendiente
    responder(id, 'reject');
    expect(estado(derivar(id))).toBe(201); // rechazada: se puede insistir
    responder(id, 'accept');
    expect(estado(derivar(id))).toBe(409); // aceptada
  });

  it('límite: responder dos veces es un 409 y no duplica la orden del centro', () => {
    const id = ordenLibre();
    derivar(id);
    responder(id, 'accept');
    const antes = cuerpo<{ items: unknown[] }>(pedir('GET', '/diagnostics/lab/orders', {}, laboratorio)).items.length;

    expect(estado(responder(id, 'accept'))).toBe(409);
    expect(estado(responder(id, 'reject'))).toBe(409);
    expect(cuerpo<{ items: unknown[] }>(pedir('GET', '/diagnostics/lab/orders', {}, laboratorio)).items.length).toBe(antes);
  });

  it('inválido: sólo un profesional deriva, a un centro de diagnóstico, una orden de laboratorio o imagen', () => {
    const id = ordenLibre();
    expect(estado(derivar(id, 'no-es-un-centro'))).toBe(400);
    expect(estado(derivar(id, '00000000-0000-4000-8000-0000000000aa'))).toBe(400); // sin unidad publicada
    expect(estado(pedir('POST', `/diagnostics/orders/${id}/referral`, {}, medica))).toBe(400);
    expect(estado(pedir('POST', `/diagnostics/orders/${id}/referral`, { performerTenantId: TENANT_LABORATORIO }, paciente))).toBe(403);
    expect(estado(derivar('00000000-0000-4000-8000-000000000000'))).toBe(404);
    const procedimiento = orderList.filtrar((o) => o.categoryConceptId === ORDER_CATEGORY['SRQ-PROCEDURE'])[0]!;
    expect(estado(derivar(procedimiento.id))).toBe(400);
    expect(referralEnMisOrdenes(id)).toBeUndefined();
  });

  it('inválido: una orden ya completada, en curso o anulada no se deriva (409) y no queda derivación', () => {
    for (const estadoDeLaOrden of ['ST-COMPLETED', 'ST-IN-PROGRESS'] as const) {
      const id = ordenLibre();
      const base = orderList.get(id)!;
      orderList.agregar({ ...base, statusConceptId: STATUS[estadoDeLaOrden]! });
      expect(estado(derivar(id))).toBe(409);
      expect(referralEnMisOrdenes(id)).toBeUndefined();
    }
  });

  it('inválido: sólo el paciente dueño responde; otro usuario o una orden sin derivación reciben 404', () => {
    const id = ordenLibre();
    derivar(id);
    expect(estado(responder(id, 'accept', laboratorio))).toBe(404);
    expect(estado(responder(ordenLibre(), 'accept'))).toBe(404);
    expect(estado(responder('00000000-0000-4000-8000-000000000000', 'accept'))).toBe(404);
    expect(referralEnMisOrdenes(id)?.status).toBe('PENDING');
    expect(enBandejaDelLaboratorio(id)).toBeUndefined();
  });
});

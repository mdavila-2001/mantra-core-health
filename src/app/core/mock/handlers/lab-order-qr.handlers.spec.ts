import { HttpHeaders } from '@angular/common/http';

import { orderQrCode } from '../../data-access/lab-portal/lab-order-qr';
import { orderList } from '../fixtures/clinic';
import { ORDER_CATEGORY, STATUS } from '../fixtures/concepts';
import { isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { nuevoId } from '../mock-store';
import { labInboxOrders } from './diagnostics.handlers';
import { crearRouterSimulado } from './index';

/** Way 1: the order QR the patient sends, in three levels: correct, limit and invalid. */
describe('order from the patient QR (simulator-only)', () => {
  const router = crearRouterSimulado();
  const lab = buscarUsuario('laboratorio')!;
  const pharmacy = buscarUsuario('farmacia')!;

  function call(method: MockMethod, path: string, body: unknown = {}, user = lab) {
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
  const status = (r: unknown) => (isMockReply(r) ? r.status : 200);
  const body = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;
  interface Order { orderId: string; status: string; origin?: string; requesterName: string; patientName: string }
  const list = () => body<{ items: Order[] }>(call('GET', '/diagnostics/lab/orders')).items;

  /** A pending laboratory order that no center has yet: each test builds its own. */
  function freeOrder(statusConceptId = STATUS['ST-PENDING']!): string {
    const base = orderList.filtrar((o) => o.categoryConceptId === ORDER_CATEGORY['SRQ-LAB'])[0]!;
    return orderList.agregar({ ...base, id: nuevoId('qr-order'), statusConceptId }).id;
  }

    const fromQr = (id: string, user = lab) => call('POST', '/diagnostics/lab/orders/from-qr', { code: orderQrCode(id) }, user);
    it('correct: creates the order addressed to the center, with QR origin', () => {
      const id = freeOrder();
      expect(status(fromQr(id))).toBe(201);
      expect(list().find((o) => o.orderId === id)).toMatchObject({ status: 'DRAFT', origin: 'PATIENT_QR' });
    });
    it('limit: reading the same code twice returns the same order without duplicating it', () => {
      const id = freeOrder();
      fromQr(id);
      const count = list().length;
      expect(status(call('POST', '/diagnostics/lab/orders/from-qr', { code: `  ${orderQrCode(id)}\n` }))).toBe(200);
      expect(list().length).toBe(count);
    });
    it('invalid: malformed 400, unknown 404, not a study 400, completed 409, other center 409, other account 403', () => {
      expect(status(call('POST', '/diagnostics/lab/orders/from-qr', { code: 'hola' }))).toBe(400);
      expect(status(fromQr('00000000-0000-4000-8000-000000000000'))).toBe(404);
      const procedure = orderList.filtrar((o) => o.categoryConceptId === ORDER_CATEGORY['SRQ-PROCEDURE'])[0]!;
      expect(status(fromQr(procedure.id))).toBe(400);
      expect(status(fromQr(freeOrder(STATUS['ST-COMPLETED']!)))).toBe(409);
      const taken = freeOrder();
      labInboxOrders.agregar({ ...labInboxOrders.todos()[0]!, id: taken, performerTenantId: 'other-center' });
      expect(status(fromQr(taken))).toBe(409);
      expect(status(fromQr(freeOrder(), pharmacy))).toBe(403);
    });
});

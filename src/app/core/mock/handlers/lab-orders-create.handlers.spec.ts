import { HttpHeaders } from '@angular/common/http';

import { orderQrCode } from '../../data-access/lab-portal/lab-order-qr';
import { orderList } from '../fixtures/clinic';
import { ORDER_CATEGORY, STATUS } from '../fixtures/concepts';
import { PATIENTS } from '../fixtures/people';
import { nuevoId } from '../mock-store';
import { isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { crearRouterSimulado } from './index';
import { labInboxOrders } from './diagnostics.handlers';

/**
 * Cómo nace una orden en el laboratorio (06/11/2026): las dos vías de alta que
 * inicia el centro, contra el simulador, en los tres niveles del contrato —lo
 * correcto, los bordes y lo inválido—. La API real no tiene estas rutas (P52).
 */
describe('alta de órdenes del laboratorio (simulador)', () => {
  const router = crearRouterSimulado();
  const laboratorio = buscarUsuario('laboratorio')!;
  const farmacia = buscarUsuario('farmacia')!;

  function pedir(
    method: MockMethod,
    path: string,
    body: unknown = {},
    user = laboratorio,
    query = new URLSearchParams(),
  ) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query,
      body,
      headers: new HttpHeaders({ 'X-Tenant-Id': user.tenants[0]! }),
      user,
    } satisfies MockRequest);
  }
  const estado = (r: unknown) => (isMockReply(r) ? r.status : 200);
  const cuerpo = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;

  interface Orden {
    orderId: string;
    studyName: string;
    patientName: string;
    status: string;
    origin: string;
  }
  const listar = () => cuerpo<{ items: Orden[] }>(pedir('GET', '/diagnostics/lab/orders')).items;

  /** Una orden de laboratorio, pendiente, que ningún centro tiene todavía: cada prueba arma la suya. */
  function ordenLibre(): string {
    const base = orderList.filtrar((o) => o.categoryConceptId === ORDER_CATEGORY['SRQ-LAB'])[0]!;
    return orderList.agregar({
      ...base,
      id: nuevoId('orden-por-qr'),
      statusConceptId: STATUS['ST-PENDING']!,
    }).id;
  }

  describe('buscar paciente', () => {
    it('correcto: encuentra por nombre o por código', () => {
      const paciente = PATIENTS[0]!;
      const porNombre = cuerpo<{ items: { patientProfileId: string }[] }>(
        pedir('GET', '/diagnostics/lab/patients', {}, laboratorio, new URLSearchParams({ q: paciente.displayName })),
      );
      expect(porNombre.items.map((p) => p.patientProfileId)).toContain(paciente.id);
      const porCodigo = cuerpo<{ items: { patientProfileId: string }[] }>(
        pedir('GET', '/diagnostics/lab/patients', {}, laboratorio, new URLSearchParams({ q: paciente.patientCode })),
      );
      expect(porCodigo.items.map((p) => p.patientProfileId)).toContain(paciente.id);
    });

    it('límite: dos letras sirven, una no (400); sin coincidencias devuelve una lista vacía', () => {
      expect(estado(pedir('GET', '/diagnostics/lab/patients', {}, laboratorio, new URLSearchParams({ q: 'a' })))).toBe(400);
      expect(estado(pedir('GET', '/diagnostics/lab/patients', {}, laboratorio, new URLSearchParams({ q: 'zzzzqqqq' })))).toBe(200);
      expect(
        cuerpo<{ count: number }>(pedir('GET', '/diagnostics/lab/patients', {}, laboratorio, new URLSearchParams({ q: 'zzzzqqqq' }))).count,
      ).toBe(0);
    });

    it('inválido: quien no es del laboratorio recibe 403', () => {
      expect(estado(pedir('GET', '/diagnostics/lab/patients', {}, farmacia, new URLSearchParams({ q: 'ab' })))).toBe(403);
    });
  });

  describe('orden propia', () => {
    it('correcto: nace en borrador, con origen propio, y está al releer la lista', () => {
      const paciente = PATIENTS[1]!;
      const respuesta = pedir('POST', '/diagnostics/lab/orders', {
        patientProfileId: paciente.id,
        studyName: '  Ecografía de tiroides ',
      });
      expect(estado(respuesta)).toBe(201);
      const creada = cuerpo<Orden>(respuesta);
      expect(creada).toMatchObject({ status: 'DRAFT', origin: 'LAB_OWN', studyName: 'Ecografía de tiroides' });
      expect(listar().find((o) => o.orderId === creada.orderId)).toMatchObject({
        patientName: paciente.displayName,
        status: 'DRAFT',
      });
    });

    it('límite: 120 letras pasan, 121 no; la nota admite 500 y no 501', () => {
      const patientProfileId = PATIENTS[0]!.id;
      expect(estado(pedir('POST', '/diagnostics/lab/orders', { patientProfileId, studyName: 'x'.repeat(120) }))).toBe(201);
      expect(estado(pedir('POST', '/diagnostics/lab/orders', { patientProfileId, studyName: 'x'.repeat(121) }))).toBe(400);
      expect(estado(pedir('POST', '/diagnostics/lab/orders', { patientProfileId, studyName: 'Rx', note: 'n'.repeat(500) }))).toBe(201);
      expect(estado(pedir('POST', '/diagnostics/lab/orders', { patientProfileId, studyName: 'Rx', note: 'n'.repeat(501) }))).toBe(400);
    });

    it('inválido: sin estudio, con paciente inexistente, o de otra cuenta, no crea nada', () => {
      const antes = listar().length;
      const patientProfileId = PATIENTS[0]!.id;
      expect(estado(pedir('POST', '/diagnostics/lab/orders', { patientProfileId, studyName: '   ' }))).toBe(400);
      expect(estado(pedir('POST', '/diagnostics/lab/orders', { patientProfileId: 'no-existe', studyName: 'Rx' }))).toBe(400);
      expect(estado(pedir('POST', '/diagnostics/lab/orders', { patientProfileId, studyName: 'Rx' }, farmacia))).toBe(403);
      expect(listar().length).toBe(antes);
    });
  });

  describe('orden por el QR del paciente', () => {
    it('correcto: crea la orden dirigida al centro, con origen QR', () => {
      const id = ordenLibre();
      const respuesta = pedir('POST', '/diagnostics/lab/orders/from-qr', { code: orderQrCode(id) });
      expect(estado(respuesta)).toBe(201);
      expect(cuerpo<Orden>(respuesta)).toMatchObject({ orderId: id, status: 'DRAFT', origin: 'PATIENT_QR' });
      expect(listar().some((o) => o.orderId === id)).toBe(true);
    });

    it('límite: leer el mismo código dos veces devuelve la misma orden y no la duplica', () => {
      const id = ordenLibre();
      pedir('POST', '/diagnostics/lab/orders/from-qr', { code: orderQrCode(id) });
      const cantidad = listar().length;
      const segunda = pedir('POST', '/diagnostics/lab/orders/from-qr', { code: `  ${orderQrCode(id)}\n` });
      expect(estado(segunda)).toBe(200);
      expect(cuerpo<Orden>(segunda).orderId).toBe(id);
      expect(listar().length).toBe(cantidad);
    });

    it('inválido: código mal formado 400, orden inexistente 404, otro tipo de orden 400, sin sesión de laboratorio 403', () => {
      expect(estado(pedir('POST', '/diagnostics/lab/orders/from-qr', { code: 'hola' }))).toBe(400);
      expect(estado(pedir('POST', '/diagnostics/lab/orders/from-qr', {}))).toBe(400);
      expect(
        estado(pedir('POST', '/diagnostics/lab/orders/from-qr', { code: orderQrCode('00000000-0000-4000-8000-000000000000') })),
      ).toBe(404);
      const procedimiento = orderList.filtrar((o) => o.categoryConceptId === ORDER_CATEGORY['SRQ-PROCEDURE'])[0]!;
      expect(estado(pedir('POST', '/diagnostics/lab/orders/from-qr', { code: orderQrCode(procedimiento.id) }))).toBe(400);
      expect(estado(pedir('POST', '/diagnostics/lab/orders/from-qr', { code: orderQrCode(ordenLibre()) }, farmacia))).toBe(403);
    });

    it('inválido: una orden ya completada no se manda a un centro (409) y no entra a la bandeja', () => {
      const id = ordenLibre();
      orderList.agregar({ ...orderList.get(id)!, statusConceptId: STATUS['ST-COMPLETED']! });
      expect(estado(pedir('POST', '/diagnostics/lab/orders/from-qr', { code: orderQrCode(id) }))).toBe(409);
      expect(listar().some((o) => o.orderId === id)).toBe(false);
    });

    it('inválido: una orden ya dirigida a otro centro responde 409', () => {
      const id = ordenLibre();
      labInboxOrders.agregar({
        id,
        patientProfileId: PATIENTS[0]!.id,
        codeConceptId: orderList.get(id)!.codeConceptId,
        categoryConceptId: ORDER_CATEGORY['SRQ-LAB']!,
        priorityConceptId: '',
        statusConceptId: '',
        requesterProfileId: orderList.get(id)!.requesterProfileId,
        requestingTenantId: 'otro',
        performerTenantId: 'otro-centro',
        requestedAt: new Date().toISOString(),
      });
      expect(estado(pedir('POST', '/diagnostics/lab/orders/from-qr', { code: orderQrCode(id) }))).toBe(409);
    });
  });
});

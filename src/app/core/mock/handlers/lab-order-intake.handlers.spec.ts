import { HttpHeaders } from '@angular/common/http';

import { crearRouterSimulado } from './index';
import { ESTUDIO } from '../fixtures/concepts';
import { PATIENTS } from '../fixtures/people';
import { buscarUsuario } from '../mock-session';
import { isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import type { LabOrder } from '../../data-access/lab-portal/lab-portal.types';

/** The simulator mirrors the API (v4.2.96): the center enters, fixes and annuls its own orders. */
describe('simulador · órdenes que carga el centro', () => {
  const router = crearRouterSimulado();
  const laboratorio = buscarUsuario('laboratorio')!;
  const farmacia = buscarUsuario('farmacia')!;
  const paciente = PATIENTS[3]!;
  const hemograma = ESTUDIO['STUDY-HEMOGRAMA']!;
  const torax = ESTUDIO['STUDY-RX-TORAX']!;

  function pedir(method: MockMethod, path: string, body: unknown = {}, user = laboratorio) {
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
  const enLaLista = (orderId: string) =>
    cuerpo<{ items: LabOrder[] }>(pedir('GET', '/diagnostics/lab/orders')).items.find((o) => o.orderId === orderId);

  it('busca al paciente por documento exacto; uno que nadie tiene es 404', () => {
    const encontrado = cuerpo<{ patientProfileId: string }>(
      pedir('POST', '/diagnostics/lab/patients/lookup', { nationalId: ` ${paciente.nationalId} ` }),
    );
    expect(encontrado.patientProfileId).toBe(paciente.id);
    expect(estado(pedir('POST', '/diagnostics/lab/patients/lookup', { nationalId: 'NADIE-0' }))).toBe(404);
    expect(estado(pedir('POST', '/diagnostics/lab/patients/lookup', { nationalId: paciente.nationalId }, farmacia))).toBe(403);
  });

  it('el catálogo dice la familia del estudio', () => {
    expect(cuerpo<{ family: string }>(pedir('GET', `/clinical/study-catalog/${hemograma}`)).family).toBe('LAB');
    expect(cuerpo<{ family: string }>(pedir('GET', `/clinical/study-catalog/${torax}`)).family).toBe('IMAGING');
  });

  it('alta → lista → corrección → anulación, y la anulada ya no se corrige', () => {
    const creada = cuerpo<LabOrder>(
      pedir('POST', '/diagnostics/lab/orders', {
        patientProfileId: paciente.id,
        codeConceptId: hemograma,
        category: 'LAB',
        externalRequesterName: 'Dra. Ejemplo',
      }),
    );
    expect(creada).toMatchObject({ status: 'DRAFT', registeredByPerformer: true, canEdit: true, requesterName: 'Dra. Ejemplo' });
    expect(enLaLista(creada.orderId)).toMatchObject({ canEdit: true });

    const corregida = cuerpo<LabOrder>(
      pedir('PUT', `/diagnostics/lab/orders/${creada.orderId}`, { codeConceptId: torax, category: 'IMAGING' }),
    );
    expect(corregida).toMatchObject({ codeConceptId: torax, requesterName: 'A pedido del paciente' });

    const anulada = pedir('POST', `/diagnostics/lab/orders/${creada.orderId}/transitions`, {
      action: 'CANCEL',
      reason: 'Cargada por error',
    });
    expect(cuerpo<LabOrder>(anulada)).toMatchObject({ status: 'CANCELLED', canEdit: false });
    const otraVez = pedir('PUT', `/diagnostics/lab/orders/${creada.orderId}`, { codeConceptId: hemograma, category: 'LAB' });
    expect(estado(otraVez)).toBe(409);
  });

  it('inválidos: categoría que contradice al catálogo 422, sin categoría 400, la orden de un médico no se corrige (409)', () => {
    const base = { patientProfileId: paciente.id, codeConceptId: hemograma };
    expect(estado(pedir('POST', '/diagnostics/lab/orders', { ...base, category: 'IMAGING' }))).toBe(422);
    expect(estado(pedir('POST', '/diagnostics/lab/orders', base))).toBe(400);
    const deUnMedico = cuerpo<{ items: LabOrder[] }>(pedir('GET', '/diagnostics/lab/orders')).items.find(
      (o) => o.registeredByPerformer === false && o.status === 'DRAFT',
    )!;
    expect(estado(pedir('PUT', `/diagnostics/lab/orders/${deUnMedico.orderId}`, { ...base, category: 'LAB' }))).toBe(409);
  });
});

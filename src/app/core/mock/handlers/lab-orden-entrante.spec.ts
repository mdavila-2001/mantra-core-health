import { HttpHeaders } from '@angular/common/http';

import { SPECIMEN_TYPE } from '../fixtures/conceptos';
import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { TENANT_CLINICA, TENANT_LABORATORIO, buscarUsuario, type MockUser } from '../mock-session';
import { ID_ORDEN_ENTRANTE, registrarDiagnostico } from './diagnostics.handlers';

/**
 * La orden que llega mientras el laboratorio mira su recepción (4.2: «alguna
 * alarma o sonido al llegar el pedido» y «qué médico realizó la solicitud»),
 * y la orden de trabajo que abre su accesión. Archivo propio: la orden nace
 * una vez por sesión, y el estado del módulo tiene que arrancar limpio.
 */
describe('recepción del laboratorio: la orden entrante y su orden de trabajo', () => {
  const router = new MockRouter();
  registrarDiagnostico(router);
  const laboratorio = buscarUsuario('laboratorio')!;

  function pedir<T>(method: MockMethod, path: string, body: unknown, tenant: string): { status: number; body: T } {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const r = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders({ 'X-Tenant-Id': tenant }),
      user: laboratorio as MockUser,
    });
    return isMockReply(r) ? { status: r.status, body: r.body as T } : { status: 200, body: r as T };
  }

  interface Item {
    readonly serviceRequestId: string;
    readonly patientProfileId: string;
    readonly requesterDisplayName?: string | null;
  }
  const bandeja = () =>
    pedir<{ items: readonly Item[] }>('POST', '/diagnostics/service-requests/inbox', { limit: 100 }, TENANT_LABORATORIO).body.items;

  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it('llega unos segundos después de abrir la recepción, una sola vez, con quién la pidió', () => {
    expect(bandeja().map((i) => i.serviceRequestId)).not.toContain(ID_ORDEN_ENTRANTE);

    vi.advanceTimersByTime(16_000);
    const llegada = bandeja().filter((i) => i.serviceRequestId === ID_ORDEN_ENTRANTE);
    expect(llegada).toHaveLength(1);
    expect(llegada[0]!.requesterDisplayName).toMatch(/\S/);

    vi.advanceTimersByTime(60_000);
    expect(bandeja().filter((i) => i.serviceRequestId === ID_ORDEN_ENTRANTE)).toHaveLength(1);
  });

  it('toda orden de la bandeja dice qué médico la pidió', () => {
    for (const item of bandeja()) expect(item.requesterDisplayName, item.serviceRequestId).toMatch(/\S/);
  });

  it('otro tenant no recibe la orden del Laboratorio Central', () => {
    const otra = pedir<{ items: readonly Item[] }>('POST', '/diagnostics/service-requests/inbox', { limit: 100 }, TENANT_CLINICA);
    const items = otra.status === 200 ? otra.body.items : [];
    expect(items.map((i) => i.serviceRequestId)).not.toContain(ID_ORDEN_ENTRANTE);
  });

  it('registrar la accesión abre su orden de trabajo, primera en la cola del laboratorio', () => {
    vi.advanceTimersByTime(16_000);
    const orden = bandeja().find((i) => i.serviceRequestId === ID_ORDEN_ENTRANTE)!;
    const muestra = pedir<{ id: string }>(
      'POST',
      '/diagnostics/specimens',
      {
        patientProfileId: orden.patientProfileId,
        custodianTenantId: TENANT_LABORATORIO,
        specimenTypeConceptId: SPECIMEN_TYPE['BLDV'],
        serviceRequestId: orden.serviceRequestId,
      },
      TENANT_LABORATORIO,
    );
    expect(muestra.status).toBe(201);
    const accesion = pedir<{ id: string }>(
      'POST',
      '/diagnostics/accessions',
      { patientProfileId: orden.patientProfileId, specimenIds: [muestra.body.id], serviceRequestId: orden.serviceRequestId },
      TENANT_LABORATORIO,
    );
    expect(accesion.status).toBe(201);

    const match = router.match('GET', '/diagnostics/work-orders')!;
    const cola = match.handler({
      method: 'GET',
      path: '/diagnostics/work-orders',
      params: match.params,
      query: new URLSearchParams(),
      body: null,
      headers: new HttpHeaders({ 'X-Tenant-Id': TENANT_LABORATORIO }),
      user: laboratorio,
    }) as readonly { laboratoryAccessionId: string }[];
    expect(cola[0]!.laboratoryAccessionId).toBe(accesion.body.id);
    expect(bandeja().map((i) => i.serviceRequestId)).not.toContain(ID_ORDEN_ENTRANTE);
  });
});

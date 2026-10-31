import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LabPortalClient } from './lab-portal.client';
import type { LabOrderPage } from './lab-portal.types';

const item = (id: string, scope: 'LAB' | 'IMAGING', state: string, requestedAt: string, extra = {}) => ({
  serviceRequestId: id,
  patientDisplayName: 'Ana Pérez',
  codeDisplay: 'Hemograma',
  requestingTenantName: 'Clínica Los Olivos',
  requestedAt,
  state,
  scope,
  ...extra,
});

describe('LabPortalClient.listOrders (bandeja del ejecutor)', () => {
  let client: LabPortalClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(LabPortalClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const bandeja = () => http.match((r) => r.url === '/diagnostics/service-requests/worklist');

  it('con un scope pide solo esa bandeja y traduce el estado a los de la pantalla', () => {
    let pagina: LabOrderPage | undefined;
    client.listOrders('LAB').subscribe((p) => (pagina = p));

    const [req] = bandeja();
    expect(req!.request.method).toBe('POST');
    expect(req!.request.body).toEqual({ scope: 'LAB', limit: 100 });
    req!.flush({
      items: [
        item('a', 'LAB', 'PENDING', '2026-10-31T10:00:00Z'),
        item('b', 'LAB', 'IN_PROCESS', '2026-10-31T11:00:00Z'),
        item('c', 'LAB', 'REPORTED', '2026-10-31T09:00:00Z'),
        item('d', 'LAB', 'CANCELLED', '2026-10-31T08:00:00Z'),
        item('e', 'LAB', 'RECEIVED', '2026-10-31T07:00:00Z'),
      ],
      nextCursor: null,
    });

    expect(pagina!.items.map((o) => [o.orderId, o.status])).toEqual([
      ['b', 'PROCESSED'],
      ['a', 'DRAFT'],
      ['c', 'UPLOADED'],
      ['d', 'CANCELLED'],
      ['e', 'RECEIVED'],
    ]);
    expect(pagina!.count).toBe(5);
  });

  it('sin scope junta laboratorio e imagenología, la más nueva primero, con resumen y detalle', () => {
    let pagina: LabOrderPage | undefined;
    client.listOrders().subscribe((p) => (pagina = p));

    const pedidas = bandeja();
    expect(pedidas.map((r) => r.request.body.scope).sort()).toEqual(['IMAGING', 'LAB']);
    for (const r of pedidas) {
      r.flush(
        r.request.body.scope === 'LAB'
          ? { items: [item('l', 'LAB', 'PENDING', '2026-10-30T10:00:00Z', { summary: 'Hemograma · 3 componentes', componentsSpecified: true, components: [{ conceptId: 'c', display: 'Hb', ordinal: 1 }] })], nextCursor: null }
          : { items: [item('i', 'IMAGING', 'RECEIVED', '2026-10-31T10:00:00Z', { summary: 'RX mano · Mano · Izquierda', imaging: { bodySiteDisplay: 'Mano' } })], nextCursor: null },
      );
    }

    expect(pagina!.items.map((o) => o.orderId)).toEqual(['i', 'l']);
    const lab = pagina!.items[1]!;
    expect(lab.scope).toBe('LAB');
    expect(lab.summary).toBe('Hemograma · 3 componentes');
    expect(lab.detail?.componentsSpecified).toBe(true);
    expect(lab.detail?.components).toHaveLength(1);
    expect(pagina!.items[0]!.detail?.imaging).toMatchObject({ bodySiteDisplay: 'Mano' });
  });

  it('sigue el cursor hasta agotar la bandeja', () => {
    let pagina: LabOrderPage | undefined;
    client.listOrders('IMAGING').subscribe((p) => (pagina = p));

    bandeja()[0]!.flush({ items: [item('1', 'IMAGING', 'PENDING', '2026-10-31T10:00:00Z')], nextCursor: 'sig' });
    const segunda = bandeja()[0]!;
    expect(segunda.request.body).toEqual({ scope: 'IMAGING', limit: 100, cursor: 'sig' });
    segunda.flush({ items: [item('2', 'IMAGING', 'PENDING', '2026-10-31T09:00:00Z')], nextCursor: null });

    expect(pagina!.items.map((o) => o.orderId)).toEqual(['1', '2']);
  });

  it('getOrder lee una orden de la bandeja por id', () => {
    let orden;
    client.getOrder('a b').subscribe((o) => (orden = o));
    const req = http.expectOne('/diagnostics/service-requests/a%20b');
    req.flush(item('a b', 'LAB', 'PENDING', '2026-10-31T10:00:00Z'));
    expect((orden as unknown as { orderId: string }).orderId).toBe('a b');
  });
});

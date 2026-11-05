import { HttpHeaders } from '@angular/common/http';

import type {
  LabCatalog,
  LabCatalogImportResult,
} from '../../data-access/lab-portal/lab-import.types';
import type { LabService } from '../../data-access/lab-portal/lab-portal.types';
import { crearRouterSimulado } from './index';
import { buscarUsuario } from '../mock-session';
import { isMockReply, type MockMethod, type MockRequest } from '../mock-router';

/** The simulator's study catalog mirrors the API (proceso 4.2). */
describe('handlers del catálogo de análisis del laboratorio', () => {
  const router = crearRouterSimulado();
  const laboratorio = buscarUsuario('laboratorio')!;

  function pedir(method: MockMethod, path: string, body: unknown = {}) {
    const match = router.match(method, path)!;
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders({ 'X-Tenant-Id': laboratorio.tenants[0]! }),
      user: laboratorio,
    } satisfies MockRequest);
  }
  const cuerpo = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;

  it('imports a panel with its components, priced or waiting for a price', () => {
    const before = cuerpo<{ items: LabService[] }>(pedir('GET', '/diagnostics/lab/services')).items;
    const handTyped = before.find((s) => s.code === 'HEMOGRAMA')!;
    expect(handTyped.catalogConceptId).toBeNull();
    const catalog = cuerpo<LabCatalog>(pedir('GET', '/diagnostics/lab/catalog'));
    const hemo = catalog.sections.flatMap((s) => s.items).find((i) => i.code === 'HEMOGRAMA')!;
    const result = cuerpo<LabCatalogImportResult>(
      pedir('POST', '/diagnostics/lab/catalog/import', { conceptIds: [hemo.conceptId] }),
    );
    // The demo lab already sells a hand-typed «HEMOGRAMA»: it is linked, not duplicated.
    expect(result.rows[0]).toMatchObject({ outcome: 'LINKED' });

    const services = cuerpo<{ items: LabService[] }>(
      pedir('GET', '/diagnostics/lab/services'),
    ).items;
    const panel = services.find((s) => s.code === 'HEMOGRAMA')!;
    expect(panel).toMatchObject({
      id: handTyped.id,
      catalogConceptId: hemo.conceptId,
      price: handTyped.price,
    });
    expect(services.filter((s) => s.code === 'HEMOGRAMA')).toHaveLength(1);
    const parts = services.filter((s) => s.parentId === panel.id);
    expect(parts).toHaveLength(hemo.components.length);
    const hb = parts.find((s) => s.code === 'HEMOGRAMA.HB')!;
    expect(hb).toMatchObject({ price: '9.75', hasPrice: true, status: 'PUBLISHED' });
    const vcm = parts.find((s) => s.code === 'HEMOGRAMA.VCM')!;
    expect(vcm).toMatchObject({ hasPrice: false, status: 'DRAFT' });

    const priced = cuerpo<LabService>(
      pedir('PATCH', `/diagnostics/lab/services/${vcm.id}`, { price: '12.00' }),
    );
    expect(priced).toMatchObject({ price: '12.00', hasPrice: true, status: 'PUBLISHED' });

    const again = cuerpo<LabCatalog>(pedir('GET', '/diagnostics/lab/catalog'));
    const offered = again.sections.flatMap((s) => s.items).find((i) => i.code === 'HEMOGRAMA')!;
    expect(offered.offeredServiceId).toBe(panel.id);
  });
});

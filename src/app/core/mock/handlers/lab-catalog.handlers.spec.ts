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

  it('an unticked component is not made a service, like the API', () => {
    const catalog = cuerpo<LabCatalog>(pedir('GET', '/diagnostics/lab/catalog'));
    const ego = catalog.sections.flatMap((s) => s.items).find((i) => i.code === 'EGO')!;
    expect(ego.components.length).toBeGreaterThan(1);
    const [dropped, ...kept] = ego.components;
    const result = cuerpo<LabCatalogImportResult>(
      pedir('POST', '/diagnostics/lab/catalog/import', {
        conceptIds: [ego.conceptId],
        skipComponentIds: [dropped!.conceptId],
      }),
    );
    expect(result.rows[0]).toMatchObject({ outcome: 'CREATED' });
    const services = cuerpo<{ items: LabService[] }>(
      pedir('GET', '/diagnostics/lab/services'),
    ).items;
    const parts = services.filter((s) => s.parentId === result.rows[0]!.serviceId);
    expect(parts.map((s) => s.code).sort()).toEqual(kept.map((c) => c.code).sort());
    expect(services.some((s) => s.code === dropped!.code)).toBe(false);
  });

  it('a withdrawn panel can be added again and comes back', () => {
    const catalog = cuerpo<LabCatalog>(pedir('GET', '/diagnostics/lab/catalog'));
    const lipid = catalog.sections
      .flatMap((s) => s.items)
      .find((i) => i.code === 'PERFIL_LIPIDICO')!;
    const first = cuerpo<LabCatalogImportResult>(
      pedir('POST', '/diagnostics/lab/catalog/import', { conceptIds: [lipid.conceptId] }),
    );
    const panelId = first.rows[0]!.serviceId!;
    pedir('DELETE', `/diagnostics/lab/services/${panelId}`);
    const listed = cuerpo<LabCatalog>(pedir('GET', '/diagnostics/lab/catalog'));
    expect(
      listed.sections.flatMap((s) => s.items).find((i) => i.code === 'PERFIL_LIPIDICO')!
        .offeredServiceId,
    ).toBeNull();
    const back = cuerpo<LabCatalogImportResult>(
      pedir('POST', '/diagnostics/lab/catalog/import', { conceptIds: [lipid.conceptId] }),
    );
    expect(back.rows[0]).toMatchObject({ outcome: 'REPUBLISHED', serviceId: panelId });
  });

  it('a CSV price publishes an unpriced catalog component', () => {
    const services = cuerpo<{ items: LabService[] }>(
      pedir('GET', '/diagnostics/lab/services'),
    ).items;
    const ldl = services.find((s) => s.code === 'PERFIL_LIPIDICO.LDL')!;
    expect(ldl).toMatchObject({ hasPrice: false, status: 'DRAFT' });
    pedir('POST', '/diagnostics/lab/services/import', {
      mode: 'UPDATE_ONLY',
      rows: [{ line: 2, service: { code: 'PERFIL_LIPIDICO.LDL', name: ldl.name, price: '15.00' } }],
    });
    const after = cuerpo<{ items: LabService[] }>(pedir('GET', '/diagnostics/lab/services')).items;
    expect(after.find((s) => s.id === ldl.id)).toMatchObject({
      price: '15.00',
      hasPrice: true,
      status: 'PUBLISHED',
    });
  });
});

import type {
  LabCatalogImportOutcome,
  LabCatalogImportResult,
  LabCatalogItem,
} from '../../data-access/lab-portal/lab-import.types';
import type { LabService } from '../../data-access/lab-portal/lab-portal.types';
import { LAB_CATALOG_SECTIONS } from '../fixtures/lab-catalog.fixture';
import { Coleccion } from '../mock-store';
import {
  forbidden,
  isMockReply as isReply,
  reply,
  type MockHandler,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { laboratorioDe } from './lab-portal.handlers';

/* ============================================================================
    The lab portal study catalog (proceso 4.2), mirroring the API:
    `GET /diagnostics/lab/catalog` and `POST /diagnostics/lab/catalog/import`.

    Importing creates the panel and one service per component through the
    existing `POST /diagnostics/lab/services`, and remembers each one's panel,
    concept and whether it has a price. The service routes are wrapped so their
    answers carry `parentId`, `catalogConceptId` and `hasPrice` like the API's,
    without growing the frozen `lab-portal.handlers.ts`.
    ========================================================================== */

interface CatalogLink {
  /** The lab service id. */
  readonly id: string;
  readonly tenantId: string;
  readonly parentId: string | null;
  readonly conceptId: string;
  readonly hasPrice: boolean;
}

const links = new Coleccion<CatalogLink>([]).persistirEn('mock.lab-portal.catalogo');

const ITEMS = new Map<string, LabCatalogItem>(
  LAB_CATALOG_SECTIONS.flatMap((s) => s.items).map((item) => [item.conceptId, item]),
);

/** The API fields this simulator adds to a service answer. */
function enrich(service: LabService): LabService {
  const link = links.get(service.id);
  return {
    ...service,
    parentId: link?.parentId ?? null,
    catalogConceptId: link?.conceptId ?? null,
    hasPrice: link?.hasPrice ?? true,
  };
}

const cuerpo = <T>(answer: unknown): T => (isReply(answer) ? answer.body : answer) as T;

function enrichAnswer(answer: unknown): unknown {
  if (isReply(answer)) {
    return answer.status < 300 ? reply(answer.status, enrich(answer.body as LabService)) : answer;
  }
  if (answer !== null && typeof answer === 'object' && 'items' in answer) {
    const page = answer as { items: readonly LabService[]; count: number };
    return { ...page, items: page.items.map(enrich) };
  }
  return answer === null || typeof answer !== 'object' ? answer : enrich(answer as LabService);
}

export function registerLabCatalog(router: MockRouter): void {
  const create: MockHandler = router.match('POST', '/diagnostics/lab/services')!.handler;
  const list: MockHandler = router.match('GET', '/diagnostics/lab/services')!.handler;
  const patch: MockHandler = router.match('PATCH', '/diagnostics/lab/services/:id')!.handler;
  /** The tenant's services that are not withdrawn (the list hides them). */
  const alive = (request: MockRequest): LabService[] =>
    cuerpo<{ items: LabService[] }>(
      list({ ...request, method: 'GET', query: new URLSearchParams() }),
    ).items;
  const setStatus = (request: MockRequest, id: string, status: 'PUBLISHED' | 'DRAFT') =>
    patch({ ...request, method: 'PATCH', params: { id }, body: { status } });

  router.get('/diagnostics/lab/catalog', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden('Sólo el personal de un laboratorio ve su catálogo.');
    // A withdrawn panel is not in the price list: it can be added again.
    const live = new Set(alive(request).map((s) => s.id));
    const offered = new Map(
      links
        .filtrar((l) => l.tenantId === tenantId && l.parentId === null && live.has(l.id))
        .map((l) => [l.conceptId, l.id]),
    );
    const sections = LAB_CATALOG_SECTIONS.map((s) => ({
      ...s,
      items: s.items.map((item) => ({
        ...item,
        offeredServiceId: offered.get(item.conceptId) ?? null,
      })),
    }));
    return {
      sections,
      sampleTypes: [
        { code: 'BLOOD', name: 'Análisis de sangre' },
        { code: 'URINE', name: 'Análisis de orina' },
        { code: 'STOOL', name: 'Análisis de heces' },
        { code: 'FLUID', name: 'Líquidos corporales (LCR, pleural, sinovial…)' },
        { code: 'SWAB', name: 'Hisopados, secreciones y raspados' },
        { code: 'OTHER', name: 'Otras muestras' },
      ],
      catalogVersion: '2026-10-31',
      count: ITEMS.size,
      priceRule:
        'INLASA 2026 primero; FONASA 2026 convertido a Bs sólo donde INLASA no tiene el análisis; sin equivalente, sin precio.',
    };
  });

  router.post('/diagnostics/lab/catalog/import', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const ids = [...new Set(((request.body ?? {}) as { conceptIds?: string[] }).conceptIds ?? [])];
    const add = (
      code: string,
      name: string,
      priceBs: string | undefined,
      conceptId: string,
      parentId: string | null,
    ) => {
      const created = create({
        ...request,
        body: { code, name, price: priceBs ?? '0', status: priceBs ? 'PUBLISHED' : 'DRAFT' },
      });
      if (!isReply(created) || created.status >= 300) return null;
      const service = created.body as LabService;
      links.agregar({
        id: service.id,
        tenantId,
        parentId,
        conceptId,
        hasPrice: priceBs !== undefined,
      });
      return service.id;
    };
    const rows = ids.map((conceptId) => {
      const row = (
        outcome: LabCatalogImportOutcome,
        serviceId: string | null,
        reason: string | null = null,
      ) => ({
        conceptId,
        outcome,
        serviceId,
        reason,
      });
      const item = ITEMS.get(conceptId);
      if (item === undefined)
        return row('REJECTED', null, 'No es un análisis del catálogo de laboratorio.');
      const existing = links.filtrar(
        (l) => l.tenantId === tenantId && l.parentId === null && l.conceptId === conceptId,
      )[0];
      if (existing !== undefined && alive(request).some((s) => s.id === existing.id))
        return row('SKIPPED', existing.id, 'Ya está en su lista de precios.');
      if (existing !== undefined) {
        for (const l of links.filtrar((x) => x.id === existing.id || x.parentId === existing.id)) {
          setStatus(request, l.id, l.hasPrice ? 'PUBLISHED' : 'DRAFT');
        }
        return row('REPUBLISHED', existing.id);
      }
      // Like the API: a free-form service of the same code is linked, keeping its price.
      const own = alive(request).find((s) => s.code.toLowerCase() === item.code.toLowerCase());
      const adopt = own !== undefined && links.get(own.id) === undefined ? own : undefined;
      if (adopt)
        links.agregar({ id: adopt.id, tenantId, parentId: null, conceptId, hasPrice: true });
      const panelId =
        adopt?.id ?? add(item.code, item.name, item.suggestedPrice?.priceBs, item.conceptId, null);
      if (panelId === null)
        return row('REJECTED', null, `Ya tiene un servicio con el código «${item.code}».`);
      for (const part of item.components) {
        add(part.code, part.name, part.suggestedPrice?.priceBs, part.conceptId, panelId);
      }
      return row(adopt ? 'LINKED' : 'CREATED', panelId);
    });
    const count = (o: LabCatalogImportOutcome) => rows.filter((r) => r.outcome === o).length;
    const result: LabCatalogImportResult = {
      created: count('CREATED'),
      republished: count('REPUBLISHED'),
      linked: count('LINKED'),
      skipped: count('SKIPPED'),
      rejected: count('REJECTED'),
      rows,
    };
    return result;
  });

  router.wrap('GET', '/diagnostics/lab/services', (request, next) => enrichAnswer(next(request)));
  // Like the API: a CSV price on an unpriced catalog item counts as its first price.
  router.wrap('POST', '/diagnostics/lab/services/import', (request, next) => {
    const answer = next(request);
    const rows =
      ((request.body ?? {}) as { rows?: { service?: { code?: string; price?: unknown } }[] })
        .rows ?? [];
    const priced = new Set(
      rows
        .filter((r) => r.service?.price != null)
        .map((r) => String(r.service?.code ?? '').toLowerCase()),
    );
    for (const service of alive(request)) {
      const link = links.get(service.id);
      if (link === undefined || link.hasPrice || !priced.has(service.code.toLowerCase())) continue;
      links.actualizar(link.id, { hasPrice: true });
      if (service.status === 'DRAFT') setStatus(request, service.id, 'PUBLISHED');
    }
    return answer;
  });
  router.wrap('POST', '/diagnostics/lab/services', (request, next) => enrichAnswer(next(request)));
  router.wrap('DELETE', '/diagnostics/lab/services/:id', (request, next) =>
    enrichAnswer(next(request)),
  );
  router.wrap('PATCH', '/diagnostics/lab/services/:id', (request, next) => {
    const link = links.get(request.params['id'] ?? '');
    const body = (request.body ?? {}) as Record<string, unknown>;
    const firstPrice = link !== undefined && !link.hasPrice && body['price'] != null;
    // Like the API: an unpriced catalog item waits as DRAFT; its first price publishes it.
    const answer = next(
      firstPrice && body['status'] == null
        ? { ...request, body: { ...body, status: 'PUBLISHED' } }
        : request,
    );
    if (firstPrice && !(isReply(answer) && answer.status >= 300))
      links.actualizar(link.id, { hasPrice: true });
    return enrichAnswer(answer);
  });
}

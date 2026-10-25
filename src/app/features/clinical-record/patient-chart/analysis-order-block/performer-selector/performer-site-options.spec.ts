import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { ViewState } from '../../../../../core/view-state/view-state.types';
import {
  PERFORMER_SELECTION_VALUE_SET,
  PerformerSiteOptions,
  type PerformerSiteData,
} from './performer-site-options';

const CONJUNTO = {
  id: 'vs-perf',
  internalCode: PERFORMER_SELECTION_VALUE_SET,
  name: 'Ejecutor',
  description: '',
  defaultVersionId: 'vsv-1',
  memberCount: 3,
};

const EXPANSION = {
  valueSetId: 'vs-perf',
  valueSetVersionId: 'vsv-1',
  version: '1.0.0',
  count: 3,
  limit: 200,
  nextCursor: null,
  items: [
    { conceptId: 'c-self', code: 'SR_PERF_SELF', display: 'Self', codeSystemVersionId: 'x' },
    { conceptId: 'c-org', code: 'SR_PERF_ORGANIZATION', display: 'Org', codeSystemVersionId: 'x' },
    { conceptId: 'c-pat', code: 'SR_PERF_PATIENT_CHOICE', display: 'Patient', codeSystemVersionId: 'x' },
  ],
};

const VINCULACIONES = [
  { id: 'r-1', practiceSiteId: 's-1', serviceConceptId: 'p-1', statusCode: 'ROLE_ASG_ACTIVE' },
  { id: 'r-2', practiceSiteId: 's-2', serviceConceptId: 'p-otro', statusCode: 'ROLE_ASG_ACTIVE' },
];

const BUSQUEDA = {
  items: [
    { practiceSiteId: 's-2', name: 'Centro Este', addressText: null },
    { practiceSiteId: 's-1', name: 'Centro Norte', addressText: 'Av. 1' },
  ],
  total: 2,
  limit: 20,
  offset: 0,
};

describe('PerformerSiteOptions', () => {
  let servicio: PerformerSiteOptions;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(PerformerSiteOptions);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Responde el conjunto y su expansión, que se piden una sola vez. */
  function responderConjunto(): void {
    http.expectOne((r) => r.url === '/terminology/value-sets' && r.params.get('code') === PERFORMER_SELECTION_VALUE_SET)
      .flush({ items: [CONJUNTO], count: 1, limit: 50, nextCursor: null });
    http.expectOne((r) => r.url === '/terminology/value-sets/vs-perf/$expand').flush(EXPANSION);
  }

  /** Las lecturas hermanas de la que falló quedan sin respuesta: se descartan. */
  function descartarPendientes(): void {
    http.match(() => true);
  }

  function leer(procedimiento: string): ViewState<PerformerSiteData>[] {
    const estados: ViewState<PerformerSiteData>[] = [];
    servicio.load(procedimiento).subscribe((estado) => estados.push(estado));
    return estados;
  }

  it('expande el conjunto y pide vinculaciones y búsqueda una vez por procedimiento', () => {
    const estados = leer('p-1');

    responderConjunto();
    http.expectOne('/practitioners/me/role-assignments').flush(VINCULACIONES);
    const busqueda = http.expectOne((r) => r.url === '/medical-centers/search');
    expect(busqueda.request.params.get('procedureConceptIds')).toBe('p-1');
    expect(busqueda.request.params.get('includePartial')).toBe('false');
    busqueda.flush(BUSQUEDA);

    expect(estados.map((e) => e.status)).toEqual(['loading', 'ready']);
    const listo = estados[1] as Extract<ViewState<PerformerSiteData>, { status: 'ready' }>;
    expect(listo.data.concepts).toEqual({ SELF: 'c-self', ORGANIZATION: 'c-org', PATIENT_CHOICE: 'c-pat' });
    // En el orden de la búsqueda, sin reordenar.
    expect(listo.data.centerSites.map((s) => s.practiceSiteId)).toEqual(['s-2', 's-1']);
    // Sólo la sede activa **de este procedimiento**.
    expect(listo.data.ownSites.map((s) => s.practiceSiteId)).toEqual(['s-1']);
    expect(listo.data.ownSites[0]?.addressText).toBe('Av. 1');
  });

  it('un segundo procedimiento no vuelve a expandir el conjunto', () => {
    leer('p-1');
    responderConjunto();
    http.expectOne('/practitioners/me/role-assignments').flush(VINCULACIONES);
    http.expectOne((r) => r.url === '/medical-centers/search').flush(BUSQUEDA);

    leer('p-2');
    http.expectNone((r) => r.url === '/terminology/value-sets');
    http.expectOne('/practitioners/me/role-assignments').flush(VINCULACIONES);
    const busqueda = http.expectOne((r) => r.url === '/medical-centers/search');
    expect(busqueda.request.params.get('procedureConceptIds')).toBe('p-2');
    busqueda.flush({ ...BUSQUEDA, items: [] });
  });

  it('error de la búsqueda → estado de error, sin inventar sedes', () => {
    const estados = leer('p-1');
    responderConjunto();
    http.expectOne('/practitioners/me/role-assignments').flush(VINCULACIONES);
    http.expectOne((r) => r.url === '/medical-centers/search').flush(
      { code: 'INTERNAL_ERROR', message: 'Falló', correlationId: 'req-9' },
      { status: 500, statusText: 'Server Error' },
    );

    expect(estados.at(-1)!.status).toBe('error');
    expect(estados.some((e) => e.status === 'ready')).toBe(false);
  });

  it('error de las vinculaciones → estado de error', () => {
    const estados = leer('p-1');
    responderConjunto();
    // Al primer fallo las otras lecturas se cancelan: no queda nada a medias.
    http.expectOne('/practitioners/me/role-assignments').flush(null, { status: 0, statusText: 'x' });

    expect(estados.at(-1)!.status).toBe('offline');
    expect(estados.some((e) => e.status === 'ready')).toBe(false);
    descartarPendientes();
  });

  it('conjunto no sembrado → estado de error, y se puede reintentar', () => {
    const estados = leer('p-1');
    http.expectOne((r) => r.url === '/terminology/value-sets').flush({ items: [], count: 0, limit: 50, nextCursor: null });
    expect(estados.at(-1)!.status).toBe('error');
    descartarPendientes();

    // El fallo no queda cacheado.
    const reintento = leer('p-1');
    responderConjunto();
    http.expectOne('/practitioners/me/role-assignments').flush(VINCULACIONES);
    http.expectOne((r) => r.url === '/medical-centers/search').flush(BUSQUEDA);
    expect(reintento.at(-1)!.status).toBe('ready');
  });

  it('un conjunto incompleto deja concepts en null', () => {
    const estados = leer('p-1');
    http.expectOne((r) => r.url === '/terminology/value-sets').flush({ items: [CONJUNTO], count: 1, limit: 50, nextCursor: null });
    http.expectOne((r) => r.url === '/terminology/value-sets/vs-perf/$expand').flush({
      ...EXPANSION,
      items: EXPANSION.items.slice(0, 2),
    });
    http.expectOne('/practitioners/me/role-assignments').flush(VINCULACIONES);
    http.expectOne((r) => r.url === '/medical-centers/search').flush(BUSQUEDA);

    const listo = estados.at(-1) as Extract<ViewState<PerformerSiteData>, { status: 'ready' }>;
    expect(listo.data.concepts).toBeNull();
  });
});

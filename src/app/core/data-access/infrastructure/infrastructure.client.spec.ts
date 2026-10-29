import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { InfrastructureClient } from './infrastructure.client';
import { infrastructureErrorToViewState, readInfrastructureError } from './infrastructure.errors';

describe('InfrastructureClient', () => {
  let client: InfrastructureClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(InfrastructureClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el catálogo en /practice/infrastructure-catalog', () => {
    client.getCatalog().subscribe();
    const req = http.expectOne('/practice/infrastructure-catalog');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('pide la estructura por establecimiento y escapa el id', () => {
    client.getStructure('a/b').subscribe();
    http.expectOne('/sites/a%2Fb/structure').flush({});
  });

  it('crea un espacio con POST y sin If-Match', () => {
    client
      .createCareSpace('s1', {
        code: 'ED-A',
        name: 'Edificio A',
        formCode: 'LOC_FORM_BUILDING',
        functionCode: 'SPACE_FN_BUILDING_GENERIC',
      })
      .subscribe();
    const req = http.expectOne('/sites/s1/care-spaces');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('If-Match')).toBe(false);
    expect(req.request.body.code).toBe('ED-A');
    req.flush({});
  });

  it('manda el patrón de la alta masiva tal cual', () => {
    client
      .createBulk('s1', {
        parentSpaceId: 'p1',
        formCode: 'LOC_FORM_BED',
        functionCode: 'SPACE_FN_BED_STANDARD',
        codePattern: '301-{A..H}',
        namePattern: 'Cama 301-{A..H}',
      })
      .subscribe();
    const req = http.expectOne('/sites/s1/care-spaces/bulk');
    expect(req.request.body.codePattern).toBe('301-{A..H}');
    req.flush({ created: [] });
  });

  it('importa con dryRun=true y con dryRun=false las mismas filas', () => {
    const rows = [
      { code: 'X', name: 'X', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_CONSULTING_ROOM' },
    ];
    client.importSpaces('s1', rows, true).subscribe();
    const seco = http.expectOne((r) => r.url === '/sites/s1/care-spaces/import');
    expect(seco.request.params.get('dryRun')).toBe('true');
    seco.flush({ ok: true, rows: [] });

    client.importSpaces('s1', rows, false).subscribe();
    const real = http.expectOne((r) => r.url === '/sites/s1/care-spaces/import');
    expect(real.request.params.get('dryRun')).toBe('false');
    expect(real.request.body).toEqual(seco.request.body);
    real.flush({ ok: true, rows: [], created: 1 });
  });

  it('PATCH, move y lifecycle llevan If-Match con el rowVersion', () => {
    client.updateCareSpace('c1', 4, { name: 'Nuevo' }).subscribe();
    const patch = http.expectOne('/care-spaces/c1');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.headers.get('If-Match')).toBe('4');
    patch.flush({});

    client.moveCareSpace('c1', 5, { parentSpaceId: null }).subscribe();
    const move = http.expectOne('/care-spaces/c1/move');
    expect(move.request.headers.get('If-Match')).toBe('5');
    expect(move.request.body).toEqual({ parentSpaceId: null });
    move.flush({});

    client.changeLifecycle('c1', 6, { action: 'retire', reason: 'Obra' }).subscribe();
    const ciclo = http.expectOne('/care-spaces/c1/lifecycle');
    expect(ciclo.request.headers.get('If-Match')).toBe('6');
    expect(ciclo.request.body).toEqual({ action: 'retire', reason: 'Obra' });
    ciclo.flush({});
  });

  it('consulta los bloqueos antes de clausurar', () => {
    client.retireCheck('c1').subscribe();
    const req = http.expectOne('/care-spaces/c1/retire-check');
    expect(req.request.method).toBe('GET');
    req.flush({ blockers: [] });
  });

  it('el vínculo con una unidad se cierra con DELETE (vigencia, no borrado)', () => {
    client.closeUnitAssignment('c1', 'v1').subscribe();
    const req = http.expectOne('/care-spaces/c1/unit-assignments/v1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('regulatorio con If-Match; habilitaciones y capacidad en sus rutas', () => {
    client.updateRegulatory('s1', 2, { snisCode: '123' }).subscribe();
    const reg = http.expectOne('/sites/s1/regulatory');
    expect(reg.request.method).toBe('PATCH');
    expect(reg.request.headers.get('If-Match')).toBe('2');
    reg.flush({});

    client.listLicenses('s1').subscribe();
    http.expectOne('/sites/s1/licenses').flush([]);

    client.updateLicense('l1', 3, { notes: 'x' }).subscribe();
    const lic = http.expectOne('/site-licenses/l1');
    expect(lic.request.headers.get('If-Match')).toBe('3');
    lic.flush({});

    client.getCapacity('s1').subscribe();
    http.expectOne('/sites/s1/capacity').flush({ declared: [], derived: [], gaps: [] });

    client
      .declareCapacity('s1', { capacityKindCode: 'CAP_BEDS_CENSABLE', quantity: 50, asOf: '2026-10-29' })
      .subscribe();
    http.expectOne('/sites/s1/declared-capacities').flush({});
  });
});

describe('errores de infraestructura', () => {
  function fallo(status: number, code: string, details: Record<string, unknown> = {}): HttpErrorResponse {
    return new HttpErrorResponse({
      status,
      error: { code, message: 'x', details, correlationId: 'req-1', timestamp: '', path: '' },
    });
  }

  it('lee el reason de details y la lista de bloqueos', () => {
    const detalle = readInfrastructureError(
      fallo(409, 'CONFLICT', {
        reason: 'SPACE_RETIRE_BLOCKED',
        blockers: [
          { kind: 'ACTIVE_CHILDREN', count: 2, sampleIds: ['a'], nextAction: 'Clausurar los hijos' },
          { basura: true },
        ],
      }),
    );
    expect(detalle?.reason).toBe('SPACE_RETIRE_BLOCKED');
    expect(detalle?.blockers.length).toBe(1);
    expect(detalle?.requestId).toBe('req-1');
  });

  it('ignora un reason que no conoce', () => {
    expect(readInfrastructureError(fallo(409, 'CONFLICT', { reason: 'OTRO' }))?.reason).toBeNull();
  });

  it('un error sin forma de contrato no es de infraestructura', () => {
    expect(readInfrastructureError(new HttpErrorResponse({ status: 502, error: '<html>' }))).toBeNull();
    expect(readInfrastructureError(new Error('x'))).toBeNull();
  });

  it('SPACE_CODE_TAKEN se ancla al campo code y conserva el requestId', () => {
    const estado = infrastructureErrorToViewState(fallo(409, 'CONFLICT', { reason: 'SPACE_CODE_TAKEN' }));
    expect(estado.status).toBe('validation');
    if (estado.status === 'validation') {
      expect(estado.issues[0].field).toBe('code');
      expect(estado.requestId).toBe('req-1');
    }
  });

  it('un 412 se dice como conflicto de concurrencia (S4)', () => {
    const estado = infrastructureErrorToViewState(fallo(412, 'CONCURRENCY_CONFLICT'));
    expect(estado.status).toBe('validation');
  });

  it('un 404 sigue siendo S6 sin datos y un 403, S5', () => {
    expect(infrastructureErrorToViewState(fallo(404, 'NOT_FOUND')).status).toBe('not-found');
    expect(infrastructureErrorToViewState(fallo(403, 'FORBIDDEN')).status).toBe('forbidden');
  });

  it('sin respuesta (estado 0) es S8', () => {
    const sinRed = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });
    expect(infrastructureErrorToViewState(sinRed).status).toBe('offline');
  });
});

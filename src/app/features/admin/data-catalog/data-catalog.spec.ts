import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DataCatalog } from './data-catalog';

const COBERTURA_SIN_ESCANEO = {
  modelVersion: 'catalog-coverage/v1',
  denominator: 0,
  declaredDebt: 0,
  lastScan: null,
  dimensions: {
    technical: { status: 'UNKNOWN', covered: 0, denominator: 0, ratio: null },
    semantic: { status: 'UNKNOWN', covered: 0, denominator: 0, ratio: null },
    ownership: { status: 'UNKNOWN', covered: 0, denominator: 0, ratio: null },
    sensitivity: { status: 'UNKNOWN', covered: 0, denominator: 0, ratio: null },
    review: { status: 'UNKNOWN', covered: 0, denominator: 0, ratio: null },
  },
};

const OBJETO = {
  id: 'o1',
  schemaName: 'scheduling',
  objectName: 'appointments',
  objectKind: 'TABLE',
  observationStatus: 'OBSERVED',
  columnCount: 7,
  statistics: { estimatedRows: '1234', totalBytes: null, isEstimate: true, observedAt: null },
  lastSeenAt: '2026-09-18T10:00:00.000Z',
  annotation: {
    id: 'a1',
    businessName: 'Cita',
    reviewStatus: 'NEEDS_REVIEW',
    hasPurpose: true,
    hasExistenceRationale: true,
    hasRowGrain: true,
    owner: null,
    sensitivity: 'UNKNOWN',
  },
};

describe('DataCatalog', () => {
  let fixture: ComponentFixture<DataCatalog>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataCatalog],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DataCatalog);
    fixture.detectChanges();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  function responder(objetos: object[], cobertura: object = COBERTURA_SIN_ESCANEO) {
    http.expectOne('/admin/catalog/schemas').flush([]);
    http.expectOne((r) => r.url === '/admin/catalog/coverage').flush(cobertura);
    http.expectOne((r) => r.url === '/admin/catalog/objects').flush({ items: objetos, nextCursor: null, limit: 25 });
    http.expectOne('/admin/catalog/scans').flush({ items: [], nextCursor: null, limit: 50 });
    fixture.detectChanges();
  }

  it('sin escaneo muestra «Sin medición», nunca un 0 %', () => {
    responder([OBJETO]);
    const texto = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="catalog-coverage"]')!.textContent!;
    expect(texto).toContain('Sin medición');
    expect(texto).not.toContain('0 %');
  });

  it('lista los objetos con el estado de su ficha', () => {
    responder([OBJETO]);
    const tabla = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="catalog-objects"]')!.textContent!;
    expect(tabla).toContain('appointments');
    expect(tabla).toContain('En revisión');
    expect(tabla).toContain('Cita');
  });

  it('pide los objetos con los filtros sin claves vacías', () => {
    responder([OBJETO]);
    const componente = fixture.componentInstance as unknown as { faltante: { set(v: string): void }; filtrar(): void };
    componente.faltante.set('existenceRationale');
    componente.filtrar();
    const req = http.expectOne((r) => r.url === '/admin/catalog/objects');
    expect(req.request.params.get('missing')).toBe('existenceRationale');
    expect(req.request.params.has('schema')).toBe(false);
    req.flush({ items: [], nextCursor: null, limit: 25 });
  });

  it('solicitar escaneo manda clave de idempotencia y avisa si ya hay uno en curso', () => {
    responder([]);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="catalog-request-scan"] button, button[data-testid="catalog-request-scan"]')?.click();
    const componente = fixture.componentInstance as unknown as { solicitarEscaneo(): void };
    componente.solicitarEscaneo();
    const reqs = http.match('/admin/catalog/scans');
    const post = reqs.find((r) => r.request.method === 'POST')!;
    expect(post.request.headers.get('Idempotency-Key')).toMatch(/^scan-/);
    post.flush({ code: 'CONFLICT', message: 'Ya hay un escaneo' }, { status: 409, statusText: 'Conflict' });
    for (const r of reqs.filter((x) => x !== post)) r.flush({ code: 'CONFLICT' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ya hay un escaneo en curso');
  });
});

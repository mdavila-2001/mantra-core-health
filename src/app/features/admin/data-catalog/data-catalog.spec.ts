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

  function responder(objetos: object[], cobertura: object = COBERTURA_SIN_ESCANEO, schemas: object[] = []) {
    http.expectOne('/admin/catalog/schemas').flush(schemas);
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

  describe('pestaña «Esquemas»', () => {
    const SCHEMAS = [
      {
        schemaName: 'iam',
        objects: 14,
        notObserved: 0,
        annotated: 14,
        approved: 0,
        description: {
          moduleNumber: 1,
          moduleCode: 'iam',
          title: 'Identity & Access — User Accounts and Security',
          domain: 'Identidad y Seguridad',
          business: 'Manages login accounts, credentials, MFA, devices and sessions.',
          system: 'Módulo 01 del modelo: 14 tablas o vistas modeladas y 14 conjuntos de índices.',
          source: 'SALUD/Módulos/M01 iam.md',
        },
      },
      {
        schemaName: 'accounting',
        objects: 42,
        notObserved: 0,
        annotated: 0,
        approved: 0,
        description: {
          moduleNumber: 16,
          moduleCode: 'accounting',
          title: 'General Ledger and Accounting Subledgers',
          domain: 'Financiero y ERP',
          business: null,
          system: null,
          source: 'SALUD/Módulos/M16 accounting.md',
        },
      },
      { schemaName: 'surveys', objects: 7, notObserved: 0, annotated: 0, approved: 0, description: null },
    ];
    const el = () => fixture.nativeElement as HTMLElement;
    const abrirEsquemas = () => {
      (fixture.componentInstance as unknown as { pestana: { set(i: number): void } }).pestana.set(1);
      fixture.detectChanges();
    };
    const elegir = (schema: string) => {
      (fixture.componentInstance as unknown as { elegirEsquema(f: { schemaName: string }): void }).elegirEsquema({ schemaName: schema });
      fixture.detectChanges();
    };

    it('lista cada schema con el módulo de la bóveda al que pertenece', () => {
      responder([OBJETO], COBERTURA_SIN_ESCANEO, SCHEMAS);
      abrirEsquemas();
      const tabla = el().querySelector('[data-testid="catalog-schemas"]')!.textContent!;
      expect(tabla).toContain('M01 · Identity & Access');
      expect(tabla).toContain('Identidad y Seguridad');
      // Un schema que ningún módulo declara se dice, no se deja en blanco.
      expect(tabla).toContain('Sin módulo en la bóveda');
    });

    it('elegir un schema muestra su negocio, su sistema y la nota de origen', () => {
      responder([OBJETO], COBERTURA_SIN_ESCANEO, SCHEMAS);
      abrirEsquemas();
      elegir('iam');
      expect(el().querySelector('[data-testid="catalog-schema-business"]')!.textContent).toContain('Manages login accounts');
      expect(el().querySelector('[data-testid="catalog-schema-system"]')!.textContent).toContain('14 tablas o vistas modeladas');
      expect(el().querySelector('[data-testid="catalog-schema-detail"]')!.textContent).toContain('SALUD/Módulos/M01 iam.md');
    });

    it('un módulo sin propósito de negocio lo dice y no inventa uno', () => {
      responder([OBJETO], COBERTURA_SIN_ESCANEO, SCHEMAS);
      abrirEsquemas();
      elegir('accounting');
      expect(el().querySelector('[data-testid="catalog-schema-business"]')!.textContent).toContain('La bóveda no describe el propósito de negocio');
      expect(el().querySelector('[data-testid="catalog-schema-system"]')!.textContent).toContain('La nota del módulo no trae métricas');
    });

    it('un schema que ningún módulo declara lo dice', () => {
      responder([OBJETO], COBERTURA_SIN_ESCANEO, SCHEMAS);
      abrirEsquemas();
      elegir('surveys');
      expect(el().querySelector('[data-testid="catalog-schema-business"]')!.textContent).toContain('Ningún módulo de la bóveda declara este schema');
    });

    it('«Ver las tablas de este schema» filtra el inventario y vuelve a esa pestaña', () => {
      responder([OBJETO], COBERTURA_SIN_ESCANEO, SCHEMAS);
      abrirEsquemas();
      elegir('iam');
      (fixture.componentInstance as unknown as { verTablas(s: string): void }).verTablas('iam');
      const objetos = http.expectOne((r) => r.url === '/admin/catalog/objects');
      expect(objetos.request.params.get('schema')).toBe('iam');
      objetos.flush({ items: [], nextCursor: null, limit: 25 });
      http.expectOne((r) => r.url === '/admin/catalog/coverage').flush(COBERTURA_SIN_ESCANEO);
      fixture.detectChanges();
      expect(el().querySelector('[data-testid="catalog-schemas"]')).toBeNull();
    });

    it('si la lectura de schemas falla, la pestaña muestra el error y no una tabla vacía', () => {
      http.expectOne('/admin/catalog/schemas').flush({ code: 'INTERNAL' }, { status: 500, statusText: 'Server Error' });
      http.expectOne((r) => r.url === '/admin/catalog/coverage').flush(COBERTURA_SIN_ESCANEO);
      http.expectOne((r) => r.url === '/admin/catalog/objects').flush({ items: [], nextCursor: null, limit: 25 });
      http.expectOne('/admin/catalog/scans').flush({ items: [], nextCursor: null, limit: 50 });
      abrirEsquemas();
      expect(el().querySelector('[data-testid="catalog-schemas"]')?.textContent ?? '').not.toContain('Sin módulo en la bóveda');
    });
  });
});

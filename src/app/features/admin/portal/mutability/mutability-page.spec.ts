import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type {
  MutabilityDetail,
  MutabilityItem,
  MutabilitySummary,
} from '../../../../core/data-access/admin-portal/mutability.types';
import { MutabilityPage } from './mutability-page';

const SCREEN = '/superadmin/portal/governance/mutability';
const LIST = '/admin/governance/mutability';
const SUMMARY = '/admin/governance/mutability/summary';

const ratio = (n: number, d = 10) => ({ numerator: n, denominator: d });

const summary: MutabilitySummary = {
  totalTables: 10,
  byWriteMode: [
    { writeMode: 'APPEND_ONLY', ...ratio(3), byEvidence: { ENFORCED_DB: 1, DECLARED_MODEL: 2 } },
    { writeMode: 'UNKNOWN', ...ratio(7), byEvidence: { UNKNOWN: 7 } },
  ],
  byEvidence: [
    { level: 'ENFORCED_DB', ...ratio(1) },
    { level: 'DECLARED_MODEL', ...ratio(2) },
    { level: 'UNKNOWN', ...ratio(7) },
  ],
  decided: ratio(3),
  enforcedByDatabase: ratio(1),
  withContradictions: ratio(1),
  withGaps: ratio(1),
  findingCodes: [
    { code: 'DECLARED_VS_CODE_UPDATE', kind: 'CONTRADICTION', findings: 1, tables: 1 },
    { code: 'DECLARED_NOT_ENFORCED', kind: 'GAP', findings: 1, tables: 1 },
  ],
  disposition: [{ disposition: 'UNKNOWN', ...ratio(10) }],
  legalHold: [{ legalHold: 'UNKNOWN', ...ratio(10) }],
  withDeclaredPeriod: 0,
  pendingCompliance: 2,
  registered: ratio(4),
  sources: { tables: 10 },
  generatedFrom: {
    modelRoot: 'mantra-core-health-model',
    inventoryRoot: 'mantra-core-health-api/inventario',
    modelVersion: '4.2.81',
    note: 'x',
  },
};

const item = (over: Partial<MutabilityItem> = {}): MutabilityItem => ({
  schema: 'audit',
  table: 'audit_log',
  database: 'main',
  writeMode: 'APPEND_ONLY',
  writeModeLevel: 'ENFORCED_DB',
  disposition: 'UNKNOWN',
  dispositionLevel: 'UNKNOWN',
  retention: null,
  legalHold: 'UNKNOWN',
  legalHoldLevel: 'UNKNOWN',
  contradictions: 0,
  gaps: 0,
  registered: true,
  ...over,
});

const detail: MutabilityDetail = {
  ...item({
    schema: 'chart',
    table: 'clinical_note_versions',
    writeModeLevel: 'DECLARED_MODEL',
    contradictions: 1,
    registered: false,
  }),
  evidence: [
    {
      kind: 'STEREOTYPE',
      level: 'DECLARED_MODEL',
      supports: 'WRITE_MODE',
      source: 'diagram_15_chart.puml:50',
      claim: 'Diagrama: <<IMMUTABLE>>',
    },
    {
      kind: 'CODE_UPDATE',
      level: 'ENFORCED_CODE',
      supports: 'WRITE_MODE',
      source: 'src/chart-notes.service.ts:558',
      claim: 'ACTUALIZA (DIRECTA)',
    },
  ],
  findings: [
    {
      kind: 'CONTRADICTION',
      code: 'DECLARED_VS_CODE_UPDATE',
      severity: 'HIGH',
      summary: 'Declaración del modelo impide UPDATE, pero el código actualiza.',
      a: {
        kind: 'STEREOTYPE',
        level: 'DECLARED_MODEL',
        supports: 'WRITE_MODE',
        source: 'diagram_15_chart.puml:50',
        claim: 'Diagrama: <<IMMUTABLE>>',
      },
      b: {
        kind: 'CODE_UPDATE',
        level: 'ENFORCED_CODE',
        supports: 'WRITE_MODE',
        source: 'src/chart-notes.service.ts:558',
        claim: 'ACTUALIZA (DIRECTA)',
      },
    },
  ],
};

describe('MutabilityPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function open(url = SCREEN): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'superadmin/portal/governance/mutability', component: MutabilityPage },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, MutabilityPage);
  }
  const root = () => harness.routeNativeElement as HTMLElement;
  const flat = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ');
  const text = () => flat(root());
  const section = (testId: string) => flat(root().querySelector(`[data-testid="${testId}"]`));
  const flushSummary = () => {
    http.expectOne(SUMMARY).flush(summary);
    harness.detectChanges();
  };

  afterEach(() => http.verify());

  it('el resumen muestra cada modo con numerador y denominador y dice que el catálogo es derivado', async () => {
    await open();
    flushSummary();
    const metrics = section('portal-mutability-metrics');
    expect(metrics).toContain('3 de 10');
    expect(metrics).toContain('Con contradicciones');
    const resumen = section('portal-mutability-summary');
    expect(resumen).toContain('Sólo se agrega');
    expect(resumen).toContain('Sin evidencia (no se sabe)');
    expect(resumen).toContain('Impuesto por la base: 1');
    expect(resumen).toContain('Declarada inmutable, sin barrera que la imponga');
    expect(section('portal-mutability-provenance')).toContain('derivado');
  });

  it('una sola tarjeta con las cuatro pestañas', async () => {
    await open();
    flushSummary();
    const tabs = [...root().querySelectorAll('[role="tab"]')].map((t) => flat(t).trim());
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toContain('Resumen');
    expect(tabs[1]).toContain('Tablas (10)');
    expect(tabs[2]).toContain('Contradicciones (1)');
    expect(tabs[3]).toContain('Evidencia');
    expect(root().querySelectorAll('.mut__card')).toHaveLength(1);
  });

  it('la pestaña Tablas manda los filtros de la URL y descarta los que la API rechazaría', async () => {
    await open(
      `${SCREEN}?view=tables&writeMode=APPEND_ONLY&evidence=ENFORCED_DB&schema=a;b&q=audit`,
    );
    flushSummary();
    const req = http.expectOne((r) => r.url === LIST);
    expect(req.request.params.get('writeMode')).toBe('APPEND_ONLY');
    expect(req.request.params.get('evidence')).toBe('ENFORCED_DB');
    expect(req.request.params.get('q')).toBe('audit');
    expect(req.request.params.has('schema')).toBe(false);
    req.flush({ items: [item()], nextCursor: null, limit: 50, total: 1 });
    harness.detectChanges();
    const table = section('portal-mutability-table');
    expect(table).toContain('audit.audit_log');
    expect(table).toContain('Impuesto por la base');
    expect(table).toContain('Ninguno registrado');
  });

  it('la lista vacía explica por qué lo está', async () => {
    await open(`${SCREEN}?view=tables&q=zzz`);
    flushSummary();
    http
      .expectOne((r) => r.url === LIST)
      .flush({ items: [], nextCursor: null, limit: 50, total: 0 });
    harness.detectChanges();
    expect(text()).toContain('Ninguna tabla coincide con los filtros elegidos.');
  });

  it('un error de la lista es accionable y reintenta la misma consulta', async () => {
    await open(`${SCREEN}?view=tables`);
    flushSummary();
    http
      .expectOne((r) => r.url === LIST)
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();
    expect(text()).toMatch(/Reintentar/);
  });

  it('las contradicciones piden finding=CONTRADICTION sin heredar los filtros de la pestaña Tablas', async () => {
    await open(`${SCREEN}?view=contradictions&writeMode=UPDATABLE`);
    flushSummary();
    const req = http.expectOne((r) => r.url === LIST);
    expect(req.request.params.get('finding')).toBe('CONTRADICTION');
    expect(req.request.params.has('writeMode')).toBe(false);
    req.flush({
      items: [
        item({
          schema: 'chart',
          table: 'clinical_note_versions',
          writeModeLevel: 'DECLARED_MODEL',
          contradictions: 1,
        }),
      ],
      nextCursor: null,
      limit: 50,
      total: 1,
    });
    harness.detectChanges();
    expect(text()).toContain('chart.clinical_note_versions');
    expect(text()).toContain('1 contradicción(es)');
  });

  it('la evidencia de una tabla muestra las dos caras de la contradicción con su fuente exacta', async () => {
    await open(`${SCREEN}?view=evidence&table=chart.clinical_note_versions`);
    flushSummary();
    http.expectOne('/admin/governance/mutability/chart/clinical_note_versions').flush(detail);
    harness.detectChanges();
    const ev = section('portal-mutability-evidence');
    expect(ev).toContain('chart.clinical_note_versions');
    expect(ev).toContain('Una fuente dice');
    expect(ev).toContain('La otra dice');
    expect(ev).toContain('diagram_15_chart.puml:50');
    expect(ev).toContain('src/chart-notes.service.ts:558');
    expect(ev).toContain('Aún sin registrar');
    expect(ev).toContain('Toda la evidencia (2)');
  });

  it('sin tabla elegida la pestaña Evidencia enseña la guía de niveles', async () => {
    await open(`${SCREEN}?view=evidence`);
    flushSummary();
    const legend = section('portal-mutability-legend');
    expect(legend).toContain('Impuesto por la base');
    expect(legend).toContain('Sin evidencia');
    expect(legend).toContain('«No se sabe» no es lo mismo que «No»');
  });

  it('una tabla inexistente en la URL es un estado «no encontrado», no una pantalla en blanco', async () => {
    await open(`${SCREEN}?view=evidence&table=nada.nada`);
    flushSummary();
    http
      .expectOne('/admin/governance/mutability/nada/nada')
      .flush(
        { statusCode: 404, code: 'NOT_FOUND', message: 'no' },
        { status: 404, statusText: 'Not Found' },
      );
    harness.detectChanges();
    expect(section('portal-mutability-evidence')).toContain('No encontramos lo que busca');
  });

  it('sin permiso (403) el resumen dice que no tiene permiso, no una pantalla vacía', async () => {
    await open();
    http
      .expectOne(SUMMARY)
      .flush(
        { statusCode: 403, code: 'FORBIDDEN', message: 'no' },
        { status: 403, statusText: 'Forbidden' },
      );
    harness.detectChanges();
    expect(root().querySelector('[data-testid="portal-mutability"]')).toBeNull();
    expect(text()).toContain('No tiene acceso a esta sección');
  });
});

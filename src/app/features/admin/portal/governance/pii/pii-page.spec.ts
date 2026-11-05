import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { PiiPage } from './pii-page';

const SCREEN = '/superadmin/portal/governance/pii';
const SUMMARY = '/admin/catalog/pii/summary';
const COLUMNS = '/admin/catalog/pii/columns';
const RECONCILIATION = '/admin/catalog/pii/reconciliation';

const summary = (over: object = {}) => ({
  source: 'catalog_annotations + system_ops.field_registry',
  observedColumns: 900,
  classifiedColumns: 40,
  personalColumns: 12,
  objectsWithPersonalColumns: 5,
  bySensitivity: [
    {
      sensitivity: 'PHI_IDENTIFIER',
      columns: 3,
      approved: 2,
      needsReview: 1,
      autoDetected: 0,
      other: 0,
    },
    { sensitivity: 'PERSONAL', columns: 9, approved: 4, needsReview: 0, autoDetected: 5, other: 0 },
  ],
  declaredRegistry: { entities: 4, entitiesPersonal: 2, fields: 0, fieldsPersonal: 0 },
  notMeasured: [
    {
      field: 'declaredRegistry.fields',
      reason: 'system_ops.field_registry está vacío: nadie declaró campos.',
    },
    { field: 'dataValues', reason: 'El catálogo clasifica por nombre y tipo, no lee valores.' },
  ],
  ...over,
});

const column = (over: object = {}) => ({
  columnId: '00000000-0000-4000-8000-000000000001',
  objectId: '00000000-0000-4000-8000-000000000011',
  schemaName: 'iam',
  objectName: 'people',
  columnName: 'documento',
  nativeType: 'text',
  sensitivity: 'PHI_IDENTIFIER',
  reviewStatus: 'APPROVED',
  origin: 'MANUAL',
  approved: true,
  registryMarksPersonal: null,
  ...over,
});

const columnsPage = (items: object[]) => ({ items, nextCursor: null, limit: 50, sort: 'name' });

const reconciliation = (items: object[], over: object = {}) => ({
  summary: {
    approvedPersonalColumns: 6,
    declaredFields: 1,
    registryEmpty: false,
    byKind: { MISSING_IN_REGISTRY: 1, REGISTRY_DISAGREES: 0, ORPHAN_IN_REGISTRY: 1 },
    total: 2,
  },
  items,
  nextCursor: null,
  limit: 50,
  order: 'schema_name, object_name, column_name, kind',
  notMeasured: [
    { field: 'unapprovedColumns', reason: 'Sólo se concilian columnas con ficha aprobada.' },
  ],
  ...over,
});

describe('PiiPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function open(url = SCREEN): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/governance/pii', component: PiiPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, PiiPage);
  }

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = () => root().textContent ?? '';

  afterEach(() => http.verify());

  it('el resumen muestra lo que mide la API y NO pide los listados de las otras pestañas', async () => {
    await open();
    http.expectOne(SUMMARY).flush(summary());
    harness.detectChanges();
    http.expectNone((r) => r.url === COLUMNS || r.url === RECONCILIATION);
    expect(root().querySelector('[data-testid="portal-pii-metrics"]')!.textContent).toContain(
      '900',
    );
    const levels = root().querySelector('[data-testid="portal-pii-levels"]')!;
    expect(levels.textContent).toContain('Salud: identificador');
    expect(levels.textContent).toContain('Personal');
    expect(root().querySelector('[data-testid="portal-pii-registry"]')!.textContent).toContain(
      '2 marcadas como personales',
    );
  });

  it('lo que la API no pudo medir se dice, y un registro vacío no se presenta como «todo en orden»', async () => {
    await open();
    http.expectOne(SUMMARY).flush(summary());
    harness.detectChanges();
    const avisos = Array.from(
      root().querySelectorAll('[data-testid="portal-pii-not-measured"]'),
    ).map((e) => e.textContent ?? '');
    expect(avisos).toHaveLength(2);
    expect(avisos[0]).toContain('declaredRegistry.fields');
    expect(avisos[1]).toContain('no lee valores');
  });

  it('un fallo del resumen se dice como fallo y no lo cuenta como cero columnas', async () => {
    await open();
    http
      .expectOne(SUMMARY)
      .flush(
        { statusCode: 403, code: 'FORBIDDEN', message: 'Prohibido', error: 'Forbidden' },
        { status: 403, statusText: 'Forbidden' },
      );
    harness.detectChanges();
    expect(root().querySelector('[data-testid="portal-pii-metrics"]')).toBeNull();
    expect(text()).not.toContain('Ninguna columna está clasificada todavía');
  });

  it('las columnas muestran nivel, revisión, origen y qué dice el registro de gobierno', async () => {
    await open(`${SCREEN}?vista=columnas`);
    http.expectOne(SUMMARY).flush(summary());
    http
      .expectOne((r) => r.url === COLUMNS)
      .flush(
        columnsPage([
          column(),
          column({
            columnId: '00000000-0000-4000-8000-000000000002',
            columnName: 'edad',
            sensitivity: 'PERSONAL',
            reviewStatus: 'AUTO_DETECTED',
            origin: 'AUTO_CLASSIFIER',
            approved: false,
            registryMarksPersonal: false,
          }),
          column({
            columnId: '00000000-0000-4000-8000-000000000003',
            columnName: 'nombre',
            registryMarksPersonal: true,
          }),
        ]),
      );
    harness.detectChanges();
    const table = root().querySelector('[data-testid="portal-pii-table"]')!;
    expect(table.textContent).toContain('documento');
    expect(table.textContent).toContain('iam.people');
    expect(table.textContent).toContain('Salud: identificador');
    expect(table.textContent).toContain('Aprobada');
    expect(table.textContent).toContain('Clasificada automáticamente');
    // `null` es «no la declara», no «no es personal».
    expect(table.textContent).toContain('Registro de gobierno: no la declara');
    expect(table.textContent).toContain('declarada sin marca de datos personales');
    expect(table.textContent).toContain('declarada como personal');
  });

  it('manda los filtros de la URL y descarta un nivel, un estado o un esquema que la API rechazaría', async () => {
    await open(
      `${SCREEN}?vista=columnas&minSensitivity=PHI_IDENTIFIER&reviewStatus=APPROVED&schema=iam&q=doc`,
    );
    http.expectOne(SUMMARY).flush(summary());
    const req = http.expectOne((r) => r.url === COLUMNS);
    expect(req.request.params.get('minSensitivity')).toBe('PHI_IDENTIFIER');
    expect(req.request.params.get('reviewStatus')).toBe('APPROVED');
    expect(req.request.params.get('schema')).toBe('iam');
    expect(req.request.params.get('q')).toBe('doc');
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(columnsPage([]));
  });

  it('un nivel público o un esquema con caracteres raros no llegan a la API', async () => {
    await open(`${SCREEN}?vista=columnas&minSensitivity=PUBLIC&schema=a;b&reviewStatus=X`);
    http.expectOne(SUMMARY).flush(summary());
    const req = http.expectOne((r) => r.url === COLUMNS);
    expect(req.request.params.has('minSensitivity')).toBe(false);
    expect(req.request.params.has('schema')).toBe(false);
    expect(req.request.params.has('reviewStatus')).toBe(false);
    req.flush(columnsPage([]));
  });

  it('sin columnas explica por qué según lo que mide el resumen', async () => {
    await open(`${SCREEN}?vista=columnas`);
    http.expectOne(SUMMARY).flush(summary({ observedColumns: 900, personalColumns: 0 }));
    http.expectOne((r) => r.url === COLUMNS).flush(columnsPage([]));
    harness.detectChanges();
    expect(text()).toContain('El catálogo tiene 900 columnas observadas y ninguna clasificada');
    expect(text()).toContain('el catálogo no lee valores');
  });

  it('sin catálogo escaneado dice que falta un escaneo, no que no hay datos personales', async () => {
    await open(`${SCREEN}?vista=columnas`);
    http.expectOne(SUMMARY).flush(summary({ observedColumns: 0 }));
    http.expectOne((r) => r.url === COLUMNS).flush(columnsPage([]));
    harness.detectChanges();
    expect(text()).toContain('falta un escaneo');
  });

  it('la conciliación separa las clases y dice cuando el escaneo no observa un campo declarado', async () => {
    await open(`${SCREEN}?vista=conciliacion`);
    http.expectOne(SUMMARY).flush(summary());
    http
      .expectOne((r) => r.url === RECONCILIATION)
      .flush(
        reconciliation([
          {
            kind: 'MISSING_IN_REGISTRY',
            schemaName: 'iam',
            objectName: 'people',
            columnName: 'documento',
            objectId: 'o1',
            columnId: 'c1',
            sensitivity: 'PHI_IDENTIFIER',
            reviewStatus: 'APPROVED',
            entityRegistryId: null,
            fieldRegistryId: null,
          },
          {
            kind: 'ORPHAN_IN_REGISTRY',
            schemaName: 'clinical',
            objectName: 'patients',
            columnName: 'fecha_nacimiento',
            objectId: null,
            columnId: null,
            sensitivity: null,
            reviewStatus: null,
            entityRegistryId: 'e1',
            fieldRegistryId: 'f1',
          },
        ]),
      );
    harness.detectChanges();
    const table = root().querySelector('[data-testid="portal-pii-reconciliation-table"]')!;
    expect(table.textContent).toContain('Personal sin declarar');
    expect(table.textContent).toContain('Declarada y no observada');
    expect(table.textContent).toContain('El último escaneo no la observa');
    expect(table.textContent).toContain('Sin ficha en el catálogo');
    expect(
      root().querySelector('[data-testid="portal-pii-reconciliation-summary"]')!.textContent,
    ).toContain('Discrepancias');
    expect(text()).toContain('No medido (unapprovedColumns)');
  });

  it('la conciliación manda la clase y el esquema de la URL, y descarta una clase inventada', async () => {
    await open(`${SCREEN}?vista=conciliacion&kind=MISSING_IN_REGISTRY&schema=iam`);
    http.expectOne(SUMMARY).flush(summary());
    const req = http.expectOne((r) => r.url === RECONCILIATION);
    expect(req.request.params.get('kind')).toBe('MISSING_IN_REGISTRY');
    expect(req.request.params.get('schema')).toBe('iam');
    req.flush(reconciliation([]));
  });

  it('una clase inventada no llega a la API y, sin discrepancias, dice por qué no hay nada que conciliar', async () => {
    await open(`${SCREEN}?vista=conciliacion&kind=OTRA`);
    http.expectOne(SUMMARY).flush(summary());
    const req = http.expectOne((r) => r.url === RECONCILIATION);
    expect(req.request.params.has('kind')).toBe(false);
    req.flush(
      reconciliation([], {
        summary: {
          approvedPersonalColumns: 0,
          declaredFields: 0,
          registryEmpty: true,
          byKind: { MISSING_IN_REGISTRY: 0, REGISTRY_DISAGREES: 0, ORPHAN_IN_REGISTRY: 0 },
          total: 0,
        },
      }),
    );
    harness.detectChanges();
    expect(text()).toContain('no hay nada que conciliar');
  });
});

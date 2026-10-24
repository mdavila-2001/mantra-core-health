import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { AnnotationDialog } from './annotation-dialog';
import { CatalogObjectDetail } from './catalog-object-detail';

const FICHA = {
  id: 'a1',
  targetKind: 'OBJECT',
  version: 3,
  reviewStatus: 'NEEDS_REVIEW',
  origin: 'MANUAL',
  currentRevisionNo: 2,
  approvedRevisionNo: 1,
  approvedAt: '2026-09-17T10:00:00.000Z',
  approvalIsCurrent: false,
  updatedAt: '2026-09-18T10:00:00.000Z',
  content: {
    businessName: 'Cita',
    definition: null,
    purpose: 'Reserva de un horario de atención entre paciente y profesional.',
    existenceRationale: 'La agenda necesita saber qué horarios están tomados antes de ofrecerlos.',
    rowGrain: 'Una fila por reserva.',
    alternativesRationale: null,
    processSupported: null,
    sourceOfTruth: null,
    producers: [],
    consumers: [],
    deletionImpact: null,
    businessOwner: null,
    dataSteward: null,
    technicalOwner: null,
    unit: null,
    valueDomain: null,
    nullSemantics: null,
    sensitivity: 'UNKNOWN',
    openQuestions: [],
  },
};

const DETALLE = {
  id: 'o1',
  technical: {
    sourceCode: 'primary',
    schemaName: 'scheduling',
    objectName: 'appointments',
    objectKind: 'TABLE',
    comment: null,
    columnCount: 2,
    primaryKey: ['id'],
    statistics: { estimatedRows: '10', totalBytes: null, method: 'pg_class.reltuples', isEstimate: true, observedAt: null },
  },
  observation: { status: 'OBSERVED', lastSeenAt: null, notObservedSince: null, lastScanEngineVersion: '18.0' },
  annotation: FICHA,
  coverage: {
    technical: 'COMPLETE',
    semantic: 'COMPLETE',
    ownership: 'MISSING',
    sensitivity: 'UNKNOWN',
    review: 'NOT_APPROVED',
    missingFields: ['businessOwner', 'sensitivity'],
  },
  governance: null,
  evidenceCount: 1,
};

describe('CatalogObjectDetail', () => {
  let fixture: ComponentFixture<CatalogObjectDetail>;
  let http: HttpTestingController;
  const dialogs = { confirm: vi.fn(), confirmWithReason: vi.fn() };

  beforeEach(async () => {
    dialogs.confirm.mockReset();
    dialogs.confirmWithReason.mockReset();
    await TestBed.configureTestingModule({
      imports: [CatalogObjectDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DialogService, useValue: dialogs },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ objectId: 'o1' }) } } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CatalogObjectDetail);
    fixture.detectChanges();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  function responderCarga(
    detalle: object = DETALLE,
    extra: { columnas?: object[]; evidencia?: object[] } = {},
  ): void {
    http.expectOne('/admin/catalog/objects/o1').flush(detalle);
    http.expectOne('/admin/catalog/objects/o1/columns').flush({ objectId: 'o1', items: extra.columnas ?? [] });
    http.expectOne('/admin/catalog/objects/o1/evidence').flush(extra.evidencia ?? []);
    http.expectOne('/admin/catalog/objects/o1/history').flush({ revisions: [], decisions: [] });
    http.expectOne((r) => r.url === '/admin/catalog/objects/o1/changes').flush({ items: [], nextCursor: null, limit: 50 });
    http.expectOne((r) => r.url === '/admin/catalog/objects/o1/impact').flush({
      direction: 'downstream',
      maxDepth: 3,
      nodes: [{ objectId: 'o1', depth: 0, schemaName: 'scheduling', objectName: 'appointments', reviewStatus: null, owner: null }],
      edges: [],
      truncated: false,
      truncatedReason: null,
      scope: 'Sólo claves foráneas observadas.',
    });
    fixture.detectChanges();
  }

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('muestra la justificación, lo que falta y que la aprobación anterior ya no es la vigente', () => {
    responderCarga();
    expect(texto()).toContain('La agenda necesita saber qué horarios están tomados');
    expect(texto()).toContain('responsable, sensibilidad');
    expect(texto()).toContain('La revisión 1 estaba aprobada; la vigente todavía no.');
  });

  it('aprobar manda la revisión esperada y, si el servidor dice 403, explica la segregación', async () => {
    responderCarga();
    dialogs.confirm.mockResolvedValue(true);
    await (fixture.componentInstance as unknown as { revisar(d: string): Promise<void> }).revisar('APPROVED');
    const req = http.expectOne('/admin/catalog/annotations/a1/review');
    expect(req.request.body).toEqual({ decision: 'APPROVED', expectedRevisionNo: 2 });
    req.flush(
      { code: 'FORBIDDEN', message: 'x', details: { violations: [{ reason: 'SELF_REVIEW', message: 'x' }] } },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();
    expect(texto()).toContain('No puede revisar una revisión que escribió usted');
  });

  it('un 403 sin violación de segregación es un problema de rol, no de autoría', async () => {
    responderCarga();
    dialogs.confirm.mockResolvedValue(true);
    await (fixture.componentInstance as unknown as { revisar(d: string): Promise<void> }).revisar('APPROVED');
    http
      .expectOne('/admin/catalog/annotations/a1/review')
      .flush({ code: 'FORBIDDEN', message: 'x' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(texto()).toContain('Su rol no permite revisar fichas.');
    expect(texto()).not.toContain('escribió usted');
  });

  it('rechazar exige motivo y lo envía', async () => {
    responderCarga();
    dialogs.confirmWithReason.mockResolvedValue('Falta el responsable de negocio');
    await (fixture.componentInstance as unknown as { revisar(d: string): Promise<void> }).revisar('REJECTED');
    const req = http.expectOne('/admin/catalog/annotations/a1/review');
    expect(req.request.body).toEqual({ decision: 'REJECTED', expectedRevisionNo: 2, comment: 'Falta el responsable de negocio' });
    req.flush({ ...FICHA, reviewStatus: 'REJECTED' });
    // Tras la decisión la ficha se recarga desde el servidor: nada se da por hecho.
    responderCarga();
    expect(texto()).toContain('Ficha rechazada.');
  });

  it('cancelar el diálogo de rechazo no envía nada', async () => {
    responderCarga();
    dialogs.confirmWithReason.mockResolvedValue(null);
    await (fixture.componentInstance as unknown as { revisar(d: string): Promise<void> }).revisar('REJECTED');
    http.expectNone('/admin/catalog/annotations/a1/review');
  });

  it('si la evidencia no llega, no se afirma «Sin evidencia»: se dice el fallo y se puede releer', () => {
    http.expectOne('/admin/catalog/objects/o1').flush(DETALLE);
    http.expectOne('/admin/catalog/objects/o1/columns').flush({ objectId: 'o1', items: [] });
    http
      .expectOne('/admin/catalog/objects/o1/evidence')
      .flush(
        { code: 'INTERNAL', message: 'x', correlationId: 'corr-evi', timestamp: '', path: '' },
        { status: 500, statusText: 'Server Error' },
      );
    http.expectOne('/admin/catalog/objects/o1/history').flush({ revisions: [], decisions: [] });
    http.expectOne((r) => r.url === '/admin/catalog/objects/o1/changes').flush({ items: [], nextCursor: null, limit: 50 });
    http.match((r) => r.url === '/admin/catalog/objects/o1/impact').forEach((r) => r.flush(null));

    const c = fixture.componentInstance as unknown as {
      errorDeEvidencia: () => string | null;
      errorDeHistorial: () => string | null;
      leerEvidencia: () => void;
    };
    expect(c.errorDeEvidencia()).toBe(
      'No pudimos traer la evidencia de este objeto. (Código de soporte: corr-evi)',
    );
    expect(c.errorDeHistorial()).toBeNull();

    c.leerEvidencia();
    expect(c.errorDeEvidencia()).toBeNull();
    http.expectOne('/admin/catalog/objects/o1/evidence').flush([]);
  });

  describe('lo que aporta la bóveda', () => {
    const IMPORTADA = {
      ...DETALLE,
      annotation: {
        ...FICHA,
        reviewStatus: 'DRAFT',
        origin: 'IMPORTED_VAULT',
        currentRevisionNo: 1,
        approvedRevisionNo: null,
        approvalIsCurrent: false,
        content: {
          ...FICHA.content,
          businessName: null,
          definition: 'conditions es un registro central de negocio del módulo 08 · clinical.',
          purpose: 'Cuando un médico registra un diagnóstico, ese registro usa conditions.',
          existenceRationale: 'Si esta tabla se eliminara, el negocio perdería el registro mismo de la historia clínica.',
          rowGrain: null,
          openQuestions: [{ field: 'definition', question: 'Texto de plantilla generado por la bóveda: redactar qué es esta tabla.' }],
        },
      },
    };
    const abrirPestana = (i: number) => {
      (fixture.componentInstance as unknown as { pestana: { set(n: number): void } }).pestana.set(i);
      fixture.detectChanges();
    };
    const el = () => fixture.nativeElement as HTMLElement;

    it('una ficha importada lo dice, avisa que es plantilla y no ofrece aprobarla', () => {
      responderCarga(IMPORTADA);
      expect(el().querySelector('[data-testid="object-origin"]')!.textContent).toContain('Importado de la bóveda · pendiente de revisión');
      expect(el().querySelector('[data-testid="object-template-warning"]')!.textContent).toContain('no explica por qué existe');
      expect(el().querySelector('[data-testid="object-approve"]')).toBeNull();
    });

    it('una ficha escrita a mano no muestra ni el origen ni el aviso de plantilla', () => {
      responderCarga();
      expect(el().querySelector('[data-testid="object-origin"]')).toBeNull();
      expect(el().querySelector('[data-testid="object-template-warning"]')).toBeNull();
    });

    it('separa Negocio, Por qué existe y Sistema', () => {
      responderCarga(IMPORTADA, {
        evidencia: [
          { id: 'e1', kind: 'VAULT_NOTE', reference: 'SALUD/Entidades/E clinical.conditions.md', excerpt: 'La tabla declara 14 campos y 6 claves foráneas.', sourceRevision: 'sha256:3f9a' },
        ],
      });
      const t = texto();
      expect(t).toContain('Negocio');
      expect(t).toContain('Qué es');
      expect(t).toContain('conditions es un registro central de negocio');
      expect(t).toContain('Por qué existe');
      expect(t).toContain('Si esta tabla se eliminara');
      expect(t).toContain('Sistema');
      expect(el().querySelector('[data-testid="object-vault-system"]')!.textContent).toContain('La tabla declara 14 campos');
    });

    const COLUMNAS = [
      { id: 'c1', columnName: 'user_id', ordinal: 2, nativeType: 'uuid', isNullable: false, defaultExpression: null, isPrimaryKey: false, isUnique: false, foreignKey: { constraintName: 'fk', sourceColumns: ['user_id'], targetSchema: 'iam', targetTable: 'users', targetColumns: ['id'] }, comment: null, observationStatus: 'OBSERVED', annotation: null },
    ];
    const pulsarNota = () => {
      el().querySelector<HTMLButtonElement>('[data-testid="object-fk-note"]')!.click();
      fixture.detectChanges();
    };

    it('la nota de una clave foránea se lee al pedirla, una sola vez', () => {
      responderCarga(DETALLE, { columnas: COLUMNAS });
      abrirPestana(1);
      expect(el().querySelector('[data-testid="object-fk-note-text"]')).toBeNull();
      pulsarNota();
      http.expectOne('/admin/catalog/columns/c1/evidence').flush([
        { id: 'n1', kind: 'VAULT_NOTE', reference: 'SALUD/FK/FK x.md', excerpt: 'Apunta a → iam.users (convención · usuario)', sourceRevision: 'r', createdAt: '2026-10-17T10:00:00.000Z' },
      ]);
      fixture.detectChanges();
      expect(el().querySelector('[data-testid="object-fk-note-text"]')!.textContent).toContain('Apunta a → iam.users (convención · usuario)');
      pulsarNota();
      http.expectNone('/admin/catalog/columns/c1/evidence');
    });

    it('una clave sin nota en la bóveda lo dice', () => {
      responderCarga(DETALLE, { columnas: COLUMNAS });
      abrirPestana(1);
      pulsarNota();
      http.expectOne('/admin/catalog/columns/c1/evidence').flush([]);
      fixture.detectChanges();
      expect(el().querySelector('[data-testid="object-fk-note-text"]')!.textContent).toContain('La bóveda no tiene una nota de esta clave foránea');
    });

    it('si la lectura de la nota falla, no queda como si no hubiera nota', () => {
      responderCarga(DETALLE, { columnas: COLUMNAS });
      abrirPestana(1);
      pulsarNota();
      http.expectOne('/admin/catalog/columns/c1/evidence').flush({ code: 'INTERNAL' }, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(texto()).toContain('No pudimos leer la nota');
      expect(texto()).not.toContain('La bóveda no tiene una nota');
    });

    it('la pestaña de impacto ahora se llama «Relaciones» y aclara de dónde salen', () => {
      responderCarga();
      abrirPestana(4);
      expect(texto()).toContain('Relaciones');
      expect(texto()).toContain('claves foráneas observadas en la base');
      expect(texto()).toContain('No son relaciones de negocio declaradas');
    });
  });
});

describe('AnnotationDialog', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnotationDialog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  function abrir() {
    const fixture = TestBed.createComponent(AnnotationDialog);
    fixture.componentRef.setInput('objectId', 'o1');
    fixture.componentRef.setInput('technicalName', 'scheduling.appointments');
    fixture.componentRef.setInput('annotation', FICHA);
    fixture.detectChanges();
    return fixture;
  }

  it('envía la versión leída y los campos vacíos como null', () => {
    const fixture = abrir();
    (fixture.componentInstance as unknown as { guardar(): void }).guardar();
    const req = http.expectOne('/admin/catalog/objects/o1/annotation');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({ expectedVersion: 3, submit: true, businessOwner: null, businessName: 'Cita' });
    req.flush(FICHA);
  });

  it('un 409 conserva lo escrito y ofrece recargar, sin cerrar', () => {
    const fixture = abrir();
    let guardado = false;
    fixture.componentInstance.saved.subscribe(() => (guardado = true));
    (fixture.componentInstance as unknown as { guardar(): void }).guardar();
    http
      .expectOne('/admin/catalog/objects/o1/annotation')
      .flush({ code: 'CONCURRENCY_CONFLICT', message: 'x' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Otra persona cambió esta ficha');
    expect(el.textContent).toContain('Recargar la ficha');
    expect(guardado).toBe(false);
  });

  it('un 422 marca cada campo con el motivo del servidor', () => {
    const fixture = abrir();
    (fixture.componentInstance as unknown as { guardar(): void }).guardar();
    http.expectOne('/admin/catalog/objects/o1/annotation').flush(
      {
        code: 'VALIDATION_FAILED',
        message: 'La ficha no puede enviarse a revisión todavía',
        details: {
          violations: [
            { field: 'existenceRationale', reason: 'FILLER_TEXT:STORES_DATA', message: '"existenceRationale" no explica nada' },
            { field: 'rowGrain', reason: 'CODIGO_NUEVO', message: '"rowGrain" es ambiguo' },
          ],
        },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    // Se nombra el campo por su rótulo, nunca por la clave técnica.
    expect(texto).toContain('Por qué existe: No explica nada que el nombre técnico no diga ya.');
    expect(texto).toContain('Qué significa una fila: «Qué significa una fila» es ambiguo');
    expect(texto).not.toContain('existenceRationale');
  });
});

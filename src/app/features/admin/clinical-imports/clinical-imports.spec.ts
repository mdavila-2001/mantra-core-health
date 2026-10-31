import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type {
  ClinicalImportBatch,
  ClinicalImportCatalog,
  ClinicalImportReport,
} from '../../../core/data-access/admin-portal/clinical-imports.types';
import { FileDownloadService } from '../../../shared/utils/file-download/file-download.service';
import { ClinicalImports } from './clinical-imports';
import { CLINICAL_IMPORTS_PATH, CLINICAL_IMPORTS_ROUTES } from './clinical-imports.routes';

/**
 * Se monta con `RouterTestingHarness` y HTTP de verdad (el cliente real, un
 * controlador de pruebas por detrás): lo que se afirma es qué se pide, con qué
 * y qué se muestra con la respuesta. El backend es un doble declarado; la
 * prueba contra la API real sigue pendiente. Todo dato es sintético.
 */

const BASE = '/admin/clinical-imports';
const ID = '11111111-1111-4111-8111-111111111111';

const CATALOGO_CONECTADO: ClinicalImportCatalog = {
  kinds: [
    {
      kind: 'hc-alergia',
      version: '1',
      group: 'CLINICAL',
      title: 'Historia clínica · alergias',
      description: 'Alergias registradas en el origen.',
      target: 'clinical.allergy_intolerances',
      columnCount: 9,
      formats: ['csv', 'json'],
    },
    {
      kind: 'hc-nota',
      version: '1',
      group: 'CLINICAL',
      title: 'Historia clínica · notas',
      description: 'Notas clínicas.',
      target: 'chart.clinical_note_headers + chart.clinical_note_versions',
      columnCount: 12,
      formats: ['csv', 'json'],
    },
  ],
  limits: {
    maxBytes: 20971520,
    maxRows: 5000,
    maxPreviewIssues: 200,
    maxIdempotencyKeyLength: 128,
  },
  formats: ['csv', 'json'],
  engine: {
    persistence: { connected: true, adapter: 'doble' },
    writer: { connected: true, adapter: 'doble' },
    audit: { connected: true, adapter: 'doble' },
    resolvers: {
      patients: { connected: true, adapter: 'doble' },
      codes: { connected: true, adapter: 'doble' },
      practitioners: { connected: true, adapter: 'doble' },
    },
  },
};

const LOTE: ClinicalImportBatch = {
  id: ID,
  kind: 'hc-alergia',
  kindVersion: '1',
  group: 'CLINICAL',
  status: 'VALIDADO',
  createdAt: '2026-10-30T12:00:00.000Z',
  updatedAt: '2026-10-30T12:00:00.000Z',
  declaration: {
    sourceOrganization: 'Origen sintético',
    legalBasis: 'Convenio de ejemplo',
    loadedAt: '2026-10-30',
  },
  source: { format: 'csv', byteSize: 120 },
  counts: { total: 3, valid: 2, rejected: 1 },
  fileIssues: [],
  issues: {
    total: 1,
    truncated: false,
    items: [
      {
        row: 2,
        field: 'documentNumber',
        code: 'PATIENT_NOT_FOUND',
        message: 'No hay un paciente que coincida',
      },
    ],
  },
  progress: { processed: 0, total: 2 },
};

describe('ClinicalImports (Historias clínicas masivas)', () => {
  let harness: RouterTestingHarness;
  let componente: ClinicalImports;
  let http: HttpTestingController;
  let guardado: { blob: Blob; nombre: string } | null;

  async function montar(
    catalogo: ClinicalImportCatalog | { status: number } = CATALOGO_CONECTADO,
    lotes: ClinicalImportBatch[] = [],
  ) {
    guardado = null;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(CLINICAL_IMPORTS_ROUTES),
        {
          provide: FileDownloadService,
          useValue: { save: (blob: Blob, nombre: string) => (guardado = { blob, nombre }) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(`/${CLINICAL_IMPORTS_PATH}`, ClinicalImports);
    const pedidoCatalogo = http.expectOne(`${BASE}/catalog`);
    if ('status' in catalogo)
      pedidoCatalogo.flush(
        { code: 'FORBIDDEN', reason: 'ROLE_INSUFFICIENT' },
        { status: catalogo.status, statusText: 'x' },
      );
    else pedidoCatalogo.flush(catalogo);
    http.expectOne((r) => r.url === BASE && r.method === 'GET').flush(lotes);
    harness.detectChanges();
  }

  const interno = <T>(nombre: string): T => {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  };
  const llamar = (nombre: string, ...args: unknown[]) =>
    interno<(...a: unknown[]) => unknown>(nombre)(...args);
  const senal = <T>(nombre: string): T => interno<() => T>(nombre)();
  const escribirDeclaracion = (
    origen = 'Origen sintético',
    base = 'Convenio de ejemplo',
    fecha = '2026-10-30',
  ) => {
    llamar('escribir', 'sourceOrganization', origen);
    llamar('escribir', 'legalBasis', base);
    llamar('escribir', 'loadedAt', fecha);
  };
  const archivo = () =>
    new File(['documentNumber,birthDate\nSINT-0001,1990-01-15\n'], 'alergias.csv', {
      type: 'text/csv',
    });
  const texto = (): string => (harness.fixture.nativeElement as HTMLElement).textContent ?? '';
  const listas = (lotes: ClinicalImportBatch[]) =>
    http.match((r) => r.url === BASE && r.method === 'GET').forEach((r) => r.flush(lotes));
  const crear = (): TestRequest => http.expectOne((r) => r.url === BASE && r.method === 'POST');

  afterEach(() => http.verify());

  it('al entrar pide el catálogo y la lista, y ofrece los tipos que declara la API (no una lista escrita acá)', async () => {
    await montar();
    expect(senal<{ status: string }>('catalogo').status).toBe('ready');
    expect(senal<{ value: string }[]>('opcionesDeTipo').map((o) => o.value)).toEqual([
      'hc-alergia',
      'hc-nota',
    ]);
    expect(senal<{ kind: string } | null>('tipo')?.kind).toBe('hc-alergia');
    expect(texto()).toContain('Historias clínicas masivas');
    expect(texto()).toContain('Descargar plantilla CSV');
    expect(texto()).toContain('Descargar plantilla JSON');
  });

  it('dice lo que el motor NO hace cuando algo no está conectado', async () => {
    const sinConectar: ClinicalImportCatalog = {
      ...CATALOGO_CONECTADO,
      engine: {
        ...CATALOGO_CONECTADO.engine,
        writer: { connected: false, adapter: 'NotConnectedClinicalWriter' },
        resolvers: {
          ...CATALOGO_CONECTADO.engine.resolvers,
          patients: { connected: false, adapter: 'NotConnectedPatientResolver' },
        },
      },
    };
    await montar(sinConectar);
    const avisos = senal<string[]>('avisos');
    expect(avisos).toHaveLength(2);
    expect(avisos.join(' ')).toContain('NotConnectedClinicalWriter');
    expect(avisos.join(' ')).toContain('NotConnectedPatientResolver');
    expect(texto()).toContain('Lo que esta instalación todavía no hace');
  });

  it('sin permiso (403) no muestra la carga: muestra el estado «sin permiso»', async () => {
    await montar({ status: 403 });
    expect(senal<{ status: string }>('catalogo').status).toBe('forbidden');
    expect(texto()).not.toContain('Revisar archivo');
  });

  it('las plantillas CSV y JSON se piden con el tipo elegido y se entregan con el nombre del servidor', async () => {
    await montar();
    llamar('elegirTipo', 'hc-nota');
    llamar('descargarPlantilla', 'hc-nota', 'json');
    const req = http.expectOne((r) => r.url === `${BASE}/import-template`);
    expect([req.request.params.get('kind'), req.request.params.get('format')]).toEqual([
      'hc-nota',
      'json',
    ]);
    req.flush(new Blob(['{}']), {
      headers: { 'Content-Disposition': 'attachment; filename="plantilla-hc-nota-v1.json"' },
    });
    expect(guardado?.nombre).toBe('plantilla-hc-nota-v1.json');

    llamar('descargarPlantilla', 'hc-alergia', 'csv');
    http
      .expectOne((r) => r.url === `${BASE}/import-template`)
      .flush(new Blob(['a']), {
        headers: { 'Content-Disposition': 'attachment; filename="plantilla-hc-alergia-v1.csv"' },
      });
    expect(guardado?.nombre).toBe('plantilla-hc-alergia-v1.csv');
  });

  describe('sin la declaración no se revisa nada', () => {
    it('con la declaración vacía NO se manda ni el archivo, y cada campo dice qué falta', async () => {
      await montar();
      llamar('elegirArchivo', [archivo()]);
      llamar('revisar');
      http.expectNone((r) => r.url === BASE && r.method === 'POST');
      const errores = senal<Record<string, string | null>>('erroresDeDeclaracion');
      expect(errores['sourceOrganization']).toBeTruthy();
      expect(errores['legalBasis']).toBeTruthy();
      expect(errores['loadedAt']).toBeTruthy();
      expect(llamar('errorDe', 'legalBasis')).toBeTruthy();
    });

    it('una fecha futura o una base legal de dos letras tampoco pasan', async () => {
      await montar();
      llamar('elegirArchivo', [archivo()]);
      escribirDeclaracion('Origen', 'ab', '2999-01-01');
      llamar('revisar');
      http.expectNone((r) => r.url === BASE && r.method === 'POST');
      expect(senal<boolean>('declaracionLista')).toBe(false);
    });

    it('sin archivo dice que falta el archivo y no manda nada', async () => {
      await montar();
      escribirDeclaracion();
      llamar('revisar');
      http.expectNone((r) => r.url === BASE && r.method === 'POST');
      expect(senal<string | null>('errorDeArchivo')).toContain('archivo');
    });
  });

  describe('revisar → vista previa → confirmar → informe', () => {
    it('manda tipo, archivo y la declaración completa; y muestra los problemas por fila SIN valores', async () => {
      await montar();
      escribirDeclaracion();
      llamar('elegirArchivo', [archivo()]);
      llamar('revisar');
      const req = crear();
      const form = req.request.body as FormData;
      expect([
        form.get('kind'),
        form.get('sourceOrganization'),
        form.get('legalBasis'),
        form.get('loadedAt'),
      ]).toEqual(['hc-alergia', 'Origen sintético', 'Convenio de ejemplo', '2026-10-30']);
      expect(req.request.url).not.toMatch(/SINT|1990/);
      req.flush(LOTE, { status: 201, statusText: 'Created' });
      listas([LOTE]);
      harness.detectChanges();

      expect(senal<ClinicalImportBatch | null>('lote')?.status).toBe('VALIDADO');
      const hallazgos = senal<{
        status: string;
        data: { fila: number; columna: string; motivo: string }[];
      }>('hallazgos');
      expect(hallazgos.status).toBe('ready');
      expect(hallazgos.data).toEqual([
        expect.objectContaining({
          fila: 2,
          columna: 'documentNumber',
          motivo: 'Paciente no encontrado',
        }),
      ]);
      expect(texto()).toContain('Confirmar y procesar 2 filas');
      expect(texto()).not.toContain('SINT-0001');
    });

    it('si la API objeta un campo de la declaración, queda anclado a ese campo', async () => {
      await montar();
      escribirDeclaracion();
      llamar('elegirArchivo', [archivo()]);
      llamar('revisar');
      crear().flush(
        {
          code: 'VALIDATION_FAILED',
          reason: 'DECLARATION_INVALID',
          details: { field: 'legalBasis' },
        },
        { status: 400, statusText: 'Bad Request' },
      );
      expect(llamar('errorDe', 'legalBasis')).toBeTruthy();
      expect(senal<boolean>('revisando')).toBe(false);
      // Lo escrito se conserva.
      expect(senal<string>('baseLegal')).toBe('Convenio de ejemplo');
      expect(senal<File[]>('archivos')).toHaveLength(1);
    });

    it('un lote rechazado no ofrece confirmar', async () => {
      await montar();
      escribirDeclaracion();
      llamar('elegirArchivo', [archivo()]);
      llamar('revisar');
      const rechazado = {
        ...LOTE,
        status: 'RECHAZADO' as const,
        counts: { total: 3, valid: 0, rejected: 3 },
      };
      crear().flush(rechazado, { status: 201, statusText: 'Created' });
      listas([rechazado]);
      http
        .expectOne((r) => r.url === `${BASE}/${ID}/report`)
        .flush({
          batchId: ID,
          kind: 'hc-alergia',
          status: 'RECHAZADO',
          generatedAt: '2026-10-30T12:00:00Z',
          totals: { total: 3, RECHAZADA: 3 },
          fileIssues: [],
          rows: [],
        });
      harness.detectChanges();
      expect(texto()).toContain('Este lote no se puede confirmar');
      expect(texto()).not.toContain('Confirmar y procesar');
    });

    it('confirmar manda UNA confirmación con Idempotency-Key aunque se pulse dos veces', async () => {
      await montar(CATALOGO_CONECTADO, [LOTE]);
      llamar('abrirLote', LOTE);
      http.expectOne((r) => r.url === `${BASE}/${ID}` && r.method === 'GET').flush(LOTE);
      listas([LOTE]);

      llamar('confirmar');
      llamar('confirmar');
      const req = http.expectOne(`${BASE}/${ID}/confirm`);
      expect(req.request.headers.get('Idempotency-Key')).toBeTruthy();
      req.flush({ ...LOTE, status: 'EN_COLA' }, { status: 202, statusText: 'Accepted' });
      listas([LOTE]);
      expect(senal<ClinicalImportBatch | null>('lote')?.status).toBe('EN_COLA');
      expect(senal<boolean>('confirmando')).toBe(false);
    });

    it('un lote COMPLETADO muestra el informe, lo cargado y la verdad: lo creado es lo que dice el informe', async () => {
      const completado: ClinicalImportBatch = {
        ...LOTE,
        status: 'COMPLETADO',
        progress: { processed: 2, total: 2 },
      };
      await montar(CATALOGO_CONECTADO, [completado]);
      llamar('abrirLote', completado);
      http.expectOne((r) => r.url === `${BASE}/${ID}` && r.method === 'GET').flush(completado);
      const informe: ClinicalImportReport = {
        batchId: ID,
        kind: 'hc-alergia',
        status: 'COMPLETADO',
        generatedAt: '2026-10-30T12:05:00Z',
        totals: { total: 3, CREADA: 0, OMITIDA: 2, RECHAZADA: 1 },
        fileIssues: [],
        rows: [
          { row: 1, outcome: 'OMITIDA', reason: 'ALREADY_LOADED', message: 'Ya existía' },
          {
            row: 2,
            outcome: 'RECHAZADA',
            reason: 'PATIENT_NOT_FOUND',
            field: 'documentNumber',
            message: 'x',
          },
          { row: 3, outcome: 'OMITIDA', reason: 'ALREADY_LOADED', message: 'Ya existía' },
        ],
      };
      for (const req of http.match((r) => r.url === `${BASE}/${ID}/report`)) req.flush(informe);
      for (const req of http.match((r) => r.url === `${BASE}/${ID}/loaded`))
        req.flush({ batchId: ID, records: [] });
      for (const req of http.match((r) => r.url === BASE && r.method === 'GET'))
        req.flush([completado]);
      harness.detectChanges();

      expect(texto()).toContain('ninguna se agregó a una historia clínica');
      expect(texto()).toContain('No se agregó nada a ninguna historia clínica');
      expect(texto()).toContain('Este lote no agregó ningún registro');
    });

    it('un lote FALLIDO dice por qué se cortó y que lo ya agregado se queda', async () => {
      const fallido: ClinicalImportBatch = {
        ...LOTE,
        status: 'FALLIDO',
        failureReason: 'AUDIT_UNAVAILABLE',
      };
      await montar(CATALOGO_CONECTADO, [fallido]);
      llamar('abrirLote', fallido);
      http.expectOne((r) => r.url === `${BASE}/${ID}` && r.method === 'GET').flush(fallido);
      http
        .match((r) => r.url === `${BASE}/${ID}/report`)
        .forEach((r) => r.flush({ code: 'x' }, { status: 500, statusText: 'x' }));
      http
        .match((r) => r.url === `${BASE}/${ID}/loaded`)
        .forEach((r) => r.flush({ code: 'x' }, { status: 500, statusText: 'x' }));
      http.match((r) => r.url === BASE && r.method === 'GET').forEach((r) => r.flush([fallido]));
      harness.detectChanges();
      expect(texto()).toContain('El lote no pudo terminar');
      expect(texto()).toContain('No se pudo dejar el rastro de auditoría');
    });

    it('un lote de otra organización (404) lo dice sin ofrecer nada más', async () => {
      await montar(CATALOGO_CONECTADO, [LOTE]);
      llamar('abrirLote', LOTE);
      http
        .expectOne((r) => r.url === `${BASE}/${ID}` && r.method === 'GET')
        .flush(
          { code: 'NOT_FOUND', reason: 'BATCH_NOT_AVAILABLE' },
          { status: 404, statusText: 'Not Found' },
        );
      http.match((r) => r.url === BASE && r.method === 'GET').forEach((r) => r.flush([LOTE]));
      expect(senal<{ titulo: string } | null>('falloDelLote')?.titulo).toBe(
        'No encontramos ese lote',
      );
    });
  });

  it('la lista de lotes vacía orienta: dice por qué está vacía y qué hacer', async () => {
    await montar(CATALOGO_CONECTADO, []);
    const filas = senal<{ status: string; message?: string }>('filasDeLotes');
    expect(filas.status).toBe('empty');
    expect(JSON.stringify(filas)).toContain('Nueva carga');
  });
});

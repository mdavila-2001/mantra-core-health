import { HttpHeaders } from '@angular/common/http';

import type {
  ClinicalImportBatch,
  ClinicalImportCatalog,
  ClinicalImportLoaded,
  ClinicalImportReport,
} from '../../data-access/admin-portal/clinical-imports.types';
import { MockRouter, isMockReply, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import {
  LIMITES_CLINICOS_SIMULADOS,
  MOTOR_CLINICO_SIMULADO,
  MOTOR_CLINICO_SIN_CONECTAR,
  registrarCargasClinicas,
} from './clinical-imports.handlers';
import { KIND_SPECS } from './clinical-imports.schema';
import { buildTemplate } from './clinical-imports.template';
import type { ClinicalImportEngineStatus } from '../../data-access/admin-portal/clinical-imports.types';

/* Todo lo que cargan estas pruebas es sintético y está declarado: documentos
   `SINT-…`, códigos `SINT-…`. Ninguna fila es de una persona. */

describe('carga masiva de historias clínicas demo: mismas reglas que /admin/clinical-imports', () => {
  const admin = buscarUsuario('superadmin')!;
  const paciente = buscarUsuario('paciente')!;
  const medica = buscarUsuario('medica')!;

  function montar(motor?: ClinicalImportEngineStatus) {
    const router = new MockRouter();
    registrarCargasClinicas(router, motor);
    async function pedir(
      method: MockMethod,
      path: string,
      opciones: {
        query?: Record<string, string>;
        body?: unknown;
        headers?: Record<string, string>;
        user?: typeof admin | null;
      } = {},
    ): Promise<MockReply> {
      const match = router.match(method, path);
      if (match === null) throw new Error(`No existe ${method} ${path}`);
      const resultado = await match.handler({
        method,
        path,
        params: match.params,
        query: new URLSearchParams(opciones.query ?? {}),
        body: opciones.body ?? null,
        headers: new HttpHeaders(opciones.headers ?? {}),
        user: opciones.user === undefined ? admin : opciones.user,
      });
      return isMockReply(resultado) ? resultado : { status: 200, body: resultado };
    }
    return { pedir };
  }

  const DECLARACION = {
    sourceOrganization: 'SIMULADO · origen',
    legalBasis: 'SIMULADO · base legal',
    loadedAt: '2026-01-10',
  };
  const HEADER = 'documentNumber,birthDate,sourceRecordId,substanceSystem,substanceCode';
  const alergia = (...filas: [string, string, string][]) =>
    [HEADER, ...filas.map(([doc, nac, id]) => `${doc},${nac},${id},sistema-demo,SINT-0001`)].join(
      '\n',
    );
  const formulario = (
    campos: Record<string, string>,
    contenido: string,
    nombre = 'carga.csv',
  ): FormData => {
    const form = new FormData();
    form.append('file', new File([contenido], nombre));
    for (const [clave, valor] of Object.entries(campos)) form.append(clave, valor);
    return form;
  };
  const cuerpo = <T>(r: MockReply) => r.body as T;
  const razon = (r: MockReply) => (r.body as { reason?: string }).reason;

  type Pedir = ReturnType<typeof montar>['pedir'];
  const subir = (
    pedir: Pedir,
    contenido: string,
    extra: Record<string, string> = {},
    headers: Record<string, string> = {},
  ) =>
    pedir('POST', '/admin/clinical-imports', {
      body: formulario({ kind: 'hc-alergia', ...DECLARACION, ...extra }, contenido),
      headers,
    });
  async function correrHastaTerminar(
    pedir: Pedir,
    contenido: string,
    clave: string,
    headers: Record<string, string> = {},
  ) {
    const lote = cuerpo<ClinicalImportBatch>(await subir(pedir, contenido, {}, headers));
    await pedir('POST', `/admin/clinical-imports/${lote.id}/confirm`, {
      headers: { ...headers, 'Idempotency-Key': clave },
    });
    for (let i = 0; i < 3; i++)
      await pedir('GET', `/admin/clinical-imports/${lote.id}`, { headers });
    const informe = cuerpo<ClinicalImportReport>(
      await pedir('GET', `/admin/clinical-imports/${lote.id}/report`, { headers }),
    );
    return { lote, informe };
  }

  describe('catálogo y plantillas (regla T1)', () => {
    it('lista los siete tipos pedidos, los topes de la API y el estado del motor', async () => {
      const { pedir } = montar();
      const catalogo = cuerpo<ClinicalImportCatalog>(
        await pedir('GET', '/admin/clinical-imports/catalog'),
      );
      expect(catalogo.kinds.map((k) => k.kind)).toEqual([
        'hc-encuentro',
        'hc-diagnostico',
        'hc-medicacion',
        'hc-alergia',
        'hc-signo-vital',
        'hc-resultado',
        'hc-nota',
      ]);
      expect(catalogo.kinds.every((k) => k.formats.join() === 'csv,json')).toBe(true);
      expect(catalogo.limits).toEqual(LIMITES_CLINICOS_SIMULADOS);
      expect(catalogo.engine).toEqual(MOTOR_CLINICO_SIMULADO);
    });

    it('cada tipo entrega su plantilla CSV y JSON con nombre y tipo de archivo, del mismo esquema', async () => {
      const { pedir } = montar();
      for (const spec of KIND_SPECS) {
        const csv = await pedir('GET', '/admin/clinical-imports/import-template', {
          query: { kind: spec.kind },
        });
        expect(csv.headers?.['Content-Disposition']).toBe(
          `attachment; filename="plantilla-${spec.kind}-v1.csv"`,
        );
        expect(csv.headers?.['Content-Type']).toContain('text/csv');
        expect((csv.body as string).split('\n')[0]).toBe(spec.columns.map((c) => c.name).join(','));

        const json = await pedir('GET', '/admin/clinical-imports/import-template', {
          query: { kind: spec.kind, format: 'json' },
        });
        expect(json.headers?.['Content-Disposition']).toBe(
          `attachment; filename="plantilla-${spec.kind}-v1.json"`,
        );
        expect(json.body).toBe(buildTemplate(spec.kind, 'json')!.content);
      }
    });

    it('formato inválido 400, tipo desconocido 404', async () => {
      const { pedir } = montar();
      expect(
        razon(
          await pedir('GET', '/admin/clinical-imports/import-template', {
            query: { kind: 'hc-nota', format: 'xlsx' },
          }),
        ),
      ).toBe('FORMAT_UNSUPPORTED');
      const r = await pedir('GET', '/admin/clinical-imports/import-template', {
        query: { kind: 'nada' },
      });
      expect([r.status, razon(r)]).toEqual([404, 'KIND_UNKNOWN']);
    });

    it('subir la propia plantilla (CSV y JSON) pasa la vista previa: la fila de ejemplo es de un paciente sintético del padrón de la maqueta', async () => {
      const { pedir } = montar();
      for (const spec of KIND_SPECS) {
        for (const formato of ['csv', 'json'] as const) {
          const archivo = buildTemplate(spec.kind, formato)!;
          const r = await pedir('POST', '/admin/clinical-imports', {
            body: formulario(
              { kind: spec.kind, ...DECLARACION },
              archivo.content,
              archivo.fileName,
            ),
          });
          const lote = cuerpo<ClinicalImportBatch>(r);
          expect([spec.kind, formato, lote.status, lote.fileIssues, lote.issues.items]).toEqual([
            spec.kind,
            formato,
            'VALIDADO',
            [],
            [],
          ]);
          expect(lote.source.format).toBe(formato);
        }
      }
    });

    it('la misma plantilla contra la API real (colaboradores sin conectar) NO se adivina: RECHAZADO por RESOLUTION_UNAVAILABLE', async () => {
      const { pedir } = montar(MOTOR_CLINICO_SIN_CONECTAR);
      const archivo = buildTemplate('hc-nota', 'csv')!;
      const lote = cuerpo<ClinicalImportBatch>(
        await pedir('POST', '/admin/clinical-imports', {
          body: formulario({ kind: 'hc-nota', ...DECLARACION }, archivo.content),
        }),
      );
      expect(lote.status).toBe('RECHAZADO');
      expect(lote.issues.items.map((i) => i.code)).toEqual(['RESOLUTION_UNAVAILABLE']);
    });
  });

  describe('autorización', () => {
    const rutas: [MockMethod, string][] = [
      ['GET', '/admin/clinical-imports/catalog'],
      ['GET', '/admin/clinical-imports/import-template'],
      ['GET', '/admin/clinical-imports'],
      ['POST', '/admin/clinical-imports'],
      ['POST', '/admin/clinical-imports/x/confirm'],
      ['GET', '/admin/clinical-imports/x'],
      ['GET', '/admin/clinical-imports/x/report'],
      ['GET', '/admin/clinical-imports/x/loaded'],
    ];

    it('sin sesión 401 y con un rol sin permiso 403, en todas las rutas', async () => {
      const { pedir } = montar();
      for (const [metodo, ruta] of rutas) {
        expect((await pedir(metodo, ruta, { user: null })).status).toBe(401);
        expect((await pedir(metodo, ruta, { user: paciente })).status).toBe(403);
        expect((await pedir(metodo, ruta, { user: medica })).status).toBe(403);
      }
    });
  });

  describe('vista previa: sólo pacientes existentes con coincidencia única', () => {
    it('coincidencia única: VALIDADO y no se creó nada', async () => {
      const { pedir } = montar();
      const r = await subir(
        pedir,
        alergia(['SINT-0001', '1990-01-15', 'O-1'], ['SINT-0002', '1985-03-02', 'O-2']),
      );
      expect(r.status).toBe(201);
      const lote = cuerpo<ClinicalImportBatch>(r);
      expect(lote.status).toBe('VALIDADO');
      expect(lote.counts).toEqual({ total: 2, valid: 2, rejected: 0 });
      expect(lote.declaration).toEqual({ ...DECLARACION });
    });

    it('0 coincidencias, otra fecha, ambiguo y consentimiento revocado: rechazo con motivo y SIN datos', async () => {
      const { pedir } = montar();
      const lote = cuerpo<ClinicalImportBatch>(
        await subir(
          pedir,
          alergia(
            ['SINT-9999', '1990-01-15', 'O-1'],
            ['SINT-0001', '2000-01-01', 'O-2'],
            ['SINT-0003', '1970-07-07', 'O-3'],
            ['SINT-0004', '1999-09-09', 'O-4'],
            ['SINT-0001', '1990-01-15', 'O-5'],
          ),
        ),
      );
      expect(lote.counts).toEqual({ total: 5, valid: 1, rejected: 4 });
      expect(lote.issues.items.map((i) => [i.row, i.code])).toEqual([
        [1, 'PATIENT_NOT_FOUND'],
        [2, 'PATIENT_NOT_FOUND'],
        [3, 'PATIENT_AMBIGUOUS'],
        [4, 'CONSENT_REVOKED'],
      ]);
      const texto = JSON.stringify(lote);
      for (const dato of [
        'SINT-9999',
        'SINT-0003',
        'SINT-0004',
        '1970-07-07',
        '1999-09-09',
        'paciente-sintetico',
      ]) {
        expect(texto).not.toContain(dato);
      }
    });

    it('un código que no existe en la terminología rechaza la fila', async () => {
      const { pedir } = montar();
      const contenido = `${HEADER}\nSINT-0001,1990-01-15,O-1,sistema-demo,SINT-0099`;
      const lote = cuerpo<ClinicalImportBatch>(await subir(pedir, contenido));
      expect(lote.status).toBe('RECHAZADO');
      expect(lote.issues.items[0]).toMatchObject({
        field: 'substanceCode',
        code: 'CODE_NOT_FOUND',
      });
    });

    it('con la API tal como queda hoy (colaboradores sin conectar) nada se adivina: todo RESOLUTION_UNAVAILABLE', async () => {
      const { pedir } = montar(MOTOR_CLINICO_SIN_CONECTAR);
      const lote = cuerpo<ClinicalImportBatch>(
        await subir(pedir, alergia(['SINT-0001', '1990-01-15', 'O-1'])),
      );
      expect(lote.status).toBe('RECHAZADO');
      expect(lote.issues.items[0]?.code).toBe('RESOLUTION_UNAVAILABLE');
    });

    it('archivo con columna ajena: RECHAZADO con el motivo del archivo', async () => {
      const { pedir } = montar();
      const lote = cuerpo<ClinicalImportBatch>(
        await subir(pedir, `${HEADER},ajena\nSINT-0001,1990-01-15,O-1,sistema-demo,SINT-0001,x`),
      );
      expect(lote.status).toBe('RECHAZADO');
      expect(lote.fileIssues.map((i) => i.code)).toContain('UNKNOWN_FIELD');
    });
  });

  describe('declaración de origen, base legal y fecha', () => {
    it.each([
      ['sin origen', { sourceOrganization: '' }, 'sourceOrganization'],
      ['sin base legal', { legalBasis: '' }, 'legalBasis'],
      ['sin fecha', { loadedAt: '' }, 'loadedAt'],
      ['fecha futura', { loadedAt: '2999-01-01' }, 'loadedAt'],
    ])(
      '%s: 400 DECLARATION_INVALID con el campo, y no se crea ningún lote nuevo',
      async (_caso, cambio, campoEsperado) => {
        const { pedir } = montar();
        const antes = cuerpo<ClinicalImportBatch[]>(
          await pedir('GET', '/admin/clinical-imports'),
        ).length;
        const r = await subir(pedir, alergia(['SINT-0001', '1990-01-15', 'O-1']), cambio);
        expect([r.status, razon(r)]).toEqual([400, 'DECLARATION_INVALID']);
        expect((r.body as { details: { field: string } }).details.field).toBe(campoEsperado);
        expect(
          cuerpo<ClinicalImportBatch[]>(await pedir('GET', '/admin/clinical-imports')),
        ).toHaveLength(antes);
      },
    );
  });

  describe('confirmar y procesar: idempotente, y sólo agrega', () => {
    it('la misma clave devuelve el lote como está; otra clave sobre el mismo lote es 409', async () => {
      const { pedir } = montar();
      const lote = cuerpo<ClinicalImportBatch>(
        await subir(pedir, alergia(['SINT-0001', '1990-01-15', 'O-1'])),
      );
      const a = await pedir('POST', `/admin/clinical-imports/${lote.id}/confirm`, {
        headers: { 'Idempotency-Key': 'clave-1' },
      });
      const b = await pedir('POST', `/admin/clinical-imports/${lote.id}/confirm`, {
        headers: { 'Idempotency-Key': 'clave-1' },
      });
      expect([a.status, b.status]).toEqual([202, 202]);
      expect(cuerpo<ClinicalImportBatch>(b).status).toBe('EN_COLA');
      const c = await pedir('POST', `/admin/clinical-imports/${lote.id}/confirm`, {
        headers: { 'Idempotency-Key': 'clave-2' },
      });
      expect([c.status, razon(c)]).toEqual([409, 'BATCH_ALREADY_CONFIRMED']);
    });

    it('sin clave 400; con un lote RECHAZADO 409; la misma clave en otro lote 409', async () => {
      const { pedir } = montar();
      const uno = cuerpo<ClinicalImportBatch>(
        await subir(pedir, alergia(['SINT-0001', '1990-01-15', 'O-1'])),
      );
      const dos = cuerpo<ClinicalImportBatch>(
        await subir(pedir, alergia(['SINT-0002', '1985-03-02', 'O-2'])),
      );
      const malo = cuerpo<ClinicalImportBatch>(
        await subir(pedir, alergia(['SINT-9999', '1990-01-15', 'O-3'])),
      );
      expect(razon(await pedir('POST', `/admin/clinical-imports/${uno.id}/confirm`))).toBe(
        'IDEMPOTENCY_KEY_REQUIRED',
      );
      expect(
        razon(
          await pedir('POST', `/admin/clinical-imports/${malo.id}/confirm`, {
            headers: { 'Idempotency-Key': 'k-9' },
          }),
        ),
      ).toBe('BATCH_NOT_CONFIRMABLE');
      await pedir('POST', `/admin/clinical-imports/${uno.id}/confirm`, {
        headers: { 'Idempotency-Key': 'k-1' },
      });
      expect(
        razon(
          await pedir('POST', `/admin/clinical-imports/${dos.id}/confirm`, {
            headers: { 'Idempotency-Key': 'k-1' },
          }),
        ),
      ).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('el procesamiento avanza EN_COLA → PROCESANDO → COMPLETADO y no hay informe antes', async () => {
      const { pedir } = montar();
      const lote = cuerpo<ClinicalImportBatch>(
        await subir(
          pedir,
          alergia(['SINT-0001', '1990-01-15', 'O-1'], ['SINT-0002', '1985-03-02', 'O-2']),
        ),
      );
      expect(razon(await pedir('GET', `/admin/clinical-imports/${lote.id}/report`))).toBe(
        'REPORT_NOT_READY',
      );
      await pedir('POST', `/admin/clinical-imports/${lote.id}/confirm`, {
        headers: { 'Idempotency-Key': 'k-1' },
      });
      const estados: string[] = [];
      for (let i = 0; i < 3; i++)
        estados.push(
          cuerpo<ClinicalImportBatch>(await pedir('GET', `/admin/clinical-imports/${lote.id}`))
            .status,
        );
      expect(estados).toEqual(['PROCESANDO', 'COMPLETADO', 'COMPLETADO']);
    });

    it('la segunda corrida del mismo archivo no inserta: OMITIDA, y el informe no repite datos', async () => {
      const { pedir } = montar();
      const archivo = alergia(
        ['SINT-0001', '1990-01-15', 'O-1'],
        ['SINT-0002', '1985-03-02', 'O-2'],
      );
      const primera = await correrHastaTerminar(pedir, archivo, 'k-1');
      expect(primera.informe.totals).toMatchObject({ total: 2, CREADA: 2, OMITIDA: 0 });
      const segunda = await correrHastaTerminar(pedir, archivo, 'k-2');
      expect(segunda.informe.totals).toMatchObject({ total: 2, CREADA: 0, OMITIDA: 2 });
      expect(segunda.informe.rows.every((r) => r.reason === 'ALREADY_LOADED')).toBe(true);
      const cargado = cuerpo<ClinicalImportLoaded>(
        await pedir('GET', `/admin/clinical-imports/${segunda.lote.id}/loaded`),
      );
      expect(cargado.records).toEqual([]);
      for (const salida of [JSON.stringify(primera.informe), JSON.stringify(segunda.informe)]) {
        for (const dato of ['SINT-0001', '1990-01-15', 'O-1', 'sistema-demo'])
          expect(salida).not.toContain(dato);
      }
    });

    it('el mismo registro de origen con otro contenido es CONFLICTO y no se sobrescribe', async () => {
      const { pedir } = montar();
      await correrHastaTerminar(pedir, alergia(['SINT-0001', '1990-01-15', 'O-1']), 'k-1');
      const cambiado = `${HEADER}\nSINT-0001,1990-01-15,O-1,sistema-demo,SINT-0002`;
      const segunda = await correrHastaTerminar(pedir, cambiado, 'k-2');
      expect(segunda.informe.totals).toMatchObject({ CREADA: 0, CONFLICTO: 1 });
      const tercera = await correrHastaTerminar(
        pedir,
        alergia(['SINT-0001', '1990-01-15', 'O-1']),
        'k-3',
      );
      expect(tercera.informe.totals).toMatchObject({ CREADA: 0, OMITIDA: 1 });
    });

    it('lo cargado lista sólo identificadores', async () => {
      const { pedir } = montar();
      const { lote } = await correrHastaTerminar(
        pedir,
        alergia(['SINT-0001', '1990-01-15', 'O-1']),
        'k-1',
      );
      const cargado = cuerpo<ClinicalImportLoaded>(
        await pedir('GET', `/admin/clinical-imports/${lote.id}/loaded`),
      );
      expect(cargado.records).toHaveLength(1);
      expect(Object.keys(cargado.records[0]!).sort()).toEqual([
        'entity',
        'kind',
        'row',
        'targetId',
      ]);
    });

    it('con el escritor sin conectar las filas válidas quedan FALLIDA y no se crea nada', async () => {
      const { pedir } = montar({
        ...MOTOR_CLINICO_SIMULADO,
        writer: { connected: false, adapter: 'NotConnectedClinicalWriter' },
      });
      const { informe } = await correrHastaTerminar(
        pedir,
        alergia(['SINT-0001', '1990-01-15', 'O-1']),
        'k-1',
      );
      expect(informe.totals).toMatchObject({ CREADA: 0, FALLIDA: 1 });
    });

    it('el informe baja como CSV con el nombre del lote', async () => {
      const { pedir } = montar();
      const { lote } = await correrHastaTerminar(
        pedir,
        alergia(['SINT-0001', '1990-01-15', 'O-1']),
        'k-1',
      );
      const csv = await pedir('GET', `/admin/clinical-imports/${lote.id}/report`, {
        query: { format: 'csv' },
      });
      expect(csv.headers?.['Content-Disposition']).toBe(
        `attachment; filename="informe-${lote.id}.csv"`,
      );
      expect((csv.body as string).split('\n')[0]).toBe('row,outcome,reason,field,message');
    });
  });

  describe('aislamiento entre organizaciones', () => {
    it('otra organización ve 404 en todo y su lista no incluye el lote ajeno', async () => {
      const { pedir } = montar();
      const A = { 'X-Tenant-Id': 'org-a' };
      const B = { 'X-Tenant-Id': 'org-b' };
      const lote = cuerpo<ClinicalImportBatch>(
        await subir(pedir, alergia(['SINT-0001', '1990-01-15', 'O-1']), {}, A),
      );
      for (const [metodo, ruta] of [
        ['GET', `/admin/clinical-imports/${lote.id}`],
        ['POST', `/admin/clinical-imports/${lote.id}/confirm`],
        ['GET', `/admin/clinical-imports/${lote.id}/report`],
        ['GET', `/admin/clinical-imports/${lote.id}/loaded`],
      ] as [MockMethod, string][]) {
        const r = await pedir(metodo, ruta, { headers: { ...B, 'Idempotency-Key': 'k-1' } });
        expect([r.status, razon(r)]).toEqual([404, 'BATCH_NOT_AVAILABLE']);
      }
      expect(
        cuerpo<ClinicalImportBatch[]>(
          await pedir('GET', '/admin/clinical-imports', { headers: B }),
        ),
      ).toEqual([]);
      expect(
        cuerpo<ClinicalImportBatch[]>(
          await pedir('GET', '/admin/clinical-imports', { headers: A }),
        ),
      ).toHaveLength(1);
    });

    it('la misma clave de confirmación en otra organización no choca', async () => {
      const { pedir } = montar();
      for (const org of ['org-a', 'org-b']) {
        const h = { 'X-Tenant-Id': org };
        const lote = cuerpo<ClinicalImportBatch>(
          await subir(pedir, alergia(['SINT-0001', '1990-01-15', 'O-1']), {}, h),
        );
        const r = await pedir('POST', `/admin/clinical-imports/${lote.id}/confirm`, {
          headers: { ...h, 'Idempotency-Key': 'clave-igual' },
        });
        expect(r.status).toBe(202);
      }
    });
  });

  describe('lista', () => {
    it('arranca con lotes de ejemplo (uno procesado y uno rechazado) y valida el límite', async () => {
      const { pedir } = montar();
      const lotes = cuerpo<ClinicalImportBatch[]>(await pedir('GET', '/admin/clinical-imports'));
      expect(lotes.map((l) => l.status).sort()).toEqual(['COMPLETADO', 'RECHAZADO']);
      expect(
        (await pedir('GET', '/admin/clinical-imports', { query: { limit: '101' } })).status,
      ).toBe(400);
      expect(
        (await pedir('GET', '/admin/clinical-imports', { query: { limit: '1' } })).body,
      ).toHaveLength(1);
    });
  });
});

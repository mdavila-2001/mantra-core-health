import { HttpHeaders } from '@angular/common/http';

import type {
  BulkImportBatch,
  BulkImportCatalog,
  BulkImportEngineStatus,
  BulkImportReport,
} from '../../data-access/admin-portal/bulk-imports.types';
import { MockRouter, isMockReply, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import {
  ESTADO_DEL_MOTOR_SIMULADO,
  LIMITES_SIMULADOS,
  registrarCargasMasivas,
} from './bulk-imports.handlers';
import { TIPOS_SIMULADOS, tipoSimulado } from './bulk-imports.kinds';

/* Todo lo que cargan estas pruebas es sintético y está declarado: documentos
   `SINT-…`, correos `.invalid`. Ninguna fila es de una persona. */

const MOTOR_CONECTADO: BulkImportEngineStatus = {
  persistence: { durable: true, adapter: 'prueba' },
  executors: {
    users: { connected: true, adapter: 'prueba' },
    clinical: { connected: true, adapter: 'prueba' },
  },
  resolvers: {
    patients: { connected: true, adapter: 'prueba' },
    codes: { connected: true, adapter: 'prueba' },
  },
};

const ENCABEZADO_PACIENTE = 'name,lastName,nationalId,email,phone,birthDate';
const filaPaciente = (n: number, correo = `p${n}@ejemplo.invalid`) =>
  `Persona,Sintetico,SINT-${String(n).padStart(4, '0')},${correo},7000000${n},1990-01-15`;

describe('cargas masivas demo: mismas reglas que /admin/bulk-imports', () => {
  const admin = buscarUsuario('superadmin')!;
  const paciente = buscarUsuario('paciente')!;

  function montar(motor?: BulkImportEngineStatus) {
    const router = new MockRouter();
    registrarCargasMasivas(router, motor);
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
    return { router, pedir };
  }

  function formulario(campos: Record<string, string>, contenido: string, nombre = 'carga.csv'): FormData {
    const form = new FormData();
    form.append('file', new File([contenido], nombre));
    for (const [clave, valor] of Object.entries(campos)) form.append(clave, valor);
    return form;
  }

  const DECLARACION_USUARIOS = { reason: 'SIMULADO · prueba' };
  const DECLARACION_CLINICA = {
    sourceOrganization: 'SIMULADO · origen',
    legalBasis: 'SIMULADO · base legal',
    loadedAt: '2026-01-10',
  };

  const cuerpo = <T>(r: MockReply) => r.body as T;
  const razon = (r: MockReply) => (r.body as { reason?: string }).reason;

  describe('catálogo y plantillas (regla T1)', () => {
    it('lista los diez tipos, los topes de la API y declara que el motor no está conectado', async () => {
      const { pedir } = montar();
      const r = await pedir('GET', '/admin/bulk-imports/templates');
      const catalogo = cuerpo<BulkImportCatalog>(r);
      expect(catalogo.templates).toHaveLength(10);
      expect(catalogo.templates.filter((t) => t.group === 'USERS')).toHaveLength(3);
      expect(catalogo.templates.every((t) => t.formats.join() === 'csv,json')).toBe(true);
      expect(catalogo.limits).toEqual(LIMITES_SIMULADOS);
      expect(catalogo.limits.maxBytes).toBe(20 * 1024 * 1024);
      expect(catalogo.limits.maxRows).toBe(5_000);
      expect(catalogo.engine).toEqual(ESTADO_DEL_MOTOR_SIMULADO);
      expect(catalogo.engine.persistence.durable).toBe(false);
      expect(catalogo.engine.executors.users.connected).toBe(false);
      expect(catalogo.engine.resolvers.patients.connected).toBe(false);
    });

    it('cada tipo entrega su plantilla CSV y JSON con nombre y tipo de archivo', async () => {
      const { pedir } = montar();
      for (const tipo of TIPOS_SIMULADOS) {
        const csv = await pedir('GET', `/admin/bulk-imports/templates/${tipo.kind}`);
        expect(csv.headers?.['Content-Disposition']).toBe(`attachment; filename="plantilla-${tipo.kind}-v1.csv"`);
        expect(csv.headers?.['Content-Type']).toContain('text/csv');
        expect((csv.body as string).split('\n')[0]).toBe(tipo.columns.map((c) => c.name).join(','));

        const json = await pedir('GET', `/admin/bulk-imports/templates/${tipo.kind}`, { query: { format: 'json' } });
        expect(json.headers?.['Content-Disposition']).toBe(`attachment; filename="plantilla-${tipo.kind}-v1.json"`);
        const plantilla = JSON.parse(json.body as string) as {
          kind: string;
          columns: { name: string; required: boolean }[];
          example: Record<string, string>[];
          rules: string[];
        };
        expect(plantilla.kind).toBe(tipo.kind);
        expect(plantilla.columns.map((c) => c.name)).toEqual(tipo.columns.map((c) => c.name));
        expect(Object.keys(plantilla.example[0]!)).toEqual(tipo.columns.map((c) => c.name));
        expect(plantilla.rules.length).toBeGreaterThan(0);
      }
    });

    it('la fila de la propia plantilla pasa la validación, en CSV y en JSON (motor conectado)', async () => {
      const { pedir } = montar(MOTOR_CONECTADO);
      for (const tipo of TIPOS_SIMULADOS) {
        const declaracion = tipo.group === 'USERS' ? DECLARACION_USUARIOS : DECLARACION_CLINICA;
        const csv = (await pedir('GET', `/admin/bulk-imports/templates/${tipo.kind}`)).body as string;
        const json = (await pedir('GET', `/admin/bulk-imports/templates/${tipo.kind}`, { query: { format: 'json' } })).body as string;
        for (const [contenido, nombre] of [
          [csv, 'plantilla.csv'],
          [json, 'plantilla.json'],
        ] as const) {
          const r = await pedir('POST', '/admin/bulk-imports', {
            body: formulario({ kind: tipo.kind, ...declaracion }, contenido, nombre),
          });
          const lote = cuerpo<BulkImportBatch>(r);
          expect(r.status, `${tipo.kind} ${nombre}`).toBe(201);
          expect(lote.status, `${tipo.kind} ${nombre}`).toBe('VALIDADO');
          expect(lote.counts).toEqual({ total: 1, valid: 1, rejected: 0 });
        }
      }
    });

    it('un tipo desconocido es 404 KIND_UNKNOWN y un formato ajeno es 400', async () => {
      const { pedir } = montar();
      const desconocido = await pedir('GET', '/admin/bulk-imports/templates/no-existe');
      expect(desconocido.status).toBe(404);
      expect(razon(desconocido)).toBe('KIND_UNKNOWN');
      const formato = await pedir('GET', '/admin/bulk-imports/templates/usuario-paciente', { query: { format: 'xlsx' } });
      expect(formato.status).toBe(400);
      expect(razon(formato)).toBe('FORMAT_UNSUPPORTED');
    });
  });

  describe('acceso', () => {
    it('sin sesión es 401 y sin rol de gestión es 403', async () => {
      const { pedir } = montar();
      expect((await pedir('GET', '/admin/bulk-imports/templates', { user: null })).status).toBe(401);
      expect((await pedir('GET', '/admin/bulk-imports/templates', { user: paciente })).status).toBe(403);
      expect((await pedir('GET', '/admin/bulk-imports', { user: paciente })).status).toBe(403);
      expect(
        (await pedir('POST', '/admin/bulk-imports', { user: paciente, body: formulario({ kind: 'usuario-paciente', ...DECLARACION_USUARIOS }, 'x') })).status,
      ).toBe(403);
    });
  });

  describe('vista previa', () => {
    it('ubica cada problema por fila y columna sin repetir nunca el valor recibido', async () => {
      const { pedir } = montar();
      const secreto = 'esto-no-es-un-correo-SINT';
      const csv = [ENCABEZADO_PACIENTE, filaPaciente(1), filaPaciente(2, secreto), filaPaciente(1)].join('\n');
      const r = await pedir('POST', '/admin/bulk-imports', {
        body: formulario({ kind: 'usuario-paciente', ...DECLARACION_USUARIOS }, csv),
      });
      const lote = cuerpo<BulkImportBatch>(r);
      expect(r.status).toBe(201);
      expect(lote.status).toBe('VALIDADO');
      expect(lote.counts).toEqual({ total: 3, valid: 1, rejected: 2 });
      expect(lote.issues.items).toEqual([
        { row: 2, field: 'email', code: 'INVALID_FORMAT', message: 'Debe ser un correo electrónico válido' },
        { row: 3, field: 'nationalId', code: 'DUPLICATE_IN_FILE', message: 'La misma clave ya vino en una fila anterior' },
      ]);
      expect(JSON.stringify(lote)).not.toContain(secreto);
      expect(lote.declaration).toEqual(DECLARACION_USUARIOS);
    });

    it('un archivo sin la columna obligatoria o una columna ajena queda RECHAZADO con el problema del archivo', async () => {
      const { pedir } = montar();
      const csv = 'name,lastName,nationalId,phone,birthDate,extra\nPersona,Sintetico,SINT-0001,70000001,1990-01-15,x';
      const lote = cuerpo<BulkImportBatch>(
        await pedir('POST', '/admin/bulk-imports', { body: formulario({ kind: 'usuario-paciente', ...DECLARACION_USUARIOS }, csv) }),
      );
      expect(lote.status).toBe('RECHAZADO');
      expect(lote.fileIssues.map((p) => [p.field, p.code])).toEqual([
        ['email', 'COLUMN_MISSING'],
        ['*', 'UNKNOWN_FIELD'],
      ]);
      expect(lote.fileIssues[1]!.message).toBe('La columna 6 no figura en la plantilla');
      expect(lote.fileIssues[1]!.message).not.toContain('extra');
    });

    it('límite: un archivo sin filas, un JSON roto y un JSON de otro tipo se rechazan sin crear filas', async () => {
      const { pedir } = montar();
      const vacio = cuerpo<BulkImportBatch>(
        await pedir('POST', '/admin/bulk-imports', { body: formulario({ kind: 'usuario-paciente', ...DECLARACION_USUARIOS }, ENCABEZADO_PACIENTE) }),
      );
      expect(vacio.status).toBe('RECHAZADO');
      expect(vacio.fileIssues[0]!.code).toBe('FILE_EMPTY');

      const roto = cuerpo<BulkImportBatch>(
        await pedir('POST', '/admin/bulk-imports', { body: formulario({ kind: 'usuario-paciente', ...DECLARACION_USUARIOS }, '{ no es json', 'x.json') }),
      );
      expect(roto.fileIssues[0]!.code).toBe('FILE_UNREADABLE');

      const ajeno = cuerpo<BulkImportBatch>(
        await pedir('POST', '/admin/bulk-imports', {
          body: formulario({ kind: 'usuario-paciente', ...DECLARACION_USUARIOS }, JSON.stringify({ kind: 'hc-nota', rows: [] }), 'x.json'),
        }),
      );
      expect(ajeno.fileIssues[0]!.code).toBe('KIND_MISMATCH');
      expect(ajeno.status).toBe('RECHAZADO');
    });

    it('límite: 5.000 filas se leen y 5.001 son 413 ROW_LIMIT_EXCEEDED; pasar el peso máximo es 413 FILE_TOO_LARGE', async () => {
      const { pedir } = montar();
      const filas = (n: number) => [ENCABEZADO_PACIENTE, ...Array.from({ length: n }, (_, i) => filaPaciente(i + 1))].join('\n');
      const justo = await pedir('POST', '/admin/bulk-imports', {
        body: formulario({ kind: 'usuario-paciente', ...DECLARACION_USUARIOS }, filas(5_000)),
      });
      expect(justo.status).toBe(201);
      expect(cuerpo<BulkImportBatch>(justo).counts.total).toBe(5_000);

      const demasiadas = await pedir('POST', '/admin/bulk-imports', {
        body: formulario({ kind: 'usuario-paciente', ...DECLARACION_USUARIOS }, filas(5_001)),
      });
      expect(demasiadas.status).toBe(413);
      expect(demasiadas.body).toMatchObject({ code: 'PAYLOAD_TOO_LARGE', reason: 'ROW_LIMIT_EXCEEDED' });

      const pesado = formulario({ kind: 'usuario-paciente', ...DECLARACION_USUARIOS }, filas(1));
      const archivo = pesado.get('file') as File;
      Object.defineProperty(archivo, 'size', { value: LIMITES_SIMULADOS.maxBytes + 1 });
      const grande = await pedir('POST', '/admin/bulk-imports', { body: pesado });
      expect(grande.status).toBe(413);
      expect(razon(grande)).toBe('FILE_TOO_LARGE');
    });

    it('inválido: sin declaración, con la que no corresponde o con fecha futura es 400 DECLARATION_INVALID con la columna', async () => {
      const { pedir } = montar();
      const csv = [ENCABEZADO_PACIENTE, filaPaciente(1)].join('\n');
      const caso = async (kind: string, campos: Record<string, string>) =>
        pedir('POST', '/admin/bulk-imports', { body: formulario({ kind, ...campos }, csv) });

      const sinMotivo = await caso('usuario-paciente', {});
      expect(sinMotivo.status).toBe(400);
      expect(sinMotivo.body).toMatchObject({ code: 'VALIDATION_FAILED', reason: 'DECLARATION_INVALID', details: { field: 'reason' } });

      const sobra = await caso('usuario-paciente', { ...DECLARACION_USUARIOS, legalBasis: 'no corresponde' });
      expect(sobra.body).toMatchObject({ details: { field: 'legalBasis' } });

      for (const [campos, esperado] of [
        [{}, 'sourceOrganization'],
        [{ sourceOrganization: 'Origen' }, 'legalBasis'],
        [{ sourceOrganization: 'Origen', legalBasis: 'ab' }, 'legalBasis'],
        [{ sourceOrganization: 'Origen', legalBasis: 'Base legal' }, 'loadedAt'],
        [{ sourceOrganization: 'Origen', legalBasis: 'Base legal', loadedAt: '2999-01-01' }, 'loadedAt'],
        [{ sourceOrganization: 'Origen', legalBasis: 'Base legal', loadedAt: '2026-02-30' }, 'loadedAt'],
      ] as const) {
        const r = await caso('hc-encuentro', campos);
        expect(r.body, JSON.stringify(campos)).toMatchObject({ reason: 'DECLARATION_INVALID', details: { field: esperado } });
      }
    });

    it('inválido: un tipo que no existe es 404 y sin archivo es 400', async () => {
      const { pedir } = montar();
      const desconocido = await pedir('POST', '/admin/bulk-imports', {
        body: formulario({ kind: 'no-existe', ...DECLARACION_USUARIOS }, 'x'),
      });
      expect(desconocido.status).toBe(404);
      const form = new FormData();
      form.append('kind', 'usuario-paciente');
      form.append('reason', 'SIMULADO');
      const sinArchivo = await pedir('POST', '/admin/bulk-imports', { body: form });
      expect(sinArchivo.status).toBe(400);
      expect(razon(sinArchivo)).toBe('SOURCE_AMBIGUOUS');
    });

    it('la fila de encuentro con fin anterior al inicio se rechaza por la combinación de campos', async () => {
      const { pedir } = montar(MOTOR_CONECTADO);
      const csv = [
        'nationalId,birthDate,sourceRecordId,startAt,endAt,reasonText',
        'SINT-0001,1990-01-15,ORIGEN-1,2026-01-15T09:00:00Z,2026-01-15T08:00:00Z,',
      ].join('\n');
      const lote = cuerpo<BulkImportBatch>(
        await pedir('POST', '/admin/bulk-imports', { body: formulario({ kind: 'hc-encuentro', ...DECLARACION_CLINICA }, csv) }),
      );
      expect(lote.status).toBe('RECHAZADO');
      expect(lote.issues.items[0]).toMatchObject({ row: 1, field: 'endAt', code: 'FIELD_COMBINATION_INVALID' });
    });

    it('historia clínica sin resolutor de pacientes conectado: todas las filas válidas del esquema quedan RESOLUTION_UNAVAILABLE y el lote RECHAZADO', async () => {
      const { pedir } = montar();
      const plantilla = (await pedir('GET', '/admin/bulk-imports/templates/hc-alergia')).body as string;
      const r = await pedir('POST', '/admin/bulk-imports', { body: formulario({ kind: 'hc-alergia', ...DECLARACION_CLINICA }, plantilla) });
      const lote = cuerpo<BulkImportBatch>(r);
      expect(lote.status).toBe('RECHAZADO');
      expect(lote.counts.valid).toBe(0);
      expect(lote.issues.items).toEqual([
        { row: 1, field: 'nationalId', code: 'RESOLUTION_UNAVAILABLE', message: 'No se pudo consultar la terminología o el padrón de pacientes' },
      ]);
    });
  });

  describe('confirmación idempotente, progreso e informe', () => {
    async function crearValidado(pedir: ReturnType<typeof montar>['pedir'], filas = 3, hasta = filas) {
      const csv = [ENCABEZADO_PACIENTE, ...Array.from({ length: filas }, (_, i) => filaPaciente(i + 1, i + 1 > hasta ? 'roto' : undefined))].join('\n');
      const r = await pedir('POST', '/admin/bulk-imports', {
        body: formulario({ kind: 'usuario-paciente', ...DECLARACION_USUARIOS }, csv),
      });
      return cuerpo<BulkImportBatch>(r);
    }

    it('confirmar encola, repetir con la misma clave no vuelve a encolar y otra clave es 409', async () => {
      const { pedir } = montar();
      const lote = await crearValidado(pedir);
      const confirmar = (clave: string | null, id = lote.id) =>
        pedir('POST', `/admin/bulk-imports/${id}/confirm`, { headers: clave === null ? {} : { 'Idempotency-Key': clave } });

      const sinClave = await confirmar(null);
      expect(sinClave.status).toBe(400);
      expect(razon(sinClave)).toBe('IDEMPOTENCY_KEY_REQUIRED');
      expect((await confirmar('clave con espacios')).status).toBe(400);

      const primera = await confirmar('clave-1');
      expect(primera.status).toBe(202);
      expect(cuerpo<BulkImportBatch>(primera).status).toBe('EN_COLA');

      // Un GET avanza el procesamiento; repetir la confirmación después NO lo vuelve a encolar.
      await pedir('GET', `/admin/bulk-imports/${lote.id}`);
      const repetida = await confirmar('clave-1');
      expect(repetida.status).toBe(202);
      expect(cuerpo<BulkImportBatch>(repetida).status).toBe('PROCESANDO');

      const otraClave = await confirmar('clave-2');
      expect(otraClave.status).toBe(409);
      expect(razon(otraClave)).toBe('BATCH_ALREADY_CONFIRMED');

      const otroLote = await crearValidado(pedir);
      const reusada = await confirmar('clave-1', otroLote.id);
      expect(reusada.status).toBe(409);
      expect(razon(reusada)).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('un lote RECHAZADO no se confirma (409) y uno que no existe es 404 sin revelar nada', async () => {
      const { pedir } = montar();
      const rechazado = cuerpo<BulkImportBatch>(
        await pedir('POST', '/admin/bulk-imports', {
          body: formulario({ kind: 'usuario-paciente', ...DECLARACION_USUARIOS }, [ENCABEZADO_PACIENTE, filaPaciente(1, 'roto')].join('\n')),
        }),
      );
      expect(rechazado.status).toBe('RECHAZADO');
      const r = await pedir('POST', `/admin/bulk-imports/${rechazado.id}/confirm`, { headers: { 'Idempotency-Key': 'k-1' } });
      expect(r.status).toBe(409);
      expect(razon(r)).toBe('BATCH_NOT_CONFIRMABLE');

      const ausente = await pedir('GET', '/admin/bulk-imports/00000000-0000-4000-8000-00000000dead');
      expect(ausente.status).toBe(404);
      expect(razon(ausente)).toBe('BATCH_NOT_AVAILABLE');
      expect((await pedir('GET', '/admin/bulk-imports/00000000-0000-4000-8000-00000000dead/report')).status).toBe(404);
    });

    it('el avance pasa por EN_COLA, PROCESANDO y COMPLETADO; el informe llega recién al final', async () => {
      const { pedir } = montar();
      const lote = await crearValidado(pedir, 4);
      await pedir('POST', `/admin/bulk-imports/${lote.id}/confirm`, { headers: { 'Idempotency-Key': 'k-avance' } });

      const noListo = await pedir('GET', `/admin/bulk-imports/${lote.id}/report`);
      expect(noListo.status).toBe(409);
      expect(razon(noListo)).toBe('REPORT_NOT_READY');

      const medio = cuerpo<BulkImportBatch>(await pedir('GET', `/admin/bulk-imports/${lote.id}`));
      expect(medio.status).toBe('PROCESANDO');
      expect(medio.progress).toEqual({ processed: 2, total: 4 });
      const fin = cuerpo<BulkImportBatch>(await pedir('GET', `/admin/bulk-imports/${lote.id}`));
      expect(fin.status).toBe('COMPLETADO');
      expect(fin.progress).toEqual({ processed: 4, total: 4 });
      expect(fin.finishedAt).toBeDefined();
    });

    it('por omisión el informe es honesto: ninguna fila CREADA, todas RECHAZADA por escritor no conectado', async () => {
      const { pedir } = montar();
      const lote = await crearValidado(pedir, 5, 4);
      await pedir('POST', `/admin/bulk-imports/${lote.id}/confirm`, { headers: { 'Idempotency-Key': 'k-honesto' } });
      await pedir('GET', `/admin/bulk-imports/${lote.id}`);
      await pedir('GET', `/admin/bulk-imports/${lote.id}`);

      const informe = cuerpo<BulkImportReport>(await pedir('GET', `/admin/bulk-imports/${lote.id}/report`));
      expect(informe.totals['total']).toBe(5);
      expect(informe.totals['CREADA']).toBe(0);
      expect(informe.totals['RECHAZADA']).toBe(5);
      const delMotor = informe.rows.filter((f) => f.reason === 'EXECUTOR_NOT_CONNECTED');
      expect(delMotor).toHaveLength(4);
      expect(informe.rows.find((f) => f.row === 5)).toMatchObject({ outcome: 'RECHAZADA', reason: 'INVALID_FORMAT', field: 'email' });
      expect(informe.rows.every((f) => Object.keys(f).every((k) => ['row', 'outcome', 'reason', 'field', 'message'].includes(k)))).toBe(true);
    });

    it('con los colaboradores conectados las filas válidas salen CREADA y las malas siguen rechazadas', async () => {
      const { pedir } = montar(MOTOR_CONECTADO);
      const lote = await crearValidado(pedir, 5, 4);
      await pedir('POST', `/admin/bulk-imports/${lote.id}/confirm`, { headers: { 'Idempotency-Key': 'k-conectado' } });
      await pedir('GET', `/admin/bulk-imports/${lote.id}`);
      await pedir('GET', `/admin/bulk-imports/${lote.id}`);
      const informe = cuerpo<BulkImportReport>(await pedir('GET', `/admin/bulk-imports/${lote.id}/report`));
      expect(informe.totals['CREADA']).toBe(4);
      expect(informe.totals['RECHAZADA']).toBe(1);
    });

    it('el informe CSV lleva fila, resultado, motivo, columna y mensaje, con nombre de archivo', async () => {
      const { pedir } = montar();
      const lote = await crearValidado(pedir, 2);
      await pedir('POST', `/admin/bulk-imports/${lote.id}/confirm`, { headers: { 'Idempotency-Key': 'k-csv' } });
      await pedir('GET', `/admin/bulk-imports/${lote.id}`);
      await pedir('GET', `/admin/bulk-imports/${lote.id}`);
      const csv = await pedir('GET', `/admin/bulk-imports/${lote.id}/report`, { query: { format: 'csv' } });
      expect(csv.headers?.['Content-Disposition']).toBe(`attachment; filename="informe-${lote.id}.csv"`);
      const lineas = (csv.body as string).trim().split('\n');
      expect(lineas[0]).toBe('row,outcome,reason,field,message');
      expect(lineas[1]).toContain('1,RECHAZADA,EXECUTOR_NOT_CONNECTED');
      expect((await pedir('GET', `/admin/bulk-imports/${lote.id}/report`, { query: { format: 'xml' } })).status).toBe(400);
    });

    it('el informe de un lote RECHAZADO existe desde el principio y dice por qué', async () => {
      const { pedir } = montar();
      const rechazado = cuerpo<BulkImportBatch>(
        await pedir('POST', '/admin/bulk-imports', {
          body: formulario({ kind: 'usuario-paciente', ...DECLARACION_USUARIOS }, [ENCABEZADO_PACIENTE, filaPaciente(1, 'roto')].join('\n')),
        }),
      );
      const informe = cuerpo<BulkImportReport>(await pedir('GET', `/admin/bulk-imports/${rechazado.id}/report`));
      expect(informe.status).toBe('RECHAZADO');
      expect(informe.totals['total']).toBe(1);
      expect(informe.totals['RECHAZADA']).toBe(1);
      expect(informe.rows[0]).toMatchObject({ row: 1, reason: 'INVALID_FORMAT', field: 'email' });
    });
  });

  describe('lista de lotes', () => {
    it('arranca con tres lotes declarados (completado, rechazado y validado), el más reciente primero', async () => {
      const { pedir } = montar();
      const lotes = cuerpo<BulkImportBatch[]>(await pedir('GET', '/admin/bulk-imports'));
      expect(lotes.map((l) => l.status).sort()).toEqual(['COMPLETADO', 'RECHAZADO', 'VALIDADO']);
      const fechas = lotes.map((l) => l.createdAt);
      expect([...fechas].sort().reverse()).toEqual(fechas);
      const completado = lotes.find((l) => l.status === 'COMPLETADO')!;
      const informe = cuerpo<BulkImportReport>(await pedir('GET', `/admin/bulk-imports/${completado.id}/report`));
      expect(informe.totals['CREADA']).toBe(0);
      expect(informe.totals['total']).toBe(40);
    });

    it('un lote nuevo aparece en la lista y el límite se valida', async () => {
      const { pedir } = montar();
      const csv = [ENCABEZADO_PACIENTE, filaPaciente(1)].join('\n');
      const nuevo = cuerpo<BulkImportBatch>(
        await pedir('POST', '/admin/bulk-imports', { body: formulario({ kind: 'usuario-paciente', ...DECLARACION_USUARIOS }, csv) }),
      );
      const lotes = cuerpo<BulkImportBatch[]>(await pedir('GET', '/admin/bulk-imports', { query: { limit: '2' } }));
      expect(lotes).toHaveLength(2);
      expect(lotes[0]!.id).toBe(nuevo.id);
      expect((await pedir('GET', '/admin/bulk-imports', { query: { limit: '101' } })).status).toBe(400);
      expect((await pedir('GET', '/admin/bulk-imports', { query: { limit: '0' } })).status).toBe(400);
    });
  });

  it('tipoSimulado devuelve undefined para un tipo ajeno', () => {
    expect(tipoSimulado('no-existe')).toBeUndefined();
    expect(tipoSimulado('hc-nota')?.permission).toBe('bulk_import.clinical');
  });
});

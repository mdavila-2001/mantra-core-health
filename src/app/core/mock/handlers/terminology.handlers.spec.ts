import { HttpHeaders } from '@angular/common/http';

import { registrarTerminologia } from './terminology.handlers';
import {
  ACTIVIDAD,
  CATEGORIA_ORDEN,
  conjuntoPorCodigo,
  MEDICAMENTO,
  TIPO_CITA,
  VERIFICACION_DX,
} from '../fixtures/conceptos';
import { valorDeTexto } from '../../data-access/terminology/terminology.types';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';

/**
 * H4 (C-20) — la frecuencia por defecto de un medicamento viaja en
 * `properties.default_frequency`, sólo en la ficha (`GET
 * /terminology/concepts/:id`), nunca en la lista/búsqueda. Contrato real
 * citado: `search-concepts.dto.ts` (`properties: Record<string, unknown>`,
 * "va sólo en la ficha, no en la búsqueda").
 */
describe('handlers de terminología: propiedades de concepto (frecuencia por defecto)', () => {
  const router = new MockRouter();
  registrarTerminologia(router);

  function call<T>(method: MockMethod, path: string, query = new URLSearchParams()): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query,
      body: null,
      headers: new HttpHeaders(),
      user: null,
    }) as T;
  }

  it('la ficha de un medicamento CON la propiedad la trae, legible con valorDeTexto', () => {
    const ficha = call<{ properties: Readonly<Record<string, unknown>> }>(
      'GET',
      `/terminology/concepts/${MEDICAMENTO['MED-PARACETAMOL']}`,
    );
    expect(valorDeTexto(ficha.properties, 'default_frequency')).toBe(
      'Cada 8 horas — dato sintético de desarrollo, no apto para uso clínico',
    );
  });

  it('la ficha de un medicamento SIN la propiedad no la trae, y la lectura defensiva no rompe', () => {
    const ficha = call<{ properties: Readonly<Record<string, unknown>> }>(
      'GET',
      `/terminology/concepts/${MEDICAMENTO['MED-LOSARTAN']}`,
    );
    expect(ficha.properties['default_frequency']).toBeUndefined();
    expect(valorDeTexto(ficha.properties, 'default_frequency')).toBeUndefined();
  });

  it('inválido — un value_json mal formado (número) se lee como ausente, sin lanzar', () => {
    const ficha = call<{ properties: Readonly<Record<string, unknown>> }>(
      'GET',
      `/terminology/concepts/${MEDICAMENTO['MED-INSULINA-NPH']}`,
    );
    expect(ficha.properties['default_frequency']).toBe(42); // el dato crudo sigue ahí, mal formado a propósito
    expect(() => valorDeTexto(ficha.properties, 'default_frequency')).not.toThrow();
    expect(valorDeTexto(ficha.properties, 'default_frequency')).toBeUndefined();
  });

  it('la lista/búsqueda de conceptos NO trae `properties` — sólo la ficha, como en el contrato real', () => {
    const { items } = call<{ items: readonly Record<string, unknown>[] }>(
      'GET',
      '/terminology/concepts',
      new URLSearchParams({ ids: MEDICAMENTO['MED-PARACETAMOL']! }),
    );
    expect(items).toHaveLength(1);
    expect(Object.keys(items[0]!)).not.toContain('properties');
  });
});

/**
 * El doble de la carga masiva, en los tres niveles del contrato (regla 65).
 *
 * El doble decide por el **nombre** del archivo —los fixtures compartidos de §4
 * del contrato del 2026-09-25—, así que estas pruebas son también la
 * documentación ejecutable de qué nombre produce qué informe. Lo que fijan es
 * el contrato §2: `aborted ⇔ errors > 0 ⇔ inserted = 0` (Q-2), `batchId` nulo
 * en dry-run (Q-4), y un `code` que ya está en la versión que se omite en vez
 * de actualizarse (Q-7).
 *
 * Todos los códigos son sintéticos con prefijo `ZZ-`: ningún dato de una
 * persona entra acá ni en la vista previa.
 */
interface InformeDeImportacion {
  readonly batchId: string | null;
  readonly format: string;
  readonly profile: string;
  readonly dryRun: boolean;
  readonly aborted: boolean;
  readonly totalRead: number;
  readonly inserted: number;
  readonly skipped: number;
  readonly errors: number;
  readonly errorSamples: readonly { line: number; column?: string; message: string }[];
  readonly preview: readonly { line: number; code: string; display: string }[];
}

const VERSION = 'csv-1-1-0';
const RUTA = `/terminology/versions/${VERSION}/import-file`;

describe('doble de la carga masiva de terminología', () => {
  let router: MockRouter;
  const admin = buscarUsuario('admin')!;
  const paciente = buscarUsuario('paciente')!;

  beforeEach(() => {
    // Un router nuevo por prueba: el estado de «qué códigos ya entraron» vive
    // dentro de `registrarTerminologia`, así que sin esto una prueba arrastra
    // lo que cargó la anterior.
    router = new MockRouter();
    registrarTerminologia(router);
  });

  function llamar(
    method: MockMethod,
    path: string,
    opciones: { body?: unknown; query?: string; user?: typeof admin | null } = {},
  ): { status: number; body: unknown; headers?: Readonly<Record<string, string>> } {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const resultado = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(opciones.query ?? ''),
      body: opciones.body ?? null,
      headers: new HttpHeaders(),
      user: opciones.user === undefined ? admin : opciones.user,
    });
    if (
      resultado !== null &&
      typeof resultado === 'object' &&
      'status' in resultado &&
      'body' in resultado
    ) {
      return resultado as { status: number; body: unknown; headers?: Record<string, string> };
    }
    return { status: 200, body: resultado };
  }

  /** El multipart tal como lo arma el cliente: `file`, `dryRun` y `profile`. */
  function formulario(
    nombre: string,
    opciones: { dryRun?: boolean; profile?: string; bytes?: number } = {},
  ): FormData {
    const form = new FormData();
    form.append('file', new File(['x'.repeat(opciones.bytes ?? 8)], nombre));
    form.append('dryRun', String(opciones.dryRun ?? false));
    form.append('profile', opciones.profile ?? 'conceptos');
    return form;
  }

  function importar(
    nombre: string,
    opciones: { dryRun?: boolean; profile?: string; bytes?: number } = {},
  ): { status: number; informe: InformeDeImportacion } {
    const { status, body } = llamar('POST', RUTA, { body: formulario(nombre, opciones) });
    return { status, informe: body as InformeDeImportacion };
  }

  function codigoDeError(body: unknown): string {
    return (body as { code: string }).code;
  }

  /* -- Nivel correcto ------------------------------------------------------ */

  it('`ok-50.csv` en dry-run: 50 leídas, 0 errores, sin lote y sin insertar nada', () => {
    const { status, informe } = importar('ok-50.csv', { dryRun: true });

    expect(status).toBe(200);
    expect(informe.format).toBe('csv');
    expect(informe.profile).toBe('conceptos');
    expect(informe.dryRun).toBe(true);
    expect(informe.aborted).toBe(false);
    expect(informe.totalRead).toBe(50);
    expect(informe.errors).toBe(0);
    // Q-4: el dry-run no registra lote, así que no hay nada que auditar.
    expect(informe.batchId).toBeNull();
    expect(informe.inserted).toBe(0);
    expect(informe.skipped).toBe(0);
  });

  it('la vista previa son las primeras 20 filas válidas, numeradas desde la 2', () => {
    // Q-5: la vista previa la devuelve el servidor; el front no parsea nada.
    const { informe } = importar('ok-50.csv', { dryRun: true });

    expect(informe.preview).toHaveLength(20);
    expect(informe.preview[0]).toMatchObject({ line: 2, code: 'ZZ-001' });
    expect(informe.preview[19]).toMatchObject({ line: 21, code: 'ZZ-020' });
    // Sintéticos y declarados: ningún código sin el prefijo acordado.
    expect(informe.preview.every((fila) => fila.code.startsWith('ZZ-'))).toBe(true);
  });

  it('`ok-50.csv` real: 50 insertadas y un lote con identificador', () => {
    const { status, informe } = importar('ok-50.csv');

    expect(status).toBe(200);
    expect(informe.dryRun).toBe(false);
    expect(informe.inserted).toBe(50);
    expect(informe.skipped).toBe(0);
    expect(informe.batchId).toEqual(expect.any(String));
  });

  it('la segunda carga real del mismo archivo omite las 50 en vez de actualizarlas', () => {
    // Q-7: un `code` que ya está en la versión se omite, nunca se actualiza.
    importar('ok-50.csv');

    const { informe } = importar('ok-50.csv');

    expect(informe.inserted).toBe(0);
    expect(informe.skipped).toBe(50);
    expect(informe.errors).toBe(0);
  });

  it('el dry-run no deja rastro: después sigue insertando las 50', () => {
    importar('ok-50.csv', { dryRun: true });

    expect(importar('ok-50.csv').informe.inserted).toBe(50);
  });

  it('el estado es por versión: otra versión vuelve a insertar las 50', () => {
    importar('ok-50.csv');

    const { informe } = (() => {
      const { body } = llamar('POST', '/terminology/versions/otra-version/import-file', {
        body: formulario('ok-50.csv'),
      });
      return { informe: body as InformeDeImportacion };
    })();

    expect(informe.inserted).toBe(50);
  });

  it('el formato sale de la extensión: `.xlsx` y `.ndjson` también se aceptan', () => {
    expect(importar('ok-50.xlsx').informe.format).toBe('xlsx');
    expect(importar('ok-50.ndjson').informe.format).toBe('ndjson');
  });

  /* -- Nivel límite -------------------------------------------------------- */

  it('`con-errores.xlsx` aborta entero con los 5 problemas de §4, con su columna', () => {
    const { status, informe } = importar('con-errores.xlsx');

    expect(status).toBe(200);
    // Q-2, todo o nada: abortado ⇔ hay errores ⇔ no entró ninguna fila.
    expect(informe.aborted).toBe(true);
    expect(informe.errors).toBe(5);
    expect(informe.inserted).toBe(0);
    expect(informe.batchId).toBeNull();
    expect(informe.errorSamples.map((problema) => problema.line)).toEqual([5, 9, 14, 20, 33]);
    expect(informe.errorSamples.map((problema) => problema.column)).toEqual([
      'display',
      'code',
      'code',
      'code',
      'display',
    ]);
  });

  it('un archivo que aborta no deja códigos cargados en la versión', () => {
    importar('con-errores.csv');

    expect(importar('ok-50.csv').informe.inserted).toBe(50);
  });

  it('`grande-10k.xlsx` da 413 con el sobre de error del repo', () => {
    const { status, body } = llamar('POST', RUTA, { body: formulario('grande-10k.xlsx') });

    expect(status).toBe(413);
    expect(codigoDeError(body)).toBe('PAYLOAD_TOO_LARGE');
  });

  it('un archivo por encima del tope da 413 aunque el nombre no lo diga', () => {
    const { status } = llamar('POST', RUTA, {
      body: formulario('ok-50.csv', { bytes: 11 * 1024 * 1024 }),
    });

    expect(status).toBe(413);
  });

  /* -- Nivel inválido ------------------------------------------------------ */

  it('`no-es-nada.pdf` da 422 `IMPORT_FORMAT_UNSUPPORTED`', () => {
    const { status, body } = llamar('POST', RUTA, { body: formulario('no-es-nada.pdf') });

    expect(status).toBe(422);
    expect(codigoDeError(body)).toBe('IMPORT_FORMAT_UNSUPPORTED');
  });

  it('`vacio-solo-encabezado.csv` da 422 `IMPORT_EMPTY_FILE`', () => {
    const { status, body } = llamar('POST', RUTA, {
      body: formulario('vacio-solo-encabezado.csv'),
    });

    expect(status).toBe(422);
    expect(codigoDeError(body)).toBe('IMPORT_EMPTY_FILE');
  });

  it('un perfil que no existe da 422 `IMPORT_PROFILE_UNKNOWN`', () => {
    const { status, body } = llamar('POST', RUTA, {
      body: formulario('ok-50.csv', { profile: 'inventado' }),
    });

    expect(status).toBe(422);
    expect(codigoDeError(body)).toBe('IMPORT_PROFILE_UNKNOWN');
  });

  it('sin archivo da 412, no un 500', () => {
    // El contrato es explícito: ningún camino devuelve 500.
    const { status, body } = llamar('POST', RUTA, { body: null });

    expect(status).toBe(412);
    expect(codigoDeError(body)).toBe('PRECONDITION_FAILED');
  });

  it('`error-red.csv` da el fallo de dependencia con identificador de correlación', () => {
    // El S8 real (estado 0) no lo puede emitir un manejador: lo dispara
    // `sessionStorage['mock:fallos']` desde el interceptor. Este es el fallo
    // más cercano que el doble sí puede producir, y trae el `correlationId`
    // que el S9 de la pantalla necesita mostrar.
    const { status, body } = llamar('POST', RUTA, { body: formulario('error-red.csv') });

    expect(status).toBe(503);
    expect(codigoDeError(body)).toBe('DEPENDENCY_UNAVAILABLE');
    expect((body as { correlationId: string }).correlationId).toBe('mock-import-red');
  });

  it('sin sesión da 401 y con un rol sin administración de seguridad, 403', () => {
    expect(llamar('POST', RUTA, { body: formulario('ok-50.csv'), user: null }).status).toBe(401);
    expect(
      llamar('POST', RUTA, { body: formulario('ok-50.csv'), user: paciente }).status,
    ).toBe(403);
  });

  /* -- La plantilla -------------------------------------------------------- */

  it('la plantilla CSV son dos líneas y viene con su `Content-Disposition`', () => {
    const { status, body, headers } = llamar('GET', '/terminology/import-template', {
      query: 'profile=conceptos&format=csv',
    });

    expect(status).toBe(200);
    expect(body).toBe('code,display,definition\nZZ-000,Ejemplo sintético,Fila de ejemplo');
    expect(headers?.['Content-Type']).toBe('text/csv; charset=utf-8');
    expect(headers?.['Content-Disposition']).toBe(
      'attachment; filename="plantilla-conceptos.csv"',
    );
  });

  it('la plantilla XLSX responde con el tipo y el nombre de un libro', () => {
    const { status, headers } = llamar('GET', '/terminology/import-template', {
      query: 'profile=conceptos&format=xlsx',
    });

    expect(status).toBe(200);
    expect(headers?.['Content-Type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(headers?.['Content-Disposition']).toBe(
      'attachment; filename="plantilla-conceptos.xlsx"',
    );
  });

  it('un formato o un perfil desconocido en la plantilla da 422 con su código', () => {
    expect(
      codigoDeError(
        llamar('GET', '/terminology/import-template', { query: 'format=pdf' }).body,
      ),
    ).toBe('IMPORT_FORMAT_UNSUPPORTED');
    expect(
      codigoDeError(
        llamar('GET', '/terminology/import-template', { query: 'profile=inventado' }).body,
      ),
    ).toBe('IMPORT_PROFILE_UNKNOWN');
  });

  it('la plantilla también exige administración de seguridad', () => {
    expect(llamar('GET', '/terminology/import-template', { user: null }).status).toBe(401);
    expect(llamar('GET', '/terminology/import-template', { user: paciente }).status).toBe(403);
  });
});

describe('contrato C0: expansión de conceptos clínicos', () => {
  const router = new MockRouter();
  registrarTerminologia(router);

  function expand(code: string): readonly { conceptId: string; code: string; display: string }[] {
    const valueSet = conjuntoPorCodigo(code);
    if (valueSet === undefined) throw new Error('No existe el conjunto ' + code);
    const path = '/terminology/value-sets/' + valueSet.id + '/$expand';
    const match = router.match('GET', path);
    if (match === null) throw new Error('No existe GET ' + path);
    const result = match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(),
      body: null,
      headers: new HttpHeaders(),
      user: null,
    }) as { items: readonly { conceptId: string; code: string; display: string }[] };
    return result.items;
  }

  it.each([
    ['VS_ACTIVITY_TYPE', 'ACT-FOLLOW-UP', 'Reconsulta', ACTIVIDAD['ACT-FOLLOW-UP']],
    ['VS_APPOINTMENT_TYPE', 'APT-RECONSULTA', 'Reconsulta', TIPO_CITA['APT-RECONSULTA']],
    ['VS_SERVICE_REQUEST_CATEGORY', 'SRQ-OTHER', 'Otro', CATEGORIA_ORDEN['SRQ-OTHER']],
  ])('expande %s con un único %s, su etiqueta y su ID estable', (valueSet, code, display, id) => {
    const items = expand(valueSet!);
    expect(id).toEqual(expect.any(String));
    expect(items.filter((item) => item.code === code)).toEqual([
      expect.objectContaining({ conceptId: id, code, display }),
    ]);
    expect(expand(valueSet!)).toEqual(items);
  });

  it('conserva todos los estados de verificación diagnóstica publicados', () => {
    const items = expand('VS_CONDITION_VERIFICATION');
    for (const [code, conceptId] of Object.entries(VERIFICACION_DX)) {
      expect(items).toContainEqual(expect.objectContaining({ code, conceptId }));
    }
  });
});

import { HttpHeaders } from '@angular/common/http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { registrarTerminologia } from './terminology.handlers';
import {
  ACTIVITY,
  ORDER_CATEGORY,
  setByCode,
  MEDICAMENTO,
  APPOINTMENT_TYPE,
  VERIFICATION_DX,
} from '../fixtures/concepts';
import { valorDeTexto } from '../../data-access/terminology/terminology.types';
import { AlmacenDeGlosario, ArchivoAusente, type LectorDeArchivos } from '../glossary-shards';
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

  // Los manejadores de conceptos contestan con una promesa desde que el
  // glosario se lee bajo demanda (`glossary-shards.ts`): se espera siempre.
  async function call<T>(
    method: MockMethod,
    path: string,
    query = new URLSearchParams(),
  ): Promise<T> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return (await match.handler({
      method,
      path,
      params: match.params,
      query,
      body: null,
      headers: new HttpHeaders(),
      user: null,
    })) as T;
  }

  it('la ficha de un medicamento CON la propiedad la trae, legible con valorDeTexto', async () => {
    const ficha = await call<{ properties: Readonly<Record<string, unknown>> }>(
      'GET',
      `/terminology/concepts/${MEDICAMENTO['MED-PARACETAMOL']}`,
    );
    expect(valorDeTexto(ficha.properties, 'default_frequency')).toBe(
      'Cada 8 horas — dato sintético de desarrollo, no apto para uso clínico',
    );
  });

  it('la ficha de un medicamento SIN la propiedad no la trae, y la lectura defensiva no rompe', async () => {
    const ficha = await call<{ properties: Readonly<Record<string, unknown>> }>(
      'GET',
      `/terminology/concepts/${MEDICAMENTO['MED-LOSARTAN']}`,
    );
    expect(ficha.properties['default_frequency']).toBeUndefined();
    expect(valorDeTexto(ficha.properties, 'default_frequency')).toBeUndefined();
  });

  it('inválido — un value_json mal formado (número) se lee como ausente, sin lanzar', async () => {
    const ficha = await call<{ properties: Readonly<Record<string, unknown>> }>(
      'GET',
      `/terminology/concepts/${MEDICAMENTO['MED-INSULINA-NPH']}`,
    );
    expect(ficha.properties['default_frequency']).toBe(42); // el dato crudo sigue ahí, mal formado a propósito
    expect(() => valorDeTexto(ficha.properties, 'default_frequency')).not.toThrow();
    expect(valorDeTexto(ficha.properties, 'default_frequency')).toBeUndefined();
  });

  it('la lista/búsqueda de conceptos NO trae `properties` — sólo la ficha, como en el contrato real', async () => {
    const { items } = await call<{ items: readonly Record<string, unknown>[] }>(
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

  it('sin archivo da 422, no un 500', () => {
    // El contrato es explícito: ningún camino devuelve 500. 422, no 412
    // (H2.S1.M2, 2026-09-26): la API responde las precondiciones de negocio
    // con `PreconditionFailedException`, que es 422.
    const { status, body } = llamar('POST', RUTA, { body: null });

    expect(status).toBe(422);
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

  async function expand(
    code: string,
  ): Promise<readonly { conceptId: string; code: string; display: string }[]> {
    const valueSet = setByCode(code);
    if (valueSet === undefined) throw new Error('No existe el conjunto ' + code);
    const path = '/terminology/value-sets/' + valueSet.id + '/$expand';
    const match = router.match('GET', path);
    if (match === null) throw new Error('No existe GET ' + path);
    const result = (await match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(),
      body: null,
      headers: new HttpHeaders(),
      user: null,
    })) as { items: readonly { conceptId: string; code: string; display: string }[] };
    return result.items;
  }

  it.each([
    ['VS_ACTIVITY_TYPE', 'ACT-FOLLOW-UP', 'Reconsulta', ACTIVITY['ACT-FOLLOW-UP']],
    ['VS_APPOINTMENT_TYPE', 'APT-RECONSULTA', 'Reconsulta', APPOINTMENT_TYPE['APT-RECONSULTA']],
    ['VS_SERVICE_REQUEST_CATEGORY', 'SRQ-OTHER', 'Otro', ORDER_CATEGORY['SRQ-OTHER']],
  ])('expande %s con un único %s, su etiqueta y su ID estable', async (valueSet, code, display, id) => {
    const items = await expand(valueSet!);
    expect(id).toEqual(expect.any(String));
    expect(items.filter((item) => item.code === code)).toEqual([
      expect.objectContaining({ conceptId: id, code, display }),
    ]);
    expect(await expand(valueSet!)).toEqual(items);
  });

  it('conserva todos los estados de verificación diagnóstica publicados', async () => {
    const items = await expand('VS_CONDITION_VERIFICATION');
    for (const [code, conceptId] of Object.entries(VERIFICATION_DX)) {
      expect(items).toContainEqual(expect.objectContaining({ code, conceptId }));
    }
  });
});

/**
 * Auditoría del glosario (2026-09-30): los sinónimos se escriben con su
 * ortografía correcta («tiña», «uñas», «riñón») y la búsqueda no distingue
 * tildes ni la ñ; y lo que está en castellano va antes que las categorías
 * ICD-10-CM que sólo tienen el título en inglés.
 *
 * Desde la carga bajo demanda el glosario sale de los shards: estas pruebas
 * leen la semilla commiteada (`public/glossary-seed/`) con un lector de disco,
 * igual que `glossary-shards.spec.ts`, y buscan cada término por su id estable.
 */
describe('búsqueda del glosario: tildes y castellano primero', () => {
  const PUBLICO = join(process.cwd(), 'public');
  const leerSemilla: LectorDeArchivos = (ruta) => {
    const archivo = join(PUBLICO, ruta);
    if (ruta.startsWith('glossary-data/') || !existsSync(archivo)) {
      return Promise.reject(new ArchivoAusente(ruta));
    }
    return Promise.resolve(JSON.parse(readFileSync(archivo, 'utf8')) as unknown);
  };
  const router = new MockRouter();
  registrarTerminologia(router, new AlmacenDeGlosario(leerSemilla));

  async function get<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    return (await match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user: null,
    })) as T;
  }

  interface Entrada {
    readonly conceptId: string;
    readonly translated: boolean;
  }
  interface Conjunto {
    readonly id: string;
    readonly internalCode: string;
    readonly memberCount: number;
    readonly translatedMemberCount?: number;
  }

  // Términos oficiales de la semilla (2026-10-01): CIE-10-ES B35.4 y B35.1, y el
  // riñón de la anatomía TA98 (Wikidata Q9377). Antes eran filas de una capa
  // redactada por desarrollo, que se retiró del glosario.
  const TINA_CORPORAL = 'c08c4776-c531-484c-a62e-7f96d8dba482';
  const TINA_DE_LAS_UNAS = 'c58c4f55-41db-4efd-add9-9a4825283e22';
  const RINON = '0d827ff8-ed60-404a-a02d-9f52d0e4a4e2';

  const buscar = async (q: string) =>
    (
      await get<{ items: readonly Entrada[] }>('/terminology/concepts', {
        includeValueSets: 'true',
        limit: '500',
        q,
      })
    ).items.map((item) => item.conceptId);

  it.each([
    ['tina', TINA_CORPORAL],
    ['tiña', TINA_CORPORAL],
    ['tina de las unas', TINA_DE_LAS_UNAS],
    ['tiña de las uñas', TINA_DE_LAS_UNAS],
    ['rinon', RINON],
    ['RIÑÓN', RINON],
  ])('«%s» encuentra su término', async (q, id) => {
    expect(await buscar(q)).toContain(id);
  });

  async function enfermedades(): Promise<Conjunto> {
    const { items } = await get<{ items: readonly Conjunto[] }>('/terminology/value-sets', {
      limit: '200',
    });
    const conjunto = items.find((c) => c.internalCode === 'glossary-category-disease');
    if (conjunto === undefined) throw new Error('No está la categoría Enfermedades');
    return conjunto;
  }

  it('la categoría Enfermedades dice cuántos de sus términos están en castellano: todos', async () => {
    const categoria = await enfermedades();
    // Desde el 2026-10-01 la semilla no trae las 1 918 categorías ICD-10-CM con
    // el título en inglés: CIE-10-ES da el nombre oficial en castellano.
    expect(categoria.translatedMemberCount).toBe(categoria.memberCount);
  });

  it('ningún término de Enfermedades está sólo en inglés', async () => {
    const categoria = await enfermedades();
    const { items } = await get<{ items: readonly Entrada[] }>('/terminology/concepts', {
      includeValueSets: 'true',
      valueSetId: categoria.id,
      limit: '5000',
    });

    expect(items.length).toBeGreaterThan(1000);
    expect(items.filter((t) => !t.translated)).toEqual([]);
  });
});

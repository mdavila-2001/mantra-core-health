import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test';

import { administrador, doctora, urlDeApi } from './support/actores';
import { entrar, esperarAplicacionLista, irA } from './support/sesion';
import { vigilar } from './support/salud-de-rutas';

/**
 * El contrato de la carga masiva de terminología — Carril B, H2.S2 y H3.
 *
 * §3, §4 y §7 de `CONTRATO-CARGA-MASIVA.md` (reparto de la noche del
 * 2026-09-25). Once tests, cada uno aislado, sobre los `data-testid` que
 * Justin puso en la pantalla y los fixtures que este carril genera.
 *
 * ## Dos backends, una sola suite
 *
 * `E2E_BACKEND=real` corre contra la API de verdad (Itzan arrancada con
 * `yarn start:dev` + `yarn start:real-api` en el front); por omisión corre
 * contra el simulador (`yarn dev`). El título de cada test lleva la etiqueta
 * para que la evidencia diga contra qué corrió — nunca se declara `[API
 * real]` una corrida que en realidad fue contra el doble.
 *
 * Dos excepciones documentadas, no bugs de nadie:
 * - **Test 3** usa `con-errores.xlsx` en simulado y `con-errores.csv` en
 *   real: la rama de Itzan todavía no registra `XlsxParser` en
 *   `PARSEADORES_DE_IMPORTACION` (lo cablea Pablo al integrar), así que un
 *   `.xlsx` real daría 422 `IMPORT_FORMAT_UNSUPPORTED` en vez de validarse.
 * - **Test 6** (`error-red.csv`) sólo corre en simulado: el 503 es una regla
 *   del doble por nombre de archivo (`terminology.handlers.ts:410`); contra
 *   la API real ese mismo archivo importa 50 conceptos normales.
 *
 * ## Por qué serial
 *
 * `POST /iam/auth/login` y `/token/refresh` están limitados a 10/min por IP
 * (`playwright.config.ts`, cabecera). Con `mode: 'serial'` entramos una sola
 * vez por archivo y navegamos con `irA` (router, no `goto`), como el resto
 * de la suite.
 *
 * ## Qué NO hace este spec
 *
 * No intercepta rutas ni mockea respuestas para ponerse en verde: contra el
 * simulador, el doble ES el backend (`mock-backend.interceptor.ts` resuelve
 * sin pasar por la red, así que `page.on('request'/'response')` no ve nada
 * de `/import-file` ahí — el test 9 sólo cuenta peticiones en modo real). No
 * automatiza el drag & drop real: usa `setInputFiles`, y el arrastre se
 * verifica a mano en la doble revisión (H4.S2.M4).
 */

const RUTA = '/administration/terminology/import';
const BACKEND: 'real' | 'simulado' = process.env['E2E_BACKEND'] === 'real' ? 'real' : 'simulado';
const ETIQUETA = BACKEND === 'real' ? '[API real]' : '[backend simulado]';

const FIXTURES = join(__dirname, 'fixtures', 'carga-masiva');
function fixture(nombre: string): string {
  return join(FIXTURES, nombre);
}

interface SistemaDePrueba {
  readonly id: string;
  readonly versionId: string;
  readonly nombre: string;
}

/** Crea, sólo en modo real, un sistema de codificación y una versión en borrador para el test. */
async function crearSistemaDePrueba(api: APIRequestContext, token: string, sufijo: string): Promise<SistemaDePrueba> {
  const nombre = `Sistema de prueba E2E ${sufijo}`;
  const sistema = await api.post('/terminology/code-systems', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      internalCode: `ZZ-E2E-${sufijo}`,
      name: nombre,
      canonicalUrl: `https://e2e.alovida.test/zz-${sufijo}`,
      sourceCode: `ZZ-SRC-${sufijo}`,
      sourceName: `Fuente sintética E2E ${sufijo}`,
    },
  });
  expect(sistema.ok(), `alta de sistema de prueba: ${sistema.status()} ${await sistema.text()}`).toBeTruthy();
  const { id: codeSystemId } = (await sistema.json()) as { id: string };

  const version = await api.post(`/terminology/code-systems/${codeSystemId}/versions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { version: '1.0.0' },
  });
  expect(version.ok(), `alta de versión de prueba: ${version.status()} ${await version.text()}`).toBeTruthy();
  const { id: versionId } = (await version.json()) as { id: string };

  return { id: codeSystemId, versionId, nombre };
}

async function iniciarSesionApi(api: APIRequestContext): Promise<string> {
  const admin = administrador();
  const respuesta = await api.post('/iam/auth/login', {
    data: { email: admin.identificador, password: admin.clave },
  });
  expect(respuesta.ok(), `login de API: ${respuesta.status()} ${await respuesta.text()}`).toBeTruthy();
  const { accessToken } = (await respuesta.json()) as { accessToken: string };
  return accessToken;
}

/** Abre la pantalla y espera el primer control del contrato. */
async function irAlFormulario(page: Page): Promise<void> {
  await irA(page, RUTA);
  await esperarAplicacionLista(page);
  await expect(page.getByTestId('carga-perfil')).toBeVisible();
}

/** Elige perfil «Conceptos» y, en modo real, el sistema/versión recién creados; en simulado, los únicos que el doble ofrece. */
async function elegirModelo(page: Page, sistemaDePrueba: SistemaDePrueba | null): Promise<void> {
  await page.getByTestId('carga-perfil').locator('select').selectOption({ label: 'Conceptos' });
  if (sistemaDePrueba === null) {
    await page.getByTestId('carga-sistema').locator('select').selectOption({ index: 1 });
    await page.getByTestId('carga-version').locator('select').selectOption({ index: 1 });
    return;
  }
  // La pantalla carga la lista de sistemas al iniciar (version-import.ts:327-330):
  // el sistema recién creado por API sólo aparece si se entra después de crearlo.
  await page.getByTestId('carga-sistema').locator('select').selectOption({ label: sistemaDePrueba.nombre });
  await page.getByTestId('carga-version').locator('select').selectOption({ index: 1 });
}

/** Consola sin errores nuevos y ninguna respuesta ≥500, salvo las que el propio test declare esperadas. */
/** El dev server inyecta scripts en línea que su propia CSP bloquea (ver `carga-masiva-baseline.spec.ts`). No es de esta pantalla. */
const RUIDO_CSP = /Content Security Policy/;

function esperarSinFallosInesperados(
  vigilante: ReturnType<typeof vigilar>,
  fallosEsperados: readonly RegExp[] = [],
): void {
  const { erroresDeConsola, peticionesFallidas } = vigilante;
  const consolaInesperada = erroresDeConsola.filter(
    (e) => !RUIDO_CSP.test(e) && !fallosEsperados.some((r) => r.test(e)),
  );
  expect(consolaInesperada, `consola: ${erroresDeConsola.join(' | ')}`).toEqual([]);
  const cincoInesperados = peticionesFallidas.filter(
    (p) => /^5\d\d/.test(p) && !fallosEsperados.some((r) => r.test(p)),
  );
  expect(cincoInesperados, `≥500 inesperados: ${peticionesFallidas.join(' | ')}`).toEqual([]);
}

test.describe.configure({ mode: 'serial' });

test.describe(`Carga masiva · contrato ${ETIQUETA}`, () => {
  let page: Page;
  let api: APIRequestContext;
  let token = '';

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await entrar(page, administrador());

    if (BACKEND === 'real') {
      api = await request.newContext({ baseURL: urlDeApi() });
      token = await iniciarSesionApi(api);
    }
  });

  test.afterAll(async () => {
    await page.close();
    if (BACKEND === 'real') await api.dispose();
  });

  test.beforeEach(async () => {
    if (BACKEND === 'simulado') {
      // El estado de idempotencia del doble vive en memoria del módulo
      // (`codigosPorVersion` dentro de `crearRouterSimulado()`): recargar
      // reinicia el router simulado entero.
      await page.reload();
      await esperarAplicacionLista(page);
    }
  });

  test(`test 1 · flujo feliz: 50 leídas, 0 errores, importa 50 ${ETIQUETA}`, async ({}, testInfo) => {
    const vigilante = vigilar(page);
    const sistemaDePrueba =
      BACKEND === 'real' ? await crearSistemaDePrueba(api, token, `t1-${testInfo.testId.slice(0, 8)}`) : null;

    await irAlFormulario(page);
    await elegirModelo(page, sistemaDePrueba);

    await page.getByTestId('carga-archivo').locator('input[type=file]').setInputFiles(fixture('ok-50.csv'));
    await page.getByRole('button', { name: 'Validar sin guardar' }).click();

    const informe = page.getByTestId('carga-informe');
    await expect(informe).toBeVisible({ timeout: 15_000 });
    await expect(informe).toContainText('50');
    await expect(page.getByTestId('carga-importar')).toBeEnabled();

    await page.getByTestId('carga-importar').click();
    const resumen = page.getByTestId('carga-resumen');
    await expect(resumen).toBeVisible({ timeout: 15_000 });
    await expect(resumen).toContainText('50');

    esperarSinFallosInesperados(vigilante);
  });

  test(`test 2 · idempotencia: segunda vez, 0 insertadas y 50 omitidas ${ETIQUETA}`, async ({}, testInfo) => {
    const vigilante = vigilar(page);
    const sistemaDePrueba =
      BACKEND === 'real' ? await crearSistemaDePrueba(api, token, `t2-${testInfo.testId.slice(0, 8)}`) : null;

    await irAlFormulario(page);
    await elegirModelo(page, sistemaDePrueba);

    // Primera carga: siembra los 50 conceptos.
    await page.getByTestId('carga-archivo').locator('input[type=file]').setInputFiles(fixture('ok-50.csv'));
    await page.getByRole('button', { name: 'Validar sin guardar' }).click();
    await expect(page.getByTestId('carga-informe')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('carga-importar').click();
    await expect(page.getByTestId('carga-resumen')).toBeVisible({ timeout: 15_000 });

    // «Cargar otro» conserva perfil, sistema y versión (contrato §3).
    await page.getByTestId('carga-otro').click();
    await page.getByTestId('carga-archivo').locator('input[type=file]').setInputFiles(fixture('ok-50.csv'));
    await page.getByRole('button', { name: 'Validar sin guardar' }).click();
    await expect(page.getByTestId('carga-informe')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('carga-importar').click();

    const resumen2 = page.getByTestId('carga-resumen');
    await expect(resumen2).toBeVisible({ timeout: 15_000 });
    await expect(resumen2).toContainText('0');
    await expect(resumen2).toContainText('50');

    esperarSinFallosInesperados(vigilante);
  });

  test(`test 3 · con-errores: 5 filas con columna, importar deshabilitado ${ETIQUETA}`, async ({}, testInfo) => {
    const vigilante = vigilar(page);
    const sistemaDePrueba =
      BACKEND === 'real' ? await crearSistemaDePrueba(api, token, `t3-${testInfo.testId.slice(0, 8)}`) : null;
    // El .xlsx sólo lo entiende el simulador; en real, XlsxParser no está
    // cableado en la rama de Itzan todavía (Q-M17, declarado en el PLAN.md).
    const archivo = BACKEND === 'real' ? 'con-errores.csv' : 'con-errores.xlsx';

    await irAlFormulario(page);
    await elegirModelo(page, sistemaDePrueba);

    await page.getByTestId('carga-archivo').locator('input[type=file]').setInputFiles(fixture(archivo));
    await page.getByRole('button', { name: 'Validar sin guardar' }).click();

    const tablaDeErrores = page.getByTestId('carga-errores');
    await expect(tablaDeErrores).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No se guardó nada', { exact: true })).toBeVisible();
    await expect(page.getByTestId('carga-importar')).toBeDisabled();

    esperarSinFallosInesperados(vigilante);
  });

  test(`test 4 · no-es-nada.pdf: rechazo del cliente, sin petición ${ETIQUETA}`, async ({}, testInfo) => {
    const vigilante = vigilar(page);
    const sistemaDePrueba =
      BACKEND === 'real' ? await crearSistemaDePrueba(api, token, `t4-${testInfo.testId.slice(0, 8)}`) : null;

    await irAlFormulario(page);
    await elegirModelo(page, sistemaDePrueba);

    // `app-file-input` filtra por `accept` antes de que el archivo llegue al
    // servidor (Q-M16, declarado): no hay 422 real que observar acá, el 422
    // del detector se ejercita por curl en el gate de seguridad (H5.S2).
    await page.getByTestId('carga-archivo').locator('input[type=file]').setInputFiles(fixture('no-es-nada.pdf'));

    await expect(page.getByTestId('toast-mensaje')).toContainText(/no se pudo tomar.*no-es-nada\.pdf/i, { timeout: 10_000 });
    await expect(page.getByTestId('carga-validar')).toBeDisabled();
    // «Error:» es la etiqueta propia de app-alert (visible en toda alerta de
    // error, incluidas las legítimas): lo que no puede aparecer es un
    // stacktrace real (archivo:línea o el nombre de una excepción de JS).
    await expect(page.locator('body')).not.toContainText(/\bat \S+\.ts:\d+|TypeError:|ReferenceError:/);

    esperarSinFallosInesperados(vigilante);
  });

  test(`test 5 · vacio-solo-encabezado: sin filas ${ETIQUETA}`, async ({}, testInfo) => {
    const vigilante = vigilar(page);
    const sistemaDePrueba =
      BACKEND === 'real' ? await crearSistemaDePrueba(api, token, `t5-${testInfo.testId.slice(0, 8)}`) : null;

    await irAlFormulario(page);
    await elegirModelo(page, sistemaDePrueba);

    await page
      .getByTestId('carga-archivo')
      .locator('input[type=file]')
      .setInputFiles(fixture('vacio-solo-encabezado.csv'));
    await page.getByRole('button', { name: 'Validar sin guardar' }).click();

    await expect(page.getByText(/no tiene filas/i)).toBeVisible({ timeout: 15_000 });

    esperarSinFallosInesperados(vigilante);
  });

  test('test 6 · error-red.csv: 503 conservando archivo y selects [backend simulado]', async ({}, testInfo) => {
    test.skip(BACKEND === 'real', 'error-red es una regla sólo del doble (terminology.handlers.ts:410); contra la API real ese archivo importa 50 conceptos normales.');
    const vigilante = vigilar(page);

    await irAlFormulario(page);
    await elegirModelo(page, null);

    await page.getByTestId('carga-archivo').locator('input[type=file]').setInputFiles(fixture('error-red.csv'));
    await page.getByRole('button', { name: 'Validar sin guardar' }).click();

    await expect(page.getByText(/no está disponible en este momento/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/mock-import-red/)).toBeVisible();
    // El nombre del archivo y los selects siguen intactos (contrato §3).
    await expect(page.getByText('error-red.csv')).toBeVisible();
    await expect(page.getByTestId('carga-sistema').locator('select')).not.toHaveValue('');

    // El 503 provocado por este test es el objeto de la prueba: se excluye
    // explícitamente de "0 respuestas >=500" (Q-M13, declarado).
    esperarSinFallosInesperados(vigilante, [/mock-import-red/, /^503/]);
  });

  test(`test 7 · plantilla: descarga plantilla-conceptos.csv con el encabezado ${ETIQUETA}`, async ({}, testInfo) => {
    const vigilante = vigilar(page);
    const sistemaDePrueba =
      BACKEND === 'real' ? await crearSistemaDePrueba(api, token, `t7-${testInfo.testId.slice(0, 8)}`) : null;

    await irAlFormulario(page);
    await page.getByTestId('carga-perfil').locator('select').selectOption({ label: 'Conceptos' });
    if (sistemaDePrueba === null) {
      // La plantilla no depende de sistema/versión, pero el botón se habilita
      // recién con un perfil elegido — no hace falta más.
    }

    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('carga-plantilla-csv').click(),
    ]);
    expect(descarga.suggestedFilename()).toBe('plantilla-conceptos.csv');
    const ruta = testInfo.outputPath('plantilla-conceptos.csv');
    await descarga.saveAs(ruta);
    const contenido = readFileSync(ruta, 'utf8');
    expect(contenido.split('\n')[0]?.trim()).toBe('code,display,definition');

    esperarSinFallosInesperados(vigilante);
  });

  test(`test 8 · descargar errores: CSV con encabezado y 5 filas ${ETIQUETA}`, async ({}, testInfo) => {
    const vigilante = vigilar(page);
    const sistemaDePrueba =
      BACKEND === 'real' ? await crearSistemaDePrueba(api, token, `t8-${testInfo.testId.slice(0, 8)}`) : null;
    const archivo = BACKEND === 'real' ? 'con-errores.csv' : 'con-errores.xlsx';

    await irAlFormulario(page);
    await elegirModelo(page, sistemaDePrueba);
    await page.getByTestId('carga-archivo').locator('input[type=file]').setInputFiles(fixture(archivo));
    await page.getByRole('button', { name: 'Validar sin guardar' }).click();
    await expect(page.getByTestId('carga-errores')).toBeVisible({ timeout: 15_000 });

    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('carga-descargar-errores').click(),
    ]);
    expect(descarga.suggestedFilename()).toMatch(/^errores-\d{4}-\d{2}-\d{2}\.csv$/);
    const ruta = testInfo.outputPath('errores-descargados.csv');
    await descarga.saveAs(ruta);
    const lineas = readFileSync(ruta, 'utf8').trim().split('\n');
    expect(lineas).toHaveLength(6); // encabezado + 5 filas con problemas

    esperarSinFallosInesperados(vigilante);
  });

  test(`test 9 · sin doble envío: dos clics rápidos, un solo informe ${ETIQUETA}`, async ({}, testInfo) => {
    const vigilante = vigilar(page);
    const sistemaDePrueba =
      BACKEND === 'real' ? await crearSistemaDePrueba(api, token, `t9-${testInfo.testId.slice(0, 8)}`) : null;

    let peticionesAImportFile = 0;
    const contador = (req: import('@playwright/test').Request) => {
      if (req.url().includes('/import-file')) peticionesAImportFile += 1;
    };
    page.on('request', contador);

    await irAlFormulario(page);
    await elegirModelo(page, sistemaDePrueba);
    await page.getByTestId('carga-archivo').locator('input[type=file]').setInputFiles(fixture('ok-50.csv'));

    const boton = page.getByTestId('carga-validar');
    await boton.dblclick();

    await expect(page.getByTestId('carga-informe')).toBeVisible({ timeout: 15_000 });
    expect(await page.getByTestId('carga-informe').count()).toBe(1);

    if (BACKEND === 'real') {
      expect(peticionesAImportFile, 'el doble clic sólo debe generar una petición').toBe(1);
    } else {
      // El simulador resuelve sin red (mock-backend.interceptor.ts): no hay
      // peticiones de red que contar acá, declarado (Q-M17 / §2 del PLAN.md).
      expect(peticionesAImportFile).toBe(0);
    }
    page.off('request', contador);

    esperarSinFallosInesperados(vigilante);
  });

  test(`test 10 · teclado: Tab hasta el archivo, Enter abre el diálogo, Tab hasta Validar ${ETIQUETA}`, async ({}, testInfo) => {
    const vigilante = vigilar(page);
    const sistemaDePrueba =
      BACKEND === 'real' ? await crearSistemaDePrueba(api, token, `t10-${testInfo.testId.slice(0, 8)}`) : null;

    await irAlFormulario(page);
    await elegirModelo(page, sistemaDePrueba);

    const campoDeArchivo = page.getByTestId('carga-archivo').locator('input[type=file]');
    await campoDeArchivo.focus();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
    await chooser.setFiles(fixture('ok-50.csv'));

    // Con el archivo cargado aparece "Quitar <nombre>" entre el input y
    // «Validar» (file-input.html): se tabula con tope en vez de asumir un
    // único Tab.
    const validar = page.getByTestId('carga-validar');
    let alcanzado = false;
    for (let intento = 0; intento < 6 && !alcanzado; intento++) {
      await page.keyboard.press('Tab');
      alcanzado = await validar.evaluate((el) => el === document.activeElement);
    }
    expect(alcanzado, 'no se llegó a Validar por teclado dentro del tope de Tabs').toBe(true);

    await page.keyboard.press('Enter');
    await expect(page.getByTestId('carga-informe')).toBeVisible({ timeout: 15_000 });

    esperarSinFallosInesperados(vigilante);
  });

  test(`test 11 · accesibilidad: axe sin violaciones serious/critical ${ETIQUETA}`, async ({}, testInfo) => {
    const contexto = await page.context().browser()!.newContext({ bypassCSP: true });
    const paginaAxe = await contexto.newPage();
    try {
      await entrar(paginaAxe, administrador());
      await irA(paginaAxe, RUTA);
      await esperarAplicacionLista(paginaAxe);
      await expect(paginaAxe.getByTestId('carga-perfil')).toBeVisible();

      const fuenteDeAxe = readFileSync(
        join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'),
        'utf8',
      );
      await paginaAxe.evaluate(fuenteDeAxe);
      const resultado = await paginaAxe.evaluate(async () => {
        // @ts-expect-error -- axe se inyectó como script global, sin tipos en este contexto
        return window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
        });
      });

      const graves = (resultado.violations as { impact: string; id: string }[]).filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      writeFileSync(
        testInfo.outputPath('axe-violaciones.json'),
        JSON.stringify(resultado.violations, null, 2),
      );
      expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
    } finally {
      await paginaAxe.close();
      await contexto.close();
    }
  });
});

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page, type Response } from '@playwright/test';

import {
  archivoFalso,
  esperarSubidaLista,
  pdfDePrueba,
  subirArchivo,
  subirLosCincoDocumentos,
  testIdDeDocumento,
} from './helpers/documentos-legales';
import { completarGerencias, completarRepresentanteLegal } from './helpers/representante-legal';

/**
 * Alta pública de aseguradora (`/auth/register/organization`) contra la **API
 * real**, no contra el simulador.
 *
 * ## Por qué existe
 *
 * Los specs `carril-registro-aseguradora*.spec.ts` corren con el backend
 * simulado (`mock-backend.interceptor`): prueban las validaciones del
 * formulario, pero ninguno prueba que el servidor acepte el alta. Faltaba
 * justamente eso: sin los catálogos de afiliación sembrados la API responde
 * 422 «El catálogo de documentos de afiliación no está disponible» y todo lo
 * demás pasaba en verde.
 *
 * ## Cómo se corre
 *
 * Necesita la API en `http://localhost:3000` con base sembrada y el front
 * servido con `yarn start:real-api` (proxy a la API). Sin `E2E_API_REAL=1` el
 * archivo se omite entero y lo dice, para que nadie lo lea como verde:
 *
 * ```bash
 * E2E_API_REAL=1 E2E_BASE_URL=http://localhost:4200 yarn pw registro-organizacion-api-real --workers=1
 * ```
 *
 * ## Tres escenarios
 *
 * - **Válido:** el alta completa termina en 201 y en la pantalla de éxito.
 * - **Límite:** el código más corto y el más largo que acepta el DTO, quitar un
 *   archivo y volver a subirlo, volver atrás conservando lo escrito.
 * - **Error:** código y correo repetidos (409), un archivo que dice ser PDF y
 *   no lo es (422 del servidor), y que ningún caso deja un 5xx ni un error de
 *   consola sin explicar.
 *
 * Los datos son sintéticos y únicos por corrida (sufijo `RUN`): el servidor
 * guarda de verdad, así que repetir el mismo código chocaría con el de la
 * corrida anterior.
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
const RUTA = '/auth/register/organization';
const EVIDENCIA = join(__dirname, '..', 'artifacts', 'registro-organizacion-api-real');

/** Sufijo único por corrida: el código de la organización y el correo no pueden repetirse. */
const RUN = Date.now().toString(36).toUpperCase();

/** Cuenta sintética única por prueba. */
const correoDe = (caso: string): string => `dueno.${caso}.${RUN.toLowerCase()}@alovida.test`;

/** Lo que el navegador vio fallar sin que la prueba lo esperara. */
interface Hallazgos {
  readonly erroresDeConsola: string[];
  readonly respuestas5xx: string[];
}

function vigilar(page: Page): Hallazgos {
  const hallazgos: Hallazgos = { erroresDeConsola: [], respuestas5xx: [] };
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') hallazgos.erroresDeConsola.push(mensaje.text());
  });
  page.on('response', (respuesta) => {
    if (respuesta.status() >= 500) {
      hallazgos.respuestas5xx.push(`${respuesta.status()} ${respuesta.url()}`);
    }
  });
  return hallazgos;
}

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), animations: 'disabled' });
}

async function abrirElAlta(page: Page): Promise<void> {
  await page.goto(RUTA, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('app-root')).not.toBeEmpty({ timeout: 30_000 });
  await expect(page.getByLabel('Tipo societario')).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByLabel('Tipo societario').locator('option:not([hidden])').first(),
  ).toBeAttached({ timeout: 20_000 });
}

/** Completa «La empresa» y «Datos de la aseguradora» y queda en la documentación legal. */
async function llegarADocumentos(page: Page, sigla: string): Promise<void> {
  await page.getByLabel('Nombre de la empresa').fill(`Aseguradora de Prueba ${sigla}`);
  await page.getByTestId('registro-organizacion-sigla').fill(sigla);
  await page
    .getByLabel('Tipo societario')
    .selectOption({ label: 'S.R.L. · Sociedad de Responsabilidad Limitada' });
  await page.getByTestId('paginated-form-continuar').click();

  await expect(page.locator('.paginated-form__titulo')).toHaveText('Datos de la aseguradora');
  await page.getByTestId('registro-organizacion-nit').fill('NIT-123456');
  await page.getByTestId('registro-organizacion-direccion').fill('Av. Siempre Viva 123');
  await page.getByTestId('paginated-form-continuar').click();

  await expect(page.locator('.paginated-form__titulo')).toContainText(
    'Documentación legal obligatoria (PDF)',
  );
}

/**
 * Todo el camino del alta, con los 5 PDF, el poder y las 3 gerencias, y la
 * envía. El representante legal es el owner: `correo` es el de su login.
 * El último «Continuar» —el de «Directorio ejecutivo»— es el envío, así que la
 * escucha de la respuesta se arma antes de pulsarlo.
 */
async function llegarYEnviarElAlta(page: Page, sigla: string, correo: string): Promise<Response> {
  await llegarADocumentos(page, sigla);
  await subirLosCincoDocumentos(page);
  await completarRepresentanteLegal(page, { email: correo });
  await expect(page.locator('.paginated-form__titulo')).toContainText('Directorio ejecutivo');
  const respuesta = page.waitForResponse(
    (r) => r.url().includes('/iam/auth/register-organization') && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await completarGerencias(page);
  return respuesta;
}

test.describe('alta de aseguradora contra la API real', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(
    !API_REAL,
    'Omitido: hace falta E2E_API_REAL=1 con la API y el front en modo real-api. No es un verde.',
  );

  /* ── Válido ─────────────────────────────────────────────────────────────── */

  test('válido: el alta completa responde 201 y llega a la pantalla de éxito', async ({ page }) => {
    const hallazgos = vigilar(page);
    const sigla = `OK${RUN}`;
    await abrirElAlta(page);
    const respuesta = await llegarYEnviarElAlta(page, sigla, correoDe('valido'));

    expect(respuesta.status(), await respuesta.text()).toBe(201);
    await expect(page.getByTestId('registro-organizacion-exito')).toBeVisible({ timeout: 20_000 });
    await capturar(page, 'valido-exito');
    expect(hallazgos.respuestas5xx).toEqual([]);
  });

  test('válido: «Ir a iniciar sesión» lleva a la pantalla de acceso', async ({ page }) => {
    await abrirElAlta(page);
    const respuesta = await llegarYEnviarElAlta(page, `LG${RUN}`, correoDe('login'));
    expect(respuesta.status(), await respuesta.text()).toBe(201);

    await expect(page.getByTestId('registro-organizacion-exito')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('registro-organizacion-ir-login').click();
    await expect(page).toHaveURL(/\/auth(\/login)?(\?|$)/);
  });

  test('visual: la pantalla de éxito se ve bien en móvil y en modo oscuro, y el botón sigue vivo', async ({
    page,
  }) => {
    await abrirElAlta(page);
    const respuesta = await llegarYEnviarElAlta(page, `VS${RUN}`, correoDe('visual'));
    expect(respuesta.status(), await respuesta.text()).toBe(201);
    const boton = page.getByTestId('registro-organizacion-ir-login');
    await expect(boton).toBeVisible({ timeout: 20_000 });

    await page.setViewportSize({ width: 390, height: 844 });
    await capturar(page, 'visual-exito-movil');
    const caja = await boton.boundingBox();
    expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await page.emulateMedia({ colorScheme: 'dark' });
    await capturar(page, 'visual-exito-oscuro');

    await boton.click();
    await expect(page).toHaveURL(/\/auth(\?|$)/);
  });

  /* ── Límite ─────────────────────────────────────────────────────────────── */

  test('límite: el código más corto que acepta el DTO (3 caracteres) se registra', async ({
    page,
  }) => {
    // 3 caracteres exactos, únicos por corrida dentro del alfabeto permitido.
    const corto = RUN.slice(-3).padStart(3, 'X');
    await abrirElAlta(page);
    const respuesta = await llegarYEnviarElAlta(page, corto, correoDe('corto'));

    expect(respuesta.status(), await respuesta.text()).toBe(201);
    await expect(page.getByTestId('registro-organizacion-exito')).toBeVisible({ timeout: 20_000 });
  });

  test('límite: quitar un PDF y volver a subirlo no rompe el alta', async ({ page }) => {
    await abrirElAlta(page);
    await llegarADocumentos(page, `RS${RUN}`);

    await subirArchivo(page, 'constitutionFileId', pdfDePrueba('constitucion-a'));
    await esperarSubidaLista(page, 'constitutionFileId');
    await page.getByTestId(`${testIdDeDocumento('constitutionFileId')}-quitar`).click();
    await expect(
      page.getByTestId(`${testIdDeDocumento('constitutionFileId')}-quitar`),
    ).toBeHidden();

    await subirArchivo(page, 'constitutionFileId', pdfDePrueba('constitucion-b'));
    await esperarSubidaLista(page, 'constitutionFileId');
    await capturar(page, 'limite-quitar-y-resubir');
  });

  test('límite: volver atrás conserva lo escrito', async ({ page }) => {
    await abrirElAlta(page);
    await llegarADocumentos(page, `AT${RUN}`);

    await page.getByTestId('paginated-form-atras').click();
    await expect(page.locator('.paginated-form__titulo')).toHaveText('Datos de la aseguradora');
    await expect(page.getByTestId('registro-organizacion-nit')).toHaveValue('NIT-123456');
    await page.getByTestId('paginated-form-atras').click();
    await expect(page.getByTestId('registro-organizacion-sigla')).toHaveValue(`AT${RUN}`);
  });

  /* ── Error ──────────────────────────────────────────────────────────────── */

  test('error: un código de organización repetido responde 409 y el mensaje nombra la sigla', async ({
    page,
  }) => {
    const sigla = `DUP${RUN}`;
    await abrirElAlta(page);
    const primera = await llegarYEnviarElAlta(page, sigla, correoDe('dup-1'));
    expect(primera.status(), await primera.text()).toBe(201);

    await abrirElAlta(page);
    const segunda = await llegarYEnviarElAlta(page, sigla, correoDe('dup-2'));

    expect(segunda.status()).toBe(409);
    await expect(page.getByTestId('registro-organizacion-error')).toContainText(sigla);
    await expect(page.getByTestId('registro-organizacion-exito')).toBeHidden();
    await capturar(page, 'error-sigla-repetida');
  });

  test('error: un correo ya registrado responde 409 y no pierde lo escrito', async ({ page }) => {
    const correo = correoDe('correo-repetido');
    await abrirElAlta(page);
    const primera = await llegarYEnviarElAlta(page, `C1${RUN}`, correo);
    expect(primera.status(), await primera.text()).toBe(201);

    await abrirElAlta(page);
    const segunda = await llegarYEnviarElAlta(page, `C2${RUN}`, correo);

    expect(segunda.status()).toBe(409);
    await expect(page.getByTestId('registro-organizacion-error')).toBeVisible();
    await expect(page.getByTestId('registro-organizacion-exito')).toBeHidden();
    // El formulario sigue en pantalla: se puede volver a la página del
    // representante legal, corregir el correo y reintentar.
    await expect(page.getByTestId('paginated-form-continuar')).toBeVisible();
    await capturar(page, 'error-correo-repetido');
  });

  test('error: un archivo que dice ser PDF y no lo es lo rechaza el servidor, sin 5xx', async ({
    page,
  }) => {
    const hallazgos = vigilar(page);
    await abrirElAlta(page);
    await llegarADocumentos(page, `FK${RUN}`);

    const subida = page.waitForResponse(
      (r) => r.url().includes('/iam/auth/upload-registration-document'),
      { timeout: 20_000 },
    );
    await subirArchivo(
      page,
      'constitutionFileId',
      archivoFalso('falso.pdf', 'application/pdf', 2048),
    );
    const respuesta = await subida;

    expect(respuesta.status()).toBe(422);
    await expect(
      page.getByTestId(`${testIdDeDocumento('constitutionFileId')}-quitar`),
    ).toBeHidden();
    await capturar(page, 'error-pdf-falso');
    expect(hallazgos.respuestas5xx).toEqual([]);
  });

  test('error: sin los documentos obligatorios «Continuar» no avanza', async ({ page }) => {
    await abrirElAlta(page);
    await llegarADocumentos(page, `SD${RUN}`);

    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.locator('.paginated-form__titulo')).toContainText(
      'Documentación legal obligatoria (PDF)',
    );
    await expect(page.getByText('Este documento es obligatorio para continuar').first()).toBeVisible();
  });
});

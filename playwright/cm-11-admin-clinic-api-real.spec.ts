/* ============================================================================
    CM-11 · alta **administrativa** de una clínica (`CLINIC`) contra la API
    REAL, desde `administration/organizations/new`.

    La API agregó `CLINIC` a `CreateTenantDto` y a sus tipos territoriales (le
    exige país y jurisdicción). El alta administrativa lo ofrece como
    «Clínica». Se prueba en tres casos, a 1440 y a 390 px, con su evidencia:

    - **Error**: clínica sin jurisdicción. La UI no deja pasar de «Dónde opera»
      y dice qué falta; no sale ningún `POST /admin/tenants` y no hay fila. La
      API también la rechaza (422) si se le manda directo.
    - **Límite**: razón social de 301 caracteres (la UI no deja pasar; la API
      también la rechaza con 400) y de 300 exactos (201, fila con 300).
    - **Correcto**: clínica completa → `POST /admin/tenants` con
      `tenantType: 'CLINIC'` → 201 → fila en `directory.tenants` con el concepto
      de tipo `CLINIC` → recarga → aparece en el listado.

    ## El owner se elige en la pantalla

    El buscador de owner llama a `POST /iam/users/search` (la API lo publica
    desde el PR #1001 de la API): el spec escribe el nombre del owner recién
    creado, espera la respuesta 200 de esa búsqueda y elige la opción en el
    combobox, como lo haría una persona. Nada se escribe por fuera de la UI.

    Exige la API real, el front en `real-api`, acceso de lectura a su base y
    una cuenta SUPERADMIN:

      E2E_API_REAL=1 E2E_API_URL=http://localhost:3000 \
      E2E_BASE_URL=http://localhost:4310 \
      E2E_PG_URL=postgresql://postgres:postgres@localhost:5432/alovida_api \
      E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… \
      yarn pw playwright/cm-11-admin-clinic-api-real.spec.ts

    Nunca espera `networkidle` (con `ng serve` no llega): espera selectores y
    respuestas concretas. Navega por el router (`irA`) para no gastar el cupo
    de canjes de token; recarga sólo donde el caso lo pide.
    ========================================================================== */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, request, test, type Page, type Request } from '@playwright/test';

import { administrador, urlDeApi } from './support/actores';
import { entrar, esperarAplicacionLista, irA } from './support/sesion';

const API_REAL = process.env['E2E_API_REAL'] === '1';
const PG_URL = process.env['E2E_PG_URL'] ?? '';
const RUN = Date.now().toString(36).toUpperCase();
const EVIDENCIA = join('docs', 'frontend', 'evidence', 'cm-11-organizacion-medica');
const RUTA_ALTA = '/admin/tenants';
const RUTA_FORMULARIO = '/administration/organizations/new';
const RUTA_LISTADO = '/administration/organizations';
const RUTA_BUSQUEDA_DE_USUARIOS = '/iam/users/search';

/** El concepto `CLINIC` del catálogo `tenant-type` (`TENANT_TYPE_CLINIC` de la API). */
const CONCEPTO_CLINICA = '420eddfc-a569-5b2e-b720-7d7de91cb874';

const MISSING_JURISDICTION_MESSAGE =
  'Elija la jurisdicción: sin ella este tipo de organización no se puede registrar.';
const LEGAL_NAME_MESSAGE = 'Escriba la razón social (hasta 300 caracteres).';

const VIEWPORTS = [
  { label: '1440', width: 1440, height: 900 },
  { label: '390', width: 390, height: 844 },
] as const;

/** Lo que cada caso dejó, para la tabla de evidencia del PR. */
interface Resultado {
  readonly caso: string;
  readonly ancho: string;
  readonly accion: string;
  readonly request: unknown;
  readonly status: number | 'sin request';
  readonly sql: string;
}
const resultados: Resultado[] = [];

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL || PG_URL === '' || process.env['E2E_ADMIN_EMAIL'] === undefined,
  'Omitido: hacen falta E2E_API_REAL=1, E2E_PG_URL, E2E_ADMIN_EMAIL/PASSWORD y el front en real-api. No es un verde.',
);
test.setTimeout(240_000);

test.beforeAll(() => mkdirSync(EVIDENCIA, { recursive: true }));
test.afterAll(() => {
  writeFileSync(
    join(EVIDENCIA, `admin-results-${RUN}.json`),
    JSON.stringify(resultados, null, 2),
  );
});

/* ------------------------------------------------------------- ayudantes */

function sql(consulta: string): string {
  return execFileSync('psql', [PG_URL, '-tAc', consulta], { encoding: 'utf8' }).trim();
}

const literal = (texto: string): string => `'${texto.replace(/'/g, "''")}'`;

/** Código, concepto y código de tipo, y largo de la razón social de la organización con ese código. */
function tenantRow(code: string): string {
  return sql(
    `select t.code || ' | ' || t.tenant_type_concept_id || ' | ' || tipo.code || ' | ' || length(t.legal_name)
       from directory.tenants t
       join terminology.catalog_concepts tipo on tipo.id = t.tenant_type_concept_id
      where t.code = ${literal(code)}`,
  );
}

/** El id del concepto con ese código (`BO`, `JUR_BO`: únicos en el catálogo). */
function concepto(code: string): string {
  return sql(`select id from terminology.catalog_concepts where code = ${literal(code)}`);
}

function countByCode(code: string): number {
  return Number(sql(`select count(*) from directory.tenants where code = ${literal(code)}`));
}

/**
 * Una cuenta nueva por corrida y por ancho, que queda como owner de lo que se
 * crea (`POST /iam/users`, el alta de usuario de la administración).
 *
 * No se usa la cuenta administradora: como owner de cada clínica de prueba,
 * su ingreso pasaría a pedir «Elija su organización» para siempre.
 */
async function crearOwner(
  bearer: string,
  ancho: string,
): Promise<{ id: string; displayName: string }> {
  const displayName = `Owner CM-11 ${ancho} ${RUN}`;
  const api = await request.newContext({ baseURL: urlDeApi() });
  try {
    const r = await api.post('/iam/users', {
      headers: { authorization: bearer },
      data: {
        displayName,
        email: `owner.cm11.${ancho}.${RUN.toLowerCase()}@alovida.test`,
        password: `Ow-${RUN}-${Math.random().toString(36).slice(2, 10)}`,
      },
    });
    expect(r.status(), 'POST /iam/users crea el owner').toBe(201);
    return { id: ((await r.json()) as { id: string }).id, displayName };
  } finally {
    await api.dispose();
  }
}

/** Los `POST /admin/tenants` que salen del navegador. */
function espiarAltas(page: Page): Request[] {
  const enviadas: Request[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === RUTA_ALTA) enviadas.push(r);
  });
  return enviadas;
}

/** El último bearer que usó la aplicación: sirve para preguntarle a la API directo. */
function espiarToken(page: Page): () => string {
  let token = '';
  page.on('request', (r) => {
    const valor = r.headers()['authorization'];
    if (valor?.startsWith('Bearer ')) token = valor;
  });
  return () => token;
}

async function foto(page: Page, fileName: string): Promise<void> {
  await page.screenshot({ path: join(EVIDENCIA, `${fileName}.png`), fullPage: true });
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const { documento, ventana } = await page.evaluate(() => ({
    documento: document.documentElement.scrollWidth,
    ventana: window.innerWidth,
  }));
  expect(documento, 'el documento no debe desbordar horizontalmente').toBeLessThanOrEqual(ventana);
}

const continuar = (page: Page) => page.getByTestId('paginated-form-continuar');
const pageTitle = (page: Page) => page.locator('.paginated-form__titulo');
/** El campo cuyo rótulo es `rotulo`: el texto del campo empieza por él (las ayudas pueden nombrar otro). */
const campo = (page: Page, rotulo: string) =>
  page.locator('app-form-field').filter({ hasText: new RegExp(`^\\s*${rotulo}`) });

/** Abre el formulario por el router y espera su primera página. */
async function abrirFormulario(page: Page): Promise<void> {
  // Por el listado: el router no recrea la pantalla si ya se está en ella, y
  // cada caso tiene que empezar con un formulario en blanco.
  await irA(page, RUTA_LISTADO);
  await expect(page.getByRole('heading', { level: 1, name: 'Organizaciones' })).toBeVisible();
  await irA(page, RUTA_FORMULARIO);
  await expect(page.getByRole('heading', { level: 1, name: 'Nueva organización' })).toBeVisible();
  await expect(pageTitle(page)).toHaveText('Identificación');
}

async function identificacion(page: Page, code: string, legalName: string): Promise<void> {
  const codeInput = page.getByTestId('alta-organizacion-codigo');
  await codeInput.fill(code);
  await expect(codeInput).toHaveValue(code);
  const legalNameInput = page.getByTestId('alta-organizacion-razon');
  await legalNameInput.fill(legalName);
  await expect(legalNameInput).toHaveValue(legalName);
}

async function elegirClinica(page: Page): Promise<void> {
  await expect(pageTitle(page)).toHaveText('Clasificación');
  await page.getByRole('combobox', { name: /Tipo de organización/ }).click();
  const dialogo = page.locator('dialog.select-dialog[open]');
  // «Clínica» va justo después de «Hospital», como en el alta pública.
  const rotulos = await dialogo.getByRole('option').allTextContents();
  const limpios = rotulos.map((r) => r.trim());
  expect(limpios).toContain('Clínica');
  expect(limpios.indexOf('Clínica')).toBe(limpios.indexOf('Hospital') + 1);
  await dialogo.getByRole('option', { name: 'Clínica', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /Tipo de organización/ })).toContainText(
    'Clínica',
  );
}

/** Busca en un combobox de conceptos y elige la opción cuyo código es `pista`. */
async function elegirConcepto(
  page: Page,
  rotulo: string,
  texto: string,
  pista: string,
): Promise<void> {
  const contenedor = campo(page, rotulo);
  await contenedor.getByRole('combobox').fill(texto);
  const opcion = contenedor
    .getByRole('option')
    .filter({ hasText: new RegExp(`^\\s*${texto}\\s*${pista}\\s*$`) });
  await expect(opcion).toHaveCount(1, { timeout: 15_000 });
  await opcion.click();
  await expect(contenedor.getByRole('combobox')).toHaveValue(texto);
}

/**
 * Titularidad: sin owner «Siguiente» no pasa; después se busca al owner por su
 * nombre (`POST /iam/users/search`, el texto en el cuerpo) y se lo elige.
 */
async function fijarOwner(
  page: Page,
  owner: { id: string; displayName: string },
  primeraVez: boolean,
): Promise<void> {
  await expect(pageTitle(page)).toHaveText('Titularidad');
  // Sin owner, «Siguiente» no pasa de Titularidad y el campo dice qué falta.
  await continuar(page).click();
  await expect(pageTitle(page)).toHaveText('Titularidad');
  await expect(page.getByText('Elija el usuario que queda como owner.')).toBeVisible();

  const buscador = campo(page, 'Usuario owner').getByRole('combobox');
  const [busqueda] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        new URL(r.url()).pathname === RUTA_BUSQUEDA_DE_USUARIOS &&
        (r.request().postDataJSON() as { q?: string }).q === owner.displayName,
      { timeout: 30_000 },
    ),
    buscador.fill(owner.displayName),
  ]);
  expect(busqueda.status(), 'POST /iam/users/search responde').toBe(200);
  // El texto viaja en el cuerpo, no en la URL.
  expect(new URL(busqueda.url()).search).toBe('');
  const encontrados = ((await busqueda.json()) as { items: readonly { id: string }[] }).items;
  expect(encontrados.map((u) => u.id)).toContain(owner.id);

  const opcion = campo(page, 'Usuario owner')
    .getByRole('option')
    .filter({ hasText: owner.displayName });
  await expect(opcion).toHaveCount(1, { timeout: 15_000 });
  await opcion.click();
  await expect(buscador).toHaveValue(owner.displayName);
  await expect(page.getByText('Elija el usuario que queda como owner.')).toHaveCount(0);
  if (primeraVez) {
    await foto(page, `admin-${page.viewportSize()?.width ?? 0}-owner-chosen`);
  }
}

/** De «Dónde opera» al envío: owner, datos operativos y «Registrar organización». */
async function terminarYEnviar(
  page: Page,
  owner: { id: string; displayName: string },
  primeraVez: boolean,
): Promise<void> {
  await continuar(page).click();
  await fijarOwner(page, owner, primeraVez);
  await continuar(page).click();
  await expect(pageTitle(page)).toHaveText('Datos operativos');
  await expect(continuar(page)).toHaveText(/Registrar organización/);
}

/* ---------------------------------------------------------------- casos */

for (const vista of VIEWPORTS) {
  test(`alta administrativa de una clínica · ${vista.label} px`, async ({ page }) => {
    await page.setViewportSize({ width: vista.width, height: vista.height });
    const altas = espiarAltas(page);
    const token = espiarToken(page);
    await entrar(page, administrador());
    await expect.poll(token, { message: 'la aplicación usa un bearer' }).not.toBe('');
    const owner = await crearOwner(token(), vista.label);
    const ownerId = owner.id;
    let primeraVez = true;

    /* ---- error: clínica sin jurisdicción ---- */
    await test.step('error · clínica sin jurisdicción', async () => {
      const code = `CLIN-ERR-${vista.label}-${RUN}`;
      await abrirFormulario(page);
      await identificacion(page, code, `Clínica sin jurisdicción ${RUN}`);
      await continuar(page).click();
      await elegirClinica(page);
      await continuar(page).click();

      await expect(pageTitle(page)).toHaveText('Dónde opera');
      await elegirConcepto(page, 'País', 'Bolivia', 'BO');
      await continuar(page).click();

      // No pasa: la página sigue y el campo dice qué falta.
      await expect(pageTitle(page)).toHaveText('Dónde opera');
      await expect(campo(page, 'Jurisdicción')).toContainText(MISSING_JURISDICTION_MESSAGE);
      await assertNoHorizontalOverflow(page);
      await foto(page, `admin-${vista.label}-error-clinic-no-jurisdiction`);

      expect(altas, 'ningún POST /admin/tenants salió del navegador').toHaveLength(0);
      expect(countByCode(code)).toBe(0);

      // La API lo exige igual: la regla no es sólo de la pantalla.
      const api = await request.newContext({ baseURL: urlDeApi() });
      const directo = await api.post(RUTA_ALTA, {
        headers: { authorization: token() },
        data: {
          code,
          legalName: `Clínica sin jurisdicción ${RUN}`,
          ownerUserId: ownerId,
          tenantType: 'CLINIC',
          countryConceptId: concepto('BO'),
        },
      });
      const cuerpo = await directo.text();
      await api.dispose();
      expect(directo.status()).toBe(422);
      expect(countByCode(code)).toBe(0);

      resultados.push({
        caso: 'error',
        ancho: vista.label,
        accion: 'CLINIC con país y sin jurisdicción: «Siguiente» en «Dónde opera»',
        request: 'sin request (la UI no deja pasar)',
        status: 'sin request',
        sql: `count(*) where code='${code}' = 0`,
      });
      resultados.push({
        caso: 'error (API directa)',
        ancho: vista.label,
        accion: 'POST /admin/tenants CLINIC sin jurisdictionConceptId',
        request: { tenantType: 'CLINIC', jurisdictionConceptId: '(ausente)' },
        status: directo.status(),
        sql: `count(*) where code='${code}' = 0 · ${cuerpo.slice(0, 160)}`,
      });
    });

    /* ---- límite: razón social de 301 y de 300 ---- */
    await test.step('límite · razón social 301 rechazada y 300 aceptada', async () => {
      const code = `CLIN-LIM-${vista.label}-${RUN}`;
      // Con palabras, como una razón social de verdad: 300 caracteres exactos.
      const base = `Clínica límite ${vista.label} ${RUN}`;
      let legalName300 = base;
      while (legalName300.length < 300) legalName300 += ' de salud integral y especialidades';
      legalName300 = legalName300.slice(0, 299).trimEnd();
      legalName300 += 'x'.repeat(300 - legalName300.length);
      const legalName301 = legalName300 + 'x';
      expect(legalName300).toHaveLength(300);

      await abrirFormulario(page);
      await identificacion(page, code, legalName301);
      await continuar(page).click();
      await expect(pageTitle(page)).toHaveText('Identificación');
      await expect(campo(page, 'Razón social')).toContainText(LEGAL_NAME_MESSAGE);
      await assertNoHorizontalOverflow(page);
      await foto(page, `admin-${vista.label}-limit-legal-name-301`);
      expect(altas).toHaveLength(0);

      // La API pone el mismo borde.
      const api = await request.newContext({ baseURL: urlDeApi() });
      const directo = await api.post(RUTA_ALTA, {
        headers: { authorization: token() },
        data: {
          code: `${code}-API`,
          legalName: legalName301,
          ownerUserId: ownerId,
          tenantType: 'PAYER',
        },
      });
      await api.dispose();
      expect(directo.status()).toBe(400);
      expect(countByCode(`${code}-API`)).toBe(0);
      resultados.push({
        caso: 'límite (301)',
        ancho: vista.label,
        accion: 'razón social de 301 caracteres: «Siguiente» en «Identificación»; y POST directo',
        request: 'sin request desde la UI · POST directo con legalName de 301',
        status: directo.status(),
        sql: `count(*) where code='${code}-API' = 0`,
      });

      // 300 exactos: pasa y se crea.
      const legalNameInput = page.getByTestId('alta-organizacion-razon');
      await legalNameInput.fill(legalName300);
      await expect(legalNameInput).toHaveValue(legalName300);
      await continuar(page).click();
      await elegirClinica(page);
      await continuar(page).click();
      await expect(pageTitle(page)).toHaveText('Dónde opera');
      await elegirConcepto(page, 'País', 'Bolivia', 'BO');
      await elegirConcepto(page, 'Jurisdicción', 'Bolivia', 'JUR_BO');
      await terminarYEnviar(page, owner, primeraVez);
      primeraVez = false;

      const [respuesta] = await Promise.all([
        page.waitForResponse(
          (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === RUTA_ALTA,
        ),
        continuar(page).click(),
      ]);
      expect(respuesta.status()).toBe(201);
      const cuerpo = respuesta.request().postDataJSON() as {
        legalName: string;
        tenantType: string;
      };
      expect(cuerpo.legalName).toHaveLength(300);
      expect(cuerpo.tenantType).toBe('CLINIC');
      await page.waitForURL((u) => u.pathname === RUTA_LISTADO);

      const fila = tenantRow(code);
      expect(fila).toBe(`${code} | ${CONCEPTO_CLINICA} | CLINIC | 300`);
      resultados.push({
        caso: 'límite (300)',
        ancho: vista.label,
        accion: 'razón social de 300 caracteres exactos, CLINIC completa',
        request: { ...cuerpo, legalName: `(${cuerpo.legalName.length} caracteres)` },
        status: respuesta.status(),
        sql: fila,
      });
      await foto(page, `admin-${vista.label}-limit-legal-name-300-created`);
    });

    /* ---- correcto: clínica completa, recarga y listado ---- */
    await test.step('correcto · clínica creada y listada tras recargar', async () => {
      const code = `CLIN-OK-${vista.label}-${RUN}`;
      const legalName = `Clínica Norte ${vista.label} ${RUN} S.R.L.`;
      await abrirFormulario(page);
      await identificacion(page, code, legalName);
      await continuar(page).click();
      await elegirClinica(page);
      await foto(page, `admin-${vista.label}-ok-1-clinic-type`);
      await continuar(page).click();

      await expect(pageTitle(page)).toHaveText('Dónde opera');
      await elegirConcepto(page, 'País', 'Bolivia', 'BO');
      await elegirConcepto(page, 'Jurisdicción', 'Bolivia', 'JUR_BO');
      await assertNoHorizontalOverflow(page);
      await foto(page, `admin-${vista.label}-ok-2-where-it-operates`);
      await terminarYEnviar(page, owner, primeraVez);

      const [respuesta] = await Promise.all([
        page.waitForResponse(
          (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === RUTA_ALTA,
        ),
        continuar(page).click(),
      ]);
      const enviado = respuesta.request().postDataJSON() as Record<string, unknown>;
      expect(enviado).toMatchObject({
        code,
        legalName: legalName,
        ownerUserId: ownerId,
        tenantType: 'CLINIC',
      });
      expect(enviado['countryConceptId']).toBe(concepto('BO'));
      expect(enviado['jurisdictionConceptId']).toBe(concepto('JUR_BO'));
      expect(respuesta.status()).toBe(201);

      const fila = tenantRow(code);
      expect(fila).toBe(`${code} | ${CONCEPTO_CLINICA} | CLINIC | ${legalName.length}`);
      // El owner elegido en la pantalla quedó con su membresía en la clínica.
      const membresia = sql(
        `select tipo.code from directory.tenant_memberships m
           join directory.tenants t on t.id = m.tenant_id
           join terminology.catalog_concepts tipo on tipo.id = m.tenant_role_concept_id
          where t.code = ${literal(code)} and m.user_id = ${literal(ownerId)}`,
      );
      expect(membresia, 'una membresía del owner elegido').not.toBe('');

      // Recarga: lo que se ve sale de la API, no de lo que quedó en memoria.
      await page.waitForURL((u) => u.pathname === RUTA_LISTADO);
      await page.reload();
      await esperarAplicacionLista(page);
      // Se busca por el código: la API filtra (`GET /admin/tenants?q=`) y la
      // tabla queda con una sola fila, la de la clínica recién creada.
      const buscador = page.getByLabel('Buscar organizaciones');
      const [busqueda] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.request().method() === 'GET' &&
            new URL(r.url()).pathname === RUTA_ALTA &&
            new URL(r.url()).searchParams.get('q') === code,
        ),
        buscador.fill(code),
      ]);
      expect(busqueda.status()).toBe(200);
      const filas = page.locator('tbody').getByRole('row');
      await expect(filas).toHaveCount(1, { timeout: 20_000 });
      const filaEnPantalla = filas.filter({ hasText: legalName });
      await expect(filaEnPantalla).toBeVisible();
      // La columna «Tipo» dice «Clínica»: sale del catálogo, por el concepto de la fila.
      await expect(filaEnPantalla.locator('app-badge').first()).toHaveText(/^\s*Clínica\s*$/);
      await assertNoHorizontalOverflow(page);
      await foto(page, `admin-${vista.label}-ok-3-list-after-reload`);

      resultados.push({
        caso: 'correcto',
        ancho: vista.label,
        accion: 'CLINIC con país BO y jurisdicción JUR_BO → recarga → listado',
        request: enviado,
        status: respuesta.status(),
        sql: `${fila} · membresía del owner: ${membresia}`,
      });
    });

    expect(altas.length, 'dos altas por ancho: la de 300 y la correcta').toBe(2);
  });
}

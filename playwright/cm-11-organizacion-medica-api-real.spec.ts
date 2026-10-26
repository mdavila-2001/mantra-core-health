/* ============================================================================
    CM-11 · alta pública de una **organización médica** contra la API REAL.

    El alta deja elegir el tipo de institución —Hospital, Clínica, Consultorio
    médico, Centro de enfermería u Otra institución de salud— y manda su código
    en `tenantType`. Se prueba en tres casos, cada uno con su evidencia:

    - **Correcto**, por tipo: UI → `POST /iam/auth/register-organization` con el
      `tenantType` del tipo elegido → 201 → fila en `directory.tenants` cuyo
      concepto de tipo es ese código → login real de la cuenta nueva en la UI →
      el menú ofrece «Configurar su organización», que sólo existe para una
      organización médica (lo decide el tipo que viaja en el token), y no
      ofrece la cara de aseguradora. Al entrar a configurarla, como la
      organización nace sin verificar, la pantalla lo dice (S3) en vez de
      dejar completar el formulario para recibir el 422.
    - **Límite**: razón social de 300 caracteres exactos (201) y de 301 (la UI
      no envía; la API también la rechaza con 400); contraseña de 8 (201) y de
      7 (la UI no envía; la API también la rechaza con 400).
    - **Error**: sin tipo de institución (la UI lo marca y no sale a la red) y
      correo ya registrado (409, mensaje en la UI, ninguna fila nueva).

    Un tipo que la API de este entorno no publica en su catálogo `tenant-type`
    no se ofrece en la pantalla; su caso se omite **diciéndolo**, no en verde.

    Exige la API real, el front en `real-api` y acceso de lectura a su base:

      E2E_API_REAL=1 E2E_API_URL=http://localhost:3100 \
      E2E_BASE_URL=http://localhost:4300 \
      E2E_PG_URL=postgresql://postgres:postgres@localhost:5432/alovida_front \
      yarn pw playwright/cm-11-organizacion-medica-api-real.spec.ts

    Nunca espera `networkidle` (con `ng serve` no llega): espera selectores y
    respuestas concretas. Las rutas de alta y de login tienen límite por IP: se
    respeta con una pausa antes de cada envío, en vez de desactivarlo.

    Cada prueba junta los errores de consola, los `pageerror` y las requests
    fallidas, y exige cero (`visual-quality-gate`). Las capturas se toman
    después de que terminen las animaciones finitas, y con `animations:
    'disabled'` como segundo cinturón: una captura a mitad de la entrada no
    prueba nada. No se emula `prefers-reduced-motion`: con él el router salta
    cada transición de vista y Chromium anota un `AbortError` por navegación
    (hallazgo aparte, fuera de esta pantalla).
    ========================================================================== */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, request, test, type Page, type Request, type Response } from '@playwright/test';

import { urlDeApi } from './support/actores';
import { esperarAplicacionLista } from './support/sesion';

const API_REAL = process.env['E2E_API_REAL'] === '1';
const PG_URL = process.env['E2E_PG_URL'] ?? '';
const RUN = Date.now().toString(36).toUpperCase();
const RUTA_ALTA = '/iam/auth/register-organization';
const PAUSA_DEL_LIMITADOR_MS = 7_000;
const EVIDENCIA = join('docs', 'frontend', 'evidence', 'cm-11-organizacion-medica');

const ESCRITORIO = { width: 1440, height: 900 } as const;
const TELEFONO = { width: 390, height: 844 } as const;
/**
 * Los anchos de referencia. `sinScroll`: los monitores de escritorio en los
 * que la primera página tiene que verse entera —con «Siguiente»— sin
 * desplazar (los de las salas: 1024x768, 1280x720, 1366x768 y 1440x900).
 */
const VIEWPORTS = [
  { label: '390x844', width: 390, height: 844, sinScroll: false },
  { label: '768x1024', width: 768, height: 1024, sinScroll: false },
  { label: '1024x768', width: 1024, height: 768, sinScroll: true },
  { label: '1280x720', width: 1280, height: 720, sinScroll: true },
  { label: '1366x768', width: 1366, height: 768, sinScroll: true },
  { label: '1440x900', width: 1440, height: 900, sinScroll: true },
  { label: '1920x1080', width: 1920, height: 1080, sinScroll: false },
] as const;

/** La cara de aseguradora del menú: una organización médica no la ve. */
const RUTAS_DE_ASEGURADORA = [
  '/administration/insurance',
  '/administration/insurance-analytics',
  '/administration/received-claims',
  '/administration/insurance-patients',
  '/administration/insurance-campaigns',
] as const;

/** Los cinco tipos, con el rótulo que muestra la pantalla y el ancho al que se prueban. */
const TIPOS = [
  { codigo: 'HOSPITAL', rotulo: 'Hospital', viewport: ESCRITORIO },
  { codigo: 'CLINIC', rotulo: 'Clínica', viewport: ESCRITORIO },
  { codigo: 'MEDICAL_OFFICE', rotulo: 'Consultorio médico', viewport: ESCRITORIO },
  { codigo: 'NURSING', rotulo: 'Centro de enfermería', viewport: TELEFONO },
  { codigo: 'HEALTH_OTHER', rotulo: 'Otra institución de salud', viewport: TELEFONO },
] as const;

/** Lo que cada caso dejó, para la tabla de evidencia del PR. */
interface Resultado {
  readonly caso: string;
  readonly accion: string;
  readonly request: unknown;
  readonly status: number | 'sin request';
  readonly sql: string;
}
const resultados: Resultado[] = [];

/** La cuenta del primer alta correcta: el caso del correo duplicado la reutiliza. */
let correoRegistrado: string | null = null;

/** La razón social de 300 del caso límite: la tira de «A» sin espacios estira lo que no parte. */
let razonSocialLarga: string | null = null;

const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'];
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'];

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL || PG_URL === '',
  'Omitido: hacen falta E2E_API_REAL=1, E2E_PG_URL y el front en real-api. No es un verde.',
);
test.setTimeout(180_000);

test.beforeAll(() => mkdirSync(EVIDENCIA, { recursive: true }));
test.afterAll(() => {
  writeFileSync(join(EVIDENCIA, `resultados-${RUN}.json`), JSON.stringify(resultados, null, 2));
});

/* ------------------------------------------------------------- ayudantes */

/** Una consulta a la base de la API, en texto plano (`psql -tA`). */
function sql(consulta: string): string {
  return execFileSync('psql', [PG_URL, '-tAc', consulta], { encoding: 'utf8' }).trim();
}

const literal = (texto: string): string => `'${texto.replace(/'/g, "''")}'`;

/** El tipo, el estado de verificación y el largo del nombre de la organización con esa razón social. */
function filaDeOrganizacion(razonSocial: string): string {
  return sql(
    `select t.code || ' | ' || tipo.code || ' | ' || verif.code || ' | ' || length(t.legal_name)
       from directory.tenants t
       join terminology.catalog_concepts tipo on tipo.id = t.tenant_type_concept_id
       join terminology.catalog_concepts verif on verif.id = t.verification_status_concept_id
      where t.legal_name = ${literal(razonSocial)}`,
  );
}

/** Los códigos del catálogo `tenant-type` que publica la API de este entorno. */
async function tiposPublicados(): Promise<readonly string[]> {
  const api = await request.newContext({ baseURL: urlDeApi() });
  try {
    const r = await api.get('/system-context/dynamic-enums', {
      params: { target: 'directory.tenants.tenant_type_concept_id' },
    });
    const cuerpo = (await r.json()) as { options: readonly { code: string }[] };
    return cuerpo.options.map((o) => o.code);
  } finally {
    await api.dispose();
  }
}

/** Un `POST` de alta directo a la API, para probar que el borde es suyo y no sólo de la pantalla. */
async function altaDirecta(organizacion: Record<string, string>, password: string): Promise<number> {
  const api = await request.newContext({ baseURL: urlDeApi() });
  try {
    const concepto = async (target: string, code: string): Promise<string> => {
      const r = await api.get('/system-context/dynamic-enums', { params: { target } });
      const cuerpo = (await r.json()) as { options: readonly { code: string; conceptId: string }[] };
      return cuerpo.options.find((o) => o.code === code)?.conceptId ?? '';
    };
    await new Promise((listo) => setTimeout(listo, PAUSA_DEL_LIMITADOR_MS));
    const r = await api.post(RUTA_ALTA, {
      data: {
        organization: {
          legalEntityType: 'SRL',
          countryConceptId: await concepto('directory.tenants.country_concept_id', 'BO'),
          jurisdictionConceptId: await concepto(
            'profiles.jurisdiction_authorizations.jurisdiction_concept_id',
            'JURISDICTION_NATIONAL',
          ),
          ...organizacion,
        },
        owner: { email: `directa.${Date.now()}@alovida.test`, password, displayName: 'Prueba Directa' },
      },
    });
    return r.status();
  } finally {
    await api.dispose();
  }
}

/** Registra cada `POST` de alta que sale del navegador. */
function espiarAltas(page: Page): Request[] {
  const enviadas: Request[] = [];
  page.on('request', (r) => {
    if (r.url().includes(RUTA_ALTA) && r.method() === 'POST') enviadas.push(r);
  });
  return enviadas;
}

/** El cuerpo de la request, sin la contraseña: va a la evidencia. */
function sinClave(req: Request): unknown {
  const cuerpo = req.postDataJSON() as { owner?: Record<string, unknown> };
  return { ...cuerpo, owner: { ...cuerpo.owner, password: '***' } };
}

/**
 * Lo que la página dijo mal mientras se probaba: errores de consola,
 * excepciones y requests que no llegaron. `permitido` deja pasar lo que la
 * prueba provoca a propósito (el 409 del correo duplicado), nombrándolo.
 */
interface Vigia {
  readonly problemas: string[];
  permitir(patron: RegExp): void;
}

function vigilar(page: Page): Vigia {
  const problemas: string[] = [];
  const permitidos: RegExp[] = [];
  const anotar = (texto: string) => {
    if (!permitidos.some((patron) => patron.test(texto))) problemas.push(texto);
  };
  page.on('console', (m) => {
    if (m.type() === 'error') anotar(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => anotar(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    // `ERR_ABORTED` es la request que el propio navegador corta al navegar a
    // otra página (p. ej. del alta al acceso): no llegó porque ya no hacía
    // falta, no porque fallara.
    const motivo = r.failure()?.errorText ?? '';
    if (motivo.includes('ERR_ABORTED')) return;
    anotar(`requestfailed: ${r.method()} ${r.url()} ${motivo}`);
  });
  return { problemas, permitir: (patron) => permitidos.push(patron) };
}

/**
 * Espera a que terminen las animaciones finitas **que están corriendo**: las
 * infinitas y las pausadas no terminan nunca (el panel del owner tiene una
 * pausada hasta que entra en vista). Con un techo de 5 s, después del cual
 * `animations: 'disabled'` de la captura las lleva a su estado final.
 */
async function quieta(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const corriendo = document.getAnimations().filter((animacion) => {
      const iteraciones = animacion.effect?.getComputedTiming().iterations ?? 1;
      return Number.isFinite(iteraciones) && animacion.playState === 'running';
    });
    const techo = new Promise((listo) => setTimeout(listo, 5_000));
    await Promise.race([
      Promise.all(corriendo.map((animacion) => animacion.finished.catch(() => undefined))),
      techo,
    ]);
  });
}

async function foto(page: Page, nombre: string, completa = true): Promise<void> {
  await quieta(page);
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), fullPage: completa, animations: 'disabled' });
}

/**
 * Todo botón de acción del formulario —«Atrás», «Siguiente», el envío— queda
 * dentro de la tarjeta y de la ventana. A 390 px «Atrás» se salía 7 px por la
 * izquierda cuando el envío era largo (H1 de la revisión visual).
 */
async function accionesDentro(page: Page): Promise<void> {
  const fuera = await page.evaluate(() => {
    const tarjeta = document.querySelector('.registro')?.getBoundingClientRect();
    if (tarjeta === undefined) return ['sin tarjeta'];
    return [...document.querySelectorAll('.paginated-form__acciones button')]
      .map((boton) => ({ texto: boton.textContent?.trim() ?? '', r: boton.getBoundingClientRect() }))
      .filter(
        ({ r }) =>
          r.left < tarjeta.left - 1 ||
          r.right > tarjeta.right + 1 ||
          r.left < 0 ||
          r.right > window.innerWidth,
      )
      .map(({ texto, r }) => `${texto}: ${Math.round(r.left)}–${Math.round(r.right)}`);
  });
  expect(fuera, 'ningún botón de acción fuera de la tarjeta ni de la ventana').toEqual([]);
}

/**
 * Sin desborde del documento **ni de los campos**: un control más ancho que su
 * rejilla no desborda el documento (la tarjeta lo recorta) pero queda cortado,
 * que es lo que pasaba a 390 px con una opción larga elegida en el desplegable.
 */
async function sinDesbordeHorizontal(page: Page): Promise<void> {
  const { documento, ventana, camposFuera } = await page.evaluate(() => {
    const rejilla = document.querySelector('.paginated-form__campos')?.getBoundingClientRect();
    const campos = [...document.querySelectorAll('.paginated-form__campo')];
    return {
      documento: document.documentElement.scrollWidth,
      ventana: window.innerWidth,
      camposFuera:
        rejilla === undefined
          ? []
          : campos
              .filter((campo) => campo.getBoundingClientRect().right > rejilla.right + 1)
              .map((campo) => campo.textContent?.trim().slice(0, 40) ?? ''),
    };
  });
  expect(documento, 'el documento no debe desbordar horizontalmente').toBeLessThanOrEqual(ventana);
  expect(camposFuera, 'ningún campo debe salirse de la rejilla del formulario').toEqual([]);
}

async function abrirAlta(page: Page): Promise<void> {
  await page.goto('/auth/register/medical-center', { waitUntil: 'domcontentloaded' });
  await esperarAplicacionLista(page);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Registre su organización médica' }),
  ).toBeVisible();
  // El catálogo de tipos llega después de pintar: se espera a la primera opción.
  await expect(page.getByTestId('medical-center-signup-tenant-type').getByRole('radio').first()).toBeAttached({
    timeout: 20_000,
  });
}

async function escribir(page: Page, testId: string, texto: string): Promise<void> {
  const campo = page.getByTestId(testId);
  await campo.fill(texto);
  if ((await campo.inputValue()) !== texto) await campo.fill(texto);
  await expect(campo).toHaveValue(texto);
}

async function elegirTipo(page: Page, rotulo: string): Promise<void> {
  const grupo = page.getByTestId('medical-center-signup-tenant-type');
  await grupo.getByText(rotulo, { exact: true }).click();
  await expect(grupo.getByRole('radio', { name: rotulo, exact: true })).toBeChecked();
}

/** `app-select` es un combobox propio que abre un `<dialog>`, no un `<select>` nativo. */
async function elegirTipoSocietario(page: Page): Promise<void> {
  await page.getByTestId('medical-center-signup-legal-entity-type').getByRole('combobox').click();
  const dialogo = page.locator('dialog.select-dialog[open]');
  await dialogo.getByRole('option', { name: /Responsabilidad Limitada/i }).first().click();
  await expect(dialogo).toHaveCount(0);
}

async function continuar(page: Page): Promise<void> {
  const boton = page.getByTestId('paginated-form-continuar').last();
  await expect(boton).toBeEnabled({ timeout: 20_000 });
  await boton.click();
}

/** Completa la primera página. `rotulo` en `null` deja el tipo sin elegir. */
async function paginaOrganizacion(page: Page, rotulo: string | null, razonSocial: string): Promise<void> {
  if (rotulo !== null) await elegirTipo(page, rotulo);
  await escribir(page, 'medical-center-signup-legal-name', razonSocial);
  await elegirTipoSocietario(page);
}

async function paginaCuenta(page: Page, correo: string, password: string): Promise<void> {
  await expect(page.getByTestId('medical-center-signup-owner-name')).toBeVisible({ timeout: 20_000 });
  await escribir(page, 'medical-center-signup-owner-name', 'Marta Rojas');
  await escribir(page, 'medical-center-signup-email', correo);
  await escribir(page, 'medical-center-signup-password', password);
}

/** Envía la última página y devuelve la respuesta del alta. */
async function enviar(page: Page): Promise<Response> {
  await page.waitForTimeout(PAUSA_DEL_LIMITADOR_MS);
  const respuesta = page.waitForResponse((r) => r.url().includes(RUTA_ALTA) && r.request().method() === 'POST', {
    timeout: 30_000,
  });
  await continuar(page);
  return respuesta;
}

/** Entra en la UI con la cuenta recién creada: la recarga que relee lo persistido. */
async function entrarConLaCuentaNueva(page: Page, correo: string, password: string): Promise<void> {
  await page.getByTestId('medical-center-signup-go-to-login').click();
  await page.waitForURL((u) => u.pathname === '/auth', { timeout: 30_000 });
  await esperarAplicacionLista(page);
  await escribir(page, 'login-identifier', correo);
  await escribir(page, 'login-password', password);
  await page.waitForTimeout(PAUSA_DEL_LIMITADOR_MS);
  await page.getByTestId('login-submit').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
  await esperarAplicacionLista(page);
}

/* ------------------------------------------------------------- correcto */

test.describe('correcto: alta completa por tipo de institución', () => {
  for (const tipo of TIPOS) {
    test(`${tipo.rotulo} → tenantType ${tipo.codigo}, 201, fila en Postgres y menú tras el login`, async ({
      page,
    }) => {
      test.skip(
        !(await tiposPublicados()).includes(tipo.codigo),
        `La API de este entorno no publica ${tipo.codigo} en el catálogo tenant-type: la pantalla no lo ofrece.`,
      );
      const vigia = vigilar(page);
      await page.setViewportSize(tipo.viewport);
      const ancho = tipo.viewport.width;
      const razonSocial = `${tipo.rotulo} Prueba ${RUN}`;
      const correo = `org.${tipo.codigo.toLowerCase()}.${RUN}@alovida.test`.toLowerCase();
      const password = 'Organizacion-2026';

      await abrirAlta(page);
      await paginaOrganizacion(page, tipo.rotulo, razonSocial);
      await sinDesbordeHorizontal(page);
      await foto(page, `${ancho}-correcto-${tipo.codigo}-1-organizacion`);
      await continuar(page);
      await paginaCuenta(page, correo, password);
      await sinDesbordeHorizontal(page);
      await accionesDentro(page);
      await expect(page.getByTestId('paginated-form-atras')).toBeInViewport({ ratio: 1 });
      await foto(page, `${ancho}-correcto-${tipo.codigo}-2-cuenta`);

      const respuesta = await enviar(page);
      const cuerpo = respuesta.request().postDataJSON() as { organization: { tenantType: string } };
      expect(cuerpo.organization.tenantType).toBe(tipo.codigo);
      expect(respuesta.status()).toBe(201);

      await expect(page.getByTestId('medical-center-signup-success')).toBeVisible();
      await expect(page.getByTestId('medical-center-signup-pending')).toContainText('pendiente de verificación');
      await sinDesbordeHorizontal(page);
      await foto(page, `${ancho}-correcto-${tipo.codigo}-3-exito`);

      const fila = filaDeOrganizacion(razonSocial);
      expect(fila.split(' | ')[1]).toBe(tipo.codigo);
      correoRegistrado ??= correo;

      await entrarConLaCuentaNueva(page, correo, password);
      await expect(page.locator('a[href="/administration/medical-center-setup"]').first()).toBeAttached();
      // M5: la cara de aseguradora no se le ofrece a una organización médica;
      // «Solicitudes de seguro», la del prestador, sí.
      for (const ruta of RUTAS_DE_ASEGURADORA) {
        await expect(page.locator(`a[href="${ruta}"]`), ruta).toHaveCount(0);
      }
      await expect(page.locator('a[href="/administration/insurance-claims"]').first()).toBeAttached();
      await sinDesbordeHorizontal(page);
      await foto(page, `${ancho}-correcto-${tipo.codigo}-4-sesion-del-owner`, false);

      // La puerta que el tipo abre: la ruta sólo existe para una organización
      // médica. La organización nace sin verificar, y la pantalla lo dice al
      // entrar (S3, con su próxima acción) en vez de ofrecer el formulario.
      await page.goto('/administration/medical-center-setup', { waitUntil: 'domcontentloaded' });
      await esperarAplicacionLista(page);
      await expect(page.getByRole('heading', { level: 1, name: 'Configurar su organización' })).toBeVisible({
        timeout: 30_000,
      });
      const sinVerificar = page.getByTestId('medical-center-setup-unverified');
      await expect(sinVerificar).toBeVisible({ timeout: 30_000 });
      await expect(sinVerificar).toContainText('todavía no fue verificada');
      await expect(sinVerificar.getByRole('link', { name: 'Ver los datos de su organización' })).toHaveAttribute(
        'href',
        '/administration/my-organization',
      );
      await expect(page.getByTestId('medical-center-setup-form')).toHaveCount(0);
      // El código que guarda la base para «sin verificar».
      expect(fila.split(' | ')[2]).toBe('directory:TENANT_UNVERIFIED');
      await sinDesbordeHorizontal(page);
      await foto(page, `${ancho}-correcto-${tipo.codigo}-5-configurar-organizacion`, false);
      expect(vigia.problemas).toEqual([]);

      resultados.push({
        caso: `Correcto · ${tipo.rotulo}`,
        accion: `Elegir «${tipo.rotulo}», completar las dos páginas y enviar; después entrar con la cuenta`,
        request: sinClave(respuesta.request()),
        status: respuesta.status(),
        sql: fila,
      });
    });
  }
});

/* --------------------------------------------------------------- límite */

test.describe('límite', () => {
  test('razón social de 300 caracteres exactos y contraseña de 8: 201', async ({ page }) => {
    const vigia = vigilar(page);
    await page.setViewportSize(ESCRITORIO);
    const prefijo = `Consultorio Borde ${RUN} `;
    const razonSocial = prefijo + 'A'.repeat(300 - prefijo.length);
    expect(razonSocial).toHaveLength(300);
    const correo = `org.borde.${RUN}@alovida.test`.toLowerCase();
    const password = 'Ocho-8ch';
    expect(password).toHaveLength(8);

    await abrirAlta(page);
    await paginaOrganizacion(page, 'Consultorio médico', razonSocial);
    await continuar(page);
    await paginaCuenta(page, correo, password);
    const respuesta = await enviar(page);

    expect(respuesta.status()).toBe(201);
    await expect(page.getByTestId('medical-center-signup-success')).toBeVisible();
    const fila = filaDeOrganizacion(razonSocial);
    expect(fila.split(' | ')[1]).toBe('MEDICAL_OFFICE');
    expect(fila.split(' | ')[3]).toBe('300');
    razonSocialLarga = razonSocial;
    // L4: el botón del éxito va a su medida en escritorio, no a lo ancho.
    const cta = await page.getByTestId('medical-center-signup-go-to-login').boundingBox();
    expect(cta?.width ?? 0).toBeLessThan(400);
    await foto(page, '1440-limite-300-y-clave-8-exito');

    // Una razón social de 300 con una tira larga sin espacios no estira la
    // ficha de «Elija su organización» fuera de su tarjeta (ni a 390).
    await entrarConLaCuentaNueva(page, correo, password);
    for (const vista of [TELEFONO, ESCRITORIO]) {
      await page.setViewportSize(vista);
      await page.goto('/auth/organization', { waitUntil: 'domcontentloaded' });
      await esperarAplicacionLista(page);
      const opcion = page.getByTestId('tenant-opcion').first();
      await expect(opcion).toContainText('AAAAAAAAAA');
      const medidas = await page.evaluate(() => {
        const tarjeta = document.querySelector('.tenant__card')!.getBoundingClientRect();
        const ficha = document.querySelector('[data-testid="tenant-opcion"]')!.getBoundingClientRect();
        return {
          tarjeta: [tarjeta.left, tarjeta.right],
          ficha: [ficha.left, ficha.right],
          documento: document.documentElement.scrollWidth,
          ventana: window.innerWidth,
        };
      });
      expect(medidas.ficha[0]).toBeGreaterThanOrEqual(medidas.tarjeta[0]);
      expect(medidas.ficha[1]).toBeLessThanOrEqual(medidas.tarjeta[1]);
      expect(medidas.documento).toBeLessThanOrEqual(medidas.ventana);
      await foto(page, `${vista.width}-limite-300-elija-su-organizacion`);
    }
    expect(vigia.problemas).toEqual([]);

    resultados.push({
      caso: 'Límite · razón social 300 + contraseña 8',
      accion: 'Razón social de 300 caracteres y contraseña de 8, tipo «Consultorio médico»',
      request: sinClave(respuesta.request()),
      status: respuesta.status(),
      sql: fila,
    });
  });

  test('el listado de organizaciones no se estira con esa razón social de 300', async ({ page }) => {
    test.skip(
      ADMIN_EMAIL === undefined || ADMIN_PASSWORD === undefined || razonSocialLarga === null,
      'Omitido: hacen falta E2E_ADMIN_EMAIL/PASSWORD y el alta de 300 de arriba. No es un verde.',
    );
    const vigia = vigilar(page);
    await page.setViewportSize(ESCRITORIO);
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });
    await esperarAplicacionLista(page);
    await escribir(page, 'login-identifier', ADMIN_EMAIL ?? '');
    await escribir(page, 'login-password', ADMIN_PASSWORD ?? '');
    await page.waitForTimeout(PAUSA_DEL_LIMITADOR_MS);
    await page.getByTestId('login-submit').click();
    await page.waitForURL((u) => !u.pathname.startsWith('/auth') || u.pathname === '/auth/organization', {
      timeout: 60_000,
    });
    if (new URL(page.url()).pathname === '/auth/organization') {
      await page.getByTestId('tenant-opcion').first().click();
      await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
    }

    for (const vista of [ESCRITORIO, TELEFONO]) {
      await page.setViewportSize(vista);
      await page.goto('/administration/organizations', { waitUntil: 'domcontentloaded' });
      await esperarAplicacionLista(page);
      const buscador = page.getByRole('textbox', { name: 'Buscar organizaciones' });
      await buscador.fill(`Borde ${RUN}`);
      await buscador.press('Enter');
      await expect(page.getByText(razonSocialLarga ?? '', { exact: true }).first()).toBeVisible({
        timeout: 30_000,
      });
      const medidas = await page.evaluate(() => {
        const tabla = document.querySelector('app-data-table table') ?? document.querySelector('app-data-table');
        const caja = tabla!.getBoundingClientRect();
        const contenedor = document.querySelector('app-data-table')!.getBoundingClientRect();
        return {
          tabla: caja.right,
          contenedor: contenedor.right,
          documento: document.documentElement.scrollWidth,
          ventana: window.innerWidth,
        };
      });
      expect(medidas.documento).toBeLessThanOrEqual(medidas.ventana);
      if (vista.width < 780) {
        // En el teléfono la tabla compartida se desplaza dentro de su caja por
        // diseño (`data-table.css`); lo que se exige es que el botón del detalle
        // de la fila, que abre lo que no entra, siga a la vista.
        await expect(page.locator('.data-table__detail-toggle').first()).toBeInViewport();
      }
      if (vista.width >= 780) {
        expect(medidas.tabla).toBeLessThanOrEqual(medidas.contenedor + 1);
        // «Tipo» y «Estado» siguen en la vista al lado del nombre largo.
        for (const encabezado of ['Tipo', 'Estado']) {
          await expect(page.getByRole('columnheader', { name: encabezado, exact: true })).toBeInViewport();
        }
      }
      await foto(page, `${vista.width}-limite-300-listado-de-organizaciones`, false);
    }
    expect(vigia.problemas).toEqual([]);
  });

  test('razón social de 301: la UI lo dice y no envía; la API también la rechaza', async ({ page }) => {
    const vigia = vigilar(page);
    await page.setViewportSize(TELEFONO);
    const enviadas = espiarAltas(page);
    const prefijo = `Clinica Pasada ${RUN} `;
    const razonSocial = prefijo + 'A'.repeat(301 - prefijo.length);

    await abrirAlta(page);
    await paginaOrganizacion(page, 'Hospital', razonSocial);
    await continuar(page);
    await expect(page.getByText('No puede pasar de 300 caracteres.')).toBeVisible();
    await expect(page.getByTestId('medical-center-signup-owner-name')).toHaveCount(0);
    // El foco va al campo con el error, no se queda en «Siguiente».
    await expect(page.getByTestId('medical-center-signup-legal-name')).toBeFocused();
    await sinDesbordeHorizontal(page);
    await foto(page, '390-limite-razon-social-301');
    expect(enviadas).toHaveLength(0);
    expect(vigia.problemas).toEqual([]);

    const status = await altaDirecta(
      { code: `CM-PASADA-${RUN}`, legalName: razonSocial, tenantType: 'HOSPITAL' },
      'Organizacion-2026',
    );
    expect(status).toBe(400);
    const fila = filaDeOrganizacion(razonSocial);
    expect(fila).toBe('');

    resultados.push({
      caso: 'Límite · razón social 301',
      accion: 'Escribir 301 caracteres y pulsar «Siguiente»; el mismo valor directo a la API',
      request: 'UI: ninguna · API directa: legalName de 301',
      status: 'sin request',
      sql: `UI sin request; API directa ${status}; filas: ${fila === '' ? 0 : fila}`,
    });
  });

  test('contraseña de 7: la UI lo dice y no envía; la API también la rechaza', async ({ page }) => {
    const vigia = vigilar(page);
    await page.setViewportSize(ESCRITORIO);
    const enviadas = espiarAltas(page);
    const razonSocial = `Hospital Clave Corta ${RUN}`;

    await abrirAlta(page);
    await paginaOrganizacion(page, 'Hospital', razonSocial);
    await continuar(page);
    await paginaCuenta(page, `org.clave7.${RUN}@alovida.test`.toLowerCase(), 'Siete-7');
    await continuar(page);
    const error = page.getByText('La contraseña necesita al menos 8 caracteres.');
    await expect(error).toBeVisible();
    await expect(error).toBeInViewport();
    await expect(page.getByTestId('medical-center-signup-password')).toBeFocused();
    await expect(page.getByTestId('medical-center-signup-success')).toHaveCount(0);
    await foto(page, '1440-limite-clave-7', false);
    expect(enviadas).toHaveLength(0);
    expect(vigia.problemas).toEqual([]);

    const status = await altaDirecta(
      { code: `CM-CLAVE7-${RUN}`, legalName: razonSocial, tenantType: 'HOSPITAL' },
      'Siete-7',
    );
    expect(status).toBe(400);
    expect(filaDeOrganizacion(razonSocial)).toBe('');

    resultados.push({
      caso: 'Límite · contraseña 7',
      accion: 'Contraseña de 7 caracteres y «Crear cuenta»; la misma directa a la API',
      request: 'UI: ninguna · API directa: password de 7',
      status: 'sin request',
      sql: `UI sin request; API directa ${status}; filas: 0`,
    });
  });
});

/* ---------------------------------------------------------------- error */

test.describe('error', () => {
  test('sin tipo de institución: lo marca y no sale a la red', async ({ page }) => {
    const vigia = vigilar(page);
    await page.setViewportSize(TELEFONO);
    const enviadas = espiarAltas(page);

    await abrirAlta(page);
    await paginaOrganizacion(page, null, `Sin Tipo ${RUN}`);
    await continuar(page);
    // El párrafo del error del campo: es el que lleva el `id` al que apunta el grupo.
    const mensaje = page.locator('.form-field-error', { hasText: 'Elija el tipo de institución.' });
    await expect(mensaje).toBeVisible();
    await expect(page.getByTestId('medical-center-signup-owner-name')).toHaveCount(0);
    // M2: el grupo queda descrito por el mensaje y el foco va a su primera opción.
    const grupo = page.getByTestId('medical-center-signup-tenant-type');
    const idDelMensaje = await mensaje.getAttribute('id');
    expect(idDelMensaje).not.toBeNull();
    await expect(grupo).toHaveAttribute('aria-describedby', new RegExp(idDelMensaje ?? '-'));
    await expect(grupo).toHaveAttribute('aria-invalid', 'true');
    await expect(grupo.getByRole('radio').first()).toBeFocused();
    await mensaje.scrollIntoViewIfNeeded();
    await sinDesbordeHorizontal(page);
    await foto(page, '390-error-sin-tipo', false);
    expect(enviadas).toHaveLength(0);
    expect(vigia.problemas).toEqual([]);

    resultados.push({
      caso: 'Error · sin tipo de institución',
      accion: 'Completar razón social y tipo societario sin elegir tipo; «Siguiente»',
      request: 'ninguna',
      status: 'sin request',
      sql: `filas con esa razón social: ${filaDeOrganizacion(`Sin Tipo ${RUN}`) === '' ? 0 : 1}`,
    });
  });

  test('correo ya registrado: 409, mensaje en la UI y ninguna fila nueva', async ({ page }) => {
    test.skip(correoRegistrado === null, 'Ningún alta correcta dejó una cuenta que repetir.');
    const vigia = vigilar(page);
    // El 409 es lo que esta prueba provoca: Chromium lo anota en consola, y el
    // registro de fallos de la API (sólo en desarrollo) también.
    vigia.permitir(/status of 409|register-organization → 409 · CONFLICT/);
    await page.setViewportSize(ESCRITORIO);
    const razonSocial = `Clinica Duplicada ${RUN}`;

    await abrirAlta(page);
    await paginaOrganizacion(page, 'Centro de enfermería', razonSocial);
    await continuar(page);
    await paginaCuenta(page, correoRegistrado ?? '', 'Organizacion-2026');
    const respuesta = await enviar(page);

    expect(respuesta.status()).toBe(409);
    await expect(page.getByTestId('medical-center-signup-error')).toContainText(
      'Ya existe una cuenta con ese correo',
    );
    await expect(page.getByTestId('medical-center-signup-success')).toHaveCount(0);
    const fila = filaDeOrganizacion(razonSocial);
    expect(fila).toBe('');
    // L5: el ícono del aviso va al lado del texto, no en su propio renglón.
    const aviso = page.getByTestId('medical-center-signup-error');
    const icono = await aviso.locator('.alert__icon').boundingBox();
    const texto = await aviso.locator('.alert__content').boundingBox();
    expect(Math.abs((icono?.y ?? 0) - (texto?.y ?? 999))).toBeLessThan(8);
    expect(icono?.x ?? 999).toBeLessThan(texto?.x ?? 0);
    await aviso.scrollIntoViewIfNeeded();
    await foto(page, '1440-error-correo-duplicado', false);
    expect(vigia.problemas).toEqual([]);

    resultados.push({
      caso: 'Error · correo ya registrado',
      accion: 'Alta «Centro de enfermería» con el correo de un alta anterior',
      request: sinClave(respuesta.request()),
      status: respuesta.status(),
      sql: 'filas con esa razón social: 0',
    });
  });
});

/* ------------------------------------------------------------ viewports */

test('la primera página se ve entera en los anchos de referencia, con «Siguiente» sin desplazar', async ({
  page,
}) => {
  const vigia = vigilar(page);
  for (const vista of VIEWPORTS) {
    await page.setViewportSize({ width: vista.width, height: vista.height });
    await abrirAlta(page);
    await expect(page.getByTestId('medical-center-signup-tenant-type')).toBeVisible();
    await sinDesbordeHorizontal(page);
    await quieta(page);

    const medidas = await page.evaluate(() => {
      const siguiente = document.querySelector('[data-testid="paginated-form-continuar"]')!;
      const caja = siguiente.getBoundingClientRect();
      const columnas = [...document.querySelectorAll('.paginated-form__campo')].map((campo) =>
        Math.round(campo.getBoundingClientRect().left),
      );
      const radios = [...document.querySelectorAll('[data-testid="medical-center-signup-tenant-type"] app-radio')].map(
        (radio) => Math.round(radio.getBoundingClientRect().top),
      );
      return {
        scrollY: window.scrollY,
        abajo: caja.bottom,
        alto: window.innerHeight,
        columnas: new Set(columnas).size,
        filasDeRadios: new Set(radios).size,
        radios: radios.length,
      };
    });
    if (vista.sinScroll) {
      // Lo mide en la carga, sin desplazar: es lo que ve quien abre el alta.
      expect(medidas.scrollY, vista.label).toBe(0);
      expect(medidas.abajo, `${vista.label}: «Siguiente» dentro de la ventana`).toBeLessThanOrEqual(medidas.alto);
      await expect(page.getByTestId('paginated-form-continuar')).toBeInViewport({ ratio: 1 });
    }
    if (vista.width >= 780) {
      // §5: razón social y tipo societario comparten renglón, y los radios
      // van en rejilla —menos filas que opciones—.
      expect(medidas.columnas, vista.label).toBeGreaterThanOrEqual(2);
      expect(medidas.filasDeRadios, vista.label).toBeLessThan(medidas.radios);
    }
    await foto(page, `${vista.label}-pagina-1-vacia`, false);
  }
  expect(vigia.problemas).toEqual([]);
});

test('la segunda página reparte la cuenta en columnas y sus acciones no se salen, en todos los anchos', async ({
  page,
}) => {
  const vigia = vigilar(page);
  for (const vista of [{ label: '320x640', width: 320, height: 640 }, ...VIEWPORTS]) {
    await page.setViewportSize({ width: vista.width, height: vista.height });
    await abrirAlta(page);
    await paginaOrganizacion(page, 'Hospital', `Vista ${vista.label} ${RUN}`);
    await continuar(page);
    await expect(page.getByTestId('medical-center-signup-owner-name')).toBeVisible();
    await sinDesbordeHorizontal(page);
    await accionesDentro(page);
    await expect(page.getByTestId('paginated-form-atras')).toBeVisible();
    if (vista.width >= 1120) {
      const filas = await page.evaluate(
        () =>
          new Set(
            [...document.querySelectorAll('.paginated-form__campo')].map((campo) =>
              Math.round(campo.getBoundingClientRect().top),
            ),
          ).size,
      );
      expect(filas, `${vista.label}: nombre, correo y contraseña en un renglón`).toBe(1);
    }
    await page.getByTestId('paginated-form-atras').scrollIntoViewIfNeeded();
    await foto(page, `${vista.label}-pagina-2-acciones`, false);
  }
  expect(vigia.problemas).toEqual([]);
});

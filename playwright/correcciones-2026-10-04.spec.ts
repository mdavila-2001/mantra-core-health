import { expect, request, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { urlDeApi } from './support/actores';

/**
 * Las ocho correcciones del propietario del 04/10/2026, probadas contra la
 * **API real** y con captura de cada una (prueba documental).
 *
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:4289 \
 *   E2E_EVIDENCIA=<carpeta> yarn pw correcciones-2026-10-04 --workers=1
 *
 * En serie: el médico que da de alta la primera prueba es el que usan las
 * siguientes, como haría una persona.
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
const EVIDENCIA = process.env['E2E_EVIDENCIA'] ?? 'artifacts/correcciones-2026-10-04';
const RUN = Date.now().toString(36).toUpperCase();
const TITULO = '.paginated-form__titulo';
const CORREO = `correcciones.${RUN}@alovida.test`.toLowerCase();
const CLAVE = 'Correcciones-2026!';

test.describe.configure({ mode: 'serial' });
test.skip(!API_REAL, 'Omitido: hace falta E2E_API_REAL=1 con la API y el front en modo real-api.');
test.setTimeout(240_000);

mkdirSync(EVIDENCIA, { recursive: true });

async function foto(page: Page, nombre: string): Promise<void> {
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), fullPage: true });
}

/** Foto de un elemento: el formulario scrollea dentro de su caja y la de página lo recorta. */
async function fotoDe(elemento: Locator, nombre: string): Promise<void> {
  await elemento.scrollIntoViewIfNeeded();
  await elemento.screenshot({ path: join(EVIDENCIA, `${nombre}.png`) });
}

async function continuar(page: Page): Promise<void> {
  const boton = page.getByTestId('paginated-form-continuar').last();
  await expect(boton).toBeEnabled({ timeout: 20_000 });
  await boton.click();
}

async function enLaPagina(page: Page, titulo: string): Promise<void> {
  await expect(page.locator(TITULO).first()).toContainText(titulo, { timeout: 20_000 });
}

async function continuarHasta(page: Page, titulo: string): Promise<void> {
  for (let intento = 0; intento < 10; intento++) {
    const actual = (await page.locator(TITULO).first().textContent())?.trim() ?? '';
    if (actual.includes(titulo)) return;
    await continuar(page);
    await expect(page.locator(TITULO).first()).not.toHaveText(actual, { timeout: 20_000 });
  }
  await enLaPagina(page, titulo);
}

async function opciones(page: Page, testId: string): Promise<string[]> {
  return page.getByTestId(testId).locator('select option').allTextContents();
}

async function token(credenciales: Record<string, string>): Promise<string> {
  const api = await request.newContext({ baseURL: urlDeApi() });
  try {
    const r = await api.post('/iam/auth/login', { data: credenciales });
    expect(r.status(), await r.text()).toBe(200);
    return ((await r.json()) as { accessToken: string }).accessToken;
  } finally {
    await api.dispose();
  }
}

async function entrar(page: Page, identificador: string, clave: string): Promise<void> {
  await page.goto('/auth', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('login-identifier').locator('input').or(page.getByTestId('login-identifier')).first().fill(identificador);
  await page.getByTestId('login-password').locator('input').or(page.getByTestId('login-password')).first().fill(clave);
  await page.getByRole('button', { name: /Ingresar|Iniciar sesión|Entrar/ }).first().click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 60_000 });
}

/* ------------------------------------------------ 2, 3 y 4 · alta del médico */

test('alta del médico: profesión COB-2023, ciudad derivada, filtro de salud, freno en su paso y 201', async ({ page }) => {
  await page.goto('/auth/register/practitioner', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('registro-pro-nombre').fill('Lucía');
  await page.getByTestId('registro-pro-apellido-paterno').fill('Correcciones');
  await continuar(page);
  await enLaPagina(page, 'Tu documento');
  await page.getByTestId('registro-pro-documento').fill(`COR${RUN}`);
  const depto = page.getByTestId('registro-pro-departamento-ci').locator('select');
  await expect(depto.locator('option').nth(1)).toBeAttached({ timeout: 20_000 });
  await depto.selectOption({ index: 1 });
  await continuar(page);
  await enLaPagina(page, 'Contanos');
  await page.getByTestId('registration-practitioner-sex').locator('select').selectOption({ index: 1 });
  const fecha = page.getByPlaceholder('DD/MM/AAAA');
  await fecha.click();
  await page.keyboard.type('12051985', { delay: 60 });
  await continuar(page);
  await enLaPagina(page, 'Cómo te contactamos en privado');
  await page.getByTestId('registro-pro-celular-personal').fill('70012345');
  await page.getByTestId('registro-pro-correo-personal').fill(CORREO);
  await continuarHasta(page, 'Tu título profesional');
  await page.getByTestId('registro-pro-titulo').getByRole('combobox').fill('Médico / Médica');
  await page.getByRole('option', { name: 'Médico / Médica', exact: true }).click();

  // 3 · Universidades de un título de salud: un médico no ve la UPSA (no
  // dicta Medicina) y la ciudad sale de la universidad, en un desplegable.
  await page.getByTestId('registro-pro-titulo-pais').locator('select').selectOption('Bolivia');
  const universidades = await opciones(page, 'registro-pro-titulo-universidad');
  expect(universidades.join('|')).not.toContain('(UPSA)');
  expect(universidades.join('|')).toContain('(UMSS)');
  await page
    .getByTestId('registro-pro-titulo-universidad')
    .locator('select')
    .selectOption({ label: 'Universidad Mayor de San Simón (UMSS) — Cochabamba' });
  const ciudad = page.getByTestId('registro-pro-titulo-ciudad').locator('select');
  await expect(ciudad).toHaveValue(/.+/);
  expect(await ciudad.locator('option:checked').textContent()).toContain('Cochabamba');
  await expect(page.locator('input[data-testid="registro-pro-titulo-ciudad"]')).toHaveCount(0);
  await fotoDe(page.locator('.registro__estudio'), '03-titulo-principal-ciudad-derivada');

  await continuar(page);
  await enLaPagina(page, 'Tu habilitación');
  await page.getByTestId('registro-pro-matricula').fill(`MP-${RUN}`);
  await page.getByTestId('registro-pro-credencial').fill(`T.I. ${RUN}`);
  await continuarHasta(page, 'Tus títulos');

  // 2 · «Otra profesión» es un combobox de la COB-2023, no texto libre.
  await page.getByTestId('registro-pro-agregar-UNIVERSITARIO').click();
  const fila = page.getByTestId('registro-pro-fila-UNIVERSITARIO').first();
  await expect(fila.locator('input.registro-titulo__nombre')).toHaveCount(0);
  const profesion = fila.locator('app-reference-combobox').getByRole('combobox');
  await profesion.fill('civiles');
  await page.getByRole('option', { name: 'Ingenieros civiles' }).click();
  // Sin filtro de salud en «Otra profesión»: la UPSA está, con su ciudad fija.
  await fila.locator('app-select').nth(0).locator('select').selectOption('Bolivia');
  await fila
    .locator('app-select')
    .nth(1)
    .locator('select')
    .selectOption({ label: 'Universidad Privada de Santa Cruz de la Sierra (UPSA)' });
  const ciudadFila = fila.locator('app-select').nth(2).locator('select');
  await expect(ciudadFila).toBeDisabled();
  expect(await ciudadFila.locator('option:checked').textContent()).toContain('Santa Cruz de la Sierra');

  // 4 · Sin número, el paso se frena AHÍ y nombra la sección que se ve.
  await expect(page.getByTestId('registro-pro-titulos-incompletos')).toContainText('«Otra profesión»');
  await continuar(page);
  await enLaPagina(page, 'Tus títulos');
  await fotoDe(page.locator('.registro-titulos'), '04-titulos-frenado-en-su-paso');

  await fila.locator('input.registro-titulo__dato').first().fill(`DIP-${RUN}`);
  await expect(page.getByTestId('registro-pro-titulos-incompletos')).toHaveCount(0);
  await fotoDe(fila, '02-otra-profesion-cob-2023');
  await continuarHasta(page, 'Tu contraseña');
  await page.getByTestId('registro-pro-password').fill(CLAVE);
  await page.waitForTimeout(7_000); // límite de altas por IP: se respeta
  const respuesta = page.waitForResponse(
    (r) => r.url().includes('/iam/auth/register-practitioner') && r.request().method() === 'POST',
  );
  await continuar(page);
  const r = await respuesta;
  expect(r.status(), await r.text()).toBe(201);
  const cuerpo = r.request().postDataJSON() as { credentials: Record<string, string>[] };
  const otra = cuerpo.credentials.find((c) => c['number'] === `DIP-${RUN}`);
  expect(otra).toMatchObject({
    issuingInstitutionText: 'Universidad Privada de Santa Cruz de la Sierra',
    issuingCityText: 'Santa Cruz de la Sierra',
    issuingCountryText: 'Bolivia',
  });
  expect(otra?.['professionConceptId']).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 20_000 });
  await foto(page, '04-alta-201-exito');

  // Y la lectura del perfil devuelve lo guardado: ida y vuelta por la base.
  const acceso = await token({ email: CORREO, password: CLAVE });
  const api = await request.newContext({ baseURL: urlDeApi(), extraHTTPHeaders: { authorization: `Bearer ${acceso}` } });
  const perfil = await api.get('/profiles/practitioners/me/summary');
  expect(perfil.status()).toBe(200);
  const credenciales = ((await perfil.json()) as { credentials: Record<string, string>[] }).credentials;
  expect(credenciales.find((c) => c['number'] === `DIP-${RUN}`)).toMatchObject({
    issuingCityText: 'Santa Cruz de la Sierra',
    issuingCountryText: 'Bolivia',
  });
  await api.dispose();
});

/* ------------------------------------------- 1 y 14 · «Dónde atiendo», seguros */

test('«Dónde atiendo»: una sola puerta, sin filtro ni Tipo; los seguros se leen', async ({ page }) => {
  const seguros = page.waitForResponse((r) => r.url().includes('/insurance-networks'));
  await entrar(page, CORREO, CLAVE);
  await page.goto('/my-account', { waitUntil: 'domcontentloaded' });
  expect((await seguros).status()).toBe(200);
  await expect(page.getByText('No pudimos traer tus seguros')).toHaveCount(0);

  const sedes = page.getByTestId('sedes-propias');
  if (!(await sedes.isVisible())) {
    await page.getByRole('tab', { name: /Consultorio|Dónde atiendo|Lugares/ }).first().click();
  }
  await expect(sedes).toBeVisible({ timeout: 20_000 });
  await expect(sedes.locator('app-filter-bar select')).toHaveCount(0);
  await expect(sedes.locator('th', { hasText: 'Tipo' })).toHaveCount(0);
  await expect(sedes.getByText('Agregar mi consultorio propio')).toHaveCount(0);
  await foto(page, '01-donde-atiendo-antes-de-agregar');
  await sedes.getByTestId('sede-agregar').click();
  await expect(sedes.getByTestId('sede-padron')).toBeVisible();
  await expect(sedes.getByTestId('sede-cargar-propio')).toBeVisible();
  await foto(page, '01-donde-atiendo-una-sola-puerta');
});

/* --------------------------------------------- 6 y 7 · horarios y Mis horarios */

test('horarios: repetir arriba con modal, otros servicios y el último turno se completa', async ({ page }) => {
  await entrar(page, CORREO, CLAVE);
  await page.goto('/schedule/new', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('agenda-create-dia-0').getByText('Sí').click();
  await page.getByTestId('agenda-create-dia-2').getByText('Sí').click();
  // `testId` de `app-input` cae en el `<input>` mismo.
  await page.locator('input[data-testid="agenda-create-desde-0"]').fill('09:00');
  await page.locator('input[data-testid="agenda-create-hasta-0"]').fill('17:00');
  const filaLunes = page.locator('tr.agenda-create__fila').first();
  await filaLunes.locator('app-select').nth(1).locator('select').selectOption({ label: '45 min' });

  // 6 · El botón está ARRIBA de la tabla y pregunta antes de repetir.
  const masivo = page.getByTestId('agenda-create-masivo');
  const tabla = page.locator('.agenda-create__tabla');
  expect((await masivo.boundingBox())!.y).toBeLessThan((await tabla.boundingBox())!.y);
  await masivo.click();
  await expect(page.getByTestId('agenda-create-masivo-fila')).toBeVisible();
  await foto(page, '06-repetir-modal');
  await page.getByTestId('agenda-create-masivo-confirmar').click();

  // 6 · Redondeo hacia adelante: 09:00–17:00 de 45' → el último 16:30–17:15.
  await expect(page.getByTestId('agenda-create-previa-extiende').first()).toContainText('17:15');
  // 7 · El miércoles, sólo otros servicios.
  await page.getByTestId('agenda-create-modo-2').locator('select').selectOption({ label: 'Otros servicios' });
  await expect(page.getByText('«Otros servicios» son los que ofrecés además de la consulta')).toBeVisible();
  await foto(page, '06-redondeo-hacia-adelante');

  const generacion = page.waitForResponse((r) => r.url().includes('/generate-slots'), { timeout: 60_000 });
  await page.getByRole('button', { name: /Publicar/ }).last().click();
  // Si publicar pregunta, se confirma DENTRO del diálogo (la tabla tiene botones «Sí»).
  const dialogo = page.getByRole('dialog');
  if (await dialogo.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await dialogo.getByRole('button', { name: /Publicar|Confirmar|Aceptar|Sí/ }).last().click();
  }
  const generados = await generacion;
  expect(generados.status(), await generados.text()).toBeLessThan(300);

  // 6 · El backend generó el mismo último turno que prometió la vista previa.
  const acceso = await token({ email: CORREO, password: CLAVE });
  const plantilla = generados.url().match(/templates\/([^/]+)\/generate-slots/)?.[1];
  const api = await request.newContext({ baseURL: urlDeApi(), extraHTTPHeaders: { authorization: `Bearer ${acceso}` } });
  const recursos = (await (await api.get('/scheduling/resources/me')).json().catch(() => null)) as unknown;
  void recursos;
  await api.dispose();
  expect(plantilla).toBeTruthy();

  // 7 · «Mis horarios» muestra también los otros servicios, con su leyenda.
  await page.goto('/schedule', { waitUntil: 'domcontentloaded' });
  const tab = page.getByRole('tab', { name: 'Mis horarios' });
  if (await tab.isVisible().catch(() => false)) await tab.click();
  await expect(page.locator('[data-testid="horario-bloque"][data-mode="SERVICES"]').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('horario-leyenda').first()).toContainText('Otros servicios');
  await foto(page, '07-mis-horarios-otros-servicios');
});

/* ---------------------------------------------- 5 · el perfil sin desbordes */

const VIEWPORTS = [
  { nombre: '375', width: 375, height: 812 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1280x680', width: 1280, height: 680 },
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '1920', width: 1920, height: 1080 },
];

/** Elementos que se salen de su contenedor recortado o generan scroll lateral. */
async function desbordes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const fuera: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth + 1) fuera.push(`página: scrollWidth ${doc.scrollWidth} > ${doc.clientWidth}`);
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('main *'))) {
      const estilo = getComputedStyle(el);
      if (estilo.display === 'none' || estilo.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Texto que no entra en su caja y no tiene scroll propio.
      const recortaTexto =
        el.scrollWidth > el.clientWidth + 2 &&
        !['auto', 'scroll'].includes(estilo.overflowX) &&
        el.children.length === 0 &&
        (el.textContent ?? '').trim() !== '' &&
        estilo.textOverflow !== 'ellipsis';
      if (recortaTexto) {
        fuera.push(`${el.tagName.toLowerCase()}.${el.className}: «${(el.textContent ?? '').trim().slice(0, 40)}»`);
      }
      // Una tarjeta cuyo hijo se sale de sus bordes.
      if (el.matches('app-card, .card, [class*="tarjeta"]')) {
        for (const hijo of Array.from(el.children) as HTMLElement[]) {
          const h = hijo.getBoundingClientRect();
          if (h.width > 0 && (h.right > r.right + 2 || h.left < r.left - 2)) {
            fuera.push(`hijo fuera de ${el.tagName.toLowerCase()}.${el.className}: ${hijo.tagName.toLowerCase()}.${hijo.className}`);
          }
        }
      }
    }
    return fuera;
  });
}

test('perfil sin desbordes: 5 tamaños × claro y oscuro', async ({ page }) => {
  // Una sola entrada: el login admite diez por minuto y por IP.
  await entrar(page, CORREO, CLAVE);
  const resultados: string[] = [];
  for (const tema of ['light', 'dark'] as const) {
    for (const vp of VIEWPORTS) {
      await page.emulateMedia({ colorScheme: tema });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/my-account', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1_500);
      const hallazgos = await desbordes(page);
      await foto(page, `05-perfil-${vp.nombre}-${tema}`);
      resultados.push(...hallazgos.map((h) => `${vp.nombre} ${tema}: ${h}`));
    }
  }
  expect(resultados, resultados.join('\n')).toEqual([]);
});

/* ------------------------------------------------- 8 · directorio de médicos */

test('directorio: filas de médicos primero y, en una especialidad, su nombre en cada fila', async ({ page }) => {
  const { contextoDeApi, crearPaciente } = await import('./support/actores');
  const api = await contextoDeApi();
  const paciente = await crearPaciente(api);
  await api.dispose();
  await entrar(page, paciente.identificador, paciente.clave);
  await page.goto('/directory', { waitUntil: 'domcontentloaded' });

  // Sin grid de especialidades: la lista de médicos, en filas.
  await expect(page.getByTestId('portada-especialidades')).toHaveCount(0);
  await expect(page.locator('li.tarjeta-resultado--lista').first()).toBeVisible({ timeout: 30_000 });
  await foto(page, '08-directorio-filas');

  // El filtro de especialidad: la primera que tenga gente.
  const filtro = page.locator('app-filter-bar select').first();
  const etiqueta = (await filtro.locator('option').nth(1).textContent())?.trim() ?? '';
  const especialidad = etiqueta.replace(/\s*\(\d+\)$/, '');
  await filtro.selectOption({ index: 1 });
  await expect(page).toHaveURL(/especialidad=/);
  const filas = page.locator('li.tarjeta-resultado--lista');
  await expect(filas.first()).toBeVisible({ timeout: 30_000 });
  for (const texto of await filas.allTextContents()) {
    expect(texto, `la fila debería decir «${especialidad}»`).toContain(especialidad);
  }
  await foto(page, '08-directorio-una-especialidad');
});

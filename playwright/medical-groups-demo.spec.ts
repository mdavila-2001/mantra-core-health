import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * Grupos médicos (FT-21) contra el simulador (`ng serve --configuration demo`).
 *
 * Demuestra, con navegador y sin `networkidle`:
 *   - el listado, la ficha (UNA tarjeta con pestañas) y el alta cargan por URL
 *     directa;
 *   - responder una invitación: UI → simulador → recarga → UI;
 *   - crear un grupo: UI → simulador → recarga → ficha → listado;
 *   - sin desborde horizontal y con la ficha centrada y a lo ancho (holgura
 *     izquierda ≈ derecha respecto de `.app-main__inner`, ancho ≥ 85 %);
 *   - claro y oscuro en 1440, 768 y 390.
 *
 * **Qué no se ve acá:** en `demo` el backend es el simulador y responde dentro
 * de la propia aplicación, así que no hay petición de red que observar. La
 * persistencia se comprueba leyendo lo que el simulador guarda en
 * `sessionStorage` y recargando la página; el cuerpo exacto de cada petición y
 * su ruta los fijan las pruebas unitarias del cliente. Nada de esto toca la API
 * real.
 *
 * Las capturas van a `docs/frontend/evidence/grupo-medico/` junto con un
 * `medidas.json` con lo que se midió.
 */

const EVIDENCIA = join(process.cwd(), 'docs', 'frontend', 'evidence', 'grupo-medico');
const LISTA = '/schedule/medical-groups';

const VIEWPORTS = [
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '390', width: 390, height: 844 },
] as const;
const TEMAS = ['light', 'dark'] as const;

const medidas: Record<string, unknown> = {};

test.beforeAll(() => {
  mkdirSync(EVIDENCIA, { recursive: true });
});

test.afterAll(() => {
  writeFileSync(join(EVIDENCIA, 'medidas.json'), `${JSON.stringify(medidas, null, 2)}\n`);
});

/** Errores de consola y de página: una pantalla «verde» con la consola roja no está bien. */
function vigilar(page: Page): { errores: string[]; fallidas: string[] } {
  const errores: string[] = [];
  const fallidas: string[] = [];
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(`console: ${m.text()}`);
  });
  page.on('requestfailed', (r) => fallidas.push(`${r.method()} ${r.url()} ${r.failure()?.errorText}`));
  return { errores, fallidas };
}

async function entrar(page: Page): Promise<void> {
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByTestId('login-identifier').fill('medica@alovida.mock');
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

async function ponerTema(page: Page, tema: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => localStorage.setItem('mantra-core-health.theme', t), tema);
}

/** Sin desborde horizontal de la página. */
async function sinDesborde(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
}

/** Holgura izquierda y derecha del bloque respecto de `.app-main__inner`, y ancho relativo. */
async function centrado(page: Page, selector: string): Promise<{ izquierda: number; derecha: number; ancho: number }> {
  return page.evaluate((sel) => {
    const area = document.querySelector('.app-main__inner')!.getBoundingClientRect();
    const bloque = document.querySelector(sel)!.getBoundingClientRect();
    return {
      izquierda: Math.round(bloque.left - area.left),
      derecha: Math.round(area.right - bloque.right),
      ancho: Math.round((bloque.width / area.width) * 100),
    };
  }, selector);
}

/** Lo que el simulador de grupos médicos guardó (sobrevive a la recarga). */
async function grupoGuardado(page: Page, id: string): Promise<{ status: string; locationText: string; members: { practitionerProfileId: string; invitationStatus: string; roleTitle: string; agreedPaymentAmount: string }[] } | undefined> {
  return page.evaluate((grupoId) => {
    const crudo = sessionStorage.getItem('mock.medical-groups');
    if (crudo === null) return undefined;
    const { filas } = JSON.parse(crudo) as { filas: { id: string }[] };
    return filas.find((f) => f.id === grupoId) as never;
  }, id);
}

/** Espera a que se resuelvan los nombres (el servicio) para que la captura no muestre el rótulo genérico. */
async function esperarNombres(page: Page): Promise<void> {
  await expect(page.locator('main')).not.toContainText('Servicio del catálogo', { timeout: 30_000 });
}

async function capturar(page: Page, nombre: string): Promise<void> {
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), fullPage: true });
}

test.describe('Grupos médicos · simulador', () => {
  // Una página nueva por ancho y tema: encadenar seis cargas en la misma
  // pestaña acumula memoria y el renderizador de Chromium termina cayéndose
  // en una máquina cargada (medido: «Page crashed»).
  for (const vp of VIEWPORTS) {
    for (const tema of TEMAS) {
      test.describe(`${vp.nombre} ${tema}`, () => {
        test.use({ viewport: { width: vp.width, height: vp.height } });

        test(`listado, ficha y alta por URL directa en ${vp.nombre} (${tema}): sin desborde y centrados`, async ({ page }) => {
          const { errores } = vigilar(page);
          await entrar(page);
          await ponerTema(page, tema);

          // Listado
          await page.goto(LISTA, { waitUntil: 'domcontentloaded' });
          if (tema === 'dark') {
            await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 30_000 });
          } else {
            await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
          }
          await expect(page.getByRole('heading', { name: 'Grupos médicos' })).toBeVisible({ timeout: 60_000 });
          await expect(page.locator('[data-testid^="medical-group-open-"]').first()).toBeVisible({ timeout: 30_000 });
          await esperarNombres(page);
          expect(await sinDesborde(page), 'listado sin desborde').toBe(true);
          await capturar(page, `listado-${vp.nombre}-${tema}`);

          // Ficha (resumen) del primer grupo
          await page.locator('[data-testid^="medical-group-open-"]').first().click();
          await expect(page.getByTestId('medical-group-status')).toBeVisible({ timeout: 30_000 });
          await esperarNombres(page);
          expect(await sinDesborde(page), 'ficha sin desborde').toBe(true);
          const ficha = await centrado(page, 'app-card');
          medidas[`ficha-${vp.nombre}-${tema}`] = ficha;
          expect(Math.abs(ficha.izquierda - ficha.derecha), 'ficha centrada').toBeLessThanOrEqual(2);
          expect(ficha.ancho, 'ficha a lo ancho').toBeGreaterThanOrEqual(85);
          expect(await page.locator('app-card').count()).toBe(1);
          await capturar(page, `ficha-resumen-${vp.nombre}-${tema}`);

          // Alta
          await page.goto(`${LISTA}/new`, { waitUntil: 'domcontentloaded' });
          await expect(page.getByTestId('medical-group-form')).toBeVisible({ timeout: 60_000 });
          expect(await sinDesborde(page), 'alta sin desborde').toBe(true);
          const alta = await centrado(page, 'app-card');
          medidas[`alta-${vp.nombre}-${tema}`] = alta;
          expect(Math.abs(alta.izquierda - alta.derecha), 'alta centrada').toBeLessThanOrEqual(2);
          expect(alta.ancho, 'alta a lo ancho').toBeGreaterThanOrEqual(85);
          await capturar(page, `alta-${vp.nombre}-${tema}`);

          expect(errores, 'errores de consola o de página').toEqual([]);
        });
      });
    }
  }

  test('responder una invitación: UI → petición → respuesta → recarga → UI', async ({ page }) => {
    const { errores } = vigilar(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page);

    await page.goto(LISTA, { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Solicitudes recibidas' }).click();
    const enlace = page.locator('[data-testid^="medical-group-open-"]').first();
    await expect(enlace).toHaveText(/Responder/, { timeout: 30_000 });
    await capturar(page, 'recibidas-antes');
    await enlace.click();

    // La acción lleva derecho a la pestaña donde se responde.
    await expect(page.getByTestId('medical-group-respond')).toBeVisible({ timeout: 30_000 });
    const url = page.url();
    await capturar(page, 'invitacion-antes');

    const grupoId = url.split('/').pop()!.split('?')[0]!;
    // Antes de la primera escritura el simulador no guardó nada: la semilla vive en memoria.
    expect(await grupoGuardado(page, grupoId)).toBeUndefined();

    await page.getByTestId('medical-group-accept').click();
    await expect(page.getByTestId('medical-group-notice')).toContainText('Aceptó su cargo');
    // Lo que el simulador guardó: ya no queda ninguna invitación sin responder y el grupo se programó.
    const despues = await grupoGuardado(page, grupoId);
    expect(despues?.members.some((m) => m.invitationStatus === 'PENDING')).toBe(false);
    expect(despues?.status).toBe('SCHEDULED');
    await capturar(page, 'invitacion-despues');

    // Recarga: lo aceptado se lee de nuevo desde la persistencia del simulador.
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('medical-group-status')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('medical-group-respond')).toHaveCount(0);
    await expect(page.getByTestId('medical-group-status')).toContainText('Programado');
    await capturar(page, 'invitacion-recargada');

    // Y la pestaña de recibidas ya no la ofrece.
    await page.goto(LISTA, { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Solicitudes recibidas' }).click();
    await expect(page.getByText('No tiene invitaciones a un grupo médico por responder.')).toBeVisible({ timeout: 30_000 });
    await capturar(page, 'recibidas-vacio');
    expect(errores).toEqual([]);
  });

  test('crear un grupo: UI → petición → respuesta → recarga → ficha → listado', async ({ page }) => {
    const { errores } = vigilar(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page);
    await page.goto(`${LISTA}/new`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('medical-group-form')).toBeVisible({ timeout: 60_000 });

    const lugar = `Quirófano de la prueba ${Date.now()}`;
    const submit = page.getByTestId('medical-group-submit');
    await expect(submit).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('medical-group-problems')).toContainText('Elija el servicio del grupo.');

    // Servicio y paciente
    await page.getByRole('combobox', { name: 'Práctica' }).click();
    await page.getByRole('option', { name: 'Clínica Los Olivos' }).click();
    const servicio = page.getByRole('combobox', { name: 'Servicio' });
    await servicio.click();
    await servicio.fill('Consulta');
    await page.getByRole('option', { name: /Consulta cardiológica/ }).first().click();
    const paciente = page.getByRole('combobox', { name: 'Paciente' });
    await paciente.click();
    await paciente.fill('a');
    await page.getByRole('option').first().click();
    await capturar(page, 'alta-servicio-y-paciente');

    // Fecha y lugar
    await page.getByRole('tab', { name: 'Fecha y lugar' }).click();
    const fecha = page.getByPlaceholder('DD/MM/AAAA');
    // La máscara arma las barras sola: se tipean sólo los dígitos, como una persona.
    await fecha.click();
    await fecha.pressSequentially('15122030');
    await fecha.blur();
    await expect(fecha).toHaveValue('15/12/2030');
    await page.getByTestId('medical-group-location').fill(lugar);
    await capturar(page, 'alta-fecha-y-lugar');

    // Equipo
    await page.getByRole('tab', { name: /Equipo/ }).click();
    await page.getByTestId('medical-group-add-member').click();
    const profesional = page.getByTestId('medical-group-member-0').getByRole('combobox', { name: 'Profesional' });
    await profesional.click();
    await page.getByRole('option').first().click();
    await page.getByTestId('medical-group-role-0').fill('Anestesiólogo');
    await page.getByTestId('medical-group-amount-0').fill('500');
    await capturar(page, 'alta-equipo');

    await expect(submit).toHaveAttribute('aria-disabled', 'false');
    await submit.click();
    await expect(page).toHaveURL(new RegExp(`${LISTA}/[0-9a-f-]{20,}$`), { timeout: 30_000 });
    const grupoId = page.url().split('/').pop()!;
    // Lo que el simulador guardó, con lo que se escribió en el formulario.
    const guardado = await grupoGuardado(page, grupoId);
    expect(guardado?.status).toBe('PENDING_TEAM');
    expect(guardado?.locationText).toBe(lugar);
    expect(guardado?.members).toHaveLength(2);
    expect(guardado?.members[1]).toMatchObject({ roleTitle: 'Anestesiólogo', agreedPaymentAmount: '500', invitationStatus: 'PENDING' });

    // Va a la ficha del grupo creado.
    await expect(page.getByTestId('medical-group-status')).toContainText('Esperando al equipo');
    await expect(page.getByText(lugar)).toBeVisible();
    await capturar(page, 'ficha-creada');

    // Recarga: el grupo sigue ahí, leído de nuevo.
    await page.goto(`${LISTA}/${grupoId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('medical-group-status')).toContainText('Esperando al equipo', { timeout: 30_000 });
    await expect(page.getByText(lugar)).toBeVisible();

    // Y aparece en «Solicitudes enviadas» con su invitación sin responder.
    await page.goto(LISTA, { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Solicitudes enviadas' }).click();
    await expect(page.getByText(lugar)).toBeVisible({ timeout: 30_000 });
    await capturar(page, 'enviadas-con-el-nuevo');
    expect(errores).toEqual([]);
  });

  test('S6: un grupo que no existe se dice sin mostrar datos', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page);
    await page.goto(`${LISTA}/00000000-0000-4000-8000-000000000000`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-view-state-host')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('app-card')).toHaveCount(0);
    await capturar(page, 'no-encontrado');
  });
});

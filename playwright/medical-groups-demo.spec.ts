import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * Grupos médicos (FT-21, carril 21) contra el simulador (`start:demo`).
 *
 * `carril-21-grupo-medico.spec.ts` recorre el flujo contra la API real y se
 * omite sin ella; este recorre lo mismo contra la maqueta, así que corre en
 * cualquier máquina y deja capturas. Demuestra, con navegador y sin `networkidle`:
 *
 *   - listado, consulta y alta cargan por URL directa, sin desborde horizontal,
 *     en 1440, 768 y 390 y en claro y oscuro, y se mide su centrado y su ancho;
 *   - responder una invitación, cargar las notas del ejercicio, crear un grupo
 *     y pedir un cambio de horario: UI → simulador → recarga → UI;
 *   - un grupo que no existe se dice sin mostrar datos (S6).
 *
 * **Qué no se ve acá:** en `demo` el backend es el simulador y responde dentro de
 * la propia aplicación, así que no hay petición de red que observar. La
 * persistencia se comprueba recargando la página (el simulador guarda en
 * `sessionStorage`); el cuerpo exacto de cada petición lo fijan las pruebas
 * unitarias del cliente. Nada de esto toca la API real.
 *
 * Capturas y `medidas.json`: `docs/frontend/evidence/grupo-medico/`.
 */

const EVIDENCIA = join(process.cwd(), 'docs', 'frontend', 'evidence', 'grupo-medico');
const LISTA = '/my-medical-groups';

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
function vigilar(page: Page): { errores: string[] } {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(`console: ${m.text()}`);
  });
  return { errores };
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

async function sinDesborde(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
}

/** Holgura izquierda y derecha del bloque respecto de `.app-main__inner`, y su ancho relativo. */
async function centrado(page: Page, selector: string): Promise<{ izquierda: number; derecha: number; ancho: number; tarjetas: number }> {
  return page.evaluate((sel) => {
    const area = document.querySelector('.app-main__inner')!.getBoundingClientRect();
    const bloque = document.querySelector(sel)!.getBoundingClientRect();
    return {
      izquierda: Math.round(bloque.left - area.left),
      derecha: Math.round(area.right - bloque.right),
      ancho: Math.round((bloque.width / area.width) * 100),
      tarjetas: document.querySelectorAll('.app-main__inner app-card').length,
    };
  }, selector);
}

async function capturar(page: Page, nombre: string): Promise<void> {
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), fullPage: true });
}

/** Abre la pestaña del listado y espera a que se dibuje su contenido. */
async function pestana(page: Page, nombre: string): Promise<void> {
  await page.getByRole('tab', { name: nombre }).click();
}

test.describe('Grupos médicos · simulador', () => {
  // Una página nueva por ancho y tema: encadenar cargas en la misma pestaña
  // acumula memoria y, en una máquina cargada, el renderizador se cae.
  for (const vp of VIEWPORTS) {
    for (const tema of TEMAS) {
      test.describe(`${vp.nombre} ${tema}`, () => {
        test.use({ viewport: { width: vp.width, height: vp.height } });

        test(`listado, consulta y alta por URL directa en ${vp.nombre} (${tema}): sin desborde`, async ({ page }) => {
          const { errores } = vigilar(page);
          await entrar(page);
          await ponerTema(page, tema);

          await page.goto(LISTA, { waitUntil: 'domcontentloaded' });
          if (tema === 'dark') {
            await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 30_000 });
          }
          await expect(page.getByRole('heading', { name: 'Grupos médicos' }).first()).toBeVisible({ timeout: 60_000 });
          await expect(page.getByTestId('medical-group-open').first()).toBeVisible({ timeout: 30_000 });
          expect(await sinDesborde(page), 'listado sin desborde').toBe(true);
          await capturar(page, `listado-${vp.nombre}-${tema}`);

          await page.getByTestId('medical-group-open').first().click();
          await expect(page.getByTestId('medical-group-status')).toBeVisible({ timeout: 30_000 });
          expect(await sinDesborde(page), 'consulta sin desborde').toBe(true);
          medidas[`consulta-${vp.nombre}-${tema}`] = await centrado(page, '.consulta');
          await capturar(page, `consulta-${vp.nombre}-${tema}`);

          await page.goto(`${LISTA}/new`, { waitUntil: 'domcontentloaded' });
          await expect(page.getByRole('heading', { name: 'Crear grupo médico' }).first()).toBeVisible({ timeout: 60_000 });
          expect(await sinDesborde(page), 'alta sin desborde').toBe(true);
          medidas[`alta-${vp.nombre}-${tema}`] = await centrado(page, 'form.grupo');
          await capturar(page, `alta-${vp.nombre}-${tema}`);

          expect(errores, 'errores de consola o de página').toEqual([]);
        });
      });
    }
  }

  test('responder una invitación: UI → simulador → recarga → UI', async ({ page }) => {
    const { errores } = vigilar(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page);

    await page.goto(LISTA, { waitUntil: 'domcontentloaded' });
    await pestana(page, 'Solicitudes recibidas');
    await expect(page.getByTestId('medical-group-open').first()).toBeVisible({ timeout: 30_000 });
    await capturar(page, 'recibidas-antes');
    await page.getByTestId('medical-group-open').first().click();

    await expect(page.getByTestId('medical-group-accept')).toBeVisible({ timeout: 30_000 });
    const url = page.url();
    await expect(page.getByTestId('medical-group-status')).toContainText('Esperando al equipo');
    await capturar(page, 'invitacion-antes');

    await page.getByTestId('medical-group-accept').click();
    await expect(page.getByTestId('medical-group-status')).toContainText('Programado', { timeout: 30_000 });
    await expect(page.getByTestId('medical-group-accept')).toHaveCount(0);
    await capturar(page, 'invitacion-despues');

    // Recarga: lo aceptado se vuelve a leer del simulador.
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('medical-group-status')).toContainText('Programado', { timeout: 30_000 });
    await expect(page.getByTestId('medical-group-accept')).toHaveCount(0);

    // Y la pestaña de recibidas ya no la ofrece.
    await page.goto(LISTA, { waitUntil: 'domcontentloaded' });
    await pestana(page, 'Solicitudes recibidas');
    await expect(page.getByTestId('medical-group-open')).toHaveCount(0, { timeout: 30_000 });
    await capturar(page, 'recibidas-vacio');
    expect(errores).toEqual([]);
  });

  test('realizado y dentro de la semana: las notas del ejercicio se guardan y persisten tras recargar', async ({ page }) => {
    const { errores } = vigilar(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page);

    await page.goto(LISTA, { waitUntil: 'domcontentloaded' });
    await page.getByRole('row', { name: /Gabinete de cardiología/ }).getByTestId('medical-group-open').click();
    const notas = page.getByRole('textbox', { name: 'Notas del procedimiento' });
    await expect(notas).toBeVisible({ timeout: 30_000 });
    const texto = `Sin complicaciones ${Date.now()}`;
    await notas.fill(texto);
    await capturar(page, 'notas-antes');
    const url = page.url();
    await page.getByTestId('medical-group-save-notes').click();
    await expect(page.getByTestId('medical-group-save-notes')).not.toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('textbox', { name: 'Notas del procedimiento' })).toHaveValue(texto, { timeout: 30_000 });
    await capturar(page, 'notas-despues');
    expect(errores).toEqual([]);
  });

  test('pasada la semana: el expediente está cerrado y no ofrece ninguna edición', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page);
    await page.goto(LISTA, { waitUntil: 'domcontentloaded' });
    await page.getByRole('row', { name: /Consultorio Dra\. Rojas/ }).getByTestId('medical-group-open').click();

    await expect(page.getByTestId('medical-group-closed')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('medical-group-save-notes')).toHaveCount(0);
    await expect(page.getByTestId('medical-group-request-reschedule')).toHaveCount(0);
    await capturar(page, 'cerrado');
  });

  test('crear un grupo con un cargo: UI → simulador → recarga → UI', async ({ page }) => {
    const { errores } = vigilar(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page);
    await page.goto(`${LISTA}/new`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Crear grupo médico' }).first()).toBeVisible({ timeout: 60_000 });

    const lugar = `Quirófano de la prueba ${Date.now()}`;
    // La primera práctica viene elegida; la búsqueda sale sola tras la espera.
    await page.getByLabel('Buscar servicio por código o nombre').fill('Consulta');
    await page.getByRole('button', { name: 'Elegir' }).first().click();
    await expect(page.getByTestId('medical-group-form-service')).toBeVisible();

    const fecha = page.getByPlaceholder('DD/MM/AAAA');
    await fecha.click();
    await fecha.pressSequentially('15122030');
    await fecha.blur();
    await expect(fecha).toHaveValue('15/12/2030');
    await page.getByTestId('medical-group-form-location').fill(lugar);

    // Los colegas se piden al elegir el servicio: se espera a que lleguen antes de elegir.
    const colega = page.getByTestId('medical-group-form-practitioner-0').getByRole('combobox');
    await expect(colega).not.toContainText('Cargando', { timeout: 30_000 });
    await colega.click();
    await page.getByRole('option').first().click();
    await expect(colega).not.toContainText('Elija un colega');
    // Medido en esta pantalla: lo que se escribe en el cargo dentro de ~200 ms de
    // haber elegido al colega se pierde (la lista de elección se está cerrando).
    // Una persona tarda más; el robot tiene que esperarlo igual.
    await page.waitForTimeout(500);
    const cargo = page.getByTestId('medical-group-form-role-0');
    await cargo.fill('Anestesiólogo');
    await expect(cargo).toHaveValue('Anestesiólogo');
    const pago = page.getByTestId('medical-group-form-amount-0');
    await pago.fill('500');
    await expect(pago).toHaveValue('500');
    await capturar(page, 'alta-completa');

    await page.getByTestId('medical-group-form-save').click();
    await expect(page).toHaveURL(new RegExp(`${LISTA}/[0-9a-z-]{10,}$`), { timeout: 30_000 });
    await expect(page.getByTestId('medical-group-status')).toContainText('Esperando al equipo');
    await expect(page.getByText(lugar)).toBeVisible();
    await expect(page.getByText('Consulta cardiológica').first()).toBeVisible();
    await expect(page.getByTestId('medical-group-member')).toHaveCount(2);
    await capturar(page, 'consulta-creado');
    const url = page.url();

    // Recarga: el grupo sigue ahí.
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('medical-group-status')).toContainText('Esperando al equipo', { timeout: 30_000 });

    // Y aparece en «Solicitudes enviadas» con su invitación sin responder.
    await page.goto(LISTA, { waitUntil: 'domcontentloaded' });
    await pestana(page, 'Solicitudes enviadas');
    await expect(page.getByText(lugar)).toBeVisible({ timeout: 30_000 });
    await capturar(page, 'enviadas-con-el-nuevo');
    expect(errores).toEqual([]);
  });

  test('un grupo programado: el creador pide otra fecha y el cambio se aplica directo, también tras recargar', async ({ page }) => {
    const { errores } = vigilar(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page);
    await page.goto(`${LISTA}/new`, { waitUntil: 'domcontentloaded' });
    // La primera práctica viene elegida; la búsqueda sale sola tras la espera.
    await page.getByLabel('Buscar servicio por código o nombre').fill('Consulta');
    await page.getByRole('button', { name: 'Elegir' }).first().click();
    const fecha = page.getByPlaceholder('DD/MM/AAAA');
    await fecha.click();
    await fecha.pressSequentially('15122030');
    await fecha.blur();
    await page.getByTestId('medical-group-form-location').fill('Sala sin equipo');
    await page.getByTestId('medical-group-form-save').click();

    // Sin cargos que esperar, queda programado de una vez.
    await expect(page.getByTestId('medical-group-status')).toContainText('Programado', { timeout: 30_000 });
    await expect(page.getByText(/15 dic de 2030/).first()).toBeVisible();
    const url = page.url();

    await page.getByTestId('medical-group-request-reschedule').click();
    const nueva = page.getByRole('dialog').getByPlaceholder('DD/MM/AAAA');
    await nueva.click();
    await nueva.pressSequentially('20122030');
    await nueva.blur();
    await capturar(page, 'cambio-de-horario');
    await page.getByTestId('medical-group-send-reschedule').click();
    await expect(page.getByText(/20 dic de 2030/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('medical-group-status')).toContainText('Programado');

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/20 dic de 2030/).first()).toBeVisible({ timeout: 30_000 });
    expect(errores).toEqual([]);
  });

  test('S6: un grupo que no existe se dice sin mostrar datos', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page);
    await page.goto(`${LISTA}/00000000-0000-4000-8000-000000000000`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-view-state-host')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('medical-group-status')).toHaveCount(0);
    await capturar(page, 'no-encontrado');
  });
});

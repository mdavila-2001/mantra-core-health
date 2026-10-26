import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
 *     en 1440, 768 y 390 y en claro y oscuro. Consulta y alta son UNA `app-card`
 *     con pestañas (`composition-rules.md` §5): se mide su centrado (holgura
 *     izquierda = derecha, ≤ 2 px) y su ancho (≥ 85 % del área), y se recorre
 *     cada pestaña;
 *   - responder una invitación, cargar las notas del ejercicio, crear un grupo
 *     y pedir un cambio de horario: UI → simulador → recarga → UI;
 *   - elegir a un colega y escribir enseguida en «Cargo o función» no pierde lo
 *     escrito (el desplegable se libera en el acto, sin esperar su salida);
 *   - un grupo que no existe se dice sin mostrar datos (S6).
 *
 * **Qué no se ve acá:** en `demo` el backend es el simulador y responde dentro de
 * la propia aplicación, así que no hay petición de red que observar. La
 * persistencia se comprueba recargando la página (el simulador guarda en
 * `sessionStorage`); el cuerpo exacto de cada petición lo fijan las pruebas
 * unitarias del cliente. Nada de esto toca la API real.
 *
 * `medidas.json` y las capturas clave (seis, no una por caso): `docs/frontend/evidence/grupo-medico/`.
 * El archivo guarda `antes` —lo medido sobre la consulta y el alta apilados— y
 * `despues`, que escribe esta corrida.
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
  // `antes` es la medición previa al rediseño y no la regenera esta corrida.
  const archivo = join(EVIDENCIA, 'medidas.json');
  const previo = existsSync(archivo)
    ? (JSON.parse(readFileSync(archivo, 'utf8')) as { antes?: unknown })
    : {};
  writeFileSync(
    archivo,
    `${JSON.stringify({ antes: previo.antes ?? null, despues: medidas }, null, 2)}\n`,
  );
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

/** Holgura izquierda y derecha de la tarjeta respecto de `.app-main__inner`, y su ancho relativo. */
async function centrado(
  page: Page,
): Promise<{ izquierda: number; derecha: number; ancho: number; tarjetas: number }> {
  return page.evaluate(() => {
    const area = document.querySelector('.app-main__inner')!.getBoundingClientRect();
    const bloque = document.querySelector('.app-main__inner app-card')!.getBoundingClientRect();
    return {
      izquierda: Math.round(bloque.left - area.left),
      derecha: Math.round(area.right - bloque.right),
      ancho: Math.round((bloque.width / area.width) * 100),
      tarjetas: document.querySelectorAll('.app-main__inner app-card').length,
    };
  });
}

/**
 * La regla de la casa (`composition-rules.md` §5), con navegador: UNA tarjeta,
 * holgura izquierda y derecha que difieren en ≤ 2 px, y ≥ 85 % del área.
 */
function exigirCentrada(
  medida: { izquierda: number; derecha: number; ancho: number; tarjetas: number },
  que: string,
): void {
  expect(medida.tarjetas, `${que}: una sola tarjeta`).toBe(1);
  expect(Math.abs(medida.izquierda - medida.derecha), `${que}: centrada`).toBeLessThanOrEqual(2);
  expect(medida.ancho, `${que}: a lo ancho`).toBeGreaterThanOrEqual(85);
}

/**
 * Recorre cada pestaña de la tarjeta: se abre, queda seleccionada, su panel
 * tiene contenido y la página no se desborda. Devuelve los rótulos, en orden.
 */
async function recorrerPestanas(page: Page, esperadas: readonly string[], que: string): Promise<string[]> {
  const tabs = page.locator('.app-main__inner app-card [role="tab"]');
  const rotulos = (await tabs.allTextContents()).map((t) => t.trim());
  // La cuenta del equipo depende del grupo que se abrió: «Equipo (2)» vale por «Equipo (n)».
  expect(rotulos.map((r) => r.replace(/\(\d+\)/, '(n)')), `${que}: pestañas`).toEqual(esperadas);
  for (let i = 0; i < rotulos.length; i++) {
    await tabs.nth(i).click();
    await expect(tabs.nth(i), `${que}: «${rotulos[i]}» seleccionada`).toHaveAttribute('aria-selected', 'true');
    const panel = page.locator('.app-main__inner app-card [role="tabpanel"]:not([hidden])');
    await expect(panel, `${que}: «${rotulos[i]}» con contenido`).toHaveCount(1);
    expect((await panel.innerText()).trim().length, `${que}: «${rotulos[i]}» no está vacía`).toBeGreaterThan(0);
    expect(await sinDesborde(page), `${que}: «${rotulos[i]}» sin desborde`).toBe(true);
  }
  await tabs.first().click();
  return rotulos;
}

const PESTANAS_CONSULTA = ['Resumen', 'Equipo (n)', 'Horario', 'Notas del ejercicio'] as const;
const PESTANAS_ALTA = ['Servicio y paciente', 'Fecha y lugar', 'Equipo'] as const;

/** Sólo las capturas clave (seis): lo demás lo prueban las aserciones, no un PNG. */
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

        test(`listado, consulta y alta por URL directa en ${vp.nombre} (${tema}): una tarjeta centrada, sin desborde`, async ({ page }) => {
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

          await page.getByTestId('medical-group-open').first().click();
          await expect(page.getByTestId('medical-group-status')).toBeVisible({ timeout: 30_000 });
          expect(await sinDesborde(page), 'consulta sin desborde').toBe(true);
          const consulta = await centrado(page);
          medidas[`consulta-${vp.nombre}-${tema}`] = consulta;
          exigirCentrada(consulta, `consulta ${vp.nombre} ${tema}`);
          if (vp.nombre === '1440' && tema === 'light') await capturar(page, 'consulta-1440-light');
          await recorrerPestanas(page, PESTANAS_CONSULTA, `consulta ${vp.nombre} ${tema}`);
          if (vp.nombre === '390' && tema === 'dark') {
            await page.getByRole('tab', { name: /^Equipo/ }).click();
            await capturar(page, 'consulta-390-dark');
          }

          await page.goto(`${LISTA}/new`, { waitUntil: 'domcontentloaded' });
          await expect(page.getByRole('heading', { name: 'Crear grupo médico' }).first()).toBeVisible({ timeout: 60_000 });
          expect(await sinDesborde(page), 'alta sin desborde').toBe(true);
          const alta = await centrado(page);
          medidas[`alta-${vp.nombre}-${tema}`] = alta;
          exigirCentrada(alta, `alta ${vp.nombre} ${tema}`);
          if (vp.nombre === '1440' && tema === 'light') await capturar(page, 'alta-1440-light');
          await recorrerPestanas(page, PESTANAS_ALTA, `alta ${vp.nombre} ${tema}`);
          if (vp.nombre === '768' && tema === 'dark') {
            await page.getByRole('tab', { name: 'Equipo' }).click();
            await capturar(page, 'alta-768-dark');
          }

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
    await page.getByTestId('medical-group-open').first().click();

    await expect(page.getByTestId('medical-group-accept')).toBeVisible({ timeout: 30_000 });
    const url = page.url();
    await expect(page.getByTestId('medical-group-status')).toContainText('Esperando al equipo');

    await page.getByTestId('medical-group-accept').click();
    await expect(page.getByTestId('medical-group-status')).toContainText('Programado', { timeout: 30_000 });
    await expect(page.getByTestId('medical-group-accept')).toHaveCount(0);

    // Recarga: lo aceptado se vuelve a leer del simulador.
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('medical-group-status')).toContainText('Programado', { timeout: 30_000 });
    await expect(page.getByTestId('medical-group-accept')).toHaveCount(0);

    // Y la pestaña de recibidas ya no la ofrece.
    await page.goto(LISTA, { waitUntil: 'domcontentloaded' });
    await pestana(page, 'Solicitudes recibidas');
    await expect(page.getByTestId('medical-group-open')).toHaveCount(0, { timeout: 30_000 });
    expect(errores).toEqual([]);
  });

  test('realizado y dentro de la semana: las notas del ejercicio se guardan y persisten tras recargar', async ({ page }) => {
    const { errores } = vigilar(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page);

    await page.goto(LISTA, { waitUntil: 'domcontentloaded' });
    await page.getByRole('row', { name: /Gabinete de cardiología/ }).getByTestId('medical-group-open').click();
    await expect(page.getByTestId('medical-group-status')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: 'Notas del ejercicio' }).click();
    const notas = page.getByRole('textbox', { name: 'Notas del procedimiento' });
    await expect(notas).toBeVisible({ timeout: 30_000 });
    const texto = `Sin complicaciones ${Date.now()}`;
    await notas.fill(texto);
    const url = page.url();
    await page.getByTestId('medical-group-save-notes').click();
    await expect(page.getByTestId('medical-group-save-notes')).not.toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('medical-group-status')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: 'Notas del ejercicio' }).click();
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
    // `app-tab` no dibuja el panel cerrado: se abre cada uno antes de afirmar que no hay edición.
    await page.getByRole('tab', { name: 'Notas del ejercicio' }).click();
    await expect(page.getByText('Notas del ejercicio').first()).toBeVisible();
    await expect(page.getByTestId('medical-group-save-notes')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Notas del procedimiento' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Horario' }).click();
    await expect(page.getByTestId('medical-group-tab-horario')).toBeVisible();
    await expect(page.getByTestId('medical-group-request-reschedule')).toHaveCount(0);
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

    await page.getByRole('tab', { name: 'Fecha y lugar' }).click();
    const fecha = page.getByPlaceholder('DD/MM/AAAA');
    await fecha.click();
    await fecha.pressSequentially('15122030');
    await fecha.blur();
    await expect(fecha).toHaveValue('15/12/2030');
    await page.getByTestId('medical-group-form-location').fill(lugar);

    await page.getByRole('tab', { name: 'Equipo' }).click();
    // Los colegas se piden al elegir el servicio: se espera a que lleguen antes de elegir.
    const colega = page.getByTestId('medical-group-form-practitioner-0').getByRole('combobox');
    await expect(colega).not.toContainText('Cargando', { timeout: 30_000 });
    await colega.click();
    await page.getByRole('option').first().click();
    await expect(colega).not.toContainText('Elija un colega');
    // Sin espera: elegir libera la página en el acto (ver el test del desplegable).
    const cargo = page.getByTestId('medical-group-form-role-0');
    await cargo.fill('Anestesiólogo');
    await expect(cargo).toHaveValue('Anestesiólogo');
    const pago = page.getByTestId('medical-group-form-amount-0');
    await pago.fill('500');
    await expect(pago).toHaveValue('500');
    await capturar(page, 'alta-completa');

    // Cambiar de pestaña no pierde lo escrito: el valor vive en señales, no en los controles.
    await page.getByRole('tab', { name: 'Fecha y lugar' }).click();
    await expect(page.getByTestId('medical-group-form-location')).toHaveValue(lugar);
    await page.getByRole('tab', { name: 'Equipo' }).click();
    await expect(page.getByTestId('medical-group-form-role-0')).toHaveValue('Anestesiólogo');

    await page.getByTestId('medical-group-form-save').click();
    await expect(page).toHaveURL(new RegExp(`${LISTA}/[0-9a-z-]{10,}$`), { timeout: 30_000 });
    await expect(page.getByTestId('medical-group-status')).toContainText('Esperando al equipo');
    await expect(page.getByText(lugar).first()).toBeVisible();
    await expect(page.getByText('Consulta cardiológica').first()).toBeVisible();
    await page.getByRole('tab', { name: /^Equipo/ }).click();
    await expect(page.getByTestId('medical-group-member')).toHaveCount(2);
    const url = page.url();

    // Recarga: el grupo sigue ahí.
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('medical-group-status')).toContainText('Esperando al equipo', { timeout: 30_000 });
    await page.getByRole('tab', { name: /^Equipo/ }).click();
    await expect(page.getByTestId('medical-group-member')).toHaveCount(2);

    // Y aparece en «Solicitudes enviadas» con su invitación sin responder.
    await page.goto(LISTA, { waitUntil: 'domcontentloaded' });
    await pestana(page, 'Solicitudes enviadas');
    await expect(page.getByText(lugar)).toBeVisible({ timeout: 30_000 });
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
    await page.getByRole('tab', { name: 'Fecha y lugar' }).click();
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

    await page.getByRole('tab', { name: 'Horario' }).click();
    await page.getByTestId('medical-group-request-reschedule').click();
    const nueva = page.getByRole('dialog').getByPlaceholder('DD/MM/AAAA');
    await nueva.click();
    await nueva.pressSequentially('20122030');
    await nueva.blur();
    await page.getByTestId('medical-group-send-reschedule').click();
    await expect(page.getByText(/20 dic de 2030/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('medical-group-status')).toContainText('Programado');

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/20 dic de 2030/).first()).toBeVisible({ timeout: 30_000 });
    expect(errores).toEqual([]);
  });

  test('elegir a un colega y escribir enseguida en «Cargo o función» no pierde lo escrito', async ({ page }) => {
    const { errores } = vigilar(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page);
    await page.goto(`${LISTA}/new`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Buscar servicio por código o nombre').fill('Consulta');
    await page.getByRole('button', { name: 'Elegir' }).first().click();
    await expect(page.getByTestId('medical-group-form-service')).toBeVisible();
    await page.getByRole('tab', { name: 'Equipo' }).click();

    const colega = page.getByTestId('medical-group-form-practitioner-0').getByRole('combobox');
    await expect(colega).not.toContainText('Cargando', { timeout: 30_000 });
    const cargo = page.getByTestId('medical-group-form-role-0');

    // Como una persona: un clic crudo sobre el campo y teclas, a 0, 100 y 200 ms de haber elegido.
    // Con `fill` o `click` de Playwright no se vería: esperan a que el campo sea alcanzable.
    for (const espera of [0, 100, 200]) {
      await cargo.fill('');
      await colega.click();
      await page.getByRole('option').first().click();
      await page.waitForTimeout(espera);
      const caja = (await cargo.boundingBox())!;
      await page.mouse.click(caja.x + 20, caja.y + caja.height / 2);
      await page.keyboard.type('Anestesiólogo', { delay: 10 });
      await expect(cargo, `escrito ${espera} ms después de elegir`).toHaveValue('Anestesiólogo');
      await expect(cargo).toBeFocused();
    }
    expect(errores).toEqual([]);
  });

  test('S6: un grupo que no existe se dice sin mostrar datos', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page);
    await page.goto(`${LISTA}/00000000-0000-4000-8000-000000000000`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-view-state-host')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('medical-group-status')).toHaveCount(0);
  });
});

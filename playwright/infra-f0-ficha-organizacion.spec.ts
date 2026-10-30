import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { entrarAlSimulador } from './support/simulador';

/**
 * WEB-F0 · Ficha de organización: los estados M34 y la navegación desde el
 * listado, en 1440 / 768 / 390, contra `ng serve` con el backend simulado.
 *
 * Nunca `networkidle` (con HMR no llega): se espera un selector concreto de
 * cada estado. Los fallos se provocan con `mock:fallos` (`fallos-simulados.ts`),
 * que vive en `sessionStorage` y se lee en cada petición.
 *
 * Capturas en `docs/refactor-profesional/trabajo/capturas/infra-f0/`.
 *
 * ```bash
 * E2E_BASE_URL=http://localhost:4310 corepack yarn pw playwright/infra-f0-ficha-organizacion.spec.ts
 * ```
 */
const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const SALIDA = join(process.cwd(), 'docs/refactor-profesional/trabajo/capturas/infra-f0');
const ANCHOS = [
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '390', width: 390, height: 844 },
] as const;
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';

mkdirSync(SALIDA, { recursive: true });

test.describe.configure({ mode: 'serial' });

// En un contenedor con otra versión de Chromium preinstalada se puede apuntar
// al ejecutable sin descargar nada: `PW_CHROMIUM_PATH=/ruta/a/chrome`.
if (process.env['PW_CHROMIUM_PATH']) {
  test.use({ launchOptions: { executablePath: process.env['PW_CHROMIUM_PATH'] } });
}

let page: Page;
let fichaOlivos = '';
let fichaVacia = '';
const erroresDeConsola: string[] = [];

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on('pageerror', (e) => erroresDeConsola.push(String(e)));
  await entrarAlSimulador(page, 'superadmin', BASE);
});

test.afterAll(async () => {
  await page.close();
});

async function fallar(patron: string | null, modo?: string): Promise<void> {
  await page.evaluate(
    ([p, m]) => {
      if (p === null) sessionStorage.removeItem('mock:fallos');
      else sessionStorage.setItem('mock:fallos', JSON.stringify([{ patron: p, modo: m }]));
    },
    [patron, modo ?? null] as const,
  );
}

async function sinDesbordeHorizontal(): Promise<void> {
  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(desborde).toBeLessThanOrEqual(0);
}

async function capturar(estado: string): Promise<void> {
  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho.width, height: ancho.height });
    await page.waitForTimeout(300);
    await sinDesbordeHorizontal();
    await page.screenshot({ path: join(SALIDA, `ficha-${estado}-${ancho.nombre}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

test('el listado navega a la ficha (enlace del nombre)', async () => {
  await page.goto(`${BASE}/administration/organizations`, { waitUntil: 'domcontentloaded' });
  const enlace = page.getByTestId('organizaciones-abrir').filter({ hasText: 'Clínica Los Olivos S.R.L.' });
  await expect(enlace).toBeVisible();
  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho.width, height: ancho.height });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(SALIDA, `listado-${ancho.nombre}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await enlace.click();
  await page.waitForURL(/\/administration\/organizations\/[0-9a-f-]{36}$/);
  fichaOlivos = new URL(page.url()).pathname;
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clínica Los Olivos S.R.L.');
});

test('ready: una tarjeta con pestañas, altas en la cabecera, plantilla con nombres', async () => {
  await expect(page.getByTestId('ficha-nueva-sucursal')).toBeVisible();
  await expect(page.getByTestId('ficha-sumar-persona')).toBeVisible();
  await expect(page.getByTestId('ficha-nueva-hija')).toBeVisible();
  await expect(page.getByTestId('ficha-sucursales').locator('tbody tr').first()).toBeVisible();

  // Centrado y a lo ancho (composition-rules §5): holguras ≤ 2 px, ≥ 85 % del área.
  const medida = await page.evaluate(() => {
    const area = document.querySelector('.app-main__inner')!.getBoundingClientRect();
    const tarjeta = document.querySelector('.organizacion__tarjeta')!.getBoundingClientRect();
    const estilo = getComputedStyle(document.querySelector('.app-main__inner')!);
    const izquierda = tarjeta.left - (area.left + parseFloat(estilo.paddingLeft));
    const derecha = area.right - parseFloat(estilo.paddingRight) - tarjeta.right;
    const util = area.width - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
    return { diferencia: Math.abs(izquierda - derecha), proporcion: tarjeta.width / util };
  });
  expect(medida.diferencia).toBeLessThanOrEqual(2);
  expect(medida.proporcion).toBeGreaterThanOrEqual(0.85);

  await capturar('ready');

  await page.getByRole('tab', { name: 'Plantilla' }).click();
  await expect(page).toHaveURL(/tab=plantilla/);
  const plantilla = page.getByTestId('ficha-plantilla');
  await expect(plantilla.locator('tbody tr').first()).toBeVisible();
  await expect(plantilla).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  await capturar('ready-plantilla');
});

test('asignar sede desde la plantilla: POST y relectura confirman (UI → request → persistencia → UI)', async () => {
  const boton = page.getByTestId('ficha-asignar-sede').first();
  await boton.click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toBeVisible();
  const select = dialogo.getByTestId('asignacion-sede');
  if (await select.count()) {
    // `app-select` es un <select> nativo: se elige la primera sede real.
    const nativo = select.locator('select');
    const etiquetas = await nativo.locator('option:not([disabled])').allTextContents();
    const sede = etiquetas.map((t) => t.trim()).find((t) => t !== '' && !t.startsWith('Elegí'))!;
    await nativo.selectOption({ label: sede });
    // La maqueta responde dentro de Angular (interceptor): no hay request de
    // red que esperar. Lo que se mira es la relectura que pinta el modal.
    await dialogo.getByTestId('asignacion-guardar').click();
    await expect(dialogo.getByTestId('asignacion-confirmada')).toBeVisible();
    await expect(dialogo.getByTestId('asignacion-vigentes')).toContainText(sede);
    await page.screenshot({ path: join(SALIDA, 'ficha-asignar-sede-1440.png') });
    // Persistencia: cerrar, recargar la página y reabrir la misma fila.
    await dialogo.getByRole('button', { name: 'Cerrar' }).first().click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('ficha-asignar-sede').first().click();
    await expect(page.getByRole('dialog').getByTestId('asignacion-vigentes')).toContainText(sede);
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).first().click();
  }
});

test('forbidden (S5)', async () => {
  await fallar('/tenants/', 'forbidden');
  await page.goto(`${BASE}${fichaOlivos}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('No tenés acceso a esta sección')).toBeVisible();
  await expect(page.locator('app-tabs')).toHaveCount(0);
  await capturar('forbidden');
  await fallar(null);
});

test('not-found (S6): sin datos del recurso y con salida al listado', async () => {
  await page.goto(`${BASE}/administration/organizations/${INEXISTENTE}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByText('No encontramos lo que buscás')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Volver al listado' }).first()).toBeVisible();
  await expect(page.locator('app-tabs')).toHaveCount(0);
  await capturar('not-found');
});

test('error (S9) con código de soporte', async () => {
  await fallar('/tenants/', 'error');
  await page.goto(`${BASE}${fichaOlivos}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Algo salió mal')).toBeVisible();
  await expect(page.getByText('Código de soporte')).toBeVisible();
  await capturar('error');
  await fallar(null);
});

test('vacío (S3) con próxima acción', async () => {
  await page.goto(`${BASE}/administration/organizations`, { waitUntil: 'domcontentloaded' });
  const enlace = page.getByTestId('organizaciones-abrir').filter({ hasText: 'Laboratorio Central Ltda.' });
  await enlace.click();
  await page.waitForURL(/\/administration\/organizations\/[0-9a-f-]{36}$/);
  fichaVacia = new URL(page.url()).pathname;
  await expect(page.getByTestId('ficha-sucursales').getByText('Nueva sucursal')).toBeVisible();
  await capturar('vacio');
  expect(fichaVacia).not.toBe(fichaOlivos);
});

test('sin errores de página', () => {
  expect(erroresDeConsola).toEqual([]);
});

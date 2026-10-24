import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * El maniquí clínico 3D de `app-body-map` en la pantalla real (2026-10-23).
 *
 * Prueba documental del cambio: el render se carga en cada vista y para cada
 * sexo, las zonas siguen siendo un control completo (clic, teclado, estados) y
 * no hay errores de consola. Las fotos quedan en
 * `artifacts/evidencia/body-map-realistic/`.
 *
 * Corre contra la maqueta (`corepack yarn dev`), sin backend:
 * `E2E_BASE_URL=http://localhost:4291 corepack yarn pw body-map-realistic --workers=1`.
 */

const EVIDENCE = join(process.cwd(), 'artifacts/evidencia/body-map-realistic');
mkdirSync(EVIDENCE, { recursive: true });

const RUTA = '/search/symptoms';
const VIEWPORTS = [
  { nombre: '375', width: 375, height: 812 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1440', width: 1440, height: 900 },
] as const;
const VISTAS = [
  { boton: 'Frente', archivo: 'front' },
  { boton: 'Espalda', archivo: 'back' },
  { boton: 'Cara', archivo: 'face' },
] as const;

/** Las cuentas de paciente de la maqueta, una por sexo (`fixtures/personas.ts`). */
const CUENTAS = [
  { sexo: 'female', documento: '7654321' },
  { sexo: 'male', documento: '5009871' },
] as const;

/**
 * Errores que ya estaban antes de este cambio, fuera de `app-body-map` (el
 * diff no toca `features/`, `src/server/` ni `index.html`). Se registran en
 * `console-errors.json` y en el `REPORT.md`, no se esconden:
 *
 * - sin sesión, `symptom-check` igual pide `/profiles/patients/me` y la
 *   maqueta responde 404;
 * - en `/auth`, el servidor de desarrollo bloquea por CSP dos scripts en línea.
 */
const PREEXISTENTES = [
  /GET \/profiles\/patients\/me → 404/,
  /Content Security Policy directive 'script-src/,
];

const TODOS_LOS_ERRORES: Record<string, string[]> = {};

test.afterAll(() => {
  writeFileSync(join(EVIDENCE, 'console-errors.json'), JSON.stringify(TODOS_LOS_ERRORES, null, 2));
});

function nuevos(errores: readonly string[]): string[] {
  return errores.filter((error) => !PREEXISTENTES.some((conocido) => conocido.test(error)));
}

function vigilarConsola(page: Page): string[] {
  const errores: string[] = [];
  TODOS_LOS_ERRORES[test.info().title] = errores;
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(mensaje.text());
  });
  page.on('pageerror', (error) => errores.push(error.message));
  page.on('response', (respuesta) => {
    if (respuesta.url().includes('/body-map/') && respuesta.status() >= 400) {
      errores.push(`${respuesta.status()} ${respuesta.url()}`);
    }
  });
  return errores;
}

function mapa(page: Page): Locator {
  return page.locator('app-body-map');
}

function render(page: Page): Locator {
  return page.getByTestId('body-map-render');
}

/** El render terminó de bajar: el `<image>` del SVG no expone `complete`, se pide de nuevo y se decodifica. */
async function esperarRender(page: Page, sexo: string, vista: string): Promise<void> {
  await expect(render(page)).toHaveAttribute('href', `/body-map/${sexo}-${vista}.webp`);
  const decodificada = await page.evaluate(async (url) => {
    const imagen = new Image();
    imagen.src = url;
    await imagen.decode();
    return { ancho: imagen.naturalWidth, alto: imagen.naturalHeight };
  }, `/body-map/${sexo}-${vista}.webp`);
  expect(decodificada.ancho).toBeGreaterThan(500);
}

async function pasarA(page: Page, boton: string): Promise<void> {
  await mapa(page).getByRole('radio', { name: boton }).click();
}

async function entrar(page: Page, documento: string): Promise<void> {
  await page.goto('/auth');
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* sin almacenamiento no hay sesión que borrar */
    }
  });
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill(documento);
  await page.getByTestId('login-password').fill('demo');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('header-cuenta')).toBeVisible({ timeout: 30_000 });
}

test.describe('Mapa corporal · maniquí 3D', () => {
  test('neutro sin sesión: las tres vistas en 375, 768 y 1440 claro, y 1440 oscuro', async ({ page }) => {
    const errores = vigilarConsola(page);
    const corridas = [
      ...VIEWPORTS.map((vp) => ({ ...vp, tema: 'light' as const })),
      { ...VIEWPORTS[2], tema: 'dark' as const },
    ];
    for (const corrida of corridas) {
      await page.setViewportSize({ width: corrida.width, height: corrida.height });
      await page.goto(RUTA);
      // El tema se elige con el botón de la cabecera y queda guardado
      // (`ThemeService`); no sigue al sistema, así que se pone igual que él.
      await page.evaluate((tema) => localStorage.setItem('mantra-core-health.theme', tema), corrida.tema);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', corrida.tema);
      await expect(mapa(page)).toBeVisible();
      for (const vista of VISTAS) {
        await pasarA(page, vista.boton);
        await esperarRender(page, 'neutral', vista.archivo);
        await mapa(page).scrollIntoViewIfNeeded();
        await mapa(page).screenshot({
          path: join(EVIDENCE, `neutral-${vista.archivo}-${corrida.nombre}-${corrida.tema}.png`),
        });
      }
      // Nada se desborda: la página no gana scroll horizontal por la figura.
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(desborde, `scroll horizontal en ${corrida.nombre}`).toBeLessThanOrEqual(0);
    }
    await page.evaluate(() => localStorage.setItem('mantra-core-health.theme', 'light'));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(RUTA);
    await esperarRender(page, 'neutral', 'front');
    await page.screenshot({ path: join(EVIDENCE, 'page-1440-light.png'), fullPage: true });
    expect(nuevos(errores)).toEqual([]);
  });

  test('estados: apuntada, elegida y marcada por lo que se contó', async ({ page }) => {
    const errores = vigilarConsola(page);
    await page.goto(RUTA);
    await esperarRender(page, 'neutral', 'front');

    await page.getByTestId('body-map-pecho').hover();
    await expect(mapa(page).locator('.body-map__pista')).toHaveText('Pecho y respiración');
    await mapa(page).screenshot({ path: join(EVIDENCE, 'state-hover.png') });

    await page.getByTestId('body-map-estomago').click({ force: true });
    await expect(page.getByTestId('body-map-estomago')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('body-map-elegida')).toContainText('Estómago');
    await page.mouse.move(0, 0);
    await mapa(page).screenshot({ path: join(EVIDENCE, 'state-selected.png') });

    await page.getByRole('textbox', { name: 'Cuéntenos con sus palabras' }).fill('me duele la cabeza y la rodilla');
    await expect(page.getByTestId('body-map-marcadas')).toBeVisible();
    await mapa(page).screenshot({ path: join(EVIDENCE, 'state-marked.png') });
    expect(nuevos(errores)).toEqual([]);
  });

  test('teclado: Tab recorre las zonas y Enter y la barra eligen sin mover la página', async ({ page }) => {
    const errores = vigilarConsola(page);
    await page.goto(RUTA);
    await esperarRender(page, 'neutral', 'front');

    await mapa(page).getByRole('radio', { name: 'Frente' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('body-map-cabeza')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('body-map-garganta')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('body-map-garganta')).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('body-map-hombros')).toBeFocused();
    const antes = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('Space');
    await expect(page.getByTestId('body-map-hombros')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.scrollY)).toBe(antes);
    await mapa(page).screenshot({ path: join(EVIDENCE, 'keyboard-focus.png') });
    expect(nuevos(errores)).toEqual([]);
  });

  for (const cuenta of CUENTAS) {
    test(`con sesión ${cuenta.sexo}: el maniquí de su sexo en las tres vistas`, async ({ page }) => {
      const errores = vigilarConsola(page);
      await entrar(page, cuenta.documento);
      await page.goto(RUTA);
      for (const vista of VISTAS) {
        await pasarA(page, vista.boton);
        await esperarRender(page, cuenta.sexo, vista.archivo);
        await mapa(page).screenshot({ path: join(EVIDENCE, `${cuenta.sexo}-${vista.archivo}-1440-light.png`) });
      }
      expect(nuevos(errores)).toEqual([]);
    });
  }
});

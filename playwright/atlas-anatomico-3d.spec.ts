import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * El atlas anatómico 3D: tocar una pieza abre su ficha y resalta sus relacionadas.
 *
 * Se toca el lienzo de verdad —un clic en coordenadas sobre el modelo— y se
 * comprueba lo que una persona vería: que la URL nombra la estructura, que la
 * ficha trae título y que «Relacionadas» lista algo. Se hace con el cuerpo
 * «Hombre» y con la vista «Mujer», en 375, 768 y 1440 claro y 1440 oscuro, y
 * cada caso deja su captura en `docs/progress/evidence/anatomy-atlas/screenshots/`.
 *
 * WebGL en Chromium sin pantalla corre por SwiftShader (`--enable-unsafe-swiftshader`);
 * sin eso el visor muestra el aviso de «su navegador no puede dibujar el
 * modelo», que también es un camino válido pero no el que se prueba acá.
 *
 * Nunca se espera `networkidle`: con `ng serve` no llega (CLAUDE.md §5).
 *
 * Uso: `yarn pw --workers=1 atlas-anatomico-3d`
 */

const CAPTURAS = join(process.cwd(), 'docs', 'progress', 'evidence', 'anatomy-atlas', 'screenshots');
const RUTA = '/glossary/anatomy-atlas';

test.use({
  launchOptions: {
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    // Un Chromium ya instalado que no sea el de esta versión de Playwright
    // (el contenedor en la nube trae uno propio); vacío, se usa el de siempre.
    ...(process.env['PW_CHROMIUM_PATH'] ? { executablePath: process.env['PW_CHROMIUM_PATH'] } : {}),
  },
});

async function entrarComoMedica(pagina: Page): Promise<void> {
  await pagina.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await pagina.getByTestId('login-identifier').fill('medica@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

/** Espera a que el visor termine de bajar y dibujar las capas encendidas. */
async function esperarModelo(pagina: Page): Promise<void> {
  const visor = pagina.locator('app-anatomy-viewer .anatomy-viewer');
  await expect(visor).toHaveAttribute('data-status', 'ready', { timeout: 120_000 });
  // Un cuadro más para que el render pedido por la carga llegue al lienzo.
  await pagina.waitForTimeout(500);
}

/**
 * Toca el modelo hasta abrir una ficha: prueba puntos a lo largo del eje del
 * cuerpo (columna, pelvis, tórax, cráneo), que es donde siempre hay pieza.
 */
async function tocarUnaPieza(pagina: Page): Promise<string> {
  const lienzo = pagina.getByTestId('anatomy-viewer-canvas');
  const caja = await lienzo.boundingBox();
  if (caja === null) throw new Error('El lienzo no tiene caja.');
  for (const fraccion of [0.5, 0.42, 0.58, 0.35, 0.65, 0.25, 0.12, 0.75]) {
    await pagina.mouse.click(caja.x + caja.width / 2, caja.y + caja.height * fraccion);
    try {
      await expect(pagina).toHaveURL(/structure=/, { timeout: 4_000 });
      const url = new URL(pagina.url());
      return url.searchParams.get('structure') ?? '';
    } catch {
      // Ese punto cayó entre piezas; se prueba el siguiente.
    }
  }
  throw new Error('Ningún punto del eje del cuerpo abrió una ficha.');
}

async function comprobarFicha(pagina: Page): Promise<void> {
  await expect(pagina.getByTestId('atlas3d-ficha-titulo')).toBeVisible({ timeout: 30_000 });
  await pagina.getByRole('tab', { name: 'Relacionadas' }).click();
  // Una pieza del modelo siempre forma parte de algo: la lista no queda vacía.
  await expect(pagina.getByTestId('atlas3d-relacionadas').first()).toBeVisible();
  await pagina.getByRole('tab', { name: 'Ficha' }).click();
}

test.beforeAll(() => {
  mkdirSync(CAPTURAS, { recursive: true });
});

const CASOS = [
  { nombre: '375-claro', ancho: 375, alto: 812, tema: 'light' as const },
  { nombre: '768-claro', ancho: 768, alto: 1024, tema: 'light' as const },
  { nombre: '1440-claro', ancho: 1440, alto: 900, tema: 'light' as const },
  { nombre: '1440-oscuro', ancho: 1440, alto: 900, tema: 'dark' as const },
];

for (const caso of CASOS) {
  for (const sexo of ['male', 'female'] as const) {
    test(`tocar una pieza abre su ficha — ${sexo} — ${caso.nombre}`, async ({ page }) => {
      await page.setViewportSize({ width: caso.ancho, height: caso.alto });
      await page.emulateMedia({ colorScheme: caso.tema });
      await entrarComoMedica(page);
      await page.goto(sexo === 'female' ? `${RUTA}?sex=female` : RUTA, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      if (caso.tema === 'dark') {
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      }

      await esperarModelo(page);
      if (sexo === 'female') {
        await expect(page.getByTestId('atlas3d-aviso-mujer')).toContainText('No existe un modelo 3D femenino libre');
      }
      await page.getByTestId('anatomy-viewer-canvas').scrollIntoViewIfNeeded();
      const estructura = await tocarUnaPieza(page);
      expect(estructura).toMatch(/^(UBERON|FMA|BP3D):/);
      await comprobarFicha(page);

      await page.screenshot({ path: `${CAPTURAS}/${sexo}-${caso.nombre}.png`, fullPage: true });
    });
  }
}

test('en la vista «Mujer» no queda ninguna pieza genital masculina tocable, y las femeninas se listan sin pieza', async ({ page }) => {
  await entrarComoMedica(page);
  await page.goto(`${RUTA}?sex=female`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await esperarModelo(page);
  await page.getByText(/Estructuras femeninas sin pieza 3D/).click();
  await page.getByRole('button', { name: /^uterus$|^útero$/i }).first().click();
  await expect(page).toHaveURL(/structure=UBERON%3A0000995|structure=UBERON:0000995/);
  await expect(page.getByTestId('atlas3d-ficha-titulo')).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: `${CAPTURAS}/female-utero-sin-pieza.png`, fullPage: true });
});

test('se elige una pieza con el teclado desde la búsqueda y se resaltan sus relacionadas', async ({ page }) => {
  await entrarComoMedica(page);
  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await esperarModelo(page);
  const buscador = page.getByTestId('atlas3d-buscar').locator('input');
  await buscador.fill('femur');
  const opcion = page.getByRole('button', { name: /^(fémur|femur)$/i }).first();
  await opcion.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/structure=UBERON(%3A|:)0000981/);
  await comprobarFicha(page);
  await page.getByRole('tab', { name: 'Relacionadas' }).click();
  await expect(page.getByText('resaltada en el modelo').first()).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/teclado-femur-relacionadas.png`, fullPage: true });
});

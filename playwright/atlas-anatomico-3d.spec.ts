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

/**
 * El lienzo tiene dibujo: decodifica en el navegador la captura del propio
 * lienzo y cuenta los píxeles que se apartan del fondo. Un lienzo vacío pasaba
 * igual por `data-status="ready"`; esto no.
 */
async function lienzoConDibujo(pagina: Page): Promise<{ piezas: number; verdes: number; ocres: number }> {
  const lienzo = pagina.getByTestId('anatomy-viewer-canvas');
  await lienzo.scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(400);
  const png = (await lienzo.screenshot()).toString('base64');
  return pagina.evaluate(async (datos) => {
    // Sin fetch: la CSP de la app (connect-src 'self') no deja pedir un data: URL.
    const binario = Uint8Array.from(atob(datos), (c) => c.charCodeAt(0));
    const imagen = await createImageBitmap(new Blob([binario], { type: 'image/png' }));
    const c = new OffscreenCanvas(imagen.width, imagen.height);
    const g = c.getContext('2d');
    if (g === null) throw new Error('sin 2d');
    g.drawImage(imagen, 0, 0);
    const px = g.getImageData(0, 0, imagen.width, imagen.height).data;
    const [r0, g0, b0] = [px[0], px[1], px[2]];
    let piezas = 0;
    let verdes = 0;
    let ocres = 0;
    for (let i = 0; i < px.length; i += 4) {
      const [r, gg, b] = [px[i], px[i + 1], px[i + 2]];
      if (Math.abs(r - r0) + Math.abs(gg - g0) + Math.abs(b - b0) > 30) piezas++;
      // --c-success-500 (#2E8B6E) y --c-amber-600 (#B78A59), con margen por la luz.
      if (gg > r + 25 && gg > b + 5) verdes++;
      if (r > b + 40 && r > gg + 10 && gg > b + 15) ocres++;
    }
    return { piezas, verdes, ocres };
  }, png);
}

async function comprobarFicha(pagina: Page): Promise<void> {
  await expect(pagina.getByTestId('atlas3d-ficha-titulo')).toBeVisible({ timeout: 30_000 });
  await pagina.getByRole('tab', { name: 'Relaciones' }).click();
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
        await expect(page.getByTestId('atlas3d-aviso-mujer')).toContainText('Cuerpo femenino de referencia');
      }
      await page.getByTestId('anatomy-viewer-canvas').scrollIntoViewIfNeeded();
      const estructura = await tocarUnaPieza(page);
      expect(estructura).toMatch(/^(UBERON|FMA|BP3D|HRA):/);
      await comprobarFicha(page);

      const dibujo = await lienzoConDibujo(page);
      expect(dibujo.piezas, 'el lienzo tiene el modelo dibujado').toBeGreaterThan(2000);
      expect(dibujo.verdes, 'la pieza elegida se ve en verde').toBeGreaterThan(20);
      await page.mouse.move(0, 0);
      // La captura de la zona de trabajo no cambia el tamaño de la ventana, así
      // que el lienzo WebGL no se borra; la de página entera sí lo haría.
      await page.locator('.atlas3d__trabajo').screenshot({ path: `${CAPTURAS}/${sexo}-${caso.nombre}.png` });
      await page.screenshot({ path: `${CAPTURAS}/${sexo}-${caso.nombre}-pagina.png`, fullPage: true });
    });
  }
}

test('la vista «Mujer» abre el útero desde la lista y lo resalta en el modelo', async ({ page }) => {
  await entrarComoMedica(page);
  await page.goto(`${RUTA}?sex=female`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await esperarModelo(page);
  const modelo = page.getByTestId('atlas3d-femeninas-modelo');
  await modelo.getByText(/Piezas femeninas del modelo/).click();
  // La lista está paginada y en orden alfabético: «útero» va al final.
  const utero = modelo.getByRole('button', { name: /^útero$/i });
  for (let i = 0; i < 12 && (await utero.count()) === 0; i++) {
    await modelo.getByRole('button', { name: /siguiente/i }).click();
  }
  await utero.click();
  await expect(page).toHaveURL(/structure=UBERON%3A0000995|structure=UBERON:0000995/);
  await expect(page.getByTestId('atlas3d-ficha-titulo')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('atlas3d-ficha-titulo')).toBeInViewport();
  await expect(page.getByTestId('atlas3d-ficha-titulo')).toBeFocused();
  await expect(page.getByTestId('atlas3d-sin-pieza')).toHaveCount(0);
  const dibujo = await lienzoConDibujo(page);
  expect(dibujo.verdes, 'el útero elegido se ve en verde').toBeGreaterThan(20);
  await page.mouse.move(0, 0);
  await page.locator('.atlas3d__trabajo').screenshot({ path: `${CAPTURAS}/female-utero.png` });
});

test('la vista «Mujer» lista la vagina como ficha sin pieza 3D', async ({ page }) => {
  await entrarComoMedica(page);
  await page.goto(`${RUTA}?sex=female`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await esperarModelo(page);
  const sinPieza = page.getByTestId('atlas3d-femeninas-sin-pieza');
  await sinPieza.getByText(/Estructuras femeninas sin pieza 3D/).click();
  // La lista está paginada y en orden alfabético: se busca hasta dar con ella.
  const vagina = sinPieza.getByRole('button', { name: /^vagina$/i });
  for (let i = 0; i < 12 && (await vagina.count()) === 0; i++) {
    await sinPieza.getByRole('button', { name: /siguiente/i }).click();
  }
  await vagina.click();
  await expect(page).toHaveURL(/structure=UBERON%3A0000996|structure=UBERON:0000996/);
  await expect(page.getByTestId('atlas3d-sin-pieza')).toBeVisible({ timeout: 30_000 });
});

test('se elige una pieza con el teclado desde la búsqueda y se resaltan sus relacionadas', async ({ page }) => {
  await entrarComoMedica(page);
  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await esperarModelo(page);
  const buscador = page.getByTestId('atlas3d-buscar').locator('input');
  await buscador.fill('femur');
  const opcion = page.getByRole('button', { name: /^(fémur|femur)$/i }).first();
  await expect(opcion).toBeVisible();
  // Desde el buscador sólo con Tab hasta la opción, y Enter: el camino de
  // quien no usa ratón.
  for (let i = 0; i < 6 && !(await opcion.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(opcion).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/structure=UBERON(%3A|:)0000981/);
  await comprobarFicha(page);
  await page.getByRole('tab', { name: 'Relaciones' }).click();
  await expect(page.getByText('resaltada en el modelo').first()).toBeVisible();
  const dibujo = await lienzoConDibujo(page);
  expect(dibujo.verdes, 'el fémur elegido se ve en verde').toBeGreaterThan(20);
  expect(dibujo.ocres, 'sus relacionadas se ven en ocre').toBeGreaterThan(20);
  await page.mouse.move(0, 0);
  await page.locator('.atlas3d__trabajo').screenshot({ path: `${CAPTURAS}/teclado-femur-relacionadas.png` });
});

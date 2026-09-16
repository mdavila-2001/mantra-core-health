import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * El corpus «Bolivia Salud · Eje Central» llega a la pantalla.
 *
 * ## Qué prueba, y por qué así
 *
 * Que los laboratorios y las farmacias que se ven sean **los del corpus** y no
 * los inventados de antes. No se comprueba contando tarjetas: se busca a
 * SELADIS, a CENETROP y a Farmacorp por su nombre. Un directorio con quince
 * tarjetas puede estar lleno de nombres que no existen, y el conteo pasaría.
 *
 * Tampoco se comprueba leyendo el fixture —eso ya lo hace
 * `bolivia-eje-central.spec.ts`—. Acá el navegador pide, el simulador contesta
 * y la pantalla pinta: es el único sitio donde se ve si la cadena entera
 * funciona.
 *
 * ## Contra qué corre
 *
 * `E2E_BASE_URL`, o `http://localhost:4200`. Sirve tanto el servidor de
 * desarrollo como el artefacto de producción
 * (`node dist/mantra-core-health/server/server.mjs`), que es lo que se
 * despliega.
 *
 * Uso: `yarn pw --workers=1 datos-bolivia-en-pantalla`
 */

// `import.meta` no está disponible acá: los specs se cargan como CommonJS.
const CAPTURAS = join(process.cwd(), 'artifacts', 'datos-bolivia');

/** Los tres anchos de la casa. */
const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

test.beforeAll(() => {
  mkdirSync(CAPTURAS, { recursive: true });
});

/**
 * Abre una ruta y espera a que el simulador haya contestado.
 *
 * **Nunca `networkidle`**: con el servidor de desarrollo el socket de recarga
 * en caliente no calla nunca, así que esa espera da verdes falsos. Se espera a
 * que aparezca contenido real.
 */
async function abrir(pagina: Page, ruta: string): Promise<void> {
  await pagina.goto(ruta, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(pagina.locator('main')).toBeVisible({ timeout: 60_000 });
}

/**
 * Entra como paciente.
 *
 * Los directorios de la aplicación **piden sesión** —los cuatro, el de
 * farmacias incluido—: sin ella la ruta redirige a la pantalla de acceso, que
 * es en lo que terminaron estas pruebas la primera vez que se corrieron.
 *
 * Sirve cualquier contraseña no vacía: el simulador no valida credenciales.
 */
async function entrarComoPaciente(pagina: Page): Promise<void> {
  await pagina.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await pagina.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

/** Lo que se ve en la página, sin el marco. */
async function textoDeLaPagina(pagina: Page): Promise<string> {
  return (await pagina.locator('main').innerText()).normalize('NFC');
}

test.describe('los laboratorios del corpus en el directorio', () => {
  test('la portada ofrece la categoría de laboratorio clínico', async ({ page }) => {
    await entrarComoPaciente(page);
    await abrir(page, '/laboratory-directory');

    await expect(page.getByTestId('portada-categorias')).toBeVisible({ timeout: 60_000 });
    await page.screenshot({
      path: `${CAPTURAS}/laboratorios-portada.png`,
      fullPage: true,
    });
  });

  test('dentro de la categoría aparecen centros que existen en Bolivia', async ({ page }) => {
    await entrarComoPaciente(page);
    await abrir(page, '/laboratory-directory?kind=LABORATORY');
    // La lista tarda lo que tarda el fragmento diferido del simulador.
    await expect(page.getByText('SELADIS', { exact: false }).first()).toBeVisible({
      timeout: 60_000,
    });

    const texto = await textoDeLaPagina(page);

    // Tres centros reales, de tres ciudades y tres clases distintas: un
    // universitario, un centro de referencia en medicina tropical y una red
    // privada. Si el directorio volviera a los inventados, los tres faltan.
    expect(texto).toContain('SELADIS');
    expect(texto).toContain('CENETROP');
    expect(texto).toContain('Plexus');

    await page.screenshot({ path: `${CAPTURAS}/laboratorios-listado.png`, fullPage: true });
  });

  test('la ficha de un centro muestra sus sedes y su catálogo', async ({ page }) => {
    await entrarComoPaciente(page);
    await abrir(page, '/laboratory-directory?kind=LABORATORY');
    await expect(page.getByText('Plexus', { exact: false }).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.getByText('Plexus', { exact: false }).first().click();

    await expect(page).toHaveURL(/\/laboratory-directory\/[0-9a-f-]+/, { timeout: 60_000 });
    // Se espera al **nombre del centro**, no a la URL: el encabezado dice
    // «Unidad diagnóstica» mientras la ficha carga, y leer el texto antes de
    // eso da un vacío que parece un fallo de datos y es una carrera.
    await expect(page.getByRole('heading', { name: /Plexus/i })).toBeVisible({ timeout: 60_000 });

    const texto = await textoDeLaPagina(page);

    // Una prueba de su catálogo publicado, no del value set de la maqueta.
    expect(texto.toLowerCase()).toContain('hemograma');

    await page.screenshot({ path: `${CAPTURAS}/laboratorio-ficha.png`, fullPage: true });
  });
});

test.describe('las farmacias del corpus en su directorio', () => {
  test('aparecen las cadenas que operan en el eje central', async ({ page }) => {
    await entrarComoPaciente(page);
    await abrir(page, '/pharmacies-directory');
    await expect(page.getByText('Farmacorp', { exact: false }).first()).toBeVisible({
      timeout: 60_000,
    });

    const texto = await textoDeLaPagina(page);

    expect(texto).toContain('Farmacorp');

    await page.screenshot({ path: `${CAPTURAS}/farmacias-listado.png`, fullPage: true });
  });
});

test.describe('el buscador público', () => {
  test('encuentra los centros de diagnóstico reales', async ({ page }) => {
    await entrarComoPaciente(page);
    await abrir(page, '/search/diagnostics');
    await expect(page.getByText('SELADIS', { exact: false }).first()).toBeVisible({
      timeout: 60_000,
    });

    await page.screenshot({ path: `${CAPTURAS}/buscador-diagnosticos.png`, fullPage: true });
  });
});

test.describe('en los tres anchos', () => {
  for (const viewport of VIEWPORTS) {
    test(`el directorio de laboratorios se ve entero en ${viewport.nombre}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await entrarComoPaciente(page);
      await abrir(page, '/laboratory-directory?kind=LABORATORY');
      await expect(page.getByText('SELADIS', { exact: false }).first()).toBeVisible({
        timeout: 60_000,
      });

      // Sin barra horizontal: es la regla visual de la casa, y es una medida,
      // no una impresión.
      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(desborde).toBeLessThanOrEqual(1);

      await page.screenshot({
        path: `${CAPTURAS}/laboratorios-${viewport.nombre}.png`,
        fullPage: true,
      });
    });
  }
});

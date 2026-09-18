import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * El atlas anatómico se ve en el glosario.
 *
 * ## Dos cosas que hicieron fallar este spec antes de que fallara el producto
 *
 * **La cuenta.** El glosario está restringido a quien ejerce o administra por
 * una decisión del cliente del 18/08/2026: a una paciente la ruta la manda al
 * panel. Probarlo con la cuenta equivocada da un «no se ve nada» que parece un
 * fallo de datos y es un permiso funcionando.
 *
 * **La portada.** `/glossary` muestra **categorías**, no términos. Escribir en
 * el buscador desde ahí no filtra esa grilla. A los términos se entra por la
 * categoría, que es lo que hace una persona y lo que hace esto.
 *
 * Uso: `yarn pw --workers=1 atlas-anatomico-en-pantalla`
 */

const CAPTURAS = join(process.cwd(), 'artifacts', 'atlas-anatomico');
const ANATOMIA = '/glossary?category=glossary-category-anatomy';

/** Una lámina, por su forma: número y Atlas citado. Ningún término curado la tiene. */
const UNA_LAMINA = /Lámina \d+ del .*Netter/;

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

test.beforeAll(() => {
  mkdirSync(CAPTURAS, { recursive: true });
});

test('el glosario abre para quien ejerce', async ({ page }) => {
  await entrarComoMedica(page);
  await page.goto('/glossary', { waitUntil: 'domcontentloaded', timeout: 120_000 });

  // Si redirigiera al panel, esto falla: es la comprobación de que la pantalla
  // existe antes de mirar qué trae.
  await expect(page).toHaveURL(/\/glossary/, { timeout: 60_000 });
  await expect(page.getByText(/Anatomía/).first()).toBeVisible({ timeout: 60_000 });

  await page.screenshot({ path: `${CAPTURAS}/glosario-portada.png`, fullPage: true });
});

test('la categoría Anatomía trae las láminas del atlas', async ({ page }) => {
  await entrarComoMedica(page);
  await page.goto(ANATOMIA, { waitUntil: 'domcontentloaded', timeout: 120_000 });

  // Se comprueba la forma y no un título concreto: cuál cae primero depende
  // del orden alfabético, y fijar uno rompería la prueba cada vez que entre
  // una lámina nueva.
  await expect(page.getByText(UNA_LAMINA).first()).toBeVisible({ timeout: 60_000 });

  const texto = await page.locator('main').innerText();
  expect(texto).toMatch(/Bloque: /);
  expect(texto).toMatch(/Procedencia del título/);

  await page.screenshot({ path: `${CAPTURAS}/glosario-anatomia.png`, fullPage: true });
});

test('la ficha de una lámina se abre desde la lista', async ({ page }) => {
  await entrarComoMedica(page);
  await page.goto(ANATOMIA, { waitUntil: 'domcontentloaded', timeout: 120_000 });

  // Se llega haciendo clic. La ficha cuelga de `/glossary/:conceptId` —el
  // identificador, no el slug—, así que escribir la URL a mano probaría una
  // que ningún enlace de la aplicación genera.
  // Se pulsa el enlace de la tarjeta y no el párrafo: el enlace cubre la
  // cabecera y se queda con el clic, igual que con el ratón. Se lo localiza
  // por su **destino** y no por su texto, porque su nombre accesible es el
  // título de la lámina, que cambia con cada una.
  await expect(page.getByText(UNA_LAMINA).first()).toBeVisible({ timeout: 60_000 });
  await page.locator('a[href^="/glossary/"]').first().click();

  await expect(page).toHaveURL(/\/glossary\/[0-9a-f-]{36}/, { timeout: 60_000 });

  // Aserciones que **esperan**, no una lectura de texto de una sola vez: leer
  // `innerText` justo después de navegar devolvía la pantalla anterior a medio
  // cambiar, y el fallo parecía de datos cuando era de tiempo.
  await expect(page.getByText(/Lámina \d+ del .*Netter/).first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(/Procedencia del título/).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Bloque: /).first()).toBeVisible({ timeout: 60_000 });

  await page.screenshot({ path: `${CAPTURAS}/lamina-ficha.png`, fullPage: true });
});

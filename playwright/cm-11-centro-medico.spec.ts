/* ============================================================================
    CM-11 · alta de centro médico y configuración de su práctica y sede, en un
    navegador, contra la **maqueta**.

    Cubre lo que `visual-quality-gate` pide para una pantalla nueva: el recorrido
    completo, sin desborde horizontal, a ancho de escritorio y de teléfono. Las
    capturas van a `docs/frontend/evidence/cm-11-medical-center-registration/`.

    Con `--workers=1` y `ng serve` en el puerto de `E2E_BASE_URL`. Datos
    sintéticos: nada real en las capturas.
    ========================================================================== */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { CLAVE } from './support/actores';
import { esperarAplicacionLista } from './support/sesion';

const EVIDENCIA = join('docs', 'frontend', 'evidence', 'cm-11-medical-center-registration');
const VIEWPORTS = [
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'telefono', width: 390, height: 844 },
] as const;

async function sinDesborde(page: Page): Promise<void> {
  const { documento, ventana } = await page.evaluate(() => ({
    documento: document.documentElement.scrollWidth,
    ventana: window.innerWidth,
  }));
  expect(documento, 'el documento no debe desbordar horizontalmente').toBeLessThanOrEqual(ventana);
}

/**
 * Captura la pantalla. Las del portal (con barra lateral y encabezado fijos) se
 * toman de la ventana visible: en página completa el encabezado fijo se
 * superpone al contenido y la imagen no muestra lo que ve la persona.
 */
async function foto(page: Page, nombre: string, completa = true): Promise<void> {
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), fullPage: completa });
}

async function escribir(page: Page, testId: string, texto: string): Promise<void> {
  const campo = page.getByTestId(testId);
  await campo.fill(texto);
  await expect(campo).toHaveValue(texto);
}

/**
 * Entra como administración de la plataforma y elige el Hospital San Lucas, la organización de tipo
 * `HOSPITAL` verificada de la maqueta.
 *
 * No usa `entrar` de `support/sesion`: ese helper espera aterrizar en
 * `/dashboard`, y esta cuenta tiene tres organizaciones y pasa primero por la
 * elección de organización.
 */
async function ingresar(page: Page): Promise<void> {
  await page.goto('/auth', { waitUntil: 'domcontentloaded' });
  await esperarAplicacionLista(page);
  await escribir(page, 'login-identifier', 'superadmin@alovida.mock');
  await escribir(page, 'login-password', CLAVE);
  await page.getByTestId('login-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth') || url.pathname === '/auth/organization', {
    timeout: 60_000,
  });
  // La sesión puede entrar con otra organización activa: se elige el hospital.
  await page.goto('/auth/organization', { waitUntil: 'domcontentloaded' });
  await esperarAplicacionLista(page);
  await page.getByTestId('tenant-opcion').filter({ hasText: 'Hospital San Lucas' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 60_000 });
  await esperarAplicacionLista(page);
}

test.beforeAll(() => mkdirSync(EVIDENCIA, { recursive: true }));

for (const vista of VIEWPORTS) {
  test.describe(`centro médico · ${vista.nombre}`, () => {
    test.use({ viewport: { width: vista.width, height: vista.height } });

    test('la tarjeta «Centro médico» está en el selector de organizaciones', async ({ page }) => {
      await page.goto('/auth/register/organization-type', { waitUntil: 'domcontentloaded' });
      await esperarAplicacionLista(page);
      const tarjeta = page.getByTestId('tipo-centro-medico');
      await expect(tarjeta).toBeVisible();
      await expect(tarjeta).toHaveAttribute('href', '/auth/register/medical-center');
      await sinDesborde(page);
      await foto(page, `${vista.nombre}-01-selector-de-organizacion`);
    });

    test('el alta recorre sus dos páginas y termina pendiente de verificación', async ({ page }) => {
      const errores: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errores.push(m.text());
      });

      await page.goto('/auth/register/medical-center', { waitUntil: 'domcontentloaded' });
      await esperarAplicacionLista(page);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Registre su centro médico' }),
      ).toBeVisible();
      await sinDesborde(page);
      await foto(page, `${vista.nombre}-02-alta-pagina-1-vacia`);

      // Página 1 · el centro. Sin completar, «Siguiente» no avanza.
      await page.getByTestId('paginated-form-continuar').click();
      await expect(page.getByTestId('registro-centro-medico-razon-social')).toBeVisible();
      await foto(page, `${vista.nombre}-03-alta-pagina-1-con-errores`);

      await escribir(page, 'registro-centro-medico-razon-social', `Centro Médico Norte ${Date.now()}`);
      await page
        .getByTestId('registro-centro-medico-tipo-societario')
        .locator('xpath=self::select | .//select')
        .first()
        .selectOption({ index: 1 });
      await sinDesborde(page);
      await foto(page, `${vista.nombre}-04-alta-pagina-1-completa`);
      await page.getByTestId('paginated-form-continuar').click();

      // Página 2 · la cuenta.
      await escribir(page, 'registro-centro-medico-nombre', 'Marta Rojas');
      await escribir(page, 'registro-centro-medico-correo', `marta${Date.now()}@centro-norte.test`);
      await escribir(page, 'registro-centro-medico-clave', 'S3cret-passw0rd');
      await sinDesborde(page);
      await foto(page, `${vista.nombre}-05-alta-pagina-2-completa`);
      await page.getByTestId('paginated-form-continuar').click();

      await expect(page.getByTestId('registro-centro-medico-exito')).toBeVisible();
      await expect(page.getByTestId('registro-centro-medico-pendiente')).toContainText(
        'pendiente de verificación',
      );
      await sinDesborde(page);
      await foto(page, `${vista.nombre}-06-alta-exito-pendiente`);
      expect(errores.filter((e) => !/favicon|tile\.openstreetmap/i.test(e))).toEqual([]);
    });

    test('el hospital verificado configura su práctica y su sede', async ({ page }) => {
      await ingresar(page);
      await page.goto('/administration/medical-center-setup', { waitUntil: 'domcontentloaded' });
      await esperarAplicacionLista(page);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Configurar centro médico' }),
      ).toBeVisible();
      await sinDesborde(page);
      await foto(page, `${vista.nombre}-07-configuracion-pagina-1`, false);

      const nombre = `Centro Médico ${vista.nombre} ${Date.now()}`;
      await escribir(page, 'centro-medico-setup-practice-name', nombre);
      await escribir(page, 'centro-medico-setup-site-name', 'Sede Norte');
      await page.getByTestId('paginated-form-continuar').click();

      await escribir(page, 'centro-medico-setup-address', 'Av. San Martín 123');
      await escribir(page, 'centro-medico-setup-city', 'Santa Cruz de la Sierra');

      // Sin el punto en el mapa no avanza: la sede no se podría ordenar por cercanía.
      await page.getByTestId('paginated-form-continuar').click();
      await expect(page.getByTestId('centro-medico-sede-location-pick')).toBeVisible();
      await sinDesborde(page);
      await foto(page, `${vista.nombre}-08-configuracion-sin-punto`, false);

      await page.getByTestId('centro-medico-sede-location-pick').click();
      const mapa = page.getByTestId('centro-medico-sede-map');
      await expect(mapa).toBeVisible();
      await mapa.click({ position: { x: 120, y: 120 } });
      await page.getByTestId('centro-medico-sede-location-confirm').click();
      await expect(page.getByTestId('centro-medico-sede-location-confirmed')).toBeVisible();
      await sinDesborde(page);
      await foto(page, `${vista.nombre}-09-configuracion-con-punto`, false);

      await page.getByTestId('paginated-form-continuar').click();
      await expect(page.getByTestId('centro-medico-setup-exito')).toBeVisible();
      await expect(page.getByTestId('centro-medico-setup-site-id')).not.toBeEmpty();
      await sinDesborde(page);
      await foto(page, `${vista.nombre}-10-configuracion-guardada`, false);
    });
  });
}

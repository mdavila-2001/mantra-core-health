/* ============================================================================
    CM-11 · alta de organización médica y configuración de su práctica y sede,
    en un navegador, contra la **maqueta**. Contra la API real, con el tipo de
    institución por caso: `cm-11-organizacion-medica-api-real.spec.ts`.

    Cubre lo que `visual-quality-gate` pide para una pantalla nueva: el recorrido
    completo, sin desborde horizontal, a ancho de escritorio y de teléfono. Las
    capturas van a `docs/frontend/evidence/cm-11-medical-center-registration/`.

    Con `--workers=1` y `ng serve` en el puerto de `E2E_BASE_URL`. Datos
    sintéticos: nada real en las capturas.
    ========================================================================== */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { pdfDePrueba } from './helpers/documentos-legales';
import { CLAVE } from './support/actores';
import { esperarAplicacionLista } from './support/sesion';

const EVIDENCIA = join('docs', 'frontend', 'evidence', 'cm-11-medical-center-registration');
/** Las claves de los cinco documentos legales del alta, en el orden de su página. */
const CLAVES_DE_DOCUMENTOS = [
  'constitutionFileId',
  'taxIdentifierFileId',
  'commerceRegistryFileId',
  'operatingLicenseFileId',
  'healthAuthorityCertificateFileId',
] as const;

const VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'phone', width: 390, height: 844 },
] as const;

async function noHorizontalOverflow(page: Page): Promise<void> {
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
  // Sin captura a mitad de una animación: se espera a que terminen las finitas
  // que están corriendo (una pausada no termina nunca), con un techo de 5 s.
  await page.evaluate(async () => {
    const corriendo = document.getAnimations().filter((animacion) => {
      const iteraciones = animacion.effect?.getComputedTiming().iterations ?? 1;
      return Number.isFinite(iteraciones) && animacion.playState === 'running';
    });
    await Promise.race([
      Promise.all(corriendo.map((animacion) => animacion.finished.catch(() => undefined))),
      new Promise((listo) => setTimeout(listo, 5_000)),
    ]);
  });
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), fullPage: completa, animations: 'disabled' });
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

for (const view of VIEWPORTS) {
  test.describe(`centro médico · ${view.label}`, () => {
    test.use({ viewport: { width: view.width, height: view.height } });

    test('la tarjeta «Organización médica» está en el selector de cuentas', async ({ page }) => {
      await page.goto('/auth/register', { waitUntil: 'domcontentloaded' });
      await esperarAplicacionLista(page);
      const tarjeta = page.getByTestId('account-type-medical-center');
      await expect(tarjeta).toBeVisible();
      await expect(tarjeta).toHaveAttribute('href', '/auth/register/medical-center');
      await expect(tarjeta).toContainText('Organización médica');
      await noHorizontalOverflow(page);
      await foto(page, `${view.label}-01-organization-type-selector`);
    });

    test('el alta recorre sus páginas —empresa, SEDES, director, papeles, mapa, representante y gerencias— y termina pendiente de verificación', async ({ page }) => {
      const errores: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errores.push(m.text());
      });

      await page.goto('/auth/register/medical-center', { waitUntil: 'domcontentloaded' });
      await esperarAplicacionLista(page);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Registre su organización médica' }),
      ).toBeVisible();
      await noHorizontalOverflow(page);
      await foto(page, `${view.label}-02-signup-page-1-empty`);

      // Página 1 · la organización. Sin completar, «Siguiente» no avanza.
      await page.getByTestId('paginated-form-continuar').click();
      await expect(page.getByTestId('medical-center-signup-legal-name')).toBeVisible();
      await foto(page, `${view.label}-03-signup-page-1-errors`);

      await expect(page.getByText('Elija el tipo de institución.')).toBeVisible();

      // El tipo de institución es un `app-select`, como el tipo societario.
      const tipo = page.getByTestId('medical-center-signup-tenant-type').getByRole('combobox');
      await tipo.click();
      await page.locator('dialog.select-dialog[open]').getByRole('option', { name: 'Clínica', exact: true }).click();
      await expect(tipo).toContainText('Clínica');
      await escribir(page, 'medical-center-signup-legal-name', `Clínica Norte ${Date.now()}`);
      // `app-select` es un combobox propio que abre un `<dialog>`, no un `<select>` nativo.
      await page.getByTestId('medical-center-signup-legal-entity-type').getByRole('combobox').click();
      await page.locator('dialog.select-dialog[open]').getByRole('option').nth(1).click();
      // Un NIT que no es un NIT frena y lo dice.
      await escribir(page, 'medical-center-signup-tax-id', 'abc');
      await page.getByTestId('paginated-form-continuar').click();
      await expect(page.getByText('Escriba el NIT: sólo números')).toBeVisible();
      await escribir(page, 'medical-center-signup-tax-id', '1023456789');
      await noHorizontalOverflow(page);
      await foto(page, `${view.label}-04-signup-page-1-filled`);
      await page.getByTestId('paginated-form-continuar').click();

      // Página 2 · el número de registro del SEDES.
      await escribir(page, 'medical-center-signup-health-registration', 'SEDES SC');
      await page.getByTestId('paginated-form-continuar').click();
      await expect(page.getByText('Escriba el número de registro del SEDES')).toBeVisible();
      await escribir(page, 'medical-center-signup-health-registration', 'SEDES-SC-2020-0412');
      await noHorizontalOverflow(page);
      await foto(page, `${view.label}-04a-signup-health-registration`);
      await page.getByTestId('paginated-form-continuar').click();

      // Página 3 · el director médico, con su matrícula.
      await page.getByTestId('paginated-form-continuar').click();
      await expect(page.getByText('Escriba la matrícula profesional del director')).toBeVisible();
      await escribir(page, 'medical-center-signup-director-nombre', 'Ana');
      await escribir(page, 'medical-center-signup-director-apellido-paterno', 'Rojas');
      await escribir(page, 'medical-center-signup-director-license', 'MAT-12345');
      await escribir(page, 'medical-center-signup-director-email', 'dir@clinica-norte.test');
      await noHorizontalOverflow(page);
      await foto(page, `${view.label}-04b-signup-director`);
      await page.getByTestId('paginated-form-continuar').click();

      // Página 4 · los cinco papeles legales, en PDF y obligatorios, en una sola vista.
      await page.getByTestId('paginated-form-continuar').click();
      await expect(page.getByText('Este documento es obligatorio para continuar').first()).toBeVisible();
      await foto(page, `${view.label}-04c-signup-documents-errors`);
      for (const clave of CLAVES_DE_DOCUMENTOS) {
        const testId = `medical-center-signup-doc-${clave}`;
        await page.getByTestId(testId).setInputFiles(pdfDePrueba(clave));
        await expect(page.getByTestId(`${testId}-quitar`)).toBeVisible({ timeout: 15_000 });
      }
      await noHorizontalOverflow(page);
      await foto(page, `${view.label}-04d-signup-documents-uploaded`);
      await page.getByTestId('paginated-form-continuar').click();

      // Página 5 · la casa central en el mapa (obligatoria).
      await page.getByTestId('paginated-form-continuar').click();
      await expect(page.getByText('Marque el lugar en el mapa').first()).toBeVisible();
      await page.getByTestId('medical-center-signup-central-map').click({ position: { x: 120, y: 120 } });
      await page.getByTestId('medical-center-signup-central-location-confirm').click();
      await expect(page.getByTestId('medical-center-signup-central-location-confirmed')).toBeAttached();
      await noHorizontalOverflow(page);
      await foto(page, `${view.label}-04e-signup-central`);
      await page.getByTestId('paginated-form-continuar').click();

      // Página 6 · las sucursales son opcionales: se sigue sin ninguna.
      await expect(page.getByTestId('medical-center-signup-agregar-sucursal')).toBeVisible();
      await page.getByTestId('paginated-form-continuar').click();

      // Página 7 · el representante legal (también es el dueño de la cuenta).
      await escribir(page, 'medical-center-signup-legal-rep-nombre', 'Marta');
      await escribir(page, 'medical-center-signup-legal-rep-apellido-paterno', 'Rojas');
      await escribir(page, 'medical-center-signup-legal-rep-id', '4872190');
      await escribir(page, 'medical-center-signup-legal-rep-email', `marta${Date.now()}@centro-norte.test`);
      await noHorizontalOverflow(page);
      await foto(page, `${view.label}-05-signup-legal-rep`);
      await page.getByTestId('paginated-form-continuar').click();

      // Página 8 · el poder: obligatorio para una S.R.L.
      await page.getByTestId('paginated-form-continuar').click();
      await expect(page.getByText('Este documento es obligatorio para continuar').first()).toBeVisible();
      const poder = 'medical-center-signup-doc-powerOfAttorneyFileId';
      await page.getByTestId(poder).setInputFiles(pdfDePrueba('poder'));
      await expect(page.getByTestId(`${poder}-quitar`)).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('paginated-form-continuar').click();

      // Páginas 9 a 11 · las tres gerencias son opcionales: se siguen vacías.
      for (let i = 0; i < 3; i += 1) await page.getByTestId('paginated-form-continuar').click();

      // Página 12 · la clave. «Crear cuenta» envía.
      await escribir(page, 'medical-center-signup-password', 'S3cret-passw0rd');
      await noHorizontalOverflow(page);
      await foto(page, `${view.label}-05b-signup-password`);
      await page.getByTestId('paginated-form-continuar').click();

      await expect(page.getByTestId('medical-center-signup-success')).toBeVisible();
      await expect(page.getByTestId('medical-center-signup-pending')).toContainText(
        'pendiente de verificación',
      );
      await noHorizontalOverflow(page);
      await foto(page, `${view.label}-06-signup-success-pending`);
      expect(errores.filter((e) => !/favicon|tile\.openstreetmap/i.test(e))).toEqual([]);
    });

    test('el hospital verificado configura su práctica y su sede', async ({ page }) => {
      await ingresar(page);
      await page.goto('/administration/medical-center-setup', { waitUntil: 'domcontentloaded' });
      await esperarAplicacionLista(page);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Configurar práctica' }),
      ).toBeVisible();
      // El hospital de la maqueta está verificado: se ofrece el formulario, no el S3.
      await expect(page.getByTestId('medical-center-setup-form')).toBeVisible();
      await expect(page.getByTestId('medical-center-setup-unverified')).toHaveCount(0);
      await noHorizontalOverflow(page);
      await foto(page, `${view.label}-07-setup-page-1`, false);

      const centerName = `Centro Médico ${view.label} ${Date.now()}`;
      await escribir(page, 'medical-center-setup-practice-name', centerName);
      await escribir(page, 'medical-center-setup-site-name', 'Sede Norte');
      await page.getByTestId('paginated-form-continuar').click();

      await escribir(page, 'medical-center-setup-address', 'Av. San Martín 123');
      await escribir(page, 'medical-center-setup-city', 'Santa Cruz de la Sierra');

      // Sin el punto en el mapa no avanza: la sede no se podría ordenar por cercanía.
      await page.getByTestId('paginated-form-continuar').click();
      await expect(page.getByTestId('medical-center-site-location-pick')).toBeVisible();
      await noHorizontalOverflow(page);
      await foto(page, `${view.label}-08-setup-without-point`, false);

      await page.getByTestId('medical-center-site-location-pick').click();
      const mapa = page.getByTestId('medical-center-site-map');
      await expect(mapa).toBeVisible();
      await mapa.click({ position: { x: 120, y: 120 } });
      await page.getByTestId('medical-center-site-location-confirm').click();
      await expect(page.getByTestId('medical-center-site-location-confirmed')).toBeVisible();
      await noHorizontalOverflow(page);
      await foto(page, `${view.label}-09-setup-with-point`, false);

      await page.getByTestId('paginated-form-continuar').click();
      await expect(page.getByTestId('medical-center-setup-exito')).toBeVisible();
      await expect(page.getByTestId('medical-center-setup-site-id')).not.toBeEmpty();
      await noHorizontalOverflow(page);
      await foto(page, `${view.label}-10-setup-saved`, false);
    });
  });
}

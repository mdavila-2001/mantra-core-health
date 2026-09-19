import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { entrarAlSimulador } from './support/simulador';

/**
 * Portabilidad de póliza e historial de siniestralidad a 1 clic (subtarea
 * 3.3) — sólo la maqueta (`mockBackend: true`, lo que sirve `yarn start` por
 * defecto). La pierna contra Neon queda fuera de este archivo: aplicar los
 * patches v4.2.11→v4.2.19 y correr el seeder con `--emit-credentials` es un
 * paso de despliegue explícito, no algo que un `test.describe` deba disparar
 * solo.
 */

test.describe.configure({ mode: 'serial' });

const SHA256_HEX = /^[0-9a-f]{64}$/;

const TITULO_DEL_DIALOGO = 'Exportar mi historial de póliza y siniestralidad';

/**
 * El diálogo se localiza por su **rol**, no por el `data-testid`.
 *
 * `data-testid="portability-export-dialog"` cuelga del host
 * `<app-content-dialog>`, y el `<dialog>` que ese componente abre va
 * `position: fixed`: el host queda sin caja y Playwright lo reporta `hidden`
 * aunque el diálogo esté perfectamente a la vista.
 */
function dialogo(page: Page) {
  return page.getByRole('dialog', { name: TITULO_DEL_DIALOGO });
}

async function screenshotWithoutOverflow(page: Page, info: TestInfo, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}

/** El ruido de CSP que `ng serve` inyecta en cualquier ruta (recarga en vivo). */
function esRuidoDelServidorDeDesarrollo(texto: string): boolean {
  return texto.includes('Content Security Policy') && texto.includes('inline script');
}

async function abrirDialogo(page: Page): Promise<void> {
  await entrarAlSimulador(page, 'paciente', '');
  await page.goto('/my-account');
  await page.getByRole('tab', { name: 'Seguros y tutores' }).click();

  const tarjeta = page.getByTestId('insurance-portability-card');
  await expect(tarjeta).toBeVisible();

  await page.getByTestId('btn-open-portability-dialog').click();
  await expect(dialogo(page)).toBeVisible();
  await expect(page.getByTestId('content-dialog-title')).toContainText(TITULO_DEL_DIALOGO);
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`portabilidad de póliza (maqueta) ${viewport.width}`, () => {
    test.use({ viewport });

    test('exporta el PDF, muestra el sello y lo verifica públicamente', async ({ page }, info) => {
      const erroresDeConsola: string[] = [];
      page.on('console', (mensaje) => {
        if (mensaje.type() === 'error') erroresDeConsola.push(mensaje.text());
      });
      page.on('pageerror', (error) => erroresDeConsola.push(String(error)));

      await abrirDialogo(page);

      // PDF ya viene preseleccionado — el radio group nace en 'PDF'.
      const radioPdf = page.getByTestId('radio-format-pdf');
      await expect(radioPdf.locator('input[type="radio"]')).toBeChecked();

      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(desborde, `desborde con el diálogo abierto (${viewport.width})`).toBeLessThanOrEqual(1);

      // Objetivos táctiles de los radios: **antes** de generar. Emitido el
      // certificado, el `@switch` del diálogo reemplaza el selector de formato
      // por el sello y las descargas, así que después de este punto los radios
      // ya no existen en el DOM.
      //
      // El umbral es el que el sistema de diseño promete PARA ESE ANCHO, no un
      // 44 universal: tanto el radio (`molecules/radio/radio.css:56-58`) como
      // el botón `md` (`atoms/button/button.css:128-146`) declaran 44 px en
      // móvil y **bajan a 40 px desde 780 px a propósito** —«cada talle
      // recupera su geometría del spec», dice el propio CSS—. Medido en 1440:
      // 39,99 px el radio, 40 px el botón. Los 40 siguen muy por encima del
      // mínimo de WCAG 2.2 AA (24 px, SC 2.5.8); los 44 son el nivel AAA.
      const altoMinimoTactil = viewport.width >= 780 ? 40 : 44;
      const objetivos = [
        ['radio-format-pdf', page.getByTestId('radio-format-pdf').locator('label')],
        ['radio-format-json', page.getByTestId('radio-format-json').locator('label')],
        ['radio-format-both', page.getByTestId('radio-format-both').locator('label')],
        ['btn-cancel-portability-dialog', page.getByTestId('btn-cancel-portability-dialog')],
        ['btn-generate-portability-download', page.getByTestId('btn-generate-portability-download')],
      ] as const;
      for (const [nombre, objetivo] of objetivos) {
        const caja = await objetivo.boundingBox();
        expect(Math.round(caja!.height), `alto de ${nombre}`).toBeGreaterThanOrEqual(
          altoMinimoTactil,
        );
      }

      const [descarga] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('btn-generate-portability-download').click(),
      ]);
      expect(descarga.suggestedFilename()).toMatch(/^portabilidad-.+\.pdf$/);
      const rutaPdf = info.outputPath(`portabilidad-${viewport.width}.pdf`);
      await descarga.saveAs(rutaPdf);
      expect(readFileSync(rutaPdf).subarray(0, 5).toString('latin1')).toBe('%PDF-');

      const hash = page.getByTestId('portability-manifest-hash');
      await expect(hash).toBeVisible();
      const manifestHash = (await hash.textContent())?.trim() ?? '';
      expect(manifestHash).toMatch(SHA256_HEX);

      await screenshotWithoutOverflow(page, info, `portabilidad-lista-${viewport.width}`);

      await page.keyboard.press('Escape');
      await expect(dialogo(page)).toHaveCount(0);

      const propios = erroresDeConsola.filter((error) => !esRuidoDelServidorDeDesarrollo(error));
      expect(propios, `errores de consola en ${viewport.width}`).toEqual([]);

      // El QR del PDF apunta acá: la verificación pública, sin sesión.
      await page.goto(`/verify/portability/${manifestHash}`);
      await expect(page.getByTestId('portability-verify-valid')).toBeVisible();
      await expect(page.getByTestId('portability-verify-hash')).toHaveText(manifestHash);

      await page.goto('/verify/portability/no-tiene-forma-de-sha256');
      await expect(page.getByTestId('portability-verify-invalid')).toBeVisible();
    });

    test('elegir JSON descarga un archivo cuyo SHA-256 coincide con el sello mostrado', async ({
      page,
    }, info) => {
      await abrirDialogo(page);

      await page.getByTestId('radio-format-json').locator('label').click();
      await expect(page.getByTestId('radio-format-json').locator('input[type="radio"]')).toBeChecked();

      const [descarga] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('btn-generate-portability-download').click(),
      ]);
      expect(descarga.suggestedFilename()).toMatch(/^portabilidad-.+\.json$/);
      const rutaJson = info.outputPath(`portabilidad-${viewport.width}.json`);
      await descarga.saveAs(rutaJson);

      const manifestHash = (await page.getByTestId('portability-manifest-hash').textContent())?.trim();
      const hashReal = createHash('sha256').update(readFileSync(rutaJson)).digest('hex');
      expect(hashReal).toBe(manifestHash);
    });
  });
}

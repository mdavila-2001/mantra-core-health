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

const TITULO_DEL_DIALOGO = 'Exportar certificado de portabilidad';

/** Bien formado —64 hex— pero de ningún certificado emitido: la maqueta responde 404. */
const HASH_INEXISTENTE = 'f'.repeat(64);

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

      // PDF ya viene preseleccionado. Desde C-21 (ADR-0013) los tres formatos
      // son un desplegable y no tres radios, así que la preselección se lee en
      // la opción marcada y por su TEXTO: `app-select` guarda el índice de la
      // opción en el `value` del `<option>`, y afirmar sobre ese número no
      // diría nada de lo que el médico ve.
      const selectorDeFormato = page.getByTestId('portability-format').locator('select');
      await expect(selectorDeFormato.locator('option:checked')).toHaveText(
        'PDF oficial certificado con código QR',
      );

      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(desborde, `desborde con el diálogo abierto (${viewport.width})`).toBeLessThanOrEqual(1);

      // Objetivo táctil del selector de formato: **antes** de generar. Emitido
      // el certificado, el `@switch` del diálogo lo reemplaza por el sello y
      // las descargas, así que después de este punto ya no existe en el DOM.
      //
      // El umbral es el que el sistema de diseño promete PARA ESE ANCHO, no un
      // 44 universal: tanto el select (`atoms/select/select.css:15` y `:26-28`)
      // como el botón `md` (`atoms/button/button.css:128-146`) declaran 44 px
      // en móvil y **bajan a 40 px desde 780 px a propósito** —«cada talle
      // recupera su geometría del spec», dice el propio CSS—. Los 40 siguen muy
      // por encima del mínimo de WCAG 2.2 AA (24 px, SC 2.5.8); los 44 son el
      // nivel AAA.
      const altoMinimoTactil = viewport.width >= 780 ? 40 : 44;
      const objetivos = [
        ['portability-format', selectorDeFormato],
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
      // Quién lo selló y cuántos registros trae: es lo que el requisito pide
      // que vea quien escanea, y sale de la respuesta, no de un rótulo fijo.
      await expect(page.getByTestId('portability-verify-issuer')).not.toBeEmpty();
      await expect(page.getByTestId('portability-verify-record-count')).not.toBeEmpty();

      // El mismo sello en MAYÚSCULAS es el mismo certificado.
      await page.goto(`/verify/portability/${manifestHash.toUpperCase()}`);
      await expect(page.getByTestId('portability-verify-valid')).toBeVisible();

      // Bien formado pero de ningún certificado: «no encontrado», que es
      // distinto de «el sello está mal escrito».
      await page.goto(`/verify/portability/${HASH_INEXISTENTE}`);
      await expect(page.getByTestId('portability-verify-not-found')).toBeVisible();
      await expect(page.getByTestId('portability-verify-valid')).toHaveCount(0);

      await page.goto('/verify/portability/no-tiene-forma-de-sha256');
      await expect(page.getByTestId('portability-verify-invalid')).toBeVisible();
    });

    test('la verificación pública funciona sin sesión y distingue sus tres estados', async ({
      browser,
    }) => {
      // Contexto limpio: ni cookies ni almacenamiento. Quien escanea el QR es
      // una aseguradora o un auditor, no alguien con sesión en AloVida — si la
      // ruta cayera tras un guard, acá se vería como una redirección a /auth.
      const contexto = await browser.newContext({ viewport });
      const anonima = await contexto.newPage();
      try {
        await anonima.goto(`/verify/portability/${HASH_INEXISTENTE}`);
        await expect(anonima.getByTestId('portability-verify-not-found')).toBeVisible();
        expect(anonima.url()).toContain('/verify/portability/');

        await anonima.goto('/verify/portability/no-tiene-forma-de-sha256');
        await expect(anonima.getByTestId('portability-verify-invalid')).toBeVisible();

        // Y no desborda en este ancho: se abre desde el teléfono, escaneando.
        const desborde = await anonima.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(desborde, `desborde de la verificación (${viewport.width})`).toBeLessThanOrEqual(1);
      } finally {
        await contexto.close();
      }
    });

    test('el diálogo se abre y se cierra con el teclado, y el foco vuelve al botón', async ({
      page,
    }) => {
      await entrarAlSimulador(page, 'paciente', '');
      await page.goto('/my-account');
      await page.getByRole('tab', { name: 'Seguros y tutores' }).click();

      const abrir = page.getByTestId('btn-open-portability-dialog');
      await expect(abrir).toBeVisible();

      // El nombre accesible del botón es el título del diálogo que abre
      // (WCAG 2.5.3: la etiqueta visible está en el nombre accesible).
      await expect(abrir).toHaveAccessibleName(TITULO_DEL_DIALOGO);

      // El foco tiene que LLEGAR POR TECLADO para que `:focus-visible` aplique:
      // con `.focus()` a secas Chromium puede no pintar el anillo, que es
      // justamente lo que se quiere comprobar. Salir y volver con Tab es una
      // navegación de teclado de verdad, sin depender de cuántos pasos hay
      // desde el principio de la página.
      //
      // Y se mide sobre el estilo calculado del elemento, no con
      // `getComputedStyle(el, ':focus-visible')`: el segundo argumento es para
      // pseudo-ELEMENTOS (`::before`), y con una pseudo-clase devuelve el
      // estilo base — `outline-width` sale vacío y `parseFloat` da NaN.
      await abrir.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(abrir).toBeFocused();

      const anillo = await abrir.evaluate((el) => {
        const estilo = getComputedStyle(el);
        return { ancho: estilo.outlineWidth, estilo: estilo.outlineStyle };
      });
      // La regla global de `styles.css` es `outline: 4px solid var(--focus-ring)`.
      expect(anillo.estilo, 'estilo del anillo de foco').not.toBe('none');
      expect(parseFloat(anillo.ancho), 'ancho del anillo de foco').toBeGreaterThan(0);

      await page.keyboard.press('Enter');
      await expect(dialogo(page)).toBeVisible();

      // El foco entra al diálogo: si se quedara afuera, quien navega con
      // teclado seguiría tabulando por la página de atrás.
      const focoDentro = await page.evaluate(() => {
        const dialogo = document.querySelector('dialog[open]');
        return dialogo !== null && dialogo.contains(document.activeElement);
      });
      expect(focoDentro, 'el foco entra al diálogo').toBe(true);

      await page.keyboard.press('Escape');
      await expect(dialogo(page)).toHaveCount(0);
      await expect(abrir).toBeFocused();
    });

    test('elegir JSON descarga un archivo cuyo SHA-256 coincide con el sello mostrado', async ({
      page,
    }, info) => {
      await abrirDialogo(page);

      const selectorDeFormato = page.getByTestId('portability-format').locator('select');
      await selectorDeFormato.selectOption({ label: 'Archivo JSON interoperable' });
      await expect(selectorDeFormato.locator('option:checked')).toHaveText(
        'Archivo JSON interoperable',
      );

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

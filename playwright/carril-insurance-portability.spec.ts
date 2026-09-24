import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { expect, test, type Download, type Page, type TestInfo } from '@playwright/test';

import { entrarAlSimulador } from './support/simulador';

/**
 * Dispara una acción y junta TODAS las descargas que produzca, hasta llegar
 * a `cantidad` o vencer el plazo.
 *
 * `Promise.all([page.waitForEvent('download'), page.waitForEvent('download'),
 * accion()])` es frágil cuando BUNDLE dispara dos descargas casi
 * simultáneas: los dos `waitForEvent` compiten por el mismo primer evento en
 * vez de quedarse, cada uno, con una de las dos. Escuchar con `page.on` y
 * juntar en un array no tiene esa carrera.
 */
async function esperarDescargas(
  page: Page,
  cantidad: number,
  accion: () => Promise<void>,
): Promise<Download[]> {
  const descargas: Download[] = [];
  const escuchar = (descarga: Download) => descargas.push(descarga);
  page.on('download', escuchar);
  try {
    await accion();
    await expect.poll(() => descargas.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(cantidad);
  } finally {
    page.off('download', escuchar);
  }
  return descargas;
}

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

const TITULO_DEL_DIALOGO = 'Solicitar exportación de portabilidad';

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

/**
 * Completa el alta de un dependiente, mismo patrón que `b1-dependientes.spec.ts`.
 *
 * El selector de fecha se maneja tecla por tecla (el campo está enmascarado y
 * `fill()` no pasa por su manejador), y el desplegable de parentesco se elige
 * por ETIQUETA — `app-select` guarda el índice en el `value` del `<option>`.
 */
async function registrarDependiente(page: Page, nombre: string): Promise<void> {
  await page.getByTestId('dependents-nuevo').click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByTestId('dependent-name').fill(nombre);
  await page.getByTestId('dependent-last-name').fill('Quispe');

  const fecha = page.getByTestId('dependent-birth-date').getByRole('textbox');
  await fecha.click();
  await fecha.press('Home');
  await fecha.pressSequentially('14032018');
  await fecha.blur();
  await expect(fecha).toHaveValue('14/03/2018');

  await page
    .getByTestId('dependent-relationship')
    .getByRole('combobox')
    .selectOption({ label: 'Soy su madre' });

  await page.getByTestId('dependent-submit').click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15_000 });
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

      // El paquete completo viene preseleccionado (CA-01: confirmar sin tocar
      // el desplegable baja los dos archivos). Desde C-21 (ADR-0013) los tres
      // formatos son un desplegable y no tres radios, así que la preselección
      // se lee en la opción marcada y por su TEXTO: `app-select` guarda el
      // índice de la opción en el `value` del `<option>`, y afirmar sobre ese
      // número no diría nada de lo que el paciente ve.
      const selectorDeFormato = page.getByTestId('portability-format').locator('select');
      await expect(selectorDeFormato.locator('option:checked')).toHaveText(
        'Paquete completo (PDF + JSON)',
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

      // BUNDLE por defecto: confirmar UNA vez dispara DOS descargas (CA-01).
      const descargas = await esperarDescargas(page, 2, async () => {
        await page.getByTestId('btn-generate-portability-download').click();
      });
      const descargaPdf = descargas.find((d) => d.suggestedFilename().endsWith('.pdf'))!;
      const descargaJson = descargas.find((d) => d.suggestedFilename().endsWith('.json'))!;
      expect(descargaPdf.suggestedFilename()).toMatch(/^portabilidad-.+\.pdf$/);
      expect(descargaJson.suggestedFilename()).toMatch(/^portabilidad-.+\.json$/);
      const rutaPdf = info.outputPath(`portabilidad-${viewport.width}.pdf`);
      await descargaPdf.saveAs(rutaPdf);
      expect(readFileSync(rutaPdf).subarray(0, 5).toString('latin1')).toBe('%PDF-');
      const rutaJsonBundle = info.outputPath(`portabilidad-bundle-${viewport.width}.json`);
      await descargaJson.saveAs(rutaJsonBundle);
      const certificadoBundle = JSON.parse(readFileSync(rutaJsonBundle, 'utf8')) as {
        readonly schemaVersion: string;
        readonly encounters: readonly unknown[];
      };
      expect(certificadoBundle.schemaVersion).toBe('alovida.insurance-portability/2');
      expect(certificadoBundle.encounters.length).toBeGreaterThan(0);

      const hash = page.getByTestId('portability-manifest-hash');
      await expect(hash).toBeVisible();
      const manifestHash = (await hash.textContent())?.trim() ?? '';
      expect(manifestHash).toMatch(SHA256_HEX);

      // Objetivos táctiles del estado `ready`: "Copiar hash" perdió su
      // `size="sm"` (32 px) justamente para cumplir este mismo umbral.
      const objetivosListos = [
        ['btn-copy-portability-hash', page.getByTestId('btn-copy-portability-hash')],
        ['btn-download-portability-pdf', page.getByTestId('btn-download-portability-pdf')],
        ['btn-download-portability-json', page.getByTestId('btn-download-portability-json')],
        ['btn-redownload-portability', page.getByTestId('btn-redownload-portability')],
      ] as const;
      for (const [nombre, objetivo] of objetivosListos) {
        const caja = await objetivo.boundingBox();
        expect(Math.round(caja!.height), `alto de ${nombre}`).toBeGreaterThanOrEqual(
          altoMinimoTactil,
        );
      }

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

    test('actuando por un dependiente, exporta el historial del TITULAR y avisa que es un trámite personal', async ({
      page,
    }, info) => {
      await entrarAlSimulador(page, 'paciente', '');
      await page.goto('/my-account/dependents');
      const nombreDependiente = `Valentina-${viewport.width}`;
      await registrarDependiente(page, nombreDependiente);

      // El alta y la elección de a quién representar viven EN MEMORIA
      // (`PatientContextService`, sin persistencia): un `page.goto` recarga
      // el documento entero y las pierde — y de paso pierde al dependiente
      // mismo, porque `pacientes` (la colección que respalda el alta) tampoco
      // persiste entre recargas. Por eso la navegación a `/my-account` es
      // por el enlace lateral «Mi perfil» (`routerLink`, sin recarga), no
      // por `page.goto`.
      const enlacePerfil = page.getByTestId('nav-enlace').filter({ hasText: 'Mi perfil' });
      // En angosto el menú es un cajón cerrado por defecto: el enlace existe
      // en el DOM pero está fuera de la vista hasta abrirlo con el botón de
      // hamburguesa (`header-menu`), que sólo se renderiza en ese modo.
      const botonMenu = page.getByTestId('header-menu');
      if (await botonMenu.isVisible()) await botonMenu.click();
      await enlacePerfil.click();
      await page.waitForURL((url) => url.pathname === '/my-account');

      await page.getByRole('tab', { name: 'Seguros y tutores' }).click();

      const tarjeta = page.getByTestId('insurance-portability-card');
      await expect(tarjeta).toBeVisible();
      await expect(tarjeta).toContainText('trámite personal');

      await page.getByTestId('btn-open-portability-dialog').click();
      await expect(dialogo(page)).toBeVisible();

      const descargas = await esperarDescargas(page, 2, async () => {
        await page.getByTestId('btn-generate-portability-download').click();
      });
      const descargaJson = descargas.find((d) => d.suggestedFilename().endsWith('.json'))!;
      const rutaJson = info.outputPath(`portabilidad-dependiente-${viewport.width}.json`);
      await descargaJson.saveAs(rutaJson);
      const certificado = JSON.parse(readFileSync(rutaJson, 'utf8')) as {
        readonly patient: { readonly fullName: string };
      };
      // El certificado NUNCA lleva el nombre del dependiente recién creado:
      // el `patientProfileId` que viajó al backend fue siempre el del titular.
      expect(certificado.patient.fullName).not.toContain('Valentina');

      await expect(page.getByTestId('portability-manifest-hash')).toBeVisible();
      await screenshotWithoutOverflow(page, info, `portabilidad-dependiente-${viewport.width}`);
    });

    // NO HAY test E2E de «titular sin coberturas» en este archivo — BLOCKED,
    // no omitido por descuido. Se intentaron las dos vías reales:
    // (1) Ningún usuario de `mock-session.ts` (los únicos que pueden iniciar
    //     sesión: `buscarUsuario` sólo resuelve esa lista corta) carece de
    //     coberturas. El fixture sin aseguradora existe (`PACIENTES[1]`,
    //     "p-mamani"), pero no tiene credencial de ingreso propia, y
    //     portabilidad SIEMPRE exporta al titular de la SESIÓN
    //     (`auth.patientProfileId()`), nunca a un id elegido a mano — no hay
    //     forma de "impersonar" ese fixture desde la UI.
    // (2) Aislar la respuesta en el borde HTTP con `page.route()` (regla 65)
    //     NO es viable: `mockBackendInterceptor` (`core/mock/mock-backend.
    //     interceptor.ts`) es un `HttpInterceptorFn` que responde con
    //     `of(...)`/`throwError(...)` y NUNCA llama a `next(request)` para
    //     una ruta reconocida — no sale ningún XHR/`fetch` real al proceso
    //     del navegador, así que no hay conexión de red que Playwright pueda
    //     interceptar. `page.route()` y `page.waitForResponse()` esperan
    //     para siempre un evento que no va a ocurrir (comprobado: el intento
    //     agotó el timeout de 180 s del test).
    // El caso SÍ está verificado, en las capas donde es alcanzable:
    // `insurance-portability.service.spec.ts` (AC-02, sin lanzar) ·
    // `insurance-portability.handlers.spec.ts` (el mismo caso contra el
    // router simulado real, con `PACIENTE_SIN_COBERTURAS`) ·
    // `insurance-portability-card.spec.ts` ("sin coberturas declaradas…
    // ofrece exportar igual"). Cerrar el E2E exige un seam de prueba nuevo
    // (por ejemplo, un endpoint o flag de la maqueta que permita loguearse
    // como cualquier `PacienteSimulado` por id) — trabajo de otro carril,
    // no una corrección de este archivo.
  });
}

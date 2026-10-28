import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * Correcciones del médico, tanda C1-b (28/10/2026): el logo del consultorio.
 *
 * 1. Un médico nuevo carga el logo de su consultorio en el alta, en la página
 *    «Su consultorio propio». Un PDF o una imagen de más de 2 MB se rechazan en
 *    el mismo campo, sin elegir nada; una imagen válida se ve en la misma caja
 *    2:1 del perfil y del membrete, y el alta se completa con ella.
 * 2. Un médico existente lo cambia desde «Editar» y su perfil muestra el nuevo.
 * 3. El paciente no tiene ese bloque en su perfil: el logo es del consultorio.
 *
 * Contra el simulador (cuentas `medica@` y `paciente@alovida.mock`). El
 * simulador no abre sesión para una cuenta creada durante la corrida, así que el
 * perfil del médico recién registrado no se puede abrir acá: que el alta lleve
 * `ownSite.logoFileId` y que el perfil lea el logo de la sede propia lo fijan
 * las pruebas unitarias del alta y de `PracticeLogoClient`, y el perfil con logo
 * se ve en (2), que lee el mismo campo de la misma sede.
 *
 * A 1280 y 360, en claro y oscuro. Las capturas quedan en
 * `docs/frontend/evidence/correcciones-medico-c1b/`, sin `fullPage`: cada una
 * con el viewport del ancho que mide y después de que terminen las animaciones
 * con fin.
 */

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const EVIDENCE_DIR = join('docs', 'frontend', 'evidence', 'correcciones-medico-c1b');

/** La clave que lee la aplicación al arrancar (`theme.service.ts`). */
const THEME_STORAGE_KEY = 'mantra-core-health.theme';

const PAGE_TITLE = '.paginated-form__titulo';
const PERSONAL_DATA_TAB = 'Datos personales';

type Theme = 'light' | 'dark';
type SimulatorAccount = 'medica' | 'paciente';

const THEMES: readonly Theme[] = ['light', 'dark'];
const WIDTHS = [1280, 360] as const;
const VIEWPORT_HEIGHT: Readonly<Record<number, number>> = { 360: 800, 1280: 900 };

/** Un punto de Santa Cruz de la Sierra, para el domicilio que el alta exige. */
const HOME_POINT = { lat: -17.7833, lng: -63.1821 };

test.beforeAll(() => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
});

/* ------------------------------------------------------------------ entorno */

/** El tema lo leen el script anti-parpadeo y el servicio de tema en cada carga. */
async function useTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript(
    ([storageKey, value]) => {
      if (location.protocol.startsWith('http')) localStorage.setItem(storageKey, value);
    },
    [THEME_STORAGE_KEY, theme] as const,
  );
}

async function signIn(page: Page, account: SimulatorAccount, theme: Theme): Promise<void> {
  await useTheme(page, theme);
  await entrarAlSimulador(page, account, BASE_URL);
  await esperarAQueSeAsiente(page);
}

async function setWidth(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT[width] ?? 900 });
}

/**
 * Navega **dentro** de la SPA, sin recargar: el simulador guarda en memoria los
 * bytes de un archivo recién subido y un F5 los pierde (`files.handlers.ts`).
 */
async function navigateInApp(page: Page, route: string): Promise<void> {
  await page.evaluate((destination) => {
    window.history.pushState({}, '', destination);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await page.waitForURL(`**${route.split('?')[0]}**`);
  await esperarAQueSeAsiente(page);
}

/** Sin esqueletos y sin animaciones con fin corriendo. */
async function settle(page: Page): Promise<void> {
  await expect(page.locator('app-skeleton, [aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === 'running' && animation.effect?.getComputedTiming().endTime !== Infinity,
      );
    await Promise.race([
      Promise.all(finite.map((animation) => animation.finished.catch(() => undefined))),
      new Promise((resolve) => setTimeout(resolve, 3_000)),
    ]);
  });
}

/** La pantalla tal como se ve, con `target` a la vista. */
async function capture(page: Page, target: Locator, name: string): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  await settle(page);
  await page.screenshot({ path: join(EVIDENCE_DIR, `${name}.png`) });
}

/** Lo que mide la prueba no se sale de la pantalla en ese ancho. */
async function expectWithinViewport(target: Locator, width: number): Promise<void> {
  const box = await target.boundingBox();
  expect(box, 'el bloque está en pantalla').not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
}

/** Un PNG apaisado, distinto del logo sembrado, dibujado en el propio navegador. */
async function drawLogo(page: Page, label: string): Promise<Buffer> {
  const base64 = await page.evaluate((text) => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#0b557e';
    context.fillRect(0, 0, 400, 200);
    context.fillStyle = '#ffffff';
    context.font = 'bold 40px sans-serif';
    context.fillText(text, 32, 115);
    return canvas.toDataURL('image/png').split(',')[1]!;
  }, label);
  return Buffer.from(base64, 'base64');
}

/* --------------------------------------------------------------------- alta */

async function onPage(page: Page, title: string): Promise<void> {
  await expect(page.locator(PAGE_TITLE).first()).toContainText(title, { timeout: 20_000 });
}

async function next(page: Page): Promise<void> {
  const button = page.getByTestId('paginated-form-continuar').last();
  await expect(button).toBeEnabled({ timeout: 20_000 });
  await button.click();
}

/** Abre un desplegable por su nombre accesible y elige la opción, como una persona. */
async function pick(page: Page, name: RegExp, option: string | RegExp): Promise<void> {
  const combo = page.getByRole('combobox', { name });
  await combo.click();
  await page.getByRole('option', { name: option }).first().click();
  await expect(combo).not.toHaveText(/^Elija/);
}

/** Escribe el punto en el panel de coordenadas del mapa y lo confirma. */
async function confirmPoint(
  page: Page,
  mapTestId: string,
  confirmTestId: string,
  point: { readonly lat: number; readonly lng: number },
): Promise<void> {
  const block = page
    .getByTestId(mapTestId)
    .locator('xpath=ancestor::*[contains(@class,"registro__ubicacion")][1]');
  const toggle = block.getByTestId('location-coordinates-toggle');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await block.getByTestId('location-coordinates-lat').fill(String(point.lat).replace('.', ','));
  await block.getByTestId('location-coordinates-lng').fill(String(point.lng).replace('.', ','));
  await block.getByTestId('location-coordinates-apply').click();
  const confirm = page.getByTestId(confirmTestId);
  await expect(confirm).not.toHaveAttribute('aria-disabled', 'true', { timeout: 20_000 });
  await confirm.click();
}

/** Las cuatro páginas obligatorias antes del consultorio propio. */
async function fillUntilOwnOffice(page: Page, email: string): Promise<void> {
  await onPage(page, 'Su nombre y su cédula');
  await page.getByTestId('registro-pro-nombre').fill('Ana');
  await page.getByTestId('registro-pro-apellido-paterno').fill('Paz');
  await page.getByTestId('registro-pro-documento').fill('7654321');
  await pick(page, /Departamento de emisión/, 'Santa Cruz');
  await next(page);

  await onPage(page, 'Sus datos y su acceso');
  await pick(page, /Sexo/, /Femenino|Mujer/);
  const birthDate = page.getByPlaceholder('DD/MM/AAAA');
  await birthDate.click();
  await page.keyboard.type('12051985', { delay: 60 });
  await expect(birthDate).toHaveValue('12/05/1985');
  await page.getByTestId('registro-pro-celular-personal').fill('70012345');
  await page.getByTestId('registro-pro-correo-personal').fill(email);
  await page.getByTestId('registro-pro-password').fill('Medico-2026!');
  await next(page);

  await onPage(page, '¿Dónde vive?');
  await confirmPoint(
    page,
    'registration-practitioner-home-map',
    'registration-practitioner-home-location-confirm',
    HOME_POINT,
  );
  await next(page);

  await onPage(page, 'Su trabajo');
  await next(page);
  await onPage(page, 'Su consultorio propio');
}

/** Desde el título profesional hasta crear la cuenta: lo que sigue es opcional. */
async function finishRegistration(page: Page): Promise<void> {
  await onPage(page, 'Su título profesional');
  await page.getByTestId('registro-pro-titulo').getByRole('combobox').fill('Médico');
  await page.getByRole('option', { name: 'Médico / Médica', exact: true }).click();
  await next(page);

  await onPage(page, 'Su habilitación');
  await page.getByTestId('registro-pro-matricula').fill('MP-12345');
  await page.getByTestId('registro-pro-credencial').fill('T.I. 538/14');
  // Para «Médico» el registro en el Colegio Médico es obligatorio.
  await page.getByTestId('registro-pro-colegio').fill('CMB-4410');

  // «Siguiente» hasta que el alta termine. El último clic pre-carga el logo y
  // envía el alta; mientras eso viaja el botón se deshabilita y no se insiste.
  const done = page.getByTestId('registro-exito');
  const button = page.getByTestId('paginated-form-continuar').last();
  for (let step = 0; step < 8 && !(await done.isVisible()); step += 1) {
    if ((await button.count()) > 0 && (await button.isEnabled())) await button.click();
    await done.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
  }
  await expect(done).toBeVisible({ timeout: 60_000 });
}

/* ------------------------------------------------------------------- perfil */

/** «Mi perfil» en «Datos personales», donde está el bloque del logo. */
async function openPersonalData(page: Page): Promise<void> {
  await navigateInApp(page, '/my-account');
  await page.getByRole('tab', { name: PERSONAL_DATA_TAB }).click();
  await esperarAQueSeAsiente(page);
}

/* -------------------------------------------------------------------- casos */

test.describe('Correcciones del médico · el logo del consultorio', () => {
  for (const theme of THEMES) {
    test(`un médico nuevo se da de alta con el logo de su consultorio (${theme})`, async ({ page }) => {
      test.setTimeout(300_000);
      await useTheme(page, theme);
      await setWidth(page, 1280);
      await page.goto(`${BASE_URL}/auth/register/practitioner`, { waitUntil: 'domcontentloaded' });
      await esperarAQueSeAsiente(page);

      await fillUntilOwnOffice(page, `ana.paz.logo.${theme}@example.test`);
      await page.getByTestId('registration-practitioner-office-name').fill('Consultorio Paz');

      const field = page.locator('[data-campo="officeLogo"]');
      const preview = page.getByTestId('registration-practitioner-office-logo-preview');
      const input = page.getByTestId('registration-practitioner-office-logo-input');
      const error = page.getByTestId('registration-practitioner-office-logo-error');
      const remove = page.getByTestId('registration-practitioner-office-logo-remove');

      // Vacío: el campo opcional, con la caja «Sin logo».
      await expect(field).toContainText('Logo del consultorio (opcional)');
      await expect(preview.getByTestId('logo-consultorio-vacio')).toBeVisible();
      await expect(remove).toHaveCount(0);
      for (const width of WIDTHS) {
        await setWidth(page, width);
        await expectWithinViewport(field, width);
        await capture(page, field, `registration-office-logo-empty-${theme}-${width}`);
      }
      await setWidth(page, 1280);

      // Un PDF: el motivo en el campo, y no se elige nada.
      await input.setInputFiles({
        name: 'logo.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
      });
      await expect(error).toContainText('PNG, JPG o WebP');
      await expect(error).toHaveAttribute('role', 'alert');
      await expect(preview.getByTestId('logo-consultorio-vacio')).toBeVisible();
      await expect(remove).toHaveCount(0);
      await capture(page, field, `registration-office-logo-pdf-rejected-${theme}-1280`);

      // Una imagen de 3 MB: el motivo dice el tope.
      await input.setInputFiles({
        name: 'logo-pesado.png',
        mimeType: 'image/png',
        buffer: Buffer.alloc(3 * 1024 * 1024),
      });
      await expect(error).toContainText('2 MB');
      await expect(preview.getByTestId('logo-consultorio-vacio')).toBeVisible();
      await capture(page, field, `registration-office-logo-too-large-${theme}-1280`);

      // Una imagen válida: se ve en la caja, el aviso se va y se puede quitar.
      await input.setInputFiles({
        name: 'logo.png',
        mimeType: 'image/png',
        buffer: await drawLogo(page, 'Consultorio Paz'),
      });
      await expect(preview.locator('img')).toHaveAttribute('src', /^data:image\/png/);
      await expect(error).toHaveCount(0);
      await expect(remove).toBeVisible();
      for (const width of WIDTHS) {
        await setWidth(page, width);
        await expectWithinViewport(field, width);
        await capture(page, field, `registration-office-logo-preview-${theme}-${width}`);
      }
      await setWidth(page, 1280);

      await next(page);
      await finishRegistration(page);
      await capture(page, page.getByTestId('registro-exito'), `registration-done-with-logo-${theme}-1280`);
    });

    test(`un médico existente cambia el logo desde «Editar» y su perfil lo muestra (${theme})`, async ({
      page,
    }) => {
      test.setTimeout(240_000);
      await setWidth(page, 1280);
      await signIn(page, 'medica', theme);

      // Antes: el logo sembrado de la médica, en «Datos personales».
      await openPersonalData(page);
      const block = page.getByTestId('perfil-logo-consultorio');
      const profileImage = page.getByTestId('perfil-logo-consultorio-vista').locator('img');
      await expect(profileImage).toBeVisible();
      const before = await profileImage.getAttribute('src');
      await capture(page, block, `profile-office-logo-before-${theme}-1280`);

      // «Editar», «Datos personales»: se sube uno nuevo y se guarda.
      await navigateInApp(page, '/my-account/edit?pestana=0');
      const editor = page.getByTestId('edicion-logo');
      await expect(editor).toBeVisible();
      await editor.locator('input[type="file"]').setInputFiles({
        name: 'logo-nuevo.png',
        mimeType: 'image/png',
        buffer: await drawLogo(page, 'Consultorio Rojas'),
      });
      await expect(page.getByTestId('edicion-logo-vista').locator('img')).toHaveAttribute(
        'src',
        /^data:image\/png/,
      );
      await capture(page, editor, `edit-office-logo-new-${theme}-1280`);
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(page.getByText('Su perfil quedó actualizado.')).toBeVisible();

      // Después: el perfil muestra el nuevo, no el sembrado ni «Sin logo».
      await openPersonalData(page);
      await expect(profileImage).toHaveAttribute('src', /^data:image\/png/);
      expect(await profileImage.getAttribute('src')).not.toBe(before);
      await expect(block.getByTestId('logo-consultorio-vacio')).toHaveCount(0);
      for (const width of WIDTHS) {
        await setWidth(page, width);
        await expectWithinViewport(block, width);
        await capture(page, block, `profile-office-logo-after-${theme}-${width}`);
      }
    });

    test(`el paciente no tiene el logo del consultorio en su perfil (${theme})`, async ({ page }) => {
      await setWidth(page, 1280);
      await signIn(page, 'paciente', theme);

      for (const width of WIDTHS) {
        await setWidth(page, width);
        await openPersonalData(page);
        await expect(page.getByTestId('perfil-logo-consultorio')).toHaveCount(0);
        await expect(page.getByText('Logo del consultorio')).toHaveCount(0);
        await capture(
          page,
          page.getByRole('tab', { name: PERSONAL_DATA_TAB }),
          `patient-profile-without-office-logo-${theme}-${width}`,
        );
      }
    });
  }
});

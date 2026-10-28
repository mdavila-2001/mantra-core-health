import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * Correcciones del médico, primera tanda (27/10/2026): lo que se ve en «Mi
 * perfil» y en el menú.
 *
 * 1. Cargar y recorrer `/my-account` como médico no abre «¿Abrir Teléfono?»: el
 *    teléfono de la sede ya no vive dentro del botón que la elige, y el botón de
 *    emergencia sólo llama detrás de un clic.
 * 2. «Emergencia» es del paciente: el médico no la ve ni en el menú lateral ni
 *    en la cabecera del teléfono.
 * 3. El sello de una especialidad pendiente no se sale de su tarjeta en ningún
 *    ancho.
 * 13. La barra lateral es petróleo, con tinta y logo blancos, también en claro.
 *
 * Contra el simulador (cuentas `medica@` y `paciente@alovida.mock`). Las capturas
 * quedan en `docs/frontend/evidence/correcciones-medico-c1a/`, sin `fullPage`:
 * cada una con el viewport del ancho que mide y después de que terminen las
 * animaciones con fin.
 */

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const EVIDENCE_DIR = join('docs', 'frontend', 'evidence', 'correcciones-medico-c1a');

/** Las claves que lee la aplicación al arrancar (`theme.service.ts`, `trusted-ambulance.store.ts`). */
const THEME_STORAGE_KEY = 'mantra-core-health.theme';
const TRUSTED_AMBULANCE_KEY = 'alovida.ambulancia-de-confianza';

/**
 * El rótulo que trae el catálogo real para una especialidad sin verificar. El
 * simulador lo abrevia a «Pendiente», que entra en cualquier tarjeta: la medida
 * se hace con el texto largo, que es el que se salía.
 */
const PENDING_SEAL_LABEL = 'Especialidad pendiente de verificación';

/** La pestaña de la ficha donde están las sedes (`DOCTOR_PROFILE_TABS`). */
const SITES_TAB = 'Dónde atiendo';

/** Petróleo de la barra (`--sup-nav` en claro) y tinta blanca, como los devuelve `getComputedStyle`. */
const SIDE_NAV_PETROL = 'rgb(11, 85, 126)';
const WHITE_INK = 'rgb(255, 255, 255)';
/** `--anillo-foco-nav`: la menta, en los dos temas. */
const NAV_FOCUS_RING = 'rgb(159, 216, 208)';
const WHITE_LOGO = '/alovida/imagenes/alovida-logo-blanco.svg';

type Theme = 'light' | 'dark';
type SimulatorAccount = 'medica' | 'paciente';

const VIEWPORT_HEIGHT: Readonly<Record<number, number>> = { 360: 800, 390: 844, 768: 1024, 1280: 900, 1920: 1080 };

interface TelWatch {
  readonly dialogs: string[];
  readonly frameNavigations: string[];
}

interface SealFit {
  readonly sealScrollWidth: number;
  readonly badgeClientWidth: number;
  readonly badgeScrollWidth: number;
  readonly cardClientWidth: number;
  readonly cardScrollWidth: number;
  readonly sealRight: number;
  readonly badgeRight: number;
  readonly cardRight: number;
}

test.beforeAll(() => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
});

/**
 * Deja un valor en `localStorage` antes de cada carga, para que la aplicación lo lea al
 * arrancar. Sólo en documentos http(s): en `about:blank` el almacenamiento no existe.
 */
async function storeBeforeEachLoad(page: Page, key: string, value: string): Promise<void> {
  await page.addInitScript(
    ([storageKey, storageValue]) => {
      if (location.protocol.startsWith('http')) localStorage.setItem(storageKey, storageValue);
    },
    [key, value] as const,
  );
}

/** El tema lo leen el script anti-parpadeo y el servicio de tema. */
async function useTheme(page: Page, theme: Theme): Promise<void> {
  await storeBeforeEachLoad(page, THEME_STORAGE_KEY, theme);
}

async function signIn(page: Page, account: SimulatorAccount, theme: Theme = 'light'): Promise<void> {
  await useTheme(page, theme);
  await entrarAlSimulador(page, account, BASE_URL);
  await esperarAQueSeAsiente(page);
}

async function setWidth(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT[width] ?? 900 });
}

async function openRoute(page: Page, route: string): Promise<void> {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
  await esperarAQueSeAsiente(page);
}

/**
 * Sin esqueletos y sin animaciones con fin corriendo. Las infinitas —el electro
 * del menú— no se esperan: no terminan nunca.
 */
async function settle(page: Page): Promise<void> {
  await expect(page.locator('app-skeleton, [aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((animation) => animation.playState === 'running' && animation.effect?.getComputedTiming().endTime !== Infinity);
    await Promise.race([
      Promise.all(finite.map((animation) => animation.finished.catch(() => undefined))),
      new Promise((resolve) => setTimeout(resolve, 3_000)),
    ]);
  });
}

async function capture(page: Page, name: string): Promise<void> {
  await settle(page);
  await page.screenshot({ path: join(EVIDENCE_DIR, `${name}.png`) });
}

/**
 * Registra todo intento de abrir `tel:` en la página.
 *
 * `dialog` y `framenavigated` son lo que Playwright ofrece, pero el aviso
 * «¿Abrir Teléfono?» es del sistema operativo y una navegación a `tel:` no
 * llega a confirmarse: por eso además una sonda en la propia página anota cada
 * clic que cae en un enlace `tel:` y cada navegación a `tel:` que avisa la API
 * de navegación del navegador.
 */
async function watchTelNavigations(page: Page): Promise<TelWatch> {
  const watch: TelWatch = { dialogs: [], frameNavigations: [] };
  page.on('dialog', (dialog) => {
    watch.dialogs.push(`${dialog.type()}: ${dialog.message()}`);
    void dialog.dismiss();
  });
  page.on('framenavigated', (frame) => {
    if (frame.url().startsWith('tel:')) watch.frameNavigations.push(frame.url());
  });
  await page.addInitScript(() => {
    const attempts: string[] = [];
    (window as unknown as { telAttempts: string[] }).telAttempts = attempts;
    document.addEventListener(
      'click',
      (event) => {
        const link = event.target instanceof Element ? event.target.closest('a[href^="tel:"]') : null;
        if (link !== null) attempts.push(`clic en ${link.getAttribute('href') ?? ''}`);
      },
      true,
    );
    const navigationApi = (window as unknown as { navigation?: EventTarget }).navigation;
    navigationApi?.addEventListener('navigate', (event) => {
      const destination = (event as unknown as { destination?: { url?: string } }).destination?.url ?? '';
      if (destination.startsWith('tel:')) attempts.push(`navegación a ${destination}`);
    });
  });
  return watch;
}

async function telAttempts(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => (window as unknown as { telAttempts?: string[] }).telAttempts ?? []);
}

async function storeTrustedAmbulance(page: Page): Promise<void> {
  const ambulance = JSON.stringify({ nombre: 'Ambulancias de mi seguro', telefono: '+591 70012345' });
  await storeBeforeEachLoad(page, TRUSTED_AMBULANCE_KEY, ambulance);
}

/** Abre el cajón del menú, donde el menú no entra al costado (≤ 900 px). */
async function openDrawer(page: Page): Promise<void> {
  await page.getByTestId('header-menu').click();
  await expect(page.locator('html')).toHaveClass(/nav-abierto/);
  await settle(page);
}

/**
 * Pone el rótulo largo en el primer sello de especialidad de la ficha y mide si
 * cabe: el sello contra su insignia, y la insignia contra la tarjeta.
 */
async function measurePendingSeal(page: Page): Promise<SealFit | null> {
  return page.getByTestId('perfil-especialidades-chips').evaluate((grid, label) => {
    const badge = grid.querySelector('app-specialty-badge:has(app-status-seal)');
    const seal = badge?.querySelector('app-status-seal');
    const card = badge?.closest('app-card');
    if (!(badge instanceof HTMLElement) || !(seal instanceof HTMLElement) || !(card instanceof HTMLElement)) {
      return null;
    }
    const sealLabel = seal.querySelector('.status-seal__label');
    if (sealLabel !== null) sealLabel.textContent = label;
    return {
      sealScrollWidth: seal.scrollWidth,
      badgeClientWidth: badge.clientWidth,
      badgeScrollWidth: badge.scrollWidth,
      cardClientWidth: card.clientWidth,
      cardScrollWidth: card.scrollWidth,
      sealRight: seal.getBoundingClientRect().right,
      badgeRight: badge.getBoundingClientRect().right,
      cardRight: card.getBoundingClientRect().right,
    };
  }, PENDING_SEAL_LABEL);
}

test.describe('Correcciones del médico · perfil y menú', () => {
  for (const withTrustedAmbulance of [false, true]) {
    const variant = withTrustedAmbulance ? 'with-trusted-ambulance' : 'without-trusted-ambulance';

    test(`el médico carga y recorre /my-account sin «¿Abrir Teléfono?» (${
      withTrustedAmbulance ? 'con' : 'sin'
    } ambulancia de confianza guardada)`, async ({ page }) => {
      await setWidth(page, 1280);
      if (withTrustedAmbulance) await storeTrustedAmbulance(page);
      const watch = await watchTelNavigations(page);
      await signIn(page, 'medica');

      await openRoute(page, '/my-account');
      await capture(page, `doctor-my-account-load-${variant}`);

      const tabs = page.locator('.mi-perfil__bloque').getByRole('tab');
      const tabCount = await tabs.count();
      expect(tabCount, 'la ficha del médico tiene pestañas').toBeGreaterThan(0);
      let visitedSitesTab = false;
      for (let tabIndex = 0; tabIndex < tabCount; tabIndex += 1) {
        const tab = tabs.nth(tabIndex);
        await tab.click();
        await esperarAQueSeAsiente(page);
        // En «Dónde atiendo», elegir cada sede: era el botón que envolvía al teléfono.
        const siteButtons = page.locator('.sedes__boton:visible');
        if ((await tab.innerText()).trim() === SITES_TAB) {
          visitedSitesTab = true;
          // La médica del simulador atiende en cuatro sedes y dos traen teléfono.
          // Sin una sede a la vista no se elegiría ninguna, y sin un teléfono el
          // «ningún tel: dentro de un botón» de abajo no tendría qué mirar.
          await expect(siteButtons.first(), 'hay sedes a la vista en «Dónde atiendo»').toBeVisible();
          expect(await siteButtons.count(), 'sedes en «Dónde atiendo»').toBeGreaterThanOrEqual(1);
          const phoneLinks = page.locator('[data-testid="practice-site-contact-phone"]:visible');
          expect(await phoneLinks.count(), 'teléfonos de sede en «Dónde atiendo»').toBeGreaterThanOrEqual(1);
        }
        for (let siteIndex = 0, siteCount = await siteButtons.count(); siteIndex < siteCount; siteIndex += 1) {
          await siteButtons.nth(siteIndex).click();
        }
      }
      expect(visitedSitesTab, `la ficha tiene la pestaña «${SITES_TAB}»`).toBe(true);

      await expect(page.locator('button a[href^="tel:"]'), 'ningún enlace tel: dentro de un botón').toHaveCount(0);
      await capture(page, `doctor-my-account-tabs-${variant}`);

      expect(watch.dialogs, 'diálogos abiertos').toEqual([]);
      expect(watch.frameNavigations, 'navegaciones tel: del marco').toEqual([]);
      expect(await telAttempts(page), 'intentos de abrir tel: en la página').toEqual([]);
    });
  }

  for (const width of [360, 1280]) {
    test(`a ${width} px el médico no tiene Emergencia, ni en el menú ni en la cabecera`, async ({ page }) => {
      await setWidth(page, width);
      await signIn(page, 'medica');

      await expect(page.locator('#app-side-nav [data-testid="boton-emergencia"]')).toHaveCount(0);
      await expect(page.getByTestId('header-emergencia')).toHaveCount(0);
      await capture(page, `doctor-emergency-${width}`);

      if (width === 360) {
        await openDrawer(page);
        await expect(page.locator('#app-side-nav [data-testid="boton-emergencia"]')).toHaveCount(0);
        await capture(page, `doctor-emergency-drawer-${width}`);
      }
    });

    test(`a ${width} px el paciente tiene Emergencia en el menú y en la cabecera`, async ({ page }) => {
      await setWidth(page, width);
      await signIn(page, 'paciente');

      // La cabecera la lleva siempre; la hoja la muestra sólo donde el menú es un cajón.
      await expect(page.getByTestId('header-emergencia')).toHaveCount(1);
      if (width === 360) {
        await expect(page.locator('[data-testid="header-emergencia"] [data-testid="boton-emergencia"]')).toBeVisible();
        await capture(page, `patient-emergency-${width}`);
        await openDrawer(page);
      }
      await expect(page.locator('#app-side-nav [data-testid="boton-emergencia"]')).toBeVisible();
      await capture(page, width === 360 ? `patient-emergency-drawer-${width}` : `patient-emergency-${width}`);
    });
  }

  for (const theme of ['light', 'dark'] as const) {
    test(`tema ${theme}: el sello de una especialidad pendiente no se sale de la tarjeta`, async ({ page }) => {
      await setWidth(page, 1280);
      await signIn(page, 'medica', theme);
      await openRoute(page, '/my-account');
      const specialties = page.getByTestId('perfil-especialidades-chips');
      await expect(specialties).toBeVisible();

      for (const width of [360, 768, 1280, 1920]) {
        await setWidth(page, width);
        await settle(page);
        const fit = await measurePendingSeal(page);

        expect(fit, `a ${width} px hay una especialidad con sello`).not.toBeNull();
        expect(fit!.sealScrollWidth, `a ${width} px el sello cabe en su insignia`).toBeLessThanOrEqual(fit!.badgeClientWidth);
        expect(fit!.badgeScrollWidth, `a ${width} px la insignia no desborda`).toBeLessThanOrEqual(fit!.badgeClientWidth);
        expect(fit!.cardScrollWidth, `a ${width} px la tarjeta no desborda`).toBeLessThanOrEqual(fit!.cardClientWidth);
        expect(fit!.sealRight, `a ${width} px el sello termina dentro de la insignia`).toBeLessThanOrEqual(fit!.badgeRight + 0.5);
        expect(fit!.badgeRight, `a ${width} px la insignia termina dentro de la tarjeta`).toBeLessThanOrEqual(fit!.cardRight + 0.5);

        // La captura es del viewport, con la insignia al centro: se ven a la vez el
        // sello y el borde de la tarjeta que no tiene que cruzar.
        await specialties.evaluate((grid) => grid.scrollIntoView({ block: 'center' }));
        await capture(page, `specialty-seal-${theme}-${width}`);
      }
    });

    test(`tema ${theme}: la barra lateral es petróleo con tinta y logo blancos, a 1280 y en el cajón a 390`, async ({ page }) => {
      await setWidth(page, 1280);
      await signIn(page, 'medica', theme);
      const sideNav = page.locator('#app-side-nav');
      const logo = sideNav.locator('.app-side-nav__marca img');

      await expect(logo).toHaveCount(1);
      await expect(logo).toHaveAttribute('src', WHITE_LOGO);
      await expect(logo).toBeVisible();
      expect(await sideNav.locator('.app-side-nav__palabra').evaluate((word) => getComputedStyle(word).color)).toBe(
        WHITE_INK,
      );
      if (theme === 'light') {
        expect(await sideNav.evaluate((nav) => getComputedStyle(nav).backgroundColor)).toBe(SIDE_NAV_PETROL);
      }
      await capture(page, `sidenav-${theme}-1280`);

      // Foco con teclado: desde el salto al contenido, hasta el primer destino del menú.
      await page.locator('.shell__skip-link').focus();
      let onNavLink = false;
      for (let step = 0; step < 12 && !onNavLink; step += 1) {
        await page.keyboard.press('Tab');
        onNavLink = await page.evaluate(
          () => document.activeElement?.matches('#app-side-nav [data-testid="nav-enlace"]') ?? false,
        );
      }
      // Sin esto, doce Tab que no llegan al menú medirían el anillo de otro control.
      expect(onNavLink, 'el foco quedó en un enlace del menú').toBe(true);
      const focusRing = await page.evaluate(() => {
        const focused = document.activeElement;
        return focused instanceof HTMLElement && focused.matches(':focus-visible')
          ? getComputedStyle(focused).outlineColor
          : null;
      });
      expect(focusRing, 'el anillo de foco del menú es la menta').toBe(NAV_FOCUS_RING);
      await capture(page, `sidenav-focus-${theme}-1280`);

      await setWidth(page, 390);
      await openDrawer(page);
      await expect(logo).toHaveAttribute('src', WHITE_LOGO);
      if (theme === 'light') {
        expect(await sideNav.evaluate((nav) => getComputedStyle(nav).backgroundColor)).toBe(SIDE_NAV_PETROL);
      }
      await capture(page, `sidenav-drawer-${theme}-390`);
    });
  }
});

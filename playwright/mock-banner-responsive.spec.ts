import { expect, test } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

const patientRoutes = [
  { path: '/laboratory-directory', heading: 'Directorio de laboratorios' },
  { path: '/my-account/appointments', heading: 'Mis citas' },
  { path: '/my-account/diagnostic-orders', heading: 'Mis órdenes' },
  { path: '/my-account/diagnostic-results', heading: 'Mis resultados' },
  { path: '/my-account/promotions', heading: 'Promociones' },
];
const viewports = [
  { width: 320, height: 844 },
  { width: 375, height: 844 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

test('patient routes keep the demo notice clear of the theme control across viewports', async (
  { page },
  testInfo,
) => {
  await page.setViewportSize(viewports[0]);
  await entrarAlSimulador(page, 'paciente', '');
  await page.goto(patientRoutes[0].path);

  const demoNotice = page.locator('app-mock-banner .mock__boton').first();
  await expect(demoNotice).toHaveAccessibleName('Datos de prueba');
  await demoNotice.click();
  await expect(demoNotice).toHaveAccessibleName('Ocultar');
  await expect(demoNotice).toHaveText('Ocultar');
  await demoNotice.click();
  await expect(demoNotice).toHaveAccessibleName('Datos de prueba');
  await expect
    .poll(() => demoNotice.evaluate((element: HTMLElement) => element.innerText.trim()))
    .toBe('Demo');

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    for (const { path, heading } of patientRoutes) {
      await page.goto(path);
      await esperarAQueSeAsiente(page);

      const notice = page.locator('app-mock-banner .mock__boton').first();
      const themeControl = page.getByTestId('header-theme-toggle');
      const pageHeading = page.getByRole('heading', { level: 1 }).first();
      await expect(notice).toBeVisible();
      await expect(notice).toHaveAccessibleName('Datos de prueba');
      await expect(pageHeading).toHaveText(heading);
      await expect
        .poll(() => notice.evaluate((element: HTMLElement) => element.innerText.trim()))
        .toBe(viewport.width <= 960 ? 'Demo' : 'Datos de prueba');
      await expect(themeControl).toBeVisible();
      await expect(pageHeading).toBeVisible();

      const geometry = await page.evaluate(() => {
        const notice = document.querySelector('app-mock-banner .mock__boton');
        const themeControl = document.querySelector('[data-testid="header-theme-toggle"]');
        if (!notice || !themeControl) throw new Error('Expected both header controls to exist');

        const noticeRect = notice.getBoundingClientRect();
        const themeRect = themeControl.getBoundingClientRect();
        const width = Math.max(
          0,
          Math.min(noticeRect.right, themeRect.right) - Math.max(noticeRect.left, themeRect.left),
        );
        const height = Math.max(
          0,
          Math.min(noticeRect.bottom, themeRect.bottom) - Math.max(noticeRect.top, themeRect.top),
        );
        return {
          area: width * height,
          notice: { x: noticeRect.x, width: noticeRect.width, y: noticeRect.y },
          theme: { x: themeRect.x, width: themeRect.width, y: themeRect.y },
        };
      });

      expect(
        geometry.area,
        `${path} at ${viewport.width}px overlaps the theme control; ${JSON.stringify(geometry)}`,
      ).toBe(0);

      if (path === patientRoutes[0].path) {
        await page.screenshot({
          path: testInfo.outputPath(`patient-demo-${viewport.width}.png`),
        });
      }
    }
  }
});

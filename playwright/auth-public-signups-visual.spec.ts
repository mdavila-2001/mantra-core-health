import { expect, test } from '@playwright/test';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://127.0.0.1:4302';
const RUTAS = [
  ['/auth/register', 'Crear cuenta'],
  ['/auth/register/patient', 'Crear cuenta de paciente'],
  ['/auth/register/practitioner', 'Crear cuenta de profesional'],
  ['/auth/register/organization', 'Registre su aseguradora'],
  ['/auth/register/laboratory', 'Registre su laboratorio'],
  ['/auth/register/imaging-center', 'Registre su centro de imagenología'],
] as const;
const VIEWPORTS = [
  { nombre: '375 claro', width: 375, height: 812, colorScheme: 'light' as const },
  { nombre: '768 claro', width: 768, height: 1024, colorScheme: 'light' as const },
  { nombre: '1440 claro', width: 1440, height: 900, colorScheme: 'light' as const },
  { nombre: '1440 oscuro', width: 1440, height: 900, colorScheme: 'dark' as const },
];

test('las seis altas públicas conservan superficie blanca, ancho y centrado', async ({ browser }) => {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: viewport.colorScheme,
      locale: 'es-BO',
      timezoneId: 'America/La_Paz',
    });
    for (const [route, expectedHeading] of RUTAS) {
      const page = await context.newPage();
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: expectedHeading, exact: true })).toBeVisible();

      const metrics = await page.evaluate(() => {
        const scene = document.querySelector('.auth-split');
        const area = document.querySelector('.auth-split__content');
        const content = document.querySelector('.registro-conjunto, .registro, .tipos');
        if (!scene || !area || !content) throw new Error('Falta el área de alta pública.');
        const sceneRect = scene.getBoundingClientRect();
        const areaRect = area.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const visibleArtwork = [
          '.auth-split__stage',
          '.auth-split__aurora',
          '.auth-split__brand',
        ].filter((selector) =>
          Array.from(scene.querySelectorAll(selector)).some(
            (element) => getComputedStyle(element).display !== 'none',
          ),
        );
        return {
          background: getComputedStyle(scene).backgroundColor,
          visibleArtwork,
          areaWidth: areaRect.width,
          contentWidth: contentRect.width,
          leftGap: contentRect.left - areaRect.left,
          rightGap: areaRect.right - contentRect.right,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: innerWidth,
          sceneWidth: sceneRect.width,
        };
      });

      expect(metrics.documentWidth, viewport.nombre + ' ' + route).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(Math.abs(metrics.leftGap - metrics.rightGap), viewport.nombre + ' ' + route + ' centrado').toBeLessThanOrEqual(2);
      if (viewport.colorScheme === 'light') {
        expect(metrics.background, viewport.nombre + ' ' + route + ' fondo').toBe('rgb(255, 255, 255)');
        expect(metrics.visibleArtwork, viewport.nombre + ' ' + route + ' sin fondo decorativo').toEqual([]);
        expect(metrics.contentWidth / metrics.areaWidth, viewport.nombre + ' ' + route + ' ancho ≥85%').toBeGreaterThanOrEqual(0.85);
      } else {
        expect(metrics.background, viewport.nombre + ' ' + route + ' conserva superficie oscura').not.toBe('rgb(255, 255, 255)');
        expect(metrics.visibleArtwork.length, viewport.nombre + ' ' + route + ' conserva la escena oscura').toBeGreaterThan(0);
      }
      await page.close();
    }
    await context.close();
  }
});

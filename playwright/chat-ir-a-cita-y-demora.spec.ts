import { expect, test, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

import { esperarAplicacionLista } from './support/sesion';

/**
 * Evidencia de navegador del pedido del 2026-10-28 sobre la mensajería:
 *
 * 1. El aviso de cita en el chat trae un botón «Ir a la cita», y cada lado va
 *    a SU pantalla: la médica a su agenda, la paciente a «Mis citas».
 * 2. Una demora del profesional avisa como push: toast fijo con «Ver mi cita»
 *    y el mismo aviso, con emojis, en el chat de Soporte.
 *
 * Corre contra la **maqueta** (`ng serve --configuration demo`, backend en memoria). La demora
 * se dispara con `POST /scheduling/bookings/:id/delay` por el `HttpClient` de
 * la propia aplicación —pasa por el interceptor de la maqueta y por su
 * handler, igual que cuando la médica toca «Avisar»—: hacerlo desde la UI de
 * la médica exigiría compartir la memoria de la maqueta entre dos sesiones, y
 * la maqueta no la comparte.
 */

const EVIDENCIA = 'docs/frontend/evidence/chat-ir-a-cita-y-demora-2026-10-29';

const MEDICA = { usuario: 'medica@alovida.mock', clave: 'alovida' };
const PACIENTE = { usuario: 'paciente@alovida.mock', clave: 'alovida' };

// De ancho a angosto: achicar con el cajón lateral abierto lo deja tapando
// la pantalla, y la foto mostraría el cajón y no lo que se prueba.
const VIEWPORTS = [
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '390', width: 390, height: 844 },
] as const;

test.describe.configure({ mode: 'serial' });

async function entrar(browser: Browser, cuenta: typeof MEDICA, errores: string[]): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => {
    // El script en línea que inyecta `ng serve` (HMR) choca con la CSP del
    // index; es del servidor de desarrollo, no de esta pantalla (igual que en
    // `b1-dependientes.spec.ts`).
    if (m.type() === 'error' && !m.text().includes('Content Security Policy')) errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  await page.goto('/auth');
  await esperarAplicacionLista(page);
  await page.getByTestId('login-identifier').fill(cuenta.usuario);
  await page.getByTestId('login-password').fill(cuenta.clave);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
  return page;
}

/** Abre el hilo cuyo último mensaje es la confirmación sembrada. */
async function abrirConfirmacion(page: Page): Promise<void> {
  await page.goto('/messaging');
  await esperarAplicacionLista(page);
  const fila = page.getByTestId('conversacion').filter({ hasText: 'Su cita quedó confirmada' }).first();
  await expect(fila).toBeVisible({ timeout: 30_000 });
  await fila.click();
  await expect(page.getByTestId('hilo-ir-cita').last()).toBeVisible();
}

test.beforeAll(() => mkdirSync(EVIDENCIA, { recursive: true }));

test('1 · la médica ve «Ir a la cita» en su confirmación y la lleva a su agenda', async ({ browser }) => {
  const errores: string[] = [];
  const page = await entrar(browser, MEDICA, errores);
  await abrirConfirmacion(page);

  const boton = page.getByTestId('hilo-ir-cita').last();
  await expect(boton).toHaveAttribute('href', /^\/schedule\?vista=citas&turno=/);
  // La URL cruda no se ve: el botón la reemplaza.
  await expect(page.getByTestId('mensaje').last()).not.toContainText('https://');
  await expect(page.getByTestId('mensaje').last()).toContainText('✅ ¡Su cita quedó confirmada!');

  for (const v of VIEWPORTS) {
    await page.setViewportSize({ width: v.width, height: v.height });
    await abrirConfirmacion(page);
    await page.screenshot({ path: `${EVIDENCIA}/01-medica-confirmacion-${v.nombre}.png` });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId('hilo-ir-cita').last().click();
  await page.waitForURL(/\/schedule\?vista=citas&turno=/);
  await esperarAplicacionLista(page);
  await page.screenshot({ path: `${EVIDENCIA}/02-medica-agenda-tras-ir-a-la-cita-1440.png` });
  expect(errores.filter((e) => !/favicon|ResizeObserver/.test(e))).toEqual([]);
  await page.close();
});

test('2 · la paciente va a «Mis citas»; la demora llega como push y al chat', async ({ browser }) => {
  const errores: string[] = [];
  const page = await entrar(browser, PACIENTE, errores);
  await abrirConfirmacion(page);

  const boton = page.getByTestId('hilo-ir-cita').last();
  await expect(boton).toHaveAttribute('href', /^\/my-account\/appointments\?turno=/);
  const turno = new URL((await boton.getAttribute('href'))!, 'http://x').searchParams.get('turno')!;

  for (const v of VIEWPORTS) {
    await page.setViewportSize({ width: v.width, height: v.height });
    await abrirConfirmacion(page);
    await page.screenshot({ path: `${EVIDENCIA}/03-paciente-confirmacion-${v.nombre}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByTestId('hilo-ir-cita').last().click();
  await page.waitForURL(/\/my-account\/appointments\?turno=/);
  await esperarAplicacionLista(page);
  await page.screenshot({ path: `${EVIDENCIA}/04-paciente-mis-citas-tras-ir-a-la-cita-1440.png` });

  // La médica avisa 20 minutos de demora en ESE turno (ver el encabezado).
  const respuesta = await page.evaluate(async (bookingId) => {
    const ng = (globalThis as unknown as { ng: { getComponent: (e: Element) => unknown } }).ng;
    const app = ng.getComponent(document.querySelector('app-root')!) as {
      delays: { notificaciones: { http: { post: (u: string, b: unknown) => { subscribe: (o: { next: (r: unknown) => void; error: (e: unknown) => void }) => void } } } };
    };
    return new Promise((ok, mal) =>
      app.delays.notificaciones.http
        .post(`/scheduling/bookings/${bookingId}/delay`, { delayMinutes: 20, message: 'Estoy terminando una urgencia.' })
        .subscribe({ next: ok, error: mal }),
    );
  }, turno);
  expect(respuesta).toMatchObject({ notified: 1, affected: 1 });

  // El push: lo levanta el sondeo de `DelayNotice` (cada 20 s).
  const push = page.locator('app-toast').filter({ hasText: 'se demora 20 minutos' });
  await expect(push).toBeVisible({ timeout: 30_000 });
  await expect(push.getByTestId('toast-accion')).toHaveText('📅 Ver mi cita');
  for (const v of VIEWPORTS) {
    await page.setViewportSize({ width: v.width, height: v.height });
    await page.screenshot({ path: `${EVIDENCIA}/05-paciente-push-demora-${v.nombre}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  expect(errores.filter((e) => !/favicon|ResizeObserver/.test(e))).toEqual([]);
  await page.close();
});

test('3 · sin recargar: el push lleva a la cita y el chat de Soporte trae la demora', async ({ browser }) => {
  const errores: string[] = [];
  const page = await entrar(browser, PACIENTE, errores);
  await abrirConfirmacion(page);
  const turno = new URL((await page.getByTestId('hilo-ir-cita').last().getAttribute('href'))!, 'http://x').searchParams.get('turno')!;

  await page.evaluate(async (bookingId) => {
    const ng = (globalThis as unknown as { ng: { getComponent: (e: Element) => unknown } }).ng;
    const app = ng.getComponent(document.querySelector('app-root')!) as {
      delays: { notificaciones: { http: { post: (u: string, b: unknown) => { subscribe: (o: { next: (r: unknown) => void; error: (e: unknown) => void }) => void } } } };
    };
    return new Promise((ok, mal) =>
      app.delays.notificaciones.http
        .post(`/scheduling/bookings/${bookingId}/delay`, { delayMinutes: 20, message: 'Estoy terminando una urgencia.' })
        .subscribe({ next: ok, error: mal }),
    );
  }, turno);

  const push = page.locator('app-toast').filter({ hasText: 'se demora 20 minutos' });
  await expect(push).toBeVisible({ timeout: 30_000 });
  await push.getByTestId('toast-accion').click();
  await page.waitForURL(/\/my-account\/appointments\?turno=/);
  await expect(push).toHaveCount(0);

  // El chat de Soporte: la demora con su encabezado y su botón. Por el router
  // y no con `goto`: recargar reinicia la memoria de la maqueta.
  await page.evaluate(() => {
    const ng = (globalThis as unknown as { ng: { getComponent: (e: Element) => unknown } }).ng;
    const app = ng.getComponent(document.querySelector('app-root')!) as { router: { navigateByUrl: (u: string) => Promise<boolean> } };
    return app.router.navigateByUrl('/messaging');
  });
  const soporte = page.getByTestId('conversacion').filter({ hasText: 'Soporte' }).first();
  await expect(soporte).toBeVisible({ timeout: 30_000 });
  await soporte.click();
  const ultima = page.getByTestId('mensaje').last();
  await expect(ultima).toContainText('⏳ Aviso de demora');
  await expect(ultima).toContainText('20 minutos');
  await expect(ultima.getByTestId('hilo-ir-cita')).toHaveAttribute('href', `/my-account/appointments?turno=${turno}`);
  for (const v of VIEWPORTS) {
    await page.setViewportSize({ width: v.width, height: v.height });
    await page.screenshot({ path: `${EVIDENCIA}/07-paciente-chat-soporte-demora-${v.nombre}.png` });
  }
  expect(errores.filter((e) => !/favicon|ResizeObserver/.test(e))).toEqual([]);
  await page.close();
});

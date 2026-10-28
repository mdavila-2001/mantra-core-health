/**
 * Redirecciones de «Administración › Plataforma» a «Superadministración», en
 * navegador: cada dirección vieja debe terminar en la nueva **conservando la
 * query y el fragmento**. Con sesión de superadmin.
 *
 *   E2E_CHROMIUM=… E2E_IDENTIFICADOR=… E2E_CLAVE=… node playwright/superadmin-redirecciones.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const CASOS = [
  ['/administration/data-catalog?schema=iam#tabla', '/superadmin/data-catalog?schema=iam#tabla'],
  ['/administration/web-analytics?rango=7d', '/superadmin/web-analytics?rango=7d'],
  ['/administration/qa-lab?x=1', '/superadmin/qa-lab?x=1'],
  ['/administration/operations?x=1', '/superadmin/operations?x=1'],
  ['/administration/qa-lab/plans/abc-123?x=1', '/superadmin/qa-lab/plans/abc-123?x=1'],
  ['/administration/data-catalog/obj-9?x=1', '/superadmin/data-catalog/obj-9?x=1'],
  ['/superadmin', '/superadmin/observability'],
];

const navegador = await chromium.launch(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {});
const page = await (await navegador.newContext({ locale: 'es-BO' })).newPage();
await page.goto(`${BASE}/auth`);
await page.waitForFunction(() => document.querySelector('app-root')?.children.length > 0);
await page.getByTestId('login-identifier').fill(process.env.E2E_IDENTIFICADOR ?? 'admin@alovida.mock');
await page.getByTestId('login-password').fill(process.env.E2E_CLAVE ?? 'S3cret-passw0rd');
await page.getByTestId('login-submit').click();
await page.waitForURL(/\/(dashboard|auth\/organization)/);
if (page.url().includes('/auth/organization')) {
  await page.getByTestId('tenant-opcion').first().click();
  await page.waitForURL(/\/dashboard/);
}

let fallos = 0;
for (const [desde, esperado] of CASOS) {
  // Navegación por el router: la sesión vive en memoria y una recarga la perdería.
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, desde);
  await page.waitForFunction((e) => location.pathname + location.search + location.hash === e, esperado, { timeout: 8000 }).catch(() => undefined);
  const final = await page.evaluate(() => location.pathname + location.search + location.hash);
  const ok = final === esperado;
  if (!ok) fallos += 1;
  console.log(`${ok ? '✓' : '✗'} ${desde}  →  ${final}${ok ? '' : `   (esperado ${esperado})`}`);
}
await navegador.close();
process.exit(fallos ? 1 : 0);

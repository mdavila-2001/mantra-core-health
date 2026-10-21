import { chromium } from 'playwright';

/* H9.S2.M9 · Cuántas lecturas extra dispara una página de «Recientes» con
   sesión (la N+1 que señaló la revisión).

   El simulador responde dentro de la app, así que la pestaña Red no ve nada.
   Se cuenta en la fuente: lo que pidió cada store, a través de la API de
   depuración de Angular (`ng.getComponent`, sólo en desarrollo).
   - `PostActorStateStore.pedidas`: un `GET /community/posts/:id` por tarjeta
     (reacción propia + imágenes).
   - `ProfileSummaryStore.slugsPedidos`: un `GET /community/profiles/by-slug/:slug`
     por autor distinto (el botón Seguir necesita el id). */
const BASE = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.getByTestId('login-identifier').fill('medica@alovida.mock');
await p.getByTestId('login-password').fill('mockup');
await p.getByTestId('login-submit').click();
await p.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60000 });
await p.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded' });
await p.locator('app-public-post-card').first().waitFor({ timeout: 60000 });
await p.waitForFunction(() => document.querySelectorAll('[data-testid="follow-button"][aria-disabled="true"]').length === 0, null, { timeout: 60000 }).catch(() => {});
const cuenta = await p.evaluate(() => {
  const tarjeta = window.ng.getComponent(document.querySelector('app-public-post-card'));
  const boton = window.ng.getComponent(document.querySelector('app-public-post-card app-follow-button'));
  return {
    tarjetas: document.querySelectorAll('app-public-post-card').length,
    lecturasDePublicacion: tarjeta.estadoDelActor.pedidas.size,
    lecturasDeAutorPorSlug: boton.resumenes.slugsPedidos.size,
  };
});
console.log(JSON.stringify(cuenta));
await b.close();

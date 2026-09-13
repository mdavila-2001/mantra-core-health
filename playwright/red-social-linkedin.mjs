/**
 * Evidencia de la red social al estilo LinkedIn (/posts), pedido del 13/09/2026.
 *
 * - Sin título ni ícono de encabezado.
 * - Izquierda: «Doctores en tendencia esta semana» + banners con rótulo.
 * - Centro: con sesión, «Crear publicación»; el feed con la fila
 *   Recomendar · Comentar · Compartir y el hilo con redactor propio.
 * - Derecha: perfil mini SÓLO con sesión; sin sesión el feed ocupa ese ancho.
 * - Mutaciones: recomendar y comentar (UI → request → respuesta → UI).
 * - Sin scroll horizontal en 390 / 768 / 1024 / 1440 / 1920.
 *
 * Uso: `node playwright/red-social-linkedin.mjs [urlBase] [carpetaSalida]`
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4311';
const OUT = process.argv[3] ?? 'docs/frontend/evidence/red-social-linkedin';
mkdirSync(OUT, { recursive: true });

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond) });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

const VIEWPORTS = [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
];

async function esperarFeed(p) {
  await p.locator('app-public-post-card').first().waitFor({ timeout: 120_000 });
  await p.waitForTimeout(700);
}

async function sinScrollHorizontal(p) {
  return p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

function numero(texto) {
  return Number(texto.match(/\d+/)?.[0] ?? 0);
}

const b = await chromium.launch();
const errores = [];
let anchoSinSesion = 0;

/* ── 1 · sin sesión ─────────────────────────────────────────────────── */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(String(e)));
  await p.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await esperarFeed(p);

  ok('sin sesión · no está el título «Lo último de los profesionales»',
    (await p.getByText('Lo último de los profesionales').count()) === 0);
  ok('sin sesión · no está el ícono del encabezado', (await p.locator('.app-page-header__icono').count()) === 0);
  ok('sin sesión · tendencias visibles', await p.getByTestId('feed-tendencias').isVisible());
  ok('sin sesión · hay doctores en tendencia', (await p.getByTestId('feed-tendencia').count()) > 0);
  ok('sin sesión · banner con rótulo «Espacio pagado»', await p.getByText('Espacio pagado').first().isVisible());
  ok('sin sesión · no hay perfil mini', (await p.getByTestId('feed-perfil-mini').count()) === 0);
  ok('sin sesión · no hay barra de crear', (await p.getByTestId('feed-crear').count()) === 0);

  const centro = await p.locator('.red__centro').boundingBox();
  const red = await p.locator('.red').boundingBox();
  anchoSinSesion = centro.width;
  ok('sin sesión · el feed ocupa más del 60 % de la red', centro.width / red.width > 0.6,
    `${Math.round(centro.width)} / ${Math.round(red.width)} px`);
  await p.screenshot({ path: `${OUT}/sin-sesion-1440-arriba.png` });

  await p.getByTestId('post-action-like').first().click();
  await p.waitForURL(/\/auth/, { timeout: 30_000 });
  ok('sin sesión · «Recomendar» manda a entrar con retorno', p.url().includes('returnUrl'));

  for (const [w, h] of VIEWPORTS) {
    await p.setViewportSize({ width: w, height: h });
    await p.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded' });
    await esperarFeed(p);
    ok(`sin sesión · ${w}px sin scroll horizontal`, await sinScrollHorizontal(p));
    await p.screenshot({ path: `${OUT}/sin-sesion-${w}.png` });
  }
  await ctx.close();
}

/* ── 2 · con sesión (médica) ────────────────────────────────────────── */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(String(e)));
  // En la rama mockup las peticiones las contesta un interceptor DENTRO de
  // Angular y no salen al navegador: `page.on('request')` no las ve. La
  // prueba de la mutación es entonces lo que vuelve del backend simulado al
  // releer (el hilo), no el tráfico.

  await p.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await p.getByTestId('login-identifier').fill('medica@alovida.mock');
  await p.getByTestId('login-password').fill('mockup');
  await p.getByTestId('login-submit').click();
  await p.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (p.url().includes('/auth/organization')) {
    await p.getByTestId('tenant-opcion').first().click();
    await p.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }

  // Entrada por URL directa: es el caso en que la sesión llega tarde.
  await p.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded' });
  await esperarFeed(p);
  await p.getByTestId('feed-perfil-mini-nombre').waitFor({ timeout: 30_000 });

  ok('con sesión · perfil mini visible', await p.getByTestId('feed-perfil-mini').isVisible());
  const nombre = (await p.getByTestId('feed-perfil-mini-nombre').textContent())?.trim() ?? '';
  ok('con sesión · el perfil mini dice el nombre de la médica', /Valeria/.test(nombre), nombre);
  await p.getByTestId('feed-crear-abrir').waitFor({ timeout: 30_000 });
  ok('con sesión · barra «Crear publicación»', await p.getByTestId('feed-crear-abrir').isVisible());

  const izq = await p.locator('.red__izquierda').boundingBox();
  const cen = await p.locator('.red__centro').boundingBox();
  const der = await p.locator('.red__derecha').boundingBox();
  ok('con sesión · tres columnas: izquierda < centro < derecha', izq.x < cen.x && cen.x < der.x);
  ok('con sesión · sin sesión el feed es más ancho', anchoSinSesion > cen.width,
    `${Math.round(anchoSinSesion)} > ${Math.round(cen.width)}`);
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/con-sesion-1440-arriba.png` });

  // Recomendar: el contador se mueve y viaja un PUT.
  const tarjeta = p.locator('app-public-post-card').first();
  const antes = numero(await tarjeta.getByTestId('post-reactions').innerText());
  await tarjeta.getByTestId('post-action-like').click();
  await p.waitForTimeout(600);
  const despues = numero(await tarjeta.getByTestId('post-reactions').innerText());
  ok('con sesión · «Recomendar» suma uno', despues === antes + 1, `${antes} → ${despues}`);
  ok('con sesión · el botón queda presionado',
    (await tarjeta.getByTestId('post-action-like').getAttribute('aria-pressed')) === 'true');

  // Comentar: abre el hilo con redactor propio, publica y relee.
  await tarjeta.getByTestId('post-action-comment').click();
  await tarjeta.getByTestId('comment-composer-body').waitFor({ timeout: 20_000 });
  const texto = `Comentario de prueba ${Date.now()}`;
  await tarjeta.getByTestId('comment-composer-body').fill(texto);
  await tarjeta.getByTestId('comment-composer-submit').click();
  await tarjeta.getByText(texto).waitFor({ timeout: 20_000 });
  ok('con sesión · el comentario aparece en el hilo tras releer', await tarjeta.getByText(texto).isVisible());
  ok('con sesión · el contador de comentarios acompaña',
    /3 comentarios/.test(await tarjeta.getByTestId('post-comments').innerText()));

  const hilo = await tarjeta.locator('.comentarios').boundingBox();
  const card = await tarjeta.boundingBox();
  ok('con sesión · el hilo usa el ancho entero de la tarjeta', Math.abs(hilo.width - card.width) <= 4,
    `${Math.round(hilo.width)} vs ${Math.round(card.width)}`);
  const tope = await tarjeta.locator('.comentarios').evaluate((el) => getComputedStyle(el).maxHeight);
  ok('con sesión · el hilo ya no tiene tope de alto', tope === 'none', tope);
  await tarjeta.screenshot({ path: `${OUT}/con-sesion-comentarios.png` });

  // Crear publicación: abre el compositor real.
  await p.getByTestId('feed-crear-abrir').click();
  ok('con sesión · «Crear publicación» abre el compositor', await p.getByTestId('post-composer').isVisible());
  await p.screenshot({ path: `${OUT}/con-sesion-crear-abierto.png` });
  await p.getByTestId('feed-crear-cerrar').click();

  for (const [w, h] of VIEWPORTS) {
    await p.setViewportSize({ width: w, height: h });
    await p.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded' });
    await esperarFeed(p);
    ok(`con sesión · ${w}px sin scroll horizontal`, await sinScrollHorizontal(p));
    await p.screenshot({ path: `${OUT}/con-sesion-${w}.png` });
  }
  await ctx.close();
}

ok('sin errores de página', errores.length === 0, errores.slice(0, 3).join(' | '));
await b.close();

const fallidos = veredictos.filter((v) => !v.cond);
process.stdout.write(`\n${veredictos.length - fallidos.length}/${veredictos.length} verificaciones en verde\n`);
process.exit(fallidos.length === 0 ? 0 : 1);

import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const BASE = process.argv[2], OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });
const res = []; const ok = (n, c, d = '') => { res.push(!!c); console.log(`${c ? '✔' : '✘'} ${n}${d ? ' — ' + d : ''}`); };
const consola = []; let csp = 0;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const nuevo = async (w = 1440, h = 900, colorScheme = 'light') => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => consola.push('pageerror: ' + e));
  p.on('console', (m) => { if (m.type() !== 'error') return; if (/Content Security Policy directive: "script-src/.test(m.text())) { csp++; return; } consola.push(m.text()); });
  return { ctx, p };
};
const entrar = async (p) => {
  await p.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.getByTestId('login-identifier').fill('medica@alovida.mock');
  await p.getByTestId('login-password').fill('mockup');
  await p.getByTestId('login-submit').click();
  await p.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60000 });
  if (p.url().includes('/auth/organization')) { await p.getByTestId('tenant-opcion').first().click(); await p.waitForURL(/\/dashboard/); }
};
const sinScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/* sin sesión */
{
  const { ctx, p } = await nuevo();
  await p.goto(`${BASE}/network`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForURL(/\/auth/, { timeout: 60000 });
  ok('sin sesión /network manda a entrar', p.url().includes('/auth'));
  await p.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded' });
  await p.locator('app-public-nav-rail').waitFor();
  ok('sin sesión el rail no ofrece Mi red', (await p.locator('[data-group="social"]').count()) === 0);
  await ctx.close();
}

const { ctx, p } = await nuevo();
await entrar(p);

/* rail */
await p.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded' });
await p.locator('[data-group="social"]').waitFor({ timeout: 60000 });
const rutas = await p.locator('[data-group="social"] a').evaluateAll((as) => as.map((a) => a.getAttribute('data-route')));
ok('con sesión el rail muestra Mi red social', rutas.join(',') === '/network,/saved,/messaging,/notification-center', rutas.join(','));

/* Mi red */
await p.locator('[data-group="social"] a[data-route="/network"]').click();
await p.waitForURL(/\/network/);
await p.getByTestId('mi-red').waitFor();
const seguidos = p.getByTestId('mi-red-seguido');
await seguidos.first().waitFor({ timeout: 30000 }).catch(() => {});
await p.waitForFunction(() => ![...document.querySelectorAll('[data-testid="mi-red-seguido"]')].some((li) => li.querySelector('.app-skeleton')), null, { timeout: 30000 }).catch(() => {});
const n0 = await seguidos.count();
ok('Mi red · lista a quién sigue', n0 > 0, String(n0));
const nombres = await seguidos.locator('.persona__nombre').allInnerTexts();
ok('Mi red · cada fila tiene nombre real (no «…» ni id)', nombres.every((t) => t.trim().length > 1 && !/^[0-9a-f-]{20,}$/.test(t.trim())), nombres.slice(0, 3).join(' | '));
ok('Mi red · rail marca «Mi red» como página actual', (await p.locator('a[data-route="/network"][aria-current="page"]').count()) === 1);
await p.screenshot({ path: `${OUT}/mi-red-siguiendo-1440.png` });
ok('Mi red · 1440 sin scroll horizontal', await sinScroll(p));

await p.getByRole('tab', { name: 'Sugerencias' }).click();
await p.getByTestId('mi-red-sugerencias').waitFor({ timeout: 30000 });
const sug = p.getByTestId('mi-red-sugerencias').locator('li');
// una sugerencia que todavía no sigo
let objetivo = null, nombreObj = '';
for (let i = 0; i < (await sug.count()); i++) {
  const btn = sug.nth(i).getByTestId('follow-button');
  if ((await btn.count()) && /^Seguir/.test((await btn.innerText()).trim())) { objetivo = btn; nombreObj = (await sug.nth(i).locator('.persona__nombre').innerText()).trim(); break; }
}
ok('Sugerencias · hay alguien para seguir', objetivo !== null, nombreObj);
await p.screenshot({ path: `${OUT}/mi-red-sugerencias-1440.png` });
if (objetivo) {
  await objetivo.click();
  await p.waitForFunction(() => true);
  await objetivo.filter({ hasText: /Siguiendo/ }).waitFor({ timeout: 30000 }).catch(() => {});
  ok('Seguir cambia el botón a «Siguiendo»', /Siguiendo/.test(await objetivo.innerText()));
  await p.getByRole('tab', { name: /Siguiendo/ }).click();
  await p.waitForFunction((n) => [...document.querySelectorAll('[data-testid="mi-red-seguido"] .persona__nombre')].some((e) => e.textContent.trim() === n), nombreObj, { timeout: 30000 }).catch(() => {});
  ok('la persona aparece en Siguiendo sin recargar', (await seguidos.filter({ hasText: nombreObj }).count()) === 1);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForFunction((n) => [...document.querySelectorAll('[data-testid="mi-red-seguido"] .persona__nombre')].some((e) => e.textContent.trim() === n), nombreObj, { timeout: 60000 }).catch(() => {});
  ok('tras recargar sigue en Siguiendo (persistió)', (await seguidos.filter({ hasText: nombreObj }).count()) === 1);
  const fila = seguidos.filter({ hasText: nombreObj });
  await fila.getByTestId('follow-button').click();
  await p.waitForFunction((n) => ![...document.querySelectorAll('[data-testid="mi-red-seguido"] .persona__nombre')].some((e) => e.textContent.trim() === n), nombreObj, { timeout: 30000 }).catch(() => {});
  ok('Dejar de seguir lo saca de la lista', (await seguidos.filter({ hasText: nombreObj }).count()) === 0);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await seguidos.first().waitFor({ timeout: 60000 });
  await p.waitForFunction(() => ![...document.querySelectorAll('[data-testid="mi-red-seguido"]')].some((li) => li.querySelector('.app-skeleton')), null, { timeout: 30000 }).catch(() => {});
  ok('dejar de seguir persistió tras recargar', (await seguidos.filter({ hasText: nombreObj }).count()) === 0);
}

/* Guardados */
await p.goto(`${BASE}/saved`, { waitUntil: 'domcontentloaded' });
await p.getByTestId('guardados').waitFor({ timeout: 60000 });
await p.waitForFunction(() => !document.querySelector('[data-testid="guardados"] [aria-busy="true"]'), null, { timeout: 30000 }).catch(() => {});
const g0 = await p.locator('[data-testid="guardados"] app-public-post-card').count();
await p.screenshot({ path: `${OUT}/guardados-antes-1440.png` });
await p.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded' });
const card = p.locator('app-public-post-card').first();
await card.waitFor({ timeout: 60000 });
const idTarjeta = await card.locator('[data-testid^="post-card-"]').first().getAttribute('data-testid');
const save = card.getByTestId('post-action-save');
const yaGuardada = (await save.getAttribute('aria-pressed')) === 'true';
if (!yaGuardada) {
  await save.click();
  await p.waitForFunction(() => document.querySelector('app-public-post-card [data-testid="post-action-save"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 30000 }).catch(() => {});
  ok('Guardar queda presionado', (await save.getAttribute('aria-pressed')) === 'true');
}
await p.locator('[data-group="social"] a[data-route="/saved"]').click();
await p.waitForURL(/\/saved/);
await p.locator('[data-testid="guardados"] app-public-post-card').first().waitFor({ timeout: 60000 });
await p.waitForFunction(() => !document.querySelector('[data-testid="guardados"] [aria-busy="true"]'), null, { timeout: 30000 }).catch(() => {});
const g1 = await p.locator('[data-testid="guardados"] app-public-post-card').count();
ok('Guardados · la publicación aparece', g1 >= 1 && (yaGuardada || g1 === g0 + 1), `${g0} → ${g1}`);
ok('Guardados · es la misma publicación', (await p.locator(`[data-testid="guardados"] [data-testid="${idTarjeta}"]`).count()) === 1, idTarjeta);
await p.reload({ waitUntil: 'domcontentloaded' });
await p.locator('[data-testid="guardados"] app-public-post-card').first().waitFor({ timeout: 60000 });
ok('Guardados · tras recargar sigue (persistió)', (await p.locator('[data-testid="guardados"] app-public-post-card').count()) === g1);
await p.screenshot({ path: `${OUT}/guardados-1440.png`, fullPage: false });
const primeraG = p.locator('[data-testid="guardados"] app-public-post-card').first();
await primeraG.getByTestId('post-action-save').click();
await p.waitForFunction((n) => document.querySelectorAll('[data-testid="guardados"] app-public-post-card').length === n - 1, g1, { timeout: 30000 }).catch(() => {});
ok('y sale de Guardados sin recargar', (await p.locator('[data-testid="guardados"] app-public-post-card').count()) === g1 - 1);
await p.reload({ waitUntil: 'domcontentloaded' });
await p.getByTestId('guardados').waitFor();
await p.waitForFunction(() => !document.querySelector('[data-testid="guardados"] [aria-busy="true"]'), null, { timeout: 30000 }).catch(() => {});
ok('quitar también persistió tras recargar', (await p.locator('[data-testid="guardados"] app-public-post-card').count()) === g1 - 1);
await ctx.close();

/* 390 y oscuro */
for (const [w, tema] of [[390, 'light'], [390, 'dark'], [1440, 'dark'], [768, 'light']]) {
  const { ctx: c2, p: p2 } = await nuevo(w, 860, tema);
  await entrar(p2);
  for (const ruta of ['network', 'saved']) {
    await p2.goto(`${BASE}/${ruta}`, { waitUntil: 'domcontentloaded' });
    await p2.getByTestId(ruta === 'network' ? 'mi-red' : 'guardados').waitFor({ timeout: 60000 });
    await p2.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && !document.querySelector('main .app-skeleton'), null, { timeout: 30000 }).catch(() => {});
    if (tema === 'dark') {
      await p2.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      // Las superficies tienen transición de fondo: la foto, cuando terminen.
      await p2.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 10000 }).catch(() => {});
    }
    ok(`${ruta} · ${w} ${tema} sin scroll horizontal`, await sinScroll(p2));
    await p2.screenshot({ path: `${OUT}/${ruta}-${w}-${tema}.png` });
  }
  await c2.close();
}

console.log(`(CSP inline-script aparte: ${csp})`);
ok('sin errores de página ni de consola (salvo CSP)', consola.length === 0, consola.slice(0, 3).join(' || '));
await b.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} en verde`);

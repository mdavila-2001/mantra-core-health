import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4311';
const OUT = process.argv[3] ?? 'evidencia-h5';
mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, d = '') => { res.push(!!c); console.log(`${c ? '✔' : '✘'} ${n}${d ? ' — ' + d : ''}`); };
const consola = [];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => consola.push('pageerror: ' + e));
let csp = 0; let urlCsp = [];
p.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (/Content Security Policy directive: "script-src/.test(m.text())) { csp += 1; urlCsp.push(p.url()); return; }
  consola.push('console.error: ' + m.text());
});

await p.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.getByTestId('login-identifier').fill('medica@alovida.mock');
await p.getByTestId('login-password').fill('mockup');
await p.getByTestId('login-submit').click();
await p.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60000 });
if (p.url().includes('/auth/organization')) {
  await p.getByTestId('tenant-opcion').first().click();
  await p.waitForURL(/\/dashboard/, { timeout: 60000 });
}

// /feed ya no es una pantalla
await p.goto(`${BASE}/feed`, { waitUntil: 'domcontentloaded' });
await p.waitForURL(/\/posts/, { timeout: 30000 });
ok('/feed redirige a /posts', p.url().includes('/posts'), p.url());

await p.locator('app-public-post-card').first().waitFor({ timeout: 120000 });
await p.waitForTimeout(1500);
const ajena = async () => {
  const n = await p.locator('app-public-post-card').count();
  for (let i = 0; i < n; i++) {
    const c = p.locator('app-public-post-card').nth(i);
    if (!/Valeria/.test(await c.locator('.publicacion__autor').first().innerText())) return i;
  }
  return 0;
};
const idx = await ajena();
const t = p.locator('app-public-post-card').nth(idx);
await t.scrollIntoViewIfNeeded();
await p.screenshot({ path: `${OUT}/01-feed-1440.png` });

const likeLabel = () => t.getByTestId('post-action-like-label').innerText();
ok('el botón arranca en «Recomendar»', (await likeLabel()).trim() === 'Recomendar', await likeLabel());

// Selector por chevron → Celebro
await t.getByTestId('reaction-picker-toggle').click();
ok('el selector muestra 5 reacciones', (await p.locator('[data-testid^="reaction-"]:not([data-testid="reaction-picker"]):not([data-testid="reaction-picker-toggle"])').count()) === 5);
await p.screenshot({ path: `${OUT}/02-selector.png` });
await t.getByTestId('reaction-CELEBRATE').click();
await p.waitForTimeout(500);
ok('elegir «Celebro» cambia el botón', (await likeLabel()).trim() === 'Celebro', await likeLabel());

// Recargar y ver que persiste
await p.reload({ waitUntil: 'domcontentloaded' });
await p.locator('app-public-post-card').first().waitFor({ timeout: 120000 });
await p.waitForTimeout(2500);
const t2 = p.locator('app-public-post-card').nth(idx);
ok('tras recargar la reacción propia sigue siendo «Celebro»', (await t2.getByTestId('post-action-like-label').innerText()).trim() === 'Celebro', (await t2.getByTestId('post-action-like-label').innerText()).trim());

// Quitar con toque simple
await t2.getByTestId('post-action-like').click();
await p.waitForTimeout(500);
ok('tocar el botón quita la reacción', (await t2.getByTestId('post-action-like-label').innerText()).trim() === 'Recomendar');

// Guardar
await t2.getByTestId('post-action-save').click();
await p.waitForTimeout(400);
ok('Guardar pasa a «Guardada»', /Guardada/.test(await t2.getByTestId('post-action-save').innerText()));

// Seguir: la médica ya sigue a ese autor (semilla), así que el botón alterna
const seg = t2.getByTestId('follow-button');
await p.waitForTimeout(1500);
const antes = (await seg.innerText()).trim();
await seg.click();
await p.waitForTimeout(600);
const despues = (await seg.innerText()).trim();
ok('Seguir/Siguiendo alterna con un toque', antes !== despues, `${antes} → ${despues}`);
await seg.click();
await p.waitForTimeout(600);
ok('y vuelve con otro toque', (await seg.innerText()).trim() === antes);
await seg.click();
await p.waitForTimeout(600);
const ultimo = (await seg.innerText()).trim();

// Persistencia tras recargar: guardada + siguiendo
await p.reload({ waitUntil: 'domcontentloaded' });
await p.locator('app-public-post-card').first().waitFor({ timeout: 120000 });
await p.waitForTimeout(3000);
const t3 = p.locator('app-public-post-card').nth(idx);
ok('tras recargar sigue «Guardada»', /Guardada/.test(await t3.getByTestId('post-action-save').innerText()));
ok('tras recargar el follow queda como se dejó', (await t3.getByTestId('follow-button').innerText()).trim() === ultimo, `${ultimo}`);

// Comentar y responder en línea
await t3.getByTestId('post-action-comment').click();
await t3.getByTestId('comment-composer-body').waitFor({ timeout: 20000 });
const texto = `Comentario ${Date.now()}`;
await t3.getByTestId('comment-composer-body').fill(texto);
await t3.getByTestId('comment-composer-submit').click();
await t3.getByText(texto).waitFor({ timeout: 20000 });
ok('el comentario aparece', true);
const urlAntes = p.url();
await t3.getByTestId('comment-reply').first().click();
await t3.getByTestId('reply-composer-body').waitFor({ timeout: 10000 });
ok('«Responder» abre el redactor en línea sin cambiar de URL', p.url() === urlAntes);
const resp = `Respuesta ${Date.now()}`;
await t3.getByTestId('reply-composer-body').fill(resp);
await t3.getByTestId('reply-composer-submit').click();
await t3.getByText(resp).waitFor({ timeout: 20000 });
ok('la respuesta aparece bajo el comentario', true);
await t3.screenshot({ path: `${OUT}/03-hilo-respuesta.png` });

console.log(`(CSP inline-script aparte: ${csp} en ${[...new Set(urlCsp)].join(', ')})`);
ok('sin errores de página ni de consola (salvo CSP)', consola.length === 0, consola.slice(0, 3).join(' | '));
await b.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} en verde`);
process.exit(res.every(Boolean) ? 0 : 1);

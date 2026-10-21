import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const BASE = process.argv[2], OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });
const res = []; const ok = (n, c, d = '') => { res.push(!!c); console.log(`${c ? '✔' : '✘'} ${n}${d ? ' — ' + d : ''}`); };
const consola = []; let csp = 0;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const nuevo = async (w = 1440, h = 900) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => consola.push('pageerror: ' + e));
  p.on('console', (m) => { if (m.type() !== 'error') return; if (/Content Security Policy directive: "script-src/.test(m.text())) { csp++; return; } consola.push(m.text()); });
  return { ctx, p };
};
const sinScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/* ── sin sesión ── */
{
  const { ctx, p } = await nuevo();
  await p.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.locator('app-public-post-card').first().waitFor({ timeout: 120000 });
  await p.waitForTimeout(800);
  ok('sin sesión · no hay columna de perfil', (await p.locator('.red__izquierda').count()) === 0);
  ok('sin sesión · no hay «Crear publicación» ni pestañas', (await p.getByTestId('feed-crear').count()) === 0 && (await p.getByTestId('feed-modo').count()) === 0);
  ok('sin sesión · sugerencias a la derecha', await p.getByTestId('feed-tendencias').isVisible());
  const c = await p.locator('.red__centro').boundingBox(); const d = await p.locator('.red__derecha').boundingBox(); const r = await p.locator('.red').boundingBox();
  ok('sin sesión · feed a la izquierda de las sugerencias y más del 60 % del ancho', c.x < d.x && c.width / r.width > 0.6, `${Math.round(c.width)}/${Math.round(r.width)}`);
  await p.screenshot({ path: `${OUT}/sin-sesion-1440.png` });
  const primero = p.locator('app-public-post-card').first();
  ok('sin sesión · «Seguir» manda a entrar con retorno', await (async () => { await primero.getByTestId('follow-button').click(); await p.waitForURL(/\/auth/, { timeout: 20000 }); return p.url().includes('returnUrl'); })());
  await ctx.close();
}

/* ── con sesión ── */
const { ctx, p } = await nuevo();
await p.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.getByTestId('login-identifier').fill('medica@alovida.mock');
await p.getByTestId('login-password').fill('mockup');
await p.getByTestId('login-submit').click();
await p.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60000 });
if (p.url().includes('/auth/organization')) { await p.getByTestId('tenant-opcion').first().click(); await p.waitForURL(/\/dashboard/); }
await p.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded' });
await p.locator('app-public-post-card').first().waitFor({ timeout: 120000 });
await p.getByTestId('feed-perfil-mini-nombre').waitFor({ timeout: 30000 });
await p.waitForTimeout(2500);

const izq = await p.locator('.red__izquierda').boundingBox(), cen = await p.locator('.red__centro').boundingBox(), der = await p.locator('.red__derecha').boundingBox();
ok('con sesión · izquierda < centro < derecha', izq.x < cen.x && cen.x < der.x, `${Math.round(izq.x)} < ${Math.round(cen.x)} < ${Math.round(der.x)}`);
ok('con sesión · el perfil está a la izquierda', await p.locator('.red__izquierda').getByTestId('feed-perfil-mini').isVisible());
ok('con sesión · las sugerencias están a la derecha', await p.locator('.red__derecha').getByTestId('feed-tendencias').isVisible());
ok('el centro es la columna más ancha', cen.width > izq.width && cen.width > der.width, `${Math.round(izq.width)} | ${Math.round(cen.width)} | ${Math.round(der.width)}`);
ok('perfil mini · visitas a su perfil', /\d+/.test(await p.getByTestId('feed-perfil-mini-visitas').innerText()));
ok('perfil mini · apariciones en búsquedas', /\d+/.test(await p.getByTestId('feed-perfil-mini-apariciones').innerText()));
const sigAntes = Number((await p.getByTestId('feed-perfil-mini-siguiendo').innerText()).match(/\d+/)[0]);
ok('perfil mini · a cuántos sigue', sigAntes >= 0, String(sigAntes));
ok('la lista de entrada es «Recientes»', /Recientes/.test(await p.locator('[data-testid="feed-modo"] [aria-pressed="true"], [data-testid="feed-modo"] [aria-checked="true"]').first().innerText().catch(() => '')));
await p.screenshot({ path: `${OUT}/con-sesion-1440.png` });

// sugerencias con Seguir
const filas = p.getByTestId('feed-tendencia');
ok('hay sugerencias con botón Seguir', (await filas.locator('[data-testid="follow-button"]').count()) > 0);
const botonSug = filas.locator('[data-testid="follow-button"]').first();
const antesSug = (await botonSug.innerText()).trim();
await botonSug.click(); await p.waitForTimeout(700);
const despuesSug = (await botonSug.innerText()).trim();
ok('Seguir en sugerencias alterna', antesSug !== despuesSug, `${antesSug} → ${despuesSug}`);
const sigDespues = Number((await p.getByTestId('feed-perfil-mini-siguiendo').innerText()).match(/\d+/)[0]);
ok('el contador «Siguiendo» del perfil se mueve con el gesto', sigDespues !== sigAntes, `${sigAntes} → ${sigDespues}`);
await botonSug.click(); await p.waitForTimeout(500); // dejar como estaba

// pestaña Siguiendo
await p.getByTestId('feed-modo').getByRole('radio', { name: 'Siguiendo' }).click();
await p.waitForURL(/feed=siguiendo/, { timeout: 10000 });
await p.waitForTimeout(2500);
const n = await p.locator('app-public-post-card').count();
ok('«Siguiendo» muestra publicaciones de a quienes sigue', n > 0, `${n} tarjetas`);
const autores = await p.locator('app-public-post-card .publicacion__autor').allInnerTexts();
ok('los autores tienen nombre (no «Perfil 6490…» ni «…»)', autores.length > 0 && autores.every((t) => !/^Perfil |^…$/.test(t.trim()) && t.trim().length > 3), autores.slice(0, 3).join(' | '));
const iconosVisibilidad = await p.locator('app-public-post-card [data-testid^="post-visibility"], app-public-post-card .publicacion__globo').count();
ok('Siguiendo no inventa el ícono de visibilidad', iconosVisibilidad === 0, String(iconosVisibilidad));
await p.screenshot({ path: `${OUT}/siguiendo-1440.png` });

// Recargar muestreando el DOM: «Recientes» no puede aparecer ni un instante (era un parpadeo real).
await p.addInitScript(() => {
  window.__modos = [];
  const tomar = () => {
    const marcado = [...document.querySelectorAll('[data-testid="feed-modo"] [aria-pressed="true"], [data-testid="feed-modo"] [aria-checked="true"]')].map((e) => e.textContent.trim());
    const hay = document.querySelectorAll('app-public-post-card').length;
    window.__modos.push(`${marcado.join('+') || '-'}:${hay > 0 ? 'tarjetas' : 'sin'}`);
  };
  // Un observador ve CADA cambio del DOM: un intervalo se perdía los parpadeos de un cuadro.
  new MutationObserver(tomar).observe(document, { subtree: true, childList: true, attributes: true });
});
await p.reload({ waitUntil: 'domcontentloaded' });
// La lista se asienta cuando el perfil propio resolvió: se espera por condición, no se lee al instante.
await p.waitForFunction(() => document.querySelectorAll('app-public-post-card').length > 0 && [...document.querySelectorAll('[data-testid="feed-modo"] [aria-pressed="true"], [data-testid="feed-modo"] [aria-checked="true"]')].some((e) => /Siguiendo/.test(e.textContent)), null, { timeout: 60000 }).catch(() => {});
ok('recargar en ?feed=siguiendo conserva la lista', p.url().includes('feed=siguiendo') && (await p.locator('app-public-post-card').count()) > 0);
const modos = await p.evaluate(() => [...new Set(window.__modos)]);
ok('y al recargar nunca pinta tarjetas ajenas a «Siguiendo» (sin selector, o con «Recientes») antes de que llegue la lista', !modos.some((m) => /Recientes/.test(m) || m === '-:tarjetas'), modos.join(' | '));

// volver a Recientes
await p.getByTestId('feed-modo').getByRole('radio', { name: 'Recientes' }).click();
await p.waitForTimeout(800);
ok('volver a «Recientes» quita el parámetro', !p.url().includes('feed='));

// anchos y temas
for (const [w, h] of [[390, 844], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]]) {
  await p.setViewportSize({ width: w, height: h });
  await p.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded' });
  await p.locator('app-public-post-card').first().waitFor({ timeout: 120000 });
  await p.waitForTimeout(1200);
  ok(`${w}px · sin scroll horizontal`, await sinScroll(p));
  await p.screenshot({ path: `${OUT}/con-sesion-${w}.png` });
}
await p.setViewportSize({ width: 1440, height: 900 });
await p.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded' });
await p.locator('app-public-post-card').first().waitFor({ timeout: 120000 });
await p.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/con-sesion-1440-oscuro.png` });

console.log(`(CSP inline-script aparte: ${csp})`);
ok('sin errores de página ni de consola (salvo CSP)', consola.length === 0, consola.slice(0, 3).join(' | '));
await b.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} en verde`);
process.exit(res.every(Boolean) ? 0 : 1);

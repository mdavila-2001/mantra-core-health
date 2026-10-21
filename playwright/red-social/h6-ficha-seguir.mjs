import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

/* H6.S1.M3 · «Seguir» en la ficha pública: sin sesión manda a entrar con
   retorno; con sesión alterna, persiste tras recargar y se refleja en Mi red;
   en la ficha propia no se dibuja. */
const BASE = process.argv[2], OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });
const res = []; const ok = (n, c, d = '') => { res.push(!!c); console.log(`${c ? '✔' : '✘'} ${n}${d ? ' — ' + d : ''}`); };
const consola = []; let csp = 0; let tunel = 0;
/** Hosts que fallaron por red. El sandbox no llega a los mosaicos del mapa: eso es ENTORNO y se cuenta aparte. */
const hostsFallidos = new Set();
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const nuevo = async () => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => consola.push('pageerror: ' + e));
  p.on('console', (m) => { if (m.type() !== 'error') return; if (/Content Security Policy directive: "script-src/.test(m.text())) { csp++; return; } if (/ERR_TUNNEL_CONNECTION_FAILED/.test(m.text())) { tunel++; return; } consola.push(m.text()); });
  p.on('requestfailed', (r) => { if (/ERR_TUNNEL_CONNECTION_FAILED/.test(r.failure()?.errorText ?? '')) hostsFallidos.add(new URL(r.url()).host); });
  return { ctx, p };
};
/** La ficha de la primera sugerencia de Inicio: los nombres del simulador se generan. */
const fichaDeSugerencia = async (p) => {
  await p.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const enlace = p.getByTestId('feed-tendencia').locator('a[href^="/p/"]').first();
  await enlace.waitFor({ timeout: 60000 });
  return enlace.getAttribute('href');
};
let FICHA = '';
const boton = (p) => p.locator('app-public-profile-card').getByTestId('follow-button');
/**
 * La ficha llega renderizada del servidor y se rehace al hidratar: un toque en
 * los primeros segundos se pierde (hallazgo registrado en el REPORTE, previo a
 * este trabajo). Acá se espera a que el botón esté vivo antes de tocarlo.
 */
const hidratada = (p) =>
  p.waitForFunction(() => {
    try {
      return !!window.ng.getComponent(document.querySelector('app-public-profile-card app-follow-button'));
    } catch {
      return false;
    }
  }, null, { timeout: 60000 });

{
  const { ctx, p } = await nuevo();
  FICHA = await fichaDeSugerencia(p);
  await p.goto(`${BASE}${FICHA}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await boton(p).waitFor({ timeout: 60000 });
  await hidratada(p);
  await boton(p).click();
  await p.waitForURL(/\/auth/, { timeout: 30000 });
  ok('sin sesión «Seguir» manda a entrar con retorno a la ficha', p.url().includes('returnUrl') && decodeURIComponent(p.url()).includes(FICHA));
  await ctx.close();
}

const { ctx, p } = await nuevo();
await p.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.getByTestId('login-identifier').fill('medica@alovida.mock');
await p.getByTestId('login-password').fill('mockup');
await p.getByTestId('login-submit').click();
await p.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60000 });
if (p.url().includes('/auth/organization')) { await p.getByTestId('tenant-opcion').first().click(); await p.waitForURL(/\/dashboard/); }

await p.goto(`${BASE}${FICHA}`, { waitUntil: 'domcontentloaded' });
await boton(p).waitFor({ timeout: 60000 });
await hidratada(p);
const nombre = (await p.locator('app-public-profile-card h1').first().innerText()).trim();
const antes = (await boton(p).innerText()).trim();
ok('con sesión la ficha ofrece «Seguir»', /^Seguir/.test(antes), antes);
await p.screenshot({ path: `${OUT}/ficha-antes.png` });
await boton(p).click();
await p.waitForFunction(() => /Siguiendo/.test(document.querySelector('app-public-profile-card [data-testid="follow-button"]')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => {});
ok('al tocarlo pasa a «Siguiendo»', /Siguiendo/.test(await boton(p).innerText()));
await p.reload({ waitUntil: 'domcontentloaded' });
await boton(p).waitFor({ timeout: 60000 });
await p.waitForFunction(() => /Siguiendo/.test(document.querySelector('app-public-profile-card [data-testid="follow-button"]')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => {});
ok('tras recargar sigue «Siguiendo» (persistió)', /Siguiendo/.test(await boton(p).innerText()));
await p.screenshot({ path: `${OUT}/ficha-siguiendo.png` });

await p.goto(`${BASE}/network`, { waitUntil: 'domcontentloaded' });
await p.getByTestId('mi-red-seguido').first().waitFor({ timeout: 60000 });
await p.waitForFunction((n) => [...document.querySelectorAll('[data-testid="mi-red-seguido"] .persona__nombre')].some((e) => e.textContent.trim() === n), nombre, { timeout: 30000 }).catch(() => {});
ok('y aparece en Mi red', (await p.getByTestId('mi-red-seguido').filter({ hasText: nombre }).count()) === 1, nombre);

// dejar como estaba
await p.goto(`${BASE}${FICHA}`, { waitUntil: 'domcontentloaded' });
await boton(p).waitFor({ timeout: 60000 });
await hidratada(p);
await p.waitForFunction(() => /Siguiendo/.test(document.querySelector('app-public-profile-card [data-testid="follow-button"]')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => {});
await boton(p).click();
await p.waitForFunction(() => /^\s*Seguir/.test(document.querySelector('app-public-profile-card [data-testid="follow-button"]')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => {});
ok('volver a tocarlo deja de seguir', /^Seguir/.test((await boton(p).innerText()).trim()));

await p.goto(`${BASE}/p/valeria-rojas`, { waitUntil: 'domcontentloaded' });
await p.locator('app-public-profile-card').waitFor({ timeout: 60000 });
await p.locator('app-public-profile-card h1').first().waitFor();
// Del servidor llega sin sesión (con botón); la decisión es del cliente hidratado.
await p.waitForFunction(() => { try { return !!window.ng.getComponent(document.querySelector('app-public-profile-card')); } catch { return false; } }, null, { timeout: 60000 });
await p.waitForFunction(() => !document.querySelector('app-public-profile-card [data-testid="follow-button"]'), null, { timeout: 30000 }).catch(() => {});
ok('en la ficha propia no se dibuja', (await boton(p).count()) === 0);
await ctx.close();

console.log(`(CSP inline-script aparte: ${csp} · túnel del sandbox aparte: ${tunel}, hosts: ${[...hostsFallidos].join(', ') || 'ninguno'})`);
ok('lo único que no carga por red son los mosaicos del mapa (entorno)', [...hostsFallidos].every((h) => h === 'tile.openstreetmap.org'), [...hostsFallidos].join(', '));
ok('sin errores de página ni de consola (salvo CSP)', consola.length === 0, consola.slice(0, 3).join(' || '));
await b.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} en verde`);

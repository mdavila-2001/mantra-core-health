// Pestaña con la construcción A (paciente en /dashboard) → redespliegue a B →
// el paciente abre «Mis citas» (ruta perezosa que todavía no había bajado).
const { chromium } = require('playwright'); const { spawn } = require('node:child_process');
const fs = require('node:fs'); const S = __dirname; const PORT = 4302, BASE = `http://127.0.0.1:${PORT}`;
const A = JSON.parse(fs.readFileSync(`${S}/A/build-version.json`, 'utf8'));
const HUELLA_A = `${A.commit}|${A.builtAt}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function servir(dir) { const p = spawn('node', [`${S}/serve.mjs`, dir, String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] }); await new Promise((r) => p.stdout.once('data', r)); return p; }
const parar = (p) => new Promise((ok) => { p.once('exit', ok); p.kill(); });
async function escenario(nombre, { sinRecuperacion = false, sinVigilante = false, destino = '/my-account/appointments', antes = null, nuevo = `${S}/B`, sinVisibilidad = false }) {
  let server = await servir(`${S}/A`);
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  if (sinVigilante) await page.route('**/build-version.json', (r) => r.abort());
  const r = { nombre, chunks404: [], errores: [], cargasCompletas: [] };
  let redesplegado = false;
  page.on('response', (res) => { if (res.status() === 404 && /chunk-.*\.js/.test(res.url())) r.chunks404.push(res.url().split('/').pop()); });
  page.on('console', (m) => { if (redesplegado && m.type() === 'error' && !/Failed to load resource/.test(m.text())) r.errores.push(m.text().slice(0, 160)); });
  page.on('request', (q) => { if (redesplegado && q.isNavigationRequest() && q.frame() === page.mainFrame()) r.cargasCompletas.push(new URL(q.url()).pathname); });

  await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('login-identifier').fill('7654321'); await page.getByTestId('login-password').fill('demo');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/dashboard/, { waitUntil: 'commit' }); await wait(4000);
  if (antes) { await page.goto(`${BASE}${antes}`, { waitUntil: 'domcontentloaded' }); await wait(4000); }
  if (sinRecuperacion) await page.evaluate((h) => sessionStorage.setItem('alovida.recarga-por-version', h), HUELLA_A);

  // ── Redespliegue con la pestaña abierta ──
  await parar(server); server = await servir(nuevo); redesplegado = true;
  // La persona vuelve a la pestaña (lo que dispara la consulta del vigilante).
  if (!sinVisibilidad) { await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await wait(1500); }

  await page.locator(`a[href="${destino}"]`).first().click();
  await wait(8000);
  r.urlFinal = new URL(page.url()).pathname;
  r.titulo = await page.title();
  r.pantallaDeError = await page.getByText('Algo salió mal').isVisible().catch(() => false);
  r.huellaGuardada = await page.evaluate(() => sessionStorage.getItem('alovida.recarga-por-version'));
  r.sesionIniciada = await page.getByTestId('header-cuenta').isVisible().catch(() => false);
  r.mainEnUso = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter((x) => /main/.test(x)).join(','));
  await page.screenshot({ path: `${S}/${nombre}.png` });
  await browser.close(); await parar(server);
  return r;
}
(async () => {
  const out = [];
  out.push(await escenario('control-sin-arreglo', { sinRecuperacion: true, sinVigilante: true }));
  out.push(await escenario('capa1-recuperacion', { sinVigilante: true }));
  out.push(await escenario('capa2-vigilante', {}));
  // @defer: el panel es parte del paquete inicial, sus bloques no. Se entra por
  // /my-account (carga completa con A) y tras el redespliegue se abre el panel.
  out.push(await escenario('defer-control-sin-arreglo', { sinRecuperacion: true, sinVigilante: true, antes: '/my-account', destino: '/dashboard' }));
  // Sin aviso previo del vigilante: el @defer falla y la recuperación confirma la versión nueva y recarga.
  out.push(await escenario('defer-capa1-recuperacion', { sinVisibilidad: true, antes: '/my-account', destino: '/dashboard' }));
  // Mismo fallo, pero el servidor no confirma otra construcción (como un corte de red): NO recarga.
  out.push(await escenario('defer-sin-confirmacion-no-recarga', { sinVigilante: true, antes: '/my-account', destino: '/dashboard' }));
  // Guarda anti-bucle: el trozo falta DE VERDAD en la construcción servida.
  const roto = `${S}/A-roto`;
  require('node:child_process').execSync(`rm -rf ${roto} && cp -al ${S}/A ${roto}`);
  for (const c of out[0].chunks404) fs.rmSync(`${roto}/${c}`, { force: true });
  out.push(await escenario('guarda-trozo-roto-de-verdad', { sinVigilante: true, nuevo: roto }));
  console.log(JSON.stringify({ A: HUELLA_A, out }, null, 2));
})();

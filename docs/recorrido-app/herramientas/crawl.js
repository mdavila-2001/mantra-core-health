// Recorrido total de AloVida contra el simulador (modo demo, datos sintéticos).
// Uso: node crawl.js <cuenta|anon> [maxExtra]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:4200';
const cuenta = process.argv[2] || 'anon';
const MAX_EXTRA = Number(process.argv[3] || 80);
const OUT = path.join(__dirname, process.env.MOVIL ? 'out-movil' : 'out', cuenta.replace(/@.*/, ''));
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

const rutas = JSON.parse(fs.readFileSync(path.join(__dirname, 'routes-unique.json'), 'utf8'));
const estaticas = rutas.map((r) => r.path).filter((p) => !p.includes(':') && !p.includes('**'));
const patrones = rutas
  .map((r) => r.path)
  .filter((p) => p.includes(':'))
  .map((p) => ({ p, re: new RegExp('^' + p.replace(/:[^/]+/g, '[^/]+') + '$') }));

const ERROR_TXT = /(No encontramos lo que busca|Página no encontrada|Algo salió mal|No pudimos|no está implementado|sin manejador|Error inesperado|Ocurrió un error)/i;

function patronDe(p) {
  if (estaticas.includes(p)) return p;
  const m = patrones.find((x) => x.re.test(p));
  return m ? m.p : null;
}

async function estable(page) {
  const t0 = Date.now();
  await page.waitForTimeout(250);
  while (Date.now() - t0 < 7000) {
    const cargando = await page
      .evaluate(() => {
        const sk = document.querySelectorAll('app-skeleton, .skeleton, [aria-busy="true"]').length;
        const st = [...document.querySelectorAll('[role="status"]')].some((e) => /cargando|un momento/i.test(e.textContent || ''));
        return sk > 0 || st;
      })
      .catch(() => false);
    if (!cargando) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(350);
}

async function irA(page, ruta) {
  await page.evaluate((d) => {
    window.history.pushState({}, '', d);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, ruta);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: process.env.MOVIL ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: 'es-BO', timezoneId: 'America/La_Paz' });
  const page = await ctx.newPage();
  let consola = [], excepciones = [], huecos = [];
  page.on('console', (m) => {
    const t = m.text();
    const g = /\[mock\] sin manejador para (\S+ \S+)/.exec(t);
    if (g) huecos.push(g[1]);
    else if (m.type() === 'error') consola.push(t.slice(0, 300));
  });
  page.on('pageerror', (e) => excepciones.push(String(e.message).slice(0, 300)));

  await page.goto(BASE + '/posts');
  await page.waitForFunction(() => (document.querySelector('app-root')?.children.length ?? 0) > 0, null, { timeout: 60000 });
  await estable(page);

  if (cuenta !== 'anon') {
    await page.goto(BASE + '/auth');
    await page.getByTestId('login-identifier').waitFor({ timeout: 60000 });
    await page.getByTestId('login-identifier').fill(cuenta);
    await page.getByTestId('login-password').fill('mock');
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/(dashboard|auth\/organization|onboarding|home|feed)/, { timeout: 60000 });
    if (page.url().includes('/auth/organization')) {
      await page.getByTestId('tenant-opcion').first().click();
      await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60000 });
    }
    await estable(page);
  }

  const filas = [];
  const visitadas = new Set();
  const patronesVistos = new Set();
  let n = 0;

  async function visitar(ruta, origen) {
    if (visitadas.has(ruta)) return;
    visitadas.add(ruta);
    const pat = patronDe(ruta);
    if (pat) patronesVistos.add(pat);
    consola = []; excepciones = []; huecos = [];
    const t0 = Date.now();
    try { await irA(page, ruta); await estable(page); } catch (e) { excepciones.push('NAV ' + e.message); }
    const final = await page.evaluate(() => location.pathname + location.search).catch(() => '?');
    const info = await page
      .evaluate(() => {
        const main = document.querySelector('main') || document.body;
        const h1 = [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).filter(Boolean).slice(0, 2);
        const links = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => h && h.startsWith('/'));
        const nav = [...document.querySelectorAll('nav a[href]')].map((a) => ({ href: a.getAttribute('href'), txt: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60) }));
        const botones = [...main.querySelectorAll('button')].map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 25);
        const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth;
        return { title: document.title, h1, texto: (main.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 1800), links: [...new Set(links)], nav, botones, desborde: sw > cw + 2 };
      })
      .catch((e) => ({ title: '?', h1: [], texto: '', links: [], nav: [], botones: [], err: e.message }));
    n++;
    const shot = `${String(n).padStart(4, '0')}.jpg`;
    await page.screenshot({ path: path.join(OUT, 'shots', shot), type: 'jpeg', quality: 55 }).catch(() => {});
    const pantallaError = ERROR_TXT.test(info.texto);
    filas.push({
      n, ruta, patron: pat, origen, final, redirigida: final.split('?')[0] !== ruta.split('?')[0],
      ms: Date.now() - t0, title: info.title, h1: info.h1, texto: info.texto, botones: info.botones,
      consola: [...new Set(consola)], excepciones: [...new Set(excepciones)], huecos: [...new Set(huecos)],
      pantallaError, desborde: info.desborde, shot, nLinks: info.links.length,
    });
    return info;
  }

  // 1) punto de partida y menú
  const inicio = await page.evaluate(() => location.pathname);
  const infoInicio = await visitar(inicio, 'inicio');
  const menu = (infoInicio?.nav || []).filter((x) => x.href && x.href.startsWith('/'));
  fs.writeFileSync(path.join(OUT, 'menu.json'), JSON.stringify(menu, null, 1));

  const cola = [];
  if (cuenta.startsWith('superadmin') || cuenta === 'anon') {
    for (const r of estaticas) if (!r.startsWith('/design-system/stock')) cola.push([r, 'catalogo']);
  }
  for (const m of menu) cola.push([m.href.split('#')[0], 'menu']);

  const pendientesLinks = [];
  while (cola.length) {
    const [r, o] = cola.shift();
    const info = await visitar(r, o);
    if (info) for (const l of info.links) pendientesLinks.push([l.split('#')[0], r]);
    if (n % 25 === 0) { console.log(cuenta, n, 'visitas'); fs.writeFileSync(path.join(OUT, 'filas.json'), JSON.stringify(filas, null, 1)); }
  }
  // 2) enlaces descubiertos: una instancia por patrón no visto (fichas, pedidos, perfiles…)
  let extra = 0;
  while (pendientesLinks.length && extra < MAX_EXTRA) {
    const [l, de] = pendientesLinks.shift();
    const limpio = l.split('?')[0];
    const pat = patronDe(limpio);
    if (!pat || patronesVistos.has(pat) || visitadas.has(l)) continue;
    if (limpio.startsWith('/auth') && cuenta !== 'anon') continue;
    extra++;
    const info = await visitar(l, 'enlace:' + de);
    if (info) for (const x of info.links) pendientesLinks.push([x.split('#')[0], l]);
  }
  fs.writeFileSync(path.join(OUT, 'filas.json'), JSON.stringify(filas, null, 1));
  const noVistos = [...new Set([...estaticas, ...patrones.map((p) => p.p)])].filter((p) => !patronesVistos.has(p));
  fs.writeFileSync(path.join(OUT, 'no-alcanzadas.json'), JSON.stringify(noVistos, null, 1));
  console.log('FIN', cuenta, 'visitas', n, 'patrones', patronesVistos.size);
  await browser.close();
})().catch((e) => { console.error('FALLO', e); process.exit(1); });

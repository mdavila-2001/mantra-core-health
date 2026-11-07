// Part 2, agent E: legend and edge bundle evidence. node captura-e.cjs <out-dir> <label>
// Static demo build on BASE. Never `networkidle`: waits are on test ids.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [OUT, ETIQUETA] = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://localhost:4351';
const ALTO = { 1440: 900, 1920: 1080 };
function uuid(seed) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) { const c = seed.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0; }
  const hex = (n) => n.toString(16).padStart(8, '0');
  const raw = `${hex(h1)}${hex(h2)}${hex((h1 * 31 + h2) >>> 0)}${hex((h2 * 17 + h1) >>> 0)}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}
const EXPEDIENTE = `/medical-records/${uuid('pid-paciente')}`;
const log = [];
const anotar = (s) => { log.push(s); console.log(s); };

/** Vertical stretches of the drawn links, from their `d`: the densest bundle and its tightest spacing. */
const medirHaz = (p) => p.evaluate(() => {
  const verticales = [];
  for (const el of document.querySelectorAll('path.red__arista:not(.red__arista--tronco)')) {
    const nums = (el.getAttribute('d').match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    // Polyline vertices: M x y, then (L x y Q cx cy x y)*, L x y. The control points are the corners.
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1]; const [bx, by] = pts[i];
      if (Math.abs(ax - bx) < 0.01 && Math.abs(ay - by) > 4) verticales.push({ x: ax, y0: Math.min(ay, by), y1: Math.max(ay, by) });
    }
  }
  let peor = { cuenta: 0, minimo: Infinity, x: 0, y: 0 };
  for (const v of verticales) {
    for (const y of [v.y0 + 1, (v.y0 + v.y1) / 2]) {
      const xs = [...new Set(verticales.filter((w) => w.y0 <= y && w.y1 >= y && Math.abs(w.x - v.x) < 80).map((w) => Math.round(w.x * 10) / 10))].sort((a, b) => a - b);
      // Contiguous group around v.x, adjacent lanes closer than 16 px.
      let grupo = [xs[0]], mejor = [xs[0]];
      for (let i = 1; i < xs.length; i++) { if (xs[i] - xs[i - 1] < 16) grupo.push(xs[i]); else grupo = [xs[i]]; if (grupo.length > mejor.length) mejor = [...grupo]; }
      const minimo = Math.min(...mejor.slice(1).map((x, i) => x - mejor[i]));
      if (mejor.length > peor.cuenta) peor = { cuenta: mejor.length, minimo, x: mejor[0], y };
    }
  }
  const lienzo = document.querySelector('.red__trazos')?.getBoundingClientRect();
  return { verticales: verticales.length, peor, lienzoX: lienzo ? lienzo.x : 0 };
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  for (const ancho of [1440, 1920]) for (const tema of ['light', 'dark']) {
    const pref = `${ETIQUETA}-medica-${ancho}-${tema === 'light' ? 'claro' : 'oscuro'}`;
    const ctx = await b.newContext({ viewport: { width: ancho, height: ALTO[ancho] }, colorScheme: tema, locale: 'es-BO', timezoneId: 'America/La_Paz' });
    await ctx.addInitScript((t) => { try { localStorage.setItem('mantra-core-health.theme', t); } catch {} }, tema);
    const p = await ctx.newPage();
    await p.goto(BASE + '/auth');
    await p.getByTestId('login-identifier').waitFor({ timeout: 180000 });
    await p.getByTestId('login-identifier').fill('medica@alovida.mock');
    await p.getByTestId('login-password').fill('mock');
    await p.getByTestId('login-submit').click();
    await p.waitForURL((u) => !u.pathname.startsWith('/auth') || u.pathname.includes('organization'), { timeout: 120000 });
    if (p.url().includes('organization')) { await p.getByTestId('tenant-opcion').first().click(); await p.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60000 }); }
    await p.goto(BASE + EXPEDIENTE);
    await p.getByTestId('expediente-vista').waitFor({ timeout: 120000 });
    await p.getByTestId('expediente-vista').getByRole('radio', { name: 'Recorrido' }).click();
    await p.getByTestId('red-superficie').waitFor({ timeout: 60000 });
    await p.getByTestId('red-episodio').first().waitFor({ timeout: 60000 });
    for (const cerrar of await p.getByTestId('toast-cerrar').all()) await cerrar.click().catch(() => {});
    // Every episode expanded: that is where the bundles form.
    for (let i = 0; i < 20; i++) {
      const cerrado = p.locator('[data-testid="red-episodio"][aria-expanded="false"]').first();
      if ((await cerrado.count()) === 0) break;
      await cerrado.click();
      await p.waitForTimeout(250);
    }
    await p.waitForTimeout(600);
    const leyenda = await p.getByTestId('red-leyenda').evaluate((u) => [...u.querySelectorAll('li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()));
    const titulos = await p.getByTestId('red-leyenda').evaluate((u) => [...u.querySelectorAll('li[title]')].map((li) => li.getAttribute('title')));
    const haz = await medirHaz(p);
    anotar(`${pref}: leyenda (${leyenda.length}) ${JSON.stringify(leyenda)}`);
    if (titulos.length) anotar(`${pref}: títulos ${JSON.stringify(titulos)}`);
    anotar(`${pref}: tramos verticales ${haz.verticales}; haz más denso ${haz.peor.cuenta} líneas, separación mínima ${haz.peor.minimo} px, en x≈${Math.round(haz.peor.x + haz.lienzoX)} de la ventana`);
    // The densest bundle brought into view and shot on its own.
    const caja = await p.evaluate(({ x, y }) => {
      const svg = document.querySelector('.red__trazos');
      let el = svg.parentElement;
      while (el && !(el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX))) el = el.parentElement;
      if (el) el.scrollLeft += svg.getBoundingClientRect().x + x - (el.getBoundingClientRect().x + el.clientWidth / 2);
      const r = svg.getBoundingClientRect();
      window.scrollBy(0, r.y + y - innerHeight / 2);
      const r2 = svg.getBoundingClientRect();
      return { x: Math.max(0, r2.x + x - 260), y: Math.max(0, r2.y + y - 220), width: 520, height: 440 };
    }, { x: haz.peor.x, y: haz.peor.y });
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/${pref}-haz.png`, clip: caja });
    // Centred, so the fixed header does not cover it.
    await p.getByTestId('red-leyenda').evaluate((u) => u.scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(200);
    await p.getByTestId('red-leyenda').screenshot({ path: `${OUT}/${pref}-leyenda.png` });
    await p.getByTestId('expediente-recorrido').scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${OUT}/${pref}-red.png`, fullPage: true });
    await ctx.close();
  }
  await b.close();
  fs.appendFileSync(`${OUT}/mediciones.txt`, log.join('\n') + '\n');
})().catch((e) => { console.error(e); process.exit(1); });

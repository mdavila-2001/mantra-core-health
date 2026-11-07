// Part 1 — browser evidence for the second review's HIGH findings.
// Usage: node captura-parte-1.cjs <out-dir>   (ng serve, configuration development,demo; BASE=http://localhost:<port>)
// Never `networkidle` (with HMR it never arrives): waits are on test ids.
const fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const t3 = require('../tanda-visual-3/captura-tanda-3.cjs');
const { sesion, abrirRed, abrirTsh, sinToasts, anotar, BASE } = t3;
const OUT = process.argv[2];
const log = [];
const nota = (s) => { log.push(s); anotar(s); };
let fallas = 0;
const comprobar = (cond, texto) => { nota(`${cond ? 'ok  ' : 'FALLA'} ${texto}`); if (!cond) fallas++; };
const tema = (t) => (t === 'light' ? 'claro' : 'oscuro');

/** Names whose laid-out text box does not fit the span (finding 1): no integer tolerance. */
const cortados = (p) => p.evaluate(() => [...document.querySelectorAll('.red__episodio-nombre')].filter((n) => {
  const caja = n.getBoundingClientRect();
  const r = document.createRange();
  r.selectNodeContents(n);
  const t = r.getBoundingClientRect();
  return t.width > caja.width || t.height > caja.height;
}).map((n) => n.textContent.trim()));

const anchos = (p) => p.evaluate(() => [...document.querySelectorAll('.red__episodio-nombre')].slice(0, 4).map((n) => {
  const r = document.createRange();
  r.selectNodeContents(n);
  return `${n.textContent.trim()}: texto ${r.getBoundingClientRect().width.toFixed(2)} / caja ${n.getBoundingClientRect().width.toFixed(2)}`;
}));

async function medica(b, ancho, t) {
  const pref = `medica-${ancho}-${tema(t)}`;
  const { ctx, p, errores } = await sesion(b, 'medica@alovida.mock', ancho, t);
  await abrirRed(p);
  await sinToasts(p);
  await p.getByTestId('expediente-recorrido').scrollIntoViewIfNeeded();
  nota(`${pref} sin panel: ${JSON.stringify(await anchos(p))}`);
  comprobar((await cortados(p)).length === 0, `${pref}: sin panel, ningún nombre cortado ${JSON.stringify(await cortados(p))}`);
  await p.screenshot({ path: `${OUT}/${pref}-1-sin-panel.png` });
  await abrirTsh(p);
  await p.getByTestId('red-panel-valor').first().waitFor({ timeout: 20000 });
  nota(`${pref} con panel: ${JSON.stringify(await anchos(p))}`);
  comprobar((await cortados(p)).length === 0, `${pref}: con panel, ningún nombre cortado ${JSON.stringify(await cortados(p))}`);
  await p.screenshot({ path: `${OUT}/${pref}-2-con-panel.png` });
  comprobar(errores.length === 0, `${pref}: consola sin errores ${JSON.stringify(errores.slice(0, 3))}`);
  await ctx.close();
}

/** Every accordion trigger: its own `aria-expanded` against its chevron's computed rotation (finding 2). */
const flechas = (p) => p.evaluate(() => [...document.querySelectorAll('.accordion-panel__trigger')].map((b) => ({
  abierto: b.getAttribute('aria-expanded') === 'true',
  girada: getComputedStyle(b.querySelector('.accordion-panel__chevron')).transform !== 'none',
  anidado: !!b.closest('.accordion-panel__region'),
})));

async function paciente(b, t) {
  const pref = `paciente-1440-${tema(t)}`;
  const { ctx, p, errores } = await sesion(b, 'paciente@alovida.mock', 1440, t);
  await p.getByTestId('mi-salud').waitFor({ timeout: 120000 });
  await p.getByTestId('mi-salud-sintomas').waitFor({ timeout: 60000 });
  await sinToasts(p);
  comprobar(await p.getByTestId('mi-salud-proxima-cita').waitFor({ timeout: 30000 }).then(() => true, () => false), `${pref}: la portada muestra la próxima cita`);
  await p.screenshot({ path: `${OUT}/${pref}-0-portada.png` });
  await p.goto(BASE + '/my-account/medical-record?vista=recorrido');
  await p.getByTestId('recorrido-hilos').waitFor({ timeout: 120000 });
  await sinToasts(p);
  const hilo = p.getByTestId('recorrido-hilo').filter({ hasText: 'Hipotiroidismo' }).first();
  await hilo.locator('.accordion-panel__trigger').first().click();
  const atenciones = hilo.getByTestId('recorrido-atencion');
  await atenciones.first().waitFor();
  await atenciones.first().locator('.accordion-panel__trigger').first().click();
  const f = await flechas(p);
  const malas = f.filter((x) => x.abierto !== x.girada);
  nota(`${pref}: ${f.length} disparadores, ${f.filter((x) => x.anidado && !x.abierto).length} hijos plegados dentro de un padre abierto`);
  comprobar(f.some((x) => x.anidado && !x.abierto), `${pref}: hay al menos un hijo plegado dentro de un padre abierto`);
  comprobar(malas.length === 0, `${pref}: cada flecha sigue a su propio aria-expanded (${malas.length} discrepancias)`);
  await hilo.scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/${pref}-1-hilo-anidado.png` });
  comprobar(errores.length === 0, `${pref}: consola sin errores ${JSON.stringify(errores.slice(0, 3))}`);
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
  for (const ancho of [768, 1440]) for (const t of ['light', 'dark']) await medica(b, ancho, t).catch((e) => { fallas++; nota(`FALLA médica ${ancho} ${t}: ${e.message.split('\n')[0]}`); });
  for (const t of ['light', 'dark']) await paciente(b, t).catch((e) => { fallas++; nota(`FALLA paciente ${t}: ${e.message.split('\n')[0]}`); });
  await b.close();
  nota(`\n${fallas === 0 ? 'TODO OK' : fallas + ' FALLA(S)'}`);
  fs.writeFileSync(`${OUT}/aserciones.txt`, log.join('\n') + '\n');
})().catch((e) => { console.error(e); process.exit(1); });

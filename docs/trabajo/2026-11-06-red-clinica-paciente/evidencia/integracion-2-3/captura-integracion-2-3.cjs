/* Evidencia de navegador de la integración Franja 2 + Franja 3 (red clínica
   del expediente real de pid-paciente). Uso:
     node captura-integracion-2-3.cjs <carpeta-de-salida>
   Contra `ng serve --configuration development,demo --port 4300`. Nunca espera
   `networkidle` (con HMR no llega): espera elementos concretos. */
const { chromium } = require('playwright');

function uuid(seed) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  const a = hex(h1), b = hex(h2), c = hex((h1 * 31 + h2) >>> 0), d = hex((h2 * 17 + h1) >>> 0);
  const raw = `${a}${b}${c}${d}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}
const red = (k) => uuid(`patient-network-${k}`);
const ID = {
  paciente: uuid('pid-paciente'),
  hipo: red('condition-hypothyroidism'),
  anemia: red('condition-anemia'),
  tsh: red('order-tsh'),
};
const OUT = process.argv[2];
const BASE = 'http://localhost:4300';
const resultados = [];
const ok = (cond, texto) => resultados.push(`${cond ? 'PASS' : 'FAIL'} ${texto}`);

async function sesion(b, ancho, tema) {
  const ctx = await b.newContext({ viewport: { width: ancho, height: ancho > 800 ? 900 : 844 }, deviceScaleFactor: 2, colorScheme: tema });
  await ctx.addInitScript((t) => { try { localStorage.setItem('mantra-core-health.theme', t); } catch {} }, tema);
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`console: ${m.text().slice(0, 300)}`); });
  await p.goto(`${BASE}/auth`);
  await p.getByTestId('login-identifier').waitFor({ timeout: 90000 });
  await p.getByTestId('login-identifier').fill('medica@alovida.mock');
  await p.getByTestId('login-password').fill('mock');
  await p.getByTestId('login-submit').click();
  await p.waitForURL(/\/(dashboard|auth\/organization|portal-selector)/, { timeout: 60000 });
  if (p.url().includes('organization')) { await p.getByTestId('tenant-opcion').first().click(); await p.waitForURL(/dashboard|portal-selector/, { timeout: 60000 }); }
  if (p.url().includes('portal-selector')) { await p.getByRole('link').first().click(); await p.waitForTimeout(2000); }
  await p.goto(`${BASE}/medical-records/${ID.paciente}`);
  await p.getByTestId('expediente-vista').waitFor({ timeout: 60000 });
  await p.getByTestId('expediente-vista').getByText('Recorrido', { exact: true }).click();
  await p.getByTestId('expediente-recorrido').waitFor({ timeout: 30000 });
  await p.getByTestId('red-cargando').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
  await p.getByTestId('red-alertas').waitFor({ timeout: 30000 });
  await p.waitForTimeout(800);
  return { ctx, p, errores };
}

const nodo = (p, id) => p.locator(`[data-testid="recorrido-nodo"][data-id="${id}"]`);
const panel = (p) => p.getByTestId('red-panel');
const textoDelPanel = async (p) => ((await panel(p).textContent()) ?? '').replace(/\s+/g, ' ');

/** Despliega el episodio del hipotiroidismo (por su botón) si está plegado. */
async function desplegarHipo(p) {
  const episodio = p.locator('[data-testid="red-episodio"]', { hasText: 'Hipotiroidismo' }).first();
  if ((await episodio.getAttribute('aria-expanded')) !== 'true') await episodio.click();
  await nodo(p, ID.hipo).first().waitFor();
}

(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  for (const tema of ['light', 'dark']) {
    /* ---------- 1440 ---------- */
    {
      const { ctx, p, errores } = await sesion(b, 1440, tema);
      const pre = `1440-${tema}`;
      ok((await p.locator('html').getAttribute('data-theme')) === tema, `${pre}: tema ${tema}`);
      await p.getByTestId('expediente-red').screenshot({ path: `${OUT}/${pre}-01-recorrido.png` });
      const anchoRed = (await p.getByTestId('expediente-red').boundingBox()).width;
      const anchoMapa = (await p.locator('.expediente__red-mapa').boundingBox()).width;
      ok(Math.abs(anchoRed - anchoMapa) < 2, `${pre}: sin panel, el mapa se lleva el ancho entero (${Math.round(anchoMapa)}/${Math.round(anchoRed)} px)`);

      // Estudio: la TSH pedida para el hipotiroidismo.
      await desplegarHipo(p);
      await nodo(p, ID.tsh).click();
      await panel(p).waitFor();
      let t = await textoDelPanel(p);
      ok(t.includes('Estudio') && t.includes('Resultado liberado') && t.includes('Laboratorio'), `${pre}: panel del estudio TSH con «Resultado liberado» y categoría`);
      ok(t.includes('Se pidió para estudiar'), `${pre}: el estudio muestra el vínculo «Se pidió para estudiar»`);
      ok((await panel(p).evaluate((e) => e.tagName)) === 'ASIDE', `${pre}: el panel es lateral (<aside>)`);
      const cajaPanel = await panel(p).boundingBox();
      const cajaMapa = await p.locator('.expediente__red-mapa').boundingBox();
      ok(cajaPanel.x > cajaMapa.x + cajaMapa.width - 2, `${pre}: rejilla mapa | panel (panel a la derecha del mapa)`);
      ok((await nodo(p, ID.tsh).getAttribute('aria-current')) === 'true', `${pre}: el nodo abierto queda marcado en la red`);
      await p.getByTestId('expediente-red').screenshot({ path: `${OUT}/${pre}-02-panel-estudio.png` });

      // Diagnóstico descartado: la anemia, con su reemplazo.
      const anemia = nodo(p, ID.anemia).first();
      if ((await anemia.getAttribute('data-forma')) === 'descartado') await anemia.click();
      await nodo(p, ID.anemia).last().click();
      await p.getByTestId('red-panel-reemplazo').waitFor();
      t = await textoDelPanel(p);
      ok(t.includes('Descartado') && t.includes('Se descartó en favor de') && t.includes('Hipotiroidismo'), `${pre}: panel del descartado con «Se descartó en favor de Hipotiroidismo»`);
      await p.getByTestId('expediente-red').screenshot({ path: `${OUT}/${pre}-03-panel-descartado.png` });

      // Navegar por el vínculo del panel.
      await p.getByTestId('red-panel-reemplazo').getByRole('button').click();
      await p.waitForTimeout(600);
      t = await textoDelPanel(p);
      ok(t.includes('Diagnóstico') && t.includes('Confirmado') && !t.includes('Se descartó en favor de'), `${pre}: el vínculo abre el diagnóstico de reemplazo en el panel`);
      ok((await nodo(p, ID.hipo).getAttribute('aria-current')) === 'true', `${pre}: la red marca el nodo navegado`);
      await p.getByTestId('expediente-red').screenshot({ path: `${OUT}/${pre}-04-navegado.png` });

      // Cerrar devuelve el foco al nodo abierto.
      await p.getByTestId('red-panel-cerrar').click();
      await panel(p).waitFor({ state: 'detached' });
      await p.waitForTimeout(400);
      const foco = await p.evaluate(() => document.activeElement?.getAttribute('data-id'));
      ok(foco === ID.hipo, `${pre}: cerrar devuelve el foco al nodo (${foco === ID.hipo ? 'hipotiroidismo' : foco})`);

      // Filtro: sólo el hilo de Hipotiroidismo.
      const antes = await p.locator('[data-testid="red-hilo"]').count();
      await p.getByTestId('red-filtro-hilo').click();
      await p.getByRole('option', { name: /Hipotiroidismo/ }).first().click();
      await p.waitForTimeout(800);
      const despues = await p.locator('[data-testid="red-hilo"]').count();
      const cuenta = ((await p.getByTestId('red-filtros-cuenta').textContent()) ?? '').replace(/\s+/g, ' ').trim();
      ok(despues < antes && cuenta.includes('filtro aplicado'), `${pre}: «solo el hilo de Hipotiroidismo»: ${antes} → ${despues} episodios; «${cuenta}»`);
      await p.getByTestId('expediente-red').screenshot({ path: `${OUT}/${pre}-05-hilo-hipotiroidismo.png` });
      await p.getByTestId('red-filtros-limpiar').click();
      await p.waitForTimeout(500);

      // Alerta: pasar el puntero resalta; el clic abre el panel.
      const alerta = p.getByTestId('red-alerta').first();
      await alerta.scrollIntoViewIfNeeded();
      await alerta.hover();
      await p.waitForTimeout(300);
      const resaltados = await p.locator('.red__nodo--resaltado, .red__hilo--resaltado').count();
      ok(resaltados > 0, `${pre}: pasar por la alerta resalta ${resaltados} nodos/episodios`);
      await p.getByTestId('expediente-red').screenshot({ path: `${OUT}/${pre}-06-alerta-resalta.png` });
      const tituloAlerta = ((await alerta.locator('.alerta__titulo').textContent()) ?? '').trim();
      await alerta.click();
      await panel(p).waitFor();
      await p.waitForTimeout(600);
      t = await textoDelPanel(p);
      ok(t.length > 0, `${pre}: clic en la alerta «${tituloAlerta}» abre el panel`);
      await p.getByTestId('expediente-red').screenshot({ path: `${OUT}/${pre}-07-alerta-panel.png` });

      ok(errores.length === 0, `${pre}: consola sin errores${errores.length ? ': ' + errores.join(' | ') : ''}`);
      await ctx.close();
    }
    /* ---------- 390 ---------- */
    {
      const { ctx, p, errores } = await sesion(b, 390, tema);
      const pre = `390-${tema}`;
      const sinScroll = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      ok(sinScroll, `${pre}: sin desplazamiento horizontal de la página`);
      await p.getByTestId('expediente-red').screenshot({ path: `${OUT}/${pre}-01-recorrido.png` });
      await desplegarHipo(p);
      await nodo(p, ID.tsh).scrollIntoViewIfNeeded();
      await nodo(p, ID.tsh).click();
      await panel(p).waitFor();
      ok((await panel(p).evaluate((e) => e.tagName)) === 'DIALOG', `${pre}: el panel es una hoja (<dialog>)`);
      await p.waitForTimeout(500);
      await p.screenshot({ path: `${OUT}/${pre}-02-hoja-estudio.png` });
      // Navegar a su diagnóstico desde la hoja.
      await panel(p).locator('[data-testid="red-panel-vinculo"]', { hasText: 'Hipotiroidismo' }).first().click();
      await p.waitForTimeout(600);
      ok((await textoDelPanel(p)).includes('Confirmado'), `${pre}: el vínculo de la hoja abre el diagnóstico`);
      await p.screenshot({ path: `${OUT}/${pre}-03-hoja-navegada.png` });
      await p.getByTestId('red-panel-cerrar').click();
      await panel(p).waitFor({ state: 'detached' });
      await p.waitForTimeout(400);
      const foco = await p.evaluate(() => document.activeElement?.getAttribute('data-id'));
      ok(foco === ID.hipo, `${pre}: cerrar la hoja devuelve el foco al nodo`);
      const alerta = p.getByTestId('red-alerta').first();
      await alerta.scrollIntoViewIfNeeded();
      await alerta.focus();
      await p.waitForTimeout(300);
      ok((await p.locator('.red__nodo--resaltado, .red__hilo--resaltado').count()) > 0, `${pre}: el foco en la alerta resalta`);
      await p.screenshot({ path: `${OUT}/${pre}-04-alertas.png` });
      ok(errores.length === 0, `${pre}: consola sin errores${errores.length ? ': ' + errores.join(' | ') : ''}`);
      await ctx.close();
    }
  }
  await b.close();
  console.log(resultados.join('\n'));
})().catch((e) => {
  console.error(e);
  console.log(resultados.join('\n'));
  process.exit(1);
});

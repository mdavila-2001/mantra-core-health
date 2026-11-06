// Integración tanda 2 — evidencia de navegador.
// Uso: node captura-tanda-2.cjs <carpeta-salida>   (ng serve en :4300, configuración development,demo)
// Nunca `networkidle` (con HMR no llega): se espera por testids.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = process.argv[2];
const BASE = 'http://localhost:4300';
const SOLO = process.env.SOLO ?? 'todo'; // 'medica' | 'paciente' | 'todo'
const log = [];
const anotar = (s) => { log.push(s); console.log(s); };
let fallas = 0;
const afirmar = (cond, texto) => { anotar(`${cond ? 'ok  ' : 'FALLA'} ${texto}`); if (!cond) fallas++; };

function uuid(seed) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) { const c = seed.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0; }
  const hex = (n) => n.toString(16).padStart(8, '0');
  const a = hex(h1), b = hex(h2), c = hex((h1 * 31 + h2) >>> 0), d = hex((h2 * 17 + h1) >>> 0);
  const raw = `${a}${b}${c}${d}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

async function sesion(b, usuario, ancho, alto, tema) {
  const ctx = await b.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 2, colorScheme: tema, acceptDownloads: true });
  await ctx.addInitScript((t) => { try { localStorage.setItem('mantra-core-health.theme', t); } catch {} }, tema);
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
  await p.goto(BASE + '/auth');
  await p.getByTestId('login-identifier').waitFor({ timeout: 120000 });
  await p.getByTestId('login-identifier').fill(usuario);
  await p.getByTestId('login-password').fill('mock');
  await p.getByTestId('login-submit').click();
  await p.waitForURL((u) => !u.pathname.startsWith('/auth') || u.pathname.includes('organization'), { timeout: 120000 });
  await p.waitForTimeout(1500);
  if (p.url().includes('organization')) { await p.getByTestId('tenant-opcion').first().click(); await p.waitForTimeout(2000); }
  if (p.url().includes('portal-selector')) { await p.getByRole('link').first().click(); await p.waitForTimeout(2000); }
  return { ctx, p, errores };
}

const sinDesborde = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

async function medica(b, ancho, alto, tema) {
  const pref = `${ancho}-${tema === 'light' ? 'claro' : 'oscuro'}`;
  const completo = ancho === 1440 && tema === 'light';
  const { ctx, p, errores } = await sesion(b, 'medica@alovida.mock', ancho, alto, tema);
  await p.goto(BASE + '/medical-records/' + uuid('pid-paciente'));
  await p.getByTestId('expediente-vista').waitFor({ timeout: 90000 });
  await p.getByTestId('expediente-vista').getByText('Recorrido', { exact: true }).click();
  await p.getByTestId('red-superficie').waitFor({ timeout: 60000 });
  await p.getByTestId('red-alertas').waitFor({ timeout: 60000 });
  await p.waitForTimeout(1500);
  const sup = p.getByTestId('red-superficie');
  await sup.scrollIntoViewIfNeeded();

  // Composición: una tarjeta; las alertas plegadas no empujan el mapa.
  const comp = await p.evaluate(() => {
    const s = document.querySelector('[data-testid="red-superficie"]');
    const al = document.querySelector('[data-testid="red-alertas"]');
    const red = document.querySelector('[data-testid="expediente-recorrido"]');
    const r = (e) => e.getBoundingClientRect();
    const filtros = document.querySelector('[data-testid="red-filtros"]');
    const borde = (e) => getComputedStyle(e).borderTopWidth;
    return {
      tarjetasDentro: s.querySelectorAll('app-card').length,
      bordeFiltros: borde(filtros), bordeAlertas: borde(al),
      altoAlertas: Math.round(r(al).height),
      mapaDesdeTopeDeLaTarjeta: Math.round(r(red).top - r(s).top),
      plegarTexto: document.querySelector('[data-testid="red-alertas-plegar"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      expandida: document.querySelector('[data-testid="red-alertas-plegar"]')?.getAttribute('aria-expanded') ?? null,
      profesional: !!document.querySelector('[data-testid="red-filtro-profesional"]'),
      especialidad: !!document.querySelector('[data-testid="red-filtro-especialidad"]'),
    };
  });
  anotar(`${pref} composición: ${JSON.stringify(comp)}`);
  afirmar(comp.tarjetasDentro === 0 && comp.bordeFiltros === '0px' && comp.bordeAlertas === '0px', `${pref}: filtros y alertas sin recuadro propio, dentro de UNA tarjeta`);
  afirmar(comp.expandida === 'false' && comp.altoAlertas < 80, `${pref}: alertas plegadas en un resumen (${comp.altoAlertas} px)`);
  afirmar(!comp.profesional && !comp.especialidad, `${pref}: sin filtros de profesional/especialidad (no hay opciones reales)`);
  afirmar(await sinDesborde(p), `${pref}: sin desplazamiento horizontal`);
  await p.screenshot({ path: `${OUT}/${pref}-01-superficie.png` });

  // Alertas desplegadas.
  await p.getByTestId('red-alertas-plegar').click();
  await p.waitForTimeout(400);
  afirmar((await p.getByTestId('red-alerta').count()) > 0, `${pref}: «${comp.plegarTexto}» se despliega`);
  if (completo || ancho === 390) await p.getByTestId('red-alertas').screenshot({ path: `${OUT}/${pref}-02-alertas-desplegadas.png` });
  await p.getByTestId('red-alertas-plegar').click();
  await p.waitForTimeout(300);

  const nodosAntes = await p.getByTestId('red-episodio').count();

  // Recorrido paso a paso: la red se revela.
  await p.getByTestId('red-guiado-alternar').click();
  await p.getByTestId('recorrido-guiado').waitFor({ timeout: 20000 });
  await p.waitForTimeout(1200);
  const pasos = completo ? 5 : 3;
  for (let i = 1; i <= pasos; i++) {
    const estado = await p.evaluate(() => ({
      contador: document.querySelector('[data-testid="guiado-contador"]')?.textContent?.trim(),
      narracion: document.querySelector('[data-testid="guiado-narracion"]')?.textContent?.trim(),
      episodios: document.querySelectorAll('[data-testid="red-episodio"]').length,
      nodos: document.querySelectorAll('[data-testid="recorrido-nodo"]').length,
      resaltados: document.querySelectorAll('.red__nodo--resaltado').length,
    }));
    anotar(`${pref} paso ${i}: ${JSON.stringify(estado)}`);
    if (i === 1) afirmar(estado.episodios < nodosAntes || nodosAntes <= 1, `${pref}: el paso 1 muestra menos episodios (${estado.episodios}) que la red completa (${nodosAntes})`);
    if (completo || i === 1 || i === 3) {
      await p.getByTestId('red-guiado').scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${OUT}/${pref}-03-guiado-paso${i}.png` });
    }
    if (i < pasos) { await p.getByTestId('guiado-siguiente').click(); await p.waitForTimeout(1200); }
  }
  afirmar(!/[0-9a-f]{8}-[0-9a-f]{4}-/.test((await p.getByTestId('guiado-narracion').textContent()) ?? ''), `${pref}: la narración no muestra uuids`);
  // Tocar la red pausa (no hay reproducción en curso: comprobamos que no rompe).
  afirmar(await sinDesborde(p), `${pref}: guiado sin desplazamiento horizontal`);

  // Salir restaura.
  await p.getByTestId('red-guiado-alternar').click();
  await p.waitForTimeout(800);
  afirmar((await p.getByTestId('red-episodio').count()) === nodosAntes, `${pref}: salir del paso a paso devuelve los ${nodosAntes} episodios`);

  // Seguir el episodio de hipotiroidismo: desde un nodo abierto en el panel.
  const hipo = p.getByTestId('red-episodio').filter({ hasText: 'Hipotiroidismo' }).first();
  await hipo.click();
  await p.waitForTimeout(1200);
  const tsh = p.locator('[data-testid="recorrido-nodo"][data-clase="estudio"]').filter({ hasText: 'TSH' }).first();
  await tsh.scrollIntoViewIfNeeded();
  await tsh.click();
  await p.getByTestId('red-panel').waitFor({ timeout: 15000 });
  await p.getByTestId('red-panel-valor').first().waitFor({ timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(800);
  const panel = await p.evaluate(() => ({
    liberado: document.querySelector('[data-testid="red-panel-liberado"]')?.textContent?.replace(/\s+/g, ' ').trim(),
    valores: [...document.querySelectorAll('[data-testid="red-panel-valor"]')].map((f) => f.textContent.replace(/\s+/g, ' ').trim()),
    fuera: [...document.querySelectorAll('[data-testid="red-panel-valor"]')].filter((f) => f.classList.contains('panel__fila--fuera')).length,
    archivo: !!document.querySelector('[data-testid="red-panel-archivo"]'),
    recortados: (() => {
      const pan = document.querySelector('[data-testid="red-panel"]');
      const caja = pan.getBoundingClientRect();
      return [...pan.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > caja.right + 1 && !e.closest('.panel__tabla-caja')).length;
    })(),
  }));
  anotar(`${pref} panel TSH: ${JSON.stringify(panel)}`);
  afirmar(panel.recortados === 0, `${pref}: nada del panel se sale por la derecha`);
  afirmar(panel.valores.length > 0 && panel.fuera > 0 && /Liberado el/.test(panel.liberado ?? ''), `${pref}: el panel lee el informe (valores, fuera de rango, fecha)`);
  await p.screenshot({ path: `${OUT}/${pref}-05-panel-tsh-valores.png` });
  if (completo && panel.archivo) {
    const [descarga] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.getByTestId('red-panel-archivo').first().click()]);
    anotar(`${pref}: descarga «${descarga.suggestedFilename()}» desde ${descarga.url().slice(0, 40)}…`);
    afirmar(descarga.suggestedFilename().endsWith('.pdf'), `${pref}: el PDF baja por la ruta del médico`);
  }
  // Bajo 780 px el panel es una hoja modal: se cierra, y el episodio se elige
  // en «Qué recorrer». Desde 780, el nodo abierto propone su episodio.
  const hoja = ancho < 780;
  if (hoja) { await p.keyboard.press('Escape'); await p.waitForTimeout(600); }
  await p.getByTestId('red-guiado-alternar').scrollIntoViewIfNeeded();
  await p.getByTestId('red-guiado-alternar').click();
  await p.getByTestId('recorrido-guiado').waitFor({ timeout: 15000 });
  if (hoja) {
    await p.getByTestId('red-guiado-episodio').click();
    await p.getByRole('option', { name: /^Hipotiroidismo/ }).first().click();
    await p.waitForTimeout(800);
  }
  await p.getByTestId('guiado-episodio').waitFor({ timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const seguido = await p.evaluate(() => ({
    episodio: document.querySelector('[data-testid="guiado-episodio"]')?.textContent?.trim(),
    contador: document.querySelector('[data-testid="guiado-contador"]')?.textContent?.trim(),
    narracion: document.querySelector('[data-testid="guiado-narracion"]')?.textContent?.trim(),
  }));
  anotar(`${pref} siguiendo: ${JSON.stringify(seguido)}`);
  afirmar(/Hipotiroidismo/.test(seguido.episodio ?? ''), `${pref}: «Siguiendo: Hipotiroidismo»`);
  const narraciones = [seguido.narracion];
  const vueltas = completo ? 8 : 2;
  for (let i = 0; i < vueltas; i++) {
    if (await p.getByTestId('guiado-siguiente').isDisabled()) break;
    await p.getByTestId('guiado-siguiente').click(); await p.waitForTimeout(900);
    narraciones.push(await p.getByTestId('guiado-narracion').textContent());
    if (completo && i === 1) { await p.getByTestId('red-guiado').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${OUT}/${pref}-04-episodio-hipotiroidismo-paso3.png` }); }
  }
  if (completo) anotar(`${pref} narración del hilo:\n  - ${narraciones.map((n) => n?.trim()).join('\n  - ')}`);
  afirmar(!narraciones.some((n) => /Levotiroxina 50 mcg comprimidos \(25 mcg/.test(n ?? '')), `${pref}: ninguna receta de 25 mcg dice «Levotiroxina 50 mcg»`);
  await p.getByTestId('red-guiado').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/${pref}-04-episodio-hipotiroidismo.png` });
  afirmar(errores.length === 0, `${pref}: consola sin errores ${JSON.stringify(errores.slice(0, 5))}`);
  await ctx.close();
}

async function paciente(b, ancho, alto, tema) {
  const pref = `paciente-${ancho}-${tema === 'light' ? 'claro' : 'oscuro'}`;
  const { ctx, p, errores } = await sesion(b, 'paciente@alovida.mock', ancho, alto, tema);
  await p.goto(BASE + '/my-account/medical-record?vista=recorrido');
  await p.getByTestId('mi-recorrido').waitFor({ timeout: 90000 });
  await p.getByTestId('recorrido-hilos').waitFor({ timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const hilo = p.getByTestId('recorrido-hilo').filter({ hasText: 'Hipotiroidismo' }).first();
  await hilo.locator('.accordion-panel__trigger').first().click();
  await p.waitForTimeout(500);
  const atenciones = hilo.getByTestId('recorrido-atencion');
  const n = Math.min(await atenciones.count(), 3);
  for (let i = 0; i < n; i++) { await atenciones.nth(i).locator('.accordion-panel__trigger').first().click(); await p.waitForTimeout(250); }
  const texto = ((await hilo.textContent()) ?? '').replace(/\s+/g, ' ');
  const sinVinculo = (texto.match(/sin vínculo a este problema/g) ?? []).length;
  anotar(`${pref}: estudios sin vínculo a este problema en el hilo = ${sinVinculo}`);
  afirmar(sinVinculo === 0, `${pref}: los estudios del hilo llegan con su diagnóstico (reasonConditionId)`);
  await hilo.scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/${pref}-1-hilo-hipotiroidismo.png` });
  await hilo.getByTestId('recorrido-empezar-guiado').click();
  await p.waitForTimeout(300);
  const frases = [(await p.getByTestId('recorrido-narracion').textContent())?.trim()];
  for (let i = 0; i < 20; i++) {
    if ((await p.getByTestId('recorrido-siguiente').getAttribute('aria-disabled')) === 'true') break;
    await p.getByTestId('recorrido-siguiente').click(); await p.waitForTimeout(150);
    frases.push((await p.getByTestId('recorrido-narracion').textContent())?.trim());
    if (i === 3) { await p.getByTestId('recorrido-guiado').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${OUT}/${pref}-2-paso-a-paso-estudio.png` }); }
  }
  if (ancho === 1440 && tema === 'light') anotar(`${pref} narración:\n  - ${frases.join('\n  - ')}`);
  afirmar(frases.some((f) => /Le pidieron .*TSH.* por Hipotiroidismo/i.test(f ?? '')), `${pref}: «Le pidieron … TSH … por Hipotiroidismo»`);
  afirmar(!frases.some((f) => /Anemia ferropénica se dio por resuelto/.test(f ?? '')), `${pref}: el descartado ya no se narra como resuelto`);
  afirmar(frases.some((f) => /Levotiroxina 25 mcg/.test(f ?? '')), `${pref}: la receta de 25 mcg dice «Levotiroxina 25 mcg»`);
  await p.getByTestId('recorrido-guiado').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/${pref}-3-paso-a-paso-final.png` });
  afirmar(await sinDesborde(p), `${pref}: sin desplazamiento horizontal`);
  afirmar(errores.length === 0, `${pref}: consola sin errores ${JSON.stringify(errores.slice(0, 5))}`);
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--disable-dev-shm-usage', '--disable-gpu'] });
  const tamanos = [[1440, 900], [768, 1024], [390, 844]];
  for (const [ancho, alto] of tamanos) {
    for (const tema of ['light', 'dark']) {
      if (SOLO !== 'paciente') await medica(b, ancho, alto, tema).catch((e) => { fallas++; anotar(`FALLA médica ${ancho} ${tema}: ${e.message.split('\n')[0]}`); });
      if (SOLO !== 'medica') await paciente(b, ancho, alto, tema).catch((e) => { fallas++; anotar(`FALLA paciente ${ancho} ${tema}: ${e.message.split('\n')[0]}`); });
    }
  }
  await b.close();
  anotar(`\n${fallas === 0 ? 'TODO OK' : fallas + ' FALLA(S)'}`);
  fs.writeFileSync(`${OUT}/aserciones-${SOLO}.txt`, log.join('\n') + '\n');
})().catch((e) => { console.error(e); process.exit(1); });

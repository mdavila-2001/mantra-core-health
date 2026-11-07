// Part 2, agent D: canvas edges, axis labels, track chip, search placeholder.
// Usage: node captura-d.cjs <out-dir>   (static demo build on BASE). Never `networkidle`: waits are on test ids.
const { sesion, abrirRed, sinToasts } = require('../../tanda-visual-3/captura-tanda-3.cjs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = process.argv[2];
const log = [];
let fallas = 0;
const anotar = (s) => { log.push(s); console.log(s); };
const afirmar = (cond, texto) => { anotar(`${cond ? 'ok  ' : 'FALLA'} ${texto}`); if (!cond) fallas++; };

/** Each axis label measured with a Range against its column: a label wider than its column is cut. */
const medirEje = (p) => p.evaluate(() => {
  const filas = [];
  for (const li of document.querySelectorAll('.red__columna')) {
    const caja = li.getBoundingClientRect();
    for (const el of li.querySelectorAll('.red__fecha, .red__contexto')) {
      const r = document.createRange();
      r.selectNodeContents(el);
      const texto = r.getBoundingClientRect();
      filas.push({ texto: el.textContent.trim(), ancho: Math.round(texto.width * 10) / 10, columna: Math.round(caja.width), cabe: texto.width <= caja.width + 0.5 && el.scrollWidth <= el.clientWidth + 1 });
    }
  }
  return filas;
});

/** Whether the canvas has content out of view at either edge, and whether each edge shows its fade and jump. */
const medirBordes = (p) => p.evaluate(() => {
  const l = document.querySelector('.red__lienzo');
  if (!l) return null;
  return {
    ocultoInicio: l.scrollLeft > 1,
    ocultoFinal: l.scrollLeft + l.clientWidth < l.scrollWidth - 1,
    bordeInicio: !!document.querySelector('[data-testid="red-borde-inicio"] button'),
    bordeFinal: !!document.querySelector('[data-testid="red-borde-final"] button'),
    // An edge button never lands on a date label (it sits on the axis line).
    pisaEtiquetas: [...document.querySelectorAll('.red__borde button')].flatMap((b) => {
      const r = b.getBoundingClientRect();
      return [...document.querySelectorAll('.red__columna p')].filter((e) => {
        const t = e.getBoundingClientRect();
        return t.right > r.left && t.left < r.right && t.bottom > r.top && t.top < r.bottom;
      }).map((e) => e.textContent.trim());
    }),
  };
});

/** The «← N antes» chip of the encounters-without-diagnosis row: its ring clears the track line. */
const medirChip = (p) => p.evaluate(() => {
  const hilo = [...document.querySelectorAll('[data-testid="red-hilo"]')].find((h) => h.classList.contains('red__hilo--sin-diagnostico'));
  const chip = hilo?.querySelector('[data-testid="red-fuera"]');
  if (!chip) return null;
  const cs = getComputedStyle(chip);
  return { texto: chip.textContent.trim(), fondo: cs.backgroundColor, anillo: cs.boxShadow };
});

async function medica(b, ancho, tema) {
  const pref = `medica-${ancho}-${tema === 'light' ? 'claro' : 'oscuro'}`;
  const { ctx, p, errores } = await sesion(b, 'medica@alovida.mock', ancho, tema);
  await abrirRed(p);
  await sinToasts(p);
  const buscar = p.getByTestId('red-filtros').locator('input').first();
  const ph = await buscar.evaluate((i) => {
    const c = document.createElement('canvas').getContext('2d');
    const cs = getComputedStyle(i);
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const libre = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { texto: i.placeholder, ancho: Math.round(c.measureText(i.placeholder).width), libre: Math.round(libre) };
  });
  afirmar(ph.ancho <= ph.libre, `${pref}: el placeholder entra entero (${JSON.stringify(ph)})`);
  await p.getByTestId('expediente-recorrido').scrollIntoViewIfNeeded();
  const eje = await medirEje(p);
  if (eje.length > 0) {
    const cortadas = eje.filter((f) => !f.cabe);
    afirmar(cortadas.length === 0, `${pref}: ${eje.length} etiquetas del eje, ninguna más ancha que su columna ${JSON.stringify(cortadas)}`);
    const mismo = eje.filter((f) => /mismo día/i.test(f.texto)).map((f) => f.texto);
    anotar(`${pref}: columnas del mismo día → ${JSON.stringify(mismo)}`);
    fs.writeFileSync(`${OUT}/${pref}-eje.json`, JSON.stringify(eje, null, 1));
    const bordes = await medirBordes(p);
    afirmar(bordes.ocultoInicio === bordes.bordeInicio && bordes.ocultoFinal === bordes.bordeFinal && bordes.pisaEtiquetas.length === 0, `${pref}: cada borde con contenido oculto lo señala ${JSON.stringify(bordes)}`);
    const chip = await medirChip(p);
    anotar(`${pref}: chip de «Atenciones sin diagnóstico» ${JSON.stringify(chip)}`);
  }
  await p.screenshot({ path: `${OUT}/${pref}-01-red.png` });
  if (eje.length > 0) {
    // Jump to the oldest: the start edge empties and the end edge offers to come back.
    await p.getByTestId('red-borde-inicio').getByRole('button').click();
    await p.waitForFunction(() => document.querySelector('.red__lienzo').scrollLeft <= 1, null, { timeout: 5000 });
    await p.getByTestId('red-borde-final').waitFor({ timeout: 5000 });
    const tras = await medirBordes(p);
    afirmar(!tras.bordeInicio && tras.bordeFinal === tras.ocultoFinal && tras.pisaEtiquetas.length === 0, `${pref}: tras «Lo más antiguo» ${JSON.stringify(tras)}`);
    await p.screenshot({ path: `${OUT}/${pref}-02-lo-mas-antiguo.png` });
  }
  if (ancho === 1440 || ancho === 390) {
    // The app's fixed header would be stitched into the middle of a full-page clip: hide it for this shot only.
    await p.addStyleTag({ content: 'header[app-header], app-mock-banner { visibility: hidden !important; }' });
    const caja = await p.getByTestId('red-superficie').evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; });
    await p.screenshot({ path: `${OUT}/${pref}-03-red-completa.png`, fullPage: true, clip: caja });
  }
  afirmar(errores.length === 0, `${pref}: consola sin errores ${JSON.stringify(errores.slice(0, 3))}`);
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const ancho of [390, 768, 1024, 1440, 1920]) for (const tema of ['light', 'dark']) {
    if (process.env.SOLO && process.env.SOLO !== `${ancho}-${tema}`) continue;
    // One browser per shot: a renderer crash (shared, memory-starved machine) does not take the rest down.
    const b = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
    try { await medica(b, ancho, tema); } catch (e) { afirmar(false, `${ancho} ${tema}: ${e.message.split('\n')[0]}`); }
    await b.close();
  }
  anotar(`\n${fallas === 0 ? 'TODO OK' : fallas + ' FALLAS'}`);
  fs.writeFileSync(`${OUT}/aserciones-d${process.env.SOLO ? '-' + process.env.SOLO : ''}.txt`, log.join('\n') + '\n');
})();

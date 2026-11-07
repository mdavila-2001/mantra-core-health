// Part 3, agent P1: control bar with the legend, year only when it changes, no `--fs-overline`
// on mixed-case text, flat thread headers and nodes at rest, quieter «N antes / N después» chips,
// hover gated to a fine pointer and no lift. Usage: BASE=http://localhost:PORT node captura-p1.cjs <out-dir> <antes|despues>
// (static demo build). Never `networkidle`: waits are on test ids. «antes» only takes shots and logs the values.
const { sesion, abrirRed, sinToasts } = require('../../tanda-visual-3/captura-tanda-3.cjs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [OUT, FASE] = process.argv.slice(2);
const log = [];
let fallas = 0;
const anotar = (s) => { log.push(s); console.log(s); };
const afirmar = (cond, texto) => {
  if (FASE !== 'despues') return anotar(`(antes) ${texto}`);
  anotar(`${cond ? 'ok  ' : 'FALLA'} ${texto}`);
  if (!cond) fallas++;
};

const medir = (p) => p.evaluate(() => {
  const caja = (e) => e.getBoundingClientRect();
  const lienzo = document.querySelector('.red__lienzo');
  const vista = caja(lienzo);
  const barra = document.querySelector('.red__barra');
  const ley = document.querySelector('[data-testid="red-leyenda"]');
  const botones = [...document.querySelectorAll('[data-testid="red-desplegar-todo"], [data-testid="red-plegar-todo"]')];
  // Narrow columns in view, left to right: what each says under its date.
  const cols = [...document.querySelectorAll('.red__columna')].map((li) => ({ li, r: caja(li) }));
  const visible = (r) => (r.left + r.right) / 2 >= vista.left && (r.left + r.right) / 2 <= vista.right;
  const angostas = cols.filter((c) => c.li.classList.contains('red__columna--angosta') && visible(c.r)).map((c) => {
    const ctx = c.li.querySelector('.red__contexto');
    return { fecha: c.li.querySelector('.red__fecha').textContent.trim(), ctx: ctx.textContent.replace(/ /g, '·nbsp·').trim(), fs: getComputedStyle(ctx).fontSize };
  });
  const intervalos = [...document.querySelectorAll('.red__intervalo')].map((e) => getComputedStyle(e).fontSize);
  const cabeceras = [...document.querySelectorAll('[data-testid="red-episodio"]')].map((b) => ({ abierto: b.getAttribute('aria-expanded'), sombra: getComputedStyle(b).boxShadow }));
  const chips = [...document.querySelectorAll('[data-testid="red-fuera"]')].map((b) => { const s = getComputedStyle(b); return { alto: Math.round(caja(b).height), borde: s.borderTopStyle, peso: s.fontWeight }; });
  const nodos = [...document.querySelectorAll('.red__nodo')].map((n) => getComputedStyle(n).boxShadow);
  return {
    barraUnaFila: ley ? Math.abs(caja(ley).top - caja(botones[0]).top) < 12 && ley.parentElement === barra : null,
    leyendaEnBarra: ley ? ley.parentElement === barra : null,
    variantes: botones.map((b) => b.getAttribute('variant')),
    angostas,
    intervalos,
    cabeceras,
    chips,
    nodosConSombra: nodos.filter((s) => s !== 'none').length,
    nodos: nodos.length,
    desborde: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});

/** A year is said only on the first narrow column in view and where it changes. */
function aniosBien(angostas) {
  let previo = null;
  return angostas.every((c, i) => {
    if (c.ctx === 'mismo día' || c.ctx === 'Sin fecha') return true;
    const dice = /^20\d\d$/.test(c.ctx);
    const debe = i === 0 || previo === null || c.ctx !== previo;
    if (dice) previo = c.ctx;
    return dice ? debe : c.ctx === '·nbsp·' && i > 0;
  });
}

async function medica(b, ancho, tema) {
  const pref = `${FASE}-medica-${ancho}-${tema === 'light' ? 'claro' : 'oscuro'}`;
  const { ctx, p, errores } = await sesion(b, 'medica@alovida.mock', ancho, tema);
  await abrirRed(p);
  await sinToasts(p);
  await p.locator('.red').evaluate((l) => { l.scrollIntoView({ block: 'start' }); const h = document.querySelector('header[app-header]'); window.scrollBy(0, -((h ? h.getBoundingClientRect().bottom : 0) + 24)); });
  await p.waitForTimeout(200);
  let m = await medir(p);
  anotar(`${pref} reposo: ${JSON.stringify(m)}`);
  afirmar(m.leyendaEnBarra === true, `${pref}: la leyenda está dentro de la barra de controles`);
  if (ancho >= 1440) afirmar(m.barraUnaFila === true, `${pref}: botones y leyenda en una sola fila`);
  afirmar(m.variantes.every((v) => v === 'ghost'), `${pref}: Expandir y Contraer son ghost ${JSON.stringify(m.variantes)}`);
  afirmar(m.angostas.length > 0 && aniosBien(m.angostas), `${pref}: el año solo en la primera columna visible y donde cambia ${JSON.stringify(m.angostas.map((c) => c.ctx))}`);
  afirmar(m.angostas.every((c) => c.fs === '12px') && m.intervalos.every((f) => f === '12px'), `${pref}: el contexto angosto y el intervalo usan --fs-caption (12px), no --fs-overline ${JSON.stringify([...new Set(m.angostas.map((c) => c.fs)), ...new Set(m.intervalos)])}`);
  afirmar(m.cabeceras.filter((c) => c.abierto === 'false').every((c) => c.sombra === 'none'), `${pref}: las cabeceras plegadas no llevan sombra en reposo`);
  afirmar(m.chips.length > 0 && m.chips.every((c) => c.alto === 24 && c.borde === 'solid' && c.peso === '500'), `${pref}: las píldoras «N antes/después» miden 24 px, borde sólido, peso 500 ${JSON.stringify(m.chips[0])}`);
  afirmar(!m.desborde, `${pref}: la página no desborda a lo ancho`);
  // The ruled-out strike is status, so it stays `--st-error-fg`.
  const tachado = await p.evaluate(() => {
    const ref = document.createElement('span'); ref.style.color = 'var(--st-error-fg)'; document.body.append(ref);
    const rojo = getComputedStyle(ref).color; ref.remove();
    return { rojo, rayas: [...document.querySelectorAll('.red__hito--descartado')].map((h) => getComputedStyle(h, '::after').backgroundColor) };
  });
  if (tachado.rayas.length) afirmar(tachado.rayas.every((c) => c === tachado.rojo), `${pref}: el tachado del rombo descartado sigue en --st-error-fg ${JSON.stringify(tachado)}`);
  else anotar(`${pref}: sin rombo descartado en la franja a la vista (se mide en el nodo desplegado)`);
  await p.screenshot({ path: `${OUT}/${pref}-01-reposo.png` });

  // Hover on a header: it rises. Keyboard focus on the next header: the 3 px ring.
  const cab = p.getByTestId('red-episodio');
  await cab.nth(0).hover();
  await p.waitForTimeout(200);
  const enHover = await cab.nth(0).evaluate((b) => getComputedStyle(b).boxShadow);
  afirmar(enHover !== 'none', `${pref}: la cabecera con el puntero encima sube (${enHover})`);
  await p.mouse.move(2, 2);
  await cab.nth(1).focus();
  await p.keyboard.press('Shift+Tab');
  await p.keyboard.press('Tab');
  await p.waitForTimeout(200);
  const enFoco = await cab.nth(1).evaluate((b) => ({ foco: b.matches(':focus-visible'), sombra: getComputedStyle(b).boxShadow }));
  afirmar(enFoco.foco && /0px 0px 0px 3px/.test(enFoco.sombra), `${pref}: el foco por teclado dibuja el anillo de 3 px ${JSON.stringify(enFoco)}`);
  await p.screenshot({ path: `${OUT}/${pref}-02-foco-cabecera.png` });

  // Expanded: the open header has its shadow, nodes are flat at rest and rise on hover, with no lift.
  await p.getByTestId('red-desplegar-todo').click();
  await p.locator('.red__hilo--desplegado').first().waitFor();
  await p.mouse.move(2, 2);
  await p.waitForTimeout(300);
  m = await medir(p);
  afirmar(m.cabeceras.every((c) => c.abierto !== 'true' || c.sombra !== 'none'), `${pref}: la cabecera abierta lleva su sombra`);
  // H-4 (asked by G): an expanded strip with nothing in view still says what it has out of view, as records.
  const vacios = await p.evaluate(() => [...document.querySelectorAll('.red__hilo--desplegado')].filter((h) => h.querySelector('[data-testid="red-fuera"]')).map((h) => [...h.querySelectorAll('[data-testid="red-fuera"]')].map((b) => b.getAttribute('aria-label'))));
  anotar(`${pref}: franjas desplegadas con chip (sus registros fuera de la vista) ${vacios.length}: ${JSON.stringify(vacios)}`);
  afirmar(vacios.every((ls) => ls.length > 0 && ls.every((l) => /registros? de /.test(l) && !/marcas? de /.test(l))), `${pref}: el chip de una franja desplegada dice «registro(s)», no «marca(s)»`);
  // Node stripe in brand/neutral, never the record type's status tone; recorded links dimmer in dark.
  const tinta = await p.evaluate(() => {
    const probe = (v) => { const e = document.createElement('span'); e.style.color = `var(${v})`; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; };
    const franjas = [...new Set([...document.querySelectorAll('.red__nodo:not(.red__nodo--atenuado):not(.red__nodo--compacto):not(.red__nodo--grupo)')].map((n) => getComputedStyle(n).borderInlineStartColor))];
    const enlace = [...document.querySelectorAll('.red__arista--enlace')].map((a) => getComputedStyle(a).stroke)[0] ?? null;
    return { franjas, neutro: probe('--border-default'), estados: ['--st-error-fg', '--st-success-fg', '--st-warning-fg', '--st-error-bd', '--st-success-bd', '--st-warning-bd'].map(probe), enlace, exito: probe('--st-success-fg'), exito400: probe('--c-success-400') };
  });
  const tachadoNodo = await p.evaluate(() => {
    const ref = document.createElement('span'); ref.style.color = 'var(--st-error-fg)'; document.body.append(ref);
    const rojo = getComputedStyle(ref).color; ref.remove();
    return { rojo, rayas: [...document.querySelectorAll('.red__nodo--descartado .red__marca')].map((m) => getComputedStyle(m, '::after').backgroundColor) };
  });
  afirmar(tachadoNodo.rayas.length > 0 && tachadoNodo.rayas.every((c) => c === tachadoNodo.rojo), `${pref}: el tachado del nodo descartado sigue en --st-error-fg ${JSON.stringify(tachadoNodo)}`);
  afirmar(tinta.franjas.every((c) => c === tinta.neutro) && !tinta.franjas.some((c) => tinta.estados.includes(c)), `${pref}: la franja de los nodos en reposo es neutra, no un tono de estado ${JSON.stringify(tinta.franjas)}`);
  afirmar(tinta.enlace === (tema === 'dark' ? tinta.exito400 : tinta.exito), `${pref}: el trazo de las aristas registradas es ${tema === 'dark' ? 'success-400 (más tenue)' : '--st-success-fg'} (${tinta.enlace})`);
  afirmar(m.nodos > 0 && m.nodosConSombra === 0, `${pref}: los nodos en reposo van planos (${m.nodosConSombra} de ${m.nodos} con sombra)`);
  const nodo = p.locator('.red__nodo:not(.red__nodo--compacto):not(.red__nodo--grupo)').first();
  // Hover first (Playwright scrolls it into view), then compare against the same node with the pointer away.
  await nodo.hover();
  await p.waitForTimeout(250);
  const sobre = await nodo.evaluate((n) => ({ top: n.getBoundingClientRect().top, sombra: getComputedStyle(n).boxShadow, curva: getComputedStyle(n).transitionTimingFunction, franja: getComputedStyle(n).borderInlineStartColor }));
  const marca = await p.evaluate(() => { const e = document.createElement('span'); e.style.color = 'var(--brand-primary)'; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; });
  afirmar(sobre.franja === marca, `${pref}: con el puntero, la franja del nodo pasa a --brand-primary (${sobre.franja})`);
  await p.screenshot({ path: `${OUT}/${pref}-03-desplegado-hover.png` });
  await p.mouse.move(2, 2);
  await p.waitForTimeout(250);
  const antes = await nodo.evaluate((n) => n.getBoundingClientRect().top);
  afirmar(sobre.sombra !== 'none' && Math.abs(sobre.top - antes) < 0.5 && !/\bease\b(?!-)/.test(sobre.curva.replace(/cubic-bezier\([^)]*\)/g, '')), `${pref}: el nodo con el puntero sube de sombra sin moverse y con la curva del sistema ${JSON.stringify({ desplazado: sobre.top - antes, curva: sobre.curva })}`);
  // H-4 again with the canvas at its oldest end: the recent strips then have nothing in view.
  await p.locator('.red__lienzo').evaluate((l) => { l.scrollLeft = 0; });
  await p.waitForTimeout(400);
  const vacios0 = await p.evaluate(() => [...document.querySelectorAll('.red__hilo--desplegado')].filter((h) => h.querySelector('[data-testid="red-fuera"]')).map((h) => [...h.querySelectorAll('[data-testid="red-fuera"]')].map((b) => b.getAttribute('aria-label'))));
  anotar(`${pref}: al inicio, franjas desplegadas con chip (sus registros fuera de la vista) ${vacios0.length}: ${JSON.stringify(vacios0)}`);
  afirmar(vacios0.every((ls) => ls.length > 0 && ls.every((l) => /registros? de /.test(l) && !/marcas? de /.test(l))), `${pref}: al inicio, el chip de una franja desplegada dice «registro(s)»`);
  if (vacios0.length) await p.screenshot({ path: `${OUT}/${pref}-04-desplegado-inicio.png` });
  afirmar(errores.length === 0, `${pref}: sin errores de consola ${JSON.stringify(errores.slice(0, 3))}`);
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  try {
    for (const tema of ['light', 'dark']) for (const ancho of [768, 1024, 1440, 1920]) {
      try { await medica(b, ancho, tema); } catch (e) { fallas++; anotar(`FALLA ${FASE} ${ancho} ${tema}: ${e.message.split('\n')[0]}`); }
    }
  } finally {
    await b.close();
    fs.writeFileSync(`${OUT}/aserciones-${FASE}.txt`, log.join('\n') + `\n\nfallas: ${fallas}\n`);
  }
  process.exit(FASE === 'despues' && fallas ? 1 : 0);
})();

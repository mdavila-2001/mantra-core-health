// Final captures on a clean HEAD: shared logger and the network measurements the reviews asked for.
// Every check measures the finding itself (Range boxes, axis dots, SVG path ends), not a proxy.
const fs = require('fs');
const t3 = require('../tanda-visual-3/captura-tanda-3.cjs');

/** A logger with ok/FALLA lines and a counter; `cerrar` writes the file. */
function bitacora(archivo) {
  const log = [];
  const r = { fallas: 0 };
  r.anotar = (s) => { log.push(s); console.log(s); };
  r.afirmar = (cond, texto) => { r.anotar(`${cond ? 'ok  ' : 'FALLA'} ${texto}`); if (!cond) r.fallas++; };
  r.noAplica = (texto) => r.anotar(`n/a  ${texto}`);
  r.cerrar = () => { r.anotar(`\n${r.fallas === 0 ? 'TODO OK' : r.fallas + ' FALLA(S)'}`); fs.writeFileSync(archivo, log.join('\n') + '\n'); };
  return r;
}

const nombreTema = (t) => (t === 'light' ? 'claro' : 'oscuro');
/** Failures the scripts provoke on purpose (`mock:fallos`) are logged by the interceptor; anything else counts. */
const ajenos = (errores) => errores.filter((e) => !/correlationId=mock-fallo|→ sin respuesta|mock-fallo/.test(e));

/** Focus description; `body` means it was lost. */
const foco = (p) => p.evaluate(() => {
  const e = document.activeElement;
  if (!e || e === document.body || e === document.documentElement) return 'body';
  return `${e.tagName.toLowerCase()}${e.dataset.testid ? `[${e.dataset.testid}]` : ''} «${(e.getAttribute('aria-label') ?? e.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)}»`;
});

/**
 * One pass over the network, in viewport pixels. Horizontal canvas or the phone's vertical list.
 * PLEGADA = header 48 + track 32; CABECERA = the header row alone (only a «N después» chip).
 */
const medirRed = (p) => p.evaluate(() => {
  const caja = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const cruza = (a, b) => a.r > b.l + 0.5 && a.l < b.r - 0.5 && a.b > b.t + 0.5 && a.t < b.b - 0.5;
  const rango = (e) => { const g = document.createRange(); g.selectNodeContents(e); return g.getBoundingClientRect(); };
  const header = document.querySelector('header[app-header]');
  const tope = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
  const desborde = [document.documentElement.scrollWidth, document.documentElement.clientWidth];
  const lienzo = document.querySelector('.red__lienzo');
  // Episode names: the laid-out text against its own box, and the box against the visible area.
  const area = lienzo ? caja(lienzo) : { l: 0, r: document.documentElement.clientWidth };
  const cortados = [...document.querySelectorAll('.red__episodio-nombre')].filter((n) => {
    const r = n.getBoundingClientRect(); const t = rango(n);
    return r.width > 0 && (r.left < area.l - 1 || r.right > area.r + 1 || t.width > r.width + 0.5 || t.height > r.height + 0.5 || t.right > r.right + 0.5);
  }).map((n) => n.textContent.trim());
  if (!lienzo) return { vertical: true, tope: Math.round(tope), desborde, cortados };

  const vista = caja(lienzo);
  const dentro = (r) => r.r > vista.l + 1 && r.l < vista.r - 1;
  const marcas = [...document.querySelectorAll('.red__marca-eje')].map(caja).filter(dentro);
  const etiquetas = [...document.querySelectorAll('.red__columna p')].map((e) => ({ t: e.textContent.trim(), c: (() => { const g = rango(e); return { l: g.left, t: g.top, r: g.right, b: g.bottom }; })() })).filter((x) => dentro(x.c));
  const saltos = [...document.querySelectorAll('.red__borde-salto')].map((b) => ({ t: b.textContent.trim(), c: caja(b) }));
  const choques = saltos.flatMap((s) => [
    ...marcas.filter((m) => cruza(s.c, m)).map((m) => `${s.t} × punto@${Math.round(m.l)}`),
    ...etiquetas.filter((e) => cruza(s.c, e.c)).map((e) => `${s.t} × «${e.t}»`),
  ]);
  const entreSaltos = saltos.length === 2 && cruza(saltos[0].c, saltos[1].c) ? [`${saltos[0].t} × ${saltos[1].t}`] : [];
  const cols = [...document.querySelectorAll('.red__columna')].map((li) => ({ c: caja(li), ps: [...li.querySelectorAll('p')].map((e) => e.textContent.trim()) }));
  const visible = (c) => (c.l + c.r) / 2 >= vista.l;
  const primera = cols.find((x) => visible(x.c));
  const huerfanos = cols.filter((x, i) => visible(x.c) && /mismo día/i.test(x.ps.join(' ')) && (i === 0 || !visible(cols[i - 1].c))).map((x) => x.ps.join(' / '));
  // Axis dates painted in the viewport must sit below the app bar, never behind it.
  const fechas = [...document.querySelectorAll('.red__columna .red__fecha')].map((f) => rango(f)).filter((f) => f.right > vista.l && f.left < vista.r && f.bottom > 0 && f.top < innerHeight);
  const fechasBajoBarra = fechas.filter((f) => f.top < tope - 0.5).length;
  // Expanded threads with nothing in view and their heights.
  const hilos = [...document.querySelectorAll('[data-testid="red-hilo"].red__hilo--desplegado')].map((li) => {
    const nodos = [...li.querySelectorAll('[data-testid="recorrido-nodo"]')].map((b) => b.getBoundingClientRect());
    return { nombre: li.querySelector('.red__cabecera-hilo')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 36), alto: Math.round(li.getBoundingClientRect().height), visibles: nodos.filter((n) => n.right > vista.l && n.left < vista.r).length };
  });
  const plegados = [...document.querySelectorAll('[data-testid="red-hilo"]:not(.red__hilo--desplegado)')].map((h) => Math.round(h.getBoundingClientRect().height));
  // Line ends: inside the visible canvas, and either on a node edge or carrying the «sigue» marker.
  const nodos = [...document.querySelectorAll('[data-testid="recorrido-nodo"]')].map((b) => b.getBoundingClientRect());
  const svg = document.querySelector('.red__trazos');
  const extremos = [];
  if (svg) {
    const ctm = svg.getScreenCTM();
    for (const el of svg.querySelectorAll('path.red__arista')) {
      const largo = el.getTotalLength();
      if (largo === 0) continue;
      for (const [en, marca] of [[0, 'marker-start'], [largo, 'marker-end']]) {
        const pt = el.getPointAtLength(en); const q0 = svg.createSVGPoint(); q0.x = pt.x; q0.y = pt.y; const q = q0.matrixTransform(ctm);
        const enNodo = nodos.some((c) => (Math.abs(q.x - c.left) <= 2 || Math.abs(q.x - c.right) <= 2) && q.y >= c.top - 1 && q.y <= c.bottom + 1);
        extremos.push({ x: Math.round(q.x), dentro: q.x >= vista.l - 0.5 && q.x <= vista.r + 0.5, indicador: el.getAttribute(marca) === 'url(#red-sigue)', enNodo });
      }
    }
  }
  return {
    vertical: false, tope: Math.round(tope), desborde, cortados, choques,
    entreSaltos, saltos: saltos.map((s) => s.t), scrollLeft: Math.round(lienzo.scrollLeft),
    primera: primera ? primera.ps.join(' / ') : null, huerfanos,
    fechasTop: fechas.length ? Math.round(Math.min(...fechas.map((f) => f.top))) : null, fechasBajoBarra,
    lienzoTop: Math.round(vista.t), pegado: lienzo.parentElement.hasAttribute('data-eje-pegado'),
    hilos, plegados, extremos,
  };
});

/** The assertions shared by every state; `cuales` picks the ones that apply. */
function afirmarRed(B, m, pref, cuales = []) {
  B.afirmar(m.cortados.length === 0, `${pref}: ningún nombre de episodio cortado (Range vs caja) ${JSON.stringify(m.cortados)}`);
  B.afirmar(m.desborde[0] <= m.desborde[1], `${pref}: sin desplazamiento horizontal (scrollWidth ${m.desborde[0]} ≤ ${m.desborde[1]})`);
  if (m.vertical) return B.noAplica(`${pref}: vista angosta (lista vertical): sin eje, chips de borde ni aristas`);
  B.afirmar(m.choques.length === 0, `${pref}: los chips del borde (${m.saltos.join(', ') || 'ninguno'}) no tocan puntos del eje ni fechas ${JSON.stringify(m.choques)}`);
  B.afirmar(m.entreSaltos.length === 0, `${pref}: los dos chips del borde no se pisan entre sí ${JSON.stringify(m.entreSaltos)}`);
  B.afirmar(/\b20\d\d\b/.test(m.primera ?? '') && m.huerfanos.length === 0, `${pref}: la primera columna visible muestra el año «${m.primera}» (scrollLeft ${m.scrollLeft}); «mismo día» huérfanos ${JSON.stringify(m.huerfanos)}`);
  B.afirmar(m.fechasBajoBarra === 0, `${pref}: ninguna fecha del eje bajo la barra de la app (barra ${m.tope}, fecha más alta ${m.fechasTop}, debajo de la barra: ${m.fechasBajoBarra})`);
  if (cuales.includes('franjas')) {
    const vacias = m.hilos.filter((h) => h.visibles === 0);
    B.afirmar(vacias.every((h) => h.alto === 80 || h.alto === 48), `${pref}: las ${vacias.length} franjas desplegadas sin registros a la vista miden 80 o 48 px ${JSON.stringify(vacias.map((h) => [h.nombre, h.alto]))}`);
    const fuera = m.extremos.filter((e) => !e.dentro || (!e.enNodo && !e.indicador));
    B.afirmar(fuera.length === 0, `${pref}: ${m.extremos.length} extremos de arista; fuera del lienzo o sueltos sin indicador: ${fuera.length} ${JSON.stringify(fuera.slice(0, 4))} (con «sigue»: ${m.extremos.filter((e) => e.indicador).length})`);
  }
}

module.exports = { ...t3, bitacora, nombreTema, ajenos, foco, medirRed, afirmarRed };

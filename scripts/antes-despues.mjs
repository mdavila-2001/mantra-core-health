#!/usr/bin/env node
/**
 * Genera `ANTES_DESPUES.html` a partir de las capturas reales de
 * `playwright/movil-captura.spec.ts`.
 *
 * Empareja, por actor y por ruta, la captura de `01-antes` con la de
 * `02-despues` (tema claro y oscuro) y las pone lado a lado. Resume además cuántos
 * defectos medidos había antes y cuántos quedan. No dibuja nada que no salga de
 * una captura o de una medición: sin captura, la fila dice «sin captura».
 *
 *   node scripts/antes-despues.mjs
 *   node scripts/antes-despues.mjs docs/trabajo/<otro-trabajo>
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const TRABAJO = process.argv[2] ?? join('docs', 'trabajo', '2026-10-21-movil-paridad-estetica');
const EVIDENCIA = join(TRABAJO, 'evidencia');
const SALIDA = join(TRABAJO, 'ANTES_DESPUES.html');
const ACTORES = ['publicas', 'paciente', 'medica', 'superadmin'];
const ROTULO = { publicas: 'Sin sesión', paciente: 'Paciente', medica: 'Médica', superadmin: 'Superadmin' };
/**
 * Mediciones que cuentan como defecto (las demás son informativas).
 * `pestanas-desbordan` queda fuera a propósito: la corrida «antes» no excluía las
 * pestañas con flechas y dio 15 falsos positivos.
 */
const DEFECTOS = [
  'desborde', 'recorte', 'objetivo-chico', 'tabla-ancha', 'tabla-columnas',
  'cortado', 'texto-chico', 'sin-marca', 'muy-larga', 'h1', 'texto-roto', 'uuid-visible',
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function leer(fase, actor) {
  const archivo = join(EVIDENCIA, fase, actor, 'medicion.json');
  return existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : [];
}

const url = (ruta) => relative(TRABAJO, ruta).split('\\').join('/');

/** La captura de una pantalla: WebP si existe (así se versionan), PNG si no. */
function celda(fase, actor, archivo, tema) {
  const base = join(EVIDENCIA, fase, actor, `${archivo}-${tema}`);
  const imagen = [`${base}.webp`, `${base}.png`].find(existsSync);
  if (!archivo || !imagen) return '<div class="vacio">sin captura</div>';
  return `<a href="${url(imagen)}" target="_blank" rel="noopener"><img loading="lazy" src="${url(imagen)}" alt="${esc(`${fase} ${actor} ${archivo} ${tema}`)}"></a>`;
}

const defectosDe = (m) => Object.keys(m?.problemas ?? {}).filter((k) => DEFECTOS.includes(k));

let totalAntes = 0;
let totalDespues = 0;
let pantallas = 0;
let mejoradas = 0;
const porClase = {};
const secciones = [];

for (const actor of ACTORES) {
  const antes = new Map(leer('01-antes', actor).map((m) => [m.ruta, m]));
  const despues = new Map(leer('02-despues', actor).map((m) => [m.ruta, m]));
  const filas = [];
  for (const [ruta, a] of antes) {
    if (!a.archivo) continue;
    const d = despues.get(ruta);
    const da = defectosDe(a);
    const dd = d ? defectosDe(d) : da;
    pantallas++;
    totalAntes += da.length;
    totalDespues += dd.length;
    if (d && dd.length < da.length) mejoradas++;
    for (const k of da) (porClase[k] ??= { antes: 0, despues: 0 }).antes++;
    for (const k of dd) (porClase[k] ??= { antes: 0, despues: 0 }).despues++;
    const resueltos = da.filter((k) => !dd.includes(k));
    filas.push(`
<article class="par" data-actor="${actor}">
  <header><h3>${esc(ruta)}</h3>
    <p>${d ? '' : '<span class="aviso">sin captura «después»</span> '}
    ${resueltos.length ? `<span class="ok">corregido: ${resueltos.map(esc).join(', ')}</span>` : ''}
    ${dd.length ? `<span class="resta">queda: ${dd.map(esc).join(', ')}</span>` : '<span class="ok">sin defectos medidos</span>'}</p></header>
  <div class="cols">
    <figure><figcaption>Antes · claro</figcaption>${celda('01-antes', actor, a.archivo, 'claro')}</figure>
    <figure><figcaption>Después · claro</figcaption>${celda('02-despues', actor, d?.archivo ?? a.archivo, 'claro')}</figure>
    <figure class="oscuro-col"><figcaption>Antes · oscuro</figcaption>${celda('01-antes', actor, a.archivo, 'oscuro')}</figure>
    <figure class="oscuro-col"><figcaption>Después · oscuro</figcaption>${celda('02-despues', actor, d?.archivo ?? a.archivo, 'oscuro')}</figure>
  </div>
</article>`);
  }
  if (filas.length) secciones.push(`<section><h2>${ROTULO[actor]} <small>${filas.length} pantallas</small></h2>${filas.join('')}</section>`);
}

const tabla = Object.entries(porClase)
  .sort((x, y) => y[1].antes - x[1].antes)
  .map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${v.antes}</td><td>${v.despues}</td></tr>`)
  .join('');

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Antes y después — móvil 390 px</title>
<style>
:root{--bg:#f7f5f1;--panel:#fff;--tx:#1c2a33;--mut:#5b6b75;--ln:#d7dee2;--ok:#17663f;--mal:#9a2c2c;--acc:#0b557e}
@media (prefers-color-scheme:dark){:root{--bg:#0c1a22;--panel:#122632;--tx:#e8f0f3;--mut:#9db3bd;--ln:#244050;--ok:#6fd1a0;--mal:#f19a9a;--acc:#6cc3d6}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.5 system-ui,sans-serif;padding:16px}
main{max-width:1500px;margin:auto}h1{font-size:1.6rem;margin:.2em 0}h2{margin-top:2.2em}h3{margin:0;font-size:1rem;font-family:ui-monospace,monospace}
small{color:var(--mut);font-weight:400}.res{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}
.res div{background:var(--panel);border:1px solid var(--ln);border-radius:12px;padding:12px 16px;min-width:140px}.res b{display:block;font-size:1.8rem}
table{border-collapse:collapse;background:var(--panel);border:1px solid var(--ln);border-radius:8px}th,td{padding:6px 14px;text-align:left;border-bottom:1px solid var(--ln)}td{text-align:right}
.par{background:var(--panel);border:1px solid var(--ln);border-radius:12px;padding:12px;margin:14px 0}.par p{margin:.3em 0 .8em;font-size:.85rem}
.ok{color:var(--ok);margin-right:12px}.resta{color:var(--mal)}.aviso{color:var(--mal);font-weight:600}
.cols{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}@media(max-width:900px){.cols{grid-template-columns:repeat(2,minmax(0,1fr))}}
figure{margin:0;min-width:0}figcaption{font-size:.75rem;color:var(--mut);margin-bottom:4px}
figure a{display:block;max-height:760px;overflow:hidden;border:1px solid var(--ln);border-radius:8px;position:relative}
figure img{display:block;width:100%;height:auto}.vacio{border:1px dashed var(--ln);border-radius:8px;padding:40px 8px;text-align:center;color:var(--mut)}
.nota{color:var(--mut);max-width:70ch}
</style></head><body><main>
<h1>Antes y después — móvil 390 × 844</h1>
<p class="nota">Capturas reales de Chromium contra la aplicación en ejecución (backend simulado), página completa, tema claro y oscuro. Cada imagen abre a tamaño completo. «Defecto» es lo que mide <code>playwright/movil-captura.spec.ts</code>; lo que no se puede medir (jerarquía, ritmo, estética) se juzga mirando las capturas.</p>
<div class="res"><div><b>${pantallas}</b>pantallas comparadas</div><div><b>${mejoradas}</b>con menos defectos</div><div><b>${totalAntes}</b>defectos antes</div><div><b>${totalDespues}</b>defectos después</div></div>
<table><thead><tr><th>Clase</th><th>Antes</th><th>Después</th></tr></thead><tbody>${tabla}</tbody></table>
${secciones.join('\n')}
</main></body></html>`;

writeFileSync(SALIDA, html);
console.log(`${SALIDA}: ${pantallas} pantallas · defectos ${totalAntes} → ${totalDespues} · mejoradas ${mejoradas}`);

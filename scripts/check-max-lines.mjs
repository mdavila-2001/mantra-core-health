#!/usr/bin/env node
/**
 * Tamaño máximo de archivo (portado de `check-max-lines.mjs` de ATLAS, 300 líneas
 * en el portal admin). El techo es `TOPE` (600) líneas y **no se sube**.
 *
 * Alovida tiene archivos de 3 000 líneas. Los que ya superaban el techo cuando
 * se reactivó el CI (O1-4, 31/10/2026) quedan en una **lista de excepciones con
 * fecha de vencimiento**, `scripts/baselines/max-lines.json`, ligada a la tarea
 * que los parte (O4-5). Cada excepción congela el tamaño que tenía el archivo
 * ese día. El gate falla si:
 *   - un archivo que NO está en la lista supera `TOPE` (archivo nuevo, o uno que
 *     cruzó el techo después de que se fijó la lista);
 *   - un archivo de la lista crece por encima de su tamaño congelado;
 *   - una excepción está VENCIDA (hoy es posterior a su `vence`) y el archivo
 *     sigue por encima de `TOPE`.
 * Una excepción que ya no hace falta (el archivo bajó de `TOPE` o no existe) es
 * un aviso: `--actualizar` la quita.
 *
 * Un componente que crece se parte (plantilla/estilos/lógica), no se silencia.
 * `--actualizar` sólo BAJA: recorta los tamaños congelados al tamaño actual y
 * quita las excepciones sobrantes. Nunca agrega un archivo ni sube un número.
 * Agregar una excepción o mover un vencimiento es una edición a mano del JSON,
 * que se discute en el PR.
 *
 * Exentos: specs, `*.generated.ts`, `*.data.ts` (catálogos de datos) y `styles/`.
 *
 * Uso: node scripts/check-max-lines.mjs [--lista] [--actualizar]
 *      CHECK_MAX_LINES_HOY=2027-01-16 node scripts/check-max-lines.mjs   # simula otra fecha
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { read, repoPath, REPO_ROOT, SRC_ROOT, walk } from './lib/scan.mjs';

const argv = process.argv.slice(2);
const TOPE = 600;
const EXCEPCIONES = join(REPO_ROOT, 'scripts/baselines/max-lines.json');
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const hoy = process.env.CHECK_MAX_LINES_HOY ?? new Date().toISOString().slice(0, 10);
if (!FECHA.test(hoy)) {
  console.error(`✗ check-max-lines — CHECK_MAX_LINES_HOY no es una fecha AAAA-MM-DD: ${hoy}`);
  process.exit(2);
}

const medidas = new Map(
  walk(SRC_ROOT, ['.ts', '.html', '.css'])
    .map((a) => ({ ruta: repoPath(a), lineas: read(a).split('\n').length }))
    .filter((f) => !/\.(spec|generated|data)\.ts$/.test(f.ruta) && !f.ruta.startsWith('src/styles') && f.ruta !== 'src/styles.css')
    .map((f) => [f.ruta, f.lineas]),
);
const filas = [...medidas]
  .filter(([, lineas]) => lineas > TOPE)
  .map(([ruta, lineas]) => ({ ruta, lineas }))
  .sort((a, b) => b.lineas - a.lineas);

if (argv.includes('--lista')) {
  console.log(`${filas.length} archivos por encima de ${TOPE} líneas:\n`);
  for (const f of filas) console.log(`${String(f.lineas).padStart(6)}  ${f.ruta}`);
  process.exit(0);
}

if (!existsSync(EXCEPCIONES)) {
  console.error(`✗ check-max-lines — falta ${repoPath(EXCEPCIONES)}`);
  process.exit(2);
}
const lista = JSON.parse(readFileSync(EXCEPCIONES, 'utf8'));
if (!FECHA.test(lista.vence ?? '') || typeof lista.excepciones !== 'object') {
  console.error(`✗ check-max-lines — ${repoPath(EXCEPCIONES)} necesita «vence» (AAAA-MM-DD) y «excepciones»`);
  process.exit(2);
}
/** El vencimiento de una excepción: el suyo propio o el de la lista. */
const venceDe = (e) => e.vence ?? lista.vence;
for (const [ruta, e] of Object.entries(lista.excepciones)) {
  if (!Number.isInteger(e?.lineas) || (e.vence !== undefined && !FECHA.test(e.vence))) {
    console.error(`✗ check-max-lines — excepción mal formada: ${ruta} (${JSON.stringify(e)})`);
    process.exit(2);
  }
}

const sobrantes = Object.keys(lista.excepciones).filter((ruta) => (medidas.get(ruta) ?? 0) <= TOPE);

if (argv.includes('--actualizar')) {
  let bajadas = 0;
  for (const ruta of sobrantes) delete lista.excepciones[ruta];
  for (const [ruta, e] of Object.entries(lista.excepciones)) {
    const actual = medidas.get(ruta);
    if (actual < e.lineas) {
      e.lineas = actual;
      bajadas++;
    }
  }
  writeFileSync(EXCEPCIONES, JSON.stringify(lista, null, 2) + '\n');
  console.log(`excepciones: ${sobrantes.length} quitada(s), ${bajadas} bajada(s); ninguna agregada ni subida`);
  process.exit(0);
}

const nuevos = [];
const crecidos = [];
const vencidos = [];
for (const f of filas) {
  const e = lista.excepciones[f.ruta];
  if (!e) nuevos.push(f);
  else if (venceDe(e) < hoy) vencidos.push({ ...f, vence: venceDe(e) });
  else if (f.lineas > e.lineas) crecidos.push({ ...f, techo: e.lineas });
}

for (const ruta of sobrantes) {
  console.warn(`  aviso: ${ruta} ya no supera ${TOPE} líneas; quitá su excepción con --actualizar`);
}

if (nuevos.length + crecidos.length + vencidos.length > 0) {
  console.error(`\n✗ check-max-lines — techo ${TOPE} líneas (hoy ${hoy})\n`);
  if (nuevos.length) {
    console.error(`  ${nuevos.length} archivo(s) por encima de ${TOPE} sin excepción:`);
    for (const f of nuevos) console.error(`    ${f.ruta}: ${f.lineas} líneas`);
  }
  if (crecidos.length) {
    console.error(`  ${crecidos.length} excepción(es) que crecieron por encima de su tamaño congelado:`);
    for (const f of crecidos) console.error(`    ${f.ruta}: ${f.lineas} líneas (congelado en ${f.techo})`);
  }
  if (vencidos.length) {
    console.error(`  ${vencidos.length} excepción(es) vencida(s) con el archivo todavía por encima de ${TOPE}:`);
    for (const f of vencidos) console.error(`    ${f.ruta}: ${f.lineas} líneas (venció ${f.vence})`);
  }
  console.error('\n  Partilo: plantilla en .html, estilos en .css, lógica en servicios/ayudas. No subas el techo.\n');
  process.exit(1);
}
console.log(
  `✓ check-max-lines — ${filas.length} archivo(s) por encima de ${TOPE} líneas, todos con excepción vigente ` +
    `(vence ${lista.vence}, ${lista.tarea ?? 's/tarea'}) y ninguno más grande que su tamaño congelado`,
);

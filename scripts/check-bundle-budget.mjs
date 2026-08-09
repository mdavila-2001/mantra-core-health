#!/usr/bin/env node
/**
 * Compara el artefacto construido con los presupuestos de `angular.json`.
 *
 * El build de Angular ya avisa; esto lo formaliza para un pipeline: da un
 * resultado explícito, un código de salida y un informe legible. Y permite
 * aplicar presupuestos que `angular.json` no expresa —por ejemplo, uno por
 * fragmento diferido—.
 *
 * Requiere haber ejecutado `yarn build` antes. Si no hay artefacto, lo dice y
 * sale sin fallar: es una verificación de artefacto, no de código.
 *
 * Uso: node scripts/check-bundle-budget.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { exists, REPO_ROOT } from './lib/scan.mjs';

const DIST = join(REPO_ROOT, 'dist/mantra-core-health/browser');

if (!exists(DIST)) {
  console.log('· check-bundle-budget — sin artefacto');
  console.log('  Ejecutá `yarn build` primero. No se verifica nada.');
  process.exit(0);
}

// --- presupuestos declarados ------------------------------------------------

const angular = JSON.parse(readFileSync(join(REPO_ROOT, 'angular.json'), 'utf8'));
const budgets =
  angular.projects['mantra-core-health'].architect.build.configurations.production.budgets ?? [];

/**
 * `500kB` / `1MB` / `4kb` → bytes, en base 1000.
 *
 * Angular informa y evalúa los presupuestos en base 1000 («516.70 kB»), no en
 * base 1024. Usar 1024 acá daría un número distinto del que imprime el build
 * para el mismo artefacto, y dos cifras que no coinciden para lo mismo es peor
 * que no tener la segunda.
 */
function toBytes(size) {
  const match = /^([\d.]+)\s*(b|kb|mb|gb)$/i.exec(String(size).trim());
  if (match === null) return Number.NaN;
  const factor = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9 }[match[2].toLowerCase()];
  return Number(match[1]) * factor;
}

function format(bytes) {
  return `${(bytes / 1e3).toFixed(2)} kB`;
}

// --- medición del artefacto -------------------------------------------------

/**
 * El paquete inicial es lo que `index.html` referencia.
 *
 * Leerlo del HTML y no sumar la carpeta entera es lo único correcto: la carpeta
 * contiene además los fragmentos diferidos y el HTML prerenderizado de las
 * cuatro rutas, que no se descargan en la primera carga.
 */
/**
 * Con `outputMode: "server"` el punto de entrada del navegador se llama
 * `index.csr.html` («client-side rendering»): `index.html` no existe, porque el
 * HTML de cada ruta lo produce el motor de Angular o el prerenderizado. Se
 * admiten los dos nombres para que esto siga funcionando si el modo cambia.
 */
const entry = ['index.csr.html', 'index.html']
  .map((name) => join(DIST, name))
  .find((file) => exists(file));

if (entry === undefined) {
  console.log('· check-bundle-budget — artefacto sin punto de entrada legible');
  console.log('  No se encontró index.csr.html ni index.html en dist/…/browser.');
  process.exit(0);
}

const html = readFileSync(entry, 'utf8');
const referenced = new Set();
const asset = /(?:src|href)="\/?([^"]+\.(?:js|css))"/g;
let match;
while ((match = asset.exec(html)) !== null) {
  referenced.add(match[1]);
}

let initialBytes = 0;
const initialFiles = [];
for (const name of referenced) {
  const file = join(DIST, name);
  if (!exists(file)) continue;
  const size = statSync(file).size;
  initialBytes += size;
  initialFiles.push({ name, size });
}

/** Los fragmentos que no referencia el HTML: los diferidos. */
const lazyFiles = readdirSync(DIST)
  .filter((name) => name.endsWith('.js') && !referenced.has(name))
  .map((name) => ({ name, size: statSync(join(DIST, name)).size }))
  .sort((a, b) => b.size - a.size);

// --- comparación ------------------------------------------------------------

const problems = [];
const notes = [];

for (const budget of budgets) {
  if (budget.type !== 'initial') continue;

  const warning = toBytes(budget.maximumWarning);
  const error = toBytes(budget.maximumError);

  if (Number.isFinite(error) && initialBytes > error) {
    problems.push(
      `paquete inicial ${format(initialBytes)} supera el umbral de ERROR (${format(error)})`,
    );
  } else if (Number.isFinite(warning) && initialBytes > warning) {
    notes.push(
      `paquete inicial ${format(initialBytes)} supera el umbral de aviso ` +
        `(${format(warning)}) por ${format(initialBytes - warning)}`,
    );
  }
}

// --- informe ----------------------------------------------------------------

console.log(problems.length > 0 ? '\n✗ check-bundle-budget\n' : '✓ check-bundle-budget');
console.log(`  inicial: ${format(initialBytes)} en ${initialFiles.length} archivos`);

for (const { name, size } of initialFiles.sort((a, b) => b.size - a.size)) {
  console.log(`    ${format(size).padStart(10)}  ${name}`);
}

if (lazyFiles.length > 0) {
  console.log(`  diferidos: ${lazyFiles.length} fragmentos`);
  for (const { name, size } of lazyFiles.slice(0, 5)) {
    console.log(`    ${format(size).padStart(10)}  ${name}`);
  }
}

for (const note of notes) console.log(`  ⚠ ${note}`);
for (const problem of problems) console.error(`  ✗ ${problem}`);

if (notes.length > 0 && problems.length === 0) {
  console.log('');
  console.log('  El aviso es preexistente y está registrado en docs/performance/budgets.md,');
  console.log('  con las dos salidas posibles: bajar el paquete o subir el umbral.');
}

process.exit(problems.length > 0 ? 1 : 0);

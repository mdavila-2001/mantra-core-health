#!/usr/bin/env node
/**
 * Verifica las tres reglas de arquitectura que el proyecto declara y que hoy
 * nada hacía cumplir.
 *
 * No modifica nada: lee el árbol de fuentes y falla con un informe.
 *
 *   1. Sin dependencias circulares.
 *   2. Las capas van en una sola dirección: features → shared → core.
 *   3. La superficie de red vive entera en `core/data-access/`.
 *
 * Las tres salen de reglas escritas en el propio código:
 *
 *   tsconfig.json      «lo que no entra en @core, @shared o @features no tiene lugar»
 *   shared/index.ts    «shared/ NUNCA importa de features/»
 *   integration-map    ningún componente arma una URL por su cuenta
 *
 * Uso: node scripts/check-architecture.mjs
 */

import { join } from 'node:path';

import {
  findCycles,
  read,
  REPO_ROOT,
  repoPath,
  scanModuleGraph,
  SRC_ROOT,
  walk,
} from './lib/scan.mjs';

/**
 * Excepción declarada, no un agujero.
 *
 * `core/dev/` es una herramienta de desarrollo: se carga de forma diferida y no
 * está montada en ninguna plantilla (`app.html` explica por qué se desmontó),
 * así que no entra al paquete inicial. Importa de `shared/` para reutilizar el
 * botón y el servicio de avisos en vez de duplicarlos.
 *
 * Se acota al prefijo para que la excepción no se pueda extender sin editar
 * este archivo — que es justamente donde hay que discutirlo.
 */
const LAYER_EXCEPTIONS = ['src/app/core/dev/'];

/** Dónde puede vivir una llamada HTTP. */
const NETWORK_ALLOWED = ['src/app/core/data-access/', 'src/app/app.config.ts'];

const problems = [];

// --- 1 · ciclos -------------------------------------------------------------

const graph = scanModuleGraph();
const cycles = findCycles(graph);

if (cycles.length > 0) {
  problems.push(
    `${cycles.length} dependencia(s) circular(es):`,
    ...cycles.map((cycle) => `    ${cycle.join('\n      → ')}`),
  );
}

// --- 2 · dirección de las capas --------------------------------------------

/** La capa de un archivo, deducida de su ruta. */
function layerOf(path) {
  if (path.includes('/core/')) return 'core';
  if (path.includes('/shared/')) return 'shared';
  if (path.includes('/features/')) return 'features';
  return 'root';
}

/** Lo que cada capa puede importar. `root` puede todo: es quien compone. */
const ALLOWED = {
  core: ['core', 'root'],
  shared: ['shared', 'core', 'root'],
  features: ['features', 'shared', 'core', 'root'],
  root: ['root', 'core', 'shared', 'features'],
};

const violations = graph.edges.filter(({ from, to }) => {
  if (LAYER_EXCEPTIONS.some((prefix) => from.startsWith(prefix))) return false;
  return !ALLOWED[layerOf(`/${from}`)].includes(layerOf(`/${to}`));
});

if (violations.length > 0) {
  problems.push(
    `${violations.length} import(s) contra la dirección de las capas:`,
    ...violations.map(({ from, to }) => `    ${from}\n      → ${to}`),
  );
}

// --- 3 · superficie de red --------------------------------------------------

const network = [];

for (const file of walk(SRC_ROOT, ['.ts'])) {
  const path = repoPath(file);
  if (path.endsWith('.spec.ts')) continue;
  if (NETWORK_ALLOWED.some((prefix) => path.startsWith(prefix))) continue;

  const source = read(file);
  if (/this\.http\s*\.|new\s+XMLHttpRequest|\bfetch\s*\(/.test(source)) {
    network.push(path);
  }
}

if (network.length > 0) {
  problems.push(
    `${network.length} archivo(s) hacen peticiones fuera de core/data-access/:`,
    ...network.map((path) => `    ${path}`),
  );
}

// --- informe ----------------------------------------------------------------

void join;
void REPO_ROOT;

if (problems.length > 0) {
  console.error('\n✗ check-architecture\n');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('');
  process.exit(1);
}

console.log('✓ check-architecture');
console.log(`  ${graph.files.length} archivos · ${graph.edges.length} importaciones internas`);
console.log('  sin ciclos · capas en una sola dirección · red confinada a core/data-access/');
console.log(
  `  excepción declarada: ${LAYER_EXCEPTIONS.join(', ')} (herramienta de desarrollo, diferida)`,
);

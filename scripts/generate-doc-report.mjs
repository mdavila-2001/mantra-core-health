#!/usr/bin/env node
/**
 * Corre las verificaciones documentales y resume.
 *
 * Es el paso único que va en un pipeline: seis comprobaciones, ninguna con
 * dependencias nuevas, todas de solo lectura salvo la regeneración de
 * inventarios —que aquí se ejecuta en modo `--check` y por tanto tampoco
 * escribe—.
 *
 * Sale con 1 si alguna falla, para que el pipeline se entere.
 *
 * Uso:
 *   node scripts/generate-doc-report.mjs
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { DOCS_ROOT, read, REPO_ROOT, repoPath, walk } from './lib/scan.mjs';

const CHECKS = [
  {
    name: 'inventarios al día',
    script: 'generate-inventory.mjs',
    args: ['--check'],
    why: 'los inventarios generados reflejan el código',
  },
  {
    name: 'arquitectura',
    script: 'check-architecture.mjs',
    args: [],
    why: 'sin ciclos, capas en una dirección, red confinada',
  },
  {
    name: 'enlaces documentales',
    script: 'check-doc-links.mjs',
    args: [],
    why: 'ningún enlace ni ancla interna rota',
  },
  {
    name: 'cobertura documental',
    script: 'check-doc-coverage.mjs',
    args: [],
    why: 'rutas, organismos y servicios documentados; sin marcadores',
  },
  {
    name: 'deriva de contrato de API',
    script: 'check-api-contract-drift.mjs',
    args: [],
    why: 'los endpoints del código coinciden con los declarados',
  },
  {
    name: 'prefijos de la API',
    script: 'check-api-prefixes.mjs',
    args: [],
    why: 'las tres declaraciones de la superficie de red dicen lo mismo',
  },
  {
    name: 'tokens del sistema de diseño',
    script: 'check-tokens.mjs',
    args: [],
    why: 'el catálogo tipado y styles.css declaran lo mismo, en ambos sentidos',
  },
  {
    name: 'contrastes del sistema de diseño',
    script: 'check-contrast.mjs',
    args: [],
    why: 'los tokens cumplen WCAG AA, salvo las excepciones declaradas',
  },
  {
    name: 'presupuesto de bundle',
    script: 'check-bundle-budget.mjs',
    args: [],
    why: 'el artefacto no supera el umbral de error',
  },
];

const results = [];

for (const check of CHECKS) {
  const run = spawnSync(
    process.execPath,
    [join(REPO_ROOT, 'scripts', check.script), ...check.args],
    { encoding: 'utf8' },
  );

  results.push({
    ...check,
    ok: run.status === 0,
    output: `${run.stdout ?? ''}${run.stderr ?? ''}`.trimEnd(),
  });
}

// --- cifras de la documentación --------------------------------------------

const docs = walk(DOCS_ROOT, ['.md']);
const words = docs.reduce((total, file) => total + read(file).split(/\s+/).length, 0);
const generated = docs.filter((file) => repoPath(file).includes('/generated/')).length;

// --- informe ----------------------------------------------------------------

const failed = results.filter((result) => !result.ok);

console.log('');
console.log('  Informe documental');
console.log('  ══════════════════');
console.log('');

for (const result of results) {
  console.log(`  ${result.ok ? '✓' : '✗'} ${result.name}`);
  console.log(`      ${result.why}`);
  for (const line of result.output.split('\n')) {
    if (line.trim() !== '') console.log(`      ${line.trim()}`);
  }
  console.log('');
}

console.log('  ──────────────────');
console.log(`  ${docs.length} páginas · ~${Math.round(words / 1000)}k palabras · ${generated} generadas`);
console.log('');

if (failed.length > 0) {
  console.error(`  ✗ ${failed.length} de ${results.length} verificaciones fallaron.`);
  console.error('');
  process.exit(1);
}

console.log(`  ✓ las ${results.length} verificaciones pasan.`);
console.log('');

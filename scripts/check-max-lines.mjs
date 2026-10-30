#!/usr/bin/env node
/**
 * Tamaño máximo de archivo (portado de `check-max-lines.mjs` de ATLAS, 300 líneas
 * en el portal admin). Alovida tiene archivos de 3 000 líneas, así que el gate es
 * un RATCHET igual que `check-colores-sueltos.mjs`: el techo por defecto es
 * `TOPE` líneas, y los archivos que ya lo superan quedan congelados en
 * `scripts/baselines/max-lines.json` con su tamaño actual. Falla si:
 *   - un archivo nuevo supera `TOPE`, o
 *   - un archivo congelado crece.
 * Un componente que crece se parte (plantilla/estilos/lógica), no se silencia.
 *
 * Exentos: specs, `*.generated.ts`, `*.data.ts` (catálogos de datos) y `styles/`.
 *
 * Uso: node scripts/check-max-lines.mjs [--lista] [--actualizar] [--tope 600]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { read, repoPath, REPO_ROOT, SRC_ROOT, walk } from './lib/scan.mjs';

const argv = process.argv.slice(2);
const TOPE = Number(argv.includes('--tope') ? argv[argv.indexOf('--tope') + 1] : 600);
const BASELINE = join(REPO_ROOT, 'scripts/baselines/max-lines.json');

const filas = walk(SRC_ROOT, ['.ts', '.html', '.css'])
  .map((a) => ({ ruta: repoPath(a), lineas: read(a).split('\n').length }))
  .filter(
    (f) =>
      !/\.(spec|generated|data)\.ts$/.test(f.ruta) &&
      !f.ruta.startsWith('src/styles') &&
      f.ruta !== 'src/styles.css' &&
      f.lineas > TOPE,
  )
  .sort((a, b) => b.lineas - a.lineas);

if (argv.includes('--lista')) {
  console.log(`${filas.length} archivos por encima de ${TOPE} líneas:\n`);
  for (const f of filas) console.log(`${String(f.lineas).padStart(6)}  ${f.ruta}`);
  process.exit(0);
}
if (argv.includes('--actualizar')) {
  writeFileSync(BASELINE, JSON.stringify(Object.fromEntries(filas.map((f) => [f.ruta, f.lineas])), null, 2) + '\n');
  console.log(`baseline reescrito: ${filas.length} archivos > ${TOPE}`);
  process.exit(0);
}
const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const peor = filas.filter((f) => f.lineas > (base[f.ruta] ?? TOPE));
if (peor.length > 0) {
  console.error(`\n✗ check-max-lines — ${peor.length} archivo(s) por encima de su techo\n`);
  for (const f of peor) console.error(`  ${f.ruta}: ${f.lineas} líneas (techo ${base[f.ruta] ?? TOPE})`);
  console.error('\n  Partilo: plantilla en .html, estilos en .css, lógica en servicios/ayudas. No subas el techo.\n');
  process.exit(1);
}
console.log(`✓ check-max-lines — ${filas.length} archivos heredados por encima de ${TOPE} líneas, ninguno nuevo ni más grande`);

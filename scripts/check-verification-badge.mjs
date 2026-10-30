#!/usr/bin/env node
/**
 * Guardián de la insignia de verificación: el sello de «verificado» se pinta
 * SOLO con `app-verification-badge`.
 *
 * Un check dibujado a mano en otra pantalla es un check que la API no autorizó:
 * se copia, se desactualiza y no pasa por el estado `verification.status` ni por
 * la defensa de vigencia vencida. Este gate falla si aparece un sello, un glifo
 * ✓ junto a «verificado» o una clase propia fuera del átomo (reglas en
 * `scripts/lib/verification-badge-gate.mjs`).
 *
 * ## RATCHET, como `check-colores-sueltos`
 *
 * Hay sellos heredados (la tarjeta de un centro, el sello de una ficha pública
 * de organización, la píldora de la guía): congelados en
 * `scripts/baselines/verification-badge.json` por archivo. El gate falla si un
 * archivo NUEVO trae hallazgos o uno heredado trae MÁS. Los heredados son de
 * organizaciones —el átomo dice «profesional verificado» y no sirve para una
 * clínica o una farmacia sin una decisión de producto—; migrarlos baja el techo.
 *
 * Uso:
 *   node scripts/check-verification-badge.mjs              # compuerta (exit 1 si empeora)
 *   node scripts/check-verification-badge.mjs --lista      # todos los hallazgos
 *   node scripts/check-verification-badge.mjs --actualizar # reescribe el baseline
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { findViolations } from './lib/verification-badge-gate.mjs';
import { read, repoPath, REPO_ROOT, SRC_ROOT, walk } from './lib/scan.mjs';

const BASELINE = join(REPO_ROOT, 'scripts/baselines/verification-badge.json');
const args = new Set(process.argv.slice(2));

const filas = [];
for (const archivo of walk(join(SRC_ROOT, 'app'), ['.css', '.html', '.ts'])) {
  const ruta = repoPath(archivo);
  const hallazgos = findViolations(ruta, read(archivo));
  if (hallazgos.length > 0) filas.push({ ruta, hallazgos });
}
filas.sort((a, b) => b.hallazgos.length - a.hallazgos.length);
const total = filas.reduce((s, f) => s + f.hallazgos.length, 0);

if (args.has('--lista')) {
  console.log(`${total} hallazgos en ${filas.length} archivos:\n`);
  for (const f of filas) {
    console.log(`${String(f.hallazgos.length).padStart(4)}  ${f.ruta}`);
    for (const h of f.hallazgos) console.log(`        ${h.regla} · línea ${h.linea}: ${h.muestra}`);
  }
  process.exit(0);
}

const actual = Object.fromEntries(filas.map((f) => [f.ruta, f.hallazgos.length]));

if (args.has('--actualizar')) {
  writeFileSync(BASELINE, JSON.stringify(actual, null, 2) + '\n');
  console.log(`baseline reescrito: ${total} hallazgos en ${filas.length} archivos`);
  process.exit(0);
}

const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const peor = filas.filter((f) => f.hallazgos.length > (base[f.ruta] ?? 0));
const mejor = Object.keys(base).filter((r) => (actual[r] ?? 0) < base[r]);

if (peor.length > 0) {
  console.error(`\n✗ check-verification-badge — ${peor.length} archivo(s) pintan un sello de verificación fuera del átomo\n`);
  for (const f of peor) {
    console.error(`  ${f.ruta}: ${f.hallazgos.length} (techo ${base[f.ruta] ?? 0})`);
    for (const h of f.hallazgos) console.error(`      ${h.regla} · línea ${h.linea}: ${h.muestra}`);
  }
  console.error('\n  Usá <app-verification-badge [status]="…"> (shared/components/atoms/verification-badge).');
  console.error('  El estado viene de `verificationOf(dto)` (core/verification): nunca se arma a mano.\n');
  process.exit(1);
}
console.log(`✓ check-verification-badge — ${total} hallazgos heredados en ${filas.length} archivos, ninguno nuevo`);
if (mejor.length > 0) console.log(`  (${mejor.length} archivo(s) bajaron su deuda: corré --actualizar para bajar el techo)`);

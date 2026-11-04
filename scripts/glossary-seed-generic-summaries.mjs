#!/usr/bin/env node
/**
 * Agrega `genericSummaries` al manifiesto de la semilla commiteada.
 *
 * Es lo que `buildGlossaryDataset` ya escribe al regenerar el glosario
 * completo; este script lo aplica a `public/glossary-seed/` sin regenerarlo
 * (la fuente completa no está en git). Misma función, mismo resultado, y es
 * idempotente: una segunda corrida no cambia nada.
 *
 * Uso: `node scripts/glossary-seed-generic-summaries.mjs`
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { resumenesGenericos } from './lib/glossary-shards.mjs';

const RAIZ = join(process.cwd(), 'public', 'glossary-seed');
const manifiesto = JSON.parse(readFileSync(join(RAIZ, 'manifest.json'), 'utf8'));

const filas = [];
for (const categoria of manifiesto.categories) {
  const carpeta = join(RAIZ, 'shards', categoria.key);
  if (!existsSync(carpeta)) continue;
  for (const archivo of readdirSync(carpeta).filter((a) => /^page-\d+\.json$/.test(a))) {
    filas.push(...JSON.parse(readFileSync(join(carpeta, archivo), 'utf8')));
  }
}

const genericos = resumenesGenericos(filas);
const igual = JSON.stringify(manifiesto.genericSummaries ?? null) === JSON.stringify(genericos);
if (igual) {
  console.log(`sin cambios: ${genericos.length} resúmenes genéricos ya declarados`);
} else {
  manifiesto.genericSummaries = genericos;
  const texto = JSON.stringify(manifiesto);
  writeFileSync(join(RAIZ, 'manifest.json'), texto);
  writeFileSync(join(RAIZ, 'shards', 'index.json'), texto);
  console.log(`manifiesto actualizado: ${genericos.length} resúmenes genéricos sobre ${filas.length} filas`);
}

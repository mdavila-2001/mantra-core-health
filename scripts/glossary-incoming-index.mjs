/**
 * Reconstruye el índice inverso de relaciones (`mock/incoming/<hh>.json`) de un
 * glosario en shards que ya existe, sin volver a generar los shards.
 *
 * `buildGlossaryDataset` ya lo escribe en cada generación nueva; este script
 * es para las raíces generadas antes de que existiera (la semilla commiteada
 * del 2026-10-01, o un `public/glossary-data/` ya descargado). Lee sólo los
 * shards de categoría —las filas ya traen `targetId` resuelto— y no toca
 * ningún otro archivo.
 *
 * Uso:
 *   yarn mock:glossary:incoming                        # public/glossary-seed y public/glossary-data
 *   yarn mock:glossary:incoming public/glossary-seed   # una raíz
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { buildIncomingIndex } from './lib/glossary-shards.mjs';

const RAIZ = process.cwd();
const RAICES = process.argv.length > 2
  ? process.argv.slice(2).map((ruta) => resolve(ruta))
  : ['glossary-seed', 'glossary-data'].map((nombre) => join(RAIZ, 'public', nombre));

/** Todas las filas de los shards de categoría de una raíz. */
function filasDe(raiz) {
  const shards = join(raiz, 'shards');
  const filas = [];
  for (const categoria of readdirSync(shards, { withFileTypes: true })) {
    if (!categoria.isDirectory()) continue;
    const carpeta = join(shards, categoria.name);
    for (const pagina of readdirSync(carpeta)) {
      if (!/^page-\d+\.json$/.test(pagina)) continue;
      filas.push(...JSON.parse(readFileSync(join(carpeta, pagina), 'utf8')));
    }
  }
  return filas;
}

for (const raiz of RAICES) {
  if (!existsSync(join(raiz, 'manifest.json'))) {
    console.log(`${raiz}: no es un glosario en shards, se saltea.`);
    continue;
  }
  const filas = filasDe(raiz);
  const archivos = buildIncomingIndex(filas);
  rmSync(join(raiz, 'mock', 'incoming'), { recursive: true, force: true });
  let aristas = 0;
  let bytes = 0;
  for (const [ruta, contenido] of archivos) {
    const destino = join(raiz, ruta);
    mkdirSync(dirname(destino), { recursive: true });
    const texto = JSON.stringify(contenido);
    bytes += Buffer.byteLength(texto);
    aristas += Object.values(contenido).reduce((total, lista) => total + lista.length, 0);
    writeFileSync(destino, texto);
  }
  console.log(
    `${raiz}: ${filas.length} términos, ${aristas} relaciones, ${archivos.size} cubetas, ${(bytes / 1024).toFixed(0)} kB → mock/incoming/`,
  );
}

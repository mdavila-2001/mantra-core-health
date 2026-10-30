/**
 * Los artículos enciclopédicos del glosario → cubetas de la maqueta.
 *
 * Lee `articles.ndjson` (TAREA-41 §12.3, lo emite cada corte de F9) y escribe
 * `mock/articles/<hh>.json` (ver `scripts/lib/glossary-articles.mjs`).
 *
 * Uso:
 *   node scripts/glossary-articles.mjs <articles.ndjson> [--build <glossary-data-build>]
 *                                     [--dest <carpeta>] [--sample <n>] [--slugs a,b,c]
 *
 * - Sin `--sample`, escribe todo en `public/glossary-data/` (fuera de git, pesa).
 * - Con `--sample`/`--slugs`, escribe sólo esos artículos en
 *   `public/glossary-seed/` (commiteada): la muestra chica con la que se prueba
 *   la ficha sin la descarga completa. `--slugs` fija cuáles; `--sample N`
 *   completa hasta N con los de más secciones.
 *
 * La tabla slug → id sale del build del glosario, no se recalcula: los ids que
 * trae la fila mandan (un enlace compartido sigue sirviendo).
 */
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

import { leerBuildDelGlosario } from './lib/glossary-build-reader.mjs';
import { conceptIdOf } from './lib/glossary-shards.mjs';
import { cubetasDeArticulos } from './lib/glossary-articles.mjs';

const RAIZ = process.cwd();
const args = process.argv.slice(2);
const opcion = (nombre) => {
  const i = args.indexOf(nombre);
  return i === -1 ? undefined : args[i + 1];
};
const ndjson = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (ndjson === undefined) {
  console.error('Uso: node scripts/glossary-articles.mjs <articles.ndjson> [opciones]');
  process.exit(1);
}
const build = resolve(opcion('--build') ?? process.env.GLOSSARY_DATA_BUILD ?? join(RAIZ, '..', 'glossary-data-build'));
const muestra = opcion('--sample');
const slugsPedidos = opcion('--slugs')?.split(',').filter(Boolean) ?? [];
const modoMuestra = muestra !== undefined || slugsPedidos.length > 0;
const destino = resolve(opcion('--dest') ?? join(RAIZ, 'public', modoMuestra ? 'glossary-seed' : 'glossary-data'));

const { filas } = leerBuildDelGlosario(build);
const idPorSlug = new Map(filas.map((fila) => [fila.slug, fila.id ?? conceptIdOf(fila.slug)]));

const lineas = [];
for await (const linea of createInterface({ input: createReadStream(resolve(ndjson)), crlfDelay: Infinity })) {
  lineas.push(linea);
}

let elegidas = lineas;
if (modoMuestra) {
  const parseadas = lineas.filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
  const porSlug = new Map(parseadas.map((a) => [a.conceptRef.slug, a]));
  const faltan = slugsPedidos.filter((s) => !porSlug.has(s));
  if (faltan.length > 0) {
    console.error(`Slugs sin artículo: ${faltan.join(', ')}`);
    process.exit(1);
  }
  const fijas = slugsPedidos.map((s) => porSlug.get(s));
  const resto = parseadas
    .filter((a) => !slugsPedidos.includes(a.conceptRef.slug))
    .sort((a, b) => b.sections.length - a.sections.length || a.conceptRef.slug.localeCompare(b.conceptRef.slug));
  const total = Math.max(Number(muestra ?? 0), fijas.length);
  elegidas = [...fijas, ...resto.slice(0, total - fijas.length)].map((a) => JSON.stringify(a));
}

const { archivos, escritos, sinTermino } = cubetasDeArticulos(elegidas, idPorSlug);
let bytes = 0;
for (const [ruta, contenido] of archivos) {
  const archivo = join(destino, ruta);
  mkdirSync(dirname(archivo), { recursive: true });
  const texto = JSON.stringify(contenido);
  bytes += Buffer.byteLength(texto);
  writeFileSync(archivo, texto);
}
console.log(`glossary-articles: ${escritos} artículos en ${archivos.size} cubetas, ${(bytes / 1024 / 1024).toFixed(2)} MB → ${destino}`);
if (sinTermino.length > 0) console.log(`glossary-articles: ${sinTermino.length} sin término en el glosario (primeros: ${sinTermino.slice(0, 5).join(', ')})`);

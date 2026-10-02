/**
 * Construye el **conjunto semilla** del glosario en formato de shards:
 * `public/glossary-seed/`, commiteado. Es lo que sirve la maqueta cuando no se
 * bajó la copia completa (`yarn mock:glossary:shards` → `public/glossary-data/`,
 * fuera de git), y por eso es lo que se ve en el VPS.
 *
 * Desde el 2026-10-01 sale de dos fuentes, y de ninguna otra:
 *
 * 1. **El glosario oficial** que emiten los importadores de la API en
 *    `glossary-data-build/` (CIE-10-ES en castellano, CIMA, MedlinePlus en
 *    español, anatomía TA98 y las relaciones de Wikidata), sin las fichas
 *    completas de `detail/` —la ficha técnica de CIMA pesa 269 MB y queda en la
 *    base y en la copia completa—.
 * 2. **Los 69 términos curados** de `glossary-terms.catalog.ts` del backend.
 *
 * Quedaron afuera, por la auditoría del 2026-10-01
 * (`docs/trabajo/2026-10-01-calidad-catalogos/` en la raíz):
 * - las 1 918 categorías ICD-10-CM con el título **en inglés** en `esName`;
 * - las capas de `data/glossary/` con definiciones y relaciones redactadas por
 *   desarrollo sin fuente (`pending-medical-review`);
 * - el índice del atlas de Netter: 548 láminas («Calcáneo lr») y 3 161
 *   entradas («Hueso — lateral») con la definición genérica de su tipo.
 *
 * Uso: `yarn mock:glossary:seed [<ruta-al-build>]` (por defecto
 * `../glossary-data-build`, o `GLOSSARY_DATA_BUILD`).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { build } from 'esbuild';

import { leerBuildDelGlosario, taxonomiaDe } from './lib/glossary-build-reader.mjs';
import { buildGlossaryDataset, conceptIdOf } from './lib/glossary-shards.mjs';

const RAIZ = process.cwd();
const ORIGEN = resolve(process.argv[2] ?? process.env.GLOSSARY_DATA_BUILD ?? join(RAIZ, '..', 'glossary-data-build'));
const DESTINO = join(RAIZ, 'public', 'glossary-seed');
const TEMPORAL = join(RAIZ, 'tmp', 'glossary-seed-export.mjs');
const CURADOS_ESPERADOS = 69;

// --- 1. Los curados, desde los mismos módulos que usa el simulador ------------
await build({
  entryPoints: [join(RAIZ, 'scripts', 'glossary-seed', 'export-rows.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: TEMPORAL,
  logLevel: 'error',
});
const { filas: filasDeFixtures, taxonomia: taxonomiaDeFixtures } = JSON.parse(
  execFileSync(process.execPath, [TEMPORAL], { maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' }),
);
rmSync(TEMPORAL, { force: true });

/** Curado = viene de `glossary-terms.catalog.ts`: ni lámina del atlas ni fila de capa. */
const esCurado = (fila) => fila.source === 'alovida-curated' && fila.reviewStatus === undefined && !String(fila.slug).startsWith('lamina-');
const curados = filasDeFixtures.filter(esCurado);
if (curados.length !== CURADOS_ESPERADOS) {
  throw new Error(`Se esperaban ${CURADOS_ESPERADOS} términos curados y salieron ${curados.length}: revisá el filtro antes de publicar.`);
}

// Paridad del hash: los ids de los fixtures tienen que ser los que el
// constructor calcula para una fila sin id. Si esto falla, un enlace a un
// término del glosario completo dejaría de coincidir con el de la semilla.
if (conceptIdOf(curados[0].slug) !== curados[0].id) {
  throw new Error('El hash de ids de scripts/lib/glossary-shards.mjs no coincide con mock-store.ts.');
}

// --- 2. El glosario oficial ---------------------------------------------------
const { filas: oficiales, indice } = leerBuildDelGlosario(ORIGEN);
// La semilla no lleva `detail/`: la tarjeta no promete una ficha que no viaja.
const tarjetas = oficiales.map((fila) => ({ ...fila, hasDetail: false }));

const slugs = new Set(tarjetas.map((f) => f.slug));
const choques = curados.filter((f) => slugs.has(f.slug)).map((f) => f.slug);
if (choques.length) throw new Error(`Slugs de curados repetidos en el glosario oficial: ${choques.join(', ')}`);

const filas = [...curados, ...tarjetas];
const archivos = buildGlossaryDataset(filas, { ...taxonomiaDe(filas, indice, taxonomiaDeFixtures), source: 'seed' });

rmSync(DESTINO, { recursive: true, force: true });
let bytes = 0;
for (const [ruta, contenido] of archivos) {
  const destino = join(DESTINO, ruta);
  mkdirSync(dirname(destino), { recursive: true });
  const texto = JSON.stringify(contenido);
  bytes += Buffer.byteLength(texto);
  writeFileSync(destino, texto);
}

console.log(
  `glossary-seed: ${curados.length} curados + ${tarjetas.length} oficiales de ${ORIGEN} = ${filas.length} términos, ${archivos.size} archivos, ${(bytes / 1024 / 1024).toFixed(2)} MB → public/glossary-seed/`,
);
